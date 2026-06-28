"use client";

/**
 * Interactive crawl builder (Page 1).
 *
 * Holds only UI selection state and turns the choices into a route URL. All
 * canonical values come from lib/constants so the buttons and the URL can never
 * drift. No data fetching here — the bar list is handed in by the server page.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PREFERENCES,
  VIBES,
} from "@/lib/constants";
import type { Preference, Vibe } from "@/lib/types";

/** Minimal shape the picker needs — slimmed from the full Bar row. */
export interface StartOption {
  bar_id: string;
  bar_name: string;
}

export interface RouteBuilderProps {
  bars: StartOption[];
  /** When set (from ?src=), the start is locked and the dropdown is hidden. */
  lockedStart: StartOption | null;
}

export default function RouteBuilder({ bars, lockedStart }: RouteBuilderProps) {
  const router = useRouter();

  const [start, setStart] = useState<string>(lockedStart?.bar_id ?? "");
  const [preference, setPreference] = useState<Preference | null>(null);
  const [vibe, setVibe] = useState<Vibe | null>(null);

  const ready = start !== "" && preference !== null && vibe !== null;

  function seeRoute() {
    if (!ready) return;
    router.push(`/r/${start}/${preference}/${vibe}`);
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Step 1 — start bar */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Start
        </h2>
        {lockedStart ? (
          <p className="text-lg">
            Starting from <span className="font-semibold">{lockedStart.bar_name}</span>
          </p>
        ) : (
          <select
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full max-w-sm rounded-md border border-gray-300 p-2"
          >
            <option value="">Choose a starting bar…</option>
            {bars.map((b) => (
              <option key={b.bar_id} value={b.bar_id}>
                {b.bar_name}
              </option>
            ))}
          </select>
        )}
      </section>

      {/* Step 2 — preference */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Priority
        </h2>
        <div className="flex flex-wrap gap-2">
          {PREFERENCES.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPreference(p.value)}
              className={`rounded-md border px-4 py-2 ${
                preference === p.value
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-gray-300 hover:border-gray-400"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      {/* Step 3 — vibe */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Vibe
        </h2>
        <div className="flex flex-wrap gap-2">
          {VIBES.map((v) => (
            <button
              key={v.value}
              type="button"
              onClick={() => setVibe(v.value)}
              className={`rounded-md border px-4 py-2 ${
                vibe === v.value
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-gray-300 hover:border-gray-400"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </section>

      <button
        type="button"
        onClick={seeRoute}
        disabled={!ready}
        className="self-start rounded-md bg-black px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        See my route
      </button>
    </div>
  );
}
