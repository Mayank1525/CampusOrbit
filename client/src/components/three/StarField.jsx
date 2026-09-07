import { useMemo, useRef, useEffect, useState } from 'react';
import { prefersReducedMotion } from '../../utils/helpers';

/**
 * Lightweight animated starfield rendered on a 2D canvas (NOT WebGL) so it can
 * sit behind every page without costing GPU/battery like a full R3F scene.
 * Heavy 3D is reserved for the Learning Orbit only.
 */
export default function StarField({ density = 0.00012, className = '' }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const [reduced] = useState(() => prefersReducedMotion());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d', { alpha: true });
    let stars = [];
    let w = 0;
    let h = 0;
    let dpr = 1;

    const palette = ['#ffffff', '#c7d2fe', '#a5f3fc', '#e9d5ff', '#fbcfe8'];

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(260, Math.max(60, Math.floor(w * h * density)));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.3 + 0.25,
        a: Math.random() * 0.6 + 0.2,
        tw: Math.random() * 0.014 + 0.003,
        dir: Math.random() > 0.5 ? 1 : -1,
        vy: (Math.random() * 0.045 + 0.008),
        c: palette[Math.floor(Math.random() * palette.length)],
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        if (!reduced) {
          s.a += s.tw * s.dir;
          if (s.a > 0.9) s.dir = -1;
          if (s.a < 0.15) s.dir = 1;
          s.y -= s.vy;
          if (s.y < -2) {
            s.y = h + 2;
            s.x = Math.random() * w;
          }
        }
        ctx.globalAlpha = s.a;
        ctx.fillStyle = s.c;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        if (s.r > 1.05) {
          ctx.globalAlpha = s.a * 0.16;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r * 3.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(draw);
    };

    resize();
    if (reduced) {
      draw();
      cancelAnimationFrame(rafRef.current);
      // Draw one static frame only.
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        ctx.globalAlpha = s.a;
        ctx.fillStyle = s.c;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      rafRef.current = requestAnimationFrame(draw);
    }

    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, [density, reduced]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 w-full h-full ${className}`}
      style={{ zIndex: 0 }}
    />
  );
}

/** Decorative floating gradient orbs for hero sections. */
export function AuroraBlobs() {
  const blobs = useMemo(
    () => [
      { c: 'rgba(124,92,255,0.28)', size: 420, top: '-14%', left: '4%', dur: '22s' },
      { c: 'rgba(34,211,238,0.20)', size: 340, top: '32%', left: '68%', dur: '28s' },
      { c: 'rgba(251,113,133,0.16)', size: 300, top: '68%', left: '18%', dur: '25s' },
    ],
    []
  );
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
      {blobs.map((b, i) => (
        <div
          key={i}
          className="absolute rounded-full blur-[90px] animate-float"
          style={{
            width: b.size,
            height: b.size,
            top: b.top,
            left: b.left,
            background: b.c,
            animationDuration: b.dur,
            animationDelay: `${i * 1.6}s`,
          }}
        />
      ))}
    </div>
  );
}
