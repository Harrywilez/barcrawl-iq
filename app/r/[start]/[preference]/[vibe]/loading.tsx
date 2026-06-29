/**
 * Loading fallback for the result route — shown via the segment's Suspense
 * boundary while the Supabase fetch is in flight. Paper-styled; the spinner
 * holds still under prefers-reduced-motion.
 */
export default function Loading() {
  return (
    <main className="paper-screen">
      <div className="paper-frame items-center justify-center gap-5 px-5 pb-4 pt-[50px] text-center">
        <div className="font-sans text-[20px] font-extrabold tracking-[-0.3px] text-ink">
          BARCRAWL{" "}
          <span className="rounded-[2px] bg-red px-[7px] py-px text-paper">
            IQ
          </span>
        </div>
        <div className="font-display text-[26px] font-semibold italic text-ink">
          Building your route…
        </div>
        <div className="h-6 w-6 rounded-full border-2 border-[rgba(24,48,92,0.2)] border-t-red motion-safe:animate-spin" />
      </div>
    </main>
  );
}
