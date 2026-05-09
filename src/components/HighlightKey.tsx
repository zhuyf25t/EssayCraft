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

export function HighlightKey() {
  return (
    <footer data-testid="highlight-key" className="shrink-0 overflow-x-auto border-t border-slate-200 bg-[#fffefb]/95 px-4 py-1.5">
      <div className="flex min-h-7 w-max items-center gap-2 whitespace-nowrap text-[11px] text-slate-700">
        <span className="mr-1 font-semibold text-slate-800">Highlight Key</span>
        {LABEL_ORDER.filter((label) => label !== "plain").map((label) => (
          <span key={label} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 shadow-sm" title={LABELS[label].description}>
            <span className="h-3 w-7 rounded-full border border-slate-300" style={{ backgroundColor: CHIP_COLORS[label] }} />
            <span>{LABELS[label].name}</span>
          </span>
        ))}
      </div>
    </footer>
  );
}
