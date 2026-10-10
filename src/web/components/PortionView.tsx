import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { LoaderCircle } from "lucide-react";
import type { RecipientSnapshot } from "../../shared/contracts";
import { fetchMedia } from "../api";
import PdfPages from "./PdfPages";

interface PortionViewProps {
  snapshot: RecipientSnapshot;
  /** Called when the server says the media revision is stale, so the page refetches its snapshot. */
  onStale: () => void;
}

const percent = (part: number, total: number) => total === 0 ? "0" : ((part / total) * 100).toLocaleString(undefined, { maximumFractionDigits: 2 });

function TextPortion({ snapshot }: { snapshot: RecipientSnapshot & { allocation: { kind: "text" } } }) {
  const { text, unitCount, totalUnits } = snapshot.allocation;
  return (
    <div className="space-y-2">
      <div className="bg-white border-2 border-gray-300 p-4 min-h-[140px] max-h-[50vh] overflow-auto">
        {unitCount === 0 ? (
          <p className="text-gray-500 italic text-center py-8">คุณได้รับข้อมูล 0 ตัวอักษร</p>
        ) : (
          <p className="font-mono text-base text-gray-900 whitespace-pre-wrap break-words">{text}</p>
        )}
      </div>
      <p className="text-xs text-gray-600">ได้ {unitCount.toLocaleString()} จาก {totalUnits.toLocaleString()} ตัวอักษร ({percent(unitCount, totalUnits)}%)</p>
    </div>
  );
}

/** Loads this Recipient's media for one revision as an object URL; refetches the snapshot when the revision is stale. */
function useMediaUrl(url: string | null, onStale: () => void) {
  const [src, setSrc] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!url) { setSrc(undefined); return; }
    const controller = new AbortController();
    let objectUrl: string | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      setLoading(true);
      setFailed(false);
      try {
        const result = await fetchMedia(url, controller.signal);
        if (result.kind === "media") {
          objectUrl = URL.createObjectURL(result.blob);
          setSrc(objectUrl);
          setLoading(false);
        } else if (result.kind === "busy") {
          retry = setTimeout(() => void load(), 1_000);
        } else if (result.kind === "stale") {
          onStale();
        } else {
          setSrc(undefined);
          setLoading(false);
        }
      } catch {
        if (!controller.signal.aborted) { setFailed(true); setLoading(false); }
      }
    };
    void load();
    return () => {
      controller.abort();
      if (retry) clearTimeout(retry);
      // Keep the previous media on screen until the next revision's arrives.
      if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl!), 5_000);
    };
  }, [url, onStale]);

  return { src, loading, failed };
}

function ImagePortion({ snapshot, onStale }: PortionViewProps & { snapshot: RecipientSnapshot & { allocation: { kind: "image" } } }) {
  const { imageUrl, pixelCount, totalPixels, width, height } = snapshot.allocation;
  const { src, loading, failed } = useMediaUrl(imageUrl, onStale);

  return (
    <div className="space-y-2">
      <div className="relative bg-white border-2 border-gray-300 p-2 min-h-[160px] flex items-center justify-center" style={{ backgroundImage: "repeating-conic-gradient(#eee 0% 25%, #fff 0% 50%)", backgroundSize: "16px 16px" }}>
        {pixelCount === 0 ? (
          <p className="text-gray-500 italic text-center py-8 bg-white/80 px-3">คุณได้รับข้อมูล 0 พิกเซล</p>
        ) : src ? (
          <img src={src} alt={`ส่วนของภาพที่คุณได้รับ ${width}×${height} พิกเซล`} width={width} height={height} className={`max-w-full max-h-[50vh] object-contain transition-opacity ${loading ? "opacity-50" : ""}`} />
        ) : failed ? (
          <p className="text-red-600 text-sm">โหลดภาพไม่สำเร็จ</p>
        ) : null}
        {loading && <LoaderCircle size={32} className="absolute animate-spin text-blue-600" />}
      </div>
      <p className="text-xs text-gray-600">ได้ {pixelCount.toLocaleString()} จาก {totalPixels.toLocaleString()} พิกเซล ({percent(pixelCount, totalPixels)}%){pixelCount > 0 && ` · บล็อก ${width}×${height}`}</p>
    </div>
  );
}

const clock = (ms: number) => {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

/** Where a segment sits in the whole track or clip. */
function Timeline({ startMs, durationMs, totalDurationMs, labels }: { startMs: number; durationMs: number; totalDurationMs: number; labels?: [string, string] }) {
  const left = totalDurationMs ? (startMs / totalDurationMs) * 100 : 0;
  const width = totalDurationMs ? (durationMs / totalDurationMs) * 100 : 0;
  return (
    <div className="space-y-1" aria-hidden="true">
      <div className="relative h-4 border-2 border-gray-400 bg-gray-200">
        {width > 0 && <div className="absolute inset-y-0 bg-gradient-to-b from-blue-400 to-blue-600" style={{ left: `${left}%`, width: `max(${width}%, 2px)` }} />}
      </div>
      <div className="flex justify-between text-[11px] text-gray-500 font-mono"><span>{labels?.[0] ?? "0:00"}</span><span>{labels?.[1] ?? clock(totalDurationMs)}</span></div>
    </div>
  );
}

const seconds = (ms: number) => (ms / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 });

function PdfPortion({ snapshot, onStale }: PortionViewProps & { snapshot: RecipientSnapshot & { allocation: { kind: "pdf" } } }) {
  const { pdfUrl, startPage, pageCount, totalPages } = snapshot.allocation;
  const { src, failed } = useMediaUrl(pdfUrl, onStale);
  const endPage = startPage + pageCount - 1;
  return (
    <div className="space-y-3">
      <div className="bg-gray-100 border-2 border-gray-300 p-2 space-y-3">
        {pageCount === 0 ? (
          <p className="text-gray-500 italic text-center py-8 bg-white">คุณได้รับข้อมูล 0 หน้า</p>
        ) : src ? (
          <>
            <PdfPages src={src} firstPage={startPage} />
            <a href={src} target="_blank" rel="noopener" download={`pages-${startPage}-${endPage}.pdf`} className="xp-button-silver inline-block text-sm">เปิด PDF ของคุณ</a>
          </>
        ) : failed ? <p className="text-red-600 text-sm">โหลด PDF ไม่สำเร็จ</p>
          : <div className="flex justify-center py-8"><LoaderCircle size={32} className="animate-spin text-blue-600" /></div>}
        <Timeline startMs={Math.max(0, startPage - 1)} durationMs={pageCount} totalDurationMs={totalPages} labels={["หน้า 1", `หน้า ${totalPages}`]} />
      </div>
      <p className="text-xs text-gray-600">
        {pageCount === 0 ? `ได้ 0 จาก ${totalPages} หน้า` : `ได้หน้า ${startPage}${pageCount > 1 ? `–${endPage}` : ""} (${pageCount} หน้า) จาก ${totalPages} หน้า`} ({percent(pageCount, totalPages)}%)
      </p>
    </div>
  );
}

function VideoPortion({ snapshot, onStale }: PortionViewProps & { snapshot: RecipientSnapshot & { allocation: { kind: "video" } } }) {
  const { videoUrl, startMs, durationMs, totalDurationMs, segmentCount } = snapshot.allocation;
  const [loading, setLoading] = useState(true);
  useEffect(() => setLoading(Boolean(videoUrl)), [videoUrl]);
  return (
    <div className="space-y-3">
      <div className="bg-white border-2 border-gray-300 p-2 space-y-3">
        {segmentCount === 0 ? (
          <p className="text-gray-500 italic text-center py-8">คุณได้รับข้อมูล 0 วินาที</p>
        ) : (
          <div className="relative bg-black flex items-center justify-center min-h-[160px]">
            {/* The server redirects to a short-lived link for this segment only, so the player can stream and seek. */}
            <video key={videoUrl} src={videoUrl ?? undefined} controls playsInline preload="metadata" className="w-full max-h-[50vh]"
              onLoadedData={() => setLoading(false)} onError={() => { setLoading(false); onStale(); }} aria-label={`ช่วงวิดีโอของคุณ ${clock(startMs)} ถึง ${clock(startMs + durationMs)}`} />
            {loading && <LoaderCircle size={32} className="absolute animate-spin text-white pointer-events-none" />}
          </div>
        )}
        <Timeline startMs={startMs} durationMs={durationMs} totalDurationMs={totalDurationMs} />
      </div>
      <p className="text-xs text-gray-600">
        {segmentCount === 0 ? `ได้ 0 จาก ${clock(totalDurationMs)}` : `ได้ช่วง ${clock(startMs)}–${clock(startMs + durationMs)} (${seconds(durationMs)} วินาที) จาก ${clock(totalDurationMs)}`} ({percent(durationMs, totalDurationMs)}%)
      </p>
    </div>
  );
}

function AudioPortion({ snapshot, onStale }: PortionViewProps & { snapshot: RecipientSnapshot & { allocation: { kind: "audio" } } }) {
  const { audioUrl, startMs, durationMs, totalDurationMs, frameCount } = snapshot.allocation;
  const { src, loading, failed } = useMediaUrl(audioUrl, onStale);
  return (
    <div className="space-y-3">
      <div className="bg-white border-2 border-gray-300 p-4 space-y-3">
        {frameCount === 0 ? (
          <p className="text-gray-500 italic text-center py-6">คุณได้รับข้อมูล 0 วินาที</p>
        ) : (
          <div className="relative min-h-[54px] flex items-center">
            {src ? <audio key={src} src={src} controls className={`w-full ${loading ? "opacity-50" : ""}`} aria-label={`ช่วงเพลงของคุณ ${clock(startMs)} ถึง ${clock(startMs + durationMs)}`} />
              : failed ? <p className="text-red-600 text-sm">โหลดเสียงไม่สำเร็จ</p> : null}
            {loading && <LoaderCircle size={28} className="absolute left-1/2 -translate-x-1/2 animate-spin text-blue-600" />}
          </div>
        )}
        <Timeline startMs={startMs} durationMs={durationMs} totalDurationMs={totalDurationMs} />
      </div>
      <p className="text-xs text-gray-600">
        {frameCount === 0 ? `ได้ 0 จาก ${clock(totalDurationMs)}` : `ได้ช่วง ${clock(startMs)}–${clock(startMs + durationMs)} (${(durationMs / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} วินาที) จาก ${clock(totalDurationMs)}`} ({percent(durationMs, totalDurationMs)}%)
      </p>
    </div>
  );
}

/** Shows only this Recipient's current portion; the server never sends the rest of the original. */
export default function PortionView({ snapshot, onStale }: PortionViewProps) {
  return (
    <motion.div key={snapshot.revision} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      {snapshot.allocation.kind === "text"
        ? <TextPortion snapshot={snapshot as RecipientSnapshot & { allocation: { kind: "text" } }} />
        : snapshot.allocation.kind === "image"
          ? <ImagePortion snapshot={snapshot as RecipientSnapshot & { allocation: { kind: "image" } }} onStale={onStale} />
          : snapshot.allocation.kind === "audio"
            ? <AudioPortion snapshot={snapshot as RecipientSnapshot & { allocation: { kind: "audio" } }} onStale={onStale} />
            : snapshot.allocation.kind === "video"
              ? <VideoPortion snapshot={snapshot as RecipientSnapshot & { allocation: { kind: "video" } }} onStale={onStale} />
              : <PdfPortion snapshot={snapshot as RecipientSnapshot & { allocation: { kind: "pdf" } }} onStale={onStale} />}
    </motion.div>
  );
}
