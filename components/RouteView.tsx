/**
 * Presentational view of one ranked crawl: header (eyebrow + dynamic title +
 * stats subtitle) + ordered glass stop cards + the "open in Google Maps"
 * hand-off.
 *
 * Pure + props-only (no fetching, no client state). `bars` MUST already be in
 * walking order (route.stops order) — the caller guarantees that.
 *
 * Phase 6 reskin: the title is derived from the route's REAL preference/vibe via
 * the canonical label helpers ("Your Cheapest Party Crawl"), and the stats are
 * folded into the mockup's single subtitle line. The Maps URL builder and the
 * per-leg walk minutes are unchanged — only presentation differs.
 */
import type { Bar, Route } from "@/lib/types";
import { buildWalkingMapsUrl } from "@/lib/maps";
import { preferenceLabel, vibeLabel } from "@/lib/constants";
import BarCard from "./BarCard";
import { HeroFace } from "./ButtonFaces";

export interface RouteViewProps {
  route: Route;
  bars: Bar[];
}

export default function RouteView({ route, bars }: RouteViewProps) {
  const mapsUrl = buildWalkingMapsUrl(bars);

  // Display-only rounding — never mutates the stored values.
  const totalWalkMin = Math.round(route.total_walk_min);
  const avgDrink = Math.round(route.selected_avg_cost);
  const title = `Your ${preferenceLabel(route.preference)} ${vibeLabel(
    route.vibe,
  )} Crawl`;

  return (
    <div>
      <header className="animate-fade-up">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand" />
          Lower East Side
        </p>

        <h1 className="mt-3 font-display text-[29px] font-extrabold leading-[1.12] tracking-[-0.02em] text-cream">
          {title}
        </h1>

        <p className="mt-2.5 text-[14px] text-white/60">
          {bars.length} stops · {totalWalkMin} min walking · ~${avgDrink}/drink
        </p>
      </header>

      <ol className="mt-7 flex flex-col">
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

      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-hero mt-6 block w-full"
      >
        <HeroFace>
          <TargetIcon className="h-[17px] w-[17px]" />
          Open Full Route in Google Maps
        </HeroFace>
      </a>
    </div>
  );
}

/** White target/crosshair shown on the red Maps hero (matches design/result). */
function TargetIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 18" fill="none" className={className} aria-hidden="true">
      <circle cx="9" cy="9" r="6.2" stroke="#fff" strokeWidth="1.7" />
      <circle cx="9" cy="9" r="2.1" fill="#fff" />
    </svg>
  );
}
