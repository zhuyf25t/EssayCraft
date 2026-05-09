"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AssistantPanel } from "@/components/AssistantPanel";
import { Editor } from "@/components/Editor";
import { FinishModal } from "@/components/FinishModal";
import { HighlightKey } from "@/components/HighlightKey";
import { ModuleSidebar } from "@/components/ModuleSidebar";
import { PatchPopover } from "@/components/PatchPopover";
import { ProgressTracker } from "@/components/ProgressTracker";
import { SnapshotPanel } from "@/components/SnapshotPanel";
import { SourceWorkbench } from "@/components/SourceWorkbench";
import { Toolbar } from "@/components/Toolbar";
import { TranslateModal } from "@/components/TranslateModal";
import { normalizeAnnotations, normalizeText, sentenceRangeAt } from "@/lib/annotations";
import { inTextCitationPreview } from "@/lib/citationAudit";
import { copyRichText, downloadCurrentModuleHtml, downloadProjectJson } from "@/lib/export";
import { repairPatchesForText } from "@/lib/patches";
import { MODULE_TITLES, addSnapshot, clearModule, importProject, replaceModuleContent, restoreSnapshot } from "@/lib/project";
import { generateNextRequestSchema, generateNextResponseSchema } from "@/lib/schemas";
import { loadProject, resetProjectStorage, saveProject } from "@/lib/storage";
import { clampModule, id, nowIso } from "@/lib/utils";
import type {
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

type LastAction = {
  tone: "info" | "success" | "error" | "warning";
  message: string;
  details?: string[];
  retryGenerate?: boolean;
};

export default function Home() {
  const [project, setProject] = useState<Project | null>(null);
  const [selectedRange, setSelectedRange] = useState<TextRange>(EMPTY_RANGE);
  const [patchRange, setPatchRange] = useState<TextRange | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [lastAction, setLastAction] = useState<LastAction>({ tone: "info", message: "Ready" });
  const [actionSteps, setActionSteps] = useState<string[]>([]);
  const [activeStep, setActiveStep] = useState<string | undefined>();
  const [finishOpen, setFinishOpen] = useState(false);
  const [assistantSuggestion, setAssistantSuggestion] = useState<AssistResponse | undefined>();
  const [translateOpen, setTranslateOpen] = useState(false);
  const [translatePreview, setTranslatePreview] = useState<TranslateResponse | undefined>();
  const [translateMode, setTranslateMode] = useState<TranslateMode>("en-to-zh");
  const [editorResetKey, setEditorResetKey] = useState(0);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setProject(loadProject());
  }, []);

  useEffect(() => {
    if (project) saveProject(project);
  }, [project]);

  const currentDoc = project ? project.modules[project.currentModule] : null;
  const selectedText = useMemo(() => {
    if (!currentDoc) return "";
    return currentDoc.text.slice(selectedRange.start, selectedRange.end);
  }, [currentDoc, selectedRange]);

  const patchQuote = currentDoc && patchRange ? currentDoc.text.slice(patchRange.start, patchRange.end) : "";
  const translateSourceText = currentDoc ? selectedText || currentDoc.text : "";

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

  function setProgress(steps: string[], step: string) {
    setActionSteps(steps);
    setActiveStep(step);
  }

  function clearProgress() {
    setActionSteps([]);
    setActiveStep(undefined);
  }

  function resetEditorViewport() {
    setEditorResetKey((value) => value + 1);
  }

  function handleTextChange(value: string) {
    const text = normalizeText(value);
    updateCurrentModule((doc) => ({
      ...doc,
      text,
      annotations: normalizeAnnotations(text, doc.annotations),
      patches: repairPatchesForText(text, doc.patches),
      updatedAt: nowIso()
    }));
    setStatus("Auto-saved. Refresh if highlights need updating.");
  }

  function handleOpenPatch(range: TextRange) {
    const nextRange = range.end > range.start ? range : sentenceRangeAt(activeDoc.text, range.start, range.end);
    setPatchRange(nextRange);
    setSelectedRange(nextRange);
  }

  function handlePatchSubmit(text: string) {
    if (!patchRange) return;
    const patch: Patch = {
      id: id("patch"),
      anchorStart: patchRange.start,
      anchorEnd: patchRange.end,
      anchorQuote: activeDoc.text.slice(patchRange.start, patchRange.end),
      text,
      createdAt: nowIso()
    };
    updateCurrentModule((doc) => ({
      ...doc,
      patches: [patch, ...doc.patches],
      updatedAt: nowIso()
    }));
    setPatchRange(null);
    setStatus("Patch saved. Refresh or ask the assistant to use it.");
  }

  async function handleRefresh() {
    if (!activeDoc.text.trim()) {
      setStatus("Nothing to refresh yet.");
      return;
    }

    const steps = ["Reading text", "Classifying ranges", "Updating colors"];
    setLoading(true);
    setProgress(steps, steps[0]);
    try {
      setProgress(steps, steps[1]);
      const response = await fetch("/api/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: activeProject.topic,
          moduleNumber: activeProject.currentModule,
          text: activeDoc.text,
          annotations: activeDoc.annotations,
          patches: activeDoc.patches,
          sources: activeDoc.sources
        })
      });

      const data = (await response.json()) as RefreshResponse & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Refresh failed.");

      setProgress(steps, steps[2]);
      updateCurrentModule((doc) => ({
        ...doc,
        annotations: normalizeAnnotations(doc.text, data.annotations),
        globalFeedback: data.globalFeedback,
        updatedAt: nowIso()
      }));
      setStatus(data.globalFeedback?.[0] ?? "Highlights refreshed without rewriting text.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Refresh failed.");
    } finally {
      setLoading(false);
      clearProgress();
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

    const steps = ["Saving snapshot", `Generating Module ${target}`, "Validating JSON", "Applying module"];
    setLoading(true);
    setProgress(steps, steps[0]);
    setStatus(`Generating Module ${target} from Module ${sourceModuleNumber}...`);
    setLastAction({ tone: "info", message: `Generating Module ${target} from Module ${sourceModuleNumber}...`, details: steps });
    try {
      setProgress(steps, steps[1]);
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

      setProgress(steps, steps[2]);
      const normalizedAnnotations = normalizeAnnotations(data.text, data.annotations);

      setProgress(steps, steps[3]);
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
      setPatchRange(null);
      setAssistantSuggestion(undefined);
      resetEditorViewport();
      const message = `Module ${target} generated and opened. Previous Module ${target} saved as a snapshot.`;
      const details = [
        `Provider mode: ${data.providerMode}.`,
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
      clearProgress();
    }
  }

  function handleSaveSnapshot() {
    updateCurrentModule((doc) => addSnapshot(doc, "Manual snapshot"));
    setStatus("Snapshot saved.");
  }

  function handleRestoreSnapshot(snapshot: Snapshot) {
    updateCurrentModule((doc) => restoreSnapshot(doc, snapshot));
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
    setPatchRange(null);
    setAssistantSuggestion(undefined);
    resetEditorViewport();
    setLastAction({ tone: "info", message: `Viewing Module ${moduleNumber}: ${MODULE_TITLES[moduleNumber]}.` });
  }

  function handleClearModule() {
    if (!window.confirm(`Clear Module ${activeProject.currentModule} content? A snapshot will be saved first.`)) return;
    updateCurrentModule((doc) => clearModule(doc));
    setSelectedRange(EMPTY_RANGE);
    setPatchRange(null);
    resetEditorViewport();
    setStatus(`Module ${activeProject.currentModule} cleared. Restore is available from snapshots.`);
  }

  function handleResetDemo() {
    if (!window.confirm("Reset the entire EssayCraft demo? This clears local project data.")) return;
    resetProjectStorage();
    setProject(loadProject());
    setSelectedRange(EMPTY_RANGE);
    setPatchRange(null);
    setAssistantSuggestion(undefined);
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
      if (!window.confirm(`Import "${imported.title}" and replace the current project? A JSON backup will download first.`)) return;
      downloadProjectJson(activeProject);
      setProject(imported);
      setSelectedRange(EMPTY_RANGE);
      setPatchRange(null);
      setAssistantSuggestion(undefined);
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

  async function handleAssist(action: string) {
    const hasSelection = selectedRange.end > selectedRange.start;
    const steps = ["Preparing context", "Drafting suggestion", "Preview ready"];
    setLoading(true);
    setProgress(steps, steps[0]);
    setAssistantSuggestion(undefined);
    try {
      setProgress(steps, steps[1]);
      const response = await fetch("/api/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: activeProject.topic,
          moduleNumber: activeProject.currentModule,
          moduleTitle: activeDoc.title,
          text: activeDoc.text,
          annotations: activeDoc.annotations,
          patches: activeDoc.patches,
          sources: activeDoc.sources,
          selectedRange: hasSelection ? selectedRange : undefined,
          selectedText: hasSelection ? selectedText : undefined,
          action,
          history: activeProject.assistantHistory
        })
      });
      const data = (await response.json()) as AssistResponse & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Assistant failed.");
      setProgress(steps, steps[2]);
      setAssistantSuggestion(data);
      updateProject((prev) => ({
        ...prev,
        assistantHistory: [
          { id: id("msg"), role: "user" as const, text: action, createdAt: nowIso() },
          { id: id("msg"), role: "assistant" as const, text: data.reply, createdAt: nowIso() },
          ...prev.assistantHistory
        ].slice(0, 30)
      }));
      setStatus("Assistant preview ready.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Assistant failed.");
    } finally {
      setLoading(false);
      clearProgress();
    }
  }

  function handleApplyAssistant() {
    if (!assistantSuggestion) return;
    if (assistantSuggestion.proposedText && !assistantSuggestion.replaceRange) {
      setStatus("Assistant preview is reference-only. Copy it or select text before requesting an applyable rewrite.");
      return;
    }
    if (assistantSuggestion.proposedText && assistantSuggestion.replaceRange) {
      const range = assistantSuggestion.replaceRange;
      if (range.start < 0 || range.end <= range.start || range.end > activeDoc.text.length) {
        setStatus("Assistant replacement was blocked because the target selection is no longer valid.");
        return;
      }
    }
    updateCurrentModule((doc) => {
      const snapDoc = addSnapshot(doc, "Before applying assistant suggestion");
      if (assistantSuggestion.proposedText && assistantSuggestion.replaceRange) {
        const range = assistantSuggestion.replaceRange;
        const text = `${snapDoc.text.slice(0, range.start)}${assistantSuggestion.proposedText}${snapDoc.text.slice(range.end)}`;
        const annotations = assistantSuggestion.annotations.length ? assistantSuggestion.annotations : snapDoc.annotations;
        return {
          ...snapDoc,
          text,
          annotations: normalizeAnnotations(text, annotations),
          patches: repairPatchesForText(text, snapDoc.patches),
          updatedAt: nowIso()
        };
      }
      return {
        ...snapDoc,
        annotations: normalizeAnnotations(snapDoc.text, assistantSuggestion.annotations),
        updatedAt: nowIso()
      };
    });
    setAssistantSuggestion(undefined);
    setStatus("Assistant suggestion applied after snapshot.");
  }

  function openTranslate() {
    setTranslateOpen(true);
    setTranslatePreview(undefined);
  }

  async function requestTranslatePreview() {
    const steps = ["Preparing selection", "Translating", "Preview ready"];
    setLoading(true);
    setProgress(steps, steps[0]);
    try {
      setProgress(steps, steps[1]);
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
      setProgress(steps, steps[2]);
      setTranslatePreview(data);
      setStatus("Translation preview ready.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Translate failed.");
    } finally {
      setLoading(false);
      clearProgress();
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

  return (
    <main data-testid="app-shell" className="flex h-dvh flex-col overflow-hidden bg-paper">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ModuleSidebar project={activeProject} onSelect={switchModule} />
        <section data-testid="workspace-shell" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="shrink-0 border-b border-slate-200 bg-white/90 px-4 py-2">
            <div className="flex items-center gap-3">
              <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-600">
                Project Title
                <input
                  value={activeProject.title}
                  onChange={(event) => updateProject((prev) => ({ ...prev, title: event.target.value, topic: event.target.value }))}
                  className="input flex-1"
                />
              </label>
              <div className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">Module {activeProject.currentModule} of 6</div>
            </div>
            {titleQuestionMismatch ? (
              <div className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
                Project title and Module 1 research question differ. Which should Generate Next use? Using current module text first, with the project title as context.
              </div>
            ) : null}
            <div className="mt-2">
              <ProgressTracker project={activeProject} actionSteps={actionSteps} activeStep={activeStep} onSelect={switchModule} />
            </div>
          </header>

          <Toolbar
            currentModule={activeProject.currentModule}
            loading={loading}
            status={status}
            onRefresh={handleRefresh}
            onSaveSnapshot={handleSaveSnapshot}
            onClearModule={handleClearModule}
            onCopyRichText={handleCopyRichText}
            onDownloadHtml={handleDownloadHtml}
            onDownloadJson={() => {
              downloadProjectJson(activeProject);
              setStatus("Project JSON downloaded.");
            }}
            onImportJson={handleImportJsonClick}
            onResetDemo={handleResetDemo}
            onTranslate={openTranslate}
          />
          <input ref={importInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => void handleImportJson(event.target.files?.[0])} />

          <div className="shrink-0 border-b border-slate-200 bg-[#fffdf8]/95 px-4 py-2">
            <div className="flex items-center justify-center gap-3">
              <button className="btn-secondary min-w-36 whitespace-nowrap" onClick={() => switchModule(clampModule(activeProject.currentModule - 1))} disabled={activeProject.currentModule <= 1 || loading}>
                Back to Module {Math.max(1, activeProject.currentModule - 1)}
              </button>
              <button data-testid="workflow-generate" className="btn-primary min-w-80 whitespace-nowrap px-6 text-base" onClick={handleGenerateNext} disabled={activeProject.currentModule >= 6 || loading}>
                {loading && activeProject.currentModule < 6
                  ? `Generating Module ${activeProject.currentModule + 1}...`
                  : activeProject.currentModule >= 6
                    ? "Module 6 is final: export or download"
                    : `Generate Module ${activeProject.currentModule + 1} from Module ${activeProject.currentModule}`}
              </button>
            </div>
            <div data-testid="last-action" className={`mx-auto mt-2 max-w-5xl rounded-lg border px-3 py-1.5 text-sm ${lastActionClasses(lastAction.tone)}`} aria-live="polite">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="font-semibold">Last action:</span> {lastAction.message}
                  {lastAction.details?.length ? (
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
                      {lastAction.details.slice(0, 4).map((detail, index) => <li key={`${index}-${detail.slice(0, 48)}`}>{detail}</li>)}
                    </ul>
                  ) : null}
                </div>
                {lastAction.retryGenerate ? (
                  <button className="btn-secondary" onClick={handleGenerateNext} disabled={loading}>Retry</button>
                ) : null}
              </div>
            </div>
          </div>

          <div data-testid="workspace-body" className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden p-3 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div data-testid="editor-column" className="flex min-h-0 min-w-0 flex-col gap-2 overflow-hidden">
              <div className="shrink-0">
                <div>
                  <h1 className="text-lg font-semibold text-slate-800">Module {activeProject.currentModule}: {activeDoc.title}</h1>
                  <p className="text-sm text-slate-500">Edit normally. Ctrl/Cmd+Enter anchors a patch note to the current sentence or selection.</p>
                </div>
              </div>

              {patchRange ? (
                <PatchPopover
                  range={patchRange}
                  anchorQuote={patchQuote}
                  onSubmit={handlePatchSubmit}
                  onClose={() => setPatchRange(null)}
                />
              ) : null}

              <div className="min-h-0 flex-1 overflow-hidden">
                <Editor
                  text={activeDoc.text}
                  annotations={activeDoc.annotations}
                  patches={activeDoc.patches}
                  selectedRange={selectedRange}
                  resetKey={editorResetKey}
                  onTextChange={handleTextChange}
                  onSelectionChange={setSelectedRange}
                  onOpenPatch={handleOpenPatch}
                />
              </div>

              {activeDoc.patches.length ? (
                <section className="panel max-h-24 shrink-0 overflow-auto py-3">
                  <h2 className="mb-2 text-sm font-semibold text-slate-800">Patch notes</h2>
                  <div className="flex flex-wrap gap-2">
                    {activeDoc.patches.map((patch) => (
                      <button
                        key={patch.id}
                        className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-left text-xs text-blue-800"
                        onClick={() => setSelectedRange({ start: patch.anchorStart, end: patch.anchorEnd })}
                        title={patch.anchorQuote}
                      >
                        {patch.text}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>

            <aside data-testid="right-rail" className="min-h-0 space-y-3 overflow-y-auto pr-1">
              <AssistantPanel
                selectedText={selectedText}
                selectedRange={selectedRange}
                loading={loading}
                suggestion={assistantSuggestion}
                onAction={handleAssist}
                onApply={handleApplyAssistant}
                onDismiss={() => setAssistantSuggestion(undefined)}
                onRefresh={handleRefresh}
              />
              <SnapshotPanel snapshots={activeDoc.snapshots} onRestore={handleRestoreSnapshot} />
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
            </aside>
          </div>
        </section>
      </div>

      <HighlightKey />
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
          setStatus("Project JSON downloaded.");
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
        onClose={() => setTranslateOpen(false)}
      />
    </main>
  );
}

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

function lastActionClasses(tone: LastAction["tone"]) {
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-900";
  if (tone === "error") return "border-red-200 bg-red-50 text-red-900";
  return "border-blue-100 bg-blue-50 text-blue-900";
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
