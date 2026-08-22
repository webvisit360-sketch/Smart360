import { FormEvent, useMemo, useRef, useState } from "react";
import { useCreateOrder, useListDeviceOrders, getListDeviceOrdersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getDeviceToken,
  addOrderRef,
  getIdempotencyKey,
  extractFulfillmentText,
  getRememberedOrderPassword,
  rememberOrderPassword,
} from "./living-guide-orders";
import { UiLanguage, UiTranslator } from "../guest/i18n";

const hasMinimumPhoneDigits = (value: string) =>
  (value.match(/\d/g)?.length ?? 0) >= 6;

export function OrderSheet({
  item,
  slug,
  lang,
  t,
  guest,
  passwordRequired,
  onClose,
  onOpenOrders,
}: {
  item: any;
  slug: string;
  lang: UiLanguage;
  t: UiTranslator;
  guest: { unit: string; name: string } | null;
  passwordRequired: boolean;
  onClose: () => void;
  onOpenOrders: () => void;
}) {
  const queryClient = useQueryClient();
  const [qty, setQty] = useState(1);
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [guestName, setGuestName] = useState(guest?.name ?? "");
  const [guestUnit, setGuestUnit] = useState(guest?.unit ?? "");
  const [orderPassword, setOrderPassword] = useState(
    passwordRequired ? getRememberedOrderPassword(slug) : "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [successRef, setSuccessRef] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const idempotencyKey = useRef(getIdempotencyKey());

  const createMutation = useCreateOrder({
    request: {
      headers: {
        "x-device-token": getDeviceToken(slug),
        "x-idempotency-key": idempotencyKey.current,
      }
    }
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (
      !guestUnit.trim() ||
      !guestName.trim() ||
      !phone.trim() ||
      (passwordRequired && !orderPassword.trim())
    ) {
      setErrorMsg(t("UI.lg.order.validation.required"));
      return;
    }
    if (!hasMinimumPhoneDigits(phone)) {
      setErrorMsg(t("UI.lg.order.validation.phoneDigits"));
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await createMutation.mutateAsync({
        slug,
        data: {
          itemId: item.id,
          qty,
          guestName: guestName.trim(),
          guestPhone: phone.trim(),
          guestUnit: guestUnit.trim(),
          guestNote: note.trim() || undefined,
          orderPassword: passwordRequired ? orderPassword.trim() : undefined,
          lang,
        },
      });
      const orderRef =
        res && typeof res.orderRef === "string" && res.orderRef.trim()
          ? res.orderRef.trim()
          : null;
      if (!orderRef) {
        throw new Error("Order response did not include a reference");
      }
      addOrderRef(slug, orderRef);
      if (passwordRequired) {
        rememberOrderPassword(slug, orderPassword);
      }
      setSuccessRef(orderRef);
      void queryClient.invalidateQueries({
        queryKey: getListDeviceOrdersQueryKey(slug),
      });
    } catch (error: unknown) {
      const data =
        typeof error === "object" && error !== null && "data" in error
          ? (error as { data?: unknown }).data
          : null;
      const code =
        typeof data === "object" && data !== null && "code" in data
          ? (data as { code?: unknown }).code
          : null;
      setErrorMsg(
        code === "INVALID_ORDER_PASSWORD"
          ? t("UI.lg.order.validation.password")
          : t("UI.lg.order.error"),
      );
      setSubmitting(false);
    }
  };

  const deliveryText = useMemo(() => extractFulfillmentText(item, t), [item, t]);

  if (successRef) {
    return (
      <div className="lg2-sheet-overlay" role="presentation" onClick={onClose}>
        <div className="lg2-welcome-sheet" style={{ textAlign: "center", paddingBottom: "40px" }} role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} data-testid="order-success">
          <div className="lg2-grabber" aria-hidden="true" />
          <svg viewBox="0 0 100 100" style={{ width: 80, height: 80, margin: "20px auto", color: "var(--acc)" }} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="50" cy="50" r="46" />
            <path d="M31 52l14 14 25-28" strokeDasharray="100" strokeDashoffset="0" style={{ animation: "lg2-draw-check 0.6s ease-out forwards" }} />
          </svg>
          <style>{`@keyframes lg2-draw-check { from { stroke-dashoffset: 100; } to { stroke-dashoffset: 0; } }`}</style>
          <h3 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 12px" }}>{t("UI.lg.order.success")}</h3>
          <p style={{ color: "var(--tx)", fontSize: "17px", fontWeight: 750, margin: "0 auto 10px" }}>
            {t("UI.lg.order.thankYou")}
          </p>
          <p style={{ color: "var(--tx2)", fontSize: "15px", lineHeight: 1.5, maxWidth: 300, margin: "0 auto 24px" }}>
            {t("UI.lg.order.successNext")}
          </p>
          <p className="lg2-order-ref">{t("UI.lg.order.ref")} {successRef}</p>
          <div className="lg2-order-success-actions">
            <button className="lg2-primary-button" type="button" onClick={onOpenOrders}>
              {t("UI.lg.order.myOrders")}
            </button>
            <button className="lg2-primary-button lg2-primary-button--secondary" type="button" onClick={onClose}>
              {t("UI.lg.order.backToGuide")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lg2-sheet-overlay" role="presentation" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="lg2-welcome-sheet v--sheet" id="v-order" role="dialog" aria-modal="true" onSubmit={submit} noValidate data-testid="order-form">
        <div className="lg2-grabber" aria-hidden="true" />
        <h2 style={{ fontSize: "23px", fontWeight: 800, letterSpacing: "-.03em", color: "var(--tx)", marginBottom: "14px" }}>
          {t("UI.lg.order.title")} · {item?.title}
        </h2>
        
        <div className="lg2-qty" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "var(--card)", borderRadius: "16px", marginBottom: "12px", border: "1px solid var(--line)" }}>
          <b style={{ fontSize: "17px", fontWeight: 750 }}>{t("UI.lg.order.qty")}</b>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <button type="button" className="lg2-qty-btn" onClick={() => setQty(Math.max(1, qty - 1))} aria-label={t("UI.lg.order.qtyDec")} data-testid="btn-qty-dec">&minus;</button>
            <span style={{ fontSize: "20px", fontWeight: 800, minWidth: "20px", textAlign: "center" }}>{qty}</span>
            <button type="button" className="lg2-qty-btn" onClick={() => setQty(Math.min(999, qty + 1))} aria-label={t("UI.lg.order.qtyInc")} data-testid="btn-qty-inc">+</button>
          </div>
        </div>

        <label className="lg2-field lg2-field--required">
          <span>{t("UI.lg.order.name")}</span>
          <input type="text" maxLength={200} value={guestName} onChange={e => setGuestName(e.target.value)} disabled={submitting} data-testid="input-guest-name" />
        </label>

        <label className="lg2-field lg2-field--required">
          <span>{t("UI.lg.order.unit")}</span>
          <input type="text" maxLength={100} value={guestUnit} onChange={e => setGuestUnit(e.target.value)} disabled={submitting} data-testid="input-guest-unit" />
        </label>

        <label className="lg2-field lg2-field--required">
          <span>{t("UI.lg.order.phone")}</span>
          <input type="tel" maxLength={50} value={phone} onChange={e => setPhone(e.target.value)} placeholder={t("UI.lg.order.placeholder.phone")} disabled={submitting} data-testid="input-guest-phone" />
        </label>

        {passwordRequired && (
          <label className="lg2-field lg2-field--required">
            <span>{t("UI.lg.order.password")}</span>
            <input
              type="password"
              maxLength={200}
              value={orderPassword}
              onChange={e => setOrderPassword(e.target.value)}
              disabled={submitting}
              autoComplete="current-password"
              data-testid="input-order-password"
            />
          </label>
        )}

        <label className="lg2-field">
          <span>{t("UI.lg.order.note")}</span>
          <input type="text" maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder={t("UI.lg.order.placeholder.note")} disabled={submitting} data-testid="input-guest-note" />
        </label>
        
        {errorMsg && <div className="lg2-error-text">{errorMsg}</div>}


        <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
          <button className="lg2-primary-button" style={{ background: "var(--card)", color: "var(--tx)", border: "1px solid var(--line)" }} type="button" onClick={onClose} disabled={submitting}>
            {t("UI.lg.action.back")}
          </button>
          <button className="lg2-primary-button" type="submit" disabled={submitting} data-testid="submit-order">
            {submitting ? "..." : t("UI.lg.order.submit")}
          </button>
        </div>
        
        <p style={{ fontSize: "11.5px", color: "var(--tx2)", textAlign: "center", marginTop: "16px", padding: "0 10px", lineHeight: 1.4 }}>
          {deliveryText}
        </p>
      </form>
    </div>
  );
}

export function MyOrdersSheet({
  slug,
  lang,
  t,
  onClose,
}: {
  slug: string;
  lang: UiLanguage;
  t: UiTranslator;
  onClose: () => void;
}) {
  const { data: orders, isLoading, error, refetch } = useListDeviceOrders(slug, {
    query: { refetchInterval: 15000, queryKey: getListDeviceOrdersQueryKey(slug) },
    request: { headers: { "x-device-token": getDeviceToken(slug) } },
  });

  return (
    <div className="lg2-sheet-overlay" role="presentation" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="lg2-welcome-sheet" role="dialog" aria-modal="true" data-testid="my-orders">
        <div className="lg2-grabber" aria-hidden="true" />
        <h2 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 16px" }}>{t("UI.lg.order.myOrders")}</h2>
        
        {isLoading ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--tx2)" }}>{t("UI.lg.order.loading")}</div>
        ) : error ? (
          <div className="lg2-orders-error" data-testid="my-orders-error">
            <p>{t("UI.lg.order.failedQuery")}</p>
            <button className="lg2-primary-button" type="button" onClick={() => void refetch()} data-testid="my-orders-retry">
              {t("UI.lg.order.retry")}
            </button>
          </div>
        ) : (!orders || orders.length === 0) ? (
          <p style={{ padding: "40px 0", textAlign: "center", color: "var(--tx2)" }}>{t("UI.lg.order.empty")}</p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {orders.map(o => (
              <div key={o.orderRef} style={{ background: "var(--card2)", border: "1px solid var(--line)", borderRadius: "16px", padding: "14px 16px" }} data-testid={`order-row-${o.orderRef}`}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                  <b style={{ fontSize: "16px" }}>{o.snapshotTitle}</b>
                  <span style={{ fontSize: "12px", padding: "4px 8px", borderRadius: "10px", fontWeight: 750, background: o.status === "potrjeno" ? "var(--acc)" : o.status === "prevzeto" ? "var(--accg)" : o.status === "zavrnjeno" ? "#D93A2B" : "var(--card)", color: (o.status === "potrjeno" || o.status === "prevzeto" || o.status === "zavrnjeno") ? "#fff" : "var(--tx)" }}>
                    {t(`UI.lg.order.status.${o.status}`)}
                  </span>
                </div>
                <div className="lg2-order-facts">
                  <span>{t("UI.lg.order.qty")}: {o.qty}</span>
                  {o.snapshotPrice && (
                    <span>
                      {t("UI.lg.order.price")}: {[o.snapshotPrice, o.snapshotPriceUnit].filter(Boolean).join(" / ")}
                    </span>
                  )}
                </div>
                 {o.statusNote && (
                   <div className="lg2-my-orders-note" data-testid={`order-status-note-${o.orderRef}`}>
                     <b>{t("UI.lg.order.statusNote")}:</b>
                     <span>{o.statusNote}</span>
                   </div>
                 )}
                <div className="lg2-order-meta">
                  <span>{t("UI.lg.order.ref")} {o.orderRef}</span>
                  <span>{t("UI.lg.order.created")}: {new Intl.DateTimeFormat(lang, { dateStyle: "short", timeStyle: "short" }).format(new Date(o.createdAt))}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        <button className="lg2-primary-button" style={{ marginTop: 24 }} onClick={onClose}>{t("UI.lg.action.back")}</button>
      </div>
    </div>
  );
}
