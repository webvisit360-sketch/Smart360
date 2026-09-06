import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/**
 * Guest-content writes and the tenant dirty flag must commit together. These
 * idempotent triggers make the database the authoritative boundary, including
 * writes made by Creator materialization and maintenance jobs.
 */
export async function ensureGuestDirtyTriggers(): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('smart360:guest-dirty-triggers', 0))`);
    await tx.execute(sql`
    CREATE OR REPLACE FUNCTION smart360_mark_guest_content_dirty()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $function$
    DECLARE
      old_tenant_id uuid;
      new_tenant_id uuid;
      row_id uuid;
      parent_id uuid;
      row_model text;
    BEGIN
      IF TG_TABLE_NAME = 'sections' THEN
        IF TG_OP <> 'INSERT' THEN old_tenant_id := OLD.tenant_id; END IF;
        IF TG_OP <> 'DELETE' THEN new_tenant_id := NEW.tenant_id; END IF;

      ELSIF TG_TABLE_NAME = 'categories' THEN
        IF TG_OP <> 'INSERT' THEN
          SELECT tenant_id INTO old_tenant_id FROM sections WHERE id = OLD.section_id;
        END IF;
        IF TG_OP <> 'DELETE' THEN
          SELECT tenant_id INTO new_tenant_id FROM sections WHERE id = NEW.section_id;
        END IF;

      ELSIF TG_TABLE_NAME = 'items' THEN
        IF TG_OP <> 'INSERT' THEN
          SELECT s.tenant_id INTO old_tenant_id
          FROM categories c JOIN sections s ON s.id = c.section_id
          WHERE c.id = OLD.category_id;
        END IF;
        IF TG_OP <> 'DELETE' THEN
          SELECT s.tenant_id INTO new_tenant_id
          FROM categories c JOIN sections s ON s.id = c.section_id
          WHERE c.id = NEW.category_id;
        END IF;

      ELSIF TG_TABLE_NAME = 'item_category_attachments' THEN
        IF TG_OP <> 'INSERT' THEN
          UPDATE tenants
          SET has_unpublished_changes = true, updated_at = now()
          WHERE id IN (
            SELECT s.tenant_id
            FROM items i
            JOIN categories c ON c.id = i.category_id
            JOIN sections s ON s.id = c.section_id
            WHERE i.id = OLD.item_id
            UNION
            SELECT s.tenant_id
            FROM categories c JOIN sections s ON s.id = c.section_id
            WHERE c.id = OLD.category_id
          );
        END IF;
        IF TG_OP <> 'DELETE' THEN
          UPDATE tenants
          SET has_unpublished_changes = true, updated_at = now()
          WHERE id IN (
            SELECT s.tenant_id
            FROM items i
            JOIN categories c ON c.id = i.category_id
            JOIN sections s ON s.id = c.section_id
            WHERE i.id = NEW.item_id
            UNION
            SELECT s.tenant_id
            FROM categories c JOIN sections s ON s.id = c.section_id
            WHERE c.id = NEW.category_id
          );
        END IF;
        IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;

      ELSIF TG_TABLE_NAME = 'media' THEN
        IF TG_OP <> 'INSERT' THEN
          old_tenant_id := OLD.tenant_id;
          IF old_tenant_id IS NULL THEN
            SELECT s.tenant_id INTO old_tenant_id
            FROM items i
            JOIN categories c ON c.id = i.category_id
            JOIN sections s ON s.id = c.section_id
            WHERE i.id = OLD.item_id;
          END IF;
        END IF;
        IF TG_OP <> 'DELETE' THEN
          new_tenant_id := NEW.tenant_id;
          IF new_tenant_id IS NULL THEN
            SELECT s.tenant_id INTO new_tenant_id
            FROM items i
            JOIN categories c ON c.id = i.category_id
            JOIN sections s ON s.id = c.section_id
            WHERE i.id = NEW.item_id;
          END IF;
        END IF;

      ELSIF TG_TABLE_NAME = 'translations' THEN
        IF TG_OP <> 'INSERT' THEN
          IF OLD.model IN ('tenant', 'ui') THEN
            old_tenant_id := OLD.record_id;
          ELSIF OLD.model = 'section' THEN
            SELECT tenant_id INTO old_tenant_id FROM sections WHERE id = OLD.record_id;
          ELSIF OLD.model = 'category' THEN
            SELECT s.tenant_id INTO old_tenant_id
            FROM categories c JOIN sections s ON s.id = c.section_id
            WHERE c.id = OLD.record_id;
          ELSIF OLD.model = 'item' THEN
            SELECT s.tenant_id INTO old_tenant_id
            FROM items i
            JOIN categories c ON c.id = i.category_id
            JOIN sections s ON s.id = c.section_id
            WHERE i.id = OLD.record_id;
          END IF;
        END IF;
        IF TG_OP <> 'DELETE' THEN
          IF NEW.model IN ('tenant', 'ui') THEN
            new_tenant_id := NEW.record_id;
          ELSIF NEW.model = 'section' THEN
            SELECT tenant_id INTO new_tenant_id FROM sections WHERE id = NEW.record_id;
          ELSIF NEW.model = 'category' THEN
            SELECT s.tenant_id INTO new_tenant_id
            FROM categories c JOIN sections s ON s.id = c.section_id
            WHERE c.id = NEW.record_id;
          ELSIF NEW.model = 'item' THEN
            SELECT s.tenant_id INTO new_tenant_id
          FROM items i
          JOIN categories c ON c.id = i.category_id
          JOIN sections s ON s.id = c.section_id
            WHERE i.id = NEW.record_id;
          END IF;
        END IF;

      ELSIF TG_TABLE_NAME = 'plural_forms' THEN
        IF TG_OP <> 'INSERT' THEN old_tenant_id := OLD.tenant_id; END IF;
        IF TG_OP <> 'DELETE' THEN new_tenant_id := NEW.tenant_id; END IF;
        IF (TG_OP <> 'INSERT' AND old_tenant_id IS NULL)
          OR (TG_OP <> 'DELETE' AND new_tenant_id IS NULL) THEN
          UPDATE tenants
          SET has_unpublished_changes = true, updated_at = now();
          IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
        END IF;
      END IF;

      UPDATE tenants
      SET has_unpublished_changes = true, updated_at = now()
      WHERE id = old_tenant_id OR id = new_tenant_id;
      IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END;
    $function$;

    DROP TRIGGER IF EXISTS smart360_guest_dirty ON sections;
    CREATE TRIGGER smart360_guest_dirty
      AFTER INSERT OR UPDATE OR DELETE ON sections
      FOR EACH ROW EXECUTE FUNCTION smart360_mark_guest_content_dirty();

    DROP TRIGGER IF EXISTS smart360_guest_dirty ON categories;
    CREATE TRIGGER smart360_guest_dirty
      AFTER INSERT OR UPDATE OR DELETE ON categories
      FOR EACH ROW EXECUTE FUNCTION smart360_mark_guest_content_dirty();

    DROP TRIGGER IF EXISTS smart360_guest_dirty ON items;
    CREATE TRIGGER smart360_guest_dirty
      AFTER INSERT OR UPDATE OR DELETE ON items
      FOR EACH ROW EXECUTE FUNCTION smart360_mark_guest_content_dirty();

    DROP TRIGGER IF EXISTS smart360_guest_dirty ON item_category_attachments;
    CREATE TRIGGER smart360_guest_dirty
      AFTER INSERT OR UPDATE OR DELETE ON item_category_attachments
      FOR EACH ROW EXECUTE FUNCTION smart360_mark_guest_content_dirty();

    DROP TRIGGER IF EXISTS smart360_guest_dirty ON media;
    CREATE TRIGGER smart360_guest_dirty
      AFTER INSERT OR UPDATE OR DELETE ON media
      FOR EACH ROW EXECUTE FUNCTION smart360_mark_guest_content_dirty();

    DROP TRIGGER IF EXISTS smart360_guest_dirty ON translations;
    CREATE TRIGGER smart360_guest_dirty
      AFTER INSERT OR UPDATE OR DELETE ON translations
      FOR EACH ROW EXECUTE FUNCTION smart360_mark_guest_content_dirty();

    DROP TRIGGER IF EXISTS smart360_guest_dirty ON plural_forms;
    CREATE TRIGGER smart360_guest_dirty
      AFTER INSERT OR UPDATE OR DELETE ON plural_forms
      FOR EACH ROW EXECUTE FUNCTION smart360_mark_guest_content_dirty();
    `);
  });
}