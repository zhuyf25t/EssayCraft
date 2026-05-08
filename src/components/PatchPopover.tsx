"use client";

import { useEffect, useRef, useState } from "react";
import type { TextRange } from "@/types/essaycraft";

export function PatchPopover({
  range,
  anchorQuote,
  onSubmit,
  onClose
}: {
  range: TextRange;
  anchorQuote: string;
  onSubmit: (text: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  function save() {
    if (value.trim()) onSubmit(value.trim());
    else onClose();
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 shadow-sketch">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-blue-900">Patch note</div>
          <div className="mt-1 line-clamp-2 text-xs text-blue-800/80">
            Range {range.start}-{range.end}: {anchorQuote || "current cursor"}
          </div>
        </div>
        <button className="rounded-md px-2 py-1 text-xs text-blue-700 hover:bg-blue-100" onClick={onClose}>
          Esc
        </button>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            save();
            return;
          }
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            save();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
        }}
        placeholder="Tell the AI what to fix here..."
        className="min-h-24 w-full resize-y rounded-lg border border-blue-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-blue-300"
      />
      <div className="mt-2 flex items-center justify-between text-xs text-blue-800/70">
        <span>Enter or Ctrl/Cmd+Enter saves. Shift+Enter creates a newline.</span>
        <button className="btn-primary" onClick={save}>Save Patch</button>
      </div>
    </div>
  );
}
