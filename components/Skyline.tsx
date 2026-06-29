/**
 * Decorative neon line-art NYC skyline for the bottom of the landing page.
 *
 * Pure presentational SVG: stroked building outlines (no heavy fill) in a
 * luminous steel-cyan with a soft glow (the glow lives in the `.skyline-neon`
 * class so it can be tuned in one place). Strokes are non-scaling so the neon
 * stays crisp as the SVG stretches to the container width. A couple of antennas
 * carry small red beacons (tying into the brand red), with a few warm-gold lit
 * windows. Fully static — nothing to gate for prefers-reduced-motion — and
 * aria-hidden, since it's purely decorative.
 */

// [x, width, roof-y] on a 0..800 × 0..170 canvas (baseline y = 160).
const BUILDINGS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 46, 116], [44, 30, 140], [72, 40, 92], [110, 26, 126], [134, 42, 66],
  [176, 30, 132], [204, 46, 100], [248, 26, 118], [272, 42, 54], [312, 30, 122],
  [340, 54, 80], [392, 34, 40], [424, 30, 106], [452, 50, 88], [500, 24, 126],
  [522, 40, 62], [560, 46, 108], [604, 30, 30], [632, 54, 96], [684, 32, 128],
  [714, 42, 72], [754, 30, 116], [782, 30, 134],
];

// Warm-gold lit windows: [x, y].
const WINDOWS: ReadonlyArray<readonly [number, number]> = [
  [148, 84], [156, 100], [148, 116], [283, 76], [291, 96], [537, 84],
  [545, 104], [615, 52], [623, 72], [407, 60], [466, 104], [349, 100],
];

const BASE_Y = 160;

export default function Skyline({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      <svg
        viewBox="0 0 800 170"
        fill="none"
        className="skyline-neon block h-auto w-full"
      >
        <g
          stroke="#8fc4f5"
          strokeWidth={1.4}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          opacity={0.45}
        >
          {/* street-level baseline */}
          <line x1={0} y1={BASE_Y} x2={800} y2={BASE_Y} />

          {/* building outlines (up the left side, across the roof, down the right) */}
          {BUILDINGS.map(([x, w, top], i) => (
            <path key={i} d={`M${x} ${BASE_Y} V ${top} H ${x + w} V ${BASE_Y}`} />
          ))}

          {/* tapered spire (Chrysler-ish) on the 272-wide tower */}
          <path d="M283 54 L293 30 L303 54" />

          {/* water towers on two mid-rise rooftops */}
          <path d="M148 66 V 58 H 168 V 66 M150 58 L154 51 H162 L166 58" />
          <path d="M532 62 V 54 H 550 V 62 M534 54 L538 47 H546 L550 54" />

          {/* antennas */}
          <line x1={619} y1={30} x2={619} y2={10} />
          <line x1={409} y1={40} x2={409} y2={26} />
        </g>

        {/* red beacons atop the tallest antennas (brand accent) */}
        <g fill="#ff6a5c">
          <circle cx={619} cy={9} r={2.1} />
          <circle cx={409} cy={25} r={1.7} />
        </g>

        {/* sparse warm-gold lit windows (dimmed with the line brightness) */}
        <g fill="#ffce80" opacity={0.65}>
          {WINDOWS.map(([x, y], i) => (
            <rect key={i} x={x} y={y} width={1.8} height={2.4} rx={0.4} />
          ))}
        </g>
      </svg>
    </div>
  );
}
