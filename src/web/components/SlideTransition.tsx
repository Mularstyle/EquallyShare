import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type SlidePhase = "cover" | "reveal";

interface SlideTransitionProps {
  /** "cover" wipes the slide in over the page; "reveal" holds it briefly (the page underneath switches meanwhile), then wipes it away. */
  phase: SlidePhase;
  onDone: () => void;
}

const rows = 6;
const columns = 8;
/** Few, visible steps: PowerPoint 2003 transitions were famously choppy. */
const steps = 14;
const stepMs = 55;
const holdMs = 450;
/** One slide background shared by every box (each box shows its own slice), so the finished slide has no seams. */
const slideBackground = "linear-gradient(160deg, #1c3f9e 0%, #2f6fd6 55%, #7fb2f0 100%)";

/**
 * PowerPoint 2003 "Checkerboard Across": every box wipes left to right, alternate boxes half a box behind.
 * Driven by timers rather than requestAnimationFrame, so a background tab cannot leave it stuck.
 */
export default function SlideTransition({ phase, onDone }: SlideTransitionProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Hidden tabs throttle timers to about one tick per second, which would stretch this to ~15 s:
    // nobody can see it there, so skip straight to the end (also for reduced-motion users).
    if (document.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { onDone(); return; }
    setStep(0);
    let current = 0;
    let finished = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const finish = () => { if (!finished) { finished = true; if (timer) clearInterval(timer); if (hold) clearTimeout(hold); onDone(); } };
    const onHidden = () => { if (document.hidden) finish(); };
    document.addEventListener("visibilitychange", onHidden);
    const run = () => {
      timer = setInterval(() => {
        current++;
        setStep(current);
        if (current >= steps) finish();
      }, stepMs);
    };
    // The full slide stays up for a beat before wiping off, like clicking to the next slide;
    // the next page renders underneath during that pause.
    const hold = phase === "reveal" ? setTimeout(run, holdMs) : undefined;
    if (phase === "cover") run();
    return () => {
      finished = true;
      if (timer) clearInterval(timer);
      if (hold) clearTimeout(hold);
      document.removeEventListener("visibilitychange", onHidden);
    };
    // onDone is intentionally not a dependency: a new callback must not restart the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const progress = step / steps;
  // Portaled to <body> so "fixed" always means the viewport, whatever the page's own layout does.
  return createPortal(
    <div className="fixed inset-0 z-50 pointer-events-none" aria-hidden="true">
      {Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, column) => {
        // Checkerboard: odd boxes start half a box later. Each box spans two halves of the timeline.
        const offset = (row + column) % 2 ? 0.5 : 0;
        const local = Math.min(1, Math.max(0, progress * 1.5 - offset));
        const filled = phase === "cover" ? local : 1 - local;
        return (
          <div key={`${row}-${column}`} className="absolute overflow-hidden"
            style={{ left: `${(column / columns) * 100}%`, top: `${(row / rows) * 100}%`, width: `${100 / columns + 0.1}%`, height: `${100 / rows + 0.1}%` }}>
            {/* During "reveal" the remaining part sits on the right, so boxes still clear left to right. */}
            <div className={`h-full ${phase === "cover" ? "" : "ml-auto"}`} style={{
              width: `${filled * 100}%`,
              background: slideBackground,
              backgroundSize: "100vw 100vh",
              // Offset the shared background by this fill's own position on screen.
              backgroundPosition: `-${(column + (phase === "cover" ? 0 : 1 - filled)) * (100 / columns)}vw -${row * (100 / rows)}vh`,
            }} />
          </div>
        );
      }))}
      {((phase === "cover" && step >= steps) || (phase === "reveal" && step === 0)) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-6">
          {/* WordArt, the other unmistakable 2000s Office feature. */}
          <p className="font-black italic text-5xl sm:text-7xl" style={{
            fontFamily: "Impact, 'Arial Black', Tahoma, 'Leelawadee UI', sans-serif",
            background: "linear-gradient(180deg, #fff6a8 0%, #ffcc00 45%, #ff7b00 100%)",
            WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
            WebkitTextStroke: "2px #7a2e00", filter: "drop-shadow(4px 4px 0 rgba(0,0,0,0.45))",
            transform: "perspective(400px) rotateX(12deg)",
          }}>Share แปลว่าหาร</p>
          <p className="text-white text-lg sm:text-xl font-bold drop-shadow" style={{ fontFamily: "Tahoma, 'Leelawadee UI', sans-serif" }}>• กำลังหารข้อมูลให้ทุกคน...</p>
        </div>
      )}
    </div>,
    document.body,
  );
}
