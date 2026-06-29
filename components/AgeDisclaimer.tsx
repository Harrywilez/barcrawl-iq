/**
 * Result-page footer (Paper design): the 21+ responsibility line + the
 * "Powered by Routes IQ" mark, grouped so the two sit close together (and so the
 * group reads as one footer block in the actions column).
 */
import PoweredBy from "./PoweredBy";

export default function AgeDisclaimer() {
  return (
    <div className="mt-1">
      <div className="text-center font-mono text-[8.5px] font-normal uppercase tracking-[1.4px] text-[rgba(24,48,92,0.5)]">
        21+ · Please Drink Responsibly
      </div>
      <PoweredBy className="mt-[5px]" />
    </div>
  );
}
