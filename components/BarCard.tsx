/**
 * Presentational card for a single stop on the crawl.
 *
 * Pure + props-only — no data fetching, no client state. This is part of the
 * "reskin surface": Phase 6 restyles this without touching any logic.
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
  return (
    <li className="rounded-lg border border-gray-300 p-4">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-sm text-gray-500">
          Stop {index + 1}
        </span>
        <h3 className="text-lg font-semibold">{bar.bar_name}</h3>
      </div>

      <p className="mt-1 text-sm text-gray-600">{bar.address}</p>

      <p className="mt-2 text-sm">
        Avg drink: <span className="font-medium">${bar.avg_cost}</span>
      </p>

      {walkToNextMin !== undefined && (
        <p className="mt-2 text-sm text-gray-500">
          ↓ {walkToNextMin} min walk to next stop
        </p>
      )}
    </li>
  );
}
