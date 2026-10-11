import { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import AnimatedBackground from "./components/AnimatedBackground";
import SlideTransition, { type SlidePhase } from "./components/SlideTransition";
import Taskbar from "./components/Taskbar";
import CreatePage from "./pages/CreatePage";
import SharePage from "./pages/SharePage";

const shareIdFrom = (path: string) => /^\/s\/([^/]+)\/?$/.exec(path)?.[1];

function useCursorTrail() {
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const trail = document.createElement("div");
    trail.className = "cursor-trail";
    document.body.appendChild(trail);
    let mouseX = 0, mouseY = 0, trailX = 0, trailY = 0, frame = 0;
    const onMove = (e: MouseEvent) => { mouseX = e.clientX; mouseY = e.clientY; };
    const update = () => {
      trailX += (mouseX - trailX) * 0.1;
      trailY += (mouseY - trailY) * 0.1;
      trail.style.left = `${trailX - 10}px`;
      trail.style.top = `${trailY - 10}px`;
      frame = requestAnimationFrame(update);
    };
    window.addEventListener("mousemove", onMove);
    frame = requestAnimationFrame(update);
    return () => { window.removeEventListener("mousemove", onMove); cancelAnimationFrame(frame); trail.remove(); };
  }, []);
}

export default function App() {
  const [path, setPath] = useState(() => window.location.pathname);
  const [minimized, setMinimized] = useState(false);
  const [shareTitle, setShareTitle] = useState("EquallyShare — Share");
  const [slide, setSlide] = useState<{ phase: SlidePhase; target: string }>();
  useCursorTrail();

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((next: string) => {
    window.history.pushState(null, "", next);
    setPath(next);
    setMinimized(false);
  }, []);

  const shareId = shareIdFrom(path);
  const goHome = useCallback(() => navigate("/"), [navigate]);
  // A new share opens behind a PowerPoint-style slide: cover, switch page, reveal.
  const openShare = useCallback((id: string) => setSlide({ phase: "cover", target: `/s/${encodeURIComponent(id)}` }), []);
  const slideDone = useCallback(() => {
    if (slide?.phase === "cover") {
      navigate(slide.target);
      setSlide({ phase: "reveal", target: slide.target });
    } else setSlide(undefined);
  }, [slide, navigate]);
  const minimize = useCallback(() => setMinimized(true), []);

  return (
    <div className="relative min-h-screen overflow-x-hidden scanlines">
      <AnimatedBackground />

      {/* Top-aligned on small screens so a tall window scrolls instead of being clipped. */}
      <div className={`relative z-10 min-h-screen flex items-start lg:items-center justify-center p-3 sm:p-4 pb-16 ${minimized ? "invisible" : ""}`}>
        <AnimatePresence mode="wait">
          {shareId
            ? <SharePage key={shareId} shareId={decodeURIComponent(shareId)} onHome={goHome} onMinimize={minimize} onTitle={setShareTitle} />
            : <CreatePage key="create" onCreated={openShare} onMinimize={minimize} />}
        </AnimatePresence>
      </div>

      {slide && <SlideTransition phase={slide.phase} onDone={slideDone} />}

      <AnimatePresence>
        {minimized && <Taskbar label={shareId ? shareTitle : "EquallyShare — Share แปลว่าหาร"} onRestore={() => setMinimized(false)} />}
      </AnimatePresence>
    </div>
  );
}
