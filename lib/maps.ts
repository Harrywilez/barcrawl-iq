/**
 * Build a Google Maps walking-directions deep link from an ordered list of bars.
 *
 * Format (per Google's Maps URLs API, ?api=1 directions mode):
 *   https://www.google.com/maps/dir/?api=1
 *     &origin=<text>            &origin_place_id=<id>
 *     &destination=<text>       &destination_place_id=<id>
 *     &waypoints=<text>|<text>  &waypoint_place_ids=<id>|<id>
 *     &travelmode=walking
 *
 * origin      = first bar
 * destination = last bar
 * waypoints   = every bar in between, joined by a literal "|"
 *
 * Each stop ALWAYS carries its "Name, Address" TEXT. When a bar has a Google
 * `place_id`, we ALSO attach the matching *_place_id param so Maps opens the
 * real business listing (rich place card) instead of resolving a text search.
 * Per Google's API a place_id param must accompany its text value, so the text
 * stays as the built-in fallback: a missing or bad place_id simply degrades to
 * the previous name+address behaviour and never yields a broken link.
 */
import type { Bar } from "./types";

/** "Iggy's Keltic Lounge, 88 Avenue A, New York, NY 10009" -> URL-encoded. */
function stopQuery(bar: Bar): string {
  return encodeURIComponent(`${bar.bar_name}, ${bar.address}`);
}

/** A usable (trimmed, non-empty) place_id, or null. */
function placeId(bar: Bar): string | null {
  const pid = bar.place_id?.trim();
  return pid ? pid : null;
}

export function buildWalkingMapsUrl(orderedBars: Bar[]): string {
  if (orderedBars.length < 2) {
    throw new Error("buildWalkingMapsUrl needs at least 2 bars (origin + destination).");
  }

  const origin = orderedBars[0];
  const destination = orderedBars[orderedBars.length - 1];
  const waypoints = orderedBars.slice(1, -1);

  const params = [
    "api=1",
    `origin=${stopQuery(origin)}`,
    `destination=${stopQuery(destination)}`,
  ];

  // Attach place IDs alongside the text. origin/destination are independent, so
  // add each only when present — a missing one just falls back to its text value.
  const originPid = placeId(origin);
  if (originPid) params.push(`origin_place_id=${encodeURIComponent(originPid)}`);
  const destPid = placeId(destination);
  if (destPid) params.push(`destination_place_id=${encodeURIComponent(destPid)}`);

  if (waypoints.length > 0) {
    // Encode each stop, but keep the "|" separator literal (Google expects it).
    params.push(`waypoints=${waypoints.map(stopQuery).join("|")}`);

    // waypoint_place_ids must map 1:1 to waypoints (same count + order). Only
    // emit it when EVERY waypoint has a place_id; if even one is missing we omit
    // the whole param so the text waypoints above resolve all of them — a single
    // gap can never misalign the list and break the link.
    const waypointPids = waypoints.map(placeId);
    if (waypointPids.every((p): p is string => p !== null)) {
      params.push(
        `waypoint_place_ids=${waypointPids.map(encodeURIComponent).join("|")}`,
      );
    }
  }

  params.push("travelmode=walking");

  return `https://www.google.com/maps/dir/?${params.join("&")}`;
}
