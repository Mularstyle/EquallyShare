import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";

interface PdfPagesProps {
  /** Object URL of this Recipient's PDF (only their pages). */
  src: string;
  /** Page number in the original of the first page here, for labels. */
  firstPage: number;
}

/** Pages drawn right away; the rest are drawn as they scroll into view so a long PDF does not exhaust phone memory. */
const eagerPages = 3;

/**
 * Renders a PDF's pages to canvases with pdf.js, so it works on phones whose browsers cannot show
 * PDFs inline. pdf.js is loaded only when a PDF share is opened.
 */
export default function PdfPages({ src, firstPage }: PdfPagesProps) {
  const container = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    let cancelled = false;
    let document: PDFDocumentProxy | undefined;
    let observer: IntersectionObserver | undefined;
    const host = container.current;
    if (!host) return;
    setState("loading");
    (async () => {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const worker = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      document = await pdfjs.getDocument({ url: src, isEvalSupported: false }).promise;
      if (cancelled) return;
      const width = Math.max(280, host.clientWidth - 8);
      const scale = Math.min(1.5, window.devicePixelRatio || 1);

      const draw = async (figure: HTMLElement, number: number) => {
        if (figure.dataset.drawn) return;
        figure.dataset.drawn = "1";
        const page = await document!.getPage(number);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: (width / base.width) * scale });
        const canvas = window.document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = "100%";
        canvas.setAttribute("aria-label", `หน้า ${firstPage + number - 1}`);
        // "print" renders in one pass without requestAnimationFrame, which browsers pause in background tabs.
        await page.render({ canvasContext: canvas.getContext("2d")!, viewport, intent: "print" }).promise;
        page.cleanup();
        figure.querySelector("[data-placeholder]")?.replaceWith(canvas);
      };

      // A placeholder with the page's proportions for every page keeps scrolling stable before pages are drawn.
      const firstViewport = (await document.getPage(1)).getViewport({ scale: 1 });
      const figures: HTMLElement[] = [];
      for (let number = 1; number <= document.numPages; number++) {
        const figure = window.document.createElement("figure");
        figure.className = "bg-white shadow border border-gray-300";
        figure.dataset.page = String(number);
        const placeholder = window.document.createElement("div");
        placeholder.dataset.placeholder = "";
        placeholder.className = "bg-gray-50";
        placeholder.style.aspectRatio = `${firstViewport.width} / ${firstViewport.height}`;
        const caption = window.document.createElement("figcaption");
        caption.className = "text-[11px] text-gray-500 text-center py-1 border-t border-gray-200";
        caption.textContent = `หน้า ${firstPage + number - 1}`;
        figure.append(placeholder, caption);
        figures.push(figure);
      }
      host.replaceChildren(...figures);
      for (const figure of figures.slice(0, eagerPages)) await draw(figure, Number(figure.dataset.page));
      if (cancelled) return;
      setState("ready");

      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const figure = entry.target as HTMLElement;
          observer?.unobserve(figure);
          void draw(figure, Number(figure.dataset.page)).catch(() => undefined);
        }
      }, { root: host, rootMargin: "600px 0px" });
      for (const figure of figures.slice(eagerPages)) observer.observe(figure);
    })().catch(() => { if (!cancelled) setState("failed"); });
    return () => {
      cancelled = true;
      observer?.disconnect();
      void document?.destroy();
    };
  }, [src, firstPage]);

  return (
    <div className="relative">
      <div ref={container} className="space-y-3 max-h-[60vh] overflow-auto p-1" />
      {state === "loading" && <div className="flex justify-center py-8"><LoaderCircle size={32} className="animate-spin text-blue-600" /></div>}
      {state === "failed" && <p className="text-sm text-red-600 py-4 text-center">แสดงหน้า PDF ไม่ได้ ใช้ปุ่มเปิด PDF แทน</p>}
    </div>
  );
}
