import { SheetTop } from "./SheetTop";
import { useRef, useState } from "react";
import { makeT } from "./i18n";

/** Deli to stran — QR, native share, copy link, printable A6 label (paket 14). */
export function ShareSheet({ tenant, lang = "sl", isOpen, onClose }: { tenant: any, lang?: string, isOpen: boolean, onClose: () => void }) {
  const t = makeT(tenant, lang);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const url: string = tenant?.publicUrl ?? "";
  const shortUrl = url.replace(/^https?:\/\//, "");
  const canShare = typeof navigator !== "undefined" && !!navigator.share;

  const shareNative = () => {
    // A cancelled share rejects — swallow it, never surface an error.
    navigator.share({ title: tenant.name, text: tenant.subtitle ?? undefined, url }).catch(() => {});
  };

  const copyLink = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback for older/insecure contexts.
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      /* copy failed — leave the label unchanged */
    }
  };

  const printLabel = () => {
    let el = document.getElementById("printcard");
    if (!el) {
      el = document.createElement("div");
      el.id = "printcard";
      // Namizni zaslon: vse plasti gostujoče aplikacije živijo v #frame —
      // element, dodan na body, bi ušel iz stolpca (namizni-zaslon.md).
      (document.getElementById("frame") ?? document.body).appendChild(el);
    }
    // The label hangs in a guest room — it carries the ACCOMMODATION's logo
    // (transparent file: prints clean on white paper), never the Smart360
    // wordmark. No logo → the card is simply headed by the name.
    const logoImg = tenant.logoUrl
      ? `<img class="pc__logo" src="${String(tenant.logoUrl).replace(/"/g, "&quot;")}" alt="">`
      : "";
    el.innerHTML = `<div class="pc">
      ${logoImg}
      <div class="pc__qr">${tenant.qrSvg ?? ""}</div>
      <div class="pc__n"></div>
      <div class="pc__s">Skenirajte za vse o nastanitvi in okolici<br><i>Scan for everything about your stay</i></div>
      <div class="pc__u"></div>
    </div>`;
    // Name and URL via textContent — tenant data must never be parsed as HTML.
    el.querySelector(".pc__n")!.textContent = tenant.name ?? "";
    el.querySelector(".pc__u")!.textContent = shortUrl;
    window.print();
  };

  return (
    <>
      <div className={`mask ${isOpen ? 'on' : ''}`} onClick={onClose}></div>
      <div className={`sheet ${isOpen ? 'on' : ''}`}>
        <SheetTop isOpen={isOpen} onClose={onClose} />
        <h3>{t("UI.share.title")}</h3>
        <div className="sub">{t("UI.share.sub")}</div>

        <div className="qrbox">
          <div className="qrbox__code" dangerouslySetInnerHTML={{ __html: tenant?.qrSvg ?? "" }} />
          <div className="qrbox__u">{shortUrl}</div>
        </div>

        {canShare && (
          <button className="srow" onClick={shareNative}>
            <svg className="ic" viewBox="0 0 24 24"><use href="#i-share" /></svg>
            <div className="t"><b>{t("UI.share.native")}</b><span>{t("UI.share.native.sub")}</span></div>
            <svg className="ic chev" viewBox="0 0 24 24"><use href="#i-chev" /></svg>
          </button>
        )}

        <button className="srow" onClick={copyLink}>
          <svg className="ic" viewBox="0 0 24 24"><use href="#i-copy" /></svg>
          <div className="t"><b>{copied ? t("UI.share.copied") : t("UI.share.copy")}</b><span>{shortUrl}</span></div>
          <svg className="ic chev" viewBox="0 0 24 24"><use href="#i-chev" /></svg>
        </button>

        <button className="srow" onClick={printLabel}>
          <svg className="ic" viewBox="0 0 24 24"><use href="#i-print" /></svg>
          <div className="t"><b>{t("UI.share.print")}</b><span>{t("UI.share.print.sub")}</span></div>
          <svg className="ic chev" viewBox="0 0 24 24"><use href="#i-chev" /></svg>
        </button>
      </div>
    </>
  );
}
