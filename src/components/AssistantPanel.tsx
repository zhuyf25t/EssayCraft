"use client";

import { useEffect, useRef, useState } from "react";
import type { Annotation, AssistantMessage, AssistResponse, SegmentLabel, TextRange } from "@/types/essaycraft";
import { LABELS, LABEL_ORDER } from "@/lib/labels";

const SELECTION_ACTIONS = ["Rewrite", "Make more academic", "Strengthen analysis", "Translate selected text"] as const;

export function AssistantPanel({
  modeRequest,
  chatMessages,
  selectedText,
  selectedRange,
  activeSentenceText,
  activeSentenceRange,
  activeAnnotation,
  activePatchCount,
  loading,
  suggestion,
  onChat,
  onSelectionAction,
  onInspectAction,
  onApply,
  onDismiss,
  onAddPatchForRange,
  onSaveSuggestionAsPatch,
  onRelabel
}: {
  modeRequest?: { mode: "chat" | "selection" | "inspect"; id: number };
  chatMessages: AssistantMessage[];
  selectedText: string;
  selectedRange: TextRange;
  activeSentenceText: string;
  activeSentenceRange?: TextRange;
  activeAnnotation?: Annotation;
  activePatchCount: number;
  loading: boolean;
  suggestion?: AssistResponse;
  onChat: (message: string) => void;
  onSelectionAction: (action: string) => void;
  onInspectAction: (action: string) => void;
  onApply: () => void;
  onDismiss: () => void;
  onAddPatchForRange: (range: TextRange) => void;
  onSaveSuggestionAsPatch: () => void;
  onRelabel: (label: SegmentLabel) => void;
}) {
  const [mode, setMode] = useState<"chat" | "selection" | "inspect">("chat");
  const [chatInput, setChatInput] = useState("");
  const [editInstruction, setEditInstruction] = useState("");
  const [labelChoice, setLabelChoice] = useState<SegmentLabel>(activeAnnotation?.label ?? "analysis");
  const messageListRef = useRef<HTMLDivElement>(null);
  const modeRequestLockRef = useRef(false);
  const hasSelection = selectedRange.end > selectedRange.start && selectedText.trim().length > 0;
  const hasActiveSentence = Boolean(activeSentenceRange && activeSentenceText.trim());
  const editRange = hasSelection ? selectedRange : activeSentenceRange;
  const editText = hasSelection ? selectedText : activeSentenceText;
  const canEdit = Boolean(editRange && editText.trim());
  const selectionPreview = suggestion?.kind === "edit" ? suggestion : undefined;
  const inspectPreview = suggestion?.kind === "inspect" ? suggestion : undefined;
  const requestedMode = modeRequest?.mode;
  const modeRequestId = modeRequest?.id;

  useEffect(() => {
    if (modeRequestLockRef.current) return;
    if (hasSelection) setMode("selection");
    else if (activeAnnotation) setMode("inspect");
    else if (hasActiveSentence) setMode("selection");
    else setMode("chat");
  }, [activeAnnotation, hasActiveSentence, hasSelection]);

  useEffect(() => {
    if (!requestedMode || !modeRequestId) return;
    modeRequestLockRef.current = true;
    setMode(requestedMode);
    window.setTimeout(() => {
      modeRequestLockRef.current = false;
    }, 250);
  }, [modeRequestId, requestedMode]);

  useEffect(() => {
    if (activeAnnotation) setLabelChoice(activeAnnotation.label);
  }, [activeAnnotation]);

  useEffect(() => {
    const list = messageListRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [chatMessages.length, loading]);

  function submitChat() {
    const value = chatInput.trim();
    if (!value) return;
    onChat(value);
    setChatInput("");
  }

  function submitEditInstruction() {
    const value = editInstruction.trim();
    if (!value || !canEdit) return;
    onSelectionAction(value);
    setEditInstruction("");
  }

  return (
    <section data-testid="assistant-copilot" className="panel flex h-full min-h-0 flex-col overflow-hidden p-0">
      <div className="shrink-0 border-b border-slate-200 p-2">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Essay Copilot</h2>
          {loading ? <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] text-blue-700">Thinking</span> : null}
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 text-xs font-semibold">
          <ModeButton active={mode === "chat"} onClick={() => setMode("chat")}>Chat</ModeButton>
          <ModeButton active={mode === "selection"} onClick={() => setMode("selection")} disabled={!canEdit}>Selection</ModeButton>
          <ModeButton active={mode === "inspect"} onClick={() => setMode("inspect")}>Inspect</ModeButton>
        </div>
      </div>

      {mode === "chat" ? (
        <ChatMode
          messages={chatMessages}
          loading={loading}
          input={chatInput}
          onInput={setChatInput}
          onSubmit={submitChat}
          messageListRef={messageListRef}
        />
      ) : null}

      {mode === "selection" ? (
        <SelectionMode
          hasSelection={hasSelection}
          text={editText}
          range={editRange}
          annotation={activeAnnotation}
          patchCount={activePatchCount}
          loading={loading}
          instruction={editInstruction}
          onInstruction={setEditInstruction}
          onSubmitInstruction={submitEditInstruction}
          onAction={onSelectionAction}
          onAddPatch={() => editRange && onAddPatchForRange(editRange)}
          suggestion={selectionPreview}
          onApply={onApply}
          onDismiss={onDismiss}
          onSaveSuggestionAsPatch={onSaveSuggestionAsPatch}
        />
      ) : null}

      {mode === "inspect" ? (
        <InspectMode
          annotation={activeAnnotation}
          patchCount={activePatchCount}
          loading={loading}
          suggestion={inspectPreview}
          labelChoice={labelChoice}
          onLabelChoice={setLabelChoice}
          onExplain={() => onInspectAction("Explain highlight")}
          onRelabel={() => onRelabel(labelChoice)}
          onAddPatch={() => {
            if (activeAnnotation) onAddPatchForRange({ start: activeAnnotation.start, end: activeAnnotation.end });
            else if (editRange) onAddPatchForRange(editRange);
          }}
          onDismiss={onDismiss}
        />
      ) : null}
    </section>
  );
}

function ModeButton({ active, disabled, onClick, children }: { active: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className={`rounded-md px-2 py-1.5 ${active ? "bg-white text-blue-700 shadow-sm" : "text-slate-600"} disabled:cursor-not-allowed disabled:opacity-40`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function ChatMode({
  messages,
  loading,
  input,
  onInput,
  onSubmit,
  messageListRef
}: {
  messages: AssistantMessage[];
  loading: boolean;
  input: string;
  onInput: (value: string) => void;
  onSubmit: () => void;
  messageListRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div data-testid="assistant-chat-mode" className="flex min-h-0 flex-1 flex-col">
      <div ref={messageListRef} data-testid="assistant-chat-messages" className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">
            Ask about this module&apos;s thesis, structure, evidence, clarity, or next step.
          </div>
        ) : null}
        {messages.map((message) => (
          <article key={message.id} className={`max-w-[92%] rounded-lg px-3 py-2 text-xs leading-5 ${message.role === "user" ? "ml-auto bg-blue-600 text-white" : "mr-auto border border-slate-200 bg-white text-slate-700"}`}>
            <div className="whitespace-pre-wrap">{message.text}</div>
            {message.role === "assistant" && message.providerMode ? (
              <div className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">Provider: {message.providerMode}</div>
            ) : null}
          </article>
        ))}
        {loading ? <div className="mr-auto rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">Writing...</div> : null}
      </div>
      <div data-testid="assistant-chat-composer" className="sticky bottom-0 shrink-0 border-t border-slate-200 bg-white p-2">
        <textarea
          value={input}
          onChange={(event) => onInput(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              onSubmit();
            }
          }}
          placeholder="Ask about this module..."
          className="min-h-16 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
        />
        <div className="mt-2 flex justify-end">
          <button className="btn-primary px-3 py-1.5 text-xs" onClick={onSubmit} disabled={loading || !input.trim()}>Send</button>
        </div>
      </div>
    </div>
  );
}

function SelectionMode({
  hasSelection,
  text,
  range,
  annotation,
  patchCount,
  loading,
  instruction,
  onInstruction,
  onSubmitInstruction,
  onAction,
  onAddPatch,
  suggestion,
  onApply,
  onDismiss,
  onSaveSuggestionAsPatch
}: {
  hasSelection: boolean;
  text: string;
  range?: TextRange;
  annotation?: Annotation;
  patchCount: number;
  loading: boolean;
  instruction: string;
  onInstruction: (value: string) => void;
  onSubmitInstruction: () => void;
  onAction: (action: string) => void;
  onAddPatch: () => void;
  suggestion?: AssistResponse;
  onApply: () => void;
  onDismiss: () => void;
  onSaveSuggestionAsPatch: () => void;
}) {
  return (
    <div data-testid="assistant-selection-mode" className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
      <div data-testid="assistant-edit-context" className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">
        <div className="font-semibold">{hasSelection ? "Selected text" : "Active sentence"}</div>
        {range ? <p className="mt-1 text-blue-700">Range {range.start}-{range.end}</p> : null}
        <p className="mt-1 line-clamp-4">{text || "Click a sentence or select text."}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {annotation ? <span className="rounded-full bg-white px-2 py-0.5 text-blue-700">{LABELS[annotation.label].name}</span> : <span className="rounded-full bg-white px-2 py-0.5 text-slate-500">No label</span>}
          <span className="rounded-full bg-white px-2 py-0.5 text-blue-700">Patches {patchCount}</span>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-2">
        <textarea
          value={instruction}
          onChange={(event) => onInstruction(event.currentTarget.value)}
          placeholder="Tell EssayCraft how to revise this sentence or passage"
          className="min-h-16 w-full resize-none border-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
          disabled={!range}
        />
        <div className="flex justify-end">
          <button className="btn-primary px-3 py-1.5 text-xs" onClick={onSubmitInstruction} disabled={loading || !range || !instruction.trim()}>Preview</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {SELECTION_ACTIONS.map((action) => (
          <button
            key={action}
            className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
            onClick={() => onAction(action)}
            disabled={loading || !range}
          >
            {action}
          </button>
        ))}
        <button className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-left text-xs text-amber-800 disabled:opacity-45" onClick={onAddPatch} disabled={!range}>Save as patch</button>
      </div>

      {suggestion ? (
        <PreviewCard suggestion={suggestion} onApply={onApply} onDismiss={onDismiss} onSaveSuggestionAsPatch={onSaveSuggestionAsPatch} />
      ) : null}
    </div>
  );
}

function PreviewCard({
  suggestion,
  onApply,
  onDismiss,
  onSaveSuggestionAsPatch
}: {
  suggestion: AssistResponse;
  onApply: () => void;
  onDismiss: () => void;
  onSaveSuggestionAsPatch: () => void;
}) {
  if (suggestion.kind !== "edit") return null;
  return (
    <div data-testid="assistant-selection-preview" className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-950">
      <div className="font-semibold">{suggestion.title ?? "Selection preview"}</div>
      {suggestion.originalExcerpt ? (
        <div className="mt-2 rounded-md bg-white/80 p-2 text-xs text-slate-600">
          <div className="font-semibold text-slate-700">Original</div>
          <p className="mt-1 line-clamp-3">{suggestion.originalExcerpt}</p>
        </div>
      ) : null}
      <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded-md bg-white p-2 text-xs text-slate-700">{suggestion.proposedText}</pre>
      {suggestion.explanation ? <p className="mt-2 text-xs leading-5 text-emerald-900">{suggestion.explanation}</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <ProviderBadge response={suggestion} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn-primary px-3 py-1.5 text-xs" onClick={onApply}>Apply to selection</button>
        <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => void navigator.clipboard?.writeText(suggestion.proposedText)}>Copy</button>
        <button className="btn-secondary px-3 py-1.5 text-xs" onClick={onSaveSuggestionAsPatch}>Save as patch</button>
        <button className="btn-secondary px-3 py-1.5 text-xs" onClick={onDismiss}>Dismiss</button>
      </div>
    </div>
  );
}

function InspectMode({
  annotation,
  patchCount,
  loading,
  suggestion,
  labelChoice,
  onLabelChoice,
  onExplain,
  onRelabel,
  onAddPatch,
  onDismiss
}: {
  annotation?: Annotation;
  patchCount: number;
  loading: boolean;
  suggestion?: AssistResponse;
  labelChoice: SegmentLabel;
  onLabelChoice: (label: SegmentLabel) => void;
  onExplain: () => void;
  onRelabel: () => void;
  onAddPatch: () => void;
  onDismiss: () => void;
}) {
  return (
    <div data-testid="assistant-inspect-mode" className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
      <div data-testid="annotation-inspector" className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700">
        <div className="mb-2 font-semibold text-slate-800">Highlight</div>
        {annotation ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`h-3 w-8 rounded-sm border border-slate-200 ${LABELS[annotation.label].swatch}`} />
              <span className="font-semibold">{LABELS[annotation.label].name}</span>
              <span className="text-slate-400">confidence {Math.round((annotation.confidence ?? 0) * 100)}%</span>
              <span className="text-slate-400">provider local/AI</span>
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">patches {patchCount}</span>
            </div>
            <p className="mt-2 rounded-md bg-slate-50 p-2">{annotation.text}</p>
            <p className="mt-2 text-slate-600">{annotation.comment ?? LABELS[annotation.label].description}</p>
          </>
        ) : (
          <p>Click a highlighted sentence first.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button className="btn-secondary px-2 py-1.5 text-xs" onClick={onExplain} disabled={loading || !annotation}>Explain highlight</button>
        <button className="btn-secondary px-2 py-1.5 text-xs" onClick={onAddPatch} disabled={!annotation}>Add patch note</button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
        <div className="mb-2 font-semibold text-slate-700">Relabel</div>
        <div className="flex gap-2">
          <select value={labelChoice} onChange={(event) => onLabelChoice(event.target.value as SegmentLabel)} className="input min-w-0 flex-1 py-1.5 text-xs">
            {LABEL_ORDER.map((label) => <option key={label} value={label}>{LABELS[label].name}</option>)}
          </select>
          <button className="btn-secondary px-2 py-1.5 text-xs" onClick={onRelabel} disabled={!annotation}>Apply</button>
        </div>
      </div>

      {suggestion?.kind === "inspect" ? (
        <div data-testid="assistant-inspect-response" className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-950">
          <div className="font-semibold">{suggestion.title ?? "Highlight explanation"}</div>
          <p className="mt-2 leading-5">{suggestion.reply}</p>
          {suggestion.explanation ? <p className="mt-2 text-blue-800">{suggestion.explanation}</p> : null}
          <div className="mt-2 flex items-center justify-between gap-2">
            <ProviderBadge response={suggestion} />
            <button className="btn-secondary px-2 py-1 text-xs" onClick={onDismiss}>Dismiss</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProviderBadge({ response }: { response: AssistResponse }) {
  const warning = response.warnings[0];
  return (
    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-500" title={warning}>
      {response.providerMode ?? "local"}
    </span>
  );
}
