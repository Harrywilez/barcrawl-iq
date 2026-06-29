/**
 * Presentational card for a single stop on the crawl.
 *
 * Pure + props-only — no data fetching, no client state. Phase 6.3: the glass
 * surface, the off-white numbered badge, the name/note typography, and the
 * three glossy overlays are ported verbatim from design/result.html. The dotted
 * "N min walk to next stop" connector still renders BELOW the glass (in the gap
 * before the next card). The street trim + rounded rating are display-only; the
 * walk minutes arrive pre-computed from the parent. Nothing here touches data.
 */
import type { Bar } from "@/lib/types";

export interface BarCardProps {
  /** 0-based position in the walking order. */
  index: number;
  bar: Bar;
  /** Walking minutes to the NEXT stop; omit for the final stop. */
  walkToNextMin?: number;
}

export default function BarCard({ index, bar, walkToNextMin }: BarCardProps) {
  // Display-only: every bar shares the same city/state/zip, so show just the
  // street (the part before the first comma). Stored data is untouched.
  const street = bar.address.split(",")[0].trim();

  return (
    <li className="animate-fade-up">
      <div className="glass-card flex items-center gap-[14px] px-4 py-[14px]">
        {/* Glossy overlays (under the content, which is positioned below). */}
        <span aria-hidden="true" className="glass-card__sheen-top" />
        <span aria-hidden="true" className="glass-card__veil" />
        <span aria-hidden="true" className="glass-card__sheen-bottom" />

        <span className="stop-badge relative flex h-11 w-11 shrink-0 items-center justify-center font-display text-[15px] font-bold">
          {index + 1}
        </span>

        <div className="relative min-w-0 flex-1">
          <h3 className="truncate text-[16px] font-bold leading-tight tracking-[-0.1px] text-[#faf8f2] [text-shadow:0_1px_3px_rgba(8,16,38,0.5)]">
            {bar.bar_name}
          </h3>
          <p className="mt-[3px] truncate text-[12.5px] font-medium text-[rgba(250,248,242,0.8)] [text-shadow:0_1px_2px_rgba(8,16,38,0.4)]">
            {street} · ${Math.round(bar.avg_cost)}/drink ·{" "}
            <span className="whitespace-nowrap">
              {bar.rating.toFixed(1)}
              <span className="text-[#ffce80]">★</span>
            </span>
          </p>
        </div>
      </div>

      {walkToNextMin !== undefined && (
        <div className="flex items-center gap-[7px] px-0.5 py-2.5">
          <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-[rgba(245,243,237,0.36)]" />
          <span className="font-display text-[12px] font-medium tracking-[0.2px] text-[rgba(245,243,237,0.56)]">
            <span className="font-semibold text-[rgba(245,243,237,0.86)]">
              {walkToNextMin} min
            </span>{" "}
            walk to next stop
          </span>
        </div>
      )}
    </li>
  );
}
