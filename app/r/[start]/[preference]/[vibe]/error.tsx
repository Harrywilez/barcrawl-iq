"use client";

/**
 * Error boundary for the result route. Catches a FAILED Supabase READ (network
 * drop, etc.) thrown during render and shows a friendly retry instead of a
 * crash. Invalid params are NOT errors — the page renders its own "route not
 * found" message and never reaches here.
 */
import Link from "next/link";

export default function RouteError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold">Couldn&apos;t load your route — try again</h1>
      <p className="mt-2 text-gray-600">
        Something went wrong loading this crawl. Check your connection and retry.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-md bg-black px-5 py-3 font-semibold text-white"
        >
          Try again
        </button>
        <Link
          href="/e/les"
          className="rounded-md border border-gray-300 px-5 py-3"
        >
          Back to start
        </Link>
      </div>
    </main>
  );
}
