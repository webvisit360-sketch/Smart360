import { useMemo } from "react";
import { 
  useListTenantOrders, 
  useListTenantThreads, 
  useUpdateOrderStatus, 
  useGetTenant, 
  useListTenantOverview,
  useListTenantChangelog,
  getGetTenantQueryKey,
  getListTenantOrdersQueryKey,
  getListTenantThreadsQueryKey,
  getListTenantOverviewQueryKey,
  getListTenantChangelogQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, PhoneCall } from "lucide-react";

export function AdminTenantOverview({ tenantId, onTabChange }: { tenantId: string; onTabChange: (tab: string) => void }) {
  const queryClient = useQueryClient();
  const { data: tenant, isLoading: tenantLoading } = useGetTenant(tenantId, {
    query: { queryKey: getGetTenantQueryKey(tenantId) },
  });
  const { data: orders, isLoading: ordersLoading, refetch: refetchOrders } = useListTenantOrders(tenantId, {
    query: { queryKey: getListTenantOrdersQueryKey(tenantId), refetchInterval: 15000 },
  });
  const { data: threads, isLoading: threadsLoading, refetch: refetchThreads } = useListTenantThreads(tenantId, {
    query: { queryKey: getListTenantThreadsQueryKey(tenantId), refetchInterval: 15000 },
  });
  const { data: overviews, refetch: refetchOverview } = useListTenantOverview({
    query: { queryKey: getListTenantOverviewQueryKey() },
  });
  const { data: changelog } = useListTenantChangelog(tenantId, {
    query: { queryKey: getListTenantChangelogQueryKey(tenantId) },
  });
  const overview = overviews?.find((row) => row.tenantId === tenantId);

  const updateStatus = useUpdateOrderStatus({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTenantOrdersQueryKey(tenantId) });
        queryClient.invalidateQueries({ queryKey: getListTenantOverviewQueryKey() });
      }
    }
  });

  const pendingWork = useMemo(() => {
    const work: any[] = [];
    
    if (orders) {
      const newOrders = orders.filter(o => o.status === "novo");
      newOrders.forEach(o => {
        work.push({
          type: 'order',
          date: new Date(o.createdAt),
          data: o
        });
      });
    }

    if (threads) {
      const openThreads = threads.filter(t => t.isOpen && t.messages.length > 0);
      openThreads.forEach(t => {
        const lastMsg = t.messages[t.messages.length - 1];
        if (lastMsg && lastMsg.sender === "guest") {
          work.push({
            type: 'message',
            date: new Date(lastMsg.createdAt),
            data: t,
            lastMsg
          });
        }
      });
    }

    // Oldest first
    return work.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [orders, threads]);

  const firstOrderRef = pendingWork.find((item) => item.type === "order")?.data.orderRef as string | undefined;
  const distancesCount = overview?.pendingLocations ?? 0;
  const photolessCount = overview?.missingPhotos ?? 0;
  const latestPublish = changelog?.find(
    (entry) => entry.entity === "tenant" && ["publish", "republish"].includes(entry.action),
  );
  const publicationDate = latestPublish?.createdAt ?? tenant?.firstPublishedAt ?? null;
  const languageNames: Record<string, string> = {
    sl: "Slovenščina",
    en: "Angleščina",
    de: "Nemščina",
    it: "Italijanščina",
    hr: "Hrvaščina",
    fr: "Francoščina",
  };
  const languages = tenant?.languages ?? [];

  const handleOrderStatus = (orderRef: string, status: "potrjeno" | "zavrnjeno") => {
    updateStatus.mutate({ orderRef, data: { status, statusNote: null } });
  };
  
  const handleRefresh = () => {
    refetchOrders();
    refetchThreads();
    refetchOverview();
  };

  const formatWaitTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'pravkar';
    if (diffMins < 60) return `pred ${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `pred ${diffHours} h`;
    const diffDays = Math.floor(diffHours / 24);
    return `pred ${diffDays} d`;
  };

  if (tenantLoading || ordersLoading || threadsLoading) {
    return <div className="grid min-h-52 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-[#157347]" /></div>;
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1200px] mx-auto text-[#121A14]">
      <div className="bg-[#F4F6F2] rounded-[22px] p-6">
        <div className="flex items-start gap-3 mb-4">
          <h2 className="text-[17px] font-[800] tracking-tight text-[#121A14] flex-1">Danes</h2>
          <button onClick={handleRefresh} className="bg-white border-[1.5px] border-[#E8EBE6] px-[13px] py-[8px] rounded-[11px] text-[13px] font-[800] hover:border-[#D3DBD1] transition-colors text-[#121A14]">
            Osveži
          </button>
        </div>

        {pendingWork.length === 0 ? (
          <div className="text-center py-8 text-[#66716A] text-[14.5px] font-[500]">
            Trenutno nimate novih naročil ali neodgovorjenih sporočil.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pendingWork.map((item, index) => {
              if (item.type === 'order') {
                const o = item.data;
                const isActionable = o.orderRef === firstOrderRef;
                const waitTime = formatWaitTime(item.date);
                
                return (
                  <div key={`order-${o.orderRef}`} className={`rounded-[18px] p-[17px] md:p-[19px] grid grid-cols-1 md:grid-cols-[1fr_auto] gap-[16px] border ${isActionable ? 'bg-[#FBFDFB] border-[#D6E7DC]' : 'bg-white border-[#E8EBE6]'}`}>
                    <div>
                      <h4 className="font-[800] text-[16px] text-[#121A14]">Naročilo ({o.guestUnit})</h4>
                      <div className="text-[13px] font-[600] text-[#66716A] mt-[2px]">{o.guestName}</div>
                      <div className="font-[800] text-[14.5px] mt-[11px] text-[#121A14]">{o.qty}× {o.snapshotTitle}</div>
                      {o.snapshotFulfillment && <div className="text-[13.5px] font-[500] text-[#66716A] mt-[3px]">Prevzem: <b className="text-[#121A14] font-[800]">{o.snapshotFulfillment}</b></div>}
                      {o.guestNote && <div className="bg-[#ECF0EA] rounded-[12px] px-[13px] py-[10px] mt-[11px] text-[13.5px] font-[500] text-[#121A14]">Gostova opomba: "{o.guestNote}"</div>}
                      <div className="text-[12.5px] font-[600] text-[#9AA69E] mt-[11px]">Prejeto {waitTime}</div>
                    </div>
                    
                    <div className="flex flex-col md:items-end justify-start gap-[8px]">
                      {isActionable ? (
                        <>
                          <button onClick={() => handleOrderStatus(o.orderRef, 'potrjeno')} disabled={updateStatus.isPending && updateStatus.variables?.orderRef === o.orderRef} className="bg-[#157347] text-white px-[17px] py-[11px] rounded-[13px] font-[800] text-[14px] hover:bg-[#12643D] transition-colors w-full md:w-auto text-center border border-transparent">
                            Potrdi
                          </button>
                          <button onClick={() => handleOrderStatus(o.orderRef, 'zavrnjeno')} disabled={updateStatus.isPending && updateStatus.variables?.orderRef === o.orderRef} className="bg-white border-[1.5px] border-[#E8EBE6] text-[#121A14] px-[17px] py-[11px] rounded-[13px] font-[800] text-[14px] hover:border-[#D3DBD1] transition-colors w-full md:w-auto text-center">
                            Zavrni
                          </button>
                          {o.guestPhone && (
                             <a href={`tel:${o.guestPhone}`} className="bg-white border-[1.5px] border-[#E8EBE6] text-[#121A14] px-[17px] py-[11px] rounded-[13px] font-[800] text-[14px] hover:border-[#D3DBD1] transition-colors w-full md:w-auto mt-auto flex items-center justify-center gap-2">
                               <PhoneCall className="w-[16px] h-[16px] stroke-[2]" /> Pokliči
                             </a>
                          )}
                        </>
                      ) : (
                        <button onClick={() => onTabChange('orders')} className="bg-[#F4F6F2] text-[#121A14] px-[17px] py-[11px] rounded-[13px] font-[800] text-[14px] hover:bg-[#E8EBE6] transition-colors w-full md:w-auto text-center border border-transparent">
                          Preglej naročilo
                        </button>
                      )}
                    </div>
                  </div>
                )
              } else {
                const t = item.data;
                const waitTime = formatWaitTime(item.date);
                
                return (
                  <div key={`msg-${t.threadRef}`} className="rounded-[18px] p-[17px] md:p-[19px] grid grid-cols-1 md:grid-cols-[1fr_auto] gap-[16px] bg-white border border-[#E8EBE6]">
                    <div>
                      <h4 className="font-[800] text-[16px] text-[#121A14]">Novo sporočilo ({t.guestUnit})</h4>
                      <div className="text-[13px] font-[600] text-[#66716A] mt-[2px]">{t.guestName || "Gost"}</div>
                      <div className="font-[800] text-[14.5px] mt-[11px] text-[#121A14]">"{item.lastMsg.body}"</div>
                      <div className="text-[12.5px] font-[600] text-[#9AA69E] mt-[11px]">Prejeto {waitTime}</div>
                    </div>
                    
                    <div className="flex flex-col md:items-end justify-start gap-[8px]">
                      <button onClick={() => onTabChange('messages')} className="bg-white border-[1.5px] border-[#E8EBE6] text-[#121A14] px-[17px] py-[11px] rounded-[13px] font-[800] text-[14px] hover:border-[#D3DBD1] transition-colors w-full md:w-auto text-center">
                        Odgovori
                      </button>
                    </div>
                  </div>
                )
              }
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#F4F6F2] rounded-[22px] p-[22px] md:p-[24px]">
          <div className="flex items-start gap-3 mb-[16px]">
            <h2 className="text-[17px] font-[800] tracking-tight text-[#121A14] flex-1">Potrebno pozornosti</h2>
          </div>
          
          <div className="relative pl-[18px] before:content-[''] before:absolute before:left-[4px] before:top-[6px] before:bottom-[6px] before:w-[1.5px] before:bg-[#E8EBE6] flex flex-col mt-3">
            
            {distancesCount > 0 && (
              <div className="relative pb-[15px] before:content-[''] before:absolute before:left-[-18px] before:top-[5px] before:w-[9px] before:h-[9px] before:rounded-full before:bg-white before:border-[2.5px] before:border-[#DD9A2B]">
                <div className="font-[700] text-[13.5px] text-[#121A14]">Nepotrjene razdalje ({distancesCount})</div>
                <div className="font-[500] text-[12.5px] text-[#66716A] mt-[2px]">Sistem je našel nove točke, preverite razdalje.</div>
                <button onClick={() => onTabChange('distances')} className="font-[800] text-[13px] text-[#157347] mt-[2px] hover:underline text-left">Preveri razdalje</button>
              </div>
            )}

            {photolessCount > 0 && (
              <div className="relative pb-[15px] before:content-[''] before:absolute before:left-[-18px] before:top-[5px] before:w-[9px] before:h-[9px] before:rounded-full before:bg-white before:border-[2.5px] before:border-[#DD9A2B]">
                <div className="font-[700] text-[13.5px] text-[#121A14]">Kategorije brez slik ({photolessCount})</div>
                <div className="font-[500] text-[12.5px] text-[#66716A] mt-[2px]">Nekatere kategorije nimajo naslovne slike.</div>
                <button onClick={() => onTabChange('content')} className="font-[800] text-[13px] text-[#157347] mt-[2px] hover:underline text-left">Uredi vsebino</button>
              </div>
            )}
            
            {distancesCount === 0 && photolessCount === 0 && (
              <div className="relative pb-[15px] before:content-[''] before:absolute before:left-[-18px] before:top-[5px] before:w-[9px] before:h-[9px] before:rounded-full before:bg-white before:border-[2.5px] before:border-[#1D9159]">
                <div className="font-[700] text-[13.5px] text-[#121A14]">Vse urejeno</div>
                <div className="font-[500] text-[12.5px] text-[#66716A] mt-[2px]">Ni drugih zaznanih težav z vsebino.</div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#F4F6F2] rounded-[22px] p-[22px] md:p-[24px]">
          <div className="flex items-start gap-3 mb-[16px]">
            <h2 className="text-[17px] font-[800] tracking-tight text-[#121A14] flex-1">Stanje vodnika</h2>
            {tenant?.isPublished ? (
              <span className="bg-[#E4F2EA] text-[#116B41] font-[800] text-[11.5px] tracking-[0.04em] px-[11px] py-[5px] rounded-[9px] inline-flex items-center gap-[6px]">Objavljeno</span>
            ) : (
               <span className="bg-[#FBF1DC] text-[#8A6A1E] font-[800] text-[11.5px] tracking-[0.04em] px-[11px] py-[5px] rounded-[9px] inline-flex items-center gap-[6px]">Osnutek</span>
            )}
          </div>
          
          <div className="relative pl-[18px] before:content-[''] before:absolute before:left-[4px] before:top-[6px] before:bottom-[6px] before:w-[1.5px] before:bg-[#E8EBE6] flex flex-col mt-3">
            
            <div className="relative pb-[15px] before:content-[''] before:absolute before:left-[-18px] before:top-[5px] before:w-[9px] before:h-[9px] before:rounded-full before:bg-white before:border-[2.5px] before:border-[#1D9159]">
              <div className="font-[700] text-[13.5px] text-[#121A14]">
                Objavljena različica: {publicationDate ? new Date(publicationDate).toLocaleString("sl-SI", { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : "še ni objavljena"}
              </div>
              <div className="font-[500] text-[12.5px] text-[#66716A] mt-[2px]">
                {latestPublish ? `Objavil: ${latestPublish.actorLabel}` : "Podatek o izvajalcu objave ni na voljo"}
              </div>
            </div>

            <div className="relative pb-[15px] before:content-[''] before:absolute before:left-[-18px] before:top-[5px] before:w-[9px] before:h-[9px] before:rounded-full before:bg-white before:border-[2.5px] before:border-[#1D9159]">
              <div className="font-[700] text-[13.5px] text-[#121A14]">Aktivni jeziki ({languages.length})</div>
              <div className="font-[500] text-[12.5px] text-[#66716A] mt-[2px]">
                 {languages.length > 0 ? languages.map((lang) => languageNames[lang] ?? lang.toUpperCase()).join(", ") : "Ni aktivnih jezikov"}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
