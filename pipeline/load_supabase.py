"""Load the 25 active bars and 900 routes into Supabase (server-side, admin).

Uses the SERVICE-ROLE key (via pipeline/config.py) which bypasses RLS. Secrets are
read from env only — this script never hardcodes, prints, or logs key values.

What it does:
  * Upserts active bars on `bar_id`.
  * Upserts routes on the unique key (start_bar_id, preference, vibe, rank).
  * Idempotent: re-running replaces matching rows, never duplicates. Routes batched.
  * Reports any batch error loudly; never half-loads silently without saying so.

Prerequisite: the schema (pipeline/sql/schema.sql) must already be applied — PostgREST
cannot run DDL, so this script only writes rows into tables that already exist.

Run:
    pipeline/.venv/bin/python pipeline/load_supabase.py
"""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

# Put pipeline/ on the path so `import config` works regardless of cwd.
sys.path.insert(0, str(Path(__file__).resolve().parent))
import config  # noqa: E402

from postgrest.exceptions import APIError  # noqa: E402
from supabase import create_client  # noqa: E402

_DATA = Path(__file__).resolve().parent / "data"
BARS_CSV = _DATA / "bars_enriched.csv"
ROUTES_JSON = _DATA / "routes.json"

ROUTE_BATCH = 300  # chunk the 900 route upserts


# --------------------------------------------------------------------------- #
# Small typed-coercion helpers — blank CSV cells become NULL, not "".
# --------------------------------------------------------------------------- #
def _f(value):
    """float or None"""
    if value is None or str(value).strip() == "":
        return None
    return float(value)


def _i(value):
    """int or None"""
    if value is None or str(value).strip() == "":
        return None
    return int(float(value))  # tolerate "163.0"-style ints


def _truthy(value) -> bool:
    return str(value).strip().lower() == "true"


# --------------------------------------------------------------------------- #
# Build payloads
# --------------------------------------------------------------------------- #
def load_active_bars() -> list[dict]:
    """Only is_active=true rows, projected to the bars table's columns."""
    rows: list[dict] = []
    with BARS_CSV.open(newline="") as fh:
        for r in csv.DictReader(fh):
            if not _truthy(r.get("is_active")):
                continue
            rows.append(
                {
                    "bar_id": r["bar_id"],
                    "bar_name": r.get("bar_name") or None,
                    "address": r.get("address") or None,
                    "lat": _f(r.get("lat")),
                    "lng": _f(r.get("lng")),
                    "rating": _f(r.get("rating")),
                    "review_count": _i(r.get("review_count")),
                    "bayesian_score": _f(r.get("bayesian_score")),
                    "avg_cost": _f(r.get("avg_cost")),
                    "vibe_consolidated": r.get("vibe_consolidated") or None,
                }
            )
    return rows


def load_routes() -> list[dict]:
    """All 900 route objects, projected to the routes table's columns."""
    doc = json.loads(ROUTES_JSON.read_text())
    out: list[dict] = []
    for rt in doc["routes"]:
        out.append(
            {
                "start_bar_id": rt["start_bar_id"],
                "preference": rt["preference"],
                "vibe": rt["vibe"],
                "rank": _i(rt["rank"]),
                "stops": rt["stops"],                       # -> jsonb
                "legs": rt["legs"],                         # -> jsonb
                "total_walk_min": _f(rt.get("total_walk_min")),
                "total_distance_m": _f(rt.get("total_distance_m")),
                "max_leg_s": _i(rt.get("max_leg_s")),
                "selected_avg_bayesian": _f(rt.get("selected_avg_bayesian")),
                "selected_avg_cost": _f(rt.get("selected_avg_cost")),
                "selected_avg_rating": _f(rt.get("selected_avg_rating")),
                "blended_score": _f(rt.get("blended_score")),
                "explanation": rt.get("explanation") or None,
            }
        )
    return out


# --------------------------------------------------------------------------- #
# Load
# --------------------------------------------------------------------------- #
def _preflight(client) -> None:
    """Fail early with a clear message if the schema hasn't been applied yet."""
    for table in ("bars", "routes"):
        try:
            client.table(table).select("*", count="exact").limit(0).execute()
        except APIError as e:
            if e.code in ("PGRST205", "42P01") or "schema cache" in str(e):
                sys.exit(
                    f"ERROR: table '{table}' does not exist. Apply the schema first:\n"
                    f"  pipeline/sql/schema.sql  (Supabase SQL Editor, psql, or Mgmt API)\n"
                    f"Then re-run this script."
                )
            raise


def main() -> None:
    bars = load_active_bars()
    routes = load_routes()
    print(f"Prepared {len(bars)} active bars and {len(routes)} routes for upsert.")

    client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY)
    _preflight(client)

    errors: list[str] = []

    # --- bars: single upsert keyed on bar_id ---
    try:
        client.table("bars").upsert(bars, on_conflict="bar_id").execute()
        print(f"  upserted bars: {len(bars)}")
    except APIError as e:
        errors.append(f"bars upsert failed: {e.message or e}")
        print(f"  ERROR upserting bars: {e.message or e}")

    # --- routes: batched upsert keyed on the unique (start,pref,vibe,rank) ---
    done = 0
    for start in range(0, len(routes), ROUTE_BATCH):
        chunk = routes[start : start + ROUTE_BATCH]
        try:
            client.table("routes").upsert(
                chunk, on_conflict="start_bar_id,preference,vibe,rank"
            ).execute()
            done += len(chunk)
            print(f"  upserted routes batch {start}-{start + len(chunk) - 1} "
                  f"({done}/{len(routes)})")
        except APIError as e:
            errors.append(
                f"routes batch starting at {start} failed: {e.message or e}"
            )
            print(f"  ERROR upserting routes batch at {start}: {e.message or e}")

    # --- verify counts actually landed ---
    bar_count = client.table("bars").select("*", count="exact").limit(0).execute().count
    route_count = (
        client.table("routes").select("*", count="exact").limit(0).execute().count
    )
    print(f"\nRow counts now in Supabase: bars={bar_count} (expect {len(bars)}), "
          f"routes={route_count} (expect {len(routes)})")

    if errors:
        print("\nLOAD FINISHED WITH ERRORS:")
        for e in errors:
            print(f"  - {e}")
        sys.exit(1)

    if bar_count != len(bars) or route_count != len(routes):
        print("\nWARNING: row counts do not match expected — investigate before trusting.")
        sys.exit(1)

    print("\nOK: bars + routes loaded; counts match. Idempotent — safe to re-run.")


if __name__ == "__main__":
    main()
