import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Loader2, Plus, Trash2, CheckCircle2, UploadCloud, X, LogOut } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetHostOnboarding,
  usePatchHostOnboarding,
  useSaveHostOnboarding,
  useSubmitHostOnboarding,
  HostOnboardingData,
  useUploadPhotoUrl,
  useCompletePhoto,
  useDeletePhoto
} from "@/hooks/use-host-onboarding";
import { useHostSession } from "@/hooks/use-host-session";

const generateId = () => crypto.randomUUID();
type SaveState = "saved" | "dirty" | "saving" | "error" | "conflict";

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
  const lastSaved = useRef<string>("");
  const latestData = useRef<HostOnboardingData>({});
  const latestPayload = useRef<HostOnboardingData>({});
  const revision = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const activeOperation = useRef<Promise<void>>(Promise.resolve());
  const conflictBlocked = useRef(false);
  const queuedSnapshot = useRef("");
  const patchTimeout = useRef<number | null>(null);
  const mounted = useRef(true);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState("");
  const [uploadsBlocking, setUploadsBlocking] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState("");
  const footerRef = useRef<HTMLDivElement>(null);
  const [footerHeight, setFooterHeight] = useState(160);

  // Initialize form state
  useEffect(() => {
    if (onboardingData && !initialized.current && onboardingData.status === "draft") {
      setFormData(onboardingData.data || {});
      lastSaved.current = JSON.stringify(onboardingData.data || {});
      latestData.current = onboardingData.data || {};
      revision.current = onboardingData.revision;
      initialized.current = true;
    }
  }, [onboardingData]);

  const [transientRecs, setTransientRecs] = useState<Record<string, { id: string; name: string }>>({});
  const [transientEvents, setTransientEvents] = useState({id: generateId(), name: "", date: "", time: ""});
  const [transientContact, setTransientContact] = useState({id: generateId(), name: "", phone: ""});
  const [transientOffer, setTransientOffer] = useState({id: generateId(), name: "", price: ""});
  const [loggingOut, setLoggingOut] = useState(false);

  const cleanData = useCallback((data: HostOnboardingData): HostOnboardingData => {
    const finalData = {
      ...data,
      contacts: data.contacts?.filter(c => c.name.trim() || c.phone.trim()) || [],
      offers: data.offers?.filter(o => o.name.trim() || o.price.trim()) || [],
      recommendations: data.recommendations?.filter(r => r.name.trim()) || [],
      events: data.events?.filter(e => e.name.trim() || e.date.trim() || e.time.trim()) || [],
    };
    
    if (transientContact.name.trim() || transientContact.phone.trim()) {
      finalData.contacts.push({ id: transientContact.id, name: transientContact.name, phone: transientContact.phone });
    }
    if (transientOffer.name.trim() || transientOffer.price.trim()) {
      finalData.offers.push({ id: transientOffer.id, name: transientOffer.name, price: transientOffer.price });
    }
    if (transientEvents.name.trim() || transientEvents.date.trim() || transientEvents.time.trim()) {
      finalData.events.push({ id: transientEvents.id, name: transientEvents.name, date: transientEvents.date, time: transientEvents.time });
    }
    Object.entries(transientRecs).forEach(([catId, row]) => {
      if (row.name.trim()) {
        finalData.recommendations!.push({ id: row.id, categoryId: catId, name: row.name });
      }
    });

    return finalData;
  }, [transientContact, transientEvents, transientOffer, transientRecs]);

  const enqueueSave = useCallback((data: HostOnboardingData, explicit = false) => {
    const snapshot = JSON.stringify(data);
    if (conflictBlocked.current) return Promise.reject(new Error("Osnutek je spremenjen v drugem zavihku."));
    if (snapshot === lastSaved.current) return queue.current;
    if (snapshot === queuedSnapshot.current) return activeOperation.current;
    queuedSnapshot.current = snapshot;
    setSaveState("saving");
    setSaveError("");
    const operation = queue.current.then(async () => {
      const result = explicit
        ? await saveOnboarding.mutateAsync({ data, revision: revision.current })
        : await patchOnboarding.mutateAsync({ data, revision: revision.current });
      revision.current = result.revision;
      lastSaved.current = snapshot;
      if (mounted.current) setSaveState(JSON.stringify(latestPayload.current) === snapshot ? "saved" : "dirty");
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
  }, [cleanData, patchOnboarding, saveOnboarding]);
  const enqueueSaveRef = useRef(enqueueSave);
  enqueueSaveRef.current = enqueueSave;

  const flush = useCallback(async (explicit = false) => {
    if (patchTimeout.current !== null) window.clearTimeout(patchTimeout.current);
    patchTimeout.current = null;
    const data = cleanData(latestData.current);
    await enqueueSave(data, explicit);
    await queue.current;
  }, [cleanData, enqueueSave]);

  // Update form data and trigger autosave
  const updateData = (updater: (prev: HostOnboardingData) => HostOnboardingData) => {
    setFormData(prev => {
      const next = updater(prev);
      latestData.current = next;
      return next;
    });
  };

  useEffect(() => {
    if (!initialized.current) return;
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
      void enqueueSave(cleanData(latestData.current)).catch(() => undefined);
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
        void enqueueSaveRef.current(latestPayload.current).catch(() => undefined);
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
    if (uploadsBlocking) return;
    try {
      await flush();
      const result = await submitOnboarding.mutateAsync({
        round: onboardingData?.round || 1,
        data: cleanData(latestData.current),
        revision: revision.current,
      });
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

  return (
    <div className="min-h-[100dvh] bg-white text-[#121A14]" style={{ fontFamily: 'Archivo, sans-serif' }}>
      <header className="px-6 md:px-10 pt-6 pb-6">
        <div className="flex justify-end max-w-3xl mx-auto mb-4">
          <button 
            onClick={handleLogout}
            disabled={loggingOut || isSaving}
            className="flex items-center gap-2 text-sm font-semibold text-[#66716A] hover:text-[#121A14] transition-colors"
          >
            {loggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            Odjava
          </button>
        </div>
        <div className="flex flex-col items-start max-w-3xl mx-auto">
          <div data-testid="host-onboarding-brand" className="h-10 mb-12 flex items-center gap-3">
            <img src="/brand/smart360-znak-40.png" alt="" className="h-10 w-10 object-contain" />
            <img src="/brand/logo-smart360-moder.png" alt="Smart360" className="h-10 w-auto object-contain" />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-[#121A14] tracking-tight leading-tight">
            Dobrodošli, {onboardingData?.data.accommodationName || "gostitelj"}
          </h1>
          <p className="mt-4 text-[#66716A] text-lg max-w-xl leading-relaxed">
            Izpolnite spodnje podatke, da pripravimo vaš vodnik. Kar ne veste takoj, lahko pustite prazno.
          </p>
        </div>
      </header>

      <main
        className="px-4 md:px-8 max-w-3xl mx-auto space-y-8"
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
              <label htmlFor="accommodationName" className="block text-sm font-semibold text-[#3A443C] mb-1.5">Naziv nastanitve (kot naj ga vidijo gostje)</label>
              <input 
                id="accommodationName"
                type="text" 
                value={formData.accommodationName || ""}
                onChange={(e) => updateData(d => ({ ...d, accommodationName: e.target.value }))}
                className="w-full bg-white border border-[#E8EBE6] rounded-xl px-4 py-3 text-[16px] outline-none focus:border-[#157347] focus:ring-1 focus:ring-[#157347] transition-all"
              />
            </div>
            
            <div>
              <label htmlFor="address" className="block text-sm font-semibold text-[#3A443C] mb-1.5">Naslov nastanitve</label>
              <input 
                id="address"
                type="text" 
                value={formData.address || ""}
                onChange={(e) => updateData(d => ({ ...d, address: e.target.value }))}
                className="w-full bg-white border border-[#E8EBE6] rounded-xl px-4 py-3 text-[16px] outline-none focus:border-[#157347] transition-all"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label htmlFor="guestPhone" className="block text-sm font-semibold text-[#3A443C] mb-1.5">Telefon za goste</label>
                <input 
                  id="guestPhone"
                  type="text" 
                  value={formData.guestPhone || ""}
                  onChange={(e) => updateData(d => ({ ...d, guestPhone: e.target.value }))}
                  className="w-full bg-white border border-[#E8EBE6] rounded-xl px-4 py-3 text-[16px] outline-none focus:border-[#157347] transition-all"
                />
              </div>
              <div>
                <label htmlFor="guestEmail" className="block text-sm font-semibold text-[#3A443C] mb-1.5">E-pošta za goste</label>
                <input 
                  id="guestEmail"
                  type="email" 
                  value={formData.guestEmail || ""}
                  onChange={(e) => updateData(d => ({ ...d, guestEmail: e.target.value }))}
                  className="w-full bg-white border border-[#E8EBE6] rounded-xl px-4 py-3 text-[16px] outline-none focus:border-[#157347] transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="website" className="block text-sm font-semibold text-[#3A443C] mb-1.5">Spletna stran (neobvezno)</label>
              <input 
                id="website"
                type="url" 
                value={formData.website || ""}
                onChange={(e) => updateData(d => ({ ...d, website: e.target.value }))}
                className="w-full bg-white border border-[#E8EBE6] rounded-xl px-4 py-3 text-[16px] outline-none focus:border-[#157347] transition-all"
                placeholder="https://"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="checkInFrom" className="block text-sm font-semibold text-[#3A443C] mb-1.5">Prijava od</label>
                <input 
                  id="checkInFrom"
                  type="time" 
                  value={formData.checkInFrom || ""}
                  onChange={(e) => updateData(d => ({ ...d, checkInFrom: e.target.value }))}
                  className="w-full bg-white border border-[#E8EBE6] rounded-xl px-4 py-3 text-[16px] outline-none focus:border-[#157347] transition-all"
                />
              </div>
              <div>
                <label htmlFor="checkOutUntil" className="block text-sm font-semibold text-[#3A443C] mb-1.5">Odjava do</label>
                <input 
                  id="checkOutUntil"
                  type="time" 
                  value={formData.checkOutUntil || ""}
                  onChange={(e) => updateData(d => ({ ...d, checkOutUntil: e.target.value }))}
                  className="w-full bg-white border border-[#E8EBE6] rounded-xl px-4 py-3 text-[16px] outline-none focus:border-[#157347] transition-all"
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
                      className="min-w-0 flex-1 bg-white border border-[#E8EBE6] rounded-xl px-4 py-3 text-[16px] outline-none focus:border-[#157347] transition-all"
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
                        className="min-w-0 flex-1 md:w-48 bg-white border border-[#E8EBE6] rounded-xl px-4 py-3 text-[16px] outline-none focus:border-[#157347] transition-all"
                      />
                      <button 
                        onClick={() => updateData(d => ({
                          ...d, 
                          contacts: d.contacts?.filter(c => c.id !== contact.id)
                        }))}
                        className="w-12 flex items-center justify-center bg-white border border-[#E8EBE6] rounded-xl text-red-500 hover:bg-red-50"
                        aria-label="Odstrani"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex flex-col md:flex-row gap-3">
                  <input 
                    aria-label="Ime nove kontaktne osebe"
                    type="text" 
                    placeholder="Ime in priimek"
                    value={transientContact.name}
                    onChange={(e) => setTransientContact(prev => ({ ...prev, name: e.target.value }))}
                    className="min-w-0 flex-1 bg-white border border-[#E8EBE6] rounded-xl px-4 py-3 text-[16px] outline-none focus:border-[#157347] transition-all"
                  />
                  <div className="flex min-w-0 gap-2">
                    <input 
                      aria-label="Telefon nove kontaktne osebe"
                      type="text" 
                      placeholder="Telefon"
                      value={transientContact.phone}
                      onChange={(e) => setTransientContact(prev => ({ ...prev, phone: e.target.value }))}
                      className="min-w-0 flex-1 md:w-48 bg-white border border-[#E8EBE6] rounded-xl px-4 py-3 text-[16px] outline-none focus:border-[#157347] transition-all"
                    />
                    <div className="w-12"></div>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => {
                  if (transientContact.name.trim() || transientContact.phone.trim()) {
                     updateData(d => ({ ...d, contacts: [...(d.contacts || []), { id: transientContact.id, name: transientContact.name, phone: transientContact.phone }] }));
                     setTransientContact({ id: generateId(), name: "", phone: "" });
                  }
                }}
                className="mt-4 flex items-center gap-2 text-[#157347] font-bold py-2 px-1 hover:opacity-80 transition-opacity"
              >
                <Plus className="w-5 h-5" /> Dodaj osebo
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
              <label htmlFor="wifiName" className="block text-sm font-semibold text-[#3A443C] mb-1.5">Ime omrežja</label>
              <input 
                id="wifiName"
                type="text" 
                value={formData.wifiName || ""}
                onChange={(e) => updateData(d => ({ ...d, wifiName: e.target.value }))}
                className="w-full bg-white border border-[#E8EBE6] rounded-xl px-4 py-3 text-[16px] outline-none focus:border-[#157347] transition-all"
              />
            </div>
            <div>
              <label htmlFor="wifiPassword" className="block text-sm font-semibold text-[#3A443C] mb-1.5">Geslo</label>
              <input 
                id="wifiPassword"
                type="text" 
                value={formData.wifiPassword || ""}
                onChange={(e) => updateData(d => ({ ...d, wifiPassword: e.target.value }))}
                className="w-full bg-white border border-[#E8EBE6] rounded-xl px-4 py-3 text-[16px] outline-none focus:border-[#157347] transition-all"
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
            <textarea 
              aria-label="Hišni red, parkiranje in posebnosti"
              value={formData.houseRulesParking || ""}
              onChange={(e) => updateData(d => ({ ...d, houseRulesParking: e.target.value }))}
              rows={6}
              className="w-full bg-white border border-[#E8EBE6] rounded-xl px-4 py-3 text-[16px] outline-none focus:border-[#157347] transition-all resize-y"
            ></textarea>
          </div>
        </section>

        {/* SECTION 4 */}
        <section className="bg-[#F4F6F2] border border-[#E8EBE6] rounded-[16px] p-5 md:p-8 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-full bg-[#157347] text-white flex items-center justify-center font-bold text-lg shrink-0">4</div>
            <h2 className="text-xl font-bold">Vaša ponudba</h2>
          </div>
          <div className="space-y-3">
            {(formData.offers || []).map((offer, i) => (
              <div key={offer.id} className="flex flex-col md:flex-row gap-3">
                <input 
                  aria-label={`Naziv ponudbe ${i + 1}`}
                  type="text" 
                  placeholder="Naziv ponudbe (npr. Zajtrk)"
                  value={offer.name}
                  onChange={(e) => updateData(d => {
                    const newOffers = [...(d.offers || [])];
                    newOffers[i] = { ...offer, name: e.target.value };
                    return { ...d, offers: newOffers };
                  })}
                  className="min-w-0 flex-1 bg-white border border-[#E8EBE6] rounded-xl px-4 py-3 text-[16px] outline-none focus:border-[#157347] transition-all"
                />
                <div className="flex min-w-0 gap-2">
                  <input 
                    aria-label={`Cena ponudbe ${i + 1}`}
                    type="text" 
                    placeholder="Cena (npr. 10 €)"
                    value={offer.price}
                    onChange={(e) => updateData(d => {
                      const newOffers = [...(d.offers || [])];
                      newOffers[i] = { ...offer, price: e.target.value };
                      return { ...d, offers: newOffers };
                    })}
                    className="min-w-0 flex-1 md:w-32 bg-white border border-[#E8EBE6] rounded-xl px-4 py-3 text-[16px] outline-none focus:border-[#157347] transition-all"
                  />
                  <button 
                    onClick={() => updateData(d => ({
                      ...d, 
                      offers: d.offers?.filter(o => o.id !== offer.id)
                    }))}
                    className="w-12 flex items-center justify-center bg-white border border-[#E8EBE6] rounded-xl text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
            <div className="flex flex-col md:flex-row gap-3">
              <input 
                aria-label="Naziv nove ponudbe"
                type="text" 
                placeholder="Naziv ponudbe (npr. Zajtrk)"
                value={transientOffer.name}
                onChange={(e) => setTransientOffer(prev => ({ ...prev, name: e.target.value }))}
                className="min-w-0 flex-1 bg-white border border-[#E8EBE6] rounded-xl px-4 py-3 text-[16px] outline-none focus:border-[#157347] transition-all"
              />
              <div className="flex min-w-0 gap-2">
                <input 
                  aria-label="Cena nove ponudbe"
                  type="text" 
                  placeholder="Cena (npr. 10 €)"
                  value={transientOffer.price}
                  onChange={(e) => setTransientOffer(prev => ({ ...prev, price: e.target.value }))}
                  className="min-w-0 flex-1 md:w-32 bg-white border border-[#E8EBE6] rounded-xl px-4 py-3 text-[16px] outline-none focus:border-[#157347] transition-all"
                />
                <div className="w-12"></div>
              </div>
            </div>
          </div>
          <button 
            onClick={() => {
              if (transientOffer.name.trim() || transientOffer.price.trim()) {
                 updateData(d => ({ ...d, offers: [...(d.offers || []), { id: transientOffer.id, name: transientOffer.name, price: transientOffer.price }] }));
                 setTransientOffer({ id: generateId(), name: "", price: "" });
              }
            }}
            className="mt-4 flex items-center gap-2 text-[#157347] font-bold py-2 px-1 hover:opacity-80 transition-opacity"
          >
            <Plus className="w-5 h-5" /> Dodaj še eno
          </button>
        </section>

        {/* SECTION 5 - Okolica (Emphasized) */}
        <section data-testid="host-onboarding-explore" className="bg-[#F4F6F2] border-[2px] rounded-[16px] p-5 md:p-8 shadow-sm" style={{ borderColor: "#157347" }}>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-full bg-[#157347] text-white flex items-center justify-center font-bold text-lg shrink-0">5</div>
            <div>
              <h2 className="text-xl font-bold">Kaj priporočate v okolici</h2>
              <p className="text-sm text-[#66716A] mt-1">Vpišite samo ime kraja ali doživetja. Zemljevid, razdaljo, opis in fotografije dodamo mi. Kjer nimate priporočila, pustite prazno.</p>
            </div>
          </div>
          
          <div className="space-y-8">
            {onboardingData?.categories.map((cat) => {
              const catRecs = (formData.recommendations || []).filter(r => r.categoryId === cat.id);
              
              return (
                <div key={cat.id} className="border-t border-[#E8EBE6]/60 pt-6 first:border-0 first:pt-0">
                  <h3 className="font-bold text-[17px] mb-3 text-[#121A14]">{cat.name}</h3>
                  <div className="space-y-3">
                    {catRecs.map((rec) => (
                      <div key={rec.id} className="flex min-w-0 gap-2">
                        <input 
                          aria-label={`${cat.name}, priporočilo`}
                          type="text"
                          placeholder="Ime lokacije..."
                          value={rec.name}
                          onChange={(e) => updateData(d => {
                            const newRecs = [...(d.recommendations || [])];
                            const idx = newRecs.findIndex(r => r.id === rec.id);
                            if (idx >= 0) newRecs[idx] = { ...rec, name: e.target.value };
                            return { ...d, recommendations: newRecs };
                          })}
                          className="min-w-0 flex-1 bg-white border border-[#E8EBE6] rounded-xl px-4 py-3 text-[16px] outline-none focus:border-[#157347]"
                        />
                        <button 
                          onClick={() => updateData(d => ({
                            ...d, 
                            recommendations: d.recommendations?.filter(r => r.id !== rec.id)
                          }))}
                          className="w-12 flex items-center justify-center bg-white border border-[#E8EBE6] rounded-xl text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                    <div className="flex min-w-0 gap-2">
                      <input 
                        aria-label={`${cat.name}, novo priporočilo`}
                        type="text"
                        placeholder="Ime lokacije..."
                         value={transientRecs[cat.id]?.name || ""}
                         onChange={(e) => setTransientRecs(prev => ({
                           ...prev,
                           [cat.id]: { id: prev[cat.id]?.id || generateId(), name: e.target.value },
                         }))}
                        className="min-w-0 flex-1 bg-white border border-[#E8EBE6] rounded-xl px-4 py-3 text-[16px] outline-none focus:border-[#157347]"
                      />
                      <div className="w-12"></div>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                       if (transientRecs[cat.id]?.name.trim()) {
                         const row = transientRecs[cat.id];
                         updateData(d => ({ ...d, recommendations: [...(d.recommendations || []), { id: row.id, categoryId: cat.id, name: row.name }] }));
                         setTransientRecs(prev => ({ ...prev, [cat.id]: { id: generateId(), name: "" } }));
                      }
                    }}
                    className="mt-3 flex items-center gap-2 text-[#157347] font-bold py-1.5 px-1 hover:opacity-80"
                  >
                    <Plus className="w-4 h-4" /> Dodaj
                  </button>
                </div>
              );
            })}

            {/* Special Dogodki block */}
            <div className="border-t border-[#E8EBE6]/60 pt-8 mt-8">
               <h3 className="font-bold text-[18px] mb-2 text-[#121A14]">Dogodki</h3>
               <p className="text-sm text-[#66716A] mb-4">Ponavljajoči se in enkratni dogodki v okolici, ki bi jih gost ne smel zamuditi.</p>
               
               <div className="space-y-4">
                  {(formData.events || []).map((event, i) => (
                     <div key={event.id} className="min-w-0 bg-white border border-[#E8EBE6] rounded-xl p-4 md:p-3 flex flex-col md:flex-row gap-3">
                      <input 
                        aria-label={`Naziv dogodka ${i + 1}`}
                        type="text" 
                        placeholder="Naziv dogodka"
                        value={event.name}
                        onChange={(e) => updateData(d => {
                          const newEvents = [...(d.events || [])];
                          newEvents[i] = { ...event, name: e.target.value };
                          return { ...d, events: newEvents };
                        })}
                         className="min-w-0 flex-1 bg-white border border-[#E8EBE6] rounded-xl px-4 py-2.5 text-[16px] outline-none focus:border-[#157347]"
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
                           className="min-w-0 w-full bg-white border border-[#E8EBE6] rounded-xl px-2 sm:px-3 py-2.5 text-[15px] outline-none focus:border-[#157347]"
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
                           className="min-w-0 w-full bg-white border border-[#E8EBE6] rounded-xl px-2 sm:px-3 py-2.5 text-[15px] outline-none focus:border-[#157347]"
                        />
                        <button 
                          onClick={() => updateData(d => ({
                            ...d, 
                            events: d.events?.filter(ev => ev.id !== event.id)
                          }))}
                           aria-label={`Odstrani dogodek ${i + 1}`}
                           className="col-span-2 sm:col-span-1 w-full sm:w-12 min-h-11 flex items-center justify-center bg-[#F4F6F2] border border-[#E8EBE6] rounded-xl text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                   <div className="min-w-0 bg-white border border-[#E8EBE6] rounded-xl p-4 md:p-3 flex flex-col md:flex-row gap-3">
                    <input 
                      aria-label="Naziv novega dogodka"
                      type="text" 
                      placeholder="Naziv dogodka"
                      value={transientEvents.name}
                      onChange={(e) => setTransientEvents(prev => ({ ...prev, name: e.target.value }))}
                       className="min-w-0 flex-1 bg-white border border-[#E8EBE6] rounded-xl px-4 py-2.5 text-[16px] outline-none focus:border-[#157347]"
                    />
                     <div className="grid grid-cols-2 gap-2 w-full min-w-0 sm:grid-cols-[minmax(0,9rem)_minmax(0,7rem)] md:w-auto">
                      <input 
                        aria-label="Datum novega dogodka"
                        type="date"
                        value={transientEvents.date}
                        onChange={(e) => setTransientEvents(prev => ({ ...prev, date: e.target.value }))}
                         className="min-w-0 w-full bg-white border border-[#E8EBE6] rounded-xl px-2 sm:px-3 py-2.5 text-[15px] outline-none focus:border-[#157347]"
                      />
                      <input 
                        aria-label="Ura novega dogodka"
                        type="time"
                        value={transientEvents.time}
                        onChange={(e) => setTransientEvents(prev => ({ ...prev, time: e.target.value }))}
                         className="min-w-0 w-full bg-white border border-[#E8EBE6] rounded-xl px-2 sm:px-3 py-2.5 text-[15px] outline-none focus:border-[#157347]"
                      />
                    </div>
                  </div>
               </div>
               <button 
                onClick={() => {
                  if (transientEvents.name.trim() || transientEvents.date.trim() || transientEvents.time.trim()) {
                     updateData(d => ({ ...d, events: [...(d.events || []), { id: transientEvents.id, name: transientEvents.name, date: transientEvents.date, time: transientEvents.time }] }));
                     setTransientEvents({ id: generateId(), name: "", date: "", time: "" });
                  }
                }}
                className="mt-4 flex items-center gap-2 text-[#157347] font-bold py-2 px-1 hover:opacity-80 transition-opacity"
              >
                <Plus className="w-5 h-5" /> Dodaj dogodek
              </button>
            </div>
          </div>
        </section>

        {/* SECTION 6 */}
        <section className="bg-[#F4F6F2] border border-[#E8EBE6] rounded-[16px] p-5 md:p-8 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-full bg-[#157347] text-white flex items-center justify-center font-bold text-lg shrink-0">6</div>
            <div>
              <h2 className="text-xl font-bold">Fotografije</h2>
              <p className="text-sm text-[#66716A] mt-1">Lahko jih dodate tudi pozneje. (Maksimalno 20)</p>
            </div>
          </div>
          
          <PhotoUploader photos={onboardingData?.photos || []} onBlockingChange={setUploadsBlocking} />

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
              <span className="text-red-700">{submitOnboarding.error.message}</span>
            ) : isSaving ? (
              <span className="text-[#66716A] flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Shranjevanje...
              </span>
            ) : saveState === "dirty" ? (
              <span className="text-amber-700">Neshranjene spremembe</span>
            ) : saveState === "error" || saveState === "conflict" ? (
              <span className="text-red-700 flex flex-col items-start">
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
              disabled={submitOnboarding.isPending || isSaving || uploadsBlocking || saveState === "conflict"}
              className="flex-1 sm:flex-none bg-[#157347] text-white px-7 py-3 rounded-full font-bold text-[15px] hover:bg-[#0f5835] transition-colors whitespace-nowrap shadow-md flex items-center justify-center gap-2"
            >
              {submitOnboarding.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {uploadsBlocking ? "Počakajte na fotografije" : "Potrdi in oddaj"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhotoUploader({
  photos,
  onBlockingChange,
}: {
  photos: import("@/hooks/use-host-onboarding").HostOnboardingPhoto[];
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
            <div key={p.id} className="relative aspect-square rounded-xl bg-gray-200 overflow-hidden group">
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
                  onClick={() => deletePhoto.mutate(p.id)}
                   aria-label={`Odstrani fotografijo ${p.fileName}`}
                   className="absolute top-2 right-2 w-10 h-10 bg-white/90 text-red-600 rounded-full flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shadow-sm"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
           {uploadingFiles.map((entry) => (
             <div key={entry.id} className="min-h-36 rounded-xl border border-[#E8EBE6] bg-white flex flex-col items-center justify-center p-3 text-center">
                {entry.status === "uploading" ? <Loader2 className="w-6 h-6 animate-spin text-[#157347] mb-2" /> : <X className="w-6 h-6 text-red-600 mb-2" />}
                <span className="text-xs text-[#66716A] break-all px-2">{entry.file.name}</span>
                {entry.error && <span className="text-xs text-red-700 mt-1">{entry.error}</span>}
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
