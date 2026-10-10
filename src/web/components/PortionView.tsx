import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { LoaderCircle } from "lucide-react";
import type { RecipientSnapshot } from "../../shared/contracts";
import { fetchCollage } from "../api";

interface PortionViewProps {
  snapshot: RecipientSnapshot;
  /** Called when the server says the collage revision is stale, so the page refetches its snapshot. */
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

function ImagePortion({ snapshot, onStale }: PortionViewProps & { snapshot: RecipientSnapshot & { allocation: { kind: "image" } } }) {
  const { imageUrl, pixelCount, totalPixels, fragmentCount, width, height } = snapshot.allocation;
  const [src, setSrc] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!imageUrl) { setSrc(undefined); return; }
    const controller = new AbortController();
    let objectUrl: string | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      setLoading(true);
      setFailed(false);
      try {
        const result = await fetchCollage(imageUrl, controller.signal);
        if (result.kind === "image") {
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
      // Keep the previous picture on screen until the next revision's collage arrives.
      if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl!), 5_000);
    };
  }, [imageUrl, onStale]);

  return (
    <div className="space-y-2">
      <div className="relative bg-white border-2 border-gray-300 p-2 min-h-[160px] flex items-center justify-center" style={{ backgroundImage: "repeating-conic-gradient(#eee 0% 25%, #fff 0% 50%)", backgroundSize: "16px 16px" }}>
        {pixelCount === 0 ? (
          <p className="text-gray-500 italic text-center py-8 bg-white/80 px-3">คุณได้รับข้อมูล 0 พิกเซล</p>
        ) : src ? (
          <img src={src} alt={`ชิ้นส่วนภาพของคุณ ${fragmentCount} ชิ้น`} width={width} height={height} className={`max-w-full max-h-[50vh] object-contain transition-opacity ${loading ? "opacity-50" : ""}`} style={{ imageRendering: "pixelated" }} />
        ) : failed ? (
          <p className="text-red-600 text-sm">โหลดภาพไม่สำเร็จ</p>
        ) : null}
        {loading && <LoaderCircle size={32} className="absolute animate-spin text-blue-600" />}
      </div>
      <p className="text-xs text-gray-600">ได้ {pixelCount.toLocaleString()} จาก {totalPixels.toLocaleString()} พิกเซล ({percent(pixelCount, totalPixels)}%) · {fragmentCount.toLocaleString()} ชิ้น</p>
    </div>
  );
}

/** Shows only this Recipient's current portion; the server never sends the rest of the original. */
export default function PortionView({ snapshot, onStale }: PortionViewProps) {
  return (
    <motion.div key={snapshot.revision} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      {snapshot.allocation.kind === "text"
        ? <TextPortion snapshot={snapshot as RecipientSnapshot & { allocation: { kind: "text" } }} />
        : <ImagePortion snapshot={snapshot as RecipientSnapshot & { allocation: { kind: "image" } }} onStale={onStale} />}
    </motion.div>
  );
}
