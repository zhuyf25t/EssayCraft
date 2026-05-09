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

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || document.activeElement === textarea) return;
    if (textarea.selectionStart === selectedRange.start && textarea.selectionEnd === selectedRange.end) return;
    try {
      textarea.focus();
      textarea.setSelectionRange(selectedRange.start, selectedRange.end);
    } catch {
      // Ignore external selection sync during transient DOM updates.
    }
  }, [selectedRange.start, selectedRange.end]);

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
          <HighlightText text={text} annotations={annotations} patches={patches} />
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

function HighlightText({ text, annotations, patches }: { text: string; annotations: Annotation[]; patches: Patch[] }) {
  const nodes: ReactNode[] = [];
  const sorted = annotations
    .filter((annotation) => annotation.end > annotation.start && annotation.end <= text.length && text.slice(annotation.start, annotation.end) === annotation.text)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const openPatches = patches
    .filter((patch) => !patch.resolved && !patch.stale && patch.anchorStart >= 0 && patch.anchorStart <= text.length && patch.anchorEnd >= patch.anchorStart && patch.anchorEnd <= text.length)
    .sort((a, b) => a.anchorStart - b.anchorStart || a.anchorEnd - b.anchorEnd);
  const points = new Set<number>([0, text.length]);
  for (const annotation of sorted) {
    points.add(annotation.start);
    points.add(annotation.end);
  }
  for (const patch of openPatches) {
    points.add(patch.anchorStart);
    points.add(patch.anchorEnd);
  }
  const ordered = [...points].sort((a, b) => a - b);

  for (let index = 0; index < ordered.length - 1; index += 1) {
    const start = ordered[index];
    const end = ordered[index + 1];
    if (end <= start) continue;
    const segment = text.slice(start, end);
    const annotation = sorted.find((item) => item.start <= start && item.end >= end);
    const patch = openPatches.find((item) => item.anchorStart <= start && item.anchorEnd >= end);
    const className = `${annotation ? `highlight-backdrop ${LABELS[annotation.label].className}` : ""} ${patch ? "patch-backdrop" : ""}`.trim();
    const key = `${start}-${end}-${annotation?.id ?? "plain"}-${patch?.id ?? "nopatch"}`;
    const content = className ? <mark key={key} className={className}>{segment}</mark> : <span key={key}>{segment}</span>;
    nodes.push(content);

    const endingPatches = openPatches.filter((item) => item.anchorEnd === end && item.anchorEnd > item.anchorStart);
    for (const endingPatch of endingPatches) {
      nodes.push(
        <span
          key={`patch-marker-${endingPatch.id}-${end}`}
          data-testid="patch-marker"
          className="patch-marker"
          title={endingPatch.text}
        >
          note
        </span>
      );
    }
  }

  for (const patch of openPatches.filter((item) => item.anchorStart === item.anchorEnd)) {
    nodes.push(<span key={`patch-marker-caret-${patch.id}`} data-testid="patch-marker" className="patch-marker" title={patch.text}>note</span>);
  }

  if (nodes.length === 0) return <span>{text || " "}</span>;
  return <>{nodes}</>;
}
