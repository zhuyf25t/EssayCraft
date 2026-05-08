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
import { addSnapshot, clearModule, importProject, replaceModuleContent, restoreSnapshot } from "@/lib/project";
import { loadProject, resetProjectStorage, saveProject } from "@/lib/storage";
import { clampModule, id, nowIso } from "@/lib/utils";
import type {
  AssistResponse,
  Annotation,
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

export default function Home() {
  const [project, setProject] = useState<Project | null>(null);
  const [selectedRange, setSelectedRange] = useState<TextRange>(EMPTY_RANGE);
  const [patchRange, setPatchRange] = useState<TextRange | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [actionSteps, setActionSteps] = useState<string[]>([]);
  const [activeStep, setActiveStep] = useState<string | undefined>();
  const [finishOpen, setFinishOpen] = useState(false);
  const [assistantSuggestion, setAssistantSuggestion] = useState<AssistResponse | undefined>();
  const [translateOpen, setTranslateOpen] = useState(false);
  const [translatePreview, setTranslatePreview] = useState<TranslateResponse | undefined>();
  const [translateMode, setTranslateMode] = useState<"en-to-zh" | "zh-to-en">("en-to-zh");
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
      return;
    }

    const sourceModuleNumber = activeProject.currentModule as Exclude<ModuleNumber, 6>;
    const target = (sourceModuleNumber + 1) as Exclude<ModuleNumber, 1>;
    const steps = ["Saving snapshot", `Generating Module ${target}`, "Validating JSON", "Applying module"];
    setLoading(true);
    setProgress(steps, steps[0]);
    try {
      setProject((prev) => {
        if (!prev) return prev;
        const targetDoc = prev.modules[target];
        return {
          ...prev,
          modules: {
            ...prev.modules,
            [target]: addSnapshot(targetDoc, `Before overwrite from Module ${sourceModuleNumber}`)
          },
          updatedAt: nowIso()
        };
      });

      setProgress(steps, steps[1]);
      const response = await fetch("/api/generate-next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: activeProject.topic,
          sourceModuleNumber,
          sourceTitle: activeDoc.title,
          sourceText: activeDoc.text,
          sourceAnnotations: activeDoc.annotations,
          sourcePatches: activeDoc.patches,
          sourceSources: activeDoc.sources
        })
      });

      const data = (await response.json()) as GenerateNextResponse & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Generate Next failed.");
      if (data.moduleNumber !== target) throw new Error(`Expected Module ${target}, received Module ${data.moduleNumber}.`);

      setProgress(steps, steps[2]);
      const normalizedAnnotations = normalizeAnnotations(data.text, data.annotations);

      setProgress(steps, steps[3]);
      setProject((prev) => {
        if (!prev) return prev;
        const targetDoc = prev.modules[target];
        const sources = data.sources.length ? data.sources : mergeSources(activeDoc.sources, targetDoc.sources);
        return {
          ...prev,
          currentModule: target,
          modules: {
            ...prev.modules,
            [target]: {
              ...replaceModuleContent(targetDoc, data.text, normalizedAnnotations, sources),
              title: data.title || targetDoc.title,
              globalFeedback: data.globalFeedback
            }
          },
          updatedAt: nowIso()
        };
      });
      setSelectedRange(EMPTY_RANGE);
      setPatchRange(null);
      setAssistantSuggestion(undefined);
      setStatus(data.globalFeedback?.[0] ?? `Module ${target} generated. Previous version saved.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Generate Next failed.");
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
  }

  function switchModule(moduleNumber: ModuleNumber) {
    updateProject((prev) => ({ ...prev, currentModule: moduleNumber }));
    setSelectedRange(EMPTY_RANGE);
    setPatchRange(null);
    setAssistantSuggestion(undefined);
  }

  function handleClearModule() {
    if (!window.confirm(`Clear Module ${activeProject.currentModule} content? A snapshot will be saved first.`)) return;
    updateCurrentModule((doc) => clearModule(doc));
    setSelectedRange(EMPTY_RANGE);
    setPatchRange(null);
    setStatus(`Module ${activeProject.currentModule} cleared. Restore is available from snapshots.`);
  }

  function handleResetDemo() {
    if (!window.confirm("Reset the entire EssayCraft demo? This clears local project data.")) return;
    resetProjectStorage();
    setProject(loadProject());
    setSelectedRange(EMPTY_RANGE);
    setPatchRange(null);
    setAssistantSuggestion(undefined);
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
    addSource({
      title: "Placeholder source needed",
      authors: [],
      sourceType: "unknown",
      userNotes: "Replace this card with real source metadata before final submission.",
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
      const needsSpace = insertAt > 0 && !/\s/.test(snapDoc.text[insertAt - 1] ?? "");
      const insertion = `${needsSpace ? " " : ""}${citation}`;
      const text = `${snapDoc.text.slice(0, insertAt)}${insertion}${snapDoc.text.slice(insertAt)}`;
      return {
        ...snapDoc,
        text,
        annotations: normalizeAnnotations(text, snapDoc.annotations),
        patches: repairPatchesForText(text, snapDoc.patches),
        updatedAt: nowIso()
      };
    });
    setStatus(`Inserted ${citation} from your source card.`);
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
          selectedRange,
          selectedText,
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

  function applyTranslation() {
    if (!translatePreview) return;
    const useSelection = selectedRange.end > selectedRange.start;
    updateCurrentModule((doc) => {
      const snapDoc = addSnapshot(doc, "Before applying translation");
      const text = useSelection
        ? `${snapDoc.text.slice(0, selectedRange.start)}${translatePreview.translatedText}${snapDoc.text.slice(selectedRange.end)}`
        : translatePreview.translatedText;
      return {
        ...snapDoc,
        text,
        annotations: useSelection
          ? mergeSelectedTranslationAnnotations(snapDoc.annotations, selectedRange, text, translatePreview.translatedText, translatePreview.annotations)
          : normalizeAnnotations(text, translatePreview.annotations),
        patches: useSelection ? repairPatchesForText(text, snapDoc.patches) : [],
        updatedAt: nowIso()
      };
    });
    setTranslateOpen(false);
    setTranslatePreview(undefined);
    setStatus("Translation applied after snapshot. Refresh highlighting when ready.");
  }

  return (
    <main className="min-h-screen bg-paper pb-24">
      <div className="flex min-h-[calc(100vh-52px)]">
        <ModuleSidebar project={activeProject} onSelect={switchModule} />
        <section className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-slate-200 bg-white/90 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="font-crayon text-3xl font-bold text-blue-700">EssayCraft</div>
              <label className="flex min-w-72 flex-1 items-center gap-2 text-sm text-slate-600">
                Project Title
                <input
                  value={activeProject.title}
                  onChange={(event) => updateProject((prev) => ({ ...prev, title: event.target.value, topic: event.target.value }))}
                  className="input flex-1"
                />
              </label>
              <div className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">Module {activeProject.currentModule} of 6</div>
            </div>
            <div className="mt-4">
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

          <div className="border-b border-slate-200 bg-[#fffdf8]/95 px-4 py-3">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button className="btn-secondary min-w-44" onClick={() => switchModule(clampModule(activeProject.currentModule - 1))} disabled={activeProject.currentModule <= 1 || loading}>
                Back to Module {Math.max(1, activeProject.currentModule - 1)}
              </button>
              <button className="btn-primary min-w-80 text-base" onClick={handleGenerateNext} disabled={activeProject.currentModule >= 6 || loading}>
                Next: Generate Module {Math.min(6, activeProject.currentModule + 1)} from Module {activeProject.currentModule}
              </button>
              <button className="btn-secondary min-w-40" onClick={handleSaveSnapshot} disabled={loading}>Quick Snapshot</button>
              <button className="btn-secondary min-w-36" onClick={handleDownloadHtml} disabled={loading}>Export Current HTML</button>
            </div>
          </div>

          <div className="grid flex-1 grid-cols-1 gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
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

              <Editor
                text={activeDoc.text}
                annotations={activeDoc.annotations}
                patches={activeDoc.patches}
                selectedRange={selectedRange}
                onTextChange={handleTextChange}
                onSelectionChange={setSelectedRange}
                onOpenPatch={handleOpenPatch}
              />

              <section className="panel">
                <h2 className="mb-2 text-sm font-semibold text-slate-800">Patch notes</h2>
                {activeDoc.patches.length === 0 ? (
                  <p className="text-xs text-slate-500">No patch notes yet.</p>
                ) : (
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
                )}
              </section>
            </div>

            <aside className="space-y-4">
              <AssistantPanel
                selectedText={selectedText}
                selectedRange={selectedRange}
                loading={loading}
                suggestion={assistantSuggestion}
                onAction={handleAssist}
                onApply={handleApplyAssistant}
                onDismiss={() => setAssistantSuggestion(undefined)}
                onTranslate={openTranslate}
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
        onApply={applyTranslation}
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

function mergeSelectedTranslationAnnotations(
  existing: Annotation[],
  range: TextRange,
  nextText: string,
  translatedText: string,
  translatedAnnotations: Annotation[]
) {
  const delta = translatedText.length - (range.end - range.start);
  const preserved = existing
    .filter((annotation) => annotation.end <= range.start || annotation.start >= range.end)
    .map((annotation) => (
      annotation.start >= range.end
        ? { ...annotation, start: annotation.start + delta, end: annotation.end + delta }
        : annotation
    ));
  const inserted = translatedAnnotations.map((annotation) => ({
    ...annotation,
    start: range.start + annotation.start,
    end: range.start + annotation.end
  }));

  return normalizeAnnotations(nextText, [...preserved, ...inserted]);
}
