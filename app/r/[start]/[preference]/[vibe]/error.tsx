"use client";

/**
 * Error boundary for the result route. Catches a FAILED Supabase READ (network
 * drop, etc.) thrown during render and shows a friendly retry instead of a
 * crash. Invalid params are NOT errors — the page renders its own "route not
 * found" message and never reaches here.
 *
 * Phase 6: on-brand glass reskin; the messages, retry, and links are unchanged.
 */
import Link from "next/link";
import { HeroFace, SecondaryFace } from "@/components/ButtonFaces";

export default function RouteError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="screen flex flex-1 flex-col justify-center">
      <div className="glass-panel animate-fade-up px-6 py-8 text-center">
        <h1 className="font-display text-[22px] font-bold text-cream">
          Couldn&apos;t load your route — try again
        </h1>
        <p className="mt-3 text-[14px] text-white/60">
          Something went wrong loading this crawl. Check your connection and
          retry.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="btn-hero"
          >
            <HeroFace>Try again</HeroFace>
          </button>
          <Link href="/e/les" className="btn-secondary">
            <SecondaryFace>Back to start</SecondaryFace>
          </Link>
        </div>
      </div>
    </main>
  );
}
