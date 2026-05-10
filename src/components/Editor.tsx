"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import type { Annotation, Patch, TextRange } from "@/types/essaycraft";
import { LABELS } from "@/lib/labels";
import { annotationAtOffset, sentenceRangeAt } from "@/lib/annotations";
import { countCharacters, countWords } from "@/lib/sentence";
import { stripEditorKernelMarkers } from "@/lib/noteKernel";
import {
  activeElementInInlineNoteEditor,
  autosizeInlineNoteInput,
  noteEditorKey,
  renderEditorContent,
  sameOptionalRange,
  sameRange,
  serializeEditorDom,
  selectionTouchesEditor,
  setDomSelectionFromTextRange,
  textRangeFromDomSelection,
  friendlyAnnotationComment,
  type InlinePatchEditorState
} from "./editorDom";

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
  patchEditor?: InlinePatchEditorState;
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
  const lastResetKeyRef = useRef(resetKey);
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
    const shouldResetViewport = lastResetKeyRef.current !== resetKey;
    lastResetKeyRef.current = resetKey;
    const previousScrollTop = shouldResetViewport ? 0 : editor.scrollTop;
    const restoreEditorScroll = () => {
      const maxScrollTop = Math.max(0, editor.scrollHeight - editor.clientHeight);
      editor.scrollTop = Math.max(0, Math.min(previousScrollTop, maxScrollTop));
    };
    const currentPatchEditor = patchEditorRef.current;
    const shouldRestoreEditorSelection = document.activeElement === editor || selectionTouchesEditor(editor);
    const restoreRange = shouldResetViewport
      ? { start: 0, end: 0 }
      : pendingSelectionRef.current ?? (shouldRestoreEditorSelection ? textRangeFromDomSelection(editor) : null);
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
      restoreEditorScroll();
      requestAnimationFrame(() => {
        if (!input) return;
        autosizeInlineNoteInput(input);
        input.focus({ preventScroll: true });
        if (noteInputSelection?.key === patchEditorKey) {
          const start = Math.max(0, Math.min(input.value.length, noteInputSelection.start));
          const end = Math.max(start, Math.min(input.value.length, noteInputSelection.end));
          input.setSelectionRange(start, end, noteInputSelection.direction);
        } else if (!patchEditorDraftValue) {
          input.select();
        }
        restoreEditorScroll();
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
    patchEditorSignature,
    resetKey
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
