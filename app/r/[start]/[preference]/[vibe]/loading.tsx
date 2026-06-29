/**
 * Loading fallback for the result route — shown via the segment's Suspense
 * boundary while the Supabase fetch is in flight (e.g. the client transition
 * from /e/les, or first-load streaming) instead of a blank screen.
 *
 * Phase 6: on-brand glass panel + spinner.
 */
export default function Loading() {
  return (
    <main className="screen flex flex-1 flex-col items-center justify-center">
      <div className="glass-panel flex items-center gap-3 px-6 py-5">
        <span className="spinner" aria-hidden="true" />
        <p className="text-[15px] font-medium text-cream">
          Building your route…
        </p>
      </div>
    </main>
  );
}
