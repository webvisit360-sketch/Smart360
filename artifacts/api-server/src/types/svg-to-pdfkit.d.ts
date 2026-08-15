declare module "svg-to-pdfkit" {
  import type PDFDocument from "pdfkit";
  function SVGtoPDF(
    doc: PDFDocument,
    svg: string,
    x: number,
    y: number,
    options?: {
      width?: number;
      height?: number;
      preserveAspectRatio?: string;
      assumePt?: boolean;
    },
  ): void;
  export = SVGtoPDF;
}
