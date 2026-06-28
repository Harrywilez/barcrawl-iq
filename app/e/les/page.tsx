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
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      {/* Anonymous 'scan' event — fire-and-forget, renders nothing. */}
      <ScanTracker sourceBarId={srcId ?? null} />

      <h1 className="text-3xl font-bold">Build your Lower East Side crawl</h1>
      <p className="mt-2 text-gray-600">
        Pick where you&apos;re starting, what matters most, and the vibe — we&apos;ll
        plot a 4-bar walking route.
      </p>

      <div className="mt-10">
        <RouteBuilder bars={options} lockedStart={lockedStart} />
      </div>
    </main>
  );
}
