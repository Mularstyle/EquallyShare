import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";

interface PdfPagesProps {
  /** Object URL of this Recipient's PDF (only their pages). */
  src: string;
  /** Page number in the original of the first page here, for labels. */
  firstPage: number;
}

/**
 * Renders every page of a small PDF to canvases with pdf.js, so it works on phones whose
 * browsers cannot show PDFs inline. pdf.js is loaded only when a PDF share is opened.
 */
export default function PdfPages({ src, firstPage }: PdfPagesProps) {
  const container = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    let cancelled = false;
    const host = container.current;
    if (!host) return;
    setState("loading");
    (async () => {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const worker = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      const document = await pdfjs.getDocument({ url: src, isEvalSupported: false }).promise;
      const canvases: HTMLElement[] = [];
      const width = Math.max(280, host.clientWidth - 8);
      for (let number = 1; number <= document.numPages; number++) {
        const page = await document.getPage(number);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: (width / base.width) * Math.min(2, window.devicePixelRatio || 1) });
        const canvas = window.document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = "100%";
        canvas.setAttribute("aria-label", `หน้า ${firstPage + number - 1}`);
        // "print" renders in one pass without requestAnimationFrame, which browsers pause in background tabs.
        await page.render({ canvasContext: canvas.getContext("2d")!, viewport, intent: "print" }).promise;
        const figure = window.document.createElement("figure");
        figure.className = "bg-white shadow border border-gray-300";
        const caption = window.document.createElement("figcaption");
        caption.className = "text-[11px] text-gray-500 text-center py-1 border-t border-gray-200";
        caption.textContent = `หน้า ${firstPage + number - 1}`;
        figure.append(canvas, caption);
        canvases.push(figure);
        if (cancelled) break;
      }
      await document.destroy();
      if (!cancelled) { host.replaceChildren(...canvases); setState("ready"); }
    })().catch(() => { if (!cancelled) setState("failed"); });
    return () => { cancelled = true; };
  }, [src, firstPage]);

  return (
    <div className="relative">
      <div ref={container} className="space-y-3 max-h-[60vh] overflow-auto p-1" />
      {state === "loading" && <div className="flex justify-center py-8"><LoaderCircle size={32} className="animate-spin text-blue-600" /></div>}
      {state === "failed" && <p className="text-sm text-red-600 py-4 text-center">แสดงหน้า PDF ไม่ได้ ใช้ปุ่มเปิด PDF แทน</p>}
    </div>
  );
}
