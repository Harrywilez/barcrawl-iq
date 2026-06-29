/**
 * Read-only data access for the web app.
 *
 * SECURITY: every query here goes through the browser-safe ANON client
 * (lib/supabaseClient.ts), which is gated by Row Level Security. This module
 * must NEVER import lib/supabaseAdmin.ts or any service-role / Google key.
 * It is safe to import from both Server and Client Components.
 */
import { supabase } from "./supabaseClient";
import type { Bar, Preference, Route, Vibe } from "./types";

const BAR_COLUMNS =
  "bar_id,bar_name,address,lat,lng,rating,review_count,bayesian_score,avg_cost,vibe_consolidated,place_id";

/** All 25 active bars, alphabetised — used to populate the start picker. */
export async function getActiveBars(): Promise<Bar[]> {
  const { data, error } = await supabase
    .from("bars")
    .select(BAR_COLUMNS)
    .order("bar_name");

  if (error) throw new Error(`getActiveBars failed: ${error.message}`);
  return (data ?? []) as Bar[];
}

/**
 * The precomputed route for a (start, preference, vibe) combo at a given rank.
 * Returns null when no such row exists (e.g. an invalid start bar id).
 */
export async function getRoute(
  start: string,
  preference: Preference,
  vibe: Vibe,
  rank = 1,
): Promise<Route | null> {
  const { data, error } = await supabase
    .from("routes")
    .select("*")
    .eq("start_bar_id", start)
    .eq("preference", preference)
    .eq("vibe", vibe)
    .eq("rank", rank)
    .maybeSingle();

  if (error) throw new Error(`getRoute failed: ${error.message}`);
  return (data as Route | null) ?? null;
}

/**
 * All ranked routes for a (start, preference, vibe) combo, ordered by rank
 * ascending (rank 1, 2, 3…). Used by the result page to render one rank and to
 * know how many alternatives exist for the "Show another option" cycle.
 */
export async function getRoutesForCombo(
  start: string,
  preference: Preference,
  vibe: Vibe,
): Promise<Route[]> {
  const { data, error } = await supabase
    .from("routes")
    .select("*")
    .eq("start_bar_id", start)
    .eq("preference", preference)
    .eq("vibe", vibe)
    .order("rank");

  if (error) throw new Error(`getRoutesForCombo failed: ${error.message}`);
  return (data ?? []) as Route[];
}

/**
 * Bar details for a list of ids, returned IN THE SAME ORDER as `ids`.
 * (Supabase `.in()` does not preserve input order, so we re-sort here — this
 * matters because callers pass the stops in walking order.)
 */
export async function getBarsByIds(ids: string[]): Promise<Bar[]> {
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("bars")
    .select(BAR_COLUMNS)
    .in("bar_id", ids);

  if (error) throw new Error(`getBarsByIds failed: ${error.message}`);

  const byId = new Map((data as Bar[] | null ?? []).map((b) => [b.bar_id, b]));
  return ids
    .map((id) => byId.get(id))
    .filter((b): b is Bar => b !== undefined);
}
