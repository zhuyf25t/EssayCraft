"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LABELS } from "@/lib/labels";
import type { Annotation, AssistantMessage, AssistResponse, RefreshResponse, TextRange } from "@/types/essaycraft";

type AssistantMode = "chat" | "edit";

type AssistantPanelProps = {
  modeRequest?: { mode: AssistantMode; id: number };
  chatMessages: AssistantMessage[];
  selectedText: string;
  selectedRange: TextRange;
  activeSentenceText: string;
  activeSentenceRange?: TextRange;
  activeAnnotation?: Annotation;
  activePatchCount: number;
  loading: boolean;
  suggestion?: AssistResponse;
  revisionPreview?: RefreshResponse;
  refreshResult?: RefreshResponse;
  onChat: (message: string) => void;
  onSelectionAction: (action: string) => void;
  onInspectAction: (action: string) => void;
  onApply: () => void;
  onDismiss: () => void;
  onAddPatchForRange: (range: TextRange) => void;
  onSaveSuggestionAsPatch: () => void;
  onAcceptRevision: () => void;
  onRejectRevision: () => void;
};

export function AssistantPanel(props: AssistantPanelProps) {
  const hasSelection = props.selectedRange.end > props.selectedRange.start;
  const hasEditContext = hasSelection || Boolean(props.activeSentenceRange) || Boolean(props.activeAnnotation);
  const [mode, setMode] = useState<AssistantMode>(hasEditContext ? "edit" : "chat");
  const lastRequestId = useRef<number | undefined>(undefined);
  const chatHoldUntil = useRef(0);
  const contextSignature = `${props.selectedRange.start}:${props.selectedRange.end}:${props.activeSentenceRange?.start ?? "-"}:${props.activeSentenceRange?.end ?? "-"}:${props.activeAnnotation?.id ?? "-"}`;
  const previousContextSignature = useRef(contextSignature);

  useEffect(() => {
    if (!props.modeRequest || props.modeRequest.id === lastRequestId.current) return;
    const initialRequest = lastRequestId.current === undefined;
    lastRequestId.current = props.modeRequest.id;
    if (!initialRequest && props.modeRequest.mode === "chat") chatHoldUntil.current = Date.now() + 600;
    setMode(props.modeRequest.mode);
  }, [props.modeRequest]);

  useEffect(() => {
    if (contextSignature === previousContextSignature.current) return;
    previousContextSignature.current = contextSignature;
    if (Date.now() < chatHoldUntil.current) return;
    if (hasEditContext) setMode("edit");
  }, [contextSignature, hasEditContext]);

  return (
    <section data-testid="assistant-panel" className="flex h-full min-h-0 flex-col">
      <div className="mb-2 grid shrink-0 grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-xs">
        <button
          type="button"
          className={`rounded-md px-2 py-1.5 font-semibold ${mode === "chat" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:bg-white/70"}`}
          onClick={() => setMode("chat")}
        >
          Chat
        </button>
        <button
          type="button"
          className={`rounded-md px-2 py-1.5 font-semibold ${mode === "edit" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:bg-white/70"}`}
          onClick={() => setMode("edit")}
        >
          Edit
        </button>
      </div>

      {mode === "chat" ? (
        <ChatMode messages={props.chatMessages} loading={props.loading} onChat={props.onChat} />
      ) : (
        <EditMode {...props} hasSelection={hasSelection} />
      )}
    </section>
  );
}

function ChatMode({
  messages,
  loading,
  onChat
}: {
  messages: AssistantMessage[];
  loading: boolean;
  onChat: (message: string) => void;
}) {
  const [value, setValue] = useState("");
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = messagesRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages.length, loading]);

  function submit() {
    const text = value.trim();
    if (!text || loading) return;
    onChat(text);
    setValue("");
  }

  return (
    <div data-testid="assistant-chat-mode" className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mb-2 shrink-0 text-xs font-semibold text-slate-600">Chat about module</div>
      <div
        ref={messagesRef}
        data-testid="assistant-chat-messages"
        className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/70 p-2"
      >
        {messages.length ? messages.map((message) => (
          <article key={message.id} className={`max-w-[92%] rounded-xl px-3 py-2 text-sm ${message.role === "user" ? "ml-auto bg-blue-600 text-white" : "bg-white text-slate-700 shadow-sm"}`}>
            <p className="whitespace-pre-wrap">{message.text}</p>
          </article>
        )) : (
          <div className="rounded-lg bg-white p-3 text-sm text-slate-500">
            Ask about the current module, thesis, structure, evidence, or next step.
          </div>
        )}
        {loading ? <div className="rounded-lg bg-white p-2 text-xs text-slate-500">Thinking...</div> : null}
      </div>
      <div data-testid="assistant-chat-composer" className="mt-2 shrink-0 rounded-lg border border-slate-200 bg-white p-2">
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key !== "Enter") return;
            if (event.shiftKey && !event.ctrlKey && !event.metaKey) return;
            if (event.ctrlKey || event.metaKey || (!event.shiftKey && !event.altKey)) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Ask EssayCraft about this module..."
          className="min-h-16 w-full resize-none border-0 bg-transparent text-sm outline-none"
        />
        <div className="flex justify-end">
          <button className="btn-primary px-3 py-1.5 text-xs" onClick={submit} disabled={!value.trim() || loading}>Send</button>
        </div>
      </div>
    </div>
  );
}

function EditMode(props: AssistantPanelProps & { hasSelection: boolean }) {
  const [instruction, setInstruction] = useState("");
  const instructionRef = useRef<HTMLTextAreaElement>(null);
  const contextRange = props.hasSelection ? props.selectedRange : props.activeAnnotation
    ? { start: props.activeAnnotation.start, end: props.activeAnnotation.end }
    : props.activeSentenceRange;
  const contextText = props.hasSelection ? props.selectedText : props.activeAnnotation?.text || props.activeSentenceText;
  const excerpt = useMemo(() => compactExcerpt(contextText), [contextText]);
  const label = props.activeAnnotation ? LABELS[props.activeAnnotation.label] : undefined;
  const canEdit = Boolean(contextRange && contextRange.end > contextRange.start);
  const canExplain = Boolean(props.activeAnnotation);

  return (
    <div data-testid="assistant-edit-mode" className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div data-testid="assistant-edit-content" className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        <section data-testid="assistant-edit-context" className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="font-semibold text-slate-700">{props.hasSelection ? "Selected range" : canEdit ? "Active sentence" : "Edit context"}</div>
            {contextText ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{contextText.length} chars</span> : null}
          </div>
          {contextText ? (
            <p className="whitespace-pre-wrap text-slate-700">
              {excerpt.text}
              {excerpt.compacted ? <span className="ml-1 text-slate-400">(compact)</span> : null}
            </p>
          ) : (
            <p className="text-slate-500">Click a sentence or select text for local editing.</p>
          )}
          <div className="mt-2 flex flex-wrap gap-1">
            {label ? (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${label.swatch} text-slate-800`}>
                {label.name}
              </span>
            ) : null}
            {props.activePatchCount ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">{props.activePatchCount} note{props.activePatchCount === 1 ? "" : "s"} included</span>
            ) : null}
          </div>
          {label ? (
            <p data-testid="assistant-label-explanation" className="mt-2 text-slate-500">
              {friendlyAnnotationComment(props.activeAnnotation?.comment, label.description)}
            </p>
          ) : null}
        </section>

        {props.revisionPreview?.kind === "revision" && props.revisionPreview.proposedText ? (
          <RevisionPreview preview={props.revisionPreview} onAccept={props.onAcceptRevision} onReject={props.onRejectRevision} />
        ) : null}

        {props.refreshResult && props.refreshResult.kind !== "revision" ? (
          <RefreshResultCard result={props.refreshResult} onDismiss={props.onDismiss} />
        ) : null}

        {props.suggestion?.kind === "edit" ? (
          <EditPreview suggestion={props.suggestion} onApply={props.onApply} onDismiss={props.onDismiss} />
        ) : null}

        {props.suggestion?.kind === "inspect" ? (
          <InspectCard suggestion={props.suggestion} onDismiss={props.onDismiss} />
        ) : null}

      </div>

      <div className="mt-2 shrink-0 rounded-lg border border-slate-200 bg-white p-2">
        <textarea
          ref={instructionRef}
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder="Tell EssayCraft what you want to change"
          className="min-h-14 w-full resize-none border-0 bg-transparent text-sm outline-none"
          disabled={!canEdit}
        />
        <div className="grid grid-cols-2 gap-1.5 text-xs sm:grid-cols-5">
          <button aria-label="Rewrite" className="btn-primary min-h-8 px-2 py-1.5" disabled={!canEdit || props.loading} onClick={() => runInstruction("Rewrite selected passage")}>Rewrite</button>
          <button aria-label="Academic" className="btn-primary min-h-8 px-2 py-1.5" disabled={!canEdit || props.loading} onClick={() => runInstruction("Make more academic")}>Academic</button>
          <button aria-label="Analyze" className="btn-secondary min-h-8 px-2 py-1.5" disabled={!canEdit || props.loading} onClick={() => runAnalyze()}>Analyze</button>
          <button aria-label="Translate" className="btn-secondary min-h-8 px-2 py-1.5" disabled={!canEdit || props.loading} onClick={() => props.onSelectionAction("Translate selected text")}>Translate</button>
          <button
            aria-label="Explain highlight"
            className="btn-secondary min-h-8 px-2 py-1.5"
            disabled={!canExplain || props.loading}
            title={canExplain ? "Explain the active highlight label." : "Click a highlighted sentence first."}
            onClick={() => props.onInspectAction("Explain this highlight")}
          >
            Explain
          </button>
        </div>
      </div>
    </div>
  );

  function runInstruction(baseAction: string) {
    const text = (instructionRef.current?.value ?? instruction).trim();
    props.onSelectionAction(text ? `${baseAction}: ${text}` : baseAction);
    setInstruction("");
  }

  function runAnalyze() {
    const text = (instructionRef.current?.value ?? instruction).trim();
    props.onInspectAction(text ? `Analyze selected text: ${text}` : "Analyze selected text");
    setInstruction("");
  }
}

function EditPreview({
  suggestion,
  onApply,
  onDismiss
}: {
  suggestion: AssistResponse;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const readOnly = /translate/i.test(`${suggestion.actionType ?? ""} ${suggestion.title ?? ""}`);
  return (
    <article data-testid="assistant-edit-preview" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950">
      <div className="mb-2 font-semibold">{readOnly ? "Translation preview" : "Revision preview"}</div>
      <div className="space-y-2">
        <div>
          <div className="font-semibold text-blue-900/80">Original</div>
          <p className="mt-1 max-h-20 overflow-auto whitespace-pre-wrap rounded-md bg-white/80 p-2 text-slate-700">{compactExcerpt(suggestion.originalText ?? suggestion.originalExcerpt ?? "").text}</p>
        </div>
        <div>
          <div className="font-semibold text-blue-900/80">Proposed</div>
          <p className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded-md bg-white p-2 text-slate-800">{suggestion.proposedText}</p>
        </div>
        {suggestion.reply ? <p className="text-blue-900/70">{firstSentence(suggestion.reply)}</p> : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {!readOnly ? <button className="btn-primary px-2 py-1 text-xs" onClick={onApply}>Accept</button> : null}
        <button className="btn-secondary px-2 py-1 text-xs" onClick={onDismiss}>{readOnly ? "Dismiss" : "Reject"}</button>
        <button className="btn-secondary px-2 py-1 text-xs" onClick={() => void navigator.clipboard?.writeText(suggestion.proposedText ?? suggestion.reply)}>Copy</button>
      </div>
    </article>
  );
}

function RevisionPreview({
  preview,
  onAccept,
  onReject
}: {
  preview: RefreshResponse;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <article data-testid="apply-notes-preview" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
      <div className="mb-2 font-semibold">Apply notes preview</div>
      {preview.originalSummary ? <p className="mb-2 text-amber-900/80">{preview.originalSummary}</p> : null}
      <pre className="max-h-52 overflow-auto whitespace-pre-wrap rounded-md bg-white p-2 font-sans text-slate-800">{preview.proposedText}</pre>
      {preview.rationale ? <p className="mt-2 text-amber-900/80">{firstSentence(preview.rationale)}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn-primary px-2 py-1 text-xs" onClick={onAccept}>Accept</button>
        <button className="btn-secondary px-2 py-1 text-xs" onClick={onReject}>Reject</button>
        <button className="btn-secondary px-2 py-1 text-xs" onClick={() => void navigator.clipboard?.writeText(preview.proposedText ?? "")}>Copy</button>
      </div>
    </article>
  );
}

function RefreshResultCard({ result, onDismiss }: { result: RefreshResponse; onDismiss: () => void }) {
  const checklist = result.reviewChecklist ?? [];
  const isReview = result.kind === "moduleReview";
  const title = isReview ? (result.globalFeedback[0] ?? "Review ready") : "Refresh result";
  return (
    <article data-testid="refresh-result-card" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-950">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="font-semibold">{title}</div>
        <button className="btn-secondary px-2 py-1 text-[11px]" onClick={onDismiss}>Dismiss</button>
      </div>
      {result.reviewSummary ? (
        <p className="whitespace-pre-wrap text-emerald-950/90">{result.reviewSummary}</p>
      ) : (
        <p>{result.globalFeedback[0] ?? "Highlights refreshed."}</p>
      )}
      {checklist.length ? (
        <ul data-testid="module-review-checklist" className="mt-2 space-y-1">
          {checklist.map((item) => (
            <li key={`${item.label}-${item.detail}`} className="rounded-md bg-white/80 px-2 py-1">
              <span className="font-semibold">{item.label}: </span>
              <span>{item.detail}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-2 rounded-md bg-white/80 px-2 py-1">
          <span className="font-semibold">{result.annotations.length}</span> label{result.annotations.length === 1 ? "" : "s"} refreshed.
          {typeof result.issueCount === "number" ? <span> {result.issueCount} issue{result.issueCount === 1 ? "" : "s"} found.</span> : null}
        </div>
      )}
      {result.reviewSuggestions?.length ? (
        <div className="mt-2">
          <div className="font-semibold">Suggestions</div>
          <ul className="mt-1 space-y-1">
            {result.reviewSuggestions.slice(0, 5).map((suggestion) => <li key={suggestion}>- {suggestion}</li>)}
          </ul>
        </div>
      ) : result.globalFeedback.length > 1 ? (
        <p className="mt-2">{result.globalFeedback.slice(1).join(" ")}</p>
      ) : null}
      {result.nextStep ? <p className="mt-2 font-semibold">{result.nextStep}</p> : null}
    </article>
  );
}

function InspectCard({ suggestion, onDismiss }: { suggestion: AssistResponse; onDismiss: () => void }) {
  const isAnalyze = suggestion.actionType === "analyze-selection" || /analysis/i.test(suggestion.title ?? "");
  return (
    <article data-testid={isAnalyze ? "assistant-analysis-result" : "assistant-highlight-explanation"} className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700">
      <div className="mb-1 font-semibold text-slate-800">{isAnalyze ? "Analysis" : "Highlight explanation"}</div>
      <p className="whitespace-pre-wrap">{suggestion.reply}</p>
      <div className="mt-2 flex gap-2">
        <button className="btn-secondary px-2 py-1 text-xs" onClick={() => void navigator.clipboard?.writeText(suggestion.reply)}>Copy</button>
        <button className="btn-secondary px-2 py-1 text-xs" onClick={onDismiss}>Dismiss</button>
      </div>
    </article>
  );
}

function compactExcerpt(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= 180) return { text: normalized, compacted: false };
  return { text: `${normalized.slice(0, 80)} ... ${normalized.slice(-50)}`, compacted: true };
}

function friendlyAnnotationComment(comment: string | undefined, fallback: string) {
  if (!comment) return fallback;
  if (/local fallback|provider|confidence/i.test(comment)) return fallback;
  return comment;
}

function firstSentence(value: string) {
  return value.split(/(?<=[.!?。！？])\s+/)[0]?.trim() || value.trim();
}
