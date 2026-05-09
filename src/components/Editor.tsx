"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
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
        <div ref={backdropRef} data-testid="editor-backdrop" className="editor-backdrop">
          <HighlightText
            text={text}
            annotations={annotations}
            patches={patches}
            activeSentenceRange={activeSentenceRange}
            onPatchMarkerClick={onPatchMarkerClick}
          />
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
              const range = target.selectionEnd > target.selectionStart
                ? { start: target.selectionStart, end: target.selectionEnd }
                : { start: target.selectionStart, end: target.selectionStart };
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
  activeSentenceRange,
  onPatchMarkerClick
}: {
  text: string;
  annotations: Annotation[];
  patches: Patch[];
  activeSentenceRange?: TextRange;
  onPatchMarkerClick: (patch: Patch) => void;
}) {
  const nodes: ReactNode[] = [];
  const sorted = annotations
    .filter((annotation) => {
      if (annotation.end <= annotation.start || annotation.start < 0 || annotation.end > text.length) return false;
      const segment = text.slice(annotation.start, annotation.end);
      return segment === annotation.text && segment.trim().length > 0;
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const openPatches = patches
    .filter((patch) => !patch.resolved && !patch.stale && patch.anchorStart >= 0 && patch.anchorStart <= text.length && patch.anchorEnd >= patch.anchorStart && patch.anchorEnd <= text.length)
    .sort((a, b) => a.anchorStart - b.anchorStart || a.anchorEnd - b.anchorEnd);
  const notesByOffset = new Map<number, Patch[]>();
  for (const patch of openPatches) {
    const offset = Math.min(text.length, Math.max(0, patch.anchorEnd > patch.anchorStart ? patch.anchorEnd : patch.anchorStart));
    const list = notesByOffset.get(offset) ?? [];
    list.push(patch);
    notesByOffset.set(offset, list);
  }
  const points = new Set<number>([0, text.length]);
  for (const annotation of sorted) {
    points.add(annotation.start);
    points.add(annotation.end);
  }
  for (const patch of openPatches) {
    points.add(patch.anchorStart);
    points.add(patch.anchorEnd);
    points.add(Math.min(text.length, Math.max(0, patch.anchorEnd > patch.anchorStart ? patch.anchorEnd : patch.anchorStart)));
  }
  if (activeSentenceRange) {
    points.add(activeSentenceRange.start);
    points.add(activeSentenceRange.end);
  }
  const ordered = [...points].sort((a, b) => a - b);

  pushNotesAt(0);
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const start = ordered[index];
    const end = ordered[index + 1];
    if (end <= start) continue;
    const segment = text.slice(start, end);
    const decoratable = segment.trim().length > 0;
    const annotation = decoratable ? sorted.find((item) => item.start <= start && item.end >= end) : undefined;
    const patch = decoratable ? openPatches.find((item) => item.anchorStart <= start && item.anchorEnd >= end) : undefined;
    const activeSentence = decoratable && activeSentenceRange && activeSentenceRange.start <= start && activeSentenceRange.end >= end;
    const className = `${annotation ? `highlight-backdrop ${LABELS[annotation.label].className}` : ""} ${patch ? "patch-backdrop" : ""} ${activeSentence ? "active-sentence-backdrop" : ""}`.trim();
    const key = `${start}-${end}-${annotation?.id ?? "plain"}-${patch?.id ?? "nopatch"}`;
    const content = className ? <mark key={key} className={className}>{segment}</mark> : <span key={key}>{segment}</span>;
    nodes.push(content);
    pushNotesAt(end);
  }

  if (nodes.length === 0) return <span>{text || " "}</span>;
  return <>{nodes}</>;

  function pushNotesAt(offset: number) {
    const notes = notesByOffset.get(offset);
    if (!notes?.length) return;
    for (const patch of notes) {
      nodes.push(
        <span key={`inline-note-${patch.id}-${offset}`} className="inline-note-anchor">
          <button
            type="button"
            data-testid="patch-margin-marker"
            data-note={compactNote(patch.text)}
            className="inline-note-token"
            title={`Note: ${patch.text}`}
            onClick={() => onPatchMarkerClick(patch)}
          >
            <span data-testid="patch-marker" className="inline-note-label">Note: {compactNote(patch.text)}</span>
          </button>
        </span>
      );
    }
  }
}

function compactNote(value: string) {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > 90 ? `${text.slice(0, 87)}...` : text;
}

function friendlyAnnotationComment(comment: string | undefined, fallback: string) {
  if (!comment) return fallback;
  if (/local fallback|provider|confidence/i.test(comment)) return fallback;
  return comment;
}
