import { LABEL_ORDER, LABELS } from "@/lib/labels";
import type { SegmentLabel } from "@/types/essaycraft";

const CHIP_COLORS: Partial<Record<SegmentLabel, string>> = {
  background: "#fde047",
  thesis: "#f9a8d4",
  evidence: "#86efac",
  analysis: "#93c5fd",
  counterargument: "#d8b4fe",
  citation: "#cbd5e1",
  conclusion: "#fdba74",
  issue: "#fca5a5"
};

export function HighlightKey({ activeLabel }: { activeLabel?: SegmentLabel }) {
  return (
    <section data-testid="highlight-key" className="shrink-0 rounded-lg border border-slate-200 bg-[#fffefb]/95 p-1">
      <div className="mb-0.5 text-[10px] font-bold text-slate-800">Highlight Key</div>
      <div className="grid grid-cols-1 gap-px text-[9px] text-slate-700">
        {LABEL_ORDER.filter((label) => label !== "plain").map((label) => (
          <span
            key={label}
            data-testid={`highlight-key-${label}`}
            className={`inline-flex items-center gap-1 rounded-full border bg-white px-1.5 py-0 shadow-sm ${activeLabel === label ? "border-black ring-1 ring-black" : "border-slate-200"}`}
            title={LABELS[label].description}
          >
            <span className="h-2 w-5 rounded-full border border-slate-300" style={{ backgroundColor: CHIP_COLORS[label] }} />
            <span>{LABELS[label].name}</span>
          </span>
        ))}
      </div>
    </section>
  );
}
