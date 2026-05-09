"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Annotation, Patch, TextRange } from "@/types/essaycraft";
import { LABELS } from "@/lib/labels";
import { annotationAtOffset, sentenceRangeAt } from "@/lib/annotations";
import { countCharacters, countWords } from "@/lib/sentence";

type EditorProps = {
  text: string;
  annotations: Annotation[];
  patches: Patch[];
  selectedRange: TextRange;
  activeSentenceRange?: TextRange;
  resetKey: number;
  onTextChange: (text: string) => void;
  onSelectionChange: (range: TextRange) => void;
  onActiveSentenceChange: (range: TextRange | undefined) => void;
  onOpenPatch: (range: TextRange) => void;
  onPatchMarkerClick: (patch: Patch) => void;
};

export function Editor({
  text,
  annotations,
  patches,
  selectedRange,
  activeSentenceRange,
  resetKey,
  onTextChange,
  onSelectionChange,
  onActiveSentenceChange,
  onOpenPatch,
  onPatchMarkerClick
}: EditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const activeAnnotation = useMemo(
    () => annotationAtOffset(annotations, selectedRange.start),
    [annotations, selectedRange.start]
  );

  function syncSelection() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const range = { start: textarea.selectionStart, end: textarea.selectionEnd };
    onSelectionChange(range);
    if (range.end > range.start) {
      onActiveSentenceChange(undefined);
      return;
    }
    const sentence = sentenceRangeAt(text, range.start, range.end);
    onActiveSentenceChange(sentence.end > sentence.start ? sentence : undefined);
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
    onActiveSentenceChange(undefined);
  }, [resetKey, onSelectionChange, onActiveSentenceChange]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const syncNativeSelection = () => {
      if (document.activeElement !== textarea) return;
      const range = { start: textarea.selectionStart, end: textarea.selectionEnd };
      onSelectionChange(range);
      if (range.end > range.start) {
        onActiveSentenceChange(undefined);
      } else {
        const sentence = sentenceRangeAt(text, range.start, range.end);
        onActiveSentenceChange(sentence.end > sentence.start ? sentence : undefined);
      }
    };
    textarea.addEventListener("select", syncNativeSelection);
    document.addEventListener("selectionchange", syncNativeSelection);
    return () => {
      textarea.removeEventListener("select", syncNativeSelection);
      document.removeEventListener("selectionchange", syncNativeSelection);
    };
  }, [onActiveSentenceChange, onSelectionChange, text]);

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
          {activeAnnotation ? `${LABELS[activeAnnotation.label].name}: ${friendlyAnnotationComment(activeAnnotation.comment, LABELS[activeAnnotation.label].description)}` : "Ctrl/Cmd+Enter adds a note"}
        </div>
      </div>

      <div data-testid="editor-stack" className="editor-stack">
        <div ref={backdropRef} data-testid="editor-backdrop" className="editor-backdrop" aria-hidden="true">
          <HighlightText text={text} annotations={annotations} patches={patches} activeSentenceRange={activeSentenceRange} />
        </div>
        <PatchInlineMarkers text={text} scrollTop={scrollTop} patches={patches} onPatchMarkerClick={onPatchMarkerClick} />
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
            setScrollTop(event.currentTarget.scrollTop);
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
      </div>
    </section>
  );
}

function HighlightText({
  text,
  annotations,
  patches,
  activeSentenceRange
}: {
  text: string;
  annotations: Annotation[];
  patches: Patch[];
  activeSentenceRange?: TextRange;
}) {
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
  if (activeSentenceRange) {
    points.add(activeSentenceRange.start);
    points.add(activeSentenceRange.end);
  }
  const ordered = [...points].sort((a, b) => a - b);

  for (let index = 0; index < ordered.length - 1; index += 1) {
    const start = ordered[index];
    const end = ordered[index + 1];
    if (end <= start) continue;
    const segment = text.slice(start, end);
    const annotation = sorted.find((item) => item.start <= start && item.end >= end);
    const patch = openPatches.find((item) => item.anchorStart <= start && item.anchorEnd >= end);
    const activeSentence = activeSentenceRange && activeSentenceRange.start <= start && activeSentenceRange.end >= end;
    const className = `${annotation ? `highlight-backdrop ${LABELS[annotation.label].className}` : ""} ${patch ? "patch-backdrop" : ""} ${activeSentence ? "active-sentence-backdrop" : ""}`.trim();
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
          data-note={compactNote(endingPatch.text)}
          title={endingPatch.text}
        >
          note
        </span>
      );
    }
  }

  for (const patch of openPatches.filter((item) => item.anchorStart === item.anchorEnd)) {
    nodes.push(<span key={`patch-marker-caret-${patch.id}`} data-testid="patch-marker" className="patch-marker" data-note={compactNote(patch.text)} title={patch.text}>note</span>);
  }

  if (nodes.length === 0) return <span>{text || " "}</span>;
  return <>{nodes}</>;
}

function PatchInlineMarkers({
  text,
  scrollTop,
  patches,
  onPatchMarkerClick
}: {
  text: string;
  scrollTop: number;
  patches: Patch[];
  onPatchMarkerClick: (patch: Patch) => void;
}) {
  const openPatches = patches.filter((patch) => !patch.resolved && !patch.stale).slice(0, 8);
  if (!openPatches.length) return null;
  return (
    <div data-testid="patch-margin-markers" className="patch-inline-markers" aria-label="Inline notes">
      {openPatches.map((patch, index) => (
        <button
          key={patch.id}
          type="button"
          data-testid="patch-margin-marker"
          data-note={compactNote(patch.text)}
          className="patch-inline-marker"
          style={{ top: `${estimatePatchTop(text, patch.anchorStart, scrollTop)}px` }}
          title={`Patch ${index + 1}: ${patch.text}`}
          onClick={() => onPatchMarkerClick(patch)}
        >
          📝
        </button>
      ))}
    </div>
  );
}

function compactNote(value: string) {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > 46 ? `${text.slice(0, 44)}...` : text;
}

function estimatePatchTop(text: string, start: number, scrollTop: number) {
  const before = text.slice(0, Math.max(0, start));
  const hardLines = before.split("\n");
  const softLines = hardLines.reduce((total, line) => total + Math.max(1, Math.ceil(line.length / 76)), 0);
  return Math.max(12, 20 + softLines * 34 - scrollTop);
}

function friendlyAnnotationComment(comment: string | undefined, fallback: string) {
  if (!comment) return fallback;
  if (/local fallback|provider|confidence/i.test(comment)) return fallback;
  return comment;
}
