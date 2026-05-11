"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import type { Annotation, Patch, TextRange } from "@/types/essaycraft";
import { normalizeAnnotations, sentenceRangeAt } from "@/lib/annotations";
import { LABELS } from "@/lib/labels";
import { countCharacters, countWords } from "@/lib/sentence";
import { stripEditorKernelMarkers } from "@/lib/noteKernel";

type EditorProps = {
  text: string;
  annotations: Annotation[];
  patches: Patch[];
  selectedRange: TextRange;
  activeSentenceRange?: TextRange;
  resetKey: number;
  onTextChange: (text: string, patches?: Patch[]) => void;
  onSelectionChange: (range: TextRange) => void;
  onActiveSentenceChange: (range: TextRange | undefined) => void;
  onOpenPatch: (range: TextRange) => void;
  onPatchMarkerClick: (patch: Patch) => void;
  patchEditor?: unknown;
  onPatchSubmit: (text: string) => void;
  onPatchClose: () => void;
  onPatchDelete: (patchId: string) => void;
};

type HighlightSegment = {
  key: string;
  text: string;
  className: string;
};

const EMPTY_RANGE: TextRange = { start: 0, end: 0 };

export function Editor({
  text,
  annotations,
  selectedRange,
  activeSentenceRange,
  resetKey,
  onTextChange,
  onSelectionChange,
  onActiveSentenceChange,
  onOpenPatch
}: EditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightContentRef = useRef<HTMLDivElement>(null);
  const lastResetKeyRef = useRef(resetKey);
  const segments = useMemo(
    () => buildHighlightSegments(text, annotations, activeSentenceRange),
    [text, annotations, activeSentenceRange]
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || lastResetKeyRef.current === resetKey) return;
    lastResetKeyRef.current = resetKey;
    textarea.scrollTop = 0;
    textarea.scrollLeft = 0;
    textarea.setSelectionRange(0, 0);
    syncHighlightScroll();
    onSelectionChange(EMPTY_RANGE);
    onActiveSentenceChange(undefined);
  }, [resetKey, onSelectionChange, onActiveSentenceChange]);

  useLayoutEffect(() => {
    syncHighlightScroll();
  }, [text, segments]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(syncHighlightScroll);
    observer.observe(textarea);
    return () => observer.disconnect();
  }, []);

  function currentRange(): TextRange {
    const textarea = textareaRef.current;
    if (!textarea) return EMPTY_RANGE;
    return {
      start: Math.max(0, Math.min(textarea.value.length, textarea.selectionStart ?? 0)),
      end: Math.max(0, Math.min(textarea.value.length, textarea.selectionEnd ?? 0))
    };
  }

  function syncSelectionFromTextarea() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const range = currentRange();
    if (range.start !== selectedRange.start || range.end !== selectedRange.end) {
      onSelectionChange(range);
    }
    if (range.end > range.start) {
      if (activeSentenceRange) onActiveSentenceChange(undefined);
      return;
    }
    const sentence = sentenceRangeAt(textarea.value, range.start, range.end);
    const nextSentence = sentence.end > sentence.start ? sentence : undefined;
    if (!sameOptionalRange(nextSentence, activeSentenceRange)) {
      onActiveSentenceChange(nextSentence);
    }
  }

  function syncHighlightScroll() {
    const textarea = textareaRef.current;
    const content = highlightContentRef.current;
    if (!textarea || !content) return;
    content.style.width = `${textarea.clientWidth}px`;
    content.style.minHeight = `${textarea.scrollHeight}px`;
    content.style.transform = `translate(${-textarea.scrollLeft}px, ${-textarea.scrollTop}px)`;
  }

  function replaceSelection(value: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? start;
    const nextText = `${textarea.value.slice(0, start)}${value}${textarea.value.slice(end)}`;
    const nextOffset = start + value.length;
    onTextChange(nextText);
    requestAnimationFrame(() => {
      textarea.focus({ preventScroll: true });
      textarea.setSelectionRange(nextOffset, nextOffset);
      syncSelectionFromTextarea();
      syncHighlightScroll();
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      const range = currentRange();
      onSelectionChange(range);
      onOpenPatch(range);
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      replaceSelection("\n\n");
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    event.preventDefault();
    replaceSelection(stripEditorKernelMarkers(event.clipboardData.getData("text/plain")));
  }

  return (
    <section data-testid="editor-shell" className="editor-shell">
      <div className="editor-toolbar">
        <div>
          <span className="font-semibold text-slate-800">Writing canvas</span>
          <span className="ml-2 text-xs text-slate-500">{countWords(text)} words / {countCharacters(text)} chars</span>
        </div>
        <div className="text-xs text-slate-500">Select text, then use Edit actions</div>
      </div>

      <div data-testid="editor-stack" className="editor-stack">
        <div className="editor-highlight-layer" aria-hidden="true">
          <div ref={highlightContentRef} className="editor-highlight-content">
            {segments.length ? segments.map((segment) => (
              segment.className
                ? <mark key={segment.key} className={segment.className}>{segment.text}</mark>
                : <span key={segment.key}>{segment.text}</span>
            )) : " "}
          </div>
        </div>
        <textarea
          ref={textareaRef}
          data-testid="editor-textarea"
          aria-label="Writing canvas"
          value={text}
          spellCheck
          className="editor-content editor-textarea-control"
          onChange={(event) => {
            onTextChange(event.currentTarget.value);
            requestAnimationFrame(syncSelectionFromTextarea);
          }}
          onInput={syncSelectionFromTextarea}
          onCompositionEnd={(event) => {
            onTextChange(event.currentTarget.value);
            requestAnimationFrame(syncSelectionFromTextarea);
          }}
          onSelect={syncSelectionFromTextarea}
          onClick={syncSelectionFromTextarea}
          onMouseUp={syncSelectionFromTextarea}
          onKeyUp={syncSelectionFromTextarea}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onScroll={syncHighlightScroll}
        />
      </div>

      <div className="editor-footer">
        <span>Paragraphs are stored as plain text with blank lines.</span>
      </div>
    </section>
  );
}

function buildHighlightSegments(text: string, annotations: Annotation[], activeSentenceRange?: TextRange): HighlightSegment[] {
  if (!text) return [];
  const sorted = normalizeAnnotations(text, annotations);
  const points = new Set<number>([0, text.length]);
  for (const annotation of sorted) {
    points.add(annotation.start);
    points.add(annotation.end);
  }
  if (activeSentenceRange && activeSentenceRange.end > activeSentenceRange.start) {
    points.add(activeSentenceRange.start);
    points.add(activeSentenceRange.end);
  }

  const ordered = [...points].sort((a, b) => a - b);
  const segments: HighlightSegment[] = [];
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const start = ordered[index];
    const end = ordered[index + 1];
    if (end <= start) continue;
    const value = text.slice(start, end);
    const decoratable = value.trim().length > 0;
    const annotation = decoratable ? sorted.find((item) => item.start <= start && item.end >= end) : undefined;
    const active = decoratable && activeSentenceRange && activeSentenceRange.start <= start && activeSentenceRange.end >= end;
    const className = [
      annotation ? `highlight-backdrop ${LABELS[annotation.label].className}` : "",
      active ? "active-sentence-backdrop" : ""
    ].filter(Boolean).join(" ");
    segments.push({
      key: `${start}-${end}-${annotation?.id ?? "plain"}-${active ? "active" : "rest"}`,
      text: value,
      className
    });
  }
  return segments;
}

function sameOptionalRange(a: TextRange | undefined, b: TextRange | undefined) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.start === b.start && a.end === b.end;
}
