import { LABEL_ORDER, LABELS } from "@/lib/labels";

export function HighlightKey() {
  return (
    <footer data-testid="highlight-key" className="shrink-0 overflow-x-auto border-t border-slate-200 bg-[#fffefb]/95 px-4 py-1">
      <div className="flex min-h-7 w-max items-center gap-2 whitespace-nowrap text-[11px] text-slate-600">
        <span className="mr-1 font-semibold text-slate-700">Highlight Key:</span>
        {LABEL_ORDER.filter((label) => label !== "plain").map((label) => (
          <span key={label} className="inline-flex items-center gap-1 border-r border-slate-100 pr-2 last:border-r-0" title={LABELS[label].description}>
            <span className={`h-2 w-6 rounded-sm border border-slate-200 ${LABELS[label].swatch}`} />
            <span>{LABELS[label].name}</span>
          </span>
        ))}
      </div>
    </footer>
  );
}
