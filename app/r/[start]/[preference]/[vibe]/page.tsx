/**
 * Page 2 — the ranked crawl for /r/<start>/<preference>/<vibe>[?rank=N].
 *
 * Server Component: validates the URL segments, loads every ranked route for the
 * combo (anon reads), renders the one named by ?rank= (default 1), and computes
 * the cycle for "Show another option". The route is fully derived from the URL,
 * so reloading or sharing the link — including the rank — reproduces it exactly.
 *
 * Phase 6 is a visual reskin only: every line of routing/data/analytics logic
 * below is unchanged from before.
 */
import Link from "next/link";
import { getBarsByIds, getRoutesForCombo } from "@/lib/queries";
import { isPreference, isVibe } from "@/lib/constants";
import RouteView from "@/components/RouteView";
import RouteControls from "@/components/RouteControls";
import RouteGeneratedTracker from "@/components/RouteGeneratedTracker";
import AgeDisclaimer from "@/components/AgeDisclaimer";
import { HeroFace } from "@/components/ButtonFaces";

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
    <main className="screen flex flex-1 flex-col">
      {/* Anonymous 'route_generated' event — fire-and-forget, renders nothing. */}
      <RouteGeneratedTracker start={start} preference={preference} vibe={vibe} />

      <RouteView route={current} bars={bars} />

      <RouteControls
        optionLabel={optionLabel}
        anotherOptionHref={anotherOptionHref}
        changePicksHref={changePicksHref}
      />

      <div className="mt-auto pt-10">
        <AgeDisclaimer />
      </div>
    </main>
  );
}

function RouteNotFound() {
  return (
    <main className="screen flex flex-1 flex-col justify-center">
      <div className="glass-panel animate-fade-up px-6 py-8 text-center">
        <h1 className="font-display text-[24px] font-bold text-cream">
          Route not found
        </h1>
        <p className="mt-3 text-[14px] text-white/60">
          We couldn&apos;t find a crawl for that link. Let&apos;s build a new one.
        </p>
        <Link href="/e/les" className="btn-hero mt-6 inline-block">
          <HeroFace>Build a crawl</HeroFace>
        </Link>
      </div>
    </main>
  );
}
