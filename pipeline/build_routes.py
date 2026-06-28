"""Phase 3 — precomputed route table (DATA ONLY, no API calls).

Generates ranked, intelligent 4-bar crawl routes for every
``(start_bar x preference x vibe)`` combination, reading every walk time from the
cached pairwise matrix. This script makes ZERO network calls: the walking matrix
is already cached by Phase 2 (``build_walking_matrix.py``). A matrix pair that is
missing is treated as an ERROR to report — never as a trigger to fetch.

Inputs (read-only):
  * pipeline/data/bars_enriched.csv  — use ONLY is_active=true rows.
  * pipeline/cache/walking_matrix.json — matrix[from_id][to_id] = {duration_s, distance_m}.

Output:
  * pipeline/data/routes.json — list of route objects + a top-level meta block.
  * A validation report printed to stdout.

Algorithm (per start B, preference P, vibe V):
  1. candidates = active bars whose vibe_consolidated contains V, excluding B.
     B is a FIXED launch point (stop 1) and need NOT match V; the vibe + preference
     filters apply only to the 3 bars walked TO.
  2. Apply the preference filter to candidates.
  3. Enumerate every distinct 3-subset; for each, find the EXACT min-walk visiting
     order from the fixed start B by trying all 3! permutations (no greedy heuristic).
  4. Soft-penalise long legs: penalty = PENALTY_WEIGHT * sum(max(0, leg_s - LEG_CEILING_S)).
  5. Rank by score ascending, keep top TOP_N distinct stop-sets (deterministic tie-break).
  6. Store whatever exists if fewer than TOP_N; flag any combo with 0 routes.

Run:
    pipeline/.venv/bin/python pipeline/build_routes.py
"""

from __future__ import annotations

import csv
import json
import statistics
from collections import defaultdict
from datetime import datetime, timezone
from itertools import combinations, permutations
from pathlib import Path

# --------------------------------------------------------------------------- #
# TUNABLE CONSTANTS — printed in the report; we tune these later.
# --------------------------------------------------------------------------- #
VIBES = ["party", "classy", "dive", "chill"]
PREFERENCES = ["shortest_walk", "highest_quality", "lowest_cost"]
ROUTE_LEN = 4            # start bar + 3 stops
TOP_N = 3               # keep top 3 routes per (start, pref, vibe)
QUALITY_POOL = 10       # highest_quality keeps top-10 by bayesian_score
COST_POOL = 10          # lowest_cost keeps 10 cheapest by avg_cost
LEG_CEILING_S = 720     # 12 min; legs longer than this get penalised
PENALTY_WEIGHT = 3.0    # how hard to penalise over-ceiling leg time

# Blended-ranking trade-offs (Phase 3 TUNE) — score is worked in MINUTES.
MIN_PER_QUALITY_POINT = 23.0  # 2.3 min of walking per 0.1 Bayesian; quality's walk trade-off
MIN_PER_DOLLAR = 1.5          # 1.5 min of walking per $1; cost's walk trade-off

NUM_STOPS = ROUTE_LEN - 1          # 3 bars walked TO
LEG_CEILING_MIN = LEG_CEILING_S / 60.0  # leg ceiling expressed in minutes

ROOT = Path(__file__).resolve().parent
BARS_CSV = ROOT / "data" / "bars_enriched.csv"
MATRIX_JSON = ROOT / "cache" / "walking_matrix.json"
OUT_JSON = ROOT / "data" / "routes.json"


# --------------------------------------------------------------------------- #
# Loading
# --------------------------------------------------------------------------- #
def _parse_float(val):
    """Return float(val) or None for blank/unparseable cells."""
    if val is None:
        return None
    s = str(val).strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def load_bars():
    """Load active bars into a dict keyed by bar_id."""
    bars = {}
    with BARS_CSV.open(newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            if row["is_active"].strip().lower() != "true":
                continue
            vibes = [v.strip() for v in row["vibe_consolidated"].split("|") if v.strip()]
            bars[row["bar_id"]] = {
                "bar_id": row["bar_id"],
                "bar_name": row["bar_name"],
                "lat": _parse_float(row["lat"]),
                "lng": _parse_float(row["lng"]),
                "rating": _parse_float(row["rating"]),
                "review_count": _parse_float(row["review_count"]),
                "bayesian_score": _parse_float(row["bayesian_score"]),
                "avg_cost": _parse_float(row["avg_cost"]),
                "vibes": vibes,
            }
    return bars


def load_matrix():
    """Load the cached walking matrix (the inner matrix[from][to] mapping)."""
    raw = json.loads(MATRIX_JSON.read_text(encoding="utf-8"))
    matrix = raw["matrix"] if isinstance(raw, dict) and "matrix" in raw else raw
    return matrix, raw.get("meta", {}) if isinstance(raw, dict) else {}


# --------------------------------------------------------------------------- #
# Matrix access — a missing pair is a REPORTED ERROR, never a fetch.
# --------------------------------------------------------------------------- #
class MissingPair(Exception):
    pass


def leg(matrix, frm, to, missing_pairs):
    """Return (duration_s, distance_m) for frm->to, recording any missing pair."""
    cell = matrix.get(frm, {}).get(to)
    if cell is None:
        missing_pairs.add((frm, to))
        raise MissingPair(f"{frm} -> {to}")
    return cell["duration_s"], cell["distance_m"]


# --------------------------------------------------------------------------- #
# Candidate filtering
# --------------------------------------------------------------------------- #
def filter_candidates(start_id, pref, vibe, bars):
    """Active bars matching vibe (excluding start), then narrowed by preference."""
    cands = [
        b for bid, b in bars.items()
        if bid != start_id and vibe in b["vibes"]
    ]
    if pref == "shortest_walk":
        return cands
    if pref == "highest_quality":
        ranked = sorted(
            cands,
            key=lambda b: (-(b["bayesian_score"] or 0.0), b["bar_id"]),
        )
        return ranked[:QUALITY_POOL]
    if pref == "lowest_cost":
        # EXCLUDE bars with missing/null avg_cost — a $0 bar would falsely win.
        priced = [b for b in cands if b["avg_cost"] is not None]
        ranked = sorted(priced, key=lambda b: (b["avg_cost"], b["bar_id"]))
        return ranked[:COST_POOL]
    raise ValueError(f"unknown preference {pref!r}")


# --------------------------------------------------------------------------- #
# Route enumeration + scoring
# --------------------------------------------------------------------------- #
def best_order_for_set(start_id, stop_ids, matrix, missing_pairs):
    """EXACT optimum: try all permutations of the 3-set, keep min total walk.

    Returns (ordered_stop_ids, legs, total_walk_s, total_distance_m) or None if a
    matrix pair is missing for every permutation (recorded in missing_pairs).
    """
    best = None
    for perm in permutations(stop_ids):
        try:
            chain = [start_id, *perm]
            legs = []
            total_s = 0
            total_m = 0
            for frm, to in zip(chain, chain[1:]):
                d_s, d_m = leg(matrix, frm, to, missing_pairs)
                legs.append({"from": frm, "to": to, "duration_s": d_s, "distance_m": d_m})
                total_s += d_s
                total_m += d_m
        except MissingPair:
            continue
        if best is None or total_s < best[2]:
            best = (list(perm), legs, total_s, total_m)
    return best


def penalty_min_for(legs):
    """Soft per-leg penalty (minutes) — keeps long-leg routes rankable but sunk."""
    over = sum(max(0.0, lg["duration_s"] / 60.0 - LEG_CEILING_MIN) for lg in legs)
    return PENALTY_WEIGHT * over


def blended_score(pref, walk_min, penalty_min, q, cost):
    """Preference-aware ranking score in MINUTES (LOWER = better).

    shortest_walk   : walk + penalty
    highest_quality : walk - MIN_PER_QUALITY_POINT * mean_bayesian + penalty
                      (a higher Bayesian buys back walking minutes)
    lowest_cost     : walk + MIN_PER_DOLLAR * mean_cost + penalty
                      (a cheaper crawl costs fewer minutes)
    """
    if pref == "shortest_walk":
        return walk_min + penalty_min
    if pref == "highest_quality":
        return walk_min - MIN_PER_QUALITY_POINT * (q or 0.0) + penalty_min
    if pref == "lowest_cost":
        return walk_min + MIN_PER_DOLLAR * (cost or 0.0) + penalty_min
    raise ValueError(f"unknown preference {pref!r}")


def make_explanation(pref, vibe, start_name, total_walk_min, avg_rating, avg_cost):
    if pref == "shortest_walk":
        return f"The tightest {vibe} crawl from {start_name} — {total_walk_min} min of walking."
    if pref == "highest_quality":
        star = "?" if avg_rating is None else f"{avg_rating:.1f}"
        return f"Top-rated {vibe} spots near {start_name}, kept walkable — picks average {star}★."
    if pref == "lowest_cost":
        dollars = "?" if avg_cost is None else f"{round(avg_cost)}"
        return f"Most wallet-friendly {vibe} crawl from {start_name} — drinks around ${dollars}."
    return ""


def build_route_obj(start_id, pref, vibe, rank, ordered, legs, total_s, total_m, bars):
    """Assemble the stored route object for one ranked route."""
    picks = [bars[bid] for bid in ordered]
    bayes_vals = [p["bayesian_score"] for p in picks if p["bayesian_score"] is not None]
    cost_vals = [p["avg_cost"] for p in picks if p["avg_cost"] is not None]
    rating_vals = [p["rating"] for p in picks if p["rating"] is not None]

    q_raw = statistics.mean(bayes_vals) if bayes_vals else None
    cost_raw = statistics.mean(cost_vals) if cost_vals else None
    sel_bayes = round(q_raw, 4) if q_raw is not None else None
    sel_cost = round(cost_raw, 2) if cost_raw is not None else None
    sel_rating = round(statistics.mean(rating_vals), 2) if rating_vals else None

    walk_min = round(total_s / 60.0, 1)
    penalty_min = penalty_min_for(legs)
    score = blended_score(pref, total_s / 60.0, penalty_min, q_raw, cost_raw)

    return {
        "start_bar_id": start_id,
        "preference": pref,
        "vibe": vibe,
        "rank": rank,
        "stops": [start_id, *ordered],
        "legs": legs,
        "total_walk_s": total_s,
        "total_walk_min": walk_min,
        "total_distance_m": total_m,
        "max_leg_s": max(lg["duration_s"] for lg in legs),
        "penalty_min": round(penalty_min, 3),
        "blended_score": round(score, 3),
        "selected_avg_bayesian": sel_bayes,
        "selected_avg_cost": sel_cost,
        "selected_avg_rating": sel_rating,
        "explanation": make_explanation(
            pref, vibe, bars[start_id]["bar_name"], walk_min, sel_rating, sel_cost
        ),
    }


def routes_for_combo(start_id, pref, vibe, bars, matrix, missing_pairs):
    """Top-TOP_N ranked route objects for one (start, pref, vibe) combo."""
    cands = filter_candidates(start_id, pref, vibe, bars)
    if len(cands) < NUM_STOPS:
        return []

    cand_ids = [b["bar_id"] for b in cands]
    scored = []
    for subset in combinations(cand_ids, NUM_STOPS):
        best = best_order_for_set(start_id, subset, matrix, missing_pairs)
        if best is None:
            continue
        ordered, legs, total_s, total_m = best
        picks = [bars[bid] for bid in ordered]
        bayes_vals = [p["bayesian_score"] for p in picks if p["bayesian_score"] is not None]
        cost_vals = [p["avg_cost"] for p in picks if p["avg_cost"] is not None]
        q = statistics.mean(bayes_vals) if bayes_vals else 0.0
        cost = statistics.mean(cost_vals) if cost_vals else None
        walk_min = total_s / 60.0
        penalty_min = penalty_min_for(legs)
        score = blended_score(pref, walk_min, penalty_min, q, cost)
        # Deterministic sort key: blended score, walk, bayes desc, then bar_ids.
        scored.append(
            (
                (score, walk_min, -q, tuple(sorted(subset))),
                ordered,
                legs,
                total_s,
                total_m,
            )
        )

    scored.sort(key=lambda x: x[0])
    out = []
    for rank, (_key, ordered, legs, total_s, total_m) in enumerate(scored[:TOP_N], start=1):
        out.append(
            build_route_obj(start_id, pref, vibe, rank, ordered, legs, total_s, total_m, bars)
        )
    return out


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #
def main():
    bars = load_bars()
    matrix, matrix_meta = load_matrix()
    missing_pairs = set()

    bar_ids = sorted(bars.keys())  # deterministic start ordering
    all_routes = []
    holes = []          # (start, pref, vibe) with 0 routes
    short_combos = []   # (start, pref, vibe, n) with 0 < n < TOP_N

    for start_id in bar_ids:
        for pref in PREFERENCES:
            for vibe in VIBES:
                rs = routes_for_combo(start_id, pref, vibe, bars, matrix, missing_pairs)
                all_routes.extend(rs)
                if len(rs) == 0:
                    holes.append((start_id, pref, vibe))
                elif len(rs) < TOP_N:
                    short_combos.append((start_id, pref, vibe, len(rs)))

    generated_at = datetime.now(timezone.utc).isoformat()
    theoretical_max = len(bar_ids) * len(PREFERENCES) * len(VIBES) * TOP_N

    meta = {
        "generated_at": generated_at,
        "bar_count": len(bar_ids),
        "total_routes": len(all_routes),
        "theoretical_max_routes": theoretical_max,
        "matrix_generated_at": matrix_meta.get("generated_at"),
        "constants": {
            "VIBES": VIBES,
            "PREFERENCES": PREFERENCES,
            "ROUTE_LEN": ROUTE_LEN,
            "TOP_N": TOP_N,
            "QUALITY_POOL": QUALITY_POOL,
            "COST_POOL": COST_POOL,
            "LEG_CEILING_S": LEG_CEILING_S,
            "LEG_CEILING_MIN": LEG_CEILING_MIN,
            "PENALTY_WEIGHT": PENALTY_WEIGHT,
            "MIN_PER_QUALITY_POINT": MIN_PER_QUALITY_POINT,
            "MIN_PER_DOLLAR": MIN_PER_DOLLAR,
        },
    }

    OUT_JSON.write_text(
        json.dumps({"meta": meta, "routes": all_routes}, indent=2), encoding="utf-8"
    )

    _report(bars, matrix, all_routes, holes, short_combos, missing_pairs, meta)


# --------------------------------------------------------------------------- #
# Reporting
# --------------------------------------------------------------------------- #
def _fmt_route(r, bars):
    names = " -> ".join(bars[b]["bar_name"] for b in r["stops"])
    legs_s = ", ".join(str(lg["duration_s"]) for lg in r["legs"])
    line = (
        f"    #{r['rank']}  walk={r['total_walk_min']}min "
        f"({r['total_walk_s']}s, legs[{legs_s}]s)  max_leg={r['max_leg_s']}s  "
        f"penalty_min={r['penalty_min']}  blended_score={r['blended_score']}\n"
        f"        stops: {names}\n"
        f"        sel_bayes={r['selected_avg_bayesian']}  "
        f"sel_rating={r['selected_avg_rating']}  sel_cost={r['selected_avg_cost']}\n"
        f"        \"{r['explanation']}\""
    )
    return line


def _most_central(bars, matrix):
    """Bar with the smallest total walk time to all others (for the sample pick)."""
    best_id, best_sum = None, None
    ids = list(bars)
    for frm in ids:
        tot = sum(matrix[frm][to]["duration_s"] for to in ids if to != frm)
        if best_sum is None or tot < best_sum:
            best_id, best_sum = frm, tot
    return best_id


def _report(bars, matrix, routes, holes, short_combos, missing_pairs, meta):
    line = "=" * 78
    print(line)
    print("PHASE 3 — ROUTE OPTIMIZATION ENGINE — REPORT")
    print(line)

    print("\nTUNABLE CONSTANTS")
    for k, v in meta["constants"].items():
        print(f"  {k:16} = {v}")

    print(f"\nGenerated at      : {meta['generated_at']}")
    print(f"Matrix generated  : {meta['matrix_generated_at']}")
    print(f"Active bars       : {meta['bar_count']}")

    # ---- Coverage ----
    print(f"\n{line}\nCOVERAGE\n{line}")
    tmax = meta["theoretical_max_routes"]
    total = meta["total_routes"]
    print(f"  Total routes generated : {total} / {tmax} theoretical max "
          f"(25 x {len(PREFERENCES)} x {len(VIBES)} x {TOP_N})")
    n_combos = meta["bar_count"] * len(PREFERENCES) * len(VIBES)
    print(f"  (start,pref,vibe) combos: {n_combos}  ->  "
          f"{n_combos - len(holes)} produced routes, {len(holes)} holes")

    if holes:
        print(f"\n  !! {len(holes)} HOLE(S) — combos with 0 routes:")
        for s, p, v in holes:
            print(f"     - {s} / {p} / {v}")
    else:
        print("\n  No holes: every (start,pref,vibe) produced >=1 route.")

    if short_combos:
        print(f"\n  {len(short_combos)} combo(s) with <{TOP_N} routes (stored what exists):")
        for s, p, v, n in short_combos:
            print(f"     - {s} / {p} / {v}: {n} route(s)")
    else:
        print(f"  Every producing combo reached the full {TOP_N} routes.")

    # ---- Matrix integrity ----
    print(f"\n{line}\nMATRIX INTEGRITY\n{line}")
    if missing_pairs:
        print(f"  !! {len(missing_pairs)} MISSING MATRIX PAIR(S) encountered "
              f"(reported, NOT fetched):")
        for frm, to in sorted(missing_pairs):
            print(f"     - {frm} -> {to}")
    else:
        print("  OK — no route referenced a missing matrix pair.")

    # ---- Distribution ----
    print(f"\n{line}\nWALK-TIME DISTRIBUTION (all routes)\n{line}")
    walks = sorted(r["total_walk_min"] for r in routes)
    if walks:
        print(f"  min / median / max total_walk_min : "
              f"{walks[0]} / {statistics.median(walks)} / {walks[-1]}")
    penalised = [r for r in routes if r["penalty_min"] > 0]
    max_pen = max((r["penalty_min"] for r in routes), default=0)
    print(f"  routes carrying a penalty (a leg > {LEG_CEILING_MIN:g} min) : "
          f"{len(penalised)} / {len(routes)}")
    print(f"  max penalty applied (minutes)            : {round(max_pen, 2)}")

    def _mean_field(pref, field):
        vals = [r[field] for r in routes if r["preference"] == pref and r[field] is not None]
        return statistics.mean(vals) if vals else float("nan")

    # ---- PROOF 1: differentiation table (rank-1 picked-set per start,vibe) ----
    print(f"\n{line}\nPROOF 1 — PREFERENCE DIFFERENTIATION (rank-1 picked-set per start,vibe)\n{line}")
    cell = defaultdict(dict)
    for r in routes:
        if r["rank"] != 1:
            continue
        cell[(r["start_bar_id"], r["vibe"])][r["preference"]] = frozenset(r["stops"][1:])
    n = hq_sw = lc_sw = all3 = 0
    for prefs in cell.values():
        n += 1
        sw = prefs.get("shortest_walk")
        hq = prefs.get("highest_quality")
        lc = prefs.get("lowest_cost")
        if hq == sw:
            hq_sw += 1
        if lc == sw:
            lc_sw += 1
        if sw == hq == lc:
            all3 += 1
    print(f"  (start,vibe) cells: {n}")
    print(f"  highest_quality rank1 == shortest_walk rank1 : {hq_sw:>3} / {n}   (was 82/100)")
    print(f"  lowest_cost     rank1 == shortest_walk rank1 : {lc_sw:>3} / {n}   (was 70/100)")
    print(f"  all three identical                          : {all3:>3} / {n}   (was 66/100)")

    # ---- PROOF 2: median walk by preference (quality/cost should now pay walk) ----
    print(f"\n{line}\nPROOF 2 — MEDIAN total_walk_min BY PREFERENCE\n{line}")
    print(f"  (highest_quality / lowest_cost should exceed shortest_walk — buying quality/cost)")
    for pref in PREFERENCES:
        w = sorted(r["total_walk_min"] for r in routes if r["preference"] == pref)
        print(f"  {pref:16} median = {statistics.median(w):4.1f} min   "
              f"(min {w[0]} / max {w[-1]})")

    # ---- PROOF 3: does highest_quality pick higher-rated bars? ----
    print(f"\n{line}\nPROOF 3 — MEAN selected_avg_bayesian (highest_quality vs shortest_walk)\n{line}")
    sw_q = _mean_field("shortest_walk", "selected_avg_bayesian")
    hq_q = _mean_field("highest_quality", "selected_avg_bayesian")
    print(f"  shortest_walk   mean selected_avg_bayesian : {sw_q:.4f}")
    print(f"  highest_quality mean selected_avg_bayesian : {hq_q:.4f}   (+{hq_q - sw_q:.4f})")

    # ---- FLAG: highest_quality routes now walking > ~15 min ----
    long_hq = sorted(
        (r for r in routes
         if r["preference"] == "highest_quality" and r["total_walk_min"] > 15.0),
        key=lambda r: -r["total_walk_min"],
    )
    print(f"\n{line}\nFLAG — highest_quality routes with total walk > 15 min\n{line}")
    n_hq = sum(1 for r in routes if r["preference"] == "highest_quality")
    print(f"  {len(long_hq)} / {n_hq} highest_quality routes exceed 15 min "
          f"(MIN_PER_QUALITY_POINT = {MIN_PER_QUALITY_POINT})")
    for r in long_hq:
        names = " -> ".join(bars[b]["bar_name"] for b in r["stops"])
        print(f"     {r['total_walk_min']:>4} min  rank{r['rank']}  "
              f"sel_bayes={r['selected_avg_bayesian']}  {r['start_bar_id']}/{r['vibe']}: {names}")

    # ---- PROOF 4: does lowest_cost pick cheaper bars? ----
    print(f"\n{line}\nPROOF 4 — MEAN selected_avg_cost (lowest_cost vs shortest_walk)\n{line}")
    sw_c = _mean_field("shortest_walk", "selected_avg_cost")
    lc_c = _mean_field("lowest_cost", "selected_avg_cost")
    print(f"  shortest_walk mean selected_avg_cost : ${sw_c:.2f}")
    print(f"  lowest_cost   mean selected_avg_cost : ${lc_c:.2f}   (-${sw_c - lc_c:.2f})")

    # ---- SAMPLES: rank-1 across all 3 preferences ----
    def _print_rank1(start_id, vibe):
        for pref in PREFERENCES:
            rs = [r for r in routes if r["start_bar_id"] == start_id
                  and r["preference"] == pref and r["vibe"] == vibe and r["rank"] == 1]
            print(f"  [{pref} / {vibe}]")
            print(_fmt_route(rs[0], bars) if rs else "    (none)")
            print()

    central = _most_central(bars, matrix)
    print(f"\n{line}\nSAMPLE (a) — central start, rank-1 across all preferences\n{line}")
    print(f"  Start: {bars[central]['bar_name']} ({central})  |  vibe = party")
    print(f"  (most central bar = smallest total walk time to all others)\n")
    _print_rank1(central, "party")

    print(f"\n{line}\nSAMPLE (b) — 169 Bar (southern outlier), rank-1 across all preferences\n{line}")
    print(f"  Start: {bars['169_bar']['bar_name']} (169_bar)  |  vibe = party\n")
    _print_rank1("169_bar", "party")

    print(f"\n{line}")
    print(f"WROTE {OUT_JSON.relative_to(ROOT.parent)}  ({total} routes)")
    print("Nothing pushed, nothing committed.")
    print(line)


if __name__ == "__main__":
    main()
