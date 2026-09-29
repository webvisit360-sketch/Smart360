# Varnostna faza 1 — poročilo lastniku in ročni SQL-postopek

## POVZETEK ZA LASTNIKA

Izvedeno samo v DEVELOPMENT. Produkcija ni bila spremenjena ali objavljena.

| Pot / polje | Prej | Zdaj za gostitelja |
| --- | --- | --- |
| PATCH `/admin/tenants/:id`: `isTemplate`, `mediaQuotaBytes` | Sprejeto | 403 pred zapisom |
| Ista pot: `renewsAt` | Možen zapis pred napako dnevnika podaljšanj | 403 pred zapisom |
| Ista pot: `coordinateOverride`, `rating`, `reviewsCount` | Sprejeto | 403 pred zapisom |
| Ista pot: `mapUrl` | Običajno urejanje | Ostane dovoljeno; koordinate iz povezave |
| DELETE `/admin/sections/:id` | Trajni izbris dostopen gostitelju | 403; trajni izbris ostane operaterju |
| POST `/admin/sections/:id/trash` in `/restore` | Ni bilo | Lastna nastanitev: mehki izbris in obnova |
| Objava nastanitve z operaterskim osnutkom | Ni bilo popolne oznake avtorstva | 403 z zahtevanim sporočilom |

Operater je na zaščitenih poteh še vedno dovoljen. Obstoječe omejitve `slug`, `customDomain`, podaljšanj in operaterskih orodij ostanejo; tuje nastanitve ostanejo skrite. Zavrnitve novih pravic se beležijo brez vsebine zavrnjenih vrednosti.

Zahtevano sporočilo: **Vodnik vsebuje spremembe upravljavca, ki še niso potrjene — objavo opravi Smart360.**

Mehki izbris ohrani potomce in njihove neodvisne oznake izbrisa. Že objavljeni posnetek se do naslednje objave ne spremeni. Gostiteljski dostop do razdelkov je v zavihku »Sekcije in vnosi«; Kreator ostaja samo operaterju.

Preverjeno: ciljni testi API/razvojne baze za zavrnitve, dovoljene operaterske zahtevke, objavo pod zaklepom, sočasno urejanje, gostiteljski obrazec, ponovitev inicializacije in obnovo razdelka. Brskalnik je potrdil takojšnje prikazovanje koša, obnovo, neodvisno izbrisanega otroka in točno 403 opozorilo pri objavi. Začasni gostiteljski računi in podatki so odstranjeni; operaterski račun ali seja nista bila ustvarjena. Zadnji popravek odziva navigacije na spremembo širine je preverjen s TypeScriptom, ne s ponovitvijo brskalniškega testa. Gostiteljsko samodejno shranjevanje in shranjevanje pred objavo zdaj izločita operaterska polja; običajni mapUrl ostane. Ta zadnji popravek ima ciljne teste telesa zahtevka in klicnih mest, ne novega brskalniškega preizkusa.

## Odločitev in meja izvedbe

Ta dokument vsebuje preverjanja in pogojni operaterski SQL za prihodnjo produkcijsko objavo. **V tem posegu je bila spremenjena samo razvojna baza; produkcijski SQL ni bil izveden in objave ni bilo.** Produkcijske SELECT-e in morebitni popravek izvede pooblaščen operater ob posebej odobreni objavi. Pred izvedbo preverite ciljno povezavo/bazo. Vsak blok SQL izvedite posebej z ustavitvijo ob napaki (`psql -X -v ON_ERROR_STOP=1`); če preverjanje ali varovalo odpove, se ustavite, ne popravljajte na pamet. Objavo aplikacije v Replit ločite od objave vsebine posamezne nastanitve.

Faza ščiti ločnico med osnutkom gostitelja in osnutkom upravljavca: gostitelj ne sme objaviti še nepotrjenih sprememb upravljavca. `operator_draft_pending` je lepljiv do uspešne objave upravljavca; gostiteljeve poznejše spremembe ga ne izbrišejo. Stolpca sta že deklarirana v shemi Drizzle (`sections.deleted_at` kot nullable `timestamptz`, `tenants.operator_draft_pending` kot `boolean NOT NULL DEFAULT false`), zato ta ritual uskladi **dejansko bazo**, ne predlaga novega modela.

## 1. Predhodno preverjanje stolpcev (samo branje)

Pri odsotnem stolpcu bo vrstica manjkala. `column_default` za `deleted_at` naj bo NULL; za `operator_draft_pending` naj bo `false` (lahko prikazan tudi s pripisom tipa).

```sql
SELECT c.table_schema, c.table_name, c.column_name, c.data_type, c.udt_name,
       c.is_nullable, c.column_default
FROM information_schema.columns AS c
WHERE c.table_schema = 'public'
  AND (c.table_name, c.column_name) IN
      (('sections', 'deleted_at'), ('tenants', 'operator_draft_pending'))
ORDER BY c.table_name, c.column_name;

SELECT to_regclass('public.sections') AS sections_table,
       to_regclass('public.tenants') AS tenants_table;
```

## 2. Pogojna uskladitev stolpcev (samo po izrecni odobritvi)

En sam `DO` doda samo manjkajoča stolpca; ob že obstoječem, a nezdružljivem tipu, NULL-omejitvi ali privzeti vrednosti vrže napako in transakcija ne obdrži nobene spremembe. Ne pretvarja podatkov, ne prepisuje privzetih vrednosti in ne dodaja drugih polj.

```sql
DO $columns$
DECLARE
  s record;
  o record;
BEGIN
  IF to_regclass('public.sections') IS NULL OR to_regclass('public.tenants') IS NULL THEN
    RAISE EXCEPTION 'Manjka public.sections ali public.tenants';
  END IF;

  SELECT a.atttypid, a.atttypmod, a.attnotnull, a.attgenerated, a.attidentity,
         pg_get_expr(d.adbin, d.adrelid) AS default_sql
    INTO s
  FROM pg_attribute a
  LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE a.attrelid = 'public.sections'::regclass
    AND a.attname = 'deleted_at' AND NOT a.attisdropped;
  IF NOT FOUND THEN
    ALTER TABLE public.sections ADD COLUMN deleted_at timestamptz NULL;
  ELSIF s.atttypid <> 'timestamptz'::regtype OR s.atttypmod <> -1
      OR s.attnotnull OR s.default_sql IS NOT NULL
      OR s.attgenerated <> '' OR s.attidentity <> '' THEN
    RAISE EXCEPTION 'Nezdružljiv public.sections.deleted_at: pričakovano nullable timestamptz brez defaulta';
  END IF;

  SELECT a.atttypid, a.attnotnull, a.attgenerated, a.attidentity,
         pg_get_expr(d.adbin, d.adrelid) AS default_sql
    INTO o
  FROM pg_attribute a
  LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE a.attrelid = 'public.tenants'::regclass
    AND a.attname = 'operator_draft_pending' AND NOT a.attisdropped;
  IF NOT FOUND THEN
    ALTER TABLE public.tenants
      ADD COLUMN operator_draft_pending boolean NOT NULL DEFAULT false;
  ELSIF o.atttypid <> 'boolean'::regtype OR NOT o.attnotnull
      OR o.attgenerated <> '' OR o.attidentity <> ''
      OR COALESCE(lower(regexp_replace(o.default_sql, '[[:space:]]+', '', 'g')), '')
           NOT IN ('false', 'false::boolean', '(false)') THEN
    RAISE EXCEPTION 'Nezdružljiv public.tenants.operator_draft_pending: pričakovano boolean NOT NULL DEFAULT false';
  END IF;

  SELECT a.atttypid, a.atttypmod, a.attnotnull, pg_get_expr(d.adbin, d.adrelid) AS default_sql
    INTO s
  FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE a.attrelid = 'public.sections'::regclass
    AND a.attname = 'deleted_at' AND NOT a.attisdropped;
  SELECT a.atttypid, a.attnotnull, pg_get_expr(d.adbin, d.adrelid) AS default_sql
    INTO o
  FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE a.attrelid = 'public.tenants'::regclass
    AND a.attname = 'operator_draft_pending' AND NOT a.attisdropped;
  IF s.atttypid IS DISTINCT FROM 'timestamptz'::regtype
     OR s.atttypmod IS DISTINCT FROM -1 OR s.attnotnull IS DISTINCT FROM false
     OR s.default_sql IS NOT NULL
     OR o.atttypid IS DISTINCT FROM 'boolean'::regtype
     OR o.attnotnull IS DISTINCT FROM true
     OR COALESCE(lower(regexp_replace(o.default_sql, '[[:space:]]+', '', 'g')), '')
        NOT IN ('false', 'false::boolean', '(false)') THEN
    RAISE EXCEPTION 'Končno preverjanje stolpcev ni uspelo';
  END IF;
  RAISE NOTICE 'Stolpca sta skladna';
END
$columns$;
```

Ponovite SELECT iz razdelka 1. Ne uporabljajte splošnega `ALTER ... TYPE` ali `UPDATE` za obstoječe podatke.

## 3. Preverjanje funkcije in sedmih sprožilcev (samo branje)

Funkcija `public.smart360_mark_guest_content_dirty()` **ni upravljana s shemo Drizzle**: vir njene definicije je eksplicitni SQL v aplikaciji. Prenos njene nove definicije prek Replitove sinhronizacije ob objavi v tem posegu ni bil preverjen in ga ne štejte za zagotovljenega. Inicializacija strežnika `ensureGuestDirtyTriggers()` jo z `CREATE OR REPLACE FUNCTION` izrecno prepiše in ponovno ustvari sedem sprožilcev v eni transakciji pred sprejemanjem zahtevkov. Spodnji SELECT je zato obvezno produkcijsko preverjanje; ob stari definiciji uporabite odobreni pogojni blok, ob pravilni novi definiciji pa je blok brez učinka. Najprej preverite stanje brez sprememb:

```sql
WITH f AS (
  SELECT regexp_replace(pg_get_functiondef(
           to_regprocedure('public.smart360_mark_guest_content_dirty()')),
           '[[:space:]]+', ' ', 'g') AS body
), patterns AS (
  SELECT 'SET has_unpublished_changes = true, updated_at = now()'::text AS old_clause,
         'SET has_unpublished_changes = true, operator_draft_pending = operator_draft_pending OR NOT COALESCE( (current_user = ''smart360_host'' AND current_setting(''app.role'', true) = ''host'') OR (current_user <> ''smart360_host'' AND current_setting(''smart360.draft_actor'', true) = ''host'' AND current_setting(''smart360.draft_tenant'', true) = tenants.id::text), false), updated_at = now()'::text AS new_clause,
         'operator_draft_pending = operator_draft_pending OR'::text AS marker
)
SELECT to_regprocedure('public.smart360_mark_guest_content_dirty()') AS function_signature,
       (length(body) - length(replace(body, old_clause, ''))) / length(old_clause) AS old_count,
       (length(body) - length(replace(body, new_clause, ''))) / length(new_clause) AS full_new_count,
       (length(body) - length(replace(body, marker, ''))) / length(marker) AS broad_marker_count
FROM f CROSS JOIN patterns;

SELECT t.tgrelid::regclass AS on_table, t.tgname,
       t.tgfoid::regprocedure AS calls, t.tgenabled,
       pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_trigger t
WHERE NOT t.tgisinternal AND t.tgname = 'smart360_guest_dirty'
  AND t.tgrelid IN (
    'public.sections'::regclass, 'public.categories'::regclass,
    'public.items'::regclass, 'public.item_category_attachments'::regclass,
    'public.media'::regclass, 'public.translations'::regclass,
    'public.plural_forms'::regclass
  )
ORDER BY on_table::text;
```

Pričakovano je **7 vrstic**, vsaka kliče `public.smart360_mark_guest_content_dirty()` in je omogočena (`tgenabled = 'O'` ali namerno 'A'). Prvi SELECT naj pokaže bodisi `(old_count, full_new_count, broad_marker_count) = (4,0,0)` pred popravkom bodisi `(0,4,4)` po njem. Drugačno stanje zahteva preiskavo; spodnji blok ga zavrne.

## 4. Odobren, atomaren in idempotenten popravek funkcije

Zaženite kot lastnik funkcije / pooblaščen DB skrbnik šele po preverjanju stolpcev. Izvor novega izraza je `artifacts/api-server/src/lib/guestDirtyTriggers.ts`: pristni `smart360_host` z `app.role = host` **ali** privilegirana povezava s `smart360.draft_actor = host` in `smart360.draft_tenant = tenants.id::text` ne nastavi operatorjevega bita; vse drugo ga nastavi. Štirje UPDATE-i so: stara in nova stran priponke, globalni fallback množinskih oblik ter skupni zaključni UPDATE.

```sql
DO $patch$
DECLARE
  fn regprocedure := to_regprocedure('public.smart360_mark_guest_content_dirty()');
  definition text;
  normalized text;
  old_clause text := 'SET has_unpublished_changes = true, updated_at = now()';
  new_clause text := $clause$SET has_unpublished_changes = true,
                operator_draft_pending = operator_draft_pending OR
                  NOT COALESCE(
                    (current_user = 'smart360_host'
                      AND current_setting('app.role', true) = 'host')
                    OR (current_user <> 'smart360_host'
                      AND current_setting('smart360.draft_actor', true) = 'host'
                      AND current_setting('smart360.draft_tenant', true) = tenants.id::text),
                    false),
                updated_at = now()$clause$;
  normalized_new text;
  marker text := 'operator_draft_pending = operator_draft_pending OR';
  old_count integer;
  new_count integer;
  marker_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('smart360:guest-dirty-triggers', 0));
  IF fn IS NULL THEN
    RAISE EXCEPTION 'Funkcija public.smart360_mark_guest_content_dirty() manjka';
  END IF;
  SELECT pg_get_functiondef(fn) INTO definition;
  normalized_new := regexp_replace(new_clause, '[[:space:]]+', ' ', 'g');
  normalized := regexp_replace(definition, '[[:space:]]+', ' ', 'g');
  old_count := (length(normalized) - length(replace(normalized, old_clause, ''))) / length(old_clause);
  new_count := (length(normalized) - length(replace(normalized, normalized_new, ''))) / length(normalized_new);
  marker_count := (length(normalized) - length(replace(normalized, marker, ''))) / length(marker);

  IF old_count = 0 AND new_count = 4 AND marker_count = 4 THEN
    RAISE NOTICE 'Že popravljeno: brez sprememb (0 starih, 4 potrjene nove klavzule)';
    RETURN;
  END IF;
  IF old_count <> 4 OR new_count <> 0 OR marker_count <> 0 THEN
    RAISE EXCEPTION 'Nepričakovana definicija funkcije: old %, full_new %, marker %; brez sprememb',
      old_count, new_count, marker_count;
  END IF;

  definition := regexp_replace(
    definition,
    'SET[[:space:]]+has_unpublished_changes[[:space:]]*=[[:space:]]*true,[[:space:]]*updated_at[[:space:]]*=[[:space:]]*now\(\)',
    new_clause, 'g');
  normalized := regexp_replace(definition, '[[:space:]]+', ' ', 'g');
  old_count := (length(normalized) - length(replace(normalized, old_clause, ''))) / length(old_clause);
  new_count := (length(normalized) - length(replace(normalized, normalized_new, ''))) / length(normalized_new);
  marker_count := (length(normalized) - length(replace(normalized, marker, ''))) / length(marker);
  IF old_count <> 0 OR new_count <> 4 OR marker_count <> 4 THEN
    RAISE EXCEPTION 'Pripravljena definicija ni popolna: old %, full_new %, marker %; brez EXECUTE',
      old_count, new_count, marker_count;
  END IF;
  EXECUTE definition;
  RAISE NOTICE 'Funkcija popravljena atomarno: 4/4 klavzule';
END
$patch$;
```

Ponovite oba SELECT-a iz razdelka 3, nato **isti DO iz razdelka 4 še enkrat**: drugič mora vrniti samo obvestilo »Že popravljeno« brez spremembe funkcije. Ker je v enem `DO` in pred `EXECUTE` preveri celotno predlagano definicijo, ne more delno zamenjati štirih klavzul. Sam `EXECUTE` je transakcijski. Če začetno stanje vsebuje eno staro/eno delno novo klavzulo, blok zavrne poseg.

## 5. Izoliran negativni preizkus brez spreminjanja sheme

Ta preizkus v lokalni spremenljivki ustvari **delno** različico iz že popravljene funkcije, ne izvaja `CREATE FUNCTION` in ničesar ne spreminja. Po uspešnem popravku ga lahko izvedete v dev: notranja izjema je pričakovana, zunanje obvestilo potrdi zavrnitev. Če ne vrne obvestila, preizkus ni uspel.

```sql
DO $test$
DECLARE
  body text;
  good text := 'operator_draft_pending = operator_draft_pending OR NOT COALESCE( (current_user = ''smart360_host'' AND current_setting(''app.role'', true) = ''host'') OR (current_user <> ''smart360_host'' AND current_setting(''smart360.draft_actor'', true) = ''host'' AND current_setting(''smart360.draft_tenant'', true) = tenants.id::text), false),';
  old_clause text := 'SET has_unpublished_changes = true, updated_at = now()';
  full_new text := 'SET has_unpublished_changes = true, ' || good || ' updated_at = now()';
  old_count integer;
  new_count integer;
  marker_count integer;
BEGIN
  body := regexp_replace(pg_get_functiondef(
    to_regprocedure('public.smart360_mark_guest_content_dirty()')),
    '[[:space:]]+', ' ', 'g');
  IF body IS NULL OR
     (length(body) - length(replace(body, full_new, ''))) / length(full_new) <> 4 THEN
    RAISE EXCEPTION 'Preizkus zahteva že popolnoma popravljeno funkcijo';
  END IF;
  -- Simulacija delno povrnjenega starega SET, samo v besedilu.
  body := replace(body, full_new, old_clause);
  -- replace() zamenja vse; vrnemo samo eno novo, tri pustimo stare.
  body := regexp_replace(body, 'SET has_unpublished_changes = true, updated_at = now()',
                         full_new);
  -- regexp_replace brez zastavice g spremeni samo prvo; ostanejo 1 nova, 3 stare.
  old_count := (length(body) - length(replace(body, old_clause, ''))) / length(old_clause);
  new_count := (length(body) - length(replace(body, full_new, ''))) / length(full_new);
  marker_count := (length(body) - length(replace(body,
    'operator_draft_pending = operator_draft_pending OR', ''))) /
    length('operator_draft_pending = operator_draft_pending OR');
  BEGIN
    IF old_count <> 4 OR new_count <> 0 OR marker_count <> 0 THEN
      RAISE EXCEPTION 'Nepričakovana definicija funkcije: old %, full_new %, marker %; brez sprememb',
        old_count, new_count, marker_count;
    END IF;
    RAISE EXCEPTION 'Varnostno varovalo ni zavrnilo delnega stanja';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Nepričakovana definicija funkcije:%' THEN
      RAISE;
    END IF;
    RAISE NOTICE 'Delno stanje zavrnjeno brez posega: old %, full_new %, marker %',
      old_count, new_count, marker_count;
  END;
END
$test$;
```

## 6. Enkratna označitev starejših osnutkov

Ob zagonu `initializeOperatorDraftPending()` v **isti transakciji** najprej vzame `pg_advisory_xact_lock` za `smart360:operator-draft-backfill:v1`, nato vstavi trajni, edinstveni `changelog.operation_key = 'bootstrap:operator-draft-pending:v1'` s **NULL `tenant_id`**, šele ob na novo vstavljenem markerju označi vse `tenants` z `has_unpublished_changes = true AND operator_draft_pending = false`. Konflikt markerja pomeni nič ponovnega označevanja (pomembno po poznejši objavi upravljavca in novih gostiteljevih osnutkih). Markerja **ne brišite** in ne ponavljajte UPDATE ročno. Brez stolpca inicializacija prekine zagon, marker ni zapisan. Ta dokument ne zaganja inicializacije in ne ustvarja markerja.

```sql
SELECT operation_key, tenant_id, actor_type, created_at
FROM public.changelog
WHERE operation_key = 'bootstrap:operator-draft-pending:v1';
SELECT count(*) FILTER (WHERE has_unpublished_changes) AS odprti_osnutki,
       count(*) FILTER (WHERE operator_draft_pending) AS osnutki_upravljavca
FROM public.tenants;
```

Izid zapišite v zapisnik odobritve (okolje, čas, izvedel, rezultati SELECT-ov in obvestilo drugega zagona). Preizkus v trenutnem dev stanju je bil izveden v `BEGIN READ ONLY` in zaključen z `ROLLBACK`: oba zaporedna zagona popravka sta vrnila obvestilo brez sprememb (0 starih, 4 novih), izolirana delna različica pa je bila zavrnjena (3 stare, 1 nova). V okviru tega posega v PROD ni bil izveden noben blok tega postopka.