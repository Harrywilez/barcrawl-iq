"use client";

/**
 * Interactive crawl builder (Page 1).
 *
 * Holds only UI selection state and turns the choices into a route URL. All
 * canonical values come from lib/constants so the buttons and the URL can never
 * drift. No data fetching here — the bar list is handed in by the server page.
 *
 * Phase 6.2: the buttons now use the shared glossy button system ported from the
 * design HTML (.btn-hero / .btn-pill + ButtonFaces). The selection state, the
 * ?src lock + "Change start" override, the <select>, and the navigation are all
 * unchanged — only the button markup/classes differ.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PREFERENCES, VIBES } from "@/lib/constants";
import type { Preference, Vibe } from "@/lib/types";
import { HeroFace, PillFace } from "./ButtonFaces";

/** Minimal shape the picker needs — slimmed from the full Bar row. */
export interface StartOption {
  bar_id: string;
  bar_name: string;
}

export interface RouteBuilderProps {
  bars: StartOption[];
  /**
   * When set (from ?src=), the start defaults to this bar with a locked look.
   * The user can still override it via the "Change start" affordance — a shared
   * link carries the scanner's src, so a friend at a different bar needs a way out.
   */
  lockedStart: StartOption | null;
}

export default function RouteBuilder({ bars, lockedStart }: RouteBuilderProps) {
  const router = useRouter();

  const [start, setStart] = useState<string>(lockedStart?.bar_id ?? "");
  const [preference, setPreference] = useState<Preference | null>(null);
  const [vibe, setVibe] = useState<Vibe | null>(null);
  // Reveal the picker over a locked (scanned) start when the user isn't there.
  // The locked scanned bar stays the primary state; the picker appears when
  // there's no valid src, or once the user opts to override the scanned bar.
  const [overriding, setOverriding] = useState(false);

  const ready = start !== "" && preference !== null && vibe !== null;

  function seeRoute() {
    if (!ready) return;
    router.push(`/r/${start}/${preference}/${vibe}`);
  }

  // Show the dropdown when there's no valid lock, or once the user overrides it.
  const showPicker = !lockedStart || overriding;

  return (
    <div className="flex flex-col gap-7">
      {/* Step 1 — start bar */}
      <section>
        <div className="glass-panel flex items-center gap-[14px] px-4 py-[15px]">
          <span aria-hidden="true" className="glass-panel__sheen-top" />
          <span aria-hidden="true" className="glass-panel__sheen-bottom" />

          <span className="start-target relative flex h-10 w-10 shrink-0 items-center justify-center">
            <TargetIcon className="h-[18px] w-[18px]" />
          </span>

          <div className="relative min-w-0 flex-1">
            <p className="font-display text-[10px] font-semibold uppercase tracking-[2px] text-[rgba(245,243,237,0.55)]">
              Starting from
            </p>

            {showPicker ? (
              <div className="relative">
                <select
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="-ml-0.5 mt-0.5 w-full appearance-none truncate rounded-md bg-transparent pr-6 text-[17px] font-bold text-cream outline-none"
                >
                  <option value="">Choose a starting bar…</option>
                  {bars.map((b) => (
                    <option key={b.bar_id} value={b.bar_id} className="text-navy">
                      {b.bar_name}
                    </option>
                  ))}
                </select>
                <ChevronIcon className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" />
              </div>
            ) : (
              <p className="mt-0.5 truncate text-[17px] font-bold tracking-[-0.2px] text-[#faf8f2] [text-shadow:0_1px_3px_rgba(8,16,38,0.5)]">
                {lockedStart!.bar_name}
              </p>
            )}
          </div>
        </div>

        {/* "Change start" only matters over a locked scanned start. */}
        {lockedStart && !overriding && (
          <button
            type="button"
            onClick={() => setOverriding(true)}
            className="btn-textlink mt-3 pl-1 text-[12.5px]"
          >
            Not here? <span className="text-brand">Change start</span>
          </button>
        )}
      </section>

      {/* Step 2 — vibe */}
      <section>
        <SectionLabel>Pick your vibe</SectionLabel>
        <div className="flex gap-2">
          {VIBES.map((v) => (
            <button
              key={v.value}
              type="button"
              aria-pressed={vibe === v.value}
              onClick={() => setVibe(v.value)}
              className="btn-pill"
            >
              <PillFace selected={vibe === v.value}>{v.label}</PillFace>
            </button>
          ))}
        </div>
      </section>

      {/* Step 3 — priority */}
      <section>
        <SectionLabel>Pick your priority</SectionLabel>
        <div className="flex gap-2">
          {PREFERENCES.map((p) => (
            <button
              key={p.value}
              type="button"
              aria-pressed={preference === p.value}
              onClick={() => setPreference(p.value)}
              className="btn-pill"
            >
              <PillFace selected={preference === p.value} compact>
                {p.label}
              </PillFace>
            </button>
          ))}
        </div>
      </section>

      <button
        type="button"
        onClick={seeRoute}
        disabled={!ready}
        className="btn-hero mt-1 w-full"
      >
        <HeroFace>
          <span>See My Route</span>
          <span aria-hidden="true">→</span>
        </HeroFace>
      </button>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 pl-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">
      {children}
    </h2>
  );
}

/** Red target/crosshair shown on the glass start badge (matches design/landing). */
function TargetIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 18" fill="none" className={className} aria-hidden="true">
      <circle cx="9" cy="9" r="6.4" stroke="#ef5f54" strokeWidth="1.8" />
      <circle cx="9" cy="9" r="2.3" fill="#ef5f54" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
