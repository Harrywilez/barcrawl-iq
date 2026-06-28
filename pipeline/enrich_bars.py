"""PHASE 1 — Bar enrichment (data script only).

Backfills Google review counts onto the bars in ``pipeline/data/bars_normalized.csv``
and computes the scores the route engine needs, writing the result to a NEW file
``pipeline/data/bars_enriched.csv``.

This script does NOT push to Supabase and does NOT modify the input CSV — the input
is treated as immutable raw data.

Security:
  * The Google Maps key is read from env via ``pipeline/config.py`` and sent ONLY in
    the ``X-Goog-Api-Key`` request header — never in a URL/query string, never printed
    or logged. No secret VALUES are ever echoed.

Run:
    pipeline/.venv/bin/python pipeline/enrich_bars.py
"""

from __future__ import annotations

import math
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config  # noqa: E402  (loads + validates env, never logs secret values)

import pandas as pd  # noqa: E402
import requests  # noqa: E402
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
INPUT_CSV = _DATA / "bars_normalized.csv"            # IMMUTABLE raw input
OUTPUT_CSV = _DATA / "bars_enriched.csv"             # new file we write

URL = "https://places.googleapis.com/v1/places:searchText"

# Reuse the EXACT working call shape from pipeline/verify/verify_google_places.py:
# key in X-Goog-Api-Key header only; Places (New) requires X-Goog-FieldMask. We extend
# the mask with formattedAddress + location so we can cross-check the match.
HEADERS = {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": config.GOOGLE_MAPS_API_KEY,
    "X-Goog-FieldMask": (
        "places.id,places.displayName,places.formattedAddress,"
        "places.location,places.rating,places.userRatingCount"
    ),
}

DISTANCE_FLAG_M = 150.0      # flag a match if returned location is >~150 m from CSV
RATING_FLAG_DELTA = 0.3      # flag if Google rating diverges from CSV rating by >0.3
POLITE_DELAY_S = 0.4         # small delay between calls to be polite to the API

# LOCKED vibe consolidation mapping. Output order is canonical (party, classy, dive, chill).
VIBE_MAP = {
    "party": {"party", "loud", "dancing"},
    "classy": {"classy", "cocktail"},
    "dive": {"dive"},
    "chill": {"chill"},
}
VIBE_ORDER = ["party", "classy", "dive", "chill"]

# Bars to deactivate in the ENRICHED output only (the raw input CSV is never changed).
# Rows are kept for the audit trail; everything downstream filters to is_active=true.
#   juke_box                  -> geographic outlier (~860 m from the nearest bar)
#   arlenes_grocery           -> live-music venue, no drink-price data
#   parkside_lounge_duplicate -> already is_active=false (listed to confirm/keep it so)
DEACTIVATE = {"juke_box", "arlenes_grocery", "parkside_lounge_duplicate"}


# --------------------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------------------
def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in metres between two lat/lng points."""
    r = 6371000.0  # Earth radius (m)
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def consolidate_vibes(vibe_tags: str) -> list[str]:
    """Map raw pipe-separated vibe_tags onto the LOCKED consolidated vibe set."""
    if not isinstance(vibe_tags, str):
        return []
    raw = {t.strip().lower() for t in vibe_tags.split("|") if t.strip()}
    return [name for name in VIBE_ORDER if raw & VIBE_MAP[name]]


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


def _num(value) -> float | None:
    """Coerce to float, returning None for missing/blank values."""
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    try:
        if isinstance(value, str) and not value.strip():
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


# --------------------------------------------------------------------------------------
# Fetch + assemble — the ONLY part that calls Google. Returns the enriched frame with
# base columns; derived columns (untrusted/bayesian/validation) are added by main().
# --------------------------------------------------------------------------------------
def fetch_and_assemble(df: pd.DataFrame) -> pd.DataFrame:
    review_count: list[float | None] = []
    google_rating: list[float | None] = []
    place_id: list[str | None] = []
    matched_name: list[str | None] = []
    google_address: list[str | None] = []
    match_distance_m: list[float | None] = []
    avg_cost: list[float | None] = []
    vibe_consolidated: list[str] = []
    match_flags: list[str] = []

    print("Querying Google Places (New) Text Search per bar...\n")
    for _, row in df.iterrows():
        name = str(row["bar_name"])
        address = str(row["address"]) if pd.notna(row.get("address")) else ""
        query = f"{name} {address}".strip()

        csv_lat = _num(row.get("lat"))
        csv_lng = _num(row.get("lng"))
        csv_rating = _num(row.get("rating"))

        # avg_cost = midpoint of low/high drink price (NEW column; originals untouched)
        low = _num(row.get("low_drink_price"))
        high = _num(row.get("high_drink_price"))
        if low is not None and high is not None:
            avg_cost.append(round((low + high) / 2, 2))
        elif low is not None or high is not None:
            avg_cost.append(low if low is not None else high)
        else:
            avg_cost.append(None)

        vibe_consolidated.append("|".join(consolidate_vibes(row.get("vibe_tags"))))

        flags: list[str] = []
        try:
            resp = places_text_search(query)
        except requests.RequestException as exc:
            # status/network only in message — no secrets
            print(f"  [{row['bar_id']:>26}] request failed after retries: {exc}")
            review_count.append(None)
            google_rating.append(None)
            place_id.append(None)
            matched_name.append(None)
            google_address.append(None)
            match_distance_m.append(None)
            match_flags.append("request_failed")
            time.sleep(POLITE_DELAY_S)
            continue

        if resp.status_code != 200:
            snippet = resp.text[:200].replace("\n", " ")
            print(f"  [{row['bar_id']:>26}] HTTP {resp.status_code}: {snippet}")
            review_count.append(None)
            google_rating.append(None)
            place_id.append(None)
            matched_name.append(None)
            google_address.append(None)
            match_distance_m.append(None)
            match_flags.append(f"http_{resp.status_code}")
            time.sleep(POLITE_DELAY_S)
            continue

        places = (resp.json() or {}).get("places") or []
        if not places:
            print(f"  [{row['bar_id']:>26}] no match for query")
            review_count.append(None)
            google_rating.append(None)
            place_id.append(None)
            matched_name.append(None)
            google_address.append(None)
            match_distance_m.append(None)
            match_flags.append("no_match")
            time.sleep(POLITE_DELAY_S)
            continue

        # Take the top result but DO NOT blindly trust it — cross-check below.
        p = places[0]
        g_rating = _num(p.get("rating"))
        g_count = p.get("userRatingCount")
        g_id = p.get("id")
        g_name = (p.get("displayName") or {}).get("text")
        g_addr = p.get("formattedAddress")
        loc = p.get("location") or {}
        g_lat, g_lng = _num(loc.get("latitude")), _num(loc.get("longitude"))

        # Distance cross-check against CSV lat/lng.
        dist = None
        if None not in (csv_lat, csv_lng, g_lat, g_lng):
            dist = round(haversine_m(csv_lat, csv_lng, g_lat, g_lng), 1)
            if dist > DISTANCE_FLAG_M:
                flags.append(f"location_mismatch_{dist:.0f}m")

        # Rating divergence cross-check (keep BOTH values, never overwrite CSV rating).
        if g_rating is not None and csv_rating is not None:
            if abs(g_rating - csv_rating) > RATING_FLAG_DELTA:
                flags.append(f"rating_divergence_{abs(g_rating - csv_rating):.1f}")

        review_count.append(int(g_count) if g_count is not None else None)
        google_rating.append(g_rating)
        place_id.append(g_id)
        matched_name.append(g_name)
        google_address.append(g_addr)
        match_distance_m.append(dist)
        match_flags.append("|".join(flags))

        flag_note = f"  FLAGS: {'|'.join(flags)}" if flags else ""
        print(
            f"  [{row['bar_id']:>26}] -> '{g_name}'  "
            f"rating={g_rating} (csv {csv_rating})  reviews={g_count}  "
            f"dist={dist}m{flag_note}"
        )
        time.sleep(POLITE_DELAY_S)

    # ----------------------------------------------------------------------------------
    # Assemble enriched frame (new columns only; originals untouched).
    # ----------------------------------------------------------------------------------
    out = df.copy()
    out["place_id"] = place_id
    out["google_rating"] = google_rating
    out["review_count"] = review_count
    out["avg_cost"] = avg_cost
    out["vibe_consolidated"] = vibe_consolidated
    out["matched_name"] = matched_name
    out["google_address"] = google_address
    out["match_distance_m"] = match_distance_m
    out["match_flags"] = match_flags
    return out


# --------------------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------------------
def main() -> None:
    # --recompute: reuse the already-fetched bars_enriched.csv and only redo the derived
    # columns (untrusted/priors/bayesian/validation). No Google calls, so the reviewed
    # matches (incl. juke_box's) are preserved exactly. Input CSV is never touched.
    recompute = "--recompute" in sys.argv
    if recompute and OUTPUT_CSV.exists():
        out = pd.read_csv(OUTPUT_CSV)
        n = len(out)
        out["match_flags"] = out["match_flags"].fillna("")
        out["vibe_consolidated"] = out["vibe_consolidated"].fillna("")
        print(f"RECOMPUTE mode: loaded {n} bars from {OUTPUT_CSV.name} — no Google calls; "
              f"input {INPUT_CSV.name} untouched.\n")
    else:
        df = pd.read_csv(INPUT_CSV)
        n = len(df)
        print(f"Loaded {n} bars from {INPUT_CSV.name} (input treated as immutable).\n")
        out = fetch_and_assemble(df)

    # ----------------------------------------------------------------------------------
    # Deactivation (ENRICHED output only — raw input is never modified). Normalize
    # is_active to canonical lowercase strings, then flip the DEACTIVATE bars to false.
    # Their rows stay in the file for audit; downstream filters to is_active=true.
    # ----------------------------------------------------------------------------------
    out["is_active"] = out["is_active"].astype(str).str.strip().str.lower()
    out.loc[out["bar_id"].isin(DEACTIVATE), "is_active"] = "false"
    active = out["is_active"] == "true"
    print("Deactivated (is_active=false, kept for audit): "
          + ", ".join(sorted(b for b in DEACTIVATE)) + "\n")

    # ----------------------------------------------------------------------------------
    # Untrusted flag: an ACTIVE bar whose Google match can't be trusted (wrong-venue
    # location mismatch, no match, or request failure) must NOT silently rank. The flag
    # is only meaningful for active bars — an inactive bar is filtered out downstream, so
    # it carries no untrusted flag (e.g. juke_box: now simply inactive, not "untrusted").
    # ----------------------------------------------------------------------------------
    def _bad_match(r) -> bool:
        f = str(r["match_flags"])
        if "location_mismatch" in f or "no_match" in f or "request_failed" in f or f.startswith("http_"):
            return True
        return _num(r["review_count"]) is None

    out["untrusted"] = out.apply(_bad_match, axis=1) & active

    # ----------------------------------------------------------------------------------
    # Bayesian score:  (v/(v+m))*R + (m/(v+m))*C
    #   v = review_count, R = the bar's (CSV) rating,
    #   C = mean CSV rating, m = MEDIAN review_count.
    # Priors C and m are computed over ACTIVE bars only (is_active=true). Each bar's own
    # score still uses its own v and R; only the priors are restricted to the active set.
    # ----------------------------------------------------------------------------------
    C = float(pd.to_numeric(out.loc[active, "rating"], errors="coerce").mean())
    active_counts = pd.to_numeric(out.loc[active, "review_count"], errors="coerce").dropna()
    m = float(active_counts.median()) if not active_counts.empty else 0.0

    def bayes(r):
        v = _num(r["review_count"])
        R = _num(r["rating"])
        if v is None or R is None or (v + m) == 0:
            return None
        return round((v / (v + m)) * R + (m / (v + m)) * C, 4)

    out["bayesian_score"] = out.apply(bayes, axis=1)

    # ----------------------------------------------------------------------------------
    # Validation: every bar needs lat/lng, rating, review_count, avg_cost, >=1 vibe.
    # ----------------------------------------------------------------------------------
    def validate(r) -> list[str]:
        problems: list[str] = []
        if _num(r["lat"]) is None or _num(r["lng"]) is None:
            problems.append("missing_latlng")
        if _num(r["rating"]) is None:
            problems.append("missing_rating")
        if _num(r["review_count"]) is None:
            problems.append("missing_review_count")
        if _num(r["avg_cost"]) is None:
            problems.append("missing_avg_cost")
        if not str(r["vibe_consolidated"]).strip():
            problems.append("no_consolidated_vibe")
        return problems

    validations = out.apply(validate, axis=1)
    out["validation_status"] = validations.apply(lambda p: "OK" if not p else "|".join(p))

    # ----------------------------------------------------------------------------------
    # Canonical column order (identical in fetch and recompute modes): original input
    # columns first, then enrichment + derived columns. Then write the NEW file.
    # (Input CSV is never modified.)
    # ----------------------------------------------------------------------------------
    derived_tail = [
        "place_id", "google_rating", "review_count", "avg_cost", "vibe_consolidated",
        "matched_name", "google_address", "match_distance_m", "match_flags",
        "untrusted", "bayesian_score", "validation_status",
    ]
    base_cols = [c for c in out.columns if c not in derived_tail]
    out = out[base_cols + [c for c in derived_tail if c in out.columns]]

    out.to_csv(OUTPUT_CSV, index=False)

    # ----------------------------------------------------------------------------------
    # Report
    # ----------------------------------------------------------------------------------
    matched = out["review_count"].notna().sum()
    flagged_rows = out[out["match_flags"].str.len() > 0]
    failed_validation = out[out["validation_status"] != "OK"]
    failed_active = out[active & (out["validation_status"] != "OK")]

    print("\n" + "=" * 78)
    print("PHASE 1 ENRICHMENT REPORT")
    print("=" * 78)
    print(f"Total bars (kept for audit): {n}")
    print(f"Active bars (is_active=true): {int(active.sum())}")
    print(f"Inactive bars:               {int((~active).sum())}  "
          f"({', '.join(out.loc[~active, 'bar_id'])})")
    print(f"Matched (have review_count): {matched}")
    print(f"Match-flagged bars:          {len(flagged_rows)}")
    print(f"Failed validation (all):     {len(failed_validation)}  "
          f"({', '.join(failed_validation['bar_id']) or 'none'})")
    print(f"Failed validation (active):  {len(failed_active)}  "
          f"({', '.join(failed_active['bar_id']) or 'none'})")
    print(f"Untrusted active bars:       {int(out['untrusted'].sum())}  "
          f"({', '.join(out.loc[out['untrusted'], 'bar_id']) or 'none'})")
    print()
    n_active = int(active.sum())
    print(f"Bayesian priors over ACTIVE bars only ({n_active} bars; is_active=true):")
    print(f"  C (mean rating)         = {C:.4f}   "
          f"(was 4.3259 over 27 active -> moved {C - 4.3259:+.4f})")
    print(f"  m (median review_count) = {m:.1f}   "
          f"(was 458.0 over 27 active -> moved {m - 458.0:+.1f})")
    print("  (C and m are STARTING values for tuning later.)")

    print("\n--- Per-bar: review_count + bayesian_score ---")
    print(f"{'bar_id':<28}{'reviews':>9}{'csv_R':>7}{'g_R':>6}"
          f"{'bayes':>9}  flags")
    print("-" * 78)
    for _, r in out.iterrows():
        rc = r["review_count"]
        rc_s = str(int(rc)) if pd.notna(rc) else "-"
        bs = r["bayesian_score"]
        bs_s = f"{bs:.3f}" if pd.notna(bs) else "-"
        gr = r["google_rating"]
        gr_s = f"{gr:.1f}" if pd.notna(gr) else "-"
        print(f"{r['bar_id']:<28}{rc_s:>9}{r['rating']:>7}{gr_s:>6}"
              f"{bs_s:>9}  {r['match_flags']}")

    if len(flagged_rows):
        print("\n--- Match-flagged bars (possible mismatch / rating divergence) ---")
        for _, r in flagged_rows.iterrows():
            print(f"  {r['bar_id']:<28} {r['match_flags']}  "
                  f"(csv_rating={r['rating']}, google_rating={r['google_rating']}, "
                  f"dist={r['match_distance_m']}m)")

    print("\n--- Validation table ---")
    print(f"{'bar_id':<28}{'lat/lng':>8}{'rating':>8}{'reviews':>9}"
          f"{'avg_cost':>10}{'vibes':>22}  status")
    print("-" * 95)
    for _, r in out.iterrows():
        latlng = "ok" if (_num(r["lat"]) is not None and _num(r["lng"]) is not None) else "MISSING"
        rating = "ok" if _num(r["rating"]) is not None else "MISSING"
        reviews = "ok" if _num(r["review_count"]) is not None else "MISSING"
        cost = f"{r['avg_cost']}" if pd.notna(r["avg_cost"]) else "MISSING"
        vibes = r["vibe_consolidated"] if str(r["vibe_consolidated"]).strip() else "MISSING"
        print(f"{r['bar_id']:<28}{latlng:>8}{rating:>8}{reviews:>9}"
              f"{cost:>10}{vibes:>22}  {r['validation_status']}")

    if len(failed_validation):
        print("\n--- Bars FAILING validation ---")
        for _, r in failed_validation.iterrows():
            print(f"  {r['bar_id']:<28} {r['validation_status']}")
    else:
        print("\nAll bars passed validation.")

    # ----------------------------------------------------------------------------------
    # DIAGNOSTIC ONLY (does not change route logic): the ACTIVE bars (what downstream
    # actually uses) ranked by Bayesian score, plus a vibe-coverage check.
    # ----------------------------------------------------------------------------------
    active_out = out[active].sort_values("bayesian_score", ascending=False, na_position="last")

    print("\n" + "=" * 78)
    print(f"DIAGNOSTIC — {len(active_out)} ACTIVE bars ranked by BAYESIAN score (descending)")
    print("=" * 78)
    print(f"{'#':>2}  {'bar_name':<26}{'rating':>6}{'reviews':>9}{'bayes':>9}  vibe_consolidated")
    print("-" * 78)
    for i, (_, r) in enumerate(active_out.iterrows(), 1):
        rc = r["review_count"]
        rc_s = str(int(rc)) if pd.notna(rc) else "-"
        bs = r["bayesian_score"]
        bs_s = f"{bs:.3f}" if pd.notna(bs) else "-"
        print(f"{i:>2}  {str(r['bar_name'])[:26]:<26}{r['rating']:>6}{rc_s:>9}"
              f"{bs_s:>9}  {r['vibe_consolidated']}")

    # Vibe coverage: every consolidated vibe must have >= 4 active bars.
    vibe_counts = {
        v: int(active_out["vibe_consolidated"].apply(
            lambda s: v in str(s).split("|")).sum())
        for v in VIBE_ORDER
    }
    min_required = 4
    ok = all(c >= min_required for c in vibe_counts.values())
    detail = ", ".join(f"{v}={c}" for v, c in vibe_counts.items())
    status = "PASS" if ok else "FAIL"
    print(f"\nVibe coverage (active bars, need >= {min_required} each): {detail}  -> {status}")

    print("\n" + "=" * 78)
    print(f"Wrote enriched data -> {OUTPUT_CSV}")
    print("Input bars_normalized.csv was NOT modified. Nothing pushed to Supabase.")
    print("=" * 78)


if __name__ == "__main__":
    main()
