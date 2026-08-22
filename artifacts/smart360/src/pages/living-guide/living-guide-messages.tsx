import { useState, useRef, useEffect, useMemo } from "react";
import {
  useGetGuestMessages,
  useSendGuestMessage,
  getGetGuestMessagesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { UiTranslator } from "../guest/i18n";
import { getDeviceToken } from "./living-guide-orders";

export function MessagesView({
  tenant,
  slug,
  guest,
  t,
  onBack,
}: {
  tenant: any;
  slug: string;
  guest: { name: string; unit: string } | null;
  t: UiTranslator;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const deviceToken = useMemo(() => getDeviceToken(slug), [slug]);

  const { data: thread, isLoading, isError, refetch } = useGetGuestMessages(slug, {
    query: {
      refetchInterval: 5000,
      queryKey: getGetGuestMessagesQueryKey(slug),
    },
    request: { headers: { "x-device-token": deviceToken } },
  });

  const sendMutation = useSendGuestMessage({
    mutation: {
      onSuccess: () => {
        setBody("");
        queryClient.invalidateQueries({ queryKey: getGetGuestMessagesQueryKey(slug) });
      },
    },
    request: { headers: { "x-device-token": deviceToken } },
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const previousMessageCount = useRef(0);

  useEffect(() => {
    const currentCount = thread?.messages?.length ?? 0;
    if (currentCount > previousMessageCount.current) {
      if (bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior: "smooth" });
      }
      previousMessageCount.current = currentCount;
    }
  }, [thread?.messages]);

  const handleSend = () => {
    const text = body.trim();
    if (!text || sendMutation.isPending) return;
    sendMutation.mutate({
      slug,
      data: {
        body: text,
        guestName: guest?.name || undefined,
        guestUnit: guest?.unit || undefined,
      },
    });
  };

  const isClosed = thread?.isOpen === false;
  const sendErrorStatus =
    sendMutation.error &&
    typeof sendMutation.error === "object" &&
    "status" in sendMutation.error
      ? Number((sendMutation.error as { status?: unknown }).status)
      : null;

  return (
    <div className="lg2-view lg2-msg-view" data-testid="screen-messages">
      <div className="lg2-msg-hd">
        <div className="lg2-msg-tt">
          <p>{tenant.name}</p>
          <h2>{t("UI.lg.nav.messages")}</h2>
        </div>
        <button className="lg2-fab" onClick={onBack} aria-label={t("UI.lg.action.back")} data-testid="messages-back">
          <svg aria-hidden="true"><use href="#lg-i-bk" /></svg>
        </button>
      </div>

      <div className="lg2-msg-sc" ref={scrollRef}>
        {isLoading && !thread ? (
          <div className="lg2-msg-empty" data-testid="messages-loading">
            {t("UI.lg.order.loading")}
          </div>
        ) : isError ? (
          <div className="lg2-msg-empty" data-testid="messages-error">
            <p>{t("UI.lg.order.error")}</p>
            <button
              onClick={() => refetch()}
              className="lg2-primary-button"
              style={{ width: "auto", minHeight: "40px", marginTop: "16px" }}
            >
              {t("UI.lg.order.retry")}
            </button>
          </div>
        ) : !thread || thread.messages.length === 0 ? (
          <div className="lg2-msg-empty" data-testid="messages-empty">
            <p>{t("UI.lg.msg.empty")}</p>
          </div>
        ) : (
          <div className="lg2-msgs" data-testid="messages-bubbles">
            {thread?.messages?.map((msg) => (
              <div
                key={msg.id}
                className={msg.sender === "guest" ? "lg2-msg lg2-msg--g" : "lg2-msg lg2-msg--h"}
                data-testid={`msg-${msg.id}`}
              >
                {msg.body}
                <small>
                  {msg.sender === "guest" ? t("UI.lg.msg.you") : tenant.name} ·{" "}
                  {new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </small>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="lg2-msg-compose-area">
        {sendMutation.isError && (
          <p className="lg2-msg-send-error" role="alert" data-testid="messages-send-error">
            {sendErrorStatus === 429
              ? t("UI.lg.msg.rateLimit")
              : t("UI.lg.msg.sendError")}
          </p>
        )}
        <div className="lg2-msgbar" data-testid="messages-composer">
          <input
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              if (sendMutation.isError) sendMutation.reset();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            maxLength={2000}
            placeholder={isClosed ? t("UI.lg.msg.closed") : t("UI.lg.msg.placeholder")}
            aria-label={isClosed ? t("UI.lg.msg.closed") : t("UI.lg.msg.placeholder")}
            disabled={isClosed || sendMutation.isPending}
            autoComplete="off"
            data-testid="messages-input"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!body.trim() || isClosed || sendMutation.isPending}
            aria-label={t("UI.lg.msg.send")}
            data-testid="messages-send"
          >
            <svg aria-hidden="true"><use href="#lg-i-send" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
