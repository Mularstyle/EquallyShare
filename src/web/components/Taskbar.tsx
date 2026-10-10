import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface TaskbarProps {
  label: string;
  onRestore: () => void;
}

/** XP taskbar shown while the window is minimized (from the frontend branch design). */
export default function Taskbar({ label, onRestore }: TaskbarProps) {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      exit={{ y: 100 }}
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{ background: "linear-gradient(180deg, #245EDC 0%, #1941A5 100%)", height: "48px", boxShadow: "0 -2px 8px rgba(0,0,0,0.3)" }}
    >
      <div className="h-full flex items-center px-2 gap-2">
        <div
          className="h-10 px-4 flex items-center gap-2 font-bold text-white shrink-0"
          style={{ background: "linear-gradient(180deg, #3C8F3E 0%, #2D6A2E 100%)", border: "1px solid rgba(255,255,255,0.3)", boxShadow: "inset 1px 1px 2px rgba(255,255,255,0.3), 1px 1px 2px rgba(0,0,0,0.3)" }}
        >
          <div className="w-5 h-5 bg-white flex items-center justify-center text-xs font-black text-green-600">⊞</div>
          <span className="text-sm">start</span>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onRestore}
          className="h-10 px-4 min-w-0 flex items-center gap-2 bg-gradient-to-b from-blue-400 to-blue-600 text-white font-semibold text-sm shadow-lg border-2 border-blue-700"
        >
          <div className="w-4 h-4 shrink-0 bg-white flex items-center justify-center text-blue-600 font-bold text-xs">XP</div>
          <span className="truncate">{label}</span>
        </motion.button>

        <div className="flex-1" />

        <div className="flex items-center gap-2 px-3 h-8 border-l border-blue-700 shrink-0">
          <span className="text-xs text-white font-semibold">{time.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
      </div>
    </motion.div>
  );
}
