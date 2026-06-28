/**
 * Shared data types for the Bar Crawl IQ web app.
 *
 * These mirror the `bars` and `routes` tables in Supabase (loaded in Phase 4).
 * Keep them in sync with the column lists in lib/queries.ts.
 */

/** Canonical preference values — these EXACT strings live in the DB and the URL. */
export type Preference = "shortest_walk" | "highest_quality" | "lowest_cost";

/** Canonical vibe values — these EXACT strings live in the DB and the URL. */
export type Vibe = "party" | "classy" | "dive" | "chill";

/** A single bar (one of the 25 Lower East Side venues). */
export interface Bar {
  bar_id: string;
  bar_name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number;
  review_count: number;
  bayesian_score: number;
  avg_cost: number;
  /** Pipe-joined consolidated vibe tags, e.g. "party|dive". */
  vibe_consolidated: string;
}

/** One walking leg between two consecutive stops on a route. */
export interface Leg {
  from: string;
  to: string;
  distance_m: number;
  duration_s: number;
}

/** A precomputed, ranked 4-bar crawl for a (start, preference, vibe) combo. */
export interface Route {
  id: number;
  start_bar_id: string;
  preference: Preference;
  vibe: Vibe;
  rank: number;
  /** Bar ids in walking order: [start, s1, s2, s3]. */
  stops: string[];
  /** 3 legs: legs[i] is the walk from stops[i] to stops[i + 1]. */
  legs: Leg[];
  total_walk_min: number;
  total_distance_m: number;
  max_leg_s: number;
  selected_avg_bayesian: number;
  selected_avg_cost: number;
  selected_avg_rating: number;
  blended_score: number;
  explanation: string;
}
