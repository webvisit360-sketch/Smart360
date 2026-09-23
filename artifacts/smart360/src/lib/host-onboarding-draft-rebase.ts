import type { HostOnboardingData } from "@/hooks/use-host-onboarding";

export type DraftConflict = {
  path: string;
  label: string;
  base: unknown;
  local: unknown;
  remote: unknown;
};

export type DraftRebaseResult = {
  data: HostOnboardingData;
  conflicts: DraftConflict[];
};

const labels: Record<string, string> = {
  accommodationName: "Ime nastanitve",
  address: "Naslov",
  guestPhone: "Telefon za goste",
  guestEmail: "E-pošta za goste",
  website: "Spletna stran",
  checkInFrom: "Prihod od",
  checkOutUntil: "Odhod do",
  wifiName: "Ime omrežja Wi‑Fi",
  wifiPassword: "Geslo Wi‑Fi",
  contacts: "Kontakt",
  offers: "Ponudba",
  recommendations: "Priporočilo",
  customCategories: "Kategorija po meri",
  events: "Dogodek",
  canonicalItems: "Vsebina",
  media: "Medij",
  name: "ime",
  phone: "telefon",
  title: "naslov",
  body: "besedilo",
  price: "cena",
  date: "datum",
  time: "čas",
};

const equal = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const identified = (value: unknown): value is Array<Record<string, unknown> & { id: string }> =>
  Array.isArray(value) && value.every((row) => object(row) && typeof row.id === "string");

function fieldLabel(path: string): string {
  const parts = path.split(".");
  const leaf = parts.at(-1)?.replace(/\[.*\]/, "") || path;
  const root = parts[0]?.replace(/\[.*\]/, "") || path;
  const rowId = path.match(/\[([^\]]+)\]/)?.[1];
  const rootLabel = labels[root] || root;
  const leafLabel = labels[leaf] || leaf;
  return rowId
    ? `${rootLabel} (${rowId}) – ${leafLabel}`
    : labels[path] || leafLabel;
}

function mergeValue(
  base: unknown,
  local: unknown,
  remote: unknown,
  path: string,
  conflicts: DraftConflict[],
): unknown {
  if (equal(local, remote)) return local;
  if (equal(local, base)) return remote;
  if (equal(remote, base)) return local;

  if (object(local) && object(remote) && (object(base) || base === undefined)) {
    const baseObject = object(base) ? base : {};
    const result: Record<string, unknown> = {};
    const keys = new Set([...Object.keys(baseObject), ...Object.keys(local), ...Object.keys(remote)]);
    for (const key of keys) {
      result[key] = mergeValue(
        baseObject[key],
        local[key],
        remote[key],
        path ? `${path}.${key}` : key,
        conflicts,
      );
    }
    return result;
  }

  if (identified(local) && identified(remote) && (identified(base) || base === undefined)) {
    const baseRows = new Map((identified(base) ? base : []).map((row) => [row.id, row]));
    const localRows = new Map(local.map((row) => [row.id, row]));
    const remoteRows = new Map(remote.map((row) => [row.id, row]));
    const order = [...local.map((row) => row.id), ...remote.map((row) => row.id)]
      .filter((id, index, all) => all.indexOf(id) === index);
    const result: unknown[] = [];

    for (const id of order) {
      const baseRow = baseRows.get(id);
      const localRow = localRows.get(id);
      const remoteRow = remoteRows.get(id);
      const rowPath = `${path}[${id}]`;
      if (!localRow || !remoteRow) {
        const present = localRow || remoteRow;
        const removedByLocal = !localRow;
        const other = removedByLocal ? remoteRow : localRow;
        if (!baseRow || equal(other, baseRow)) {
          if (!baseRow && present) result.push(present);
          continue;
        }
        conflicts.push({
          path: rowPath,
          label: `${labels[path] || path} » ${String(
            localRow?.name || localRow?.title || remoteRow?.name || remoteRow?.title || id
          )} – odstranitev`,
          base: baseRow,
          local: localRow,
          remote: remoteRow,
        });
        if (localRow) result.push(localRow);
        continue;
      }
      const conflictStart = conflicts.length;
      result.push(mergeValue(baseRow, localRow, remoteRow, rowPath, conflicts));
      const rowName = String(
        localRow.name || localRow.title || remoteRow.name || remoteRow.title || id,
      );
      for (const conflict of conflicts.slice(conflictStart)) {
        const leaf = conflict.path.split(".").at(-1)?.replace(/\[.*\]/, "") || conflict.path;
        conflict.label = `${labels[path] || path} » ${rowName} – ${labels[leaf] || leaf}`;
      }
    }
    return result;
  }

  conflicts.push({
    path,
    label: fieldLabel(path),
    base,
    local,
    remote,
  });
  return local;
}

/** Three-way merge. Conflicts retain the local value until the host chooses. */
export function rebaseHostOnboardingDraft(
  base: HostOnboardingData,
  local: HostOnboardingData,
  remote: HostOnboardingData,
): DraftRebaseResult {
  const conflicts: DraftConflict[] = [];
  return {
    data: mergeValue(base, local, remote, "", conflicts) as HostOnboardingData,
    conflicts,
  };
}

function setPath(root: unknown, path: string, value: unknown): unknown {
  const segments = path.split(".").filter(Boolean);
  const clone = structuredClone(root);
  let cursor = clone as Record<string, unknown>;
  for (let index = 0; index < segments.length; index += 1) {
    const match = segments[index]!.match(/^([^\[]+)(?:\[([^\]]+)\])?$/);
    if (!match) return clone;
    const [, key, id] = match;
    const last = index === segments.length - 1;
    if (id) {
      const rows = Array.isArray(cursor[key!]) ? cursor[key!] as Array<Record<string, unknown>> : [];
      const rowIndex = rows.findIndex((row) => row.id === id);
      if (last) {
        if (value === undefined) {
          if (rowIndex >= 0) rows.splice(rowIndex, 1);
        } else if (rowIndex >= 0) rows[rowIndex] = value as Record<string, unknown>;
        else rows.push(value as Record<string, unknown>);
        cursor[key!] = rows;
        return clone;
      }
      if (rowIndex < 0) return clone;
      cursor = rows[rowIndex]!;
    } else if (last) {
      if (value === undefined) delete cursor[key!];
      else cursor[key!] = value;
    } else {
      cursor[key!] = object(cursor[key!]) ? cursor[key!] : {};
      cursor = cursor[key!] as Record<string, unknown>;
    }
  }
  return clone;
}

export function resolveDraftConflict(
  data: HostOnboardingData,
  conflict: DraftConflict,
  choice: "local" | "remote",
): HostOnboardingData {
  // "Local" means the value currently in the input, not the older value that
  // happened to be present when the conflict was first detected. The host may
  // continue typing while the choice is visible.
  if (choice === "local") return data;
  return setPath(
    data,
    conflict.path,
    conflict.remote,
  ) as HostOnboardingData;
}

export type HostDraftRecovery = {
  tenantId: string;
  round: number;
  base: HostOnboardingData;
  /** Full local projection: sparse canonicalItems patches cannot restore arrays safely. */
  local?: HostOnboardingData;
  /** Backward-compatible legacy records only; new writes always use `local`. */
  patch?: Partial<HostOnboardingData>;
  transient?: Record<string, unknown>;
  firstFailureAt?: string;
};

export function recoveryStorageKey(tenantId: string, round: number): string {
  return `smart360:host-onboarding:${tenantId}:round:${round}`;
}

/**
 * React runs all effects from the pre-hydration render once. That stale frame
 * must be consumed without replacing the synchronously restored draft ref.
 */
export function autosaveRenderFrame(
  latest: HostOnboardingData,
  rendered: HostOnboardingData,
  skipNext: boolean,
): {
  latest: HostOnboardingData;
  skipNext: boolean;
  shouldProcess: boolean;
} {
  if (skipNext) {
    return { latest, skipNext: false, shouldProcess: false };
  }
  return { latest: rendered, skipNext: false, shouldProcess: true };
}

/**
 * Reconcile a successful write response with edits made while it was in
 * flight. The exact full local projection sent is the three-way base, so rows
 * the server intentionally retained are adopted when local omission was not
 * accompanied by an explicit delete marker.
 */
export function acknowledgeHostDraftWrite(
  sentLocal: HostOnboardingData,
  latestLocal: HostOnboardingData,
  canonical: HostOnboardingData,
): HostOnboardingData {
  const acknowledged = rebaseHostOnboardingDraft(
    sentLocal,
    latestLocal,
    canonical,
  ).data;
  const contactDeletes = new Set(latestLocal.deleteContactIds || []);
  const offerDeletes = new Set(latestLocal.deleteOfferIds || []);
  const eventDeletes = new Set(latestLocal.deleteEventIds || []);
  const mediaDeletes = new Set(latestLocal.deleteMediaIds || []);
  return {
    ...acknowledged,
    contacts: acknowledged.contacts?.filter((row) => !contactDeletes.has(row.id)),
    offers: acknowledged.offers?.filter((row) => !offerDeletes.has(row.id)),
    events: acknowledged.events?.filter((row) => !eventDeletes.has(row.id)),
    media: acknowledged.media?.filter((row) => !mediaDeletes.has(row.id)),
  };
}

export function restoreHostDraftRecovery(
  recovery: HostDraftRecovery,
  current: HostOnboardingData,
): DraftRebaseResult {
  let local = recovery.local;
  if (!local) {
    const patch = recovery.patch || {};
    local = { ...recovery.base, ...patch };
    if (patch.canonicalItems) {
      const changedRows = new Map(patch.canonicalItems.map((row) => [row.id, row]));
      const baseIds = new Set((recovery.base.canonicalItems || []).map((row) => row.id));
      local.canonicalItems = [
        ...(recovery.base.canonicalItems || []).map((row) => changedRows.get(row.id) || row),
        ...patch.canonicalItems.filter((row) => !baseIds.has(row.id)),
      ];
    }
  }
  return rebaseHostOnboardingDraft(recovery.base, local, current);
}

/** Clone the exact app draft for tenant/round-scoped session recovery. */
export function safeRecoveryData(data: HostOnboardingData): HostOnboardingData {
  return structuredClone(data);
}

export function recordUnsavedFailure(
  current: string | null,
  occurredAt: string,
): string {
  return current || occurredAt;
}

export function acknowledgeUnsavedFailure(
  current: string | null,
  fullySaved: boolean,
): string | null {
  return fullySaved ? null : current;
}

export function hostDraftRetryDelay(attempt: number): number {
  return Math.min(30_000, 2_000 * (2 ** Math.max(0, attempt)));
}

/**
 * Submit is a small CAS loop: every stale submit gets one current-draft
 * rebase, then a fresh flush and another submit POST. `rebase` throws when it
 * discovers a genuine named field conflict.
 */