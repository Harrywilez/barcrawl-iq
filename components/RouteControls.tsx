/**
 * Below-the-route controls on the result page (presentational reskin surface):
 *   - "Show another option (N of M)" cycles the rank via a ?rank= link.
 *   - "Copy link" copies the current URL.
 *   - "← Change my picks" returns to the builder with the start bar preserved.
 *
 * All navigation is plain <Link> so the rank lives in the URL, not client state.
 * Hrefs + the option label are computed by the (server) page and passed in.
 * Phase 6.2: secondary glass buttons + text link ported from the design HTML
 * (.btn-secondary / .btn-textlink + ButtonFaces). The "N of M" count still comes
 * straight from the unchanged optionLabel.
 */
import Link from "next/link";
import CopyLinkButton from "./CopyLinkButton";
import { SecondaryFace } from "./ButtonFaces";

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
    <div className="mt-4">
      {/* Design row: wider "show another" (flex 1.85) + "copy link" (flex 1). */}
      <div className="flex gap-2.5">
        {anotherOptionHref && (
          <Link href={anotherOptionHref} className="btn-secondary flex-[1.85]">
            <SecondaryFace>Show another option ({count})</SecondaryFace>
          </Link>
        )}

        <CopyLinkButton />
      </div>

      <div className="mt-4 text-center">
        <Link href={changePicksHref} className="btn-textlink text-[13px]">
          ← Change my picks
        </Link>
      </div>
    </div>
  );
}
