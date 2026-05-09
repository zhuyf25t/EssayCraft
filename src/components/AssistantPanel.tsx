"use client";

import { useState } from "react";
import type { Annotation, AssistResponse, Patch, TextRange } from "@/types/essaycraft";
import { LABELS } from "@/lib/labels";

const ACTIONS: Array<{ label: string; requiresSelection?: boolean; requiresAnnotation?: boolean }> = [
  { label: "Rewrite selected passage", requiresSelection: true },
  { label: "Make more academic", requiresSelection: true },
  { label: "Strengthen analysis", requiresSelection: true },
  { label: "Translate selected text", requiresSelection: true },
  { label: "Relabel selected range", requiresSelection: true },
  { label: "Explain this highlight", requiresAnnotation: true },
  { label: "Explain current module highlights", requiresSelection: false },
  { label: "Find citation gaps", requiresSelection: false }
];

export function AssistantPanel({
  selectedText,
  selectedRange,
  activeAnnotation,
  activePatch,
  loading,
  suggestion,
  onAction,
  onApply,
  onDismiss,
  onRefresh,
  onAddPatchForRange
}: {
  selectedText: string;
  selectedRange: TextRange;
  activeAnnotation?: Annotation;
  activePatch?: Patch;
  loading: boolean;
  suggestion?: AssistResponse;
  onAction: (action: string) => void;
  onApply: () => void;
  onDismiss: () => void;
  onRefresh: () => void;
  onAddPatchForRange: (range: TextRange) => void;
}) {
  const [instruction, setInstruction] = useState("");
  const hasSelection = selectedRange.end > selectedRange.start && selectedText.trim().length > 0;
  const canApply = Boolean(suggestion && ((suggestion.proposedText && suggestion.replaceRange) || suggestion.annotations.length));
  const isTranslationPreview = Boolean(suggestion?.proposedText && /translat/i.test(`${suggestion.reply} ${suggestion.actionType ?? ""}`));
  const applyLabel = suggestion?.proposedText ? (isTranslationPreview ? "Apply to selection" : "Apply replacement") : "Apply labels";

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
        <div className="font-semibold">Current context</div>
        {hasSelection ? (
          <p className="mt-1 line-clamp-3">
            Selected text, range {selectedRange.start}-{selectedRange.end}: {selectedText}
          </p>
        ) : (
          <p className="mt-1">No text selected. Ask about the current module, or select text for targeted rewrite, relabel, or translation help.</p>
        )}
      </div>

      <AnnotationInspector
        annotation={activeAnnotation}
        patch={activePatch}
        canAddPatch={hasSelection}
        onExplain={() => onAction("Explain this highlight")}
        onRelabel={() => onAction("Relabel selected range")}
        onAddPatch={() => {
          if (activeAnnotation) onAddPatchForRange({ start: activeAnnotation.start, end: activeAnnotation.end });
          else if (hasSelection) onAddPatchForRange(selectedRange);
        }}
      />

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
            disabled={loading || (action.requiresSelection && !hasSelection) || (action.requiresAnnotation && !activeAnnotation)}
            title={
              action.requiresAnnotation && !activeAnnotation
                ? "Click a highlighted sentence or place the cursor inside a highlight first."
                : action.requiresSelection && !hasSelection
                  ? "Select text first for this targeted action."
                  : undefined
            }
          >
            {action.label}
          </button>
        ))}
      </div>

      {suggestion ? (
        <div data-testid="assistant-preview" className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-950">
          <div className="mb-2">
            <div className="font-semibold">{suggestion.title ?? "Preview ready"}</div>
            {suggestion.actionType ? <div className="text-[11px] uppercase tracking-wide text-emerald-700">{suggestion.actionType}</div> : null}
          </div>
          {suggestion.originalExcerpt ? (
            <div className="mb-2 rounded-md bg-white/80 p-2 text-xs text-slate-600">
              <div className="font-semibold text-slate-700">Original excerpt</div>
              <p className="mt-1 line-clamp-3">{suggestion.originalExcerpt}</p>
            </div>
          ) : null}
          <p className="text-xs leading-5">{suggestion.reply}</p>
          {suggestion.proposedText ? (
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-white p-2 text-xs text-slate-700">{suggestion.proposedText}</pre>
          ) : null}
          {suggestion.explanation ? <p className="mt-2 text-xs leading-5 text-emerald-900">{suggestion.explanation}</p> : null}
          {suggestion.warnings.length ? (
            <ul className="mt-2 space-y-1 text-xs text-amber-800">
              {suggestion.warnings.map((warning, index) => <li key={`${index}-${warning.slice(0, 48)}`}>- {warning}</li>)}
            </ul>
          ) : null}
          <div className="mt-3 flex gap-2">
            {canApply ? (
              <button className="btn-primary" onClick={onApply}>{applyLabel}</button>
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

function AnnotationInspector({
  annotation,
  patch,
  canAddPatch,
  onExplain,
  onRelabel,
  onAddPatch
}: {
  annotation?: Annotation;
  patch?: Patch;
  canAddPatch: boolean;
  onExplain: () => void;
  onRelabel: () => void;
  onAddPatch: () => void;
}) {
  return (
    <div data-testid="annotation-inspector" className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700">
      <div className="mb-2 font-semibold text-slate-800">Highlight inspector</div>
      {annotation ? (
        <>
          <div className="flex items-center gap-2">
            <span className={`h-3 w-8 rounded-sm border border-slate-200 ${LABELS[annotation.label].swatch}`} />
            <span className="font-semibold">{LABELS[annotation.label].name}</span>
            <span className="text-slate-400">confidence {Math.round((annotation.confidence ?? 0) * 100)}%</span>
          </div>
          <p className="mt-2 rounded-md bg-slate-50 p-2">{annotation.text}</p>
          <p className="mt-2 text-slate-600">{annotation.comment ?? LABELS[annotation.label].description}</p>
          {patch ? <p className="mt-2 rounded-md bg-amber-50 p-2 text-amber-900">Patch here: {patch.text}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-700" onClick={onExplain}>Explain this highlight</button>
            <button className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-700" onClick={onRelabel}>Relabel</button>
            <button className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800" onClick={onAddPatch}>Add patch note</button>
          </div>
        </>
      ) : (
        <div>
          <p>Click a highlighted sentence first, or select text for targeted help.</p>
          <button className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800 disabled:opacity-50" onClick={onAddPatch} disabled={!canAddPatch}>
            Add patch note
          </button>
        </div>
      )}
    </div>
  );
}
