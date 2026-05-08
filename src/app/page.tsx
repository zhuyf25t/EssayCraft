"use client";

import { useEffect, useMemo, useState } from "react";
import { Editor } from "@/components/Editor";
import { FinishModal } from "@/components/FinishModal";
import { HighlightKey } from "@/components/HighlightKey";
import { ModuleSidebar } from "@/components/ModuleSidebar";
import { PatchPopover } from "@/components/PatchPopover";
import { SnapshotPanel } from "@/components/SnapshotPanel";
import { Toolbar } from "@/components/Toolbar";
import { copyRichText, downloadCurrentModuleHtml, downloadProjectJson } from "@/lib/export";
import { addSnapshot } from "@/lib/project";
import { loadProject, resetProjectStorage, saveProject } from "@/lib/storage";
import { clampModule, id, nowIso } from "@/lib/utils";
import type { GenerateNextResponse, ModuleNumber, Project, RefreshResponse, Segment, Snapshot } from "@/types/essaycraft";

export default function Home() {
  const [project, setProject] = useState<Project | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | undefined>();
  const [patchSegmentId, setPatchSegmentId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [finishOpen, setFinishOpen] = useState(false);

  useEffect(() => {
    setProject(loadProject());
  }, []);

  useEffect(() => {
    if (project) saveProject(project);
  }, [project]);

  const currentDoc = project ? project.modules[project.currentModule] : null;
  const patchSegment = useMemo(
    () => currentDoc?.segments.find((segment) => segment.id === patchSegmentId),
    [currentDoc, patchSegmentId]
  );

  if (!project || !currentDoc) {
    return <main className="flex min-h-screen items-center justify-center text-slate-500">Loading EssayCraft…</main>;
  }

  function updateCurrentModule(updater: (segments: Segment[]) => Segment[]) {
    setProject((prev) => {
      if (!prev) return prev;
      const doc = prev.modules[prev.currentModule];
      return {
        ...prev,
        modules: {
          ...prev.modules,
          [prev.currentModule]: {
            ...doc,
            segments: updater(doc.segments),
            updatedAt: nowIso()
          }
        }
      };
    });
  }

  function handleUpdateSegmentText(segmentId: string, text: string) {
    updateCurrentModule((segments) => segments.map((segment) => (segment.id === segmentId ? { ...segment, text } : segment)));
  }

  function handleAddSegment() {
    const segment: Segment = { id: id("seg"), text: "New sentence. Press Refresh Highlighting when ready.", label: "plain" };
    updateCurrentModule((segments) => [...segments, segment]);
    setSelectedSegmentId(segment.id);
  }

  function handlePatchSubmit(text: string) {
    if (!patchSegmentId) return;
    setProject((prev) => {
      if (!prev) return prev;
      const doc = prev.modules[prev.currentModule];
      return {
        ...prev,
        modules: {
          ...prev.modules,
          [prev.currentModule]: {
            ...doc,
            patches: [
              {
                id: id("patch"),
                segmentId: patchSegmentId,
                text,
                createdAt: nowIso()
              },
              ...doc.patches
            ],
            updatedAt: nowIso()
          }
        }
      };
    });
    setPatchSegmentId(undefined);
    setStatus("Patch saved. Click Refresh Highlighting to ask AI to use it.");
  }

  async function handleRefresh() {
    if (!currentDoc.segments.length) {
      setStatus("Nothing to refresh yet.");
      return;
    }

    setLoading(true);
    setStatus("Refreshing rhetorical labels…");
    try {
      const response = await fetch("/api/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: project.topic,
          moduleNumber: project.currentModule,
          segments: currentDoc.segments,
          patches: currentDoc.patches
        })
      });

      const data = (await response.json()) as RefreshResponse & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Refresh failed.");

      setProject((prev) => {
        if (!prev) return prev;
        const doc = prev.modules[prev.currentModule];
        const snapDoc = addSnapshot(doc, "Before refresh highlighting");
        const byId = new Map(data.segments.map((segment) => [segment.id, segment]));
        return {
          ...prev,
          modules: {
            ...prev.modules,
            [prev.currentModule]: {
              ...snapDoc,
              segments: doc.segments.map((segment) => {
                const next = byId.get(segment.id);
                return next
                  ? { ...segment, label: next.label, confidence: next.confidence, aiComment: next.aiComment }
                  : segment;
              }),
              updatedAt: nowIso()
            }
          }
        };
      });
      setStatus(data.globalFeedback?.[0] ?? "Highlights refreshed.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Refresh failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateNext() {
    if (project.currentModule >= 6) {
      setStatus("Module 6 is the final module.");
      return;
    }

    setLoading(true);
    setStatus(`Generating Module ${project.currentModule + 1}…`);
    try {
      const response = await fetch("/api/generate-next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: project.topic,
          sourceModuleNumber: project.currentModule,
          sourceSegments: currentDoc.segments,
          sourcePatches: currentDoc.patches
        })
      });

      const data = (await response.json()) as GenerateNextResponse & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Generate Next failed.");

      const target = data.targetModuleNumber;
      setProject((prev) => {
        if (!prev) return prev;
        const targetDoc = prev.modules[target];
        const withSnapshot = addSnapshot(targetDoc, `Before overwrite from Module ${prev.currentModule}`);
        return {
          ...prev,
          currentModule: target,
          modules: {
            ...prev.modules,
            [target]: {
              ...withSnapshot,
              segments: data.segments,
              patches: [],
              updatedAt: nowIso()
            }
          }
        };
      });
      setSelectedSegmentId(undefined);
      setPatchSegmentId(undefined);
      setStatus(data.summary || `Module ${target} generated and overwritten safely.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Generate Next failed.");
    } finally {
      setLoading(false);
    }
  }

  function handleSaveSnapshot() {
    setProject((prev) => {
      if (!prev) return prev;
      const doc = prev.modules[prev.currentModule];
      return {
        ...prev,
        modules: {
          ...prev.modules,
          [prev.currentModule]: addSnapshot(doc, "Manual snapshot")
        }
      };
    });
    setStatus("Snapshot saved.");
  }

  function handleRestoreSnapshot(snapshot: Snapshot) {
    setProject((prev) => {
      if (!prev) return prev;
      const doc = prev.modules[prev.currentModule];
      return {
        ...prev,
        modules: {
          ...prev.modules,
          [prev.currentModule]: {
            ...doc,
            segments: snapshot.segments.map((segment) => ({ ...segment })),
            patches: snapshot.patches.map((patch) => ({ ...patch })),
            updatedAt: nowIso()
          }
        }
      };
    });
    setStatus("Snapshot restored.");
  }

  function switchModule(moduleNumber: ModuleNumber) {
    setProject((prev) => (prev ? { ...prev, currentModule: moduleNumber } : prev));
    setSelectedSegmentId(undefined);
    setPatchSegmentId(undefined);
  }

  function handleResetDemo() {
    resetProjectStorage();
    window.location.reload();
  }

  async function handleCopyRichText() {
    await copyRichText(currentDoc.segments);
    setStatus("Rich text copied. Paste into Word/Docs to test highlight preservation.");
  }

  function handleDownloadHtml() {
    if (project.currentModule === 6) {
      setFinishOpen(true);
      return;
    }
    downloadCurrentModuleHtml(project);
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="flex min-h-[calc(100vh-52px)]">
        <ModuleSidebar currentModule={project.currentModule} onSelect={switchModule} />
        <section className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="font-crayon text-3xl font-bold text-blue-700">EssayCraft</div>
              <label className="flex min-w-72 flex-1 items-center gap-2 text-sm text-slate-600">
                Topic
                <input
                  value={project.topic}
                  onChange={(event) => setProject((prev) => (prev ? { ...prev, topic: event.target.value } : prev))}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800 outline-none focus:ring-2 focus:ring-blue-300"
                />
              </label>
              <div className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">Module {project.currentModule} of 6</div>
            </div>
          </header>

          <Toolbar
            currentModule={project.currentModule}
            loading={loading}
            status={status}
            onPrev={() => switchModule(clampModule(project.currentModule - 1))}
            onNext={() => switchModule(clampModule(project.currentModule + 1))}
            onGenerateNext={handleGenerateNext}
            onRefresh={handleRefresh}
            onSaveSnapshot={handleSaveSnapshot}
            onCopyRichText={handleCopyRichText}
            onDownloadHtml={handleDownloadHtml}
            onDownloadJson={() => downloadProjectJson(project)}
            onResetDemo={handleResetDemo}
          />

          <div className="grid flex-1 grid-cols-1 gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h1 className="text-lg font-semibold text-slate-800">Current document: Module {project.currentModule}</h1>
                  <p className="text-sm text-slate-500">Click a sentence to edit. Press Enter on a sentence to add a patch note.</p>
                </div>
                <button className="btn-secondary" onClick={handleAddSegment}>Add Segment</button>
              </div>

              {patchSegment ? (
                <PatchPopover segmentText={patchSegment.text} onSubmit={handlePatchSubmit} onClose={() => setPatchSegmentId(undefined)} />
              ) : null}

              <Editor
                segments={currentDoc.segments}
                selectedSegmentId={selectedSegmentId}
                onSelect={setSelectedSegmentId}
                onUpdateText={handleUpdateSegmentText}
                onOpenPatch={setPatchSegmentId}
              />
            </div>

            <div className="space-y-4">
              <SnapshotPanel snapshots={currentDoc.snapshots} onRestore={handleRestoreSnapshot} />
              <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
                <h2 className="mb-2 font-semibold text-slate-800">Current patches</h2>
                {currentDoc.patches.length === 0 ? (
                  <p className="text-xs text-slate-500">No patch notes yet.</p>
                ) : (
                  <ul className="space-y-2 text-xs">
                    {currentDoc.patches.slice(0, 8).map((patch) => (
                      <li key={patch.id} className="rounded-xl bg-slate-50 p-2">{patch.text}</li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </section>
      </div>

      <HighlightKey />
      <FinishModal
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        onDownloadHtml={() => {
          downloadCurrentModuleHtml(project);
          setFinishOpen(false);
        }}
        onDownloadJson={() => {
          downloadProjectJson(project);
          setFinishOpen(false);
        }}
      />
    </main>
  );
}
