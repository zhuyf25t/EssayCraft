"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Annotation, Patch, TextRange } from "@/types/essaycraft";
import { LABELS } from "@/lib/labels";
import { annotationAtOffset, sentenceRangeAt } from "@/lib/annotations";
import { countCharacters, countWords } from "@/lib/sentence";
import { id, nowIso } from "@/lib/utils";

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
  patchEditor?: {
    range: TextRange;
    anchorQuote: string;
    initialValue: string;
    editingPatchId: string | null;
  };
  onPatchSubmit: (text: string) => void;
  onPatchClose: () => void;
  onPatchDelete: (patchId: string) => void;
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
  onPatchMarkerClick,
  patchEditor,
  onPatchSubmit,
  onPatchClose,
  onPatchDelete
}: EditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const display = useMemo(() => buildDisplayBuffer(text, patches), [text, patches]);

  const activeAnnotation = useMemo(
    () => annotationAtOffset(annotations, selectedRange.start),
    [annotations, selectedRange.start]
  );

  function syncSelection() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const range = displayRangeToCanonical(display, textarea.selectionStart, textarea.selectionEnd);
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
      const range = displayRangeToCanonical(display, textarea.selectionStart, textarea.selectionEnd);
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
  }, [display, onActiveSentenceChange, onSelectionChange, text]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || document.activeElement === textarea) return;
    const displayStart = canonicalOffsetToDisplay(display, selectedRange.start);
    const displayEnd = canonicalOffsetToDisplay(display, selectedRange.end);
    if (textarea.selectionStart === displayStart && textarea.selectionEnd === displayEnd) return;
    try {
      textarea.focus();
      textarea.setSelectionRange(displayStart, displayEnd);
    } catch {
      // Ignore external selection sync during transient DOM updates.
    }
  }, [display, selectedRange.start, selectedRange.end]);

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
            onPatchDelete={onPatchDelete}
            patchEditor={patchEditor}
            onPatchSubmit={onPatchSubmit}
            onPatchClose={onPatchClose}
          />
        </div>
        <textarea
          ref={textareaRef}
          data-testid="editor-textarea"
          value={display.value}
          spellCheck
          onChange={(event) => {
            const parsed = parseDisplayBuffer(event.currentTarget.value, patches);
            onTextChange(parsed.text, parsed.patches);
          }}
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
              const range = displayRangeToCanonical(display, target.selectionStart, target.selectionEnd);
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
  onPatchMarkerClick,
  onPatchDelete,
  patchEditor,
  onPatchSubmit,
  onPatchClose
}: {
  text: string;
  annotations: Annotation[];
  patches: Patch[];
  activeSentenceRange?: TextRange;
  onPatchMarkerClick: (patch: Patch) => void;
  onPatchDelete: (patchId: string) => void;
  patchEditor?: {
    range: TextRange;
    anchorQuote: string;
    initialValue: string;
    editingPatchId: string | null;
  };
  onPatchSubmit: (text: string) => void;
  onPatchClose: () => void;
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
    if (patchEditor?.editingPatchId === patch.id) continue;
    const offset = Math.min(text.length, Math.max(0, patch.anchorEnd > patch.anchorStart ? patch.anchorEnd : patch.anchorStart));
    const list = notesByOffset.get(offset) ?? [];
    list.push(patch);
    notesByOffset.set(offset, list);
  }
  const patchEditorOffset = patchEditor
    ? Math.min(text.length, Math.max(0, patchEditor.range.end > patchEditor.range.start ? patchEditor.range.end : patchEditor.range.start))
    : undefined;
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
  if (patchEditorOffset !== undefined) points.add(patchEditorOffset);
  if (activeSentenceRange) {
    points.add(activeSentenceRange.start);
    points.add(activeSentenceRange.end);
  }
  const ordered = [...points].sort((a, b) => a - b);

  pushNotesAt(0);
  pushPatchEditorAt(0);
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
    pushPatchEditorAt(end);
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
            <span
              className="inline-note-remove"
              role="button"
              aria-label="Delete note"
              onClick={(event) => {
                event.stopPropagation();
                onPatchDelete(patch.id);
              }}
            >
              ×
            </span>
          </button>
        </span>
      );
    }
  }

  function pushPatchEditorAt(offset: number) {
    if (!patchEditor || patchEditorOffset !== offset) return;
    nodes.push(
      <InlinePatchEditor
        key={`inline-patch-editor-${patchEditor.editingPatchId ?? "new"}-${offset}`}
        initialValue={patchEditor.initialValue}
        anchorQuote={patchEditor.anchorQuote}
        range={patchEditor.range}
        editing={Boolean(patchEditor.editingPatchId)}
        onSubmit={onPatchSubmit}
        onClose={onPatchClose}
        onDelete={patchEditor.editingPatchId ? () => onPatchDelete(patchEditor.editingPatchId!) : undefined}
      />
    );
  }
}

function InlinePatchEditor({
  initialValue,
  anchorQuote,
  range,
  editing,
  onSubmit,
  onClose,
  onDelete
}: {
  initialValue: string;
  anchorQuote: string;
  range: TextRange;
  editing: boolean;
  onSubmit: (text: string) => void;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  function save() {
    if (value.trim()) onSubmit(value.trim());
    else onClose();
  }

  return (
    <span data-testid="inline-patch-editor" className="inline-note-editor">
      <span className="inline-note-editor-header">
        Note
        <span className="inline-note-editor-anchor">{compactAnchor(anchorQuote) || `cursor ${range.start}`}</span>
      </span>
      <textarea
        ref={ref}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            save();
            return;
          }
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            save();
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
        }}
        placeholder="Add a note for EssayCraft"
        className="inline-note-editor-input"
      />
      <span className="inline-note-editor-actions">
        <button type="button" className="inline-note-editor-save" onClick={save}>Save</button>
        {editing && onDelete ? <button type="button" className="inline-note-editor-delete" onClick={onDelete}>Delete</button> : null}
        <button type="button" className="inline-note-editor-cancel" onClick={onClose}>Esc</button>
      </span>
    </span>
  );
}

function compactNote(value: string) {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > 90 ? `${text.slice(0, 87)}...` : text;
}

function compactAnchor(value: string) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.length > 42 ? `${cleaned.slice(0, 39)}...` : cleaned;
}

function friendlyAnnotationComment(comment: string | undefined, fallback: string) {
  if (!comment) return fallback;
  if (/local fallback|provider|confidence/i.test(comment)) return fallback;
  return comment;
}

type DisplayBuffer = {
  value: string;
  displayToCanonical: number[];
  canonicalToDisplay: number[];
};

function buildDisplayBuffer(text: string, patches: Patch[]): DisplayBuffer {
  const openPatches = patches
    .filter((patch) => !patch.resolved && !patch.stale && patch.anchorStart >= 0 && patch.anchorStart <= text.length && patch.anchorEnd >= patch.anchorStart && patch.anchorEnd <= text.length)
    .sort((a, b) => noteOffset(a) - noteOffset(b) || a.createdAt.localeCompare(b.createdAt));
  const canonicalToDisplay = new Array(text.length + 1).fill(0);
  const displayToCanonical: number[] = [];
  let value = "";
  let cursor = 0;

  function appendCanonical(segment: string, canonicalStart: number) {
    for (let index = 0; index < segment.length; index += 1) {
      canonicalToDisplay[canonicalStart + index] = value.length;
      displayToCanonical[value.length] = canonicalStart + index;
      value += segment[index];
    }
  }

  function appendNote(note: string, canonicalOffset: number) {
    for (const char of note) {
      displayToCanonical[value.length] = canonicalOffset;
      value += char;
    }
  }

  for (const patch of openPatches) {
    const offset = Math.min(text.length, Math.max(0, noteOffset(patch)));
    appendCanonical(text.slice(cursor, offset), cursor);
    cursor = offset;
    canonicalToDisplay[offset] = value.length;
    appendNote(noteDisplayText(patch.text), offset);
  }
  appendCanonical(text.slice(cursor), cursor);
  canonicalToDisplay[text.length] = value.length;
  displayToCanonical[value.length] = text.length;

  return { value, displayToCanonical, canonicalToDisplay };
}

function parseDisplayBuffer(displayValue: string, currentPatches: Patch[]): { text: string; patches: Patch[] } {
  const visible = currentPatches
    .filter((patch) => !patch.resolved && !patch.stale)
    .sort((a, b) => noteOffset(a) - noteOffset(b) || a.createdAt.localeCompare(b.createdAt));
  const hidden = currentPatches.filter((patch) => patch.resolved || patch.stale);
  const regex = /\s*\[Note:\s*([\s\S]*?)\]\s*/g;
  let text = "";
  let lastIndex = 0;
  let noteIndex = 0;
  const nextVisible: Patch[] = [];

  for (const match of displayValue.matchAll(regex)) {
    const matchIndex = match.index ?? 0;
    text += displayValue.slice(lastIndex, matchIndex);
    const noteText = (match[1] ?? "").trim();
    const offset = text.length;
    if (noteText) {
      const existing = visible[noteIndex];
      nextVisible.push({
        ...(existing ?? {
          id: id("patch"),
          anchorQuote: "",
          createdAt: nowIso(),
          status: "open" as const,
          resolved: false,
          stale: false
        }),
        anchorStart: existing ? Math.min(existing.anchorStart, offset) : offset,
        anchorEnd: offset,
        anchorQuote: existing?.anchorQuote ?? "",
        text: noteText,
        updatedAt: nowIso(),
        status: "open",
        resolved: false,
        stale: false
      });
    }
    noteIndex += 1;
    lastIndex = matchIndex + match[0].length;
  }

  text += displayValue.slice(lastIndex);
  return { text, patches: [...nextVisible, ...hidden] };
}

function displayRangeToCanonical(display: DisplayBuffer, start: number, end: number): TextRange {
  const safeStart = Math.max(0, Math.min(display.value.length, start));
  const safeEnd = Math.max(safeStart, Math.min(display.value.length, end));
  return {
    start: display.displayToCanonical[safeStart] ?? 0,
    end: display.displayToCanonical[safeEnd] ?? display.displayToCanonical[safeStart] ?? 0
  };
}

function canonicalOffsetToDisplay(display: DisplayBuffer, offset: number) {
  const safeOffset = Math.max(0, Math.min(display.canonicalToDisplay.length - 1, offset));
  return display.canonicalToDisplay[safeOffset] ?? 0;
}

function noteOffset(patch: Patch) {
  return patch.anchorEnd > patch.anchorStart ? patch.anchorEnd : patch.anchorStart;
}

function noteDisplayText(value: string) {
  return ` [Note: ${value.replace(/\s+/g, " ").trim()}] `;
}
