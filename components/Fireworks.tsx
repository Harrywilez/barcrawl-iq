/**
 * Bright fireworks for the top of the night sky (decorative background layer).
 *
 * Pure presentational SVG: a few multi-colour bursts, each a ring of radiating
 * rays with bright spark tips, a glowing core, and a soft ambient colour glow.
 * A bloom filter gives the neon/firework halo. Geometry is computed
 * deterministically (fixed angles — no Math.random), so SSR and client render
 * identically. Static (nothing to gate for prefers-reduced-motion) and
 * aria-hidden, since it's purely decorative.
 */

type Burst = {
  cx: number;
  cy: number;
  r: number;
  /** ray count */
  n: number;
  /** rotation offset, degrees */
  rot: number;
  ray: string;
  tip: string;
  core: string;
  /** ambient-glow gradient id */
  glow: string;
  /** overall opacity (for depth) */
  dim?: number;
};

// Positions are on a 0..400 × 0..380 canvas that scales to the full width (no
// cropping). Weighted to the top-right and the gaps so the wordmark stays
// readable; the faint low ones glow up through the glass panel/pills.
const BURSTS: ReadonlyArray<Burst> = [
  { cx: 336, cy: 74, r: 56, n: 18, rot: 10, ray: "#ffd28a", tip: "#fff3d6", core: "#fff8ea", glow: "url(#fw-gold)" },
  { cx: 198, cy: 42, r: 29, n: 16, rot: 0, ray: "#ff9a6a", tip: "#ffd9c4", core: "#fff0e8", glow: "url(#fw-coral)" },
  { cx: 366, cy: 184, r: 33, n: 14, rot: 14, ray: "#7fe4d6", tip: "#d8fff8", core: "#ecfffb", glow: "url(#fw-teal)", dim: 0.8 },
  { cx: 44, cy: 150, r: 20, n: 14, rot: 6, ray: "#7fe4d6", tip: "#d8fff8", core: "#ecfffb", glow: "url(#fw-teal)", dim: 0.55 },
];

// Locked-in tuning (from the dev tuner): scale applied to every burst radius.
const BURST_SCALE = 1.06;

function rays(b: Burst) {
  const out: Array<{ x2: number; y2: number; x1: number; y1: number; long: boolean }> = [];
  for (let i = 0; i < b.n; i++) {
    const a = ((360 / b.n) * i + b.rot) * (Math.PI / 180);
    const long = i % 2 === 0;
    const r = b.r * BURST_SCALE;
    const rOut = r * (long ? 1 : 0.72);
    const rIn = r * 0.16;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    out.push({
      x1: b.cx + cos * rIn,
      y1: b.cy + sin * rIn,
      x2: b.cx + cos * rOut,
      y2: b.cy + sin * rOut,
      long,
    });
  }
  return out;
}

export default function Fireworks({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      <svg
        viewBox="0 0 400 380"
        className="block h-auto w-full"
        fill="none"
      >
        <defs>
          <radialGradient id="fw-gold">
            <stop offset="0%" stopColor="#ffce80" stopOpacity={0.25} />
            <stop offset="70%" stopColor="#ffb060" stopOpacity={0.05} />
            <stop offset="100%" stopColor="#ffb060" stopOpacity={0} />
          </radialGradient>
          <radialGradient id="fw-teal">
            <stop offset="0%" stopColor="#78e4d4" stopOpacity={0.19} />
            <stop offset="100%" stopColor="#78e4d4" stopOpacity={0} />
          </radialGradient>
          <radialGradient id="fw-coral">
            <stop offset="0%" stopColor="#ff7a52" stopOpacity={0.22} />
            <stop offset="100%" stopColor="#ff7a52" stopOpacity={0} />
          </radialGradient>
          <filter id="fw-bloom" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={1} result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {BURSTS.map((b, bi) => {
          const rs = rays(b);
          return (
            <g key={bi} opacity={b.dim ?? 1}>
              {/* ambient sky glow around the burst */}
              <circle cx={b.cx} cy={b.cy} r={b.r * BURST_SCALE * 1.55} fill={b.glow} />

              <g filter="url(#fw-bloom)">
                <g
                  stroke={b.ray}
                  strokeWidth={1.1}
                  strokeLinecap="round"
                  opacity={0.3}
                  vectorEffect="non-scaling-stroke"
                >
                  {rs.map((r, i) => (
                    <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} />
                  ))}
                </g>
                <g fill={b.tip}>
                  {rs.map((r, i) => (
                    <circle key={i} cx={r.x2} cy={r.y2} r={r.long ? 1.7 : 1.2} />
                  ))}
                </g>
                <circle cx={b.cx} cy={b.cy} r={2.6} fill={b.core} />
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
