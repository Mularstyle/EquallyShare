import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LoaderCircle, Power, TriangleAlert, Users, Wifi, WifiOff } from "lucide-react";
import { errorMessage } from "../api";
import PortionView from "../components/PortionView";
import SharePanel from "../components/SharePanel";
import XPWindow from "../components/XPWindow";
import type { ConnectionState } from "../realtime";
import { useShare, type SharePhase } from "../useShare";

interface SharePageProps {
  shareId: string;
  onHome: () => void;
  onMinimize: () => void;
  onTitle: (title: string) => void;
}

function SectionHeader({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
        <span className="text-white font-bold text-sm">{number}</span>
      </div>
      <h2 className="text-xl font-bold text-gray-800 tracking-tight">{title}</h2>
    </div>
  );
}

function StatusBar({ connection, offline, expiresAt }: { connection: ConnectionState; offline: boolean; expiresAt?: string | undefined }) {
  const live = !offline && (connection === "live" || connection === "polling");
  const label = offline ? "Connection lost — reconnecting..." : connection === "live" ? "Live" : connection === "polling" ? "Auto-refresh" : connection === "reconnecting" ? "Reconnecting..." : "Connecting...";
  return (
    <div className="border-t-2 border-gray-400 px-4 py-2 text-sm text-gray-700 flex items-center gap-2 flex-wrap" style={{ background: "#ECE9D8" }} role="status">
      {live ? <Wifi size={14} className="text-green-600" /> : <WifiOff size={14} className="text-red-600" />}
      <div className={`w-2 h-2 rounded-full ${live ? "bg-green-500" : "bg-yellow-500 animate-pulse"}`} />
      <span>{label}</span>
      <div className="flex-1" />
      {expiresAt && <span className="text-xs opacity-70">หมดอายุ {new Date(expiresAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}</span>}
    </div>
  );
}

function ClosedView({ phase, onHome }: { phase: SharePhase & { kind: "closed" }; onHome: () => void }) {
  const title = phase.reason === "ended" ? "Share Ended" : phase.reason === "expired" ? "Share Expired" : phase.reason === "not-found" ? "Share Not Found" : phase.reason === "limit" ? "Recipient Limit Reached" : "Error";
  return (
    <div className="p-6 sm:p-8 space-y-6">
      <div className="flex items-start gap-4">
        <TriangleAlert size={40} className="text-yellow-600 shrink-0" />
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
          <p className="text-gray-700 mt-2">{phase.message}</p>
        </div>
      </div>
      <div className="flex justify-end">
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onHome} className="xp-button">สร้าง Share ใหม่</motion.button>
      </div>
    </div>
  );
}

export default function SharePage({ shareId, onHome, onMinimize, onTitle }: SharePageProps) {
  const { phase, connection, offline, refresh, end } = useShare(shareId);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState("");
  const [divided, setDivided] = useState<number>();
  const lastCount = useRef<number>(undefined);
  const snapshot = phase.kind === "ready" ? phase.snapshot : undefined;
  const shareUrl = `${window.location.origin}/s/${encodeURIComponent(shareId)}`;

  // Announce re-divisions: the count only ever grows.
  useEffect(() => {
    if (!snapshot) return;
    if (lastCount.current !== undefined && snapshot.recipientCount > lastCount.current) {
      setDivided(snapshot.recipientCount);
      const timer = setTimeout(() => setDivided(undefined), 3_000);
      lastCount.current = snapshot.recipientCount;
      return () => clearTimeout(timer);
    }
    lastCount.current = snapshot.recipientCount;
  }, [snapshot]);

  const title = snapshot ? `Share ÷${snapshot.recipientCount} — ผู้รับ #${snapshot.recipientNumber}` : "EquallyShare — Share";
  useEffect(() => { onTitle(title); }, [title, onTitle]);

  const handleEnd = async () => {
    if (!confirm("ปิด share นี้? ทุกคนจะไม่เห็นข้อมูลอีก และไม่มีใครเข้าร่วมเพิ่มได้")) return;
    setEnding(true);
    setEndError("");
    try { await end(); }
    catch (error) { setEndError(errorMessage(error)); }
    finally { setEnding(false); }
  };

  return (
    <motion.div key="share" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full max-w-4xl">
      <XPWindow title={title} onMinimize={onMinimize} onClose={onHome} closeTitle="Close (Back to Main)">
        {phase.kind === "loading" && (
          <div className="p-12 flex flex-col items-center gap-4 text-gray-700">
            <LoaderCircle size={40} className="animate-spin text-blue-600" />
            <p>กำลังรับส่วนแบ่งของคุณ...</p>
          </div>
        )}

        {phase.kind === "closed" && <ClosedView phase={phase} onHome={onHome} />}

        {snapshot && (
          <div className="p-4 sm:p-8 space-y-6">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 flex flex-col items-center justify-center text-white shadow-xp shrink-0">
                <span className="text-xs leading-none">÷</span>
                <span className="text-2xl font-black leading-none">{snapshot.recipientCount}</span>
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-gray-800">คุณคือผู้รับ #{snapshot.recipientNumber}{snapshot.recipientNumber === 1 && " (ผู้สร้าง)"}</p>
                <p className="text-gray-600 flex items-center gap-2"><Users size={16} /> ผู้รับทั้งหมด {snapshot.recipientCount} / {snapshot.maxRecipients} คน · ได้ข้อมูลประมาณ 1/{snapshot.recipientCount}</p>
              </div>
            </div>

            <AnimatePresence>
              {divided && (
                <motion.div role="status" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-yellow-100 border-2 border-yellow-500 p-3 text-yellow-900 font-semibold">
                  ✂️ มีคนเข้ามาเพิ่ม! ข้อมูลถูกหารใหม่เป็น ÷{divided}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3 space-y-4">
                <SectionHeader number="01" title="YOUR PORTION" />
                <div className="xp-panel p-4">
                  <PortionView snapshot={snapshot} onStale={refresh} />
                </div>
              </div>
              <div className="lg:col-span-2 space-y-4">
                <SectionHeader number="02" title="PASS IT ON" />
                <SharePanel shareUrl={shareUrl} />
                {snapshot.recipientNumber === 1 && (
                  <div className="space-y-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => void handleEnd()}
                      disabled={ending}
                      className="w-full bg-gradient-to-b from-red-400 to-red-600 hover:from-red-300 hover:to-red-500 text-white font-semibold py-3 px-6 shadow-xp border-2 border-red-700 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {ending ? <LoaderCircle size={18} className="animate-spin" /> : <Power size={18} />}
                      End share
                    </motion.button>
                    {endError && <p role="alert" className="text-sm text-red-700">{endError}</p>}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <StatusBar connection={connection} offline={offline} expiresAt={snapshot?.expiresAt} />
      </XPWindow>
    </motion.div>
  );
}
