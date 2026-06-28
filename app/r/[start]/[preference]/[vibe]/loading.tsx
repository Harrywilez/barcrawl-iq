/**
 * Loading fallback for the result route — shown via the segment's Suspense
 * boundary while the Supabase fetch is in flight (e.g. the client transition
 * from /e/les, or first-load streaming) instead of a blank screen.
 */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <p className="text-gray-600">Building your route…</p>
    </main>
  );
}
