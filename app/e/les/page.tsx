/**
 * Page 1 — Lower East Side crawl builder.
 *
 * Server Component: loads the 25 bars and (if a valid ?src=<bar_id> is present)
 * resolves the locked start bar, then hands the interactive picker to the
 * client RouteBuilder. No writes, anon reads only.
 */
import { getActiveBars } from "@/lib/queries";
import RouteBuilder, { type StartOption } from "@/components/RouteBuilder";
import ScanTracker from "@/components/ScanTracker";
import AgeDisclaimer from "@/components/AgeDisclaimer";
import Skyline from "@/components/Skyline";

export default async function LesBuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ src?: string | string[] }>;
}) {
  const { src } = await searchParams;
  const srcId = Array.isArray(src) ? src[0] : src;

  const bars = await getActiveBars();
  const options: StartOption[] = bars.map((b) => ({
    bar_id: b.bar_id,
    bar_name: b.bar_name,
  }));

  // Lock the start only when ?src= matches a real bar; otherwise fall back to
  // the dropdown (an unknown src is treated as if it were absent).
  const lockedStart = srcId
    ? options.find((b) => b.bar_id === srcId) ?? null
    : null;

  return (
    <main className="screen relative flex flex-1 flex-col overflow-hidden">
      {/* Decorative neon skyline — full-bleed, pinned to the bottom, behind all
          content (purely visual, non-interactive). */}
      <Skyline className="pointer-events-none absolute bottom-0 left-1/2 z-0 w-screen max-w-[460px] -translate-x-1/2" />

      <div className="relative z-10 flex flex-1 flex-col">
        {/* Anonymous 'scan' event — fire-and-forget, renders nothing. */}
        <ScanTracker sourceBarId={srcId ?? null} />

        <header className="animate-fade-up">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand" />
            Lower East Side
          </p>

          <h1 className="mt-3 font-display text-[35px] font-extrabold leading-[1.05] tracking-[-0.015em] text-cream">
            BarCrawl <span className="text-brand">IQ</span>
          </h1>

          <p className="mt-2.5 text-[15.5px] text-white/65">
            Smart routes for a great night out.
          </p>
        </header>

        <div className="mt-8 animate-fade-up">
          <RouteBuilder bars={options} lockedStart={lockedStart} />
        </div>

        <div className="mt-auto pt-10 pb-[92px]">
          <AgeDisclaimer />
        </div>
      </div>
    </main>
  );
}
