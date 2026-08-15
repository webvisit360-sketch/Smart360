import { useRef, useState } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { QrCode, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

function guestUrl(slug: string, customDomain?: string | null): string {
  if (customDomain) return `https://${customDomain}`;
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  return `${window.location.origin}${base}/g/${slug}`;
}

export function QrDialog({
  slug,
  name,
  customDomain,
}: {
  slug: string;
  name: string;
  customDomain?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const svgWrapRef = useRef<HTMLDivElement>(null);
  const url = guestUrl(slug, customDomain);

  const downloadPng = () => {
    const canvas = canvasWrapRef.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `smart360-qr-${slug}.png`;
    a.click();
  };

  const downloadSvg = () => {
    const svg = svgWrapRef.current?.querySelector("svg");
    if (!svg) return;
    const blob = new Blob(
      ['<?xml version="1.0" encoding="UTF-8"?>' + svg.outerHTML],
      { type: "image/svg+xml" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `smart360-qr-${slug}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <QrCode className="h-4 w-4 mr-2" /> QR koda
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR koda — {name}</DialogTitle>
          <DialogDescription className="break-all">{url}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-6 py-4">
          <div ref={svgWrapRef} className="bg-white p-4 rounded-2xl border">
            <QRCodeSVG value={url} size={220} level="M" includeMargin />
          </div>
          {/* Hidden high-res canvas used for the PNG export */}
          <div ref={canvasWrapRef} className="hidden">
            <QRCodeCanvas value={url} size={1024} level="M" includeMargin />
          </div>
          <div className="flex gap-3">
            <Button onClick={downloadPng}>
              <Download className="h-4 w-4 mr-2" /> PNG (za tisk)
            </Button>
            <Button variant="outline" onClick={downloadSvg}>
              <Download className="h-4 w-4 mr-2" /> SVG
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
