import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

interface ShatterTransitionProps {
  onComplete: () => void;
}

/** The window breaking into pieces: shown once while a new share opens (from the frontend branch design). */
export default function ShatterTransition({ onComplete }: ShatterTransitionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) { completeRef.current(); return; }

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const cols = 8;
    const rows = 6;
    const fragmentWidth = canvas.width / cols;
    const fragmentHeight = canvas.height / rows;
    const fragments: { x: number; y: number; vx: number; vy: number; rotation: number; rotationSpeed: number }[] = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * fragmentWidth;
        const y = row * fragmentHeight;
        const dx = x + fragmentWidth / 2 - canvas.width / 2;
        const dy = y + fragmentHeight / 2 - canvas.height / 2;
        const distance = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        fragments.push({ x, y, vx: Math.cos(angle) * (distance / 50 + 2), vy: Math.sin(angle) * (distance / 50 + 2), rotation: 0, rotationSpeed: (Math.random() - 0.5) * 0.1 });
      }
    }

    let frame = 0;
    let handle = 0;
    const maxFrames = 75;
    const animate = () => {
      frame++;
      ctx.fillStyle = "rgba(30, 58, 138, 0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const opacity = Math.max(0, 1 - frame / maxFrames);
      for (const frag of fragments) {
        frag.x += frag.vx;
        frag.y += frag.vy;
        frag.rotation += frag.rotationSpeed;
        ctx.save();
        ctx.translate(frag.x + fragmentWidth / 2, frag.y + fragmentHeight / 2);
        ctx.rotate(frag.rotation);
        ctx.globalAlpha = opacity;
        const gradient = ctx.createLinearGradient(-fragmentWidth / 2, -fragmentHeight / 2, fragmentWidth / 2, fragmentHeight / 2);
        gradient.addColorStop(0, "#3C91FF");
        gradient.addColorStop(0.5, "#0054E3");
        gradient.addColorStop(1, "#003399");
        ctx.fillStyle = gradient;
        ctx.fillRect(-fragmentWidth / 2, -fragmentHeight / 2, fragmentWidth, fragmentHeight);
        ctx.strokeStyle = `rgba(59, 130, 246, ${opacity})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(-fragmentWidth / 2, -fragmentHeight / 2, fragmentWidth, fragmentHeight);
        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.5})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(-fragmentWidth / 2 + 2, -fragmentHeight / 2 + 2, fragmentWidth - 4, fragmentHeight - 4);
        ctx.restore();
      }
      if (frame < maxFrames) handle = requestAnimationFrame(animate);
      else completeRef.current();
    };
    handle = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(handle);
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center" aria-hidden="true">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.5 }} className="absolute inset-0 bg-blue-400" />
      <canvas ref={canvasRef} className="absolute inset-0" />
      <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3, duration: 0.6 }} className="relative z-10">
        <motion.div
          animate={{ rotate: 360, scale: [1, 1.2, 1] }}
          transition={{ rotate: { duration: 2, repeat: Infinity, ease: "linear" }, scale: { duration: 1, repeat: Infinity } }}
          className="w-32 h-32 rounded-full border-4 border-blue-400"
          style={{ boxShadow: "0 0 40px rgba(59, 130, 246, 0.8), inset 0 0 40px rgba(59, 130, 246, 0.5)" }}
        />
      </motion.div>
      {Array.from({ length: 12 }, (_, i) => (
        <motion.div
          key={i}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: Math.cos((i * Math.PI * 2) / 12) * 200, y: Math.sin((i * Math.PI * 2) / 12) * 200, opacity: 0, scale: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="absolute w-4 h-4 bg-blue-400 rounded-full"
          style={{ boxShadow: "0 0 10px rgba(59, 130, 246, 0.8)" }}
        />
      ))}
    </motion.div>
  );
}
