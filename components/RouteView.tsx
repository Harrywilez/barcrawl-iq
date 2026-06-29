/**
 * The result poster (Paper design): header with the dynamic title + stats
 * subtitle, the numbered stops with walk connectors, a spacer, then the actions
 * (Maps hand-off, rank/copy controls, footer).
 *
 * Pure + props-only. `bars` MUST already be in walking order (route.stops order)
 * — the caller guarantees that. The dynamic title comes from the URL's
 * preference + vibe; the Maps URL + per-leg walk minutes are derived as before.
 */
import type { Bar, Route } from "@/lib/types";
import { buildWalkingMapsUrl } from "@/lib/maps";
import { preferenceLabel, vibeLabel } from "@/lib/constants";
import BarCard from "./BarCard";
import RouteControls from "./RouteControls";
import AgeDisclaimer from "./AgeDisclaimer";

export interface RouteViewProps {
  route: Route;
  bars: Bar[];
  optionLabel: string;
  anotherOptionHref: string | null;
  changePicksHref: string;
}

export default function RouteView({
  route,
  bars,
  optionLabel,
  anotherOptionHref,
  changePicksHref,
}: RouteViewProps) {
  const mapsUrl = buildWalkingMapsUrl(bars);
  const totalWalkMin = Math.round(route.total_walk_min);
  const avgCost = Math.round(route.selected_avg_cost);
  const subtitle = `${bars.length} stops · ${totalWalkMin} min walk · ~$${avgCost}/drink`;

  return (
    <>
      {/* Header */}
      <div className="flex flex-col">
        <div className="mb-[13px] text-center font-sans text-[20px] font-extrabold tracking-[-0.3px] text-ink">
          BARCRAWL{" "}
          <span className="rounded-[2px] bg-red px-[7px] py-px text-paper">
            IQ
          </span>
        </div>

        <div className="flex items-center gap-[9px]">
          <div className="h-px flex-1 bg-[rgba(24,48,92,0.3)]" />
          <span className="text-[10px] text-red">★</span>
          <div className="font-mono text-[9px] font-bold uppercase tracking-[2px] text-ink">
            Lower East Side
          </div>
          <span className="text-[10px] text-red">★</span>
          <div className="h-px flex-1 bg-[rgba(24,48,92,0.3)]" />
        </div>

        <div className="mt-[15px] text-center">
          <div className="font-display text-[23px] font-semibold italic leading-none text-ink">
            Your {preferenceLabel(route.preference)}
          </div>
          <div className="mt-0.5 font-display text-[41px] font-extrabold leading-[0.96] text-red">
            {vibeLabel(route.vibe)} Crawl
          </div>
        </div>

        <div className="mt-[10px] text-center font-mono text-[9px] font-bold uppercase tracking-[0.8px] text-[rgba(24,48,92,0.6)]">
          {subtitle}
        </div>
      </div>

      {/* Stops */}
      <div className="mt-5 flex flex-col">
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
      </div>

      {/* Spacer divider — grows to push the actions to the bottom. */}
      <div className="flex min-h-[14px] flex-1 items-center justify-center gap-[11px]">
        <div className="h-px w-[30px] bg-[rgba(24,48,92,0.3)]" />
        <span className="text-[11px] leading-none text-red">★</span>
        <div className="h-px w-[30px] bg-[rgba(24,48,92,0.3)]" />
      </div>

      {/* Actions + footer */}
      <div className="flex flex-col gap-[9px]">
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="paper-cta block px-4 py-[15px]"
        >
          <span className="flex items-center justify-center gap-[9px] font-sans text-[13.5px] font-extrabold tracking-[0.2px] text-paper">
            <MapsTarget className="h-4 w-4" /> Open Full Route in Google Maps
          </span>
        </a>

        <RouteControls
          optionLabel={optionLabel}
          anotherOptionHref={anotherOptionHref}
          changePicksHref={changePicksHref}
        />

        <AgeDisclaimer />
      </div>
    </>
  );
}

/** Gold target/crosshair on the Maps CTA (matches design). */
function MapsTarget({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 18" fill="none" className={className} aria-hidden="true">
      <circle cx="9" cy="9" r="6.2" stroke="#e8b24a" strokeWidth="1.7" />
      <circle cx="9" cy="9" r="2.1" fill="#e8b24a" />
    </svg>
  );
}
