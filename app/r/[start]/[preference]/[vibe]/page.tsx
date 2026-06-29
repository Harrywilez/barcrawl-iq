/**
 * Page 2 — the ranked crawl for /r/<start>/<preference>/<vibe>[?rank=N] (Paper).
 *
 * Server Component: validates the URL segments, loads every ranked route for the
 * combo (anon reads), renders the one named by ?rank= (default 1), and computes
 * the cycle for "Show another option". The route is fully derived from the URL,
 * so reloading or sharing the link — including the rank — reproduces it exactly.
 */
import Link from "next/link";
import { getBarsByIds, getRoutesForCombo } from "@/lib/queries";
import { isPreference, isVibe } from "@/lib/constants";
import RouteView from "@/components/RouteView";
import RouteGeneratedTracker from "@/components/RouteGeneratedTracker";
import PoweredBy from "@/components/PoweredBy";

export default async function RoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ start: string; preference: string; vibe: string }>;
  searchParams: Promise<{ rank?: string | string[] }>;
}) {
  const { start, preference, vibe } = await params;
  const { rank: rankParam } = await searchParams;

  // Guard the canonical enums up front; an invalid start yields no routes below.
  if (!isPreference(preference) || !isVibe(vibe)) {
    return <RouteNotFound />;
  }

  const routes = await getRoutesForCombo(start, preference, vibe);
  if (routes.length === 0) {
    return <RouteNotFound />;
  }

  // `routes` is ordered by rank asc. Pick the requested rank, falling back to
  // the first available rank for a missing/invalid ?rank=.
  const availableRanks = routes.map((r) => r.rank);
  const rawRank = Array.isArray(rankParam) ? rankParam[0] : rankParam;
  const requestedRank = Number(rawRank);
  const current = routes.find((r) => r.rank === requestedRank) ?? routes[0];

  const bars = await getBarsByIds(current.stops);

  // Cycle 1 → 2 → 3 → 1 over whatever ranks actually exist.
  const index = availableRanks.indexOf(current.rank);
  const nextRank = availableRanks[(index + 1) % availableRanks.length];
  const optionLabel = `Option ${index + 1} of ${availableRanks.length}`;
  const anotherOptionHref =
    availableRanks.length > 1
      ? `/r/${start}/${preference}/${vibe}?rank=${nextRank}`
      : null;
  const changePicksHref = `/e/les?src=${start}`;

  return (
    <main className="paper-screen">
      {/* Anonymous 'route_generated' event — fire-and-forget, renders nothing. */}
      <RouteGeneratedTracker start={start} preference={preference} vibe={vibe} />

      <div className="paper-frame px-5 pb-4 pt-[50px]">
        <RouteView
          route={current}
          bars={bars}
          optionLabel={optionLabel}
          anotherOptionHref={anotherOptionHref}
          changePicksHref={changePicksHref}
        />
      </div>
    </main>
  );
}

function RouteNotFound() {
  return (
    <main className="paper-screen">
      <div className="paper-frame justify-center px-5 pb-4 pt-[50px] text-center">
        <div className="font-sans text-[20px] font-extrabold tracking-[-0.3px] text-ink">
          BARCRAWL{" "}
          <span className="rounded-[2px] bg-red px-[7px] py-px text-paper">
            IQ
          </span>
        </div>
        <div className="mt-7 font-display text-[34px] font-extrabold leading-[0.96] text-red">
          Route not found
        </div>
        <p className="mx-auto mt-3 max-w-[260px] font-sans text-[12.5px] font-medium leading-[1.55] text-[rgba(24,48,92,0.64)]">
          We couldn&apos;t find a crawl for that link. Let&apos;s build a new
          one.
        </p>
        <Link href="/e/les" className="paper-cta mt-7 block px-[18px] py-[15px]">
          <span className="flex items-center justify-center gap-[9px] font-sans text-[13.5px] font-extrabold tracking-[0.2px] text-paper">
            <span className="text-[13px] text-gold">★</span> Build a crawl
          </span>
        </Link>
        <PoweredBy />
      </div>
    </main>
  );
}
