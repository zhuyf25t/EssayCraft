"use client";

import { useEffect, useState } from "react";
import type { Annotation, AssistResponse, SegmentLabel, TextRange } from "@/types/essaycraft";
import { LABELS, LABEL_ORDER } from "@/lib/labels";

const EDIT_ACTIONS = [
  "Rewrite",
  "Make more academic",
  "Strengthen analysis",
  "Translate selected text",
  "Explain highlight"
] as const;

export function AssistantPanel({
  selectedText,
  selectedRange,
  activeSentenceText,
  activeSentenceRange,
  activeAnnotation,
  activePatchCount,
  loading,
  suggestion,
  onAction,
  onApply,
  onDismiss,
  onRefresh,
  onAddPatchForRange,
  onSaveSuggestionAsPatch,
  onRelabel
}: {
  selectedText: string;
  selectedRange: TextRange;
  activeSentenceText: string;
  activeSentenceRange?: TextRange;
  activeAnnotation?: Annotation;
  activePatchCount: number;
  loading: boolean;
  suggestion?: AssistResponse;
  onAction: (action: string) => void;
  onApply: () => void;
  onDismiss: () => void;
  onRefresh: () => void;
  onAddPatchForRange: (range: TextRange) => void;
  onSaveSuggestionAsPatch: () => void;
  onRelabel: (label: SegmentLabel) => void;
}) {
  const [mode, setMode] = useState<"chat" | "edit">("chat");
  const [chatInstruction, setChatInstruction] = useState("");
  const [editInstruction, setEditInstruction] = useState("");
  const [labelChoice, setLabelChoice] = useState<SegmentLabel>(activeAnnotation?.label ?? "analysis");
  const hasSelection = selectedRange.end > selectedRange.start && selectedText.trim().length > 0;
  const hasActiveSentence = Boolean(activeSentenceRange && activeSentenceText.trim());
  const editRange = hasSelection ? selectedRange : activeSentenceRange;
  const editText = hasSelection ? selectedText : activeSentenceText;
  const canEdit = Boolean(editRange && editText.trim());
  const canApply = Boolean(suggestion && ((suggestion.proposedText && suggestion.replaceRange) || suggestion.annotations.length));
  const isTranslationPreview = Boolean(suggestion?.proposedText && /translat/i.test(`${suggestion.reply} ${suggestion.actionType ?? ""}`));
  const applyLabel = suggestion?.proposedText ? (isTranslationPreview ? "Apply to selection" : "Apply replacement") : "Apply labels";

  useEffect(() => {
    if (hasSelection || hasActiveSentence) setMode("edit");
  }, [hasActiveSentence, hasSelection]);

  useEffect(() => {
    if (activeAnnotation) setLabelChoice(activeAnnotation.label);
  }, [activeAnnotation]);

  function submitChat() {
    const value = chatInstruction.trim();
    if (!value) return;
    onAction(value);
    setChatInstruction("");
  }

  function submitEditInstruction() {
    const value = editInstruction.trim();
    if (!value || !canEdit) return;
    onAction(value);
    setEditInstruction("");
  }

  return (
    <section className="panel" data-testid="assistant-copilot">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">Essay Copilot</h2>
        {loading ? <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">Working</span> : null}
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-xs font-semibold">
        <button
          type="button"
          className={`rounded-md px-2 py-1.5 ${mode === "chat" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600"}`}
          onClick={() => setMode("chat")}
        >
          Chat about module
        </button>
        <button
          type="button"
          className={`rounded-md px-2 py-1.5 ${mode === "edit" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600"}`}
          onClick={() => setMode("edit")}
          disabled={!canEdit}
          title={canEdit ? undefined : "Click a sentence or select text to edit with the copilot."}
        >
          Edit selection
        </button>
      </div>

      {mode === "chat" ? (
        <div data-testid="assistant-chat-mode" className="mt-3 space-y-3">
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">
            <div className="font-semibold">Module chat</div>
            <p className="mt-1">Ask about thesis, structure, evidence/source gaps, clarity, tone, or next steps. Chat responses do not edit the document.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-2">
            <textarea
              value={chatInstruction}
              onChange={(event) => setChatInstruction(event.currentTarget.value)}
              placeholder="Ask EssayCraft about this module..."
              className="min-h-20 w-full resize-none border-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
            />
            <div className="flex justify-end">
              <button className="btn-primary" onClick={submitChat} disabled={loading || !chatInstruction.trim()}>Ask</button>
            </div>
          </div>
          <button className="btn-secondary w-full py-1.5 text-left text-xs" onClick={() => onAction("Find citation gaps")} disabled={loading}>Find citation gaps</button>
        </div>
      ) : (
        <div data-testid="assistant-edit-mode" className="mt-3 space-y-3">
          <EditContext
            hasSelection={hasSelection}
            text={editText}
            range={editRange}
            annotation={activeAnnotation}
            patchCount={activePatchCount}
          />

          <div className="rounded-lg border border-slate-200 bg-white p-2">
            <textarea
              value={editInstruction}
              onChange={(event) => setEditInstruction(event.currentTarget.value)}
              placeholder="Tell EssayCraft how to revise this sentence or passage"
              className="min-h-16 w-full resize-none border-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
              disabled={!canEdit}
            />
            <div className="flex justify-end">
              <button className="btn-primary" onClick={submitEditInstruction} disabled={loading || !canEdit || !editInstruction.trim()}>Preview edit</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {EDIT_ACTIONS.map((action) => {
              const needsHighlight = action === "Explain highlight";
              return (
                <button
                  key={action}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
                  onClick={() => onAction(action)}
                  disabled={loading || !canEdit || (needsHighlight && !activeAnnotation)}
                  title={!canEdit ? "Click a sentence or select text first." : needsHighlight && !activeAnnotation ? "Click a highlighted sentence first." : undefined}
                >
                  {action}
                </button>
              );
            })}
            <button
              className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-left text-xs text-amber-800 hover:bg-amber-100 disabled:opacity-45"
              onClick={() => editRange && onAddPatchForRange(editRange)}
              disabled={!editRange}
            >
              Add patch note
            </button>
          </div>

          <AnnotationInspector annotation={activeAnnotation} />

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
            <div className="mb-2 font-semibold text-slate-700">Relabel highlight</div>
            <div className="flex gap-2">
              <select value={labelChoice} onChange={(event) => setLabelChoice(event.target.value as SegmentLabel)} className="input min-w-0 flex-1 py-1.5 text-xs">
                {LABEL_ORDER.map((label) => <option key={label} value={label}>{LABELS[label].name}</option>)}
              </select>
              <button className="btn-secondary px-2 py-1.5 text-xs" onClick={() => onRelabel(labelChoice)} disabled={!editRange}>Apply label</button>
            </div>
            <p className="mt-2 text-slate-500">Relabel updates annotation metadata only. A snapshot is saved first.</p>
          </div>
        </div>
      )}

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
          <div className="mt-3 flex flex-wrap gap-2">
            {canApply ? <button className="btn-primary" onClick={onApply}>{applyLabel}</button> : null}
            {suggestion.proposedText ? <button className="btn-secondary" onClick={() => void navigator.clipboard?.writeText(suggestion.proposedText ?? "")}>Copy</button> : null}
            {suggestion.proposedText || suggestion.reply ? <button className="btn-secondary" onClick={onSaveSuggestionAsPatch} disabled={!canEdit}>Save as patch</button> : null}
            <button className="btn-secondary" onClick={onRefresh} disabled={loading}>Refresh Highlights</button>
            <button className="btn-secondary" onClick={onDismiss}>Dismiss</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function EditContext({
  hasSelection,
  text,
  range,
  annotation,
  patchCount
}: {
  hasSelection: boolean;
  text: string;
  range?: TextRange;
  annotation?: Annotation;
  patchCount: number;
}) {
  return (
    <div data-testid="assistant-edit-context" className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">
      <div className="font-semibold">{hasSelection ? "Selected range" : "Active sentence"}</div>
      {range ? <p className="mt-1 text-blue-700">Range {range.start}-{range.end}</p> : null}
      <p className="mt-1 line-clamp-4">{text || "Click a sentence in the editor, or drag to select a passage."}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {annotation ? <span className="rounded-full bg-white px-2 py-0.5 text-blue-700">Label: {LABELS[annotation.label].name}</span> : <span className="rounded-full bg-white px-2 py-0.5 text-slate-500">No active label</span>}
        <span className="rounded-full bg-white px-2 py-0.5 text-blue-700">Patches: {patchCount}</span>
      </div>
    </div>
  );
}

function AnnotationInspector({ annotation }: { annotation?: Annotation }) {
  return (
    <div data-testid="annotation-inspector" className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700">
      <div className="mb-2 font-semibold text-slate-800">Highlight inspector</div>
      {annotation ? (
        <>
          <div className="flex items-center gap-2">
            <span className={`h-3 w-8 rounded-sm border border-slate-200 ${LABELS[annotation.label].swatch}`} />
            <span className="font-semibold">{LABELS[annotation.label].name}</span>
            <span className="text-slate-400">confidence {Math.round((annotation.confidence ?? 0) * 100)}%</span>
            <span className="text-slate-400">provider local/AI</span>
          </div>
          <p className="mt-2 rounded-md bg-slate-50 p-2">{annotation.text}</p>
          <p className="mt-2 text-slate-600">{annotation.comment ?? LABELS[annotation.label].description}</p>
        </>
      ) : (
        <p>Click a highlighted sentence first, or select text for targeted help.</p>
      )}
    </div>
  );
}
