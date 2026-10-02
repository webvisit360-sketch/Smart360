import { SheetTop } from "./SheetTop";
import { useRef, useState } from "react";
import { makeT } from "./i18n";
import { getPublicTenantLabelPdf } from "@workspace/api-client-react";

const stickerLabels: Record<string, { large: string; small: string; note: string; error: string }> = {
  sl: { large: "Prenesi veliko nalepko PDF", small: "Prenesi malo nalepko PDF", note: "PDF v angleščini", error: "Prenos ni uspel. Poskusite znova." },
  en: { large: "Download large sticker PDF", small: "Download small sticker PDF", note: "PDF in English", error: "Download failed. Please try again." },
  de: { large: "Großen Aufkleber als PDF herunterladen", small: "Kleinen Aufkleber als PDF herunterladen", note: "PDF auf Englisch", error: "Download fehlgeschlagen. Bitte erneut versuchen." },
  it: { large: "Scarica adesivo grande PDF", small: "Scarica adesivo piccolo PDF", note: "PDF in inglese", error: "Download non riuscito. Riprova." },
};

/** Share the guide or explicitly download one of the two canonical stickers. */
export function ShareSheet({ tenant, lang = "sl", isOpen, onClose }: { tenant: any, lang?: string, isOpen: boolean, onClose: () => void }) {
  const t = makeT(tenant, lang);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  const labels = stickerLabels[lang] ?? stickerLabels.sl;
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

  const downloadSticker = async (size: "large" | "small") => {
    setDownloading(true);
    setDownloadError(false);
    try {
      const pdf = await getPublicTenantLabelPdf(tenant.slug, { size });
      const href = URL.createObjectURL(pdf);
      const link = document.createElement("a");
      link.href = href;
      link.download = `smart360-sticker-${size}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(href), 60_000);
    } catch {
      setDownloadError(true);
    } finally {
      setDownloading(false);
    }
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

        {(["large", "small"] as const).map((size) => (
          <button key={size} className="srow" data-testid={`download-sticker-${size}`}
            disabled={downloading || !tenant?.slug} onClick={() => downloadSticker(size)}>
            <svg className="ic" viewBox="0 0 24 24"><use href="#i-print" /></svg>
            <div className="t"><b>{labels[size]}</b><span>{size === "large" ? "72.5 × 110 mm" : "36.3 × 55 mm"} · {labels.note}</span></div>
            <svg className="ic chev" viewBox="0 0 24 24"><use href="#i-chev" /></svg>
          </button>
        ))}
        {downloadError && <p role="alert" data-testid="sticker-download-error">{labels.error}</p>}
      </div>
    </>
  );
}
