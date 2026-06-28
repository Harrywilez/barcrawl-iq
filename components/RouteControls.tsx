/**
 * Below-the-route controls on the result page (presentational reskin surface):
 *   - "← Change my picks" returns to the builder with the start bar preserved.
 *   - "Show another option" cycles the rank via a ?rank= link (shareable URL).
 *   - "Copy link" copies the current URL.
 *
 * All navigation is plain <Link> so the rank lives in the URL, not client state.
 * Hrefs + the option label are computed by the (server) page and passed in.
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
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-gray-200 pt-4 text-sm">
      <Link href={changePicksHref} className="text-blue-600 underline">
        ← Change my picks
      </Link>

      <span className="text-gray-500">{optionLabel}</span>

      {anotherOptionHref && (
        <Link
          href={anotherOptionHref}
          className="rounded-md border border-gray-300 px-3 py-1.5 hover:border-gray-400"
        >
          Show another option
        </Link>
      )}

      <CopyLinkButton />
    </div>
  );
}
