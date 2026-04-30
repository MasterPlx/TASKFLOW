'use client';

/**
 * Lightweight confetti — pure DOM/SVG, no dependencies.
 * Spawns particles that fly out, rotate, and fade.
 * Triggered imperatively via the `fireConfetti()` helper.
 */
import { useEffect, useState } from 'react';

interface Particle {
  id: number;
  color: string;
  x: number;
  y: number;
  rot: number;
  vx: number;
  vy: number;
  vr: number;
}

const COLORS = ['#7C3AED', '#DB2777', '#0284C7', '#059669', '#D97706', '#EA580C'];

let listeners: Array<(p: Particle[]) => void> = [];

export function fireConfetti(count = 24, originX = 0.5, originY = 0.5): void {
  const particles: Particle[] = Array.from({ length: count }).map((_, i) => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI; // upward cone
    const speed = 280 + Math.random() * 240;
    return {
      id: Date.now() + i + Math.random(),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      x: originX,
      y: originY,
      rot: Math.random() * 360,
      vx: Math.cos(angle) * speed * (Math.random() * 0.6 + 0.6),
      vy: Math.sin(angle) * speed,
      vr: (Math.random() - 0.5) * 720,
    };
  });
  listeners.forEach((fn) => fn(particles));
}

export function ConfettiHost() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const fn = (p: Particle[]) => {
      setParticles(p);
      // Auto-clean after animation finishes
      setTimeout(() => setParticles([]), 1400);
    };
    listeners.push(fn);
    return () => {
      listeners = listeners.filter((l) => l !== fn);
    };
  }, []);

  if (particles.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[200] overflow-hidden">
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute h-2 w-2 rounded-sm"
          style={{
            backgroundColor: p.color,
            left: `${p.x * 100}%`,
            top: `${p.y * 100}%`,
            transform: `translate(-50%, -50%) rotate(${p.rot}deg)`,
            // CSS variable trick lets us animate transform with custom values per particle
            ['--x' as string]: `${p.vx}px`,
            ['--y' as string]: `${p.vy}px`,
            ['--r' as string]: `${p.vr}deg`,
            animation: 'confetti 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          }}
        />
      ))}
    </div>
  );
}
