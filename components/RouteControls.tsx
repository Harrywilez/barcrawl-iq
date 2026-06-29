/**
 * Below-the-route controls on the result page (Paper design):
 *   - "Show another option (N of M)" cycles the rank via a ?rank= link.
 *   - "Copy link" copies the current URL.
 *   - "← Change my picks" returns to the builder with the start bar preserved.
 *
 * All navigation is plain <Link> so the rank lives in the URL, not client state.
 * Returns a fragment so the actions group spaces the row + link as siblings.
 */
import Link from "next/link";
import CopyLinkButton from "./CopyLinkButton";

export interface RouteControlsProps {
  /** e.g. "Option 2 of 3". */
  optionLabel: string;
  /** Link to the next rank, or null when only one option exists. */
  anotherOptionHref: string | null;
  /** Back to the builder, start bar preserved (e.g. /e/les?src=<start>). */
  changePicksHref: string;
}

export default function RouteControls({
  optionLabel,
  anotherOptionHref,
  changePicksHref,
}: RouteControlsProps) {
  // "Option 2 of 3" -> "2 of 3" for the in-button count.
  const count = optionLabel.replace(/^Option\s+/i, "");

  return (
    <>
      <div className="flex gap-[9px]">
        {anotherOptionHref && (
          <Link
            href={anotherOptionHref}
            className="paper-card paper-press min-w-0 flex-[1.85] px-1.5 py-3 text-center"
          >
            <span className="whitespace-nowrap font-sans text-[12px] font-bold text-ink">
              Show another option{" "}
              <span className="text-[rgba(24,48,92,0.5)]">({count})</span>
            </span>
          </Link>
        )}

        <CopyLinkButton />
      </div>

      <Link
        href={changePicksHref}
        className="paper-link mx-auto mt-px block px-1 py-[5px] text-center font-sans text-[12.5px] font-semibold tracking-[0.1px] text-[rgba(24,48,92,0.6)]"
      >
        <span className="text-red">←</span> Change my picks
      </Link>
    </>
  );
}
