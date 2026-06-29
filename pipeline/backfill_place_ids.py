"""Backfill Google `place_id` onto the 25 active bars in Supabase (server-side).

WHY: the Maps hand-off should open each stop as its real Google business listing
(rich place card). That needs each bar's stable Google `place_id`, which the bars
table did not have. This one-time script resolves a place_id per active bar and
writes the trustworthy ones back to Supabase.

WHAT IT DOES, per active bar (is_active=true in bars_enriched.csv — the same 25
rows load_supabase.py pushed):
  * Places (New) Text Search on "<name> <address>" — the EXACT call shape from
    pipeline/verify/verify_google_places.py (key in the X-Goog-Api-Key header
    only; Places (New) requires X-Goog-FieldMask), with tenacity backoff.
  * Cross-checks the returned place the SAME way Phase 1 (enrich_bars.py) did:
    haversine distance between the returned location and the bar's CSV lat/lng.
    A match is FLAGGED — and its place_id is NOT written — if it is >~150 m away,
    has no match, or the request failed. We never silently accept a possibly-wrong
    venue; flagged bars stay place_id = NULL and the app falls back to name+address.
  * Writes only the CLEAN place_ids back to Supabase, keyed on bar_id (service
    role, which bypasses RLS). Only the place_id column is touched; no other bar
    column and no route is modified. As an extra guard against ever creating a
    stub row, we confirm each bar_id already exists before writing.

PREREQUISITE: apply pipeline/sql/add_place_id.sql first (PostgREST can't run DDL,
so the place_id column must already exist).

SECURITY: the Google key and the Supabase service-role key are read from env via
pipeline/config.py and used ONLY where required (Google key in the X-Goog-Api-Key
header, never a URL/query string; service-role key only inside the Supabase
client). No secret VALUE is ever printed or logged.

Run (after the SQL is applied):
    pipeline/.venv/bin/python pipeline/backfill_place_ids.py
    pipeline/.venv/bin/python pipeline/backfill_place_ids.py --dry-run   # fetch + report, NO writes
"""

from __future__ import annotations

import csv
import math
import sys
import time
from pathlib import Path

# Put pipeline/ on the path so `import config` works regardless of cwd.
sys.path.insert(0, str(Path(__file__).resolve().parent))
import config  # noqa: E402  (loads + validates env, never logs secret values)

import requests  # noqa: E402
from postgrest.exceptions import APIError  # noqa: E402
from supabase import create_client  # noqa: E402
from tenacity import (  # noqa: E402
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

# --------------------------------------------------------------------------------------
# Paths / constants
# --------------------------------------------------------------------------------------
_DATA = Path(__file__).resolve().parent / "data"
BARS_CSV = _DATA / "bars_enriched.csv"          # same source load_supabase.py reads

URL = "https://places.googleapis.com/v1/places:searchText"

# EXACT call shape from verify_google_places.py / enrich_bars.py: key in the
# X-Goog-Api-Key header only; Places (New) requires X-Goog-FieldMask. We need id +
# location (for the distance cross-check) and displayName/formattedAddress (report).
HEADERS = {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": config.GOOGLE_MAPS_API_KEY,
    "X-Goog-FieldMask": (
        "places.id,places.displayName,places.formattedAddress,places.location"
    ),
}

DISTANCE_FLAG_M = 150.0      # flag (and DO NOT write) if returned place is >~150 m away
POLITE_DELAY_S = 0.4         # small delay between calls to be polite to the API


# --------------------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------------------
def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in metres between two lat/lng points (matches Phase 1)."""
    r = 6371000.0  # Earth radius (m)
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _num(value) -> float | None:
    """Coerce to float, returning None for missing/blank values."""
    if value is None:
        return None
    try:
        s = str(value).strip()
        return float(s) if s else None
    except (TypeError, ValueError):
        return None


def _is_retryable(resp: requests.Response) -> bool:
    return resp.status_code == 429 or resp.status_code >= 500


@retry(
    retry=retry_if_exception_type(requests.RequestException),
    wait=wait_exponential(multiplier=1, min=1, max=20),
    stop=stop_after_attempt(4),
    reraise=True,
)
def places_text_search(query: str) -> requests.Response:
    """Places (New) Text Search. Retries (with backoff) only on 429/5xx/network errors."""
    resp = requests.post(URL, headers=HEADERS, json={"textQuery": query}, timeout=30)
    if _is_retryable(resp):
        # Raise so tenacity retries; message carries status only — no secret values.
        raise requests.HTTPError(f"retryable HTTP {resp.status_code}")
    return resp


def load_active_bars() -> list[dict]:
    """The is_active=true rows (the same 25 load_supabase.py pushed)."""
    rows: list[dict] = []
    with BARS_CSV.open(newline="") as fh:
        for r in csv.DictReader(fh):
            if str(r.get("is_active")).strip().lower() != "true":
                continue
            rows.append(r)
    return rows


# --------------------------------------------------------------------------------------
# Resolve one bar -> {place_id, flags, ...}. Never raises; failures become flags.
# --------------------------------------------------------------------------------------
def resolve_bar(bar: dict) -> dict:
    bar_id = bar["bar_id"]
    name = str(bar.get("bar_name") or "")
    address = str(bar.get("address") or "")
    query = f"{name} {address}".strip()

    csv_lat = _num(bar.get("lat"))
    csv_lng = _num(bar.get("lng"))
    csv_place_id = (bar.get("place_id") or "").strip()  # Phase-1 value, for cross-ref only

    result = {
        "bar_id": bar_id,
        "name": name,
        "place_id": None,
        "matched_name": None,
        "matched_address": None,
        "distance_m": None,
        "csv_place_id": csv_place_id or None,
        "flags": [],
    }

    try:
        resp = places_text_search(query)
    except requests.RequestException as exc:
        result["flags"].append(f"request_failed:{exc}")  # status/network only — no secrets
        return result

    if resp.status_code != 200:
        result["flags"].append(f"http_{resp.status_code}")
        return result

    places = (resp.json() or {}).get("places") or []
    if not places:
        result["flags"].append("no_match")
        return result

    # Take the top result but DO NOT blindly trust it — cross-check distance below.
    p = places[0]
    loc = p.get("location") or {}
    g_lat, g_lng = _num(loc.get("latitude")), _num(loc.get("longitude"))
    g_id = p.get("id")
    result["matched_name"] = (p.get("displayName") or {}).get("text")
    result["matched_address"] = p.get("formattedAddress")

    if None not in (csv_lat, csv_lng, g_lat, g_lng):
        dist = round(haversine_m(csv_lat, csv_lng, g_lat, g_lng), 1)
        result["distance_m"] = dist
        if dist > DISTANCE_FLAG_M:
            result["flags"].append(f"location_mismatch_{dist:.0f}m")
    else:
        # Can't verify location -> don't trust the match.
        result["flags"].append("no_location_to_verify")

    if not g_id:
        result["flags"].append("no_place_id_returned")

    # Only a clean, location-verified match yields a writable place_id.
    if not result["flags"] and g_id:
        result["place_id"] = g_id

    return result


# --------------------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------------------
def main() -> None:
    dry_run = "--dry-run" in sys.argv

    bars = load_active_bars()
    print(f"Loaded {len(bars)} active bars from {BARS_CSV.name}.")
    print("Resolving each bar's Google place_id via Places (New) Text Search...\n")

    resolved: list[dict] = []
    for bar in bars:
        r = resolve_bar(bar)
        resolved.append(r)
        dist_s = f"{r['distance_m']}m" if r["distance_m"] is not None else "-"
        if r["flags"]:
            print(f"  [{r['bar_id']:>26}] FLAGGED ({', '.join(r['flags'])})  dist={dist_s}")
        else:
            same = " (== CSV)" if r["csv_place_id"] == r["place_id"] else " (DIFFERS from CSV)"
            note = same if r["csv_place_id"] else ""
            print(f"  [{r['bar_id']:>26}] -> '{r['matched_name']}'  dist={dist_s}  "
                  f"place_id={r['place_id']}{note}")
        time.sleep(POLITE_DELAY_S)

    clean = [r for r in resolved if r["place_id"]]
    flagged = [r for r in resolved if not r["place_id"]]

    # ----------------------------------------------------------------------------------
    # Write the CLEAN place_ids back to Supabase (service role). Flagged bars are left
    # NULL on purpose. Guard: only write bar_ids that already exist, so an upsert can
    # never create a stub row and existing bars/routes are never disturbed.
    # ----------------------------------------------------------------------------------
    wrote = 0
    write_errors: list[str] = []
    if dry_run:
        print("\n--dry-run: skipping all Supabase writes.")
    elif clean:
        client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY)

        # Confirm the column exists + which bar_ids are present (fail clearly otherwise).
        try:
            existing = client.table("bars").select("bar_id,place_id").execute().data or []
        except APIError as e:
            if "place_id" in str(e) and ("column" in str(e).lower() or e.code == "42703"):
                sys.exit(
                    "ERROR: bars.place_id does not exist yet. Apply the schema first:\n"
                    "  pipeline/sql/add_place_id.sql  (Supabase SQL Editor)\n"
                    "Then re-run this script."
                )
            raise
        existing_ids = {row["bar_id"] for row in existing}

        payload = []
        for r in clean:
            if r["bar_id"] in existing_ids:
                payload.append({"bar_id": r["bar_id"], "place_id": r["place_id"]})
            else:
                write_errors.append(f"{r['bar_id']}: not present in bars table — skipped (no stub created)")

        if payload:
            try:
                # Upsert keyed on bar_id; only {bar_id, place_id} sent, so for these
                # already-existing rows ONLY place_id is updated — nothing else moves.
                client.table("bars").upsert(payload, on_conflict="bar_id").execute()
                wrote = len(payload)
            except APIError as e:
                write_errors.append(f"upsert failed: {e.message or e}")

        # Read back how many active bars now carry a place_id (proof the writes landed).
        after = client.table("bars").select("bar_id,place_id").execute().data or []
        active_ids = {b["bar_id"] for b in bars}
        now_set = sum(1 for row in after if row["bar_id"] in active_ids and (row.get("place_id") or "").strip())
    else:
        now_set = 0

    # ----------------------------------------------------------------------------------
    # Report
    # ----------------------------------------------------------------------------------
    print("\n" + "=" * 78)
    print("PLACE_ID BACKFILL REPORT")
    print("=" * 78)
    print(f"Active bars processed:   {len(resolved)}")
    print(f"Resolved cleanly:        {len(clean)}")
    print(f"Flagged (NOT written):   {len(flagged)}")
    if not dry_run and clean:
        print(f"place_ids written:       {wrote}")
        print(f"Active bars now w/ id:   {now_set}/{len(resolved)} (read back from Supabase)")

    differ = [r for r in clean if r["csv_place_id"] and r["csv_place_id"] != r["place_id"]]
    if differ:
        print(f"\nClean matches whose place_id DIFFERS from the Phase-1 CSV value ({len(differ)}):")
        for r in differ:
            print(f"  {r['bar_id']:<26} csv={r['csv_place_id']}  now={r['place_id']}")
    elif clean:
        print("\nAll clean place_ids match the Phase-1 CSV values (sanity check OK).")

    if flagged:
        print("\n--- FLAGGED bars for your review (left place_id = NULL; app falls back) ---")
        for r in flagged:
            dist_s = f"{r['distance_m']}m" if r["distance_m"] is not None else "-"
            print(f"  {r['bar_id']:<26} {', '.join(r['flags'])}  "
                  f"(matched='{r['matched_name']}', dist={dist_s})")
    else:
        print("\nNo flagged bars — every active bar resolved to a location-verified place_id.")

    if write_errors:
        print("\n--- WRITE ISSUES ---")
        for e in write_errors:
            print(f"  - {e}")

    print("\n" + "=" * 78)
    if dry_run:
        print("Dry run complete — no Supabase writes were made.")
    else:
        print("Done. Only the place_id column was touched; bars/routes are otherwise untouched.")
    print("=" * 78)

    if write_errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
