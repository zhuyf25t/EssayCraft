"use client";

import { useState } from "react";
import type { AssistResponse, TextRange } from "@/types/essaycraft";

const ACTIONS = [
  { label: "Rewrite selected passage", requiresSelection: true },
  { label: "Strengthen analysis", requiresSelection: true },
  { label: "Find citation gaps", requiresSelection: false },
  { label: "Explain this highlight", requiresSelection: true },
  { label: "Relabel selected range", requiresSelection: true },
  { label: "Make more academic", requiresSelection: true },
  { label: "Translate selected/current module", requiresSelection: false }
];

export function AssistantPanel({
  selectedText,
  selectedRange,
  loading,
  suggestion,
  onAction,
  onApply,
  onDismiss,
  onRefresh
}: {
  selectedText: string;
  selectedRange: TextRange;
  loading: boolean;
  suggestion?: AssistResponse;
  onAction: (action: string) => void;
  onApply: () => void;
  onDismiss: () => void;
  onRefresh: () => void;
}) {
  const [instruction, setInstruction] = useState("");
  const hasSelection = selectedRange.end > selectedRange.start && selectedText.trim().length > 0;
  const canApply = Boolean(suggestion && ((suggestion.proposedText && suggestion.replaceRange) || suggestion.annotations.length));

  function submitInstruction() {
    const value = instruction.trim();
    if (!value) return;
    onAction(value);
    setInstruction("");
  }

  return (
    <section className="panel">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">AI Assistant</h2>
        {loading ? <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">Working</span> : null}
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">
        <div className="font-semibold">Selected context</div>
        {hasSelection ? (
          <p className="mt-1 line-clamp-3">
            Range {selectedRange.start}-{selectedRange.end}: {selectedText}
          </p>
        ) : (
          <p className="mt-1">No text selected. Ask about the current module or select text for targeted help.</p>
        )}
      </div>

      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2">
        <textarea
          value={instruction}
          onChange={(event) => setInstruction(event.currentTarget.value)}
          placeholder="Ask EssayCraft to revise, explain, or check this module..."
          className="min-h-16 w-full resize-none border-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
        />
        <div className="flex justify-end">
          <button className="btn-primary" onClick={submitInstruction} disabled={loading || !instruction.trim()}>Ask</button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {ACTIONS.map((action) => (
          <button
            key={action.label}
            className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
            onClick={() => onAction(action.label)}
            disabled={loading || (action.requiresSelection && !hasSelection)}
            title={action.requiresSelection && !hasSelection ? "Select text first for this targeted action." : undefined}
          >
            {action.label}
          </button>
        ))}
      </div>

      {suggestion ? (
        <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-950">
          <div className="mb-1 font-semibold">Preview ready</div>
          <p className="text-xs leading-5">{suggestion.reply}</p>
          {suggestion.proposedText ? (
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-white p-2 text-xs text-slate-700">{suggestion.proposedText}</pre>
          ) : null}
          {suggestion.warnings.length ? (
            <ul className="mt-2 space-y-1 text-xs text-amber-800">
              {suggestion.warnings.map((warning, index) => <li key={`${index}-${warning.slice(0, 48)}`}>- {warning}</li>)}
            </ul>
          ) : null}
          <div className="mt-3 flex gap-2">
            {canApply ? (
              <button className="btn-primary" onClick={onApply}>Apply</button>
            ) : null}
            {suggestion.proposedText ? (
              <button className="btn-secondary" onClick={() => void navigator.clipboard?.writeText(suggestion.proposedText ?? "")}>Copy</button>
            ) : null}
            <button className="btn-secondary" onClick={onRefresh} disabled={loading}>Refresh Highlights</button>
            <button className="btn-secondary" onClick={onDismiss}>Dismiss</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
