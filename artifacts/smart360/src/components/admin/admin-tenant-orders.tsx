import { useListTenantOrders, useUpdateOrderStatus, getListTenantOrdersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Phone, MessageCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

export function toWhatsAppDigits(phone: string): string | null {
  const compact = phone.trim().replace(/[\s().-]/g, "");
  const international = compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
  if (!/^\+[1-9]\d{7,14}$/.test(international)) return null;
  return international.slice(1);
}

export function AdminTenantOrders({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient();
  const [pendingTransition, setPendingTransition] = useState<{
    orderRef: string;
    status: "potrjeno" | "prevzeto" | "zavrnjeno";
    label: string;
  } | null>(null);
  const [statusNote, setStatusNote] = useState("");

  const updateStatus = useUpdateOrderStatus();

  const handleStatusChange = (orderRef: string, status: "potrjeno" | "prevzeto" | "zavrnjeno") => {
    updateStatus.mutate({
      orderRef,
      data: { status, statusNote: statusNote.trim() || null }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTenantOrdersQueryKey(tenantId) });
        setPendingTransition(null);
        setStatusNote("");
      }
    });
  };

  const beginTransition = (
    orderRef: string,
    status: "potrjeno" | "prevzeto" | "zavrnjeno",
    label: string,
  ) => {
    setPendingTransition({ orderRef, status, label });
    setStatusNote("");
  };

  const { data: orders, isLoading, error, refetch } = useListTenantOrders(tenantId, { query: { refetchInterval: 15000, queryKey: getListTenantOrdersQueryKey(tenantId) } });
  
  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }
  
  if (error) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-destructive">Napaka pri nalaganju naročil.</p>
        <Button onClick={() => refetch()} variant="outline" data-testid="admin-orders-retry">Poskusi znova</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Naročila gostov</CardTitle>
          <CardDescription className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Zaradi varstva osebnih podatkov (GDPR) se naročila po 90 dneh samodejno izbrišejo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {updateStatus.isError && (
            <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive" data-testid="admin-order-error">
              Statusa naročila ni bilo mogoče posodobiti. Poskusite znova.
            </div>
          )}
          {!orders || orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Trenutno ni nobenih naročil.</div>
          ) : (
            <div className="space-y-4" data-testid="admin-order-list">
              {orders.map(order => {
                const whatsappDigits = toWhatsAppDigits(order.guestPhone);
                const whatsappUrl = whatsappDigits
                  ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(`Pozdravljeni, glede vašega naročila "${order.snapshotTitle ?? ""}"...`)}`
                  : null;
                
                return (
                  <div
                    key={order.orderRef}
                    className={`flex flex-col gap-4 rounded-lg border p-4 transition-colors sm:flex-row ${
                      order.status === "novo" ? "border-primary/60 bg-primary/[0.04] shadow-sm" : ""
                    }`}
                    data-testid={`admin-order-row-${order.orderRef}`}
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-lg">{order.snapshotTitle}</span>
                        <Badge variant={order.status === 'novo' ? 'default' : order.status === 'potrjeno' ? 'secondary' : order.status === 'zavrnjeno' ? 'destructive' : 'outline'}>
                          {order.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {order.guestName} · Soba/parcela: <b>{order.guestUnit}</b>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Količina: <b>{order.qty}</b>
                        {order.snapshotPrice && (
                          <> · Cena: <b>{[order.snapshotPrice, order.snapshotPriceUnit].filter(Boolean).join(" / ")}</b></>
                        )}
                      </div>
                      {order.snapshotFulfillment && (
                        <div className="text-sm text-muted-foreground">Prevzem / dostava: {order.snapshotFulfillment}</div>
                      )}
                      {order.guestNote && (
                        <div className="text-sm bg-muted p-2 rounded mt-2">
                          Opomba: {order.guestNote}
                        </div>
                      )}
                      {order.statusNote && (
                        <div
                          className="mt-2 rounded border border-primary/20 bg-primary/5 p-2 text-sm"
                          data-testid={`current-status-note-${order.orderRef}`}
                        >
                          <span className="font-medium">Opomba gostu: </span>{order.statusNote}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-2">
                        Prejeto: {new Date(order.createdAt).toLocaleString("sl-SI")}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 min-w-[200px]">
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" asChild>
                          <a href={`tel:${order.guestPhone}`}>
                            <Phone className="w-3 h-3 mr-2" /> Pokliči
                          </a>
                        </Button>
                        {whatsappUrl && (
                          <Button variant="outline" size="sm" className="flex-1" asChild>
                            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                              <MessageCircle className="w-3 h-3 mr-2" /> WhatsApp
                            </a>
                          </Button>
                        )}
                      </div>

                      {pendingTransition?.orderRef === order.orderRef ? (
                        <div className="mt-2 space-y-3 rounded-lg border bg-background p-3" data-testid={`status-transition-${order.orderRef}`}>
                          <div className="space-y-1.5">
                            <Label htmlFor={`status-note-${order.orderRef}`}>
                              {pendingTransition.label} · opomba gostu (neobvezno)
                            </Label>
                            <Textarea
                              id={`status-note-${order.orderRef}`}
                              value={statusNote}
                              onChange={(event) => setStatusNote(event.target.value)}
                              maxLength={300}
                              rows={3}
                              placeholder="Npr. Prevzem je možen danes po 17. uri."
                              disabled={updateStatus.isPending}
                              data-testid={`status-note-${order.orderRef}`}
                            />
                            <p className="text-right text-xs text-muted-foreground">{statusNote.length}/300</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleStatusChange(order.orderRef, pendingTransition.status)}
                              disabled={updateStatus.isPending}
                              data-testid={`confirm-status-${order.orderRef}`}
                            >
                              {updateStatus.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                              Shrani status
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setPendingTransition(null);
                                setStatusNote("");
                              }}
                              disabled={updateStatus.isPending}
                            >
                              Prekliči
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {order.status === "novo" && (
                            <div className="flex gap-2 mt-2" data-testid="admin-order-actions">
                              <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => beginTransition(order.orderRef, "potrjeno", "Potrdi naročilo")} disabled={updateStatus.isPending && updateStatus.variables?.orderRef === order.orderRef}>
                                Potrdi
                              </Button>
                              <Button size="sm" variant="destructive" className="flex-1" onClick={() => beginTransition(order.orderRef, "zavrnjeno", "Zavrni naročilo")} disabled={updateStatus.isPending && updateStatus.variables?.orderRef === order.orderRef}>
                                Zavrni
                              </Button>
                            </div>
                          )}

                          {order.status === "potrjeno" && (
                            <div className="flex gap-2 mt-2" data-testid="admin-order-actions">
                              <Button size="sm" className="flex-1" onClick={() => beginTransition(order.orderRef, "prevzeto", "Označi kot prevzeto")} disabled={updateStatus.isPending && updateStatus.variables?.orderRef === order.orderRef}>
                                Označi kot prevzeto
                              </Button>
                              <Button size="sm" variant="destructive" className="flex-1" onClick={() => beginTransition(order.orderRef, "zavrnjeno", "Zavrni naročilo")} disabled={updateStatus.isPending && updateStatus.variables?.orderRef === order.orderRef}>
                                Zavrni
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
