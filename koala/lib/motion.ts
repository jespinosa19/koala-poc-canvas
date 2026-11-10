export const easing = {
  out: "cubic-bezier(0.23, 1, 0.32, 1)",
  inOut: "cubic-bezier(0.77, 0, 0.175, 1)",
  drawer: "cubic-bezier(0.32, 0.72, 0, 1)",
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  lift: "cubic-bezier(0.175, 0.885, 0.32, 1.1)",
  sine: "cubic-bezier(0.37, 0, 0.63, 1)",
} as const;

export const easingPoints = {
  out: [0.23, 1, 0.32, 1],
  inOut: [0.77, 0, 0.175, 1],
  drawer: [0.32, 0.72, 0, 1],
  spring: [0.34, 1.56, 0.64, 1],
  lift: [0.175, 0.885, 0.32, 1.1],
  sine: [0.37, 0, 0.63, 1],
} as const;

export const duration = {
  fast: 160,
  base: 300,
  slow: 450,
  feed: 2500,
} as const;

export const countUpDuration = 1800;

export const signatureDraw = {
  fast: { duration: 900, lift: 80 },
  base: { duration: 1600, lift: 140 },
  slow: { duration: 2800, lift: 220 },
} as const;

export type SignatureSpeed = keyof typeof signatureDraw;

export function cubicBezier([x1, y1, x2, y2]: readonly [number, number, number, number]) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 5; i++) {
      const dx = sampleX(t) - x;
      if (Math.abs(dx) < 1e-4) break;
      const d = slopeX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= dx / d;
    }
    return sampleY(t);
  };
}

export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export type Easing = keyof typeof easing;
export type Duration = keyof typeof duration;
