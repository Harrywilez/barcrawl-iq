/**
 * One stop on the crawl (Paper design): a white card with a navy numbered badge,
 * the bar name, and a note line, followed (for every stop but the last) by the
 * dotted "N min walk to next stop" connector.
 *
 * Display-only data shaping (logic ported from the glass branch, Paper-styled):
 * street-only address, clean dollar cost, and the rounded X.X★ rating. The walk
 * minutes arrive pre-computed from the parent. Nothing here touches data.
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
  // Every bar shares the same city/state/zip — show just the street.
  const street = bar.address.split(",")[0].trim();

  return (
    <>
      <div className="paper-card flex items-center gap-3 px-[13px] py-[10px]">
        <span className="paper-badge h-9 w-9 font-sans text-[16px] font-extrabold leading-none">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-sans text-[15px] font-bold tracking-[-0.1px] text-ink">
            {bar.bar_name}
          </div>
          <div className="mt-0.5 truncate font-sans text-[11px] font-medium text-[rgba(24,48,92,0.6)]">
            {street} · ${Math.round(bar.avg_cost)}/drink ·{" "}
            <span className="whitespace-nowrap">
              {bar.rating.toFixed(1)}
              <span className="text-gold">★</span>
            </span>
          </div>
        </div>
      </div>

      {walkToNextMin !== undefined && (
        <div className="flex items-center gap-2 py-[10px] pl-[18px]">
          <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-red" />
          <span className="font-mono text-[8.5px] uppercase tracking-[0.6px] text-[rgba(24,48,92,0.5)]">
            <span className="font-bold text-ink">{walkToNextMin} min</span> walk
            to next stop
          </span>
        </div>
      )}
    </>
  );
}
