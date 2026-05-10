"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AssistantPanel } from "@/components/AssistantPanel";
import { Editor } from "@/components/Editor";
import { FinishModal } from "@/components/FinishModal";
import { ModuleSidebar } from "@/components/ModuleSidebar";
import { ProgressTracker } from "@/components/ProgressTracker";
import { SnapshotPanel } from "@/components/SnapshotPanel";
import { SourceWorkbench } from "@/components/SourceWorkbench";
import { Toolbar } from "@/components/Toolbar";
import { TranslateModal } from "@/components/TranslateModal";
import { annotationAtOffset, normalizeAnnotations, normalizeText, sentenceRangeAt } from "@/lib/annotations";
import { inTextCitationPreview } from "@/lib/citationAudit";
import { copyRichText, downloadCurrentModuleHtml, downloadProjectJson } from "@/lib/export";
import { protectModuleText, stripEditorKernelMarkers } from "@/lib/noteKernel";
import { patchAtOffset, repairPatchesForText } from "@/lib/patches";
import { MODULE_TITLES, addSnapshot, clearModule, importProject, replaceModuleContent, restoreSnapshot } from "@/lib/project";
import { generateNextRequestSchema, generateNextResponseSchema } from "@/lib/schemas";
import { loadProject, resetProjectStorage, saveProject } from "@/lib/storage";
import { clampModule, id, nowIso } from "@/lib/utils";
import type {
  AssistantMessage,
  AssistResponse,
  GenerateNextResponse,
  ModuleDocument,
  ModuleNumber,
  Patch,
  Project,
  RefreshResponse,
  Snapshot,
  SourceCard,
  TextRange,
  TranslateResponse
} from "@/types/essaycraft";

const EMPTY_RANGE: TextRange = { start: 0, end: 0 };
type TranslateMode = "en-to-zh" | "zh-to-en" | "auto-to-zh";
type RightTab = "assistant" | "sources" | "snapshots" | "export";

type LastAction = {
  tone: "info" | "success" | "error" | "warning";
  message: string;
  details?: string[];
  retryGenerate?: boolean;
};

type AssistIntent = "chat" | "edit" | "inspect";

type AiUndoEntry = {
  id: string;
  moduleNumber: ModuleNumber;
  doc: ModuleDocument;
  label: string;
  createdAt: string;
};

export default function Home() {
  const [project, setProject] = useState<Project | null>(null);
  const [selectedRange, setSelectedRange] = useState<TextRange>(EMPTY_RANGE);
  const [activeSentenceRange, setActiveSentenceRange] = useState<TextRange | undefined>();
  const [patchRange, setPatchRange] = useState<TextRange | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [lastAction, setLastAction] = useState<LastAction>({ tone: "info", message: "Ready" });
  const [finishOpen, setFinishOpen] = useState(false);
  const [assistantSuggestion, setAssistantSuggestion] = useState<AssistResponse | undefined>();
  const [translateOpen, setTranslateOpen] = useState(false);
  const [translatePreview, setTranslatePreview] = useState<TranslateResponse | undefined>();
  const [translateMode, setTranslateMode] = useState<TranslateMode>("en-to-zh");
  const [editorResetKey, setEditorResetKey] = useState(0);
  const [rightTab, setRightTab] = useState<RightTab>("assistant");
  const [editingPatchId, setEditingPatchId] = useState<string | null>(null);
  const [assistantModeRequest, setAssistantModeRequest] = useState<{ mode: "chat" | "edit"; id: number }>({ mode: "chat", id: 0 });
  const [revisionPreview, setRevisionPreview] = useState<RefreshResponse | undefined>();
  const [refreshResult, setRefreshResult] = useState<RefreshResponse | undefined>();
  const [busyAction, setBusyAction] = useState<"generate" | "refresh" | "assist" | "translate" | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [undoStack, setUndoStack] = useState<AiUndoEntry[]>([]);
  const editorAiUndoReadyRef = useRef(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const currentModuleNumber = project?.currentModule;

  useEffect(() => {
    setProject(loadProject());
  }, []);

  useEffect(() => {
    if (project) saveProject(project);
  }, [project]);

  useEffect(() => {
    if (!status || status === "Ready") {
      setToastVisible(false);
      return;
    }
    setToastVisible(true);
    const timeout = window.setTimeout(() => setToastVisible(false), undoStack.length ? 6000 : 2800);
    return () => window.clearTimeout(timeout);
  }, [status, undoStack.length]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;
      if (!undoStack.length || !editorAiUndoReadyRef.current) return;
      event.preventDefault();
      const entry = undoStack.at(-1);
      if (!entry) return;
      setProject((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          currentModule: entry.moduleNumber,
          modules: {
            ...prev.modules,
            [entry.moduleNumber]: cloneModuleDocument(entry.doc)
          },
          updatedAt: nowIso()
        };
      });
      setUndoStack((prev) => prev.slice(0, -1));
      editorAiUndoReadyRef.current = undoStack.length > 1;
      setSelectedRange(EMPTY_RANGE);
      setActiveSentenceRange(undefined);
      setAssistantSuggestion(undefined);
      setRevisionPreview(undefined);
      setRefreshResult(undefined);
      setEditorResetKey((value) => value + 1);
      setStatus("Undid last AI edit.");
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undoStack]);

  useEffect(() => {
    if (!currentModuleNumber) return;
    if (currentModuleNumber === 5) setRightTab("sources");
    else if (currentModuleNumber === 6) setRightTab("export");
    else setRightTab("assistant");
  }, [currentModuleNumber]);

  const currentDoc = project ? project.modules[project.currentModule] : null;
  const selectedText = useMemo(() => {
    if (!currentDoc) return "";
    return currentDoc.text.slice(selectedRange.start, selectedRange.end);
  }, [currentDoc, selectedRange]);

  const patchQuote = currentDoc && patchRange ? currentDoc.text.slice(patchRange.start, patchRange.end) : "";
  const translateSourceText = currentDoc ? selectedText || currentDoc.text : "";
  const activeSentenceText = currentDoc && activeSentenceRange ? currentDoc.text.slice(activeSentenceRange.start, activeSentenceRange.end) : "";
  const editRange = selectedRange.end > selectedRange.start ? selectedRange : activeSentenceRange;
  const activeOffset = selectedRange.end > selectedRange.start ? selectedRange.start : activeSentenceRange?.start ?? selectedRange.start;
  const hasEditorContext = selectedRange.end > selectedRange.start || Boolean(activeSentenceRange) || selectedRange.start > 0;
  const activeAnnotation = currentDoc && hasEditorContext ? annotationAtOffset(currentDoc.annotations, activeOffset) : undefined;
  const activePatch = currentDoc && hasEditorContext ? patchAtOffset(currentDoc.patches, activeOffset) : undefined;
  const activePatchCount = currentDoc && editRange
    ? currentDoc.patches.filter((patch) => !patch.resolved && rangesOverlap(patch.anchorStart, patch.anchorEnd, editRange.start, editRange.end)).length
    : 0;
  const openPatches = currentDoc?.patches.filter((patch) => patch.status !== "resolved" && !patch.resolved && !patch.stale && patch.text.trim()) ?? [];

  if (!project || !currentDoc) {
    return <main className="flex min-h-screen items-center justify-center text-slate-500">Loading EssayCraft...</main>;
  }

  const activeProject = project;
  const activeDoc = currentDoc;
  const moduleOneQuestion = extractModuleOneQuestion(activeProject.modules[1].text);
  const titleQuestionMismatch = differsMeaningfully(activeProject.title, moduleOneQuestion);

  function updateProject(updater: (prev: Project) => Project) {
    setProject((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      return { ...next, updatedAt: nowIso() };
    });
  }

  function updateCurrentModule(updater: (doc: ModuleDocument) => ModuleDocument) {
    updateProject((prev) => {
      const doc = prev.modules[prev.currentModule];
      return {
        ...prev,
        modules: {
          ...prev.modules,
          [prev.currentModule]: updater(doc)
        }
      };
    });
  }

  function appendAssistantHistory(messages: Array<Omit<AssistantMessage, "id" | "createdAt">>) {
    updateProject((prev) => ({
      ...prev,
      assistantHistory: [
        ...prev.assistantHistory,
        ...messages.map((message) => ({
          ...message,
          id: id("msg"),
          createdAt: nowIso()
        }))
      ].slice(-40)
    }));
  }

  function resetEditorViewport() {
    setEditorResetKey((value) => value + 1);
  }

  function requestAssistantMode(mode: "chat" | "edit") {
    setAssistantModeRequest((request) => ({ mode, id: request.id + 1 }));
  }

  function pushAiUndo(moduleNumber: ModuleNumber, doc: ModuleDocument, label: string) {
    setUndoStack((prev) => [
      ...prev.slice(-9),
      {
        id: id("undo"),
        moduleNumber,
        doc: cloneModuleDocument(doc),
        label,
        createdAt: nowIso()
      }
    ]);
    editorAiUndoReadyRef.current = true;
  }

  function undoLastAiEdit() {
    const entry = undoStack.at(-1);
    if (!entry) return;
    setProject((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        currentModule: entry.moduleNumber,
        modules: {
          ...prev.modules,
          [entry.moduleNumber]: cloneModuleDocument(entry.doc)
        },
        updatedAt: nowIso()
      };
    });
    setUndoStack((prev) => prev.slice(0, -1));
    editorAiUndoReadyRef.current = undoStack.length > 1;
    setSelectedRange(EMPTY_RANGE);
    setActiveSentenceRange(undefined);
    setAssistantSuggestion(undefined);
    setRevisionPreview(undefined);
    resetEditorViewport();
    setStatus("Undid last AI edit.");
  }

  function handleTextChange(value: string, nextPatches?: Patch[]) {
    const text = protectModuleText(normalizeText(value));
    editorAiUndoReadyRef.current = false;
    updateCurrentModule((doc) => ({
      ...doc,
      text,
      annotations: normalizeAnnotations(text, doc.annotations),
      patches: nextPatches ? repairPatchesForText(text, nextPatches) : repairPatchesForText(text, doc.patches),
      updatedAt: nowIso()
    }));
    setRevisionPreview(undefined);
    setRefreshResult(undefined);
    setStatus("Auto-saved. Refresh if highlights need updating.");
  }

  function handleOpenPatch(range: TextRange) {
    const requestedRange = range.end > range.start
      ? range
      : selectedRange.end > selectedRange.start
        ? selectedRange
        : range;
    const start = Math.max(0, Math.min(activeDoc.text.length, requestedRange.start));
    const end = Math.max(start, Math.min(activeDoc.text.length, requestedRange.end));
    const nextRange = { start, end };
    setEditingPatchId(null);
    setPatchRange(nextRange);
    setSelectedRange(nextRange);
    setActiveSentenceRange(end > start ? nextRange : sentenceRangeAt(activeDoc.text, start, end));
  }

  function handlePatchSubmit(text: string) {
    if (!patchRange) return;
    const noteText = stripEditorKernelMarkers(text).trim();
    if (!noteText) {
      setEditingPatchId(null);
      setPatchRange(null);
      return;
    }
    if (editingPatchId) {
      updateCurrentModule((doc) => ({
        ...doc,
        patches: doc.patches.map((patch) => patch.id === editingPatchId ? { ...patch, text: noteText, resolved: false, status: "open", stale: false, updatedAt: nowIso() } : patch),
        updatedAt: nowIso()
      }));
      setStatus("Note updated.");
    } else {
      const patch: Patch = {
        id: id("patch"),
        moduleNumber: activeProject.currentModule,
        anchorStart: patchRange.start,
        anchorEnd: patchRange.end,
        anchorQuote: activeDoc.text.slice(patchRange.start, patchRange.end),
        text: noteText,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        status: "open",
        resolved: false,
        stale: false
      };
      updateCurrentModule((doc) => ({
        ...doc,
        patches: [patch, ...doc.patches],
        updatedAt: nowIso()
      }));
      setStatus("Note saved. Apply notes or ask the assistant to use it.");
    }
    setEditingPatchId(null);
    setPatchRange(null);
  }

  function editPatch(patch: Patch) {
    setSelectedRange({ start: patch.anchorStart, end: patch.anchorEnd });
    setActiveSentenceRange({ start: patch.anchorStart, end: patch.anchorEnd });
    setPatchRange({ start: patch.anchorStart, end: patch.anchorEnd });
    setEditingPatchId(patch.id);
  }

  function deletePatch(patchId: string) {
    updateCurrentModule((doc) => ({
      ...doc,
      patches: doc.patches.filter((patch) => patch.id !== patchId),
      updatedAt: nowIso()
    }));
    setPatchRange(null);
    setEditingPatchId(null);
    setStatus("Note deleted.");
  }

  async function handleRefresh() {
    if (!activeDoc.text.trim()) {
      setStatus("Nothing to refresh yet.");
      return;
    }

    setLoading(true);
    setBusyAction("refresh");
    setRefreshResult(undefined);
    try {
      const response = await fetch("/api/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: activeProject.topic,
          projectTitle: activeProject.title,
          moduleNumber: activeProject.currentModule,
          text: activeDoc.text,
          annotations: activeDoc.annotations,
          patches: activeDoc.patches,
          sources: activeDoc.sources
        })
      });

      const data = (await response.json()) as RefreshResponse & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Refresh failed.");

      if (data.kind === "revision" && data.proposedText) {
        const safePlan = (data.patchResolutionPlan ?? []).filter((patchId) => activeDoc.patches.some((patch) => patch.id === patchId));
        setRevisionPreview({ ...data, patchResolutionPlan: safePlan });
        setRefreshResult(undefined);
        setAssistantSuggestion(undefined);
        setRightTab("assistant");
        requestAssistantMode("edit");
        setStatus("Notes preview ready.");
        return;
      }

      updateCurrentModule((doc) => ({
        ...doc,
        annotations: normalizeAnnotations(doc.text, data.annotations),
        globalFeedback: data.globalFeedback,
        updatedAt: nowIso()
      }));
      setRefreshResult({ ...data, kind: data.kind ?? "annotations" });
      setAssistantSuggestion(undefined);
      setRightTab("assistant");
      requestAssistantMode("edit");
      setStatus(data.kind === "moduleReview" && activeProject.currentModule === 6
        ? "Final review ready."
        : data.kind === "moduleReview"
          ? "Citation review ready."
          : data.globalFeedback?.[0] ?? "Highlights refreshed.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Refresh failed.");
    } finally {
      setLoading(false);
      setBusyAction(null);
    }
  }

  async function handleGenerateNext() {
    if (activeProject.currentModule >= 6) {
      setStatus("Module 6 is the final module.");
      setLastAction({ tone: "info", message: "Module 6 is final. Use export or translate actions instead of Generate Next." });
      return;
    }

    const sourceModuleNumber = activeProject.currentModule as Exclude<ModuleNumber, 6>;
    const target = (sourceModuleNumber + 1) as Exclude<ModuleNumber, 1>;
    if (!activeDoc.text.trim()) {
      const message = `Add content to Module ${sourceModuleNumber} before generating Module ${target}.`;
      setStatus(message);
      setLastAction({ tone: "error", message });
      return;
    }

    setLoading(true);
    setBusyAction("generate");
    setStatus(`Generating Module ${target} from Module ${sourceModuleNumber}...`);
    setLastAction({ tone: "info", message: `Generating Module ${target} from Module ${sourceModuleNumber}...` });
    try {
      const payload = generateNextRequestSchema.parse({
        topic: activeProject.topic,
        sourceModuleNumber,
        sourceTitle: activeDoc.title,
        sourceText: activeDoc.text,
        sourceAnnotations: activeDoc.annotations,
        sourcePatches: activeDoc.patches,
        sourceSources: activeDoc.sources
      });
      const response = await fetch("/api/generate-next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const json = (await response.json().catch(() => ({}))) as Partial<GenerateNextResponse> & { error?: string };
      if (!response.ok) throw new Error(json.error ?? `Generate Next failed with HTTP ${response.status}. Restart the dev server if this persists.`);
      const data = generateNextResponseSchema.parse(json);
      if (data.moduleNumber !== target) throw new Error(`Expected Module ${target}, received Module ${data.moduleNumber}.`);
      if (!data.text.trim()) throw new Error("Generate Next returned empty text.");

      const normalizedAnnotations = normalizeAnnotations(data.text, data.annotations);

      setProject((prev) => {
        if (!prev) return prev;
        const sourceDoc = prev.modules[sourceModuleNumber];
        const targetDoc = prev.modules[target];
        const snapTargetDoc = addSnapshot(targetDoc, `Before overwrite from Module ${sourceModuleNumber}`);
        const sources = data.sources.length ? mergeSources(data.sources, snapTargetDoc.sources) : mergeSources(sourceDoc.sources, snapTargetDoc.sources);
        const next = {
          ...prev,
          currentModule: target,
          modules: {
            ...prev.modules,
            [target]: {
              ...replaceModuleContent(snapTargetDoc, data.text, normalizedAnnotations, sources),
              title: data.title || snapTargetDoc.title,
              globalFeedback: data.globalFeedback
            }
          },
          updatedAt: nowIso()
        };
        saveProject(next);
        return next;
      });
      setSelectedRange(EMPTY_RANGE);
      setActiveSentenceRange(undefined);
      setPatchRange(null);
      setAssistantSuggestion(undefined);
      setRevisionPreview(undefined);
      setRefreshResult(undefined);
      resetEditorViewport();
      const message = `Module ${target} generated and opened. Previous Module ${target} saved as a snapshot.`;
      const details = [
        aiModeDetail(data.providerMode),
        ...data.warnings,
        ...(data.globalFeedback ?? [])
      ].filter(Boolean);
      setStatus(message);
      setLastAction({ tone: data.providerMode === "fallback" ? "warning" : "success", message, details });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generate Next failed.";
      setStatus(message);
      setLastAction({ tone: "error", message, details: ["No module was overwritten."], retryGenerate: true });
    } finally {
      setLoading(false);
      setBusyAction(null);
    }
}

function aiModeDetail(mode: GenerateNextResponse["providerMode"]) {
  if (mode === "deepseek") return "AI completed with the live server model.";
  if (mode === "mock") return "AI completed with local demo logic.";
  return "Live AI was unavailable; local demo logic completed the request.";
}

function handleSaveSnapshot() {
    updateCurrentModule((doc) => addSnapshot(doc, "Manual snapshot"));
    setStatus("Snapshot saved.");
  }

  function handleRestoreSnapshot(snapshot: Snapshot) {
    updateCurrentModule((doc) => restoreSnapshot(doc, snapshot));
    setSelectedRange(EMPTY_RANGE);
    setActiveSentenceRange(undefined);
    setStatus("Snapshot restored.");
    resetEditorViewport();
  }

  function switchModule(moduleNumber: ModuleNumber) {
    if (loading) {
      const message = "Finish the current action before switching modules.";
      setStatus(message);
      setLastAction({ tone: "warning", message });
      return;
    }
    updateProject((prev) => ({ ...prev, currentModule: moduleNumber }));
    setSelectedRange(EMPTY_RANGE);
    setActiveSentenceRange(undefined);
    setPatchRange(null);
    setEditingPatchId(null);
    setAssistantSuggestion(undefined);
    setRevisionPreview(undefined);
    setRefreshResult(undefined);
    resetEditorViewport();
    setLastAction({ tone: "info", message: `Viewing Module ${moduleNumber}: ${MODULE_TITLES[moduleNumber]}.` });
  }

  function handleClearModule() {
    if (!window.confirm(`Clear Module ${activeProject.currentModule} content? A snapshot will be saved first.`)) return;
    updateCurrentModule((doc) => clearModule(doc));
    setSelectedRange(EMPTY_RANGE);
    setActiveSentenceRange(undefined);
    setPatchRange(null);
    setEditingPatchId(null);
    setRevisionPreview(undefined);
    setRefreshResult(undefined);
    resetEditorViewport();
    setStatus(`Module ${activeProject.currentModule} cleared. Restore is available from snapshots.`);
  }

  function handleResetDemo() {
    if (!window.confirm("Reset the entire EssayCraft demo? This clears local project data.")) return;
    resetProjectStorage();
    setProject(loadProject());
    setSelectedRange(EMPTY_RANGE);
    setActiveSentenceRange(undefined);
    setPatchRange(null);
    setEditingPatchId(null);
    setAssistantSuggestion(undefined);
    setRevisionPreview(undefined);
    resetEditorViewport();
    setStatus("Demo reset.");
  }

  async function handleCopyRichText() {
    await copyRichText(activeDoc);
    setStatus("Rich text copied with paragraph breaks and highlights.");
  }

  function handleDownloadHtml() {
    if (activeProject.currentModule === 6) {
      setFinishOpen(true);
      return;
    }
    downloadCurrentModuleHtml(activeProject);
    setStatus("HTML downloaded.");
  }

  function handleImportJsonClick() {
    importInputRef.current?.click();
  }

  async function handleImportJson(file: File | undefined) {
    if (!file) return;
    try {
      const text = await file.text();
      const imported = importProject(JSON.parse(text));
      if (!window.confirm(`Import full project JSON "${imported.title}" and replace the entire local EssayCraft project? A JSON backup will download first.`)) return;
      downloadProjectJson(activeProject);
      setProject(imported);
      setSelectedRange(EMPTY_RANGE);
      setActiveSentenceRange(undefined);
      setPatchRange(null);
      setEditingPatchId(null);
      setAssistantSuggestion(undefined);
      setRefreshResult(undefined);
      resetEditorViewport();
      setStatus("Project JSON imported.");
    } catch (error) {
      setStatus(error instanceof Error ? `Import failed: ${error.message}` : "Import failed.");
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  function addSource(source: Omit<SourceCard, "id" | "createdAt">) {
    updateCurrentModule((doc) => ({
      ...doc,
      sources: [{ ...source, id: id("source"), createdAt: nowIso() }, ...doc.sources],
      updatedAt: nowIso()
    }));
    setStatus("Source card added. EssayCraft will not verify it automatically.");
  }

  function toggleSourceVerified(sourceId: string) {
    updateCurrentModule((doc) => ({
      ...doc,
      sources: doc.sources.map((source) => (source.id === sourceId ? { ...source, verified: !source.verified } : source)),
      updatedAt: nowIso()
    }));
  }

  function deleteSource(sourceId: string) {
    updateCurrentModule((doc) => ({
      ...doc,
      sources: doc.sources.filter((source) => source.id !== sourceId),
      updatedAt: nowIso()
    }));
  }

  function addPlaceholderSource() {
    const range = selectedRange.end > selectedRange.start ? selectedRange : sentenceRangeAt(activeDoc.text, selectedRange.start, selectedRange.end);
    const selectedClaim = activeDoc.text.slice(range.start, range.end).trim().replace(/\s+/g, " ");
    const shortClaim = selectedClaim.length > 110 ? `${selectedClaim.slice(0, 107)}...` : selectedClaim;
    addSource({
      title: shortClaim ? `Source needed for: "${shortClaim}"` : "Source needed for selected claim",
      authors: [],
      sourceType: "unknown",
      userNotes: shortClaim
        ? `Evidence need anchored to: "${shortClaim}". Replace this placeholder with real source metadata before final submission.`
        : "Replace this placeholder with real source metadata before final submission.",
      verified: false,
      placeholder: true
    });
  }

  function insertCitation(source: SourceCard) {
    const citation = inTextCitationPreview(source);
    if (!citation) {
      setStatus("Add author and year before inserting an in-text citation.");
      return;
    }
    updateCurrentModule((doc) => {
      const snapDoc = addSnapshot(doc, "Before inserting citation");
      const insertAt = selectedRange.end;
      const marker = findCitationNeededMarker(snapDoc.text, insertAt);
      const needsSpace = insertAt > 0 && !/\s/.test(snapDoc.text[insertAt - 1] ?? "");
      const insertion = `${needsSpace && !marker ? " " : ""}${citation}`;
      const citationStart = marker ? marker.start : insertAt + (needsSpace ? 1 : 0);
      const text = marker
        ? `${snapDoc.text.slice(0, marker.start)}${citation}${snapDoc.text.slice(marker.end)}`
        : `${snapDoc.text.slice(0, insertAt)}${insertion}${snapDoc.text.slice(insertAt)}`;
      return {
        ...snapDoc,
        text,
        annotations: normalizeAnnotations(text, [
          ...snapDoc.annotations,
          {
            id: id("ann"),
            start: citationStart,
            end: citationStart + citation.length,
            text: citation,
            label: "citation",
            confidence: 0.95,
            comment: "In-text citation inserted from a student-supplied source card.",
            sourceIds: [source.id]
          }
        ]),
        patches: repairPatchesForText(text, snapDoc.patches),
        updatedAt: nowIso()
      };
    });
    setStatus(`Inserted ${citation} from your source card. Confirm the matching reference entry before final export.`);
  }

  function markSelectionNeedsCitation() {
    const range = selectedRange.end > selectedRange.start ? selectedRange : sentenceRangeAt(activeDoc.text, selectedRange.start, selectedRange.end);
    updateCurrentModule((doc) => {
      const snapDoc = addSnapshot(doc, "Before marking citation need");
      const marker = " [citation needed]";
      const text = `${snapDoc.text.slice(0, range.end)}${marker}${snapDoc.text.slice(range.end)}`;
      const markerStart = range.end + 1;
      return {
        ...snapDoc,
        text,
        annotations: normalizeAnnotations(text, [
          ...snapDoc.annotations,
          {
            id: id("ann"),
            start: markerStart,
            end: markerStart + "[citation needed]".length,
            text: "[citation needed]",
            label: "issue",
            confidence: 0.95,
            comment: "User marked this passage as needing source support."
          }
        ]),
        patches: repairPatchesForText(text, snapDoc.patches),
        updatedAt: nowIso()
      };
    });
    setStatus("Marked the selected passage as needing a citation.");
  }

  async function handleAssist(action: string, intent: AssistIntent) {
    const hasSelection = selectedRange.end > selectedRange.start;
    const analyzeRequest = /(analy[sz]e|\u5206\u6790|\u8bc4\u4ef7|\u70b9\u8bc4|\u7528\u4e2d\u6587)/i.test(action);
    const requestAction = intent === "edit" && !/(rewrite|academic|analysis|translate|revise|sentence|passage)/i.test(action)
      ? `Revise selected passage: ${action}`
      : action;
    const submittedRange = intent === "chat"
      ? undefined
      : intent === "inspect" && activeAnnotation && !analyzeRequest
        ? { start: activeAnnotation.start, end: activeAnnotation.end }
        : hasSelection
          ? selectedRange
          : activeSentenceRange;
    const submittedText = submittedRange ? activeDoc.text.slice(submittedRange.start, submittedRange.end) : undefined;
    const userMessage: Omit<AssistantMessage, "id" | "createdAt"> = { role: "user", text: action };

    if (intent === "edit" && (!submittedRange || submittedRange.end <= submittedRange.start)) {
      setStatus("Click a sentence or select text before asking for an edit preview.");
      return;
    }

    if (intent === "chat") {
      appendAssistantHistory([userMessage]);
      requestAssistantMode("chat");
    } else {
      setAssistantSuggestion(undefined);
      requestAssistantMode("edit");
    }

    setLoading(true);
    setBusyAction("assist");
    try {
      const response = await fetch("/api/assist", {
        method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
          topic: activeProject.topic,
          projectTitle: activeProject.title,
          moduleNumber: activeProject.currentModule,
          moduleTitle: activeDoc.title,
          text: activeDoc.text,
          annotations: activeDoc.annotations,
          patches: activeDoc.patches,
          sources: activeDoc.sources,
          selectedRange: submittedRange,
          selectedText: submittedText,
          action: requestAction,
          history: intent === "chat"
            ? [...activeProject.assistantHistory, { ...userMessage, id: id("pending"), createdAt: nowIso() }]
            : activeProject.assistantHistory
        })
      });
      const data = (await response.json()) as AssistResponse & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Copilot could not complete that request.");
      const anchoredData = data.replaceRange
        ? { ...data, originalText: activeDoc.text.slice(data.replaceRange.start, data.replaceRange.end) }
        : data;
      setRightTab("assistant");

      if (intent === "chat" || anchoredData.kind === "chat") {
        appendAssistantHistory([{
          role: "assistant",
          text: anchoredData.reply,
          providerMode: anchoredData.providerMode,
          warnings: anchoredData.warnings
        }]);
        setAssistantSuggestion(undefined);
        setRefreshResult(undefined);
        setStatus("Copilot replied.");
      } else {
        setAssistantSuggestion(anchoredData);
        setRefreshResult(undefined);
        setStatus(anchoredData.kind === "inspect" ? "Highlight explanation ready." : "Edit preview ready.");
      }
    } catch (error) {
      const message = "Copilot could not complete that request.";
      if (intent === "chat") {
        appendAssistantHistory([{
          role: "assistant",
          text: `${message} Try again or use local module feedback after refreshing the page.`,
          providerMode: "fallback",
          warnings: [error instanceof Error ? error.message : "Unknown assistant error."]
        }]);
      }
      setStatus(message);
    } finally {
      setLoading(false);
      setBusyAction(null);
    }
  }

  function acceptRevisionPreview() {
    if (!revisionPreview?.proposedText) return;
    if (revisionPreview.sourceText !== undefined && activeDoc.text !== revisionPreview.sourceText) {
      setStatus("Notes preview was blocked because the module changed after the preview was created.");
      return;
    }
    pushAiUndo(activeProject.currentModule, activeDoc, "Before applying notes");
    updateCurrentModule((doc) => {
      const snapDoc = addSnapshot(doc, "Before applying patch notes");
      const text = protectModuleText(normalizeText(revisionPreview.proposedText ?? snapDoc.text));
      const plannedPatchIds = new Set(revisionPreview.patchResolutionPlan ?? []);
      const resolvedPatches = snapDoc.patches.map((patch) => plannedPatchIds.has(patch.id)
        ? { ...patch, resolved: true, status: "resolved" as const, appliedAt: nowIso(), updatedAt: nowIso() }
        : patch);
      return {
        ...snapDoc,
        text,
        annotations: normalizeAnnotations(text, revisionPreview.proposedAnnotations ?? revisionPreview.annotations),
        patches: repairPatchesForText(text, resolvedPatches),
        globalFeedback: revisionPreview.globalFeedback,
        updatedAt: nowIso()
      };
    });
    setRevisionPreview(undefined);
    setRefreshResult({
      kind: "annotations",
      annotations: normalizeAnnotations(protectModuleText(normalizeText(revisionPreview.proposedText ?? activeDoc.text)), revisionPreview.proposedAnnotations ?? revisionPreview.annotations),
      globalFeedback: ["Notes applied and highlights refreshed."],
      warnings: [],
      providerMode: revisionPreview.providerMode
    });
    setRightTab("assistant");
    requestAssistantMode("edit");
    setStatus("Notes applied. Undo is available.");
  }

  function rejectRevisionPreview() {
    setRevisionPreview(undefined);
    setStatus("Notes preview rejected. Text unchanged.");
  }

  function handleApplyAssistant() {
    if (!assistantSuggestion) return;
    if (assistantSuggestion.kind !== "edit") {
      setStatus("This Copilot response is reference-only. Use Selection mode for applyable edits.");
      return;
    }
    const range = assistantSuggestion.replaceRange;
    if (range.start < 0 || range.end <= range.start || range.end > activeDoc.text.length) {
      setStatus("Assistant replacement was blocked because the target selection is no longer valid.");
      return;
    }
    if (assistantSuggestion.originalText !== undefined && activeDoc.text.slice(range.start, range.end) !== assistantSuggestion.originalText) {
      setStatus("Assistant replacement was blocked because the selected text changed after the preview was created.");
      return;
    }
    pushAiUndo(activeProject.currentModule, activeDoc, "Before applying assistant edit");
    updateCurrentModule((doc) => {
      const snapDoc = addSnapshot(doc, "Before applying assistant suggestion");
      const text = protectModuleText(`${snapDoc.text.slice(0, range.start)}${assistantSuggestion.proposedText}${snapDoc.text.slice(range.end)}`);
      const annotations = assistantSuggestion.annotations.length ? assistantSuggestion.annotations : snapDoc.annotations;
      return {
        ...snapDoc,
        text,
        annotations: normalizeAnnotations(text, annotations),
        patches: repairPatchesForText(text, snapDoc.patches),
        updatedAt: nowIso()
      };
    });
    setAssistantSuggestion(undefined);
    setRefreshResult(undefined);
    setStatus("AI edit applied. Undo is available.");
    setRevisionPreview(undefined);
  }

  function handleSaveSuggestionAsPatch() {
    if (!assistantSuggestion) return;
    const targetRange = assistantSuggestion.replaceRange ?? editRange;
    if (!targetRange) {
      setStatus("Click a sentence or select text before saving the suggestion as a patch.");
      return;
    }
    const text = assistantSuggestion.proposedText
      ? `Assistant suggestion: ${assistantSuggestion.proposedText}`
      : `Assistant note: ${assistantSuggestion.reply}`;
    const patch: Patch = {
      id: id("patch"),
      moduleNumber: activeProject.currentModule,
      anchorStart: targetRange.start,
      anchorEnd: targetRange.end,
      anchorQuote: activeDoc.text.slice(targetRange.start, targetRange.end),
      text,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      status: "open",
      resolved: false,
      stale: false
    };
    updateCurrentModule((doc) => ({
      ...doc,
      patches: [patch, ...doc.patches],
      updatedAt: nowIso()
    }));
    setStatus("Assistant suggestion saved as a patch note.");
  }

  function openTranslate() {
    setTranslateOpen(true);
    setTranslatePreview(undefined);
  }

  async function requestTranslatePreview() {
    setLoading(true);
    setBusyAction("translate");
    try {
      const useSelection = selectedRange.end > selectedRange.start;
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: activeProject.topic,
          moduleNumber: activeProject.currentModule,
          text: activeDoc.text,
          selectedRange: useSelection ? selectedRange : undefined,
          mode: translateMode
        })
      });
      const data = (await response.json()) as TranslateResponse & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Translate failed.");
      setTranslatePreview(data);
      setStatus("Translation preview ready.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Translate failed.");
    } finally {
      setLoading(false);
      setBusyAction(null);
    }
  }

  async function copyTranslatePreview() {
    if (!translatePreview) return;
    try {
      await navigator.clipboard?.writeText(translatePreview.translatedText);
      setStatus("Translation copied. The original module text was not changed.");
    } catch {
      setStatus("Translation preview is ready. Copy is unavailable in this browser context; the original text was not changed.");
    }
  }

  function sendTranslateToAssistant() {
    if (!translatePreview) return;
    appendAssistantHistory([{
      role: "assistant",
      text: `Reference translation\n\n${translatePreview.translatedText}\n\nThis is a reading aid only. Select text and use Selection mode if you want a preview/apply replacement.`,
      providerMode: translatePreview.providerMode,
      warnings: translatePreview.warnings
    }]);
    setAssistantSuggestion(undefined);
    setSelectedRange(EMPTY_RANGE);
    setActiveSentenceRange(undefined);
    setRightTab("assistant");
    requestAssistantMode("chat");
    setTranslateOpen(false);
    window.setTimeout(() => {
      setSelectedRange(EMPTY_RANGE);
      setActiveSentenceRange(undefined);
      requestAssistantMode("chat");
    }, 80);
    setStatus("Reference translation sent to Copilot chat.");
  }

  return (
    <main data-testid="app-shell" className="flex h-dvh flex-col overflow-hidden bg-paper">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ModuleSidebar project={activeProject} activeLabel={activeAnnotation?.label} onSelect={switchModule} />
        <section data-testid="workspace-shell" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="shrink-0 border-b border-slate-200 bg-white/90 px-4 py-1.5">
            <div className="flex min-w-0 items-center gap-3">
              <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-600">
                Project Title
                {titleQuestionMismatch ? (
                  <span
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-amber-300 bg-amber-50 text-xs font-bold text-amber-700"
                    title="Project title differs from Module 1 question. Generate uses current module first."
                    aria-label="Project title differs from Module 1 question. Generate uses current module first."
                  >
                    !
                  </span>
                ) : null}
                <input
                  value={activeProject.title}
                  onChange={(event) => updateProject((prev) => ({ ...prev, title: event.target.value, topic: event.target.value }))}
                  className="input flex-1"
                />
              </label>
              <ProgressTracker project={activeProject} onSelect={switchModule} />
            </div>
          </header>

          <input ref={importInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => void handleImportJson(event.target.files?.[0])} />

          <div data-testid="workspace-body" className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden p-3 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div data-testid="editor-column" className="flex min-h-0 min-w-0 flex-col gap-2 overflow-hidden">
              <div className="shrink-0">
                <div>
                  <h1 className="text-lg font-semibold text-slate-800">Module {activeProject.currentModule}: {activeDoc.title}</h1>
                  <p className="text-sm text-slate-500">Edit normally. Ctrl/Cmd+Enter anchors a patch note to the current sentence or selection.</p>
                </div>
              </div>

              <div className="relative min-h-0 flex-1 overflow-hidden">
                <Editor
                  text={activeDoc.text}
                  annotations={activeDoc.annotations}
                  patches={activeDoc.patches}
                  selectedRange={selectedRange}
                  activeSentenceRange={activeSentenceRange}
                  resetKey={editorResetKey}
                  onTextChange={handleTextChange}
                  onSelectionChange={setSelectedRange}
                  onActiveSentenceChange={setActiveSentenceRange}
                  onOpenPatch={handleOpenPatch}
                  onPatchMarkerClick={editPatch}
                  patchEditor={patchRange ? {
                    range: patchRange,
                    anchorQuote: patchQuote,
                    initialValue: editingPatchId ? activeDoc.patches.find((patch) => patch.id === editingPatchId)?.text ?? "" : "",
                    editingPatchId
                  } : undefined}
                  onPatchSubmit={handlePatchSubmit}
                  onPatchClose={() => {
                    setPatchRange(null);
                    setEditingPatchId(null);
                  }}
                  onPatchDelete={deletePatch}
                />
              </div>

            </div>

            <aside data-testid="right-rail" className="min-h-0 overflow-hidden pr-1">
              <section className="panel flex h-full min-h-0 flex-col p-0">
                <div role="tablist" aria-label="Right workspace" className="grid shrink-0 grid-cols-4 gap-1 border-b border-slate-200 p-2 text-xs">
                  {(["assistant", "sources", "snapshots", "export"] as RightTab[]).map((tab) => (
                    <button
                      key={tab}
                      role="tab"
                      aria-selected={rightTab === tab}
                      aria-controls={`right-panel-${tab}`}
                      className={`rounded-md px-2 py-2 font-semibold capitalize transition ${rightTab === tab ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
                      onClick={() => setRightTab(tab)}
                    >
                      {tab === "sources" ? "Sources" : tab}
                    </button>
                  ))}
                </div>
                <div className="min-h-0 flex-1 overflow-hidden p-3">
                  <div id="right-panel-assistant" role="tabpanel" aria-label="Assistant" className={rightTab === "assistant" ? "h-full min-h-0 overflow-hidden" : "hidden"}>
                    <AssistantPanel
                      modeRequest={assistantModeRequest}
                      chatMessages={activeProject.assistantHistory}
                      selectedText={selectedText}
                      selectedRange={selectedRange}
                      activeSentenceText={activeSentenceText}
                      activeSentenceRange={activeSentenceRange}
                      activeAnnotation={activeAnnotation}
                      activePatchCount={activePatch ? Math.max(1, activePatchCount) : activePatchCount}
                      loading={loading}
                      suggestion={assistantSuggestion}
                      revisionPreview={revisionPreview}
                      refreshResult={refreshResult}
                      onChat={(message) => void handleAssist(message, "chat")}
                      onSelectionAction={(action) => void handleAssist(action, "edit")}
                      onInspectAction={(action) => void handleAssist(action, "inspect")}
                      onApply={handleApplyAssistant}
                      onDismiss={() => {
                        setAssistantSuggestion(undefined);
                        setRefreshResult(undefined);
                      }}
                      onAddPatchForRange={handleOpenPatch}
                      onSaveSuggestionAsPatch={handleSaveSuggestionAsPatch}
                      onAcceptRevision={acceptRevisionPreview}
                      onRejectRevision={rejectRevisionPreview}
                    />
                  </div>
                  <div id="right-panel-sources" role="tabpanel" aria-label="Sources" className={rightTab === "sources" ? "h-full min-h-0 overflow-auto" : "hidden"}>
                    <SourceWorkbench
                      moduleNumber={activeProject.currentModule}
                      text={activeDoc.text}
                      annotations={activeDoc.annotations}
                      sources={activeDoc.sources}
                      onAdd={addSource}
                      onToggleVerified={toggleSourceVerified}
                      onDelete={deleteSource}
                      onAddPlaceholder={addPlaceholderSource}
                      onInsertCitation={insertCitation}
                      onMarkSelectionNeedsCitation={markSelectionNeedsCitation}
                    />
                  </div>
                  <div id="right-panel-snapshots" role="tabpanel" aria-label="Snapshots" className={rightTab === "snapshots" ? "h-full min-h-0 overflow-auto" : "hidden"}>
                    <SnapshotPanel snapshots={activeDoc.snapshots} onRestore={handleRestoreSnapshot} onSaveSnapshot={handleSaveSnapshot} onClearModule={handleClearModule} />
                  </div>
                  <div id="right-panel-export" role="tabpanel" aria-label="Export" className={rightTab === "export" ? "h-full min-h-0 overflow-auto" : "hidden"}>
                    <ExportPanel
                      moduleNumber={activeProject.currentModule}
                      hasText={Boolean(activeDoc.text.trim())}
                      hasIssues={hasBlockingIssues(activeDoc)}
                      onCopyRichText={handleCopyRichText}
                      onDownloadHtml={handleDownloadHtml}
                      onDownloadJson={() => {
                        downloadProjectJson(activeProject);
                        setStatus("Full project JSON downloaded with all six modules.");
                      }}
                      onImportJson={handleImportJsonClick}
                      onReferenceTranslation={openTranslate}
                      onResetDemo={handleResetDemo}
                    />
                  </div>
                </div>
              </section>
            </aside>
          </div>

          <Toolbar
            currentModule={activeProject.currentModule}
            loading={loading}
            busyAction={busyAction}
            status={status}
            toastVisible={toastVisible}
            canUndo={undoStack.length > 0 && /Undo is available|AI edit applied|Notes applied/.test(status)}
            lastAction={lastAction}
            hasOpenPatches={openPatches.length > 0}
            onBack={() => switchModule(clampModule(activeProject.currentModule - 1))}
            onGenerateNext={handleGenerateNext}
            onFinalizeExport={handleDownloadHtml}
            onRetryGenerate={handleGenerateNext}
            onRefresh={handleRefresh}
            onSaveSnapshot={handleSaveSnapshot}
            onUndo={undoLastAiEdit}
          />
        </section>
      </div>

      <FinishModal
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        onDownloadHtml={() => {
          downloadCurrentModuleHtml(activeProject);
          setFinishOpen(false);
          setStatus("Module 6 HTML downloaded.");
        }}
        onDownloadJson={() => {
          downloadProjectJson(activeProject);
          setFinishOpen(false);
          setStatus("Full project JSON downloaded with all six modules.");
        }}
      />
      <TranslateModal
        open={translateOpen}
        sourceText={translateSourceText}
        mode={translateMode}
        loading={loading}
        preview={translatePreview}
        onModeChange={setTranslateMode}
        onRequest={requestTranslatePreview}
        onCopy={copyTranslatePreview}
        onSendToAssistant={sendTranslateToAssistant}
        onClose={() => setTranslateOpen(false)}
      />
    </main>
  );
}

function ExportPanel({
  moduleNumber,
  hasText,
  hasIssues,
  onCopyRichText,
  onDownloadHtml,
  onDownloadJson,
  onImportJson,
  onReferenceTranslation,
  onResetDemo
}: {
  moduleNumber: ModuleNumber;
  hasText: boolean;
  hasIssues: boolean;
  onCopyRichText: () => void;
  onDownloadHtml: () => void;
  onDownloadJson: () => void;
  onImportJson: () => void;
  onReferenceTranslation: () => void;
  onResetDemo: () => void;
}) {
  const moduleSix = moduleNumber === 6;
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [diagnostics, setDiagnostics] = useState<AiDiagnostics | null>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);

  async function toggleDiagnostics() {
    const nextOpen = !diagnosticsOpen;
    setDiagnosticsOpen(nextOpen);
    if (!nextOpen || diagnostics || diagnosticsLoading) return;
    setDiagnosticsLoading(true);
    try {
      const response = await fetch("/api/diagnostics");
      if (!response.ok) throw new Error("Diagnostics unavailable.");
      setDiagnostics(await response.json());
    } catch {
      setDiagnostics({
        providerConfigured: false,
        forceMock: false,
        model: "unknown",
        fastModel: "unknown",
        highQualityModel: "unknown",
        interactiveTimeoutMs: 0,
        baseUrlConfigured: false,
        note: "Diagnostics unavailable."
      });
    } finally {
      setDiagnosticsLoading(false);
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">{moduleSix ? "Final Review / Export" : "Export & Project Files"}</h2>
        <p className="mt-1 text-xs text-slate-500">
          {moduleSix
            ? "Use this as a final review checklist before downloading. Export is available even if you still have issues to resolve."
            : "Copy or download the current module/project without changing the editor text."}
        </p>
      </div>

      {moduleSix ? (
        <div data-testid="module6-final-checklist" className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-950">
          <div className="mb-2 font-semibold">Final review checklist</div>
          <ul className="space-y-1">
            <li>- Content: answered the question?</li>
            <li>- Structure: logical sequence?</li>
            <li>- Clarity: easy to understand?</li>
            <li>- Style: academic tone?</li>
            <li>- Proofreading: grammar, punctuation, formatting, citations?</li>
          </ul>
          <div className={`mt-2 rounded-md px-2 py-1 ${hasIssues ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800"}`}>
            {hasIssues ? "Export available, not submission-ready: resolve citation/source issues first." : hasText ? "Export ready: no blocking issues detected locally." : "Add Module 6 text before final export."}
          </div>
        </div>
      ) : null}

      <div className="grid gap-2">
        <button className="btn-primary text-left" onClick={onDownloadHtml}>{moduleSix ? "Finalize / Export HTML" : "Download HTML"}</button>
        <button className="btn-secondary text-left" onClick={onCopyRichText}>Copy Rich Text</button>
        <button className="btn-secondary text-left" onClick={onDownloadJson}>Download full project JSON</button>
        <button className="btn-secondary text-left" onClick={onImportJson}>Import full project JSON</button>
        <button className="btn-secondary text-left" onClick={onReferenceTranslation}>Reference Translation</button>
        <button className="btn-danger text-left" onClick={onResetDemo}>Reset Demo</button>
      </div>

      <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
        Full project JSON includes all 6 modules, annotations, patches, snapshots, sources, and assistant history. Import replaces the whole local project after downloading a backup. It never includes API keys.
      </p>

      <div className="rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-500">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left font-semibold text-slate-600"
          onClick={toggleDiagnostics}
          aria-expanded={diagnosticsOpen}
        >
          <span>AI diagnostics</span>
          <span>{diagnosticsOpen ? "Hide" : "Show"}</span>
        </button>
        {diagnosticsOpen ? (
          <div data-testid="ai-diagnostics" className="mt-2 space-y-1 border-t border-slate-100 pt-2">
            {diagnosticsLoading ? <p>Loading diagnostics...</p> : null}
            {!diagnostics ? (
              <>
                <p>Provider configured: checking...</p>
                <p>Interactive timeout: checking...</p>
              </>
            ) : null}
            {diagnostics ? (
              <>
                <p>Provider configured: {diagnostics.providerConfigured ? "yes" : "no"}</p>
                <p>Force mock: {diagnostics.forceMock ? "on" : "off"}</p>
                <p>Fast model: {diagnostics.fastModel}</p>
                <p>Default model: {diagnostics.model}</p>
                <p>Interactive timeout: {diagnostics.interactiveTimeoutMs}ms</p>
                <p>{diagnostics.note}</p>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

type AiDiagnostics = {
  providerConfigured: boolean;
  forceMock: boolean;
  model: string;
  fastModel: string;
  highQualityModel: string;
  interactiveTimeoutMs: number;
  baseUrlConfigured: boolean;
  note: string;
};

function mergeSources(primary: SourceCard[], secondary: SourceCard[]) {
  const seen = new Set<string>();
  const result: SourceCard[] = [];

  for (const source of [...primary, ...secondary]) {
    if (seen.has(source.id)) continue;
    seen.add(source.id);
    result.push(source);
  }

  return result;
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

function extractModuleOneQuestion(text: string) {
  return text.match(/^\s*Research question\s*:\s*(.+)$/im)?.[1]?.trim() ??
    text.match(/^\s*Question\s*:\s*(.+)$/im)?.[1]?.trim() ??
    "";
}

function differsMeaningfully(title: string, question: string) {
  if (!title.trim() || !question.trim()) return false;
  const normalizedTitle = normalizeComparable(title);
  const normalizedQuestion = normalizeComparable(question);
  if (!normalizedTitle || !normalizedQuestion) return false;
  return !normalizedQuestion.includes(normalizedTitle) && !normalizedTitle.includes(normalizedQuestion);
}

function normalizeComparable(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(how|can|should|what|why|when|where|does|do|the|a|an|and|or|to|of|in|for|we|our)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findCitationNeededMarker(text: string, caret: number) {
  const markerPattern = /\s*\[citation needed\]/gi;
  for (const match of text.matchAll(markerPattern)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (caret >= start - 4 && caret <= end + 4) {
      return { start, end };
    }
    if (caret < start && start - caret <= 3) {
      return { start, end };
    }
  }
  return null;
}

function hasBlockingIssues(doc: ModuleDocument) {
  return doc.annotations.some((annotation) => annotation.label === "issue") ||
    /\[citation needed\]|\[source needed(?::[^\]]*)?\]/i.test(doc.text) ||
    doc.sources.some((source) => source.placeholder || !source.title || !source.authors?.length || !source.year);
}

function cloneModuleDocument(doc: ModuleDocument): ModuleDocument {
  return JSON.parse(JSON.stringify(doc)) as ModuleDocument;
}
