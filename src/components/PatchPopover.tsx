"use client";

import { useEffect, useRef, useState } from "react";
import type { TextRange } from "@/types/essaycraft";

export function PatchPopover({
  range,
  anchorQuote,
  text,
  initialValue = "",
  onSubmit,
  onClose
}: {
  range: TextRange;
  anchorQuote: string;
  text: string;
  initialValue?: string;
  onSubmit: (text: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const ref = useRef<HTMLTextAreaElement>(null);
  const top = estimateAnchorTop(text, range.start);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  function save() {
    if (value.trim()) onSubmit(value.trim());
    else onClose();
  }

  return (
    <div
      data-testid="inline-patch-editor"
      className="absolute left-6 z-30 w-[min(24rem,calc(100%-3rem))] rounded-xl border border-amber-300 bg-amber-50/95 p-2 shadow-sketch"
      style={{ top }}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="min-w-0 text-xs font-semibold text-amber-950">
          📝 Note for EssayCraft
          <span className="ml-2 font-normal text-amber-800/75">{compactAnchor(anchorQuote) || `cursor ${range.start}`}</span>
        </div>
        <button className="rounded-md px-1.5 py-0.5 text-[11px] text-amber-700 hover:bg-amber-100" onClick={onClose}>
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
        className="min-h-12 w-full resize-none rounded-lg border border-amber-200 bg-white p-2 text-sm outline-none focus:ring-2 focus:ring-amber-300"
      />
      <div className="mt-1 flex items-center justify-between text-[11px] text-amber-900/70">
        <span>Enter saves. Shift+Enter adds a line.</span>
        <button className="btn-primary px-2 py-1 text-xs" onClick={save}>Save</button>
      </div>
    </div>
  );
}

function estimateAnchorTop(text: string, start: number) {
  const before = text.slice(0, Math.max(0, start));
  const hardLines = before.split("\n");
  const softLines = hardLines.reduce((total, line) => total + Math.max(1, Math.ceil(line.length / 76)), 0);
  return `${Math.min(420, 18 + softLines * 34)}px`;
}

function compactAnchor(value: string) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.length > 42 ? `${cleaned.slice(0, 39)}...` : cleaned;
}
