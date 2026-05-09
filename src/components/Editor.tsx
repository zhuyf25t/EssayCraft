"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import type { Annotation, Patch, TextRange } from "@/types/essaycraft";
import { LABELS } from "@/lib/labels";
import { annotationAtOffset, sentenceRangeAt } from "@/lib/annotations";
import { patchAtOffset } from "@/lib/patches";
import { countCharacters, countWords } from "@/lib/sentence";

type EditorProps = {
  text: string;
  annotations: Annotation[];
  patches: Patch[];
  selectedRange: TextRange;
  resetKey: number;
  onTextChange: (text: string) => void;
  onSelectionChange: (range: TextRange) => void;
  onOpenPatch: (range: TextRange) => void;
};

export function Editor({ text, annotations, patches, selectedRange, resetKey, onTextChange, onSelectionChange, onOpenPatch }: EditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const activeAnnotation = useMemo(
    () => annotationAtOffset(annotations, selectedRange.start),
    [annotations, selectedRange.start]
  );

  const activePatch = useMemo(
    () => patchAtOffset(patches, selectedRange.start),
    [patches, selectedRange.start]
  );

  function syncSelection() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    onSelectionChange({ start: textarea.selectionStart, end: textarea.selectionEnd });
  }

  useEffect(() => {
    const textarea = textareaRef.current;
    const backdrop = backdropRef.current;
    if (textarea) {
      textarea.scrollTop = 0;
      textarea.scrollLeft = 0;
      try {
        textarea.setSelectionRange(0, 0);
      } catch {
        // The textarea can be temporarily unavailable during fast route hydration.
      }
    }
    if (backdrop) {
      backdrop.scrollTop = 0;
      backdrop.scrollLeft = 0;
    }
    onSelectionChange({ start: 0, end: 0 });
  }, [resetKey, onSelectionChange]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const syncNativeSelection = () => {
      if (document.activeElement !== textarea) return;
      onSelectionChange({ start: textarea.selectionStart, end: textarea.selectionEnd });
    };
    textarea.addEventListener("select", syncNativeSelection);
    document.addEventListener("selectionchange", syncNativeSelection);
    return () => {
      textarea.removeEventListener("select", syncNativeSelection);
      document.removeEventListener("selectionchange", syncNativeSelection);
    };
  }, [onSelectionChange]);


  return (
    <section data-testid="editor-shell" className="editor-shell">
      <div className="editor-toolbar">
        <div>
          <span className="font-semibold text-slate-800">Writing canvas</span>
          <span className="ml-2 text-xs text-slate-500">{countWords(text)} words / {countCharacters(text)} chars</span>
        </div>
        <div className="text-xs text-slate-500">
          {activeAnnotation ? `${LABELS[activeAnnotation.label].name}: ${activeAnnotation.comment ?? LABELS[activeAnnotation.label].description}` : "Ctrl/Cmd+Enter adds a patch note"}
        </div>
      </div>

      <div data-testid="editor-stack" className="editor-stack">
        <div ref={backdropRef} data-testid="editor-backdrop" className="editor-backdrop" aria-hidden="true">
          <HighlightText text={text} annotations={annotations} />
        </div>
        <textarea
          ref={textareaRef}
          data-testid="editor-textarea"
          value={text}
          spellCheck
          onChange={(event) => onTextChange(event.currentTarget.value)}
          onClick={syncSelection}
          onKeyUp={syncSelection}
          onSelect={syncSelection}
          onScroll={(event) => {
            if (backdropRef.current) {
              backdropRef.current.scrollTop = event.currentTarget.scrollTop;
              backdropRef.current.scrollLeft = event.currentTarget.scrollLeft;
            }
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              const target = event.currentTarget;
              const range = sentenceRangeAt(text, target.selectionStart, target.selectionEnd);
              onSelectionChange({ start: range.start, end: range.end });
              onOpenPatch({ start: range.start, end: range.end });
            }
          }}
          placeholder="Write or paste your module text here. Paragraph breaks are preserved with blank lines."
          className="editor-textarea"
        />
      </div>

      <div className="editor-footer">
        <span>Paragraphs are stored as plain text with blank lines.</span>
        {activePatch ? <span className="rounded-md bg-blue-50 px-2 py-1 text-blue-700">Patch: {activePatch.text}</span> : null}
      </div>
    </section>
  );
}

function HighlightText({ text, annotations }: { text: string; annotations: Annotation[] }) {
  const nodes: ReactNode[] = [];
  const sorted = annotations
    .filter((annotation) => annotation.end > annotation.start && annotation.end <= text.length && text.slice(annotation.start, annotation.end) === annotation.text)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  let cursor = 0;
  sorted.forEach((annotation) => {
    if (annotation.start > cursor) {
      nodes.push(<span key={`plain-${cursor}`}>{text.slice(cursor, annotation.start)}</span>);
    }
    nodes.push(
      <mark key={annotation.id} className={`highlight-backdrop ${LABELS[annotation.label].className}`}>
        {text.slice(annotation.start, annotation.end)}
      </mark>
    );
    cursor = annotation.end;
  });

  if (cursor < text.length) {
    nodes.push(<span key={`plain-${cursor}`}>{text.slice(cursor)}</span>);
  }

  if (nodes.length === 0) return <span>{text || " "}</span>;
  return <>{nodes}</>;
}
