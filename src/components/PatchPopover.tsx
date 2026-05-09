"use client";

import { useEffect, useRef, useState } from "react";
import type { TextRange } from "@/types/essaycraft";

export function PatchPopover({
  range,
  anchorQuote,
  initialValue = "",
  onSubmit,
  onClose
}: {
  range: TextRange;
  anchorQuote: string;
  initialValue?: string;
  onSubmit: (text: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  function save() {
    if (value.trim()) onSubmit(value.trim());
    else onClose();
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 shadow-sketch">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-amber-950">Patch note</div>
          <div className="mt-1 line-clamp-2 text-xs text-amber-900/80">
            Range {range.start}-{range.end}: {anchorQuote || "current cursor"}
          </div>
        </div>
        <button className="rounded-md px-2 py-1 text-xs text-amber-700 hover:bg-amber-100" onClick={onClose}>
          Esc
        </button>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            save();
            return;
          }
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            save();
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
        }}
        placeholder="Tell EssayCraft what to fix here, e.g. 'This is analysis, not evidence' or 'Find a stronger source.'"
        className="min-h-24 w-full resize-y rounded-lg border border-amber-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-amber-300"
      />
      <div className="mt-2 flex items-center justify-between text-xs text-amber-900/70">
        <span>Enter or Ctrl/Cmd+Enter saves. Shift+Enter inserts a newline.</span>
        <button className="btn-primary" onClick={save}>Save Patch</button>
      </div>
    </div>
  );
}
