/**
 * "Powered by Routes IQ™" footer mark — our own brand. Same footer treatment as
 * before; the "IQ" sits in a rounded box like the BARCRAWL IQ wordmark, but in a
 * deep muted green. Shared by the landing + result posters; `className` lets the
 * caller set the top spacing (default matches the landing footer).
 */
export default function PoweredBy({
  className = "mt-[9px]",
}: {
  className?: string;
}) {
  return (
    <div
      className={`${className} flex items-center justify-center gap-[6px]`}
    >
      <span className="font-mono text-[7.5px] font-bold uppercase tracking-[1.5px] text-[rgba(24,48,92,0.42)]">
        Powered by
      </span>
      <span className="font-sans text-[11px] font-extrabold tracking-[-0.2px] text-ink">
        Routes{" "}
        <span className="rounded-[2px] bg-[#2f6b4f] px-[5px] py-px text-paper">
          IQ
        </span>
        <span className="ml-[1px] align-top text-[8px] font-extrabold">™</span>
      </span>
    </div>
  );
}
