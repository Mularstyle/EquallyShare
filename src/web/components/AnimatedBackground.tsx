import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

type Dvd = { id: number; x: number; y: number; vx: number; vy: number; color: string };

const dvdWidth = 300;
const dvdHeight = 150;
const ellipseRx = 138;
const ellipseRy = 63;
const colors = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF"];

// Ellipse collision: normalize the center distance by the radii and detect slightly before overlap.
function collides(a: Dvd, b: Dvd): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return (dx * dx) / ((ellipseRx * 2) ** 2) + (dy * dy) / ((ellipseRy * 2) ** 2) < 1.1;
}

function step(previous: Dvd[]): Dvd[] {
  const maxX = Math.max(0, window.innerWidth - dvdWidth);
  const maxY = Math.max(0, window.innerHeight - dvdHeight);
  return previous.map((dvd, index) => {
    let x = dvd.x + dvd.vx;
    let y = dvd.y + dvd.vy;
    let vx = dvd.vx;
    let vy = dvd.vy;
    let bounced = false;

    if (x <= 0) { x = 0; vx = Math.abs(vx); bounced = true; }
    else if (x >= maxX) { x = maxX; vx = -Math.abs(vx); bounced = true; }
    if (y <= 0) { y = 0; vy = Math.abs(vy); bounced = true; }
    else if (y >= maxY) { y = maxY; vy = -Math.abs(vy); bounced = true; }

    const moved = { ...dvd, x, y };
    for (let i = 0; i < previous.length; i++) {
      const other = previous[i]!;
      if (i === index || !collides(moved, other)) continue;
      const dx = moved.x - other.x;
      const dy = moved.y - other.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 0) {
        const nx = dx / distance;
        const ny = dy / distance;
        const dot = vx * nx + vy * ny;
        // Only bounce if moving towards each other, then push apart to prevent overlap.
        if (dot < 0) {
          vx -= 2 * dot * nx;
          vy -= 2 * dot * ny;
          x = dvd.x + nx * 5;
          y = dvd.y + ny * 5;
          bounced = true;
        }
      }
      break;
    }

    return { ...dvd, x, y, vx, vy, color: bounced ? colors[Math.floor(Math.random() * colors.length)]! : dvd.color };
  });
}

/** Windows XP Bliss wallpaper with bouncing DVD logos (from the frontend branch design). */
export default function AnimatedBackground() {
  const reduceMotion = useReducedMotion();
  const [dvds, setDvds] = useState<Dvd[]>([
    { id: 1, x: 0, y: 0, vx: 2, vy: 2, color: "#FF0000" },
    { id: 2, x: 200, y: 100, vx: -2.5, vy: 2.5, color: "#00FF00" },
    { id: 3, x: 400, y: 200, vx: 2.5, vy: -2, color: "#0000FF" },
    { id: 4, x: 100, y: 300, vx: -2, vy: -2.5, color: "#FFFF00" },
  ]);
  // Particle styles are fixed once; recomputing them each frame would make them jitter.
  const particles = useMemo(() => Array.from({ length: 10 }, () => ({
    size: Math.random() * 3 + 1,
    left: Math.random() * 100,
    top: Math.random() * 100,
    opacity: Math.random() * 0.2 + 0.1,
    duration: Math.random() * 10 + 10,
    delay: Math.random() * 5,
  })), []);

  useEffect(() => {
    if (reduceMotion) return;
    let frame = 0;
    const tick = () => { setDvds(step); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduceMotion]);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url(/windowxpbackground.webp)" }} />

      {dvds.map((dvd) => (
        <div key={dvd.id} className="absolute" style={{ transform: `translate(${dvd.x}px, ${dvd.y}px)`, width: dvdWidth, height: dvdHeight }}>
          <svg width={dvdWidth} height={dvdHeight} viewBox="0 0 300 150" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="150" cy="75" rx={ellipseRx} ry={ellipseRy} fill={dvd.color} opacity="0.8" />
            <text x="150" y="87" textAnchor="middle" fontSize="42" fontWeight="bold" fill="white" fontFamily="Arial, sans-serif">DVD</text>
          </svg>
        </div>
      ))}

      {particles.map((particle, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-white"
          style={{ width: particle.size, height: particle.size, left: `${particle.left}%`, top: `${particle.top}%`, opacity: particle.opacity }}
          animate={{ y: [0, -20, 0], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: particle.duration, repeat: Infinity, delay: particle.delay }}
        />
      ))}
    </div>
  );
}
