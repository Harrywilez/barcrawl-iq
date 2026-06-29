/**
 * Canonical option lists + friendly labels for the crawl builder.
 *
 * The `value` strings are CANONICAL — they must match the DB columns and the URL
 * segments exactly. The `label` strings are what we show humans; `sublabel` is
 * the small descriptor shown beneath each option in the Paper UI. UI components
 * should iterate these arrays so the picker and the URL never drift apart.
 */
import type { Preference, Vibe } from "./types";

export interface Option<T> {
  value: T;
  label: string;
  /** Small secondary descriptor under the label (Paper design). */
  sublabel: string;
}

/** Order here is the order the buttons render in (Page 1). */
export const PREFERENCES: ReadonlyArray<Option<Preference>> = [
  { value: "lowest_cost", label: "Cheapest", sublabel: "Cheap beer" },
  { value: "highest_quality", label: "Highest Rated", sublabel: "Top cocktails" },
  { value: "shortest_walk", label: "Shortest Walk", sublabel: "Less stumbling" },
];

export const VIBES: ReadonlyArray<Option<Vibe>> = [
  { value: "party", label: "Party", sublabel: "Packed & loud" },
  { value: "classy", label: "Cocktail", sublabel: "Craft & quiet" },
  { value: "dive", label: "Dive", sublabel: "Cheap & gritty" },
  { value: "chill", label: "Chill", sublabel: "Low & slow" },
];

const PREFERENCE_VALUES = new Set(PREFERENCES.map((p) => p.value));
const VIBE_VALUES = new Set(VIBES.map((v) => v.value));

/** Type guard: is an arbitrary URL segment a valid canonical preference? */
export function isPreference(value: string): value is Preference {
  return PREFERENCE_VALUES.has(value as Preference);
}

/** Type guard: is an arbitrary URL segment a valid canonical vibe? */
export function isVibe(value: string): value is Vibe {
  return VIBE_VALUES.has(value as Vibe);
}

/** Friendly label for a preference (falls back to the raw value). */
export function preferenceLabel(value: Preference): string {
  return PREFERENCES.find((p) => p.value === value)?.label ?? value;
}

/** Friendly label for a vibe (falls back to the raw value). */
export function vibeLabel(value: Vibe): string {
  return VIBES.find((v) => v.value === value)?.label ?? value;
}
