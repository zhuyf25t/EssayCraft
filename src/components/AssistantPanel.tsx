"use client";

import type { AssistResponse, TextRange } from "@/types/essaycraft";

const ACTIONS = [
  "Explain this highlight",
  "Relabel selected range",
  "Rewrite selected passage",
  "Make more academic",
  "Strengthen analysis",
  "Find citation gaps",
  "Translate selected/current module"
];

export function AssistantPanel({
  selectedText,
  selectedRange,
  loading,
  suggestion,
  onAction,
  onApply,
  onDismiss,
  onTranslate
}: {
  selectedText: string;
  selectedRange: TextRange;
  loading: boolean;
  suggestion?: AssistResponse;
  onAction: (action: string) => void;
  onApply: () => void;
  onDismiss: () => void;
  onTranslate: () => void;
}) {
  return (
    <section className="panel">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">AI Assistant</h2>
        {loading ? <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">Working</span> : null}
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">
        <div className="font-semibold">Selected context</div>
        <p className="mt-1 line-clamp-3">{selectedText || `Cursor at ${selectedRange.start}. Select text for a targeted suggestion.`}</p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {ACTIONS.map((action) => (
          <button
            key={action}
            className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
            onClick={() => (action.startsWith("Translate") ? onTranslate() : onAction(action))}
            disabled={loading}
          >
            {action}
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
              {suggestion.warnings.map((warning) => <li key={warning}>- {warning}</li>)}
            </ul>
          ) : null}
          <div className="mt-3 flex gap-2">
            {suggestion.proposedText || suggestion.annotations.length ? (
              <button className="btn-primary" onClick={onApply}>Apply</button>
            ) : null}
            <button className="btn-secondary" onClick={onDismiss}>Dismiss</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
