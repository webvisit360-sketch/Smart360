import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageCircle, AlertCircle, Phone } from "lucide-react";
import { AdminButton as Button } from "@/components/ui/button";
import { AdminCard as Card, AdminCardContent as CardContent, AdminCardHeader as CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AdminBadge as Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useListTenantThreads,
  usePostHostReply,
  getListTenantThreadsQueryKey,
} from "@workspace/api-client-react";

export function AdminTenantMessages({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient();
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");

  const { data: threads, isLoading, error, refetch } = useListTenantThreads(tenantId, {
    query: {
      refetchInterval: 15000,
      queryKey: getListTenantThreadsQueryKey(tenantId),
    },
  });

  const replyMutation = usePostHostReply({
    mutation: {
      onSuccess: () => {
        setReplyBody("");
        queryClient.invalidateQueries({ queryKey: getListTenantThreadsQueryKey(tenantId) });
      },
    },
  });

  const handleReply = (threadRef: string) => {
    if (!replyBody.trim() || replyMutation.isPending) return;
    replyMutation.mutate({
      tenantId,
      threadRef,
      data: { body: replyBody.trim() },
    });
  };

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  if (error) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-destructive" data-testid="admin-messages-error">
          Napaka pri nalaganju sporočil.
        </p>
        <Button onClick={() => refetch()} variant="outline" data-testid="admin-messages-retry">
          Poskusi znova
        </Button>
      </div>
    );
  }

  const activeThread = threads?.find((t) => t.threadRef === selectedThread) || null;
  const threadTitle = (thread: NonNullable<typeof activeThread>) =>
    thread.guestName?.trim() || `Enota ${thread.guestUnit}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sporočila gostov</CardTitle>
          <CardDescription className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Niti in sporočila se po 90 dneh neaktivnosti samodejno izbrišejo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!threads || threads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="admin-messages-empty">
              Trenutno ni nobenih sporočil.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Thread list */}
              <div className="col-span-1 border rounded-lg overflow-hidden divide-y flex flex-col max-h-[600px] overflow-y-auto">
                {threads.map((t) => (
                  <button
                    key={t.threadRef}
                    onClick={() => {
                      setSelectedThread(t.threadRef);
                      setReplyBody("");
                      replyMutation.reset();
                    }}
                    className={`flex flex-col items-start p-4 text-left transition-colors hover:bg-muted ${
                      selectedThread === t.threadRef ? "bg-muted font-medium" : ""
                    }`}
                    data-testid={`admin-message-thread-${t.threadRef}`}
                  >
                    <div className="flex w-full justify-between items-center mb-1">
                      <span className="font-semibold">{threadTitle(t)}</span>
                      {!t.isOpen && <Badge variant="outline">Zaprto</Badge>}
                    </div>
                    <span className="text-xs text-muted-foreground mb-2">Soba/parcela: {t.guestUnit}</span>
                    <span className="text-sm truncate w-full text-muted-foreground">
                      {t.messages[t.messages.length - 1]?.body}
                    </span>
                  </button>
                ))}
              </div>

              {/* Thread detail */}
              <div className="col-span-1 md:col-span-2 border rounded-lg flex flex-col h-[600px]">
                {activeThread ? (
                  <>
                    <div className="p-4 border-b bg-muted/30 flex items-center justify-between gap-4">
                      <div>
                        <div className="font-semibold text-lg">{threadTitle(activeThread)}</div>
                        <div className="text-sm text-muted-foreground">
                          Soba/parcela: {activeThread.guestUnit}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {activeThread.guestPhone && (
                          <Button variant="outline" size="sm" asChild>
                            <a
                              href={`tel:${activeThread.guestPhone}`}
                              data-testid="admin-message-guest-phone"
                            >
                              <Phone className="w-3 h-3 mr-2" />
                              {activeThread.guestPhone}
                            </a>
                          </Button>
                        )}
                        {!activeThread.isOpen && <Badge variant="outline">Zaprto</Badge>}
                      </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {activeThread.messages.map((msg) => {
                        const isGuest = msg.sender === "guest";
                        return (
                          <div key={msg.id} className={`flex flex-col ${isGuest ? "items-start" : "items-end"}`}>
                            <div
                              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                                isGuest
                                  ? "bg-muted text-foreground rounded-bl-none"
                                  : "bg-primary text-primary-foreground rounded-br-none"
                              }`}
                              style={{ whiteSpace: "pre-wrap", wordWrap: "break-word" }}
                            >
                              {msg.body}
                            </div>
                            <span className="text-xs text-muted-foreground mt-1">
                              {new Date(msg.createdAt).toLocaleString("sl-SI")}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {activeThread.isOpen ? (
                      <div className="p-4 border-t bg-muted/10 space-y-3">
                        <Label htmlFor="reply-body">Odgovorite gostu</Label>
                        <Textarea
                          id="reply-body"
                          value={replyBody}
                          onChange={(e) => setReplyBody(e.target.value)}
                          placeholder="Napišite odgovor..."
                          rows={3}
                          maxLength={2000}
                          disabled={replyMutation.isPending}
                          data-testid="admin-message-reply-input"
                        />
                        {replyMutation.isError && (
                          <p className="text-sm text-destructive" role="alert" data-testid="admin-message-reply-error">
                            Odgovora ni bilo mogoče poslati. Poskusite znova.
                          </p>
                        )}
                        <div className="flex justify-end">
                          <Button
                            onClick={() => handleReply(activeThread.threadRef)}
                            disabled={!replyBody.trim() || replyMutation.isPending}
                            data-testid="admin-message-reply-send"
                          >
                            {replyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <MessageCircle className="w-4 h-4 mr-2" />
                            Pošlji odgovor
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 border-t bg-muted/30 text-center text-sm text-muted-foreground">
                        Ta pogovor je zaprt in nanj ni mogoče več odgovarjati.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Izberite pogovor za prikaz
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
