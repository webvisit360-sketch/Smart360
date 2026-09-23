import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Loader2, Trash2, CheckCircle2, UploadCloud, X, LogOut, MapPin, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetHostOnboarding,
  usePatchHostOnboarding,
  useSaveHostOnboarding,
  useSubmitHostOnboarding,
  HostOnboardingData,
  useUploadPhotoUrl,
  useCompletePhoto,
  useDeletePhoto,
  canHydrateCanonicalDraft,
  changedHostOnboardingFields,
  preserveCanonicalMediaForWrite,
  omitLegacyRichAliasForCanonicalItems,
  persistedHostOnboardingSubmitPayload,
  updateCanonicalItemText,
} from "@/hooks/use-host-onboarding";
import { useHostSession } from "@/hooks/use-host-session";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { EmptyCategoryRow } from "@/components/admin/empty-category-row";
import {
  ItemMediaEditor,
  type ItemMediaEditorHandle,
} from "@/components/admin/item-media-editor";
import { entryNamePlaceholder } from "@/lib/entry-name-placeholder";

const generateId = () => crypto.randomUUID();
type SaveState = "saved" | "dirty" | "saving" | "error" | "conflict";
type TransientRecommendation = { id: string; name: string };
type TransientOffer = { id: string; name: string; price: string };
type CanonicalItem = NonNullable<HostOnboardingData["canonicalItems"]>[number];
type NormalizedHostOnboardingData = HostOnboardingData & Required<Pick<
  HostOnboardingData,
  "contacts" | "offers" | "recommendations" | "customCategories" | "events"
>>;

function usePendingInputFocus() {
  const pendingKey = useRef<string | null>(null);
  const inputs = useRef(new Map<string, HTMLInputElement>());

  const registerInput = useCallback((key: string, input: HTMLInputElement | null) => {
    if (!input) {
      inputs.current.delete(key);
      return;
    }
    inputs.current.set(key, input);
    if (pendingKey.current === key) {
      input.focus();
      pendingKey.current = null;
    }
  }, []);

  const focusInput = useCallback((key: string) => {
    pendingKey.current = key;
    const input = inputs.current.get(key);
    if (input) {
      input.focus();
      pendingKey.current = null;
    }
  }, []);

  useLayoutEffect(() => {
    if (!pendingKey.current) return;
    const input = inputs.current.get(pendingKey.current);
    if (input) {
      input.focus();
      pendingKey.current = null;
    }
  });

  return { registerInput, focusInput };
}

export function normalizeCanonicalSaveBaseline(
  data: HostOnboardingData,
): NormalizedHostOnboardingData {
  return {
    ...data,
    contacts: data.contacts?.filter((row) => row.name.trim() || row.phone.trim()) || [],
    offers: data.offers?.filter((row) => row.name.trim() || row.price.trim()) || [],
    recommendations: data.recommendations?.filter((row) => row.name.trim()) || [],
    customCategories: (data.customCategories || []).map((category) => ({
      ...category,
      entries: (category.entries || []).filter((entry) => entry.name.trim()),
    })),
    events: data.events?.filter((row) =>
      row.name.trim() || row.date.trim() || row.time.trim()
    ) || [],
    canonicalItems: data.canonicalItems?.filter((row) =>
      !row.id.startsWith("new-") ||
      row.title.trim().length > 0 ||
      hasMeaningfulRichText(row.body)
    ),
  };
}

export function hasMeaningfulRichText(value: string): boolean {
  return value
    .replace(/<br\s*\/?>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .trim().length > 0;
}

export function shouldAppendStayEntry(item: Pick<CanonicalItem, "title" | "body">): boolean {
  return item.title.trim().length > 0 || hasMeaningfulRichText(item.body);
}

function newStayItem(
  category: { id: string; key: string },
  id = `new-${crypto.randomUUID()}`,
): CanonicalItem {
  return {
    id,
    categoryId: category.id,
    categoryKey: category.key,
    sectionKey: "stay",
    title: "",
    body: "",
    price: "",
    priceUnit: "",
    phone: "",
    website: "",
    mapQuery: "",
    difficulty: "",
    duration: "",
    distance: "",
    noteType: "",
    noteText: "",
    bullets: [],
    tint: "",
    frame: "",
    isVisible: true,
    orderEnabled: false,
    soldOut: false,
    producerName: "",
    producerNote: "",
  };
}

export function reconcileCreatedCanonicalRows(input: {
  local: HostOnboardingData;
  canonical: HostOnboardingData;
  baseline: HostOnboardingData;
  submitted: Partial<HostOnboardingData>;
}): HostOnboardingData {
  const canonicalItems = [...(input.local.canonicalItems || [])];
  const offers = [...(input.local.offers || [])];
  const baselineCanonicalIds = new Set((input.baseline.canonicalItems || []).map((row) => row.id));
  const baselineOfferIds = new Set((input.baseline.offers || []).map((row) => row.id));
  const claimedCanonicalIds = new Set<string>();

  for (const submitted of input.submitted.canonicalItems || []) {
    if (!submitted.id.startsWith("new-")) continue;
    const created = input.canonical.canonicalItems?.find((row) =>
      !baselineCanonicalIds.has(row.id) &&
      !claimedCanonicalIds.has(row.id) &&
      row.categoryId === submitted.categoryId &&
      (!submitted.title || row.title === submitted.title) &&
      row.body === submitted.body
    );
    if (!created) continue;
    claimedCanonicalIds.add(created.id);
    const localIndex = canonicalItems.findIndex((row) => row.id === submitted.id);
    if (localIndex >= 0) {
      canonicalItems[localIndex] = {
        ...created,
        ...canonicalItems[localIndex]!,
        id: created.id,
        categoryId: created.categoryId,
        categoryKey: created.categoryKey,
        sectionKey: created.sectionKey,
        title: canonicalItems[localIndex]!.title || created.title,
      };
    }
  }

  for (const submitted of input.submitted.offers || []) {
    if (baselineOfferIds.has(submitted.id)) continue;
    const created = input.canonical.offers?.find((row) =>
      !baselineOfferIds.has(row.id) &&
      row.categoryId === submitted.categoryId &&
      row.name === submitted.name &&
      row.price === submitted.price
    );
    if (!created) continue;
    const localIndex = offers.findIndex((row) => row.id === submitted.id);
    if (localIndex >= 0) {
      offers[localIndex] = { ...created, ...offers[localIndex]!, id: created.id };
    }
  }

  return { ...input.local, canonicalItems, offers };
}

export default function HostOnboarding() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: session, isLoading: sessionLoading } = useHostSession();
  
  const { data: onboardingData, isLoading, error, refetch } = useGetHostOnboarding({
    enabled: session?.authenticated && session?.onboardingRequired,
  });

  const patchOnboarding = usePatchHostOnboarding();
  const saveOnboarding = useSaveHostOnboarding();
  const submitOnboarding = useSubmitHostOnboarding();
  
  const [formData, setFormData] = useState<HostOnboardingData>({});
  const initialized = useRef(false);
  const hydratedSource = useRef("");
  const skipAutosaveOnce = useRef(false);
  const lastSaved = useRef<string>("");
  const lastSavedData = useRef<HostOnboardingData>({});
  const latestData = useRef<HostOnboardingData>({});
  const latestPayload = useRef<HostOnboardingData>({});
  const revision = useRef(0);
  const canonicalRevision = useRef("");
  const queue = useRef<Promise<void>>(Promise.resolve());
  const activeOperation = useRef<Promise<void>>(Promise.resolve());
  const conflictBlocked = useRef(false);
  const mediaDirty = useRef(false);
  const removedMediaIds = useRef(new Set<string>());
  const canonicalRowIds = useRef({
    contacts: new Set<string>(),
    offers: new Set<string>(),
    events: new Set<string>(),
  });
  const queuedSnapshot = useRef("");
  const patchTimeout = useRef<number | null>(null);
  const mounted = useRef(true);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState("");
  const [uploadsBlocking, setUploadsBlocking] = useState(false);
  const [entryUploadsBlocking, setEntryUploadsBlocking] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState("");
  const footerRef = useRef<HTMLDivElement>(null);
  const [footerHeight, setFooterHeight] = useState(160);

  const [transientRecs, setTransientRecs] = useState<Record<string, TransientRecommendation>>({});
  const [transientEvents, setTransientEvents] = useState({id: generateId(), name: "", date: "", time: ""});
  const [transientContact, setTransientContact] = useState({id: generateId(), name: "", phone: ""});
  const [transientOffers, setTransientOffers] = useState<Record<string, TransientOffer>>({});
  const transientOfferIds = useRef<Record<string, string>>({});
  const [transientCustomCategory, setTransientCustomCategory] = useState({
    id: generateId(),
    name: "",
  });
  const [transientCustomEntries, setTransientCustomEntries] = useState<Record<string, { id: string; name: string }>>({});
  const [expandedCustomCategoryIds, setExpandedCustomCategoryIds] = useState<Set<string>>(new Set());
  const [loggingOut, setLoggingOut] = useState(false);
  const { registerInput, focusInput } = usePendingInputFocus();
  const entryMediaRefs = useRef(new Map<string, ItemMediaEditorHandle>());
  const entryRenderKeys = useRef(new Map<string, string>());
  const entryPendingCounts = useRef(new Map<string, number>());

  const cleanData = useCallback((data: HostOnboardingData): HostOnboardingData => {
    const finalData = normalizeCanonicalSaveBaseline(data);
    
    // Upload completion owns image persistence. Ordinary form autosaves omit
    // media so a concurrent upload can never be removed by a stale payload.
    return preserveCanonicalMediaForWrite(
      omitLegacyRichAliasForCanonicalItems(finalData),
      onboardingData?.data.media || [],
      mediaDirty.current,
      removedMediaIds.current,
    );
  }, [
    onboardingData?.data.media,
  ]);

  // A fresh open always starts with the current canonical admin draft. Later
  // refetches may refresh a pristine form, but never clobber local or queued
  // edits. The revision remains the compare-and-swap guard for stale writes.
  useEffect(() => {
    if (!onboardingData || onboardingData.status !== "draft") return;
    const source = `${onboardingData.id}:${onboardingData.revision}:${onboardingData.canonicalRevision}`;
    if (source === hydratedSource.current) return;
    const localSnapshot = JSON.stringify(latestPayload.current);
    if (!canHydrateCanonicalDraft({
      initialized: initialized.current,
      localSnapshot,
      lastSavedSnapshot: lastSaved.current,
      queuedSnapshot: queuedSnapshot.current,
      saveState,
    })) return;

    const canonical = onboardingData.data || {};
    mediaDirty.current = false;
    removedMediaIds.current.clear();
    canonicalRowIds.current = {
      contacts: new Set(canonical.contacts?.map((row) => row.id) || []),
      offers: new Set(canonical.offers?.map((row) => row.id) || []),
      events: new Set(canonical.events?.map((row) => row.id) || []),
    };
    const canonicalPayload = preserveCanonicalMediaForWrite(
      omitLegacyRichAliasForCanonicalItems(canonical),
      canonical.media || [],
      false,
    );
    setFormData(canonical);
    latestData.current = canonical;
    latestPayload.current = canonicalPayload;
    lastSavedData.current = canonical;
    lastSaved.current = JSON.stringify(canonicalPayload);
    revision.current = onboardingData.revision;
    canonicalRevision.current = onboardingData.canonicalRevision;
    conflictBlocked.current = false;
    hydratedSource.current = source;
    initialized.current = true;
    skipAutosaveOnce.current = true;
    setSaveError("");
    setSaveState("saved");
  }, [onboardingData, saveState]);

  const enqueueSave = useCallback((data: Partial<HostOnboardingData>, explicit = false) => {
    const snapshot = JSON.stringify(data);
    if (conflictBlocked.current) return Promise.reject(new Error("Osnutek je spremenjen v drugem zavihku."));
    if (Object.keys(data).length === 0) return queue.current;
    if (snapshot === queuedSnapshot.current) return activeOperation.current;
    queuedSnapshot.current = snapshot;
    setSaveState("saving");
    setSaveError("");
    const operation = queue.current.then(async () => {
      const result = explicit
        ? await saveOnboarding.mutateAsync({
            data,
            revision: revision.current,
            canonicalRevision: canonicalRevision.current,
          })
        : await patchOnboarding.mutateAsync({
            data,
            revision: revision.current,
            canonicalRevision: canonicalRevision.current,
          });
      revision.current = result.revision;
      canonicalRevision.current = result.canonicalRevision;
      const canonical = result.data ?? { ...lastSavedData.current, ...data };
      if (result.data) {
        let reconciled = reconcileCreatedCanonicalRows({
          local: latestData.current,
          canonical,
          baseline: lastSavedData.current,
          submitted: data,
        });
        for (const submitted of data.canonicalItems || []) {
          if (!submitted.id.startsWith("new-")) continue;
          const localIndex = latestData.current.canonicalItems?.findIndex((row) => row.id === submitted.id) ?? -1;
          const created = localIndex >= 0 ? reconciled.canonicalItems?.[localIndex] : undefined;
          const editor = entryMediaRefs.current.get(submitted.id);
          if (created && !created.id.startsWith("new-")) {
            entryRenderKeys.current.set(created.id, submitted.id);
          }
          if (created && !created.id.startsWith("new-") && editor?.hasPending()) {
            await editor.uploadAllTo(created.id);
          }
        }
        // Upload processing can take seconds. Re-run ID reconciliation against
        // the newest local projection so typing done in flight is never
        // replaced by the snapshot captured before the upload began.
        reconciled = reconcileCreatedCanonicalRows({
          local: latestData.current,
          canonical,
          baseline: lastSavedData.current,
          submitted: data,
        });
        latestData.current = reconciled;
        setFormData(reconciled);
      }
      for (const row of data.contacts || []) canonicalRowIds.current.contacts.add(row.id);
      for (const row of data.offers || []) canonicalRowIds.current.offers.add(row.id);
      for (const row of data.events || []) canonicalRowIds.current.events.add(row.id);
      lastSavedData.current = canonical;
      const savedPayload = preserveCanonicalMediaForWrite(
        omitLegacyRichAliasForCanonicalItems(normalizeCanonicalSaveBaseline(canonical)),
        onboardingData?.data.media || [],
        mediaDirty.current,
        removedMediaIds.current,
      );
      lastSaved.current = JSON.stringify(savedPayload);
      if (mounted.current) {
        setSaveState(JSON.stringify(latestPayload.current) === lastSaved.current ? "saved" : "dirty");
      }
    }).catch((reason: Error & { status?: number }) => {
      if (mounted.current) {
        setSaveError(reason.message);
        setSaveState(reason.status === 409 ? "conflict" : "error");
      }
      if (reason.status === 409) conflictBlocked.current = true;
      throw reason;
    }).finally(() => {
      if (queuedSnapshot.current === snapshot) queuedSnapshot.current = "";
    });
    queue.current = operation.catch(() => undefined);
    activeOperation.current = operation;
    return operation;
  }, [cleanData, onboardingData?.data.media, patchOnboarding, saveOnboarding]);
  const enqueueSaveRef = useRef(enqueueSave);
  enqueueSaveRef.current = enqueueSave;

  const flush = useCallback(async (explicit = false) => {
    if (patchTimeout.current !== null) window.clearTimeout(patchTimeout.current);
    patchTimeout.current = null;
    const data = cleanData(latestData.current);
    await enqueueSave(changedHostOnboardingFields(data, lastSavedData.current), explicit);
    await queue.current;
  }, [cleanData, enqueueSave]);

  const serializeEntryMediaWrite = useCallback(async <T,>(write: () => Promise<T>): Promise<T> => {
    // Persist text first, then append the complete media request + canonical
    // revision refresh to the same queue used by autosave. Any edit arriving
    // during media processing is queued behind the refreshed revision.
    await flush(true);
    const operation = queue.current.then(write);
    queue.current = operation.then(() => undefined, () => undefined);
    return operation;
  }, [flush]);

  const refreshAfterEntryMediaWrite = useCallback(async () => {
    const response = await fetch("/api/admin/host/onboarding", { credentials: "include" });
    if (!response.ok) {
      conflictBlocked.current = true;
      setSaveError("Mediji so shranjeni, osnutka pa ni bilo mogoče osvežiti.");
      setSaveState("conflict");
      return;
    }
    const current = await response.json() as import("@/hooks/use-host-onboarding").HostOnboardingResponse;
    revision.current = current.revision;
    canonicalRevision.current = current.canonicalRevision;
    hydratedSource.current = `${current.id}:${current.revision}:${current.canonicalRevision}`;
    queryClient.setQueryData(["host-onboarding"], current);
    const media = current.data.media || [];
    const next = { ...latestData.current, media };
    latestData.current = next;
    setFormData(next);
    lastSavedData.current = { ...lastSavedData.current, media };
  }, [queryClient]);

  const setEntryPending = useCallback((itemId: string, count: number) => {
    if (count > 0) entryPendingCounts.current.set(itemId, count);
    else entryPendingCounts.current.delete(itemId);
    setEntryUploadsBlocking(entryPendingCounts.current.size > 0);
  }, []);

  // Update form data and trigger autosave
  const updateData = (updater: (prev: HostOnboardingData) => HostOnboardingData) => {
    // The ref is the save authority. Update it synchronously so an explicit
    // save clicked in the same React batch as the final keystroke cannot see
    // the previous render and incorrectly conclude that there is no patch.
    const next = updater(latestData.current);
    latestData.current = next;
    setFormData(next);
  };

  useEffect(() => {
    if (!initialized.current) return;
    if (skipAutosaveOnce.current) {
      skipAutosaveOnce.current = false;
      return;
    }
    latestData.current = formData;
    latestPayload.current = cleanData(formData);
    const snapshot = JSON.stringify(latestPayload.current);
    if (snapshot === lastSaved.current) {
      setSaveState((state) => state === "dirty" ? "saved" : state);
      return;
    }
    setSaveState((state) => state === "conflict" ? state : "dirty");
    if (patchTimeout.current !== null) window.clearTimeout(patchTimeout.current);
    patchTimeout.current = window.setTimeout(() => {
      const current = cleanData(latestData.current);
      void enqueueSave(changedHostOnboardingFields(current, lastSavedData.current)).catch(() => undefined);
    }, 900);
    return () => {
      if (patchTimeout.current !== null) window.clearTimeout(patchTimeout.current);
    };
  }, [formData, cleanData, enqueueSave]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (patchTimeout.current !== null) window.clearTimeout(patchTimeout.current);
      if (initialized.current && JSON.stringify(latestPayload.current) !== lastSaved.current) {
        const patch = changedHostOnboardingFields(latestPayload.current, lastSavedData.current);
        void enqueueSaveRef.current(patch).catch(() => undefined);
      }
    };
  }, []);

  useEffect(() => {
    const footer = footerRef.current;
    if (!footer) return;
    const updateHeight = () => setFooterHeight(Math.ceil(footer.getBoundingClientRect().height));
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(footer);
    return () => observer.disconnect();
  }, [isLoading, sessionLoading, error, submittedMessage]);

  const handleSave = async () => {
    try {
      await flush(true);
    } catch {}
  };

  const handleSubmit = async () => {
    if (uploadsBlocking || entryUploadsBlocking) return;
    try {
      await flush();
      const result = await submitOnboarding.mutateAsync(
        persistedHostOnboardingSubmitPayload(
          onboardingData?.round || 1,
          revision.current,
          canonicalRevision.current,
        ),
      );
      setSubmittedMessage(result.message);
    } catch {}
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await flush(true);
      const response = await fetch("/api/admin/host/logout", { method: "POST", credentials: "include" });
      if (!response.ok) throw new Error("Odjava ni uspela.");
      queryClient.removeQueries({ queryKey: ["host-onboarding"] });
      setLocation("/admin/login");
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : "Odjava ni uspela.");
      setSaveState("error");
      setLoggingOut(false);
    }
  };

  // Redirect logic
  useEffect(() => {
    if (!sessionLoading) {
      if (!session?.authenticated) {
        setLocation("/admin/login");
      } else if (!session.onboardingRequired) {
        setLocation(`/admin/tenants/${session.tenantId}`);
      }
    }
  }, [session, sessionLoading, setLocation]);

  if (error) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#F4F6F2] p-6 text-center">
        <p className="text-[#121A14] font-semibold mb-2">Podatkov obrazca ni bilo mogoče naložiti.</p>
        <p className="text-[#66716A] mb-5 max-w-md">{error.message}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="min-h-12 bg-[#157347] text-white px-6 py-3 rounded-full font-bold shadow-sm"
        >
          Poskusi znova
        </button>
      </div>
    );
  }

  if (sessionLoading || (session?.authenticated && session.onboardingRequired && isLoading)) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#F4F6F2]">
        <Loader2 className="h-8 w-8 animate-spin text-[#157347]" />
      </div>
    );
  }

  if (onboardingData?.status === "submitted" || submitOnboarding.isSuccess) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-white p-6 text-center" style={{ fontFamily: 'Archivo, sans-serif' }}>
        <CheckCircle2 className="w-16 h-16 text-[#157347] mb-6" />
        <h1 className="text-2xl md:text-3xl font-bold text-[#121A14] mb-4">Hvala!</h1>
        <p className="text-[#3A443C] max-w-md text-lg leading-relaxed">
          {submittedMessage || "Vaš vodnik pripravljamo — obvestili vas bomo, ko bo pripravljen za pregled."}
        </p>
        <div className="mt-10">
          <button 
            onClick={() => window.location.href = "/admin"}
            className="bg-[#F4F6F2] text-[#121A14] border border-[#E8EBE6] px-8 py-4 rounded-full font-bold text-lg"
          >
            Nadaljuj v administracijo
          </button>
        </div>
      </div>
    );
  }

  const isSaving = saveState === "saving";
  const staySection = onboardingData?.contentSections?.find((s) => s.key === "stay");
  const offerSection = onboardingData?.contentSections?.find((s) => s.key === "offer");
  const stayCategories = staySection?.categories || [];
  const offerCategories = offerSection?.categories || [];

  const houseCategory = stayCategories.find(c => c.key === "house");
  const editableRichItems = houseCategory 
    ? (formData.canonicalItems || []).filter((item) => item.categoryId === houseCategory.id)
    : [];

  return (
    <div data-admin-preserve className="host-onboarding-form min-h-[100dvh] bg-white text-[#121A14]" style={{ fontFamily: 'Archivo, sans-serif' }}>
      <header className="px-4 md:px-10 pt-6 pb-6">
        <div className="flex justify-end max-w-[720px] mx-auto mb-4">
          <button 
            onClick={handleLogout}
            disabled={loggingOut || isSaving}
            className="flex items-center gap-2 text-sm font-semibold text-[#66716A] hover:text-[#121A14] transition-colors"
          >
            {loggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            Odjava
          </button>
        </div>
        <div className="flex flex-col items-start max-w-[720px] mx-auto">
          <div data-testid="host-onboarding-brand" className="mb-[48px] flex items-center gap-[12px]">
            <img src={`${import.meta.env.BASE_URL}brand/smart360-znak-40.png`} alt="" className="h-[46px] w-[46px] object-contain" />
            <span className="font-[800] text-[24px] text-[#121A14] tracking-[0.02em]">SMART360</span>
          </div>
          <h1 className="text-[30px] font-[800] text-[#121A14] leading-tight">
            Dobrodošli, {onboardingData?.data.accommodationName || "gostitelj"}
          </h1>
          <p className="mt-4 text-[#66716A] text-[16px] max-w-xl leading-relaxed">
            Vpišite podatke o svoji nastanitvi — vse ostalo uredimo mi. Vnos lahko kadar koli prekinete, osnutek se shrani sam.
          </p>
        </div>
      </header>

      <main
        className="px-4 md:px-8 max-w-[784px] mx-auto space-y-8"
        style={{ paddingBottom: `calc(${footerHeight}px + 1.5rem)` }}
      >
        
        {/* SECTION 1 */}
        <section className="bg-[#F4F6F2] border border-[#E8EBE6] rounded-[16px] p-5 md:p-8 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-full bg-[#157347] text-white flex items-center justify-center font-bold text-lg shrink-0">1</div>
            <h2 className="text-xl font-bold">Osnovni podatki</h2>
          </div>
          
          <div className="space-y-5">
            <div>
              <label htmlFor="accommodationName" className="block text-[13px] font-[700] text-[#66716A] uppercase mb-1.5">Naziv nastanitve (kot naj ga vidijo gostje)</label>
              <input 
                id="accommodationName"
                type="text" 
                value={formData.accommodationName || ""}
                onChange={(e) => updateData(d => ({ ...d, accommodationName: e.target.value }))}
                className="w-full bg-white border border-[#E8EBE6] rounded-[10px] px-4 py-3 text-[16px] outline-none focus:border-[#157347] focus:ring-1 focus:ring-[#157347] transition-all"
              />
            </div>
            
            <div>
              <label htmlFor="address" className="block text-[13px] font-[700] text-[#66716A] uppercase mb-1.5">Naslov nastanitve</label>
              <input 
                id="address"
                type="text" 
                value={formData.address || ""}
                onChange={(e) => updateData(d => ({ ...d, address: e.target.value }))}
                className="w-full bg-white border border-[#E8EBE6] rounded-[10px] px-4 py-3 text-[16px] outline-none focus:border-[#157347] transition-all"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label htmlFor="guestPhone" className="block text-[13px] font-[700] text-[#66716A] uppercase mb-1.5">Telefon za goste</label>
                <input 
                  id="guestPhone"
                  type="text" 
                  value={formData.guestPhone || ""}
                  onChange={(e) => updateData(d => ({ ...d, guestPhone: e.target.value }))}
                  className="w-full bg-white border border-[#E8EBE6] rounded-[10px] px-4 py-3 text-[16px] outline-none focus:border-[#157347] transition-all"
                />
              </div>
              <div>
                <label htmlFor="guestEmail" className="block text-[13px] font-[700] text-[#66716A] uppercase mb-1.5">E-pošta za goste</label>
                <input 
                  id="guestEmail"
                  type="email" 
                  value={formData.guestEmail || ""}
                  onChange={(e) => updateData(d => ({ ...d, guestEmail: e.target.value }))}
                  className="w-full bg-white border border-[#E8EBE6] rounded-[10px] px-4 py-3 text-[16px] outline-none focus:border-[#157347] transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="website" className="block text-[13px] font-[700] text-[#66716A] uppercase mb-1.5">Spletna stran (neobvezno)</label>
              <input 
                id="website"
                type="url" 
                value={formData.website || ""}
                onChange={(e) => updateData(d => ({ ...d, website: e.target.value }))}
                className="w-full bg-white border border-[#E8EBE6] rounded-[10px] px-4 py-3 text-[16px] outline-none focus:border-[#157347] transition-all"
                placeholder="https://"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="checkInFrom" className="block text-[13px] font-[700] text-[#66716A] uppercase mb-1.5">Prijava od</label>
                <input 
                  id="checkInFrom"
                  type="time" 
                  value={formData.checkInFrom || ""}
                  onChange={(e) => updateData(d => ({ ...d, checkInFrom: e.target.value }))}
                  className="w-full bg-white border border-[#E8EBE6] rounded-[10px] px-4 py-3 text-[16px] outline-none focus:border-[#157347] transition-all"
                />
              </div>
              <div>
                <label htmlFor="checkOutUntil" className="block text-[13px] font-[700] text-[#66716A] uppercase mb-1.5">Odjava do</label>
                <input 
                  id="checkOutUntil"
                  type="time" 
                  value={formData.checkOutUntil || ""}
                  onChange={(e) => updateData(d => ({ ...d, checkOutUntil: e.target.value }))}
                  className="w-full bg-white border border-[#E8EBE6] rounded-[10px] px-4 py-3 text-[16px] outline-none focus:border-[#157347] transition-all"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-[#E8EBE6]">
              <h3 className="text-[16px] font-bold mb-4">Kontaktne osebe za goste</h3>
              <div className="space-y-3">
                {(formData.contacts || []).map((contact, i) => (
                  <div key={contact.id} className="flex flex-col md:flex-row gap-3">
                    <input 
                      aria-label={`Ime kontaktne osebe ${i + 1}`}
                      type="text" 
                      placeholder="Ime in priimek"
                      value={contact.name}
                      onChange={(e) => updateData(d => {
                        const newContacts = [...(d.contacts || [])];
                        newContacts[i] = { ...contact, name: e.target.value };
                        return { ...d, contacts: newContacts };
                      })}
                      className="min-w-0 flex-1 bg-white border border-[#E8EBE6] rounded-[10px] px-4 py-3 text-[16px] outline-none focus:border-[#157347] transition-all"
                    />
                    <div className="flex min-w-0 gap-2">
                      <input 
                        aria-label={`Telefon kontaktne osebe ${i + 1}`}
                        type="text" 
                        placeholder="Telefon"
                        value={contact.phone}
                        onChange={(e) => updateData(d => {
                          const newContacts = [...(d.contacts || [])];
                          newContacts[i] = { ...contact, phone: e.target.value };
                          return { ...d, contacts: newContacts };
                        })}
                        className="min-w-0 flex-1 md:w-48 bg-white border border-[#E8EBE6] rounded-[10px] px-4 py-3 text-[16px] outline-none focus:border-[#157347] transition-all"
                      />
                      <button 
                        onClick={() => updateData(d => ({
                          ...d,
                          contacts: d.contacts?.filter(c => c.id !== contact.id),
                          deleteContactIds: canonicalRowIds.current.contacts.has(contact.id)
                            ? [...new Set([...(d.deleteContactIds || []), contact.id])]
                            : d.deleteContactIds,
                        }))}
                        className="w-12 flex items-center justify-center text-[#9AA39D] hover:text-[#DD9A2B] active:text-[#DD9A2B] transition-colors"
                        aria-label="Odstrani"
                      >
                        <X className="w-[18px] h-[18px]" strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex flex-col md:flex-row gap-3">
                  <input 
                    ref={(input) => registerInput("contact", input)}
                    aria-label="Ime nove kontaktne osebe"
                    type="text" 
                    placeholder="Ime in priimek"
                    value={transientContact.name}
                    onChange={(e) => setTransientContact(prev => ({ ...prev, name: e.target.value }))}
                    className="min-w-0 flex-1 bg-white border border-[#E8EBE6] rounded-[10px] px-4 py-3 text-[16px] outline-none focus:border-[#157347] transition-all"
                  />
                  <div className="flex min-w-0 gap-2">
                    <input 
                      aria-label="Telefon nove kontaktne osebe"
                      type="text" 
                      placeholder="Telefon"
                      value={transientContact.phone}
                      onChange={(e) => setTransientContact(prev => ({ ...prev, phone: e.target.value }))}
                      className="min-w-0 flex-1 md:w-48 bg-white border border-[#E8EBE6] rounded-[10px] px-4 py-3 text-[16px] outline-none focus:border-[#157347] transition-all"
                    />
                    <div className="w-12"></div>
                  </div>
                </div>
              </div>
              <button 
                type="button"
                aria-label="Dodaj kontaktno osebo"
                onClick={() => {
                  if (transientContact.name.trim() || transientContact.phone.trim()) {
                     updateData(d => ({ ...d, contacts: [...(d.contacts || []), { id: transientContact.id, name: transientContact.name, phone: transientContact.phone }] }));
                     setTransientContact({ id: generateId(), name: "", phone: "" });
                  }
                  focusInput("contact");
                }}
                className="mt-4 flex items-center gap-2 text-[#157347] font-bold py-2 px-1 hover:opacity-80 transition-opacity"
              >
                <span aria-hidden="true">+ Dodaj …</span>
              </button>
            </div>
          </div>
        </section>


        {/* SECTION 2 */}
        <section className="bg-[#F4F6F2] border border-[#E8EBE6] rounded-[16px] p-5 md:p-8 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-full bg-[#157347] text-white flex items-center justify-center font-bold text-lg shrink-0">2</div>
            <h2 className="text-xl font-bold">Wi-Fi</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label htmlFor="wifiName" className="block text-[13px] font-[700] text-[#66716A] uppercase mb-1.5">Ime omrežja</label>
              <input 
                id="wifiName"
                type="text" 
                value={formData.wifiName || ""}
                onChange={(e) => updateData(d => ({ ...d, wifiName: e.target.value }))}
                className="w-full bg-white border border-[#E8EBE6] rounded-[10px] px-4 py-3 text-[16px] outline-none focus:border-[#157347] transition-all"
              />
            </div>
            <div>
              <label htmlFor="wifiPassword" className="block text-[13px] font-[700] text-[#66716A] uppercase mb-1.5">Geslo</label>
              <input 
                id="wifiPassword"
                type="text" 
                value={formData.wifiPassword || ""}
                onChange={(e) => updateData(d => ({ ...d, wifiPassword: e.target.value }))}
                className="w-full bg-white border border-[#E8EBE6] rounded-[10px] px-4 py-3 text-[16px] outline-none focus:border-[#157347] transition-all"
              />
            </div>
          </div>
        </section>


        {/* SECTION 3 */}
        <section className="bg-[#F4F6F2] border border-[#E8EBE6] rounded-[16px] p-5 md:p-8 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-full bg-[#157347] text-white flex items-center justify-center font-bold text-lg shrink-0">3</div>
            <h2 className="text-xl font-bold">Hišni red, parkiranje, posebnosti</h2>
          </div>
          <div>
            <p className="text-sm text-[#66716A] mb-3">Napišite po domače — mi uredimo obliko.</p>
            {editableRichItems.length ? (
              <div className="space-y-5">
                {editableRichItems.map((item, index) => (
                  <div key={"house-" + index} className="rounded-[10px] border border-[#E8EBE6] bg-white p-4">
                    <label
                      htmlFor={`rich-item-title-${item.id}`}
                      className="mb-1.5 block text-[13px] font-[700] text-[#66716A] uppercase"
                    >
                      {item.title || `Besedilo ${index + 1}`}
                    </label>
                    <input
                      id={`rich-item-title-${item.id}`}
                      aria-label={`Naziv besedila ${index + 1}`}
                      type="text"
                      placeholder={entryNamePlaceholder(houseCategory, "stay")}
                      value={item.title}
                      onChange={(event) => updateData((data) =>
                        updateCanonicalItemText(data, item.id, { title: event.target.value })
                      )}
                      className="mb-3 w-full rounded-[10px] border border-[#E8EBE6] bg-white px-4 py-3 text-[16px] outline-none focus:border-[#157347]"
                    />
                    <div aria-label={index === 0
                      ? "Hišni red, parkiranje in posebnosti"
                      : `Vsebina besedila ${index + 1}`}
                    >
                      <RichTextEditor
                        value={item.body}
                        onChange={(value) => updateData((data) =>
                          updateCanonicalItemText(data, item.id, { body: value })
                        )}
                        placeholder="Besedilo"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div aria-label="Hišni red, parkiranje in posebnosti">
                <RichTextEditor
                  value={formData.houseRulesParking || ""}
                  onChange={(value) => updateData(d => ({ ...d, houseRulesParking: value }))}
                  placeholder="Hišni red, parkiranje in posebnosti"
                />
              </div>
            )}
          </div>
        </section>



        {/* SECTION 4 - Vaša destinacija (Dynamic) */}
        <section className="bg-[#F4F6F2] border border-[#E8EBE6] rounded-[16px] p-5 md:p-8 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-full bg-[#157347] text-white flex items-center justify-center font-bold text-lg shrink-0">4</div>
            <h2 className="text-xl font-bold">{staySection?.title || "Vaša destinacija"}</h2>
          </div>
          
          <div className="space-y-8">
            {stayCategories.filter(c => c.key !== "wifi" && c.key !== "house").map((cat) => {
              const items = (formData.canonicalItems || []).filter(item => item.categoryId === cat.id);
              const displayItems = items.length > 0 ? items : [newStayItem(cat, `new-${cat.id}`)];
              
              return (
                <div key={cat.id} className="space-y-4">
                  <h3 style={{ letterSpacing: "0.08em" }} className="text-[14px] font-[800] tracking-[0.08em] text-[#157347] uppercase">
                    {cat.label}
                  </h3>
                  
                  {displayItems.map((item, index) => {
                    const itemMedia = (formData.media || []).filter((media) => media.itemId === item.id);
                    const renderKey = entryRenderKeys.current.get(item.id) || item.id;
                    const materialize = (change: { title?: string; body?: string }) => {
                      updateData((data) => {
                        const exists = data.canonicalItems?.some((row) => row.id === item.id);
                        return exists
                          ? updateCanonicalItemText(data, item.id, change)
                          : {
                              ...data,
                              canonicalItems: [...(data.canonicalItems || []), { ...item, ...change }],
                            };
                      });
                    };
                    return (
                    <div key={renderKey} className="rounded-[10px] border border-[#E8EBE6] bg-white p-4">
                      <div>
                        <label
                          htmlFor={`stay-item-title-${item.id}`}
                          className="mb-1.5 block text-[13px] font-[700] uppercase text-[#66716A]"
                        >
                          Naziv
                        </label>
                        <input
                          id={`stay-item-title-${item.id}`}
                          ref={(input) => registerInput(`stay:${item.id}`, input)}
                          data-testid={`input-stay-entry-name-${item.id}`}
                          aria-label={`Naziv vnosa ${cat.label} ${index + 1}`}
                          type="text"
                          value={item.title || ""}
                          placeholder={entryNamePlaceholder(cat, "stay")}
                          onChange={(event) => materialize({ title: event.target.value })}
                          className="mb-3 w-full rounded-[10px] border border-[#E8EBE6] bg-white px-4 py-3 text-[16px] outline-none focus:border-[#157347]"
                        />
                      </div>
                      <div>
                        <RichTextEditor
                          value={item.body || ""}
                          onChange={(value) => {
                            if (!hasMeaningfulRichText(value) && !(formData.canonicalItems || []).some((row) => row.id === item.id)) return;
                            materialize({ body: value });
                          }}
                          placeholder={`Vnesite ${cat.label.toLowerCase()}...`}
                        />
                      </div>
                      <div className="mt-4 border-t border-[#E8EBE6] pt-3">
                        <p className="text-[13px] font-[700] uppercase text-[#66716A]">Fotografije in video</p>
                        <ItemMediaEditor
                          ref={(handle) => {
                            if (handle) entryMediaRefs.current.set(item.id, handle);
                            else entryMediaRefs.current.delete(item.id);
                          }}
                          itemId={item.id.startsWith("new-") ? null : item.id}
                          tenantId={session?.tenantId || ""}
                          media={itemMedia}
                          hostMode
                          onBeforeWrite={() => flush(true)}
                          serializeWrite={serializeEntryMediaWrite}
                          onAfterWrite={refreshAfterEntryMediaWrite}
                          onPendingChange={(count) => setEntryPending(renderKey, count)}
                        />
                      </div>
                    </div>
                  )})}
                  <button
                    type="button"
                    data-testid={`button-add-stay-entry-${cat.id}`}
                    aria-label={`Dodaj vnos v kategorijo ${cat.label}`}
                    onClick={() => {
                      const trailing = displayItems[displayItems.length - 1]!;
                      if (!shouldAppendStayEntry(trailing)) {
                        focusInput(`stay:${trailing.id}`);
                        return;
                      }
                      const next = newStayItem(cat);
                      updateData((data) => ({
                        ...data,
                        canonicalItems: [...(data.canonicalItems || []), next],
                      }));
                      focusInput(`stay:${next.id}`);
                    }}
                    className="flex items-center gap-2 px-1 py-2 font-bold text-[#157347] hover:opacity-80"
                  >
                    <span aria-hidden="true">+ Dodaj …</span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>


        {/* SECTION 5 - Vaša ponudba */}
        <section style={{ borderColor: "#157347" }} className="bg-[#F4F6F2] border-[2px] border-[#157347] rounded-[16px] p-5 md:p-8 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-full bg-[#157347] text-white flex items-center justify-center font-bold text-lg shrink-0">5</div>
            <h2 className="text-xl font-bold">{offerSection?.title || "Vaša ponudba"}</h2>
          </div>
          
          <div className="space-y-8">
            {offerCategories.map((cat) => {
              const catOffers = (formData.offers || []).filter(o => o.categoryId === cat.id);
              const offerKey = cat.key || cat.id;
              transientOfferIds.current[offerKey] ||= generateId();
              const tOffer = transientOffers[offerKey] || {
                id: transientOfferIds.current[offerKey],
                name: "",
                price: "",
              };
              
              return (
                <div key={cat.id} className="space-y-3">
                  <h3 style={{ letterSpacing: "0.08em" }} className="text-[14px] font-[800] tracking-[0.08em] text-[#157347] uppercase mb-2">
                    {cat.label}
                  </h3>
                  
                  {catOffers.map((offer, i) => (
                    <div key={offer.id} className="flex flex-col md:flex-row gap-3">
                      <input 
                        aria-label={`Naziv ponudbe ${i + 1}`}
                        type="text" 
                        placeholder={entryNamePlaceholder(cat, "offer")}
                        value={offer.name}
                        onChange={(e) => updateData(d => {
                          const newOffers = [...(d.offers || [])];
                          const idx = newOffers.findIndex(o => o.id === offer.id);
                          if (idx >= 0) newOffers[idx] = { ...offer, name: e.target.value };
                          return { ...d, offers: newOffers };
                        })}
                        className="min-w-0 flex-1 bg-white border border-[#E8EBE6] rounded-[10px] px-4 py-3 text-[16px] outline-none focus:border-[#157347] transition-all"
                      />
                      <div className="flex min-w-0 gap-2">
                        <input 
                          aria-label={`Cena ponudbe ${i + 1}`}
                          type="text" 
                          placeholder="Cena (npr. 10 €)"
                          value={offer.price}
                          onChange={(e) => updateData(d => {
                            const newOffers = [...(d.offers || [])];
                            const idx = newOffers.findIndex(o => o.id === offer.id);
                            if (idx >= 0) newOffers[idx] = { ...offer, price: e.target.value };
                            return { ...d, offers: newOffers };
                          })}
                          className="min-w-0 flex-1 md:w-32 bg-white border border-[#E8EBE6] rounded-[10px] px-4 py-3 text-[16px] outline-none focus:border-[#157347] transition-all"
                        />
                        <button 
                          onClick={() => updateData(d => ({
                            ...d,
                            offers: d.offers?.filter(o => o.id !== offer.id),
                            deleteOfferIds: canonicalRowIds.current.offers.has(offer.id)
                              ? [...new Set([...(d.deleteOfferIds || []), offer.id])]
                              : d.deleteOfferIds,
                          }))}
                          className="flex w-10 items-center justify-center text-[#9AA39D] hover:text-[#DD9A2B] active:text-[#DD9A2B] transition-colors"
                        >
                          <X className="w-[18px] h-[18px]" strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  <div className="flex flex-col md:flex-row gap-3">
                    <input 
                      ref={(input) => registerInput(`offer:${offerKey}`, input)}
                      aria-label="Naziv nove ponudbe"
                      type="text" 
                      placeholder={entryNamePlaceholder(cat, "offer")}
                      value={tOffer.name}
                      onChange={(e) => setTransientOffers(prev => ({
                        ...prev,
                        [offerKey]: { ...tOffer, name: e.target.value }
                      }))}
                      className="min-w-0 flex-1 bg-white border border-dashed border-[#9AA39D] rounded-[10px] px-4 py-3 text-[16px] outline-none focus:border-[#157347] transition-all"
                    />
                    <div className="flex min-w-0 gap-2">
                      <input 
                        aria-label="Cena nove ponudbe"
                        type="text" 
                        placeholder="Cena"
                        value={tOffer.price}
                        onChange={(e) => setTransientOffers(prev => ({
                          ...prev,
                          [offerKey]: { ...tOffer, price: e.target.value }
                        }))}
                        className="min-w-0 flex-1 md:w-32 bg-white border border-dashed border-[#9AA39D] rounded-[10px] px-4 py-3 text-[16px] outline-none focus:border-[#157347] transition-all"
                      />
                      <div className="w-10"></div>
                    </div>
                  </div>
                  
                  <button 
                    type="button"
                    aria-label="Dodaj ponudbo"
                    onClick={() => {
                      if (tOffer.name.trim() || tOffer.price.trim()) {
                         updateData(d => ({ ...d, offers: [...(d.offers || []), { id: tOffer.id, categoryId: cat.id, name: tOffer.name, price: tOffer.price }] }));
                         transientOfferIds.current[offerKey] = generateId();
                         setTransientOffers(prev => {
                           const next = { ...prev };
                           delete next[offerKey];
                           return next;
                         });
                      }
                       focusInput(`offer:${offerKey}`);
                    }}
                    className="mt-1 flex items-center gap-2 text-[#157347] font-bold py-2 px-1 hover:opacity-80 transition-opacity"
                  >
                    <span aria-hidden="true">+ Dodaj ponudbo</span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 6 - Okolica (Emphasized) */}
        <section data-testid="host-onboarding-explore" className="bg-[#F4F6F2] border rounded-[16px] p-5 md:p-8 shadow-sm" >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-full bg-[#157347] text-white flex items-center justify-center font-bold text-lg shrink-0">6</div>
            <div>
              <h2 className="text-xl font-bold">Kaj priporočate v okolici</h2>
              <p className="text-sm text-[#66716A] mt-1">Vpišite samo ime kraja ali doživetja. Zemljevid, razdaljo, opis in fotografije dodamo mi. Kjer nimate priporočila, pustite prazno.</p>
            </div>
          </div>
          
          <div className="space-y-3">
            {onboardingData?.categories.map((cat) => {
              const catRecs = (formData.recommendations || []).filter(r => r.categoryId === cat.id);
              const transientRec = transientRecs[cat.id];
               const openNewRecommendation = () => {
                 focusInput(`recommendation:${cat.id}`);
                 setTransientRecs(prev => ({
                   ...prev,
                   [cat.id]: prev[cat.id] || { id: generateId(), name: "" },
                 }));
               };
              const commitNewRecommendation = () => {
                 if (transientRec?.name.trim()) {
                   updateData(d => ({
                     ...d,
                     recommendations: [...(d.recommendations || []), {
                       id: transientRec.id,
                       categoryId: cat.id,
                       name: transientRec.name,
                     }],
                   }));
                   setTransientRecs(prev => ({
                     ...prev,
                     [cat.id]: { id: generateId(), name: "" },
                   }));
                 }
                 focusInput(`recommendation:${cat.id}`);
              };
              
              if (catRecs.length === 0 && !transientRec) {
                return (
                  <EmptyCategoryRow
                    key={cat.id}
                    id={`onboarding-${cat.id}`}
                    icon={<MapPin className="h-3.5 w-3.5" />}
                    name={cat.name}
                    addLabel="Dodaj kraj"
                    onAdd={openNewRecommendation}
                  />
                );
              }

              return (
                <div key={cat.id} data-testid={`category-onboarding-${cat.id}`} className="pt-1">
                  <h3 style={{ letterSpacing: "0.08em" }} className="mb-3 flex items-center gap-2 px-1 text-[14px] font-[800] tracking-[0.08em] text-[#157347] uppercase">
                    
                    {cat.name}
                    <span className="font-normal text-[#9AA39D]">· {catRecs.length} krajev</span>
                  </h3>
                  <div className="space-y-1.5">
                    {catRecs.map((rec) => (
                      <div key={rec.id} className="flex min-h-[46px] items-start min-w-0 gap-2 rounded-[10px] border border-[#E8EBE6] bg-white p-1">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 ml-3 mt-3"><path d="M13.3333 4L6 11.3333L2.66667 8" stroke="#157347" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        <input 
                          aria-label={`${cat.name}, priporočilo`}
                          type="text"
                          placeholder={entryNamePlaceholder(cat, "explore")}
                          value={rec.name}
                          onChange={(e) => updateData(d => {
                            const newRecs = [...(d.recommendations || [])];
                            const idx = newRecs.findIndex(r => r.id === rec.id);
                            if (idx >= 0) newRecs[idx] = { ...rec, name: e.target.value };
                            return { ...d, recommendations: newRecs };
                          })}
                          className="min-w-0 flex-1 rounded-lg bg-white px-3 text-[16px] outline-none focus:ring-1 focus:ring-[#157347]"
                        />
                        <button 
                          onClick={() => updateData(d => ({
                            ...d, 
                            recommendations: d.recommendations?.filter(r => r.id !== rec.id)
                          }))}
                          aria-label={`Odstrani priporočilo ${rec.name}`}
                          className="flex w-10 items-center justify-center text-[#9AA39D] hover:text-[#DD9A2B] active:text-[#DD9A2B] transition-colors"
                        >
                          <X className="w-[18px] h-[18px]" strokeWidth={2.5} />
                        </button>
                      </div>
                    ))}
                    {transientRec && <div style={{ borderColor: "#9AA39D" }} className="flex min-h-[46px] items-start min-w-0 gap-2 rounded-[10px] border border-dashed bg-white p-1">
                      <input 
                         ref={(input) => registerInput(`recommendation:${cat.id}`, input)}
                        aria-label={`${cat.name}, novo priporočilo`}
                        type="text"
                        placeholder={entryNamePlaceholder(cat, "explore")}
                         value={transientRec.name}
                         onChange={(e) => setTransientRecs(prev => ({
                           ...prev,
                           [cat.id]: { id: prev[cat.id]?.id || generateId(), name: e.target.value },
                         }))}
                         className="min-w-0 flex-1 rounded-lg bg-white px-3 text-[16px] outline-none focus:ring-1 focus:ring-[#157347]"
                      />
                      <div className="w-10"></div>
                    </div>}
                    <button
                      type="button"
                      aria-label={`Dodaj kraj v kategorijo ${cat.name}`}
                      onClick={transientRec ? commitNewRecommendation : openNewRecommendation}
                      className="flex h-[46px] w-full items-center justify-center gap-2 rounded-[10px] border border-dashed border-[#C9D2CB] py-2 text-[14px] font-bold text-[#157347] transition-colors hover:bg-white"
                    >
                      <Plus className="h-4 w-4" />
                      Dodaj kraj
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Special Dogodki block */}
            <div className="border-t border-[#E8EBE6]/60 pt-8 mt-8">
               <h3 className="font-bold text-[18px] mb-2 text-[#121A14]">Dogodki</h3>
               <p className="text-sm text-[#66716A] mb-4">Ponavljajoči se in enkratni dogodki v okolici, ki bi jih gost ne smel zamuditi.</p>
               
               <div className="space-y-4">
                  {(formData.events || []).map((event, i) => (
                     <div key={event.id} className="min-w-0 bg-white border border-[#E8EBE6] rounded-[10px] p-4 md:p-3 flex flex-col md:flex-row gap-3">
                      <input 
                        aria-label={`Naziv dogodka ${i + 1}`}
                        type="text" 
                        placeholder={entryNamePlaceholder({ key: "events" }, "explore")}
                        value={event.name}
                        onChange={(e) => updateData(d => {
                          const newEvents = [...(d.events || [])];
                          newEvents[i] = { ...event, name: e.target.value };
                          return { ...d, events: newEvents };
                        })}
                         className="min-w-0 flex-1 bg-white border border-[#E8EBE6] rounded-[10px] px-4 py-2.5 text-[16px] outline-none focus:border-[#157347]"
                      />
                       <div className="grid grid-cols-2 sm:grid-cols-[minmax(0,9rem)_minmax(0,7rem)_3rem] gap-2 w-full min-w-0 md:w-auto">
                        <input 
                          aria-label={`Datum dogodka ${i + 1}`}
                          type="date"
                          value={event.date}
                          onChange={(e) => updateData(d => {
                            const newEvents = [...(d.events || [])];
                            newEvents[i] = { ...event, date: e.target.value };
                            return { ...d, events: newEvents };
                          })}
                           className="min-w-0 w-full bg-white border border-[#E8EBE6] rounded-[10px] px-2 sm:px-3 py-2.5 text-[15px] outline-none focus:border-[#157347]"
                        />
                        <input 
                          aria-label={`Ura dogodka ${i + 1}`}
                          type="time"
                          value={event.time}
                          onChange={(e) => updateData(d => {
                            const newEvents = [...(d.events || [])];
                            newEvents[i] = { ...event, time: e.target.value };
                            return { ...d, events: newEvents };
                          })}
                           className="min-w-0 w-full bg-white border border-[#E8EBE6] rounded-[10px] px-2 sm:px-3 py-2.5 text-[15px] outline-none focus:border-[#157347]"
                        />
                        <button 
                          onClick={() => updateData(d => ({
                            ...d,
                            events: d.events?.filter(ev => ev.id !== event.id),
                            deleteEventIds: canonicalRowIds.current.events.has(event.id)
                              ? [...new Set([...(d.deleteEventIds || []), event.id])]
                              : d.deleteEventIds,
                          }))}
                           aria-label={`Odstrani dogodek ${i + 1}`}
                           className="col-span-2 sm:col-span-1 w-full sm:w-12 min-h-11 flex items-center justify-center text-[#9AA39D] hover:text-[#DD9A2B] active:text-[#DD9A2B] transition-colors"
                        >
                          <X className="w-[18px] h-[18px]" strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  ))}
                   <div className="min-w-0 bg-white border border-[#E8EBE6] rounded-[10px] p-4 md:p-3 flex flex-col md:flex-row gap-3">
                    <input 
                      ref={(input) => registerInput("event", input)}
                      aria-label="Naziv novega dogodka"
                      type="text" 
                      placeholder={entryNamePlaceholder({ key: "events" }, "explore")}
                      value={transientEvents.name}
                      onChange={(e) => setTransientEvents(prev => ({ ...prev, name: e.target.value }))}
                       className="min-w-0 flex-1 bg-white border border-[#E8EBE6] rounded-[10px] px-4 py-2.5 text-[16px] outline-none focus:border-[#157347]"
                    />
                     <div className="grid grid-cols-2 gap-2 w-full min-w-0 sm:grid-cols-[minmax(0,9rem)_minmax(0,7rem)] md:w-auto">
                      <input 
                        aria-label="Datum novega dogodka"
                        type="date"
                        value={transientEvents.date}
                        onChange={(e) => setTransientEvents(prev => ({ ...prev, date: e.target.value }))}
                         className="min-w-0 w-full bg-white border border-[#E8EBE6] rounded-[10px] px-2 sm:px-3 py-2.5 text-[15px] outline-none focus:border-[#157347]"
                      />
                      <input 
                        aria-label="Ura novega dogodka"
                        type="time"
                        value={transientEvents.time}
                        onChange={(e) => setTransientEvents(prev => ({ ...prev, time: e.target.value }))}
                         className="min-w-0 w-full bg-white border border-[#E8EBE6] rounded-[10px] px-2 sm:px-3 py-2.5 text-[15px] outline-none focus:border-[#157347]"
                      />
                    </div>
                  </div>
               </div>
               <button
                 type="button"
                 aria-label="Dodaj dogodek"
                onClick={() => {
                  if (transientEvents.name.trim() || transientEvents.date.trim() || transientEvents.time.trim()) {
                     updateData(d => ({ ...d, events: [...(d.events || []), { id: transientEvents.id, name: transientEvents.name, date: transientEvents.date, time: transientEvents.time }] }));
                     setTransientEvents({ id: generateId(), name: "", date: "", time: "" });
                  }
                   focusInput("event");
                }}
                className="mt-4 flex items-center gap-2 text-[#157347] font-bold py-2 px-1 hover:opacity-80 transition-opacity"
              >
                <span aria-hidden="true">+ Dodaj …</span>
              </button>
            </div>

            <div className="border-t border-[#E8EBE6]/60 pt-8">
              <div className="mb-4">
                <h3 className="font-bold text-[18px] text-[#121A14]">Svoja kategorija</h3>
                <p className="text-sm text-[#66716A] mt-1">
                  Če med ponujenimi kategorijami ne najdete ustrezne, dodajte svojo in vanjo vpišite priporočila.
                </p>
              </div>

              <div className="space-y-3">
                {(formData.customCategories || []).map((category, categoryIndex) => {
                  const transientEntry = transientCustomEntries[category.id];
                  const openCustomEntry = () => {
                     focusInput(`custom-entry:${category.id}`);
                    setExpandedCustomCategoryIds(current => new Set(current).add(category.id));
                    setTransientCustomEntries(current => ({
                      ...current,
                      [category.id]: current[category.id] || { id: generateId(), name: "" },
                    }));
                  };
                  const commitCustomEntry = () => {
                     if (transientEntry?.name.trim()) {
                       updateData((data) => ({
                         ...data,
                         customCategories: (data.customCategories || []).map((item) =>
                           item.id === category.id
                             ? { ...item, entries: [...item.entries, { id: transientEntry.id, name: transientEntry.name }] }
                             : item,
                         ),
                       }));
                       setTransientCustomEntries((current) => ({
                         ...current,
                         [category.id]: { id: generateId(), name: "" },
                       }));
                     }
                     focusInput(`custom-entry:${category.id}`);
                  };

                  if (category.entries.length === 0 && !expandedCustomCategoryIds.has(category.id) && !transientEntry) {
                    return (
                      <EmptyCategoryRow
                        key={category.id}
                        id={`onboarding-custom-${category.id}`}
                        icon={<MapPin className="h-3.5 w-3.5" />}
                        name={category.name}
                        extraLabel={<span className="shrink-0 text-[10px] font-medium text-[#9AA39D]">gostiteljeva</span>}
                        addLabel="Dodaj kraj"
                         onEdit={() => {
                           focusInput(`custom-category:${category.id}`);
                           setExpandedCustomCategoryIds(current => new Set(current).add(category.id));
                         }}
                        onAdd={openCustomEntry}
                      />
                    );
                  }

                  return (
                    <div key={category.id} className="rounded-[10px] border border-[#D8DED9] bg-white p-4">
                      <div className="flex min-w-0 gap-2">
                        <input
                           ref={(input) => registerInput(`custom-category:${category.id}`, input)}
                          type="text"
                          aria-label={`Ime gostiteljeve kategorije ${categoryIndex + 1}`}
                          placeholder="Ime kategorije"
                          value={category.name}
                          onChange={(event) => updateData((data) => ({
                            ...data,
                            customCategories: (data.customCategories || []).map((item) =>
                              item.id === category.id ? { ...item, name: event.target.value } : item,
                            ),
                          }))}
                          className="min-w-0 flex-1 rounded-[10px] border border-[#E8EBE6] bg-white px-4 py-3 text-[16px] outline-none focus:border-[#157347]"
                        />
                        <button
                          type="button"
                          aria-label={`Odstrani gostiteljevo kategorijo ${categoryIndex + 1}`}
                          onClick={() => {
                            updateData((data) => ({
                              ...data,
                              customCategories: (data.customCategories || []).filter((item) => item.id !== category.id),
                            }));
                            setTransientCustomEntries((current) => {
                              const next = { ...current };
                              delete next[category.id];
                              return next;
                            });
                          }}
                          className="w-12 shrink-0 text-[#9AA39D] hover:text-[#DD9A2B] active:text-[#DD9A2B] transition-colors"
                        >
                          <X className="w-[18px] h-[18px]" strokeWidth={2.5} />
                        </button>
                      </div>

                      <div className="mt-4 space-y-1.5">
                        {(category.entries || []).map((entry, entryIndex) => (
                          <div key={entry.id} className="flex min-w-0 gap-2">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 ml-3 mt-3"><path d="M13.3333 4L6 11.3333L2.66667 8" stroke="#157347" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              <input
                              type="text"
                              aria-label={`${category.name || "Gostiteljeva kategorija"}, priporočilo ${entryIndex + 1}`}
                              placeholder={entryNamePlaceholder(undefined, "explore")}
                              value={entry.name}
                              onChange={(event) => updateData((data) => ({
                                ...data,
                                customCategories: (data.customCategories || []).map((item) =>
                                  item.id === category.id
                                    ? {
                                        ...item,
                                        entries: item.entries.map((currentEntry) =>
                                          currentEntry.id === entry.id
                                            ? { ...currentEntry, name: event.target.value }
                                            : currentEntry,
                                        ),
                                      }
                                    : item,
                                ),
                              }))}
                              className="min-w-0 flex-1 rounded-[10px] border border-[#E8EBE6] bg-white px-4 py-3 text-[16px] outline-none focus:border-[#157347]"
                            />
                            <button
                              type="button"
                              aria-label={`Odstrani priporočilo ${entryIndex + 1} iz kategorije ${category.name}`}
                              onClick={() => updateData((data) => ({
                                ...data,
                                customCategories: (data.customCategories || []).map((item) =>
                                  item.id === category.id
                                    ? { ...item, entries: item.entries.filter((currentEntry) => currentEntry.id !== entry.id) }
                                    : item,
                                ),
                              }))}
                              className="w-12 shrink-0 text-[#9AA39D] hover:text-[#DD9A2B] active:text-[#DD9A2B] transition-colors"
                            >
                              <X className="w-[18px] h-[18px]" strokeWidth={2.5} />
                            </button>
                          </div>
                        ))}

                        {transientEntry && <div className="flex min-w-0 gap-2">
                          <input
                             ref={(input) => registerInput(`custom-entry:${category.id}`, input)}
                            type="text"
                            aria-label={`Novo priporočilo za kategorijo ${category.name}`}
                            placeholder={entryNamePlaceholder(undefined, "explore")}
                            value={transientEntry.name}
                            onChange={(event) => setTransientCustomEntries((current) => ({
                              ...current,
                              [category.id]: {
                                id: current[category.id]?.id || generateId(),
                                name: event.target.value,
                              },
                            }))}
                            className="min-w-0 flex-1 rounded-[10px] border border-[#E8EBE6] bg-white px-4 py-3 text-[16px] outline-none focus:border-[#157347]"
                          />
                          <div className="w-12 shrink-0" />
                        </div>}
                        <button
                          type="button"
                          aria-label={`Dodaj kraj v gostiteljevo kategorijo ${category.name}`}
                          onClick={transientEntry ? commitCustomEntry : openCustomEntry}
                          className="flex h-[46px] w-full items-center justify-center gap-2 rounded-[10px] border border-dashed border-[#C9D2CB] py-2 text-[14px] font-bold text-[#157347] transition-colors hover:bg-[#F4F6F2]"
                        >
                          <Plus className="h-4 w-4" />
                          Dodaj kraj
                        </button>
                      </div>
                    </div>
                  );
                })}

                <div>
                  <div className="flex min-w-0 gap-2">
                    <input
                       ref={(input) => registerInput("custom-category:new", input)}
                      type="text"
                      aria-label="Ime nove gostiteljeve kategorije"
                      placeholder="Ime kategorije"
                      value={transientCustomCategory.name}
                      onChange={(event) => setTransientCustomCategory((current) => ({
                        ...current,
                        name: event.target.value,
                      }))}
                      className="min-w-0 flex-1 rounded-[10px] border border-[#E8EBE6] bg-white px-4 py-3 text-[16px] outline-none focus:border-[#157347]"
                    />
                    <div className="w-12 shrink-0" />
                  </div>
                  <button
                    type="button"
                    aria-label="Dodaj gostiteljevo kategorijo"
                    onClick={() => {
                       if (transientCustomCategory.name.trim()) {
                         updateData((data) => ({
                           ...data,
                           customCategories: [
                             ...(data.customCategories || []),
                             { id: transientCustomCategory.id, name: transientCustomCategory.name, entries: [] },
                           ],
                         }));
                         setTransientCustomCategory({ id: generateId(), name: "" });
                       }
                       focusInput("custom-category:new");
                    }}
                     className="mt-3 py-2 px-1 font-bold text-[#157347] hover:opacity-80"
                  >
                    <span aria-hidden="true">+ Dodaj …</span>
                  </button>
                </div>
              </div>
            </div>

          </div>
        </section>


        {/* SECTION 7 */}
        <section className="bg-[#F4F6F2] border border-[#E8EBE6] rounded-[16px] p-5 md:p-8 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-full bg-[#157347] text-white flex items-center justify-center font-bold text-lg shrink-0">7</div>
            <div>
              <h2 className="text-xl font-bold">Splošne fotografije</h2>
              <p className="text-sm text-[#66716A] mt-1">
                Fotografije posameznega apartmaja ali prostora dodajte kar pri njem zgoraj. Sem odložite splošne posnetke (okolica, zunanjost).
              </p>
            </div>
          </div>

          {formData.hero?.url ? (
            <figure className="mb-7 overflow-hidden rounded-[10px] border border-[#E8EBE6] bg-white">
              <img
                src={formData.hero.url}
                alt={formData.hero.alt || "Naslovna fotografija nastanitve"}
                className="aspect-[16/7] w-full object-cover"
              />
              <figcaption className="px-4 py-3 text-sm text-[#66716A]">
                Trenutna naslovna fotografija v osnutku
              </figcaption>
            </figure>
          ) : null}

          {(formData.media || []).some((media) => media.itemId === null && media.kind === "video") ? (
            <div className="mb-7 border-b border-[#E8EBE6] pb-7">
              <h3 className="mb-1 text-[16px] font-bold">Videi</h3>
              <p className="mb-4 text-sm text-[#66716A]">
                Obstoječe videe urejate v istem osnutku kot operater.
              </p>
              <div className="space-y-3">
                {(formData.media || []).filter((media) => media.itemId === null && media.kind === "video").map((video, index) => (
                  <div key={video.id} className="grid gap-3 rounded-[10px] border border-[#E8EBE6] bg-white p-4 md:grid-cols-2">
                    <div>
                      <label htmlFor={`video-alt-${video.id}`} className="mb-1.5 block text-[13px] font-[700] text-[#66716A] uppercase">
                        Naziv videa {index + 1}
                      </label>
                      <input
                        id={`video-alt-${video.id}`}
                        type="text"
                        value={video.alt}
                        onChange={(event) => {
                          mediaDirty.current = true;
                          updateData((data) => ({
                            ...data,
                            media: (data.media || []).map((current) =>
                              current.id === video.id ? { ...current, alt: event.target.value } : current,
                            ),
                          }));
                        }}
                        className="w-full rounded-[10px] border border-[#E8EBE6] bg-white px-4 py-3 text-[16px] outline-none focus:border-[#157347]"
                      />
                    </div>
                    <div>
                      <label htmlFor={`video-url-${video.id}`} className="mb-1.5 block text-[13px] font-[700] text-[#66716A] uppercase">
                        Povezava do videa
                      </label>
                      <input
                        id={`video-url-${video.id}`}
                        type="url"
                        value={video.url}
                        onChange={(event) => {
                          mediaDirty.current = true;
                          updateData((data) => ({
                            ...data,
                            media: (data.media || []).map((current) =>
                              current.id === video.id ? { ...current, url: event.target.value } : current,
                            ),
                          }));
                        }}
                        className="w-full rounded-[10px] border border-[#E8EBE6] bg-white px-4 py-3 text-[16px] outline-none focus:border-[#157347]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <PhotoUploader
            photos={[
              ...(formData.media || [])
                .filter((media) => media.itemId === null && media.kind === "image")
                .map((media) => ({
                  id: `media-${media.id}`,
                  mediaId: media.id,
                  fileName: media.alt || "Fotografija",
                  contentType: "image/*",
                  size: 0,
                  status: "ready" as const,
                  previewUrl: media.url,
                })),
              ...(onboardingData?.photos || []).filter((photo) => photo.status === "uploading"),
            ]}
            onRemoveCanonical={(mediaId) => {
              mediaDirty.current = true;
              removedMediaIds.current.add(mediaId);
              updateData((data) => ({
                ...data,
                media: (data.media || []).filter((media) => media.id !== mediaId),
                deleteMediaIds: [...new Set([...(data.deleteMediaIds || []), mediaId])],
              }));
            }}
            onBlockingChange={setUploadsBlocking}
          />

        </section>

      </main>

      {/* Floating Action Bar */}
      <div
        ref={footerRef}
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E8EBE6] px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:p-5 shadow-[0_-4px_24px_rgba(0,0,0,0.04)] z-50"
      >
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm font-semibold flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start">
            {submitOnboarding.error ? (
              <span className="text-amber-600">{submitOnboarding.error.message}</span>
            ) : isSaving ? (
              <span className="text-[#66716A] flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Shranjevanje...
              </span>
            ) : saveState === "dirty" ? (
              <span className="text-amber-700">Neshranjene spremembe</span>
            ) : saveState === "error" || saveState === "conflict" ? (
              <span className="text-amber-600 flex flex-col items-start">
                <span>{saveState === "conflict" ? "Spor sprememb — podatkov nismo prepisali." : saveError}</span>
                <button type="button" className="underline py-1" onClick={() => saveState === "conflict" ? window.location.reload() : void handleSave()}>
                  {saveState === "conflict" ? "Osveži stran in preveri spremembe" : "Poskusi znova"}
                </button>
              </span>
            ) : (
              <span className="text-[#157347] flex items-center gap-2 opacity-80">
                <CheckCircle2 className="w-4 h-4" /> Osnutek shranjen
              </span>
            )}
          </div>
          
          <div className="flex gap-3 w-full sm:w-auto">
            <button 
              onClick={handleSave}
              disabled={isSaving || submitOnboarding.isPending || saveState === "conflict"}
              className="flex-1 sm:flex-none bg-[#F4F6F2] text-[#121A14] border border-[#E8EBE6] px-5 py-3 rounded-full font-bold text-[15px] hover:bg-[#E8EBE6] transition-colors whitespace-nowrap"
            >
              Shrani osnutek
            </button>
            <button 
              onClick={handleSubmit}
              disabled={submitOnboarding.isPending || isSaving || uploadsBlocking || entryUploadsBlocking || saveState === "conflict"}
              className="flex-1 sm:flex-none bg-[#157347] text-white px-7 py-3 rounded-full font-bold text-[15px] hover:bg-[#0f5835] transition-colors whitespace-nowrap shadow-md flex items-center justify-center gap-2"
            >
              {submitOnboarding.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {uploadsBlocking || entryUploadsBlocking ? "Počakajte na fotografije" : "Potrdi in oddaj"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhotoUploader({
  photos,
  onRemoveCanonical,
  onBlockingChange,
}: {
  photos: import("@/hooks/use-host-onboarding").HostOnboardingPhoto[];
  onRemoveCanonical: (mediaId: string) => void;
  onBlockingChange: (blocking: boolean) => void;
}) {
  const uploadPhotoUrl = useUploadPhotoUrl();
  const completePhoto = useCompletePhoto();
  const deletePhoto = useDeletePhoto();
  type UploadEntry = { id: string; file: File; status: "uploading" | "failed"; error?: string; photoId?: string };
  const [uploadingFiles, setUploadingFiles] = useState<UploadEntry[]>([]);

  useEffect(() => {
    onBlockingChange(
      uploadingFiles.length > 0 ||
      photos.some((photo) => photo.status === "uploading"),
    );
  }, [onBlockingChange, photos, uploadingFiles]);

  const upload = async (entry: UploadEntry) => {
    setUploadingFiles((current) => current.map((item) =>
      item.id === entry.id ? { ...item, status: "uploading", error: undefined } : item,
    ));
    try {
      if (entry.photoId) {
        await deletePhoto.mutateAsync(entry.photoId).catch(() => undefined);
      }
      const { uploadUrl, photoId } = await uploadPhotoUrl.mutateAsync({
        fileName: entry.file.name,
        contentType: entry.file.type,
        size: entry.file.size,
      });
      setUploadingFiles((current) => current.map((item) => item.id === entry.id ? { ...item, photoId } : item));
      const response = await fetch(uploadUrl, {
        method: "PUT",
        body: entry.file,
        headers: { "Content-Type": entry.file.type },
      });
      if (!response.ok) throw new Error("Prenos fotografije ni uspel.");
      await completePhoto.mutateAsync(photoId);
      setUploadingFiles((current) => current.filter((item) => item.id !== entry.id));
    } catch (reason) {
      setUploadingFiles((current) => current.map((item) =>
        item.id === entry.id
          ? { ...item, status: "failed", error: reason instanceof Error ? reason.message : "Nalaganje ni uspelo." }
          : item,
      ));
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    
    // limit check
    if (photos.length + uploadingFiles.length + files.length > 20) {
      alert("Dodate lahko največ 20 fotografij.");
      return;
    }

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const entry: UploadEntry = { id: generateId(), file, status: "uploading" };
      setUploadingFiles((current) => [...current, entry]);
      void upload(entry);
    });
  };

  return (
    <div>
      <div 
        className="border-2 border-dashed border-[#157347]/30 rounded-2xl p-8 text-center bg-white cursor-pointer hover:bg-[#F4F6F2] transition-colors flex flex-col items-center justify-center group"
        onClick={() => document.getElementById("photo-upload")?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
      >
        <div className="w-14 h-14 rounded-full bg-[#F4F6F2] text-[#157347] flex items-center justify-center mb-4 group-hover:bg-[#E8EBE6]">
          <UploadCloud className="w-6 h-6" />
        </div>
        <p className="font-bold text-[#121A14] text-lg">Kliknite ali povlecite slike sem</p>
        <p className="text-sm text-[#66716A] mt-2">JPG, PNG ali WebP (do 10MB posamezno)</p>
        <input 
          id="photo-upload"
          type="file" 
          multiple 
          accept="image/*" 
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {(photos.length > 0 || uploadingFiles.length > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-6">
          {photos.map(p => (
            <div key={p.id} className="relative aspect-square rounded-[10px] bg-gray-200 overflow-hidden group">
              {p.status === "ready" || p.status === "submitted" ? (
                <img 
                   src={p.previewUrl || `/api/admin/host/onboarding/photos/${p.id}`}
                  alt={p.fileName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 text-gray-500 text-xs p-2 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mb-2" />
                  Obdelava...
                </div>
              )}
              {p.status !== "submitted" && (
                <button 
                  onClick={() => p.mediaId ? onRemoveCanonical(p.mediaId) : deletePhoto.mutate(p.id)}
                   aria-label={`Odstrani fotografijo ${p.fileName}`}
                   className="absolute top-2 right-2 w-10 h-10 bg-white/90 text-[#66716A] hover:text-[#121A14] rounded-full flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shadow-sm"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
           {uploadingFiles.map((entry) => (
             <div key={entry.id} className="min-h-36 rounded-[10px] border border-[#E8EBE6] bg-white flex flex-col items-center justify-center p-3 text-center">
                {entry.status === "uploading" ? <Loader2 className="w-6 h-6 animate-spin text-[#157347] mb-2" /> : <X className="w-6 h-6 text-amber-600 mb-2" />}
                <span className="text-xs text-[#66716A] break-all px-2">{entry.file.name}</span>
                {entry.error && <span className="text-xs text-amber-600 mt-1">{entry.error}</span>}
                {entry.status === "failed" && (
                  <div className="flex gap-2 mt-2">
                    <button type="button" onClick={() => void upload(entry)} className="min-h-10 px-3 rounded-lg bg-[#157347] text-white text-xs font-bold">Poskusi znova</button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (entry.photoId) await deletePhoto.mutateAsync(entry.photoId).catch(() => undefined);
                        setUploadingFiles((current) => current.filter((item) => item.id !== entry.id));
                      }}
                      className="min-h-10 px-3 rounded-lg border text-xs font-bold"
                    >
                      Odstrani
                    </button>
                  </div>
                )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
