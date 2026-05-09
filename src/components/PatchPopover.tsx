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
    <div data-testid="inline-patch-editor" className="absolute left-4 top-4 z-30 w-[min(25rem,calc(100%-2rem))] rounded-xl border border-amber-300 bg-amber-50 p-3 shadow-sketch">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-amber-950">Inline note</div>
          <div className="mt-1 line-clamp-2 text-xs text-amber-900/80">
            {anchorQuote || `Cursor ${range.start}`}
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
        placeholder="Add a note for EssayCraft"
        className="min-h-20 w-full resize-y rounded-lg border border-amber-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-amber-300"
      />
      <div className="mt-2 flex items-center justify-between text-xs text-amber-900/70">
        <span>Enter or Ctrl/Cmd+Enter saves. Shift+Enter inserts a newline.</span>
        <button className="btn-primary" onClick={save}>Save note</button>
      </div>
    </div>
  );
}
