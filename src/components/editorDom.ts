import type { Annotation, Patch, TextRange } from "@/types/essaycraft";
import { LABELS } from "@/lib/labels";
import { stripEditorKernelMarkers } from "@/lib/noteKernel";

export type InlinePatchEditorState = {
  range: TextRange;
  anchorQuote: string;
  initialValue: string;
  editingPatchId: string | null;
};

export function renderEditorContent(root: HTMLElement, options: {
  text: string;
  annotations: Annotation[];
  patches: Patch[];
  activeSentenceRange?: TextRange;
  patchEditor?: InlinePatchEditorState;
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
    ? Math.min(text.length, Math.max(0, inlineEditorOffset(patchEditor.range)))
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
  token.dataset.inlineNoteOffset = String(noteOffset(patch));
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
  editor.dataset.inlineNoteEditorOffset = String(inlineEditorOffset(options.range));
  editor.className = "inline-note-editor";
  editor.contentEditable = "false";
  editor.title = compactAnchor(options.anchorQuote) || `cursor ${options.range.start}`;

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
  input.rows = 1;
  input.spellcheck = true;
  input.setAttribute("aria-label", options.editingPatchId ? "Edit note" : "Add note");
  input.addEventListener("input", () => {
    options.onDraftChange(input.value);
    autosizeInlineNoteInput(input);
  });

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
  requestAnimationFrame(() => autosizeInlineNoteInput(input));
  return editor;
}

export function serializeEditorDom(root: HTMLElement, currentPatches: Patch[]): { text: string; patches: Patch[] } {
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

export function textRangeFromDomSelection(root: HTMLElement): TextRange {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return { start: 0, end: 0 };
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return { start: 0, end: 0 };
  const start = offsetFromDomPosition(root, range.startContainer, range.startOffset);
  const end = offsetFromDomPosition(root, range.endContainer, range.endOffset);
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

function offsetFromDomPosition(root: HTMLElement, container: Node, offset: number) {
  const inlineHost = inlineNoteHostForNode(root, container);
  if (inlineHost) return inlineHostOffset(inlineHost);

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

function inlineNoteHostForNode(root: HTMLElement, node: Node) {
  if (node === root) return null;
  const element = node instanceof HTMLElement ? node : node.parentElement;
  const host = element?.closest<HTMLElement>("[data-inline-note-id], [data-inline-note-editor]");
  return host && root.contains(host) ? host : null;
}

function inlineHostOffset(host: HTMLElement) {
  const raw = host.dataset.inlineNoteOffset ?? host.dataset.inlineNoteEditorOffset;
  const value = raw ? Number(raw) : 0;
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function setDomSelectionFromTextRange(root: HTMLElement, range: TextRange) {
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

export function selectionTouchesEditor(editor: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return false;
  const range = selection.getRangeAt(0);
  return editor.contains(range.startContainer) || editor.contains(range.endContainer);
}

export function activeElementInInlineNoteEditor() {
  const active = document.activeElement;
  return active instanceof HTMLElement && Boolean(active.closest("[data-inline-note-editor]"));
}

export function noteEditorKey(patchEditor: InlinePatchEditorState) {
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

export function friendlyAnnotationComment(comment: string | undefined, fallback: string) {
  if (!comment) return fallback;
  if (/local fallback|provider|confidence/i.test(comment)) return fallback;
  return comment;
}

function noteOffset(patch: Patch) {
  return patch.anchorEnd > patch.anchorStart ? patch.anchorEnd : patch.anchorStart;
}

function inlineEditorOffset(range: TextRange) {
  return range.end > range.start ? range.end : range.start;
}

export function autosizeInlineNoteInput(input: HTMLTextAreaElement) {
  input.style.height = "0px";
  const maxHeight = 96;
  const nextHeight = Math.min(maxHeight, Math.max(22, input.scrollHeight));
  input.style.height = `${nextHeight}px`;
  input.style.overflowY = input.scrollHeight > maxHeight ? "auto" : "hidden";
}

export function sameRange(a: TextRange, b: TextRange) {
  return a.start === b.start && a.end === b.end;
}

export function sameOptionalRange(a: TextRange | undefined, b: TextRange | undefined) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return sameRange(a, b);
}
