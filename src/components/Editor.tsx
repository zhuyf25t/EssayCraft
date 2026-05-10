"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import type { Annotation, Patch, TextRange } from "@/types/essaycraft";
import { LABELS } from "@/lib/labels";
import { annotationAtOffset, sentenceRangeAt } from "@/lib/annotations";
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
  const editorRef = useRef<HTMLDivElement>(null);
  const pendingSelectionRef = useRef<TextRange | null>(null);
  const composingRef = useRef(false);
  const noteDraftRef = useRef<{ key: string; value: string } | null>(null);
  const patchEditorRef = useRef(patchEditor);
  patchEditorRef.current = patchEditor;
  const callbacksRef = useRef({
    onPatchMarkerClick,
    onPatchDelete,
    onPatchSubmit,
    onPatchClose
  });
  callbacksRef.current = {
    onPatchMarkerClick,
    onPatchDelete,
    onPatchSubmit,
    onPatchClose
  };

  const activeAnnotation = useMemo(
    () => annotationAtOffset(annotations, selectedRange.start),
    [annotations, selectedRange.start]
  );
  const patchEditorSignature = patchEditor
    ? [
        patchEditor.editingPatchId ?? "new",
        patchEditor.range.start,
        patchEditor.range.end,
        patchEditor.anchorQuote,
        patchEditor.initialValue
      ].join("|")
    : "none";

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const syncNativeSelection = () => {
      if (activeElementInInlineNoteEditor()) return;
      if (!editor.contains(document.activeElement) && !selectionTouchesEditor(editor)) return;
      syncSelectionFromDom();
    };
    document.addEventListener("selectionchange", syncNativeSelection);
    return () => document.removeEventListener("selectionchange", syncNativeSelection);
  });

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.scrollTop = 0;
    onSelectionChange({ start: 0, end: 0 });
    onActiveSentenceChange(undefined);
    pendingSelectionRef.current = { start: 0, end: 0 };
  }, [resetKey, onSelectionChange, onActiveSentenceChange]);

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const previousScrollTop = editor.scrollTop;
    const restoreEditorScroll = () => {
      const maxScrollTop = Math.max(0, editor.scrollHeight - editor.clientHeight);
      editor.scrollTop = Math.max(0, Math.min(previousScrollTop, maxScrollTop));
    };
    const currentPatchEditor = patchEditorRef.current;
    const shouldRestoreEditorSelection = document.activeElement === editor || selectionTouchesEditor(editor);
    const restoreRange = pendingSelectionRef.current ?? (shouldRestoreEditorSelection ? textRangeFromDomSelection(editor) : null);
    const patchEditorKey = currentPatchEditor ? noteEditorKey(currentPatchEditor) : null;
    const existingNoteInput = currentPatchEditor
      ? editor.querySelector<HTMLTextAreaElement>("[data-inline-note-input]")
      : null;
    const noteInputSelection = existingNoteInput && patchEditorKey
      ? {
          key: patchEditorKey,
          value: existingNoteInput.value,
          start: existingNoteInput.selectionStart,
          end: existingNoteInput.selectionEnd,
          direction: existingNoteInput.selectionDirection
        }
      : null;

    if (currentPatchEditor && patchEditorKey) {
      if (noteInputSelection?.key === patchEditorKey) {
        noteDraftRef.current = { key: patchEditorKey, value: noteInputSelection.value };
      } else if (noteDraftRef.current?.key !== patchEditorKey) {
        noteDraftRef.current = { key: patchEditorKey, value: currentPatchEditor.initialValue };
      }
    } else {
      noteDraftRef.current = null;
    }
    const patchEditorDraftValue = currentPatchEditor && patchEditorKey
      ? noteDraftRef.current?.value ?? currentPatchEditor.initialValue
      : "";

    renderEditorContent(editor, {
      text,
      annotations,
      patches,
      activeSentenceRange,
      patchEditor: currentPatchEditor && patchEditorKey
        ? { ...currentPatchEditor, initialValue: patchEditorDraftValue }
        : undefined,
      onPatchMarkerClick: (patch) => callbacksRef.current.onPatchMarkerClick(patch),
      onPatchDelete: (patchId) => callbacksRef.current.onPatchDelete(patchId),
      onPatchSubmit: (value) => callbacksRef.current.onPatchSubmit(value),
      onPatchClose: () => callbacksRef.current.onPatchClose(),
      onPatchDraftChange: (value) => {
        if (patchEditorKey) noteDraftRef.current = { key: patchEditorKey, value };
      }
    });

    if (currentPatchEditor) {
      const input = editor.querySelector<HTMLTextAreaElement>("[data-inline-note-input]");
      requestAnimationFrame(() => {
        if (!input) return;
        input.focus();
        if (noteInputSelection?.key === patchEditorKey) {
          const start = Math.max(0, Math.min(input.value.length, noteInputSelection.start));
          const end = Math.max(start, Math.min(input.value.length, noteInputSelection.end));
          input.setSelectionRange(start, end, noteInputSelection.direction);
        } else if (!patchEditorDraftValue) {
          input.select();
        }
      });
      pendingSelectionRef.current = null;
      return;
    }

    restoreEditorScroll();

    if (restoreRange && shouldRestoreEditorSelection) {
      pendingSelectionRef.current = null;
      setDomSelectionFromTextRange(editor, restoreRange);
      restoreEditorScroll();
    }
    requestAnimationFrame(restoreEditorScroll);
  }, [
    text,
    annotations,
    patches,
    activeSentenceRange,
    patchEditorSignature
  ]);

  function syncSelectionFromDom() {
    const editor = editorRef.current;
    if (!editor || activeElementInInlineNoteEditor()) return;
    const range = textRangeFromDomSelection(editor);
    const serialized = serializeEditorDom(editor, patches);
    const sourceText = serialized.text;
    if (sourceText !== text) {
      pendingSelectionRef.current = range;
      onTextChange(sourceText, serialized.patches);
    }
    if (!sameRange(range, selectedRange)) onSelectionChange(range);
    if (range.end > range.start) {
      if (activeSentenceRange) onActiveSentenceChange(undefined);
      return;
    }
    const sentence = sentenceRangeAt(sourceText, range.start, range.end);
    const nextSentence = sentence.end > sentence.start ? sentence : undefined;
    if (!sameOptionalRange(nextSentence, activeSentenceRange)) onActiveSentenceChange(nextSentence);
  }

  function handleInput(event: FormEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("[data-inline-note-editor]")) return;
    if (composingRef.current) return;
    commitDomChange();
  }

  function commitDomChange() {
    const editor = editorRef.current;
    if (!editor) return;
    const range = textRangeFromDomSelection(editor);
    pendingSelectionRef.current = range;
    const serialized = serializeEditorDom(editor, patches);
    onTextChange(serialized.text, serialized.patches);
  }

  function insertPlainText(value: string) {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const textNode = document.createTextNode(value);
    range.insertNode(textNode);
    range.setStart(textNode, value.length);
    range.setEnd(textNode, value.length);
    selection.removeAllRanges();
    selection.addRange(range);
    commitDomChange();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.nativeEvent.isComposing || (event.target as HTMLElement).closest("[data-inline-note-editor]")) return;
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      const range = textRangeFromDomSelection(event.currentTarget);
      onSelectionChange(range);
      onOpenPatch(range);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      insertPlainText("\n\n");
      return;
    }
    if (event.key === " ") {
      event.preventDefault();
      insertPlainText(" ");
    }
  }

  function copyCleanSelection(event: ClipboardEvent<HTMLDivElement>, shouldCut = false) {
    if ((event.target as HTMLElement).closest("[data-inline-note-editor]")) return;
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount || !selectionTouchesEditor(editor)) return;
    const range = textRangeFromDomSelection(editor);
    if (range.end <= range.start) return;
    const cleanText = serializeEditorDom(editor, patches).text.slice(range.start, range.end);
    event.preventDefault();
    event.clipboardData.setData("text/plain", cleanText);
    if (shouldCut) insertPlainText("");
  }

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
        <div
          ref={editorRef}
          data-testid="editor-textarea"
          role="textbox"
          aria-multiline="true"
          contentEditable
          suppressContentEditableWarning
          spellCheck
          className="editor-content"
          onBeforeInput={(event) => {
            const native = event.nativeEvent as InputEvent;
            if (native.isComposing || composingRef.current || (event.target as HTMLElement).closest("[data-inline-note-editor]")) return;
            if (native.inputType === "insertText" && native.data) {
              event.preventDefault();
              insertPlainText(native.data);
            }
          }}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={() => {
            composingRef.current = false;
            requestAnimationFrame(commitDomChange);
          }}
          onInput={handleInput}
          onClick={syncSelectionFromDom}
          onKeyUp={syncSelectionFromDom}
          onCopy={(event) => copyCleanSelection(event)}
          onCut={(event) => copyCleanSelection(event, true)}
          onPaste={(event) => {
            if ((event.target as HTMLElement).closest("[data-inline-note-editor]")) return;
            event.preventDefault();
            insertPlainText(stripEditorKernelMarkers(event.clipboardData.getData("text/plain")));
          }}
          onKeyDown={handleKeyDown}
        />
      </div>

      <div className="editor-footer">
        <span>Paragraphs are stored as plain text with blank lines.</span>
      </div>
    </section>
  );
}

function renderEditorContent(root: HTMLElement, options: {
  text: string;
  annotations: Annotation[];
  patches: Patch[];
  activeSentenceRange?: TextRange;
  patchEditor?: {
    range: TextRange;
    anchorQuote: string;
    initialValue: string;
    editingPatchId: string | null;
  };
  onPatchMarkerClick: (patch: Patch) => void;
  onPatchDelete: (patchId: string) => void;
  onPatchSubmit: (text: string) => void;
  onPatchClose: () => void;
  onPatchDraftChange: (text: string) => void;
}) {
  const { text, annotations, patches, activeSentenceRange, patchEditor } = options;
  root.dataset.cleanText = text;
  root.replaceChildren();

  const sorted = annotations
    .filter((annotation) => {
      if (annotation.end <= annotation.start || annotation.start < 0 || annotation.end > text.length) return false;
      const segment = text.slice(annotation.start, annotation.end);
      return segment === annotation.text && segment.trim().length > 0;
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const openPatches = patches
    .filter((patch) => !patch.resolved && !patch.stale && stripEditorKernelMarkers(patch.text).trim() && patch.anchorStart >= 0 && patch.anchorStart <= text.length && patch.anchorEnd >= patch.anchorStart && patch.anchorEnd <= text.length)
    .sort((a, b) => noteOffset(a) - noteOffset(b) || a.createdAt.localeCompare(b.createdAt));

  const notesByOffset = new Map<number, Patch[]>();
  for (const patch of openPatches) {
    if (patchEditor?.editingPatchId === patch.id) continue;
    const offset = Math.min(text.length, Math.max(0, noteOffset(patch)));
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
    points.add(noteOffset(patch));
  }
  if (patchEditorOffset !== undefined) points.add(patchEditorOffset);
  if (activeSentenceRange) {
    points.add(activeSentenceRange.start);
    points.add(activeSentenceRange.end);
  }

  const appendNotesAt = (offset: number) => {
    const notes = notesByOffset.get(offset);
    if (!notes?.length) return;
    for (const patch of notes) {
      root.appendChild(createNoteToken(patch, options.onPatchMarkerClick, options.onPatchDelete));
    }
  };

  const appendPatchEditorAt = (offset: number) => {
    if (!patchEditor || patchEditorOffset !== offset) return;
    root.appendChild(createInlinePatchEditor({
      ...patchEditor,
      onSubmit: options.onPatchSubmit,
      onClose: options.onPatchClose,
      onDraftChange: options.onPatchDraftChange,
      onDelete: patchEditor.editingPatchId ? () => options.onPatchDelete(patchEditor.editingPatchId!) : undefined
    }));
  };

  const ordered = [...points].sort((a, b) => a - b);
  appendNotesAt(0);
  appendPatchEditorAt(0);

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
    root.appendChild(createTextSegment(segment, className));
    appendNotesAt(end);
    appendPatchEditorAt(end);
  }

  if (!root.childNodes.length) root.appendChild(document.createTextNode(text || " "));
}

function createTextSegment(segment: string, className: string) {
  if (!className) return document.createTextNode(segment);
  const mark = document.createElement("mark");
  mark.className = className;
  mark.textContent = segment;
  return mark;
}

function createNoteToken(patch: Patch, onPatchMarkerClick: (patch: Patch) => void, onPatchDelete: (patchId: string) => void) {
  const noteText = stripEditorKernelMarkers(patch.text).trim();
  const token = document.createElement("span");
  token.dataset.inlineNoteId = patch.id;
  token.dataset.noteText = noteText;
  token.dataset.testid = "patch-margin-marker";
  token.className = "inline-note-token";
  token.title = noteText;
  token.contentEditable = "false";

  const icon = document.createElement("span");
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = String.fromCodePoint(0x1f4dd);

  const label = document.createElement("span");
  label.dataset.testid = "patch-marker";
  label.className = "inline-note-label";
  label.textContent = compactNote(noteText);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "inline-note-remove";
  remove.setAttribute("aria-label", "Delete note");
  remove.textContent = "x";

  token.addEventListener("mousedown", (event) => event.preventDefault());
  token.addEventListener("click", (event) => {
    event.stopPropagation();
    onPatchMarkerClick(patch);
  });
  remove.addEventListener("click", (event) => {
    event.stopPropagation();
    onPatchDelete(patch.id);
  });

  token.append(icon, label, remove);
  return token;
}

function createInlinePatchEditor(options: {
  range: TextRange;
  anchorQuote: string;
  initialValue: string;
  editingPatchId: string | null;
  onSubmit: (text: string) => void;
  onClose: () => void;
  onDraftChange: (text: string) => void;
  onDelete?: () => void;
}) {
  const editor = document.createElement("span");
  editor.dataset.testid = "inline-patch-editor";
  editor.dataset.inlineNoteEditor = "true";
  editor.className = "inline-note-editor";
  editor.contentEditable = "false";

  const header = document.createElement("span");
  header.className = "inline-note-editor-header";
  header.textContent = "Note";

  const anchor = document.createElement("span");
  anchor.className = "inline-note-editor-anchor";
  anchor.textContent = compactAnchor(options.anchorQuote) || `cursor ${options.range.start}`;
  header.appendChild(anchor);

  const input = document.createElement("textarea");
  input.dataset.inlineNoteInput = "true";
  input.dataset.testid = "inline-note-input";
  input.value = stripEditorKernelMarkers(options.initialValue);
  input.placeholder = "Add a note for EssayCraft";
  input.className = "inline-note-editor-input";
  input.addEventListener("input", () => options.onDraftChange(input.value));

  const actions = document.createElement("span");
  actions.className = "inline-note-editor-actions";

  const save = document.createElement("button");
  save.type = "button";
  save.className = "inline-note-editor-save";
  save.textContent = "Save";

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "inline-note-editor-cancel";
  cancel.textContent = "Esc";

  const submit = () => {
    const value = input.value.trim();
    if (value) options.onSubmit(value);
    else options.onClose();
  };

  input.addEventListener("keydown", (event) => {
    if (event.isComposing) return;
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      submit();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      options.onClose();
    }
  });
  save.addEventListener("click", submit);
  cancel.addEventListener("click", options.onClose);

  actions.appendChild(save);
  if (options.editingPatchId && options.onDelete) {
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "inline-note-editor-delete";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", options.onDelete);
    actions.appendChild(deleteButton);
  }
  actions.appendChild(cancel);

  editor.append(header, input, actions);
  return editor;
}

function serializeEditorDom(root: HTMLElement, currentPatches: Patch[]): { text: string; patches: Patch[] } {
  const existing = new Map(currentPatches.map((patch) => [patch.id, patch]));
  const resolved = currentPatches.filter((patch) => patch.resolved || patch.stale);
  const patches: Patch[] = [];
  const seenPatchIds = new Set<string>();
  let text = "";

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? "";
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.dataset.inlineNoteEditor === "true") return;
    const noteId = node.dataset.inlineNoteId;
    if (noteId) {
      const noteText = stripEditorKernelMarkers(node.dataset.noteText ?? "").trim();
      const old = existing.get(noteId);
      if (old && noteText) {
        seenPatchIds.add(noteId);
        const anchoredLength = Math.max(0, old.anchorEnd - old.anchorStart);
        patches.push({
          ...old,
          anchorStart: Math.max(0, text.length - anchoredLength),
          anchorEnd: text.length,
          text: noteText,
          status: "open",
          resolved: false,
          stale: false
        });
      }
      return;
    }
    if (node.tagName === "BR") {
      text += "\n";
      return;
    }
    for (const child of Array.from(node.childNodes)) walk(child);
  }

  for (const child of Array.from(root.childNodes)) walk(child);
  const preservedOpenPatches = currentPatches.filter((patch) => (
    !patch.resolved &&
    !patch.stale &&
    !seenPatchIds.has(patch.id) &&
    stripEditorKernelMarkers(patch.text).trim()
  ));
  return { text, patches: [...patches, ...preservedOpenPatches, ...resolved] };
}

function textRangeFromDomSelection(root: HTMLElement): TextRange {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return { start: 0, end: 0 };
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return { start: 0, end: 0 };
  const start = offsetFromDomPosition(root, range.startContainer, range.startOffset);
  const end = offsetFromDomPosition(root, range.endContainer, range.endOffset);
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

function offsetFromDomPosition(root: HTMLElement, container: Node, offset: number) {
  let count = 0;
  let found = false;

  function nodeLength(node: Node): number {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent?.length ?? 0;
    if (node instanceof HTMLElement && (node.dataset.inlineNoteId || node.dataset.inlineNoteEditor)) return 0;
    return Array.from(node.childNodes).reduce((sum, child) => sum + nodeLength(child), 0);
  }

  function walk(node: Node) {
    if (found) return;
    if (node === container) {
      if (node.nodeType === Node.TEXT_NODE) {
        count += Math.max(0, Math.min(offset, node.textContent?.length ?? 0));
      } else {
        const children = Array.from(node.childNodes).slice(0, offset);
        count += children.reduce((sum, child) => sum + nodeLength(child), 0);
      }
      found = true;
      return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      count += node.textContent?.length ?? 0;
      return;
    }
    if (node instanceof HTMLElement && (node.dataset.inlineNoteId || node.dataset.inlineNoteEditor)) return;
    for (const child of Array.from(node.childNodes)) walk(child);
  }

  walk(root);
  return count;
}

function setDomSelectionFromTextRange(root: HTMLElement, range: TextRange) {
  const start = domPositionForOffset(root, range.start);
  const end = domPositionForOffset(root, range.end);
  const selection = window.getSelection();
  if (!selection || !start || !end) return;
  const domRange = document.createRange();
  domRange.setStart(start.node, start.offset);
  domRange.setEnd(end.node, end.offset);
  selection.removeAllRanges();
  selection.addRange(domRange);
}

function domPositionForOffset(root: HTMLElement, target: number): { node: Node; offset: number } | null {
  let count = 0;
  let fallback: { node: Node; offset: number } = { node: root, offset: root.childNodes.length };

  function walk(node: Node): { node: Node; offset: number } | null {
    if (node.nodeType === Node.TEXT_NODE) {
      const length = node.textContent?.length ?? 0;
      if (target <= count + length) return { node, offset: Math.max(0, target - count) };
      count += length;
      fallback = { node, offset: length };
      return null;
    }
    if (node instanceof HTMLElement && (node.dataset.inlineNoteId || node.dataset.inlineNoteEditor)) return null;
    for (const child of Array.from(node.childNodes)) {
      const result = walk(child);
      if (result) return result;
    }
    return null;
  }

  return walk(root) ?? fallback;
}

function selectionTouchesEditor(editor: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return false;
  const range = selection.getRangeAt(0);
  return editor.contains(range.startContainer) || editor.contains(range.endContainer);
}

function activeElementInInlineNoteEditor() {
  const active = document.activeElement;
  return active instanceof HTMLElement && Boolean(active.closest("[data-inline-note-editor]"));
}

function noteEditorKey(patchEditor: NonNullable<EditorProps["patchEditor"]>) {
  return `${patchEditor.editingPatchId ?? "new"}:${patchEditor.range.start}:${patchEditor.range.end}`;
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

function noteOffset(patch: Patch) {
  return patch.anchorEnd > patch.anchorStart ? patch.anchorEnd : patch.anchorStart;
}

function sameRange(a: TextRange, b: TextRange) {
  return a.start === b.start && a.end === b.end;
}

function sameOptionalRange(a: TextRange | undefined, b: TextRange | undefined) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return sameRange(a, b);
}
