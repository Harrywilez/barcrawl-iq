"use client";

/**
 * Error boundary for the result route. Catches a FAILED Supabase READ (network
 * drop, etc.) thrown during render and shows a friendly retry instead of a
 * crash. Invalid params are NOT errors — the page renders its own "route not
 * found" message and never reaches here. Paper-styled; messages + logic kept.
 */
import Link from "next/link";

export default function RouteError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="paper-screen">
      <div className="paper-frame justify-center px-5 pb-4 pt-[50px] text-center">
        <div className="font-sans text-[20px] font-extrabold tracking-[-0.3px] text-ink">
          BARCRAWL{" "}
          <span className="rounded-[2px] bg-red px-[7px] py-px text-paper">
            IQ
          </span>
        </div>
        <div className="mt-7 font-display text-[31px] font-extrabold leading-[0.98] text-red">
          Couldn&apos;t load your route
        </div>
        <p className="mx-auto mt-3 max-w-[270px] font-sans text-[12.5px] font-medium leading-[1.55] text-[rgba(24,48,92,0.64)]">
          Something went wrong loading this crawl. Check your connection and
          retry.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="paper-cta mt-7 px-[18px] py-[15px]"
        >
          <span className="flex items-center justify-center gap-[9px] font-sans text-[13.5px] font-extrabold tracking-[0.2px] text-paper">
            Try again
          </span>
        </button>
        <Link
          href="/e/les"
          className="paper-link mx-auto mt-4 block px-1 py-[5px] font-sans text-[12.5px] font-semibold tracking-[0.1px] text-[rgba(24,48,92,0.6)]"
        >
          <span className="text-red">←</span> Back to start
        </Link>
      </div>
    </main>
  );
}
