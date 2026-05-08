import { LABEL_ORDER, LABELS } from "@/lib/labels";

export function HighlightKey() {
  return (
    <footer className="sticky bottom-0 z-20 border-t border-slate-200 bg-[#fffefb]/95 px-4 py-2 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
        <span className="mr-1 font-semibold">Highlight Key:</span>
        {LABEL_ORDER.map((label) => (
          <span key={label} className="inline-flex items-center gap-1 border-r border-slate-200 pr-2" title={LABELS[label].description}>
            <span className={`h-2.5 w-7 rounded-sm ${LABELS[label].swatch}`} />
            <span>{LABELS[label].name}</span>
          </span>
        ))}
      </div>
    </footer>
  );
}
