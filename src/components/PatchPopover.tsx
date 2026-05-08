import { useEffect, useRef, useState } from "react";

export function PatchPopover({ segmentText, onSubmit, onClose }: { segmentText: string; onSubmit: (text: string) => void; onClose: () => void }) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div className="my-3 rounded-2xl border border-blue-200 bg-blue-50 p-3 shadow-sketch">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-blue-800">Patch note for selected sentence</div>
          <div className="mt-1 line-clamp-2 text-xs text-blue-700/80">{segmentText}</div>
        </div>
        <button className="rounded-lg px-2 py-1 text-xs text-blue-700 hover:bg-blue-100" onClick={onClose}>Close</button>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            if (value.trim()) onSubmit(value.trim());
            else onClose();
          }
          if (event.key === "Escape") onClose();
        }}
        placeholder="Example: This sentence should be analysis, not evidence."
        className="min-h-24 w-full resize-y rounded-xl border border-blue-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-blue-300"
      />
      <div className="mt-2 flex items-center justify-between text-xs text-blue-700/70">
        <span>Enter submits and closes. Shift+Enter inserts a new line.</span>
        <button className="btn-primary" onClick={() => value.trim() && onSubmit(value.trim())}>Save Patch</button>
      </div>
    </div>
  );
}
