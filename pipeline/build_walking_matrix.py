"""Phase 2 — pairwise WALKING time/distance matrix for all active bars.

Fetches the full directional walking matrix between every pair of active bars ONCE
via the Google Routes API ``computeRouteMatrix`` endpoint, then caches it to disk
keyed by ``bar_id``. This is the ONLY real Routes API batch in the project: every
route's walk time downstream is arithmetic on this cache, never a new API call.

CACHE-FIRST: if pipeline/cache/walking_matrix.json already covers all current active
bar_ids, the API is NOT called — the cache is loaded, validated, and reported
("cache hit, 0 API calls"). Pass --force to re-fetch from the API regardless.

Security:
  * The API key is read from env via pipeline/config.py and sent ONLY in the
    X-Goog-Api-Key header. It is never hardcoded, printed, logged, or placed in a URL.
  * computeRouteMatrix puts all coordinates in the POST body, never the URL.

Endpoint notes (differ from the single-route verify script — do not conflate them):
  * URL:  POST https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix
  * The matrix field mask uses TOP-LEVEL names (no "routes." prefix):
        originIndex,destinationIndex,duration,distanceMeters,condition
  * travelMode WALK only. NO routingPreference / TRAFFIC_AWARE (driving-only; would
    bump the SKU to Pro and is invalid for walking — plain WALK stays free Essentials).

Run:
    pipeline/.venv/bin/python pipeline/build_walking_matrix.py [--force]
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config  # noqa: E402  (reads the key from .env.local; never prints it)

import pandas as pd  # noqa: E402
import requests  # noqa: E402
from tenacity import (  # noqa: E402
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_PIPELINE_DIR = Path(__file__).resolve().parent
CSV = _PIPELINE_DIR / "data" / "bars_enriched.csv"
CACHE_PATH = _PIPELINE_DIR / "cache" / "walking_matrix.json"

URL = "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix"
FIELD_MASK = "originIndex,destinationIndex,duration,distanceMeters,condition"
TRAVEL_MODE = "WALK"

MAX_ELEMENTS_PER_REQUEST = 600  # non-transit cap is 625; stay under it for safety
REQUEST_DELAY_S = 0.5           # polite gap between chunk requests
LONG_LEG_FLAG_S = 15 * 60       # legs longer than this are suspicious (bad coord?)
DIAGONAL_TOLERANCE_S = 5        # a bar->itself leg should be ~0 seconds


class _RetryableHTTPError(Exception):
    """Raised on 429/5xx so tenacity retries; carries no secret material."""


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------
def load_active_bars() -> list[dict]:
    """Return active bars as [{bar_id, bar_name, lat, lng}], CSV treated read-only."""
    df = pd.read_csv(CSV)
    active = df[df["is_active"] == True]  # noqa: E712 (pandas boolean mask)
    bars = [
        {
            "bar_id": str(row.bar_id),
            "bar_name": str(row.bar_name),
            "lat": float(row.lat),
            "lng": float(row.lng),
        }
        for row in active.itertuples(index=False)
    ]
    # Fail loudly on bad input rather than silently producing a partial matrix.
    ids = [b["bar_id"] for b in bars]
    if len(set(ids)) != len(ids):
        raise ValueError("duplicate bar_id among active bars; cannot key the matrix")
    for b in bars:
        if pd.isna(b["lat"]) or pd.isna(b["lng"]):
            raise ValueError(f"active bar {b['bar_id']!r} has null lat/lng")
    return bars


def _waypoint(bar: dict) -> dict:
    return {"waypoint": {"location": {"latLng": {"latitude": bar["lat"], "longitude": bar["lng"]}}}}


def _parse_duration_s(raw: str) -> int:
    """Convert a Routes API duration string like '67s' to integer seconds."""
    return int(round(float(str(raw).rstrip("s"))))


# ---------------------------------------------------------------------------
# API call
# ---------------------------------------------------------------------------
@retry(
    retry=retry_if_exception_type((_RetryableHTTPError, requests.exceptions.RequestException)),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    stop=stop_after_attempt(5),
    reraise=True,
)
def _post_matrix(origins: list[dict], destinations: list[dict]) -> list[dict]:
    """POST one chunk to computeRouteMatrix; return the list of element dicts."""
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": config.GOOGLE_MAPS_API_KEY,  # key ONLY here, never echoed
        "X-Goog-FieldMask": FIELD_MASK,
    }
    body = {
        "origins": [_waypoint(b) for b in origins],
        "destinations": [_waypoint(b) for b in destinations],
        "travelMode": TRAVEL_MODE,
    }
    resp = requests.post(URL, headers=headers, json=body, timeout=60)
    if resp.status_code == 429 or 500 <= resp.status_code < 600:
        # Google error bodies carry a status/message and never echo the key.
        raise _RetryableHTTPError(f"HTTP {resp.status_code}: {resp.text[:300]}")
    if resp.status_code != 200:
        raise RuntimeError(f"HTTP {resp.status_code}: {resp.text[:500]}")
    data = resp.json()
    if not isinstance(data, list):
        raise RuntimeError(f"unexpected response shape (not a list): {str(data)[:300]}")
    return data


def fetch_matrix(bars: list[dict]) -> tuple[dict, list[str], int]:
    """Fetch the full directional matrix from the API.

    Returns (matrix_by_bar_id, failed_elements, api_calls).
    """
    n = len(bars)
    destinations = bars
    chunk_size = max(1, MAX_ELEMENTS_PER_REQUEST // len(destinations))

    # Pre-build empty matrix so missing elements are detectable afterwards.
    matrix: dict[str, dict[str, dict]] = {
        b["bar_id"]: {d["bar_id"]: None for d in destinations} for b in bars
    }
    failed: list[str] = []
    api_calls = 0

    for start in range(0, n, chunk_size):
        origins = bars[start : start + chunk_size]
        elements = _post_matrix(origins, destinations)
        api_calls += 1
        print(
            f"  chunk {api_calls}: origins[{start}:{start + len(origins)}] "
            f"({len(origins)}x{len(destinations)} = {len(origins) * len(destinations)} elements) "
            f"-> {len(elements)} returned"
        )

        for el in elements:
            # originIndex is relative to THIS chunk's origins; map back to global.
            local_oi = el.get("originIndex")
            di = el.get("destinationIndex")
            if local_oi is None or di is None:
                failed.append(f"element missing index: {el}")
                continue
            from_id = origins[local_oi]["bar_id"]
            to_id = destinations[di]["bar_id"]
            condition = el.get("condition")
            # NOTE: Routes API omits proto3 default values, so a zero-length leg
            # (notably the A->A diagonal) comes back as {"duration":"0s",
            # "condition":"ROUTE_EXISTS"} with distanceMeters ABSENT. Absent == 0,
            # not a failure. Only a non-ROUTE_EXISTS condition is a real failure.
            if condition != "ROUTE_EXISTS" or "duration" not in el:
                failed.append(
                    f"{from_id}->{to_id}: condition={condition} "
                    f"duration={el.get('duration')} distanceMeters={el.get('distanceMeters')}"
                )
                continue
            matrix[from_id][to_id] = {
                "duration_s": _parse_duration_s(el["duration"]),
                "distance_m": int(el.get("distanceMeters") or 0),
            }

        if start + chunk_size < n:
            time.sleep(REQUEST_DELAY_S)

    # Any cell still None was never returned by the API.
    for from_id, row in matrix.items():
        for to_id, val in row.items():
            if val is None:
                failed.append(f"{from_id}->{to_id}: no element returned")

    return matrix, failed, api_calls


# ---------------------------------------------------------------------------
# Cache I/O
# ---------------------------------------------------------------------------
def build_cache_doc(matrix: dict, bars: list[dict]) -> dict:
    return {
        "meta": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "mode": TRAVEL_MODE,
            "bar_count": len(bars),
            "endpoint": "computeRouteMatrix",
        },
        "matrix": matrix,
    }


def cache_covers(doc: dict, bars: list[dict]) -> bool:
    """True iff the cached matrix has every ordered (from,to) pair for current bars."""
    ids = {b["bar_id"] for b in bars}
    matrix = doc.get("matrix") or {}
    if set(matrix.keys()) != ids:
        return False
    for from_id in ids:
        row = matrix.get(from_id) or {}
        if set(row.keys()) != ids:
            return False
        for to_id in ids:
            cell = row.get(to_id)
            if not isinstance(cell, dict) or "duration_s" not in cell or "distance_m" not in cell:
                return False
    return True


# ---------------------------------------------------------------------------
# Validation + report
# ---------------------------------------------------------------------------
def validate_and_report(matrix: dict, bars: list[dict], failed: list[str], api_calls: int | None) -> bool:
    """Validate the assembled/loaded matrix and print the report. Returns ok."""
    name_by_id = {b["bar_id"]: b["bar_name"] for b in bars}
    ids = [b["bar_id"] for b in bars]
    n = len(ids)

    print("\n" + "=" * 72)
    print("WALKING MATRIX — VALIDATION & REPORT")
    print("=" * 72)
    print(f"Matrix dimensions : {n} x {n}  ({n * n} ordered pairs)")
    if api_calls is None:
        print("API calls         : cache hit, 0 API calls")
    else:
        print(f"API calls         : {api_calls}")

    # Element completeness (already collected as `failed` during fetch; for cache
    # hits we re-derive from presence of duration_s/distance_m).
    element_count = 0
    derived_failures: list[str] = []
    for from_id in ids:
        for to_id in ids:
            cell = (matrix.get(from_id) or {}).get(to_id)
            if isinstance(cell, dict) and "duration_s" in cell and "distance_m" in cell:
                element_count += 1
            else:
                derived_failures.append(f"{from_id}->{to_id}: missing/invalid cell")
    all_failures = list(failed) + [f for f in derived_failures if f not in failed]
    print(f"Elements present  : {element_count} / {n * n}")

    print(f"Failed elements   : {len(all_failures)}")
    for f in all_failures[:25]:
        print(f"    FAIL  {f}")
    if len(all_failures) > 25:
        print(f"    ... and {len(all_failures) - 25} more")

    # Diagonal ~= 0
    diag_problems = []
    diag_max = 0
    for bid in ids:
        cell = (matrix.get(bid) or {}).get(bid) or {}
        d = cell.get("duration_s")
        if d is None:
            diag_problems.append(f"{bid}: diagonal missing")
        else:
            diag_max = max(diag_max, d)
            if d > DIAGONAL_TOLERANCE_S:
                diag_problems.append(f"{name_by_id[bid]} ({bid}): {d}s")
    print(f"Diagonal max      : {diag_max}s  (tolerance <= {DIAGONAL_TOLERANCE_S}s)")
    if diag_problems:
        print(f"Diagonal problems : {len(diag_problems)}")
        for p in diag_problems:
            print(f"    DIAG  {p}")
    else:
        print("Diagonal check    : OK (all bar->itself legs ~= 0)")

    # Off-diagonal leg stats
    legs = []  # (duration_s, distance_m, from_id, to_id)
    for from_id in ids:
        for to_id in ids:
            if from_id == to_id:
                continue
            cell = (matrix.get(from_id) or {}).get(to_id)
            if isinstance(cell, dict) and "duration_s" in cell:
                legs.append((cell["duration_s"], cell["distance_m"], from_id, to_id))

    if legs:
        durs = [l[0] for l in legs]
        min_leg = min(legs, key=lambda l: l[0])
        max_leg = max(legs, key=lambda l: l[0])
        median_s = statistics.median(durs)

        def _fmt(leg):
            d_s, dist_m, fid, tid = leg
            return (
                f"{d_s/60:.1f} min / {dist_m} m  "
                f"({name_by_id[fid]} -> {name_by_id[tid]})"
            )

        print(f"\nDirected legs     : {len(legs)} (off-diagonal)")
        print(f"  min  leg        : {_fmt(min_leg)}")
        print(f"  median leg      : {median_s/60:.1f} min  ({int(median_s)}s)")
        print(f"  max  leg        : {_fmt(max_leg)}")

        long_legs = [l for l in legs if l[0] > LONG_LEG_FLAG_S]
        print(f"\nLegs > 15 min     : {len(long_legs)} flagged (possible bad coordinate)")
        for l in sorted(long_legs, key=lambda x: -x[0]):
            print(f"    LONG  {_fmt(l)}")
    else:
        print("\nNo off-diagonal legs found (matrix empty?)")

    # Spot-check named legs against the verify test (~67s for Two Doors Down -> Bar Goto)
    spot = [
        ("two_doors_down", "bar_goto"),
        ("bar_goto", "two_doors_down"),
        ("two_doors_down", "bar_revival"),
    ]
    print("\nSpot-check legs:")
    for fid, tid in spot:
        cell = (matrix.get(fid) or {}).get(tid)
        if isinstance(cell, dict):
            print(
                f"    {name_by_id.get(fid, fid)} -> {name_by_id.get(tid, tid)}: "
                f"{cell['duration_s']}s / {cell['distance_m']} m"
            )
        else:
            print(f"    {fid} -> {tid}: (not in matrix)")

    ok = not all_failures and not diag_problems
    print("\n" + ("RESULT: PASS — matrix complete and valid." if ok else "RESULT: ISSUES FOUND (see above)."))
    print("=" * 72)
    return ok


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser(description="Build/validate the walking-time matrix cache.")
    parser.add_argument("--force", action="store_true", help="re-fetch from the API even if cache is valid")
    args = parser.parse_args()

    bars = load_active_bars()
    print(f"Active bars: {len(bars)} (from {CSV.name}, read-only)")

    # CACHE-FIRST
    if CACHE_PATH.exists() and not args.force:
        try:
            doc = json.loads(CACHE_PATH.read_text())
        except Exception as e:
            print(f"Cache present but unreadable ({e}); will re-fetch.")
            doc = None
        if doc and cache_covers(doc, bars):
            print(f"Cache hit: {CACHE_PATH.relative_to(_PIPELINE_DIR.parent)} covers all active bars.")
            print("cache hit, 0 API calls")
            validate_and_report(doc["matrix"], bars, failed=[], api_calls=None)
            return
        if doc is not None:
            print("Cache present but does not cover all current active bars; re-fetching.")

    # FETCH
    print(f"Fetching walking matrix via {URL.split('/')[-1]} (chunked, WALK, no traffic)...")
    matrix, failed, api_calls = fetch_matrix(bars)

    doc = build_cache_doc(matrix, bars)
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(doc, indent=2))
    print(f"\nWrote cache: {CACHE_PATH.relative_to(_PIPELINE_DIR.parent)}")

    validate_and_report(matrix, bars, failed=failed, api_calls=api_calls)


if __name__ == "__main__":
    main()
