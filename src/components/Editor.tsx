import type { Segment } from "@/types/essaycraft";
import { LABELS } from "@/lib/labels";

export function Editor({
  segments,
  selectedSegmentId,
  onSelect,
  onUpdateText,
  onOpenPatch
}: {
  segments: Segment[];
  selectedSegmentId?: string;
  onSelect: (id: string) => void;
  onUpdateText: (id: string, text: string) => void;
  onOpenPatch: (id: string) => void;
}) {
  if (segments.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
        This module is empty. Use Generate Next from the previous module, or type after creating a sentence in a future version.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 text-[17px] leading-9 shadow-sm">
      {segments.map((segment, index) => {
        const active = segment.id === selectedSegmentId;
        return (
          <span key={segment.id} className="inline">
            <span
              role="textbox"
              tabIndex={0}
              contentEditable
              suppressContentEditableWarning
              title={`${LABELS[segment.label].name}: ${segment.aiComment ?? LABELS[segment.label].description}`}
              onFocus={() => onSelect(segment.id)}
              onClick={() => onSelect(segment.id)}
              onInput={(event) => onUpdateText(segment.id, event.currentTarget.textContent ?? "")}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onSelect(segment.id);
                  onOpenPatch(segment.id);
                }
              }}
              className={`${LABELS[segment.label].className} rounded-md px-1.5 py-0.5 outline-none transition ${
                active ? "ring-2 ring-blue-500 ring-offset-2" : "hover:ring-1 hover:ring-slate-300"
              }`}
            >
              {segment.text}
            </span>
            {index < segments.length - 1 ? " " : null}
          </span>
        );
      })}
    </div>
  );
}
