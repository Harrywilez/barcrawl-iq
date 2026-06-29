import { permanentRedirect } from "next/navigation";

/**
 * The bare root "/" has no content of its own — the real entry point is the
 * Lower East Side crawl builder at /e/les (what the QR codes and the bare
 * domain should land on). Permanently (308) send "/" there.
 *
 * We redirect to a CLEAN /e/les with NO ?src: a bare visit has no scan source,
 * and /e/les already handles the no-src case by showing the bar picker. (A
 * next.config redirect would instead pass any query on "/" straight through to
 * the destination, so this page-level redirect is what guarantees no src is
 * ever carried onto the bare-root hand-off.)
 */
export default function Home() {
  permanentRedirect("/e/les");
}
