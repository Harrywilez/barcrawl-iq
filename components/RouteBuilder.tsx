"use client";

/**
 * Interactive crawl builder (Page 1) — Paper design.
 *
 * Renders the full landing poster (header → start block → divider → vibe →
 * route → CTA + footer) so the design's vertical `space-between` distribution
 * stays exact. Holds only UI selection state and turns the choices into a route
 * URL; all canonical values come from lib/constants so buttons and URL can't
 * drift. The bar list + locked start are handed in by the server page.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PREFERENCES, VIBES } from "@/lib/constants";
import type { Preference, Vibe } from "@/lib/types";
import PoweredBy from "./PoweredBy";

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
  const [overriding, setOverriding] = useState(false);

  const ready = start !== "" && preference !== null && vibe !== null;

  function seeRoute() {
    if (!ready) return;
    router.push(`/r/${start}/${preference}/${vibe}`);
  }

  // Show the dropdown when there's no valid lock, or once the user overrides it.
  const showPicker = !lockedStart || overriding;

  return (
    <>
      {/* Header */}
      <div className="flex flex-col">
        <div className="flex items-center gap-[9px]">
          <div className="h-px flex-1 bg-[rgba(24,48,92,0.3)]" />
          <span className="text-[10px] text-red">★</span>
          <div className="font-mono text-[9px] font-bold uppercase tracking-[2px] text-ink">
            July 4 · Lower East Side
          </div>
          <span className="text-[10px] text-red">★</span>
          <div className="h-px flex-1 bg-[rgba(24,48,92,0.3)]" />
        </div>

        <div className="mt-[26px] text-center font-sans text-[31px] font-extrabold tracking-[-0.5px]">
          BARCRAWL{" "}
          <span className="rounded-[2px] bg-red px-[9px] py-px text-paper">
            IQ
          </span>
        </div>

        <div className="mt-[14px] text-center">
          <div className="font-display text-[33px] font-semibold italic leading-[1.02] text-ink">
            Life, Liberty &amp;
          </div>
          <div className="mt-1 font-display text-[57px] font-extrabold leading-[0.94] text-red">
            Happy Hour
          </div>
        </div>

        <div className="mt-[15px] px-1 text-center font-sans text-[12.5px] font-medium leading-[1.55] text-[rgba(24,48,92,0.64)]">
          However you drink tonight — pick a vibe and a route, and we map the
          night, bar to bar.
        </div>
      </div>

      {/* Start block */}
      <div className="flex flex-col gap-[9px]">
        <div className="paper-card flex items-center gap-[13px] px-[14px] py-3">
          <span className="paper-icon h-9 w-9">
            <TargetIcon className="h-[17px] w-[17px]" />
          </span>
          <div className="min-w-0 flex-1 text-left">
            <div className="font-mono text-[8px] font-bold uppercase tracking-[2px] text-[rgba(24,48,92,0.55)]">
              Starting from
            </div>
            {showPicker ? (
              <div className="relative">
                <select
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="mt-[3px] w-full appearance-none truncate bg-transparent pr-5 font-sans text-[16px] font-bold tracking-[-0.2px] text-ink outline-none"
                >
                  <option value="">Choose a starting bar…</option>
                  {bars.map((b) => (
                    <option key={b.bar_id} value={b.bar_id}>
                      {b.bar_name}
                    </option>
                  ))}
                </select>
                <ChevronIcon className="pointer-events-none absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[rgba(24,48,92,0.5)]" />
              </div>
            ) : (
              <div className="mt-[3px] truncate font-sans text-[16px] font-bold tracking-[-0.2px] text-ink">
                {lockedStart!.bar_name}
              </div>
            )}
          </div>
        </div>

        {lockedStart && !overriding && (
          <button
            type="button"
            onClick={() => setOverriding(true)}
            className="paper-link self-center whitespace-nowrap px-1.5 py-[3px] font-sans text-[12px] font-semibold tracking-[0.1px] text-[rgba(24,48,92,0.62)]"
          >
            Not here? <span className="font-bold text-red">Change start</span>
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="flex items-center justify-center gap-[11px]">
        <div className="h-px w-[34px] bg-[rgba(24,48,92,0.32)]" />
        <span className="text-[13px] leading-none text-red">★</span>
        <div className="h-px w-[34px] bg-[rgba(24,48,92,0.32)]" />
      </div>

      {/* Vibe */}
      <div>
        <div className="mb-[11px] text-center font-sans text-[9.5px] font-bold uppercase tracking-[2px] text-red">
          Pick your vibe
        </div>
        <div className="grid grid-cols-2 gap-[13px]">
          {VIBES.map((v) => {
            const selected = vibe === v.value;
            return (
              <button
                key={v.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setVibe(v.value)}
                className="paper-card px-[15px] py-[14px] text-left"
              >
                {selected && (
                  <>
                    <span aria-hidden="true" className="paper-card-sel" />
                    <span
                      aria-hidden="true"
                      className="absolute right-[11px] top-[9px] text-[11px] leading-none text-red"
                    >
                      ★
                    </span>
                  </>
                )}
                <div className="relative">
                  <div className="font-sans text-[16px] font-bold text-ink">
                    {v.label}
                  </div>
                  <div className="mt-1 font-mono text-[8px] uppercase tracking-[0.5px] text-[rgba(24,48,92,0.55)]">
                    {v.sublabel}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Route label — its own row so space-between centres it between the
          vibe grid above and the route buttons below. */}
      <div className="text-center font-sans text-[9.5px] font-bold uppercase tracking-[2px] text-red">
        Pick your route
      </div>

      {/* Route buttons */}
      <div>
        <div className="flex gap-[9px]">
          {PREFERENCES.map((p) => {
            const selected = preference === p.value;
            return (
              <button
                key={p.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setPreference(p.value)}
                className="paper-card min-w-0 flex-1 px-1 py-[13px] text-center"
              >
                {selected && <span aria-hidden="true" className="paper-card-sel" />}
                <div className="relative">
                  <div className="whitespace-nowrap font-sans text-[12px] font-bold text-ink">
                    {p.label}
                  </div>
                  <div className="mt-[3px] font-mono text-[7px] uppercase tracking-[0.4px] text-[rgba(24,48,92,0.5)]">
                    {p.sublabel}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* CTA + footer */}
      <div>
        <button
          type="button"
          onClick={seeRoute}
          disabled={!ready}
          className="paper-cta px-[18px] py-[17px]"
        >
          <span className="flex items-center justify-center gap-[9px] font-sans text-[15.5px] font-extrabold tracking-[0.3px] text-paper">
            <span className="text-[13px] text-gold">★</span> See My Route
          </span>
        </button>
        <div className="mt-3 text-center font-mono text-[8.5px] font-normal uppercase tracking-[1.4px] text-[rgba(24,48,92,0.5)]">
          Est. 1776 · 250 Years · 21+
        </div>
        <PoweredBy />
      </div>
    </>
  );
}

/** Red target/crosshair shown on the start block icon disc. */
function TargetIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 18" fill="none" className={className} aria-hidden="true">
      <circle cx="9" cy="9" r="6.4" stroke="#c5302f" strokeWidth="1.8" />
      <circle cx="9" cy="9" r="2.3" fill="#c5302f" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
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
