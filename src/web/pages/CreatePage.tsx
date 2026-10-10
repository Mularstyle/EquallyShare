import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Scissors, Users } from "lucide-react";
import { createAudioShare, createImageShare, createTextShare, createVideoShare, errorMessage } from "../api";
import ContentInput, { type ContentDraft } from "../components/ContentInput";
import GenerateButton from "../components/GenerateButton";
import ShatterTransition from "../components/ShatterTransition";
import { countUnits, maxTextUnits } from "../components/TextInput";
import XPWindow from "../components/XPWindow";

interface CreatePageProps {
  onCreated: (shareId: string) => void;
  onMinimize: () => void;
}

type State = "idle" | "creating" | "shattering";

function HowItWorks() {
  const rows = [
    { icon: <Scissors size={18} />, text: "Share แปลว่าหาร: ข้อความ ภาพ เพลง MP3 หรือวิดีโอ MP4 ถูกแบ่งให้ผู้รับทุกคนคนละส่วน (เพลงและวิดีโอแบ่งเป็นช่วงเวลาต่อกัน)" },
    { icon: <Users size={18} />, text: "คุณคือผู้รับ #1 · ทุกคนที่เปิดลิงก์หรือสแกน QR ทำให้ส่วนของทุกคนเล็กลงทันที (สูงสุด 64 คน)" },
    { icon: <Clock size={18} />, text: "แก้ต้นฉบับไม่ได้ · share หมดอายุใน 24 ชั่วโมง หรือเมื่อคุณกด End share" },
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
          <span className="text-white font-bold text-sm">02</span>
        </div>
        <h2 className="text-xl font-bold text-gray-800 tracking-tight">HOW IT WORKS</h2>
      </div>
      <div className="xp-panel p-4 space-y-3">
        <div className="bg-white border-2 border-gray-300 p-4 text-center">
          <p className="font-mono text-2xl font-bold text-gray-800">ABCDEFGH</p>
          <div className="grid grid-cols-2 gap-2 mt-3 font-mono">
            <div className="bg-blue-50 border border-blue-300 p-1">2 คน: ABCD | EFGH</div>
            <div className="bg-blue-50 border border-blue-300 p-1">4 คน: AB | CD | EF | GH</div>
          </div>
        </div>
        {rows.map((row, i) => (
          <div key={i} className="flex items-start gap-3 text-sm text-gray-800">
            <span className="text-blue-600 mt-0.5 shrink-0">{row.icon}</span>
            <span>{row.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CreatePage({ onCreated, onMinimize }: CreatePageProps) {
  const [state, setState] = useState<State>("idle");
  const [content, setContent] = useState<ContentDraft>({ type: "text", text: "" });
  const [error, setError] = useState("");
  const [createdId, setCreatedId] = useState<string>();
  const [progress, setProgress] = useState<number>();

  const validate = (): string | undefined => {
    if (content.type === "text") {
      if (content.text.trim().length === 0) return "พิมพ์ข้อความก่อนแชร์";
      if (countUnits(content.text) > maxTextUnits) return "ข้อความยาวเกินไป";
    } else if (!content.file) return content.type === "image" ? "เลือกภาพก่อนแชร์" : content.type === "audio" ? "เลือกไฟล์ MP3 ก่อนแชร์" : "เลือกวิดีโอ MP4 ก่อนแชร์";
    return undefined;
  };

  const create = async () => {
    if (state !== "idle") return;
    const problem = validate();
    if (problem) { setError(problem); return; }
    setError("");
    setProgress(undefined);
    setState("creating");
    try {
      const response = content.type === "text" ? await createTextShare(content.text)
        : content.type === "image" ? await createImageShare(content.file!)
        : content.type === "audio" ? await createAudioShare(content.file!)
        : await createVideoShare(content.file!, setProgress);
      setCreatedId(response.snapshot.shareId);
      setState("shattering");
    } catch (failure) {
      setError(errorMessage(failure));
      setState("idle");
    }
  };

  // Ctrl/Cmd + Enter creates the share.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); void create(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const finish = useCallback(() => { if (createdId) onCreated(createdId); }, [createdId, onCreated]);
  const busy = state !== "idle";

  return (
    <>
      <motion.div key="create" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full max-w-4xl">
        <XPWindow title="EquallyShare — Share แปลว่าหาร" onMinimize={onMinimize}>
          <div className="p-4 sm:p-8 space-y-6">
            <AnimatePresence>
              {error && (
                <motion.div role="alert" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-red-100 border-2 border-red-500 p-4 text-red-700 font-semibold">
                  ⚠️ {error}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ContentInput content={content} onChange={(next) => { setContent(next); setError(""); }} onReject={setError} disabled={busy} />
              <HowItWorks />
            </div>

            <GenerateButton onClick={() => void create()} disabled={busy} loading={state === "creating"} />

            <div className="border-t-2 border-gray-400 px-4 py-2 text-sm text-gray-700 flex items-center gap-2" style={{ background: "#ECE9D8" }}>
              <div className={`w-2 h-2 rounded-full ${state === "idle" ? (error ? "bg-red-500" : "bg-green-500") : "bg-yellow-500 animate-pulse"}`} />
              <span>{state === "idle" ? (error ? "Error Occurred" : "System Ready") : state === "creating" ? (progress === undefined ? "Uploading..." : progress < 1 ? `Uploading ${Math.round(progress * 100)}%` : "Indexing keyframes...") : "Dividing..."}</span>
              <div className="flex-1" />
              <span className="text-xs opacity-60">EquallyShare v1.0</span>
            </div>
          </div>
        </XPWindow>
      </motion.div>

      <AnimatePresence>{state === "shattering" && <ShatterTransition onComplete={finish} />}</AnimatePresence>
    </>
  );
}
