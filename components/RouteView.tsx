/**
 * Presentational view of one ranked crawl: heading + ordered stop cards +
 * totals + the "open in Google Maps" hand-off.
 *
 * Pure + props-only (no fetching, no client state). `bars` MUST already be in
 * walking order (route.stops order) — the caller guarantees that. This is the
 * main reskin surface for Phase 6.
 */
import type { Bar, Route } from "@/lib/types";
import { buildWalkingMapsUrl } from "@/lib/maps";
import BarCard from "./BarCard";

export interface RouteViewProps {
  route: Route;
  bars: Bar[];
}

export default function RouteView({ route, bars }: RouteViewProps) {
  const mapsUrl = buildWalkingMapsUrl(bars);

  const totalWalkMin = Math.round(route.total_walk_min);
  const costs = bars.map((b) => b.avg_cost);
  const minCost = Math.min(...costs);
  const maxCost = Math.max(...costs);
  const costRange =
    minCost === maxCost ? `$${minCost}` : `$${minCost}–$${maxCost}`;

  return (
    <div>
      <h1 className="text-2xl font-bold">{route.explanation}</h1>

      <ol className="mt-6 flex flex-col gap-3">
        {bars.map((bar, i) => (
          <BarCard
            key={bar.bar_id}
            index={i}
            bar={bar}
            walkToNextMin={
              i < route.legs.length
                ? Math.round(route.legs[i].duration_s / 60)
                : undefined
            }
          />
        ))}
      </ol>

      <dl className="mt-6 grid grid-cols-2 gap-2 text-sm">
        <dt className="text-gray-500">Total walking</dt>
        <dd>≈ {totalWalkMin} min ({route.total_distance_m} m)</dd>

        <dt className="text-gray-500">Drink cost</dt>
        <dd>
          {costRange} per stop (avg ${route.selected_avg_cost})
        </dd>

        <dt className="text-gray-500">Avg rating</dt>
        <dd>{route.selected_avg_rating} ★</dd>
      </dl>

      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-block rounded-md bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
      >
        Open Full Route in Google Maps →
      </a>
    </div>
  );
}
