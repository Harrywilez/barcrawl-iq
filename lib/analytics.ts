/**
 * Minimal, anonymous analytics — the app's ONE write path.
 *
 * Inserts into analytics_events through the browser-safe ANON client. The table
 * is INSERT-ONLY for anon (see pipeline/sql/analytics.sql): the browser can add
 * events but can never read them. Every call here is FIRE-AND-FORGET — wrapped
 * so a failure never blocks render and never surfaces to the user.
 *
 * SECURITY: anon client only. No service-role, no Google key. No ip / geo /
 * fingerprint is collected — anonymous counts plus a per-visit session token.
 */
import { supabase } from "./supabaseClient";
import { getSessionId } from "./session";

const FIRED_KEY = "bc_fired_events";

/**
 * Returns true if `key` was ALREADY fired this visit (and otherwise marks it
 * fired now). Dedupes React StrictMode's double-invoke in dev, rank-cycling
 * re-renders, and back-nav revisits — all synchronous via sessionStorage.
 */
function alreadyFired(key: string): boolean {
  if (typeof window === "undefined") return true; // never fire on the server
  try {
    const raw = window.sessionStorage.getItem(FIRED_KEY);
    const fired: string[] = raw ? JSON.parse(raw) : [];
    if (fired.includes(key)) return true;
    fired.push(key);
    window.sessionStorage.setItem(FIRED_KEY, JSON.stringify(fired));
    return false;
  } catch {
    return false; // storage blocked — allow a best-effort fire
  }
}

async function insertEvent(payload: Record<string, unknown>): Promise<void> {
  try {
    // NO .select(): insert-only RLS has no SELECT policy, so request return=minimal.
    await supabase.from("analytics_events").insert(payload);
  } catch {
    // Fire-and-forget: swallow everything (network, RLS, table-missing, …).
  }
}

/** Fired on /e/les load. `sourceBarId` is the ?src= bar, or null. */
export function trackScan(sourceBarId: string | null): void {
  const session_id = getSessionId();
  if (alreadyFired(`scan:${sourceBarId ?? "none"}`)) return;
  void insertEvent({
    event_type: "scan",
    session_id,
    source_bar_id: sourceBarId,
  });
}

/** Fired on the result page load (once per combo, not per rank). */
export function trackRouteGenerated(args: {
  start: string;
  preference: string;
  vibe: string;
}): void {
  const session_id = getSessionId();
  if (alreadyFired(`route_generated:${args.start}:${args.preference}:${args.vibe}`)) {
    return;
  }
  void insertEvent({
    event_type: "route_generated",
    session_id,
    start_bar_id: args.start,
    preference: args.preference,
    vibe: args.vibe,
  });
}

/**
 * Fired when the user taps "Open Full Route in Google Maps". Same session_id as
 * scan/route_generated so it links into the funnel, plus the route they left on
 * (start_bar_id + preference + vibe). `vibe` is the canonical underlying value
 * ('classy', even though the UI shows "Cocktail").
 *
 * CRITICAL: fire-and-forget. The caller must NOT await this and the click must
 * open Maps regardless — the insert is kicked off without blocking navigation
 * (which is why it may slightly undercount; that's expected). Deduped once per
 * combo per visit, mirroring route_generated.
 */
export function trackMapsOpened(args: {
  start: string;
  preference: string;
  vibe: string;
}): void {
  const session_id = getSessionId();
  if (alreadyFired(`maps_opened:${args.start}:${args.preference}:${args.vibe}`)) {
    return;
  }
  void insertEvent({
    event_type: "maps_opened",
    session_id,
    start_bar_id: args.start,
    preference: args.preference,
    vibe: args.vibe,
  });
}
