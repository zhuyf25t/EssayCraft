"use client";

import { useState } from "react";
import type { ModuleNumber } from "@/types/essaycraft";

export function ExportPanel({
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
        assistTimeoutMs: 0,
        refreshTimeoutMs: 0,
        translateTimeoutMs: 0,
        generateTimeoutMs: 0,
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
                <p>Task timeouts: checking...</p>
              </>
            ) : null}
            {diagnostics ? (
              <>
                <p>Provider configured: {diagnostics.providerConfigured ? "yes" : "no"}</p>
                <p>Force mock: {diagnostics.forceMock ? "on" : "off"}</p>
                <p>Fast model: {diagnostics.fastModel}</p>
                <p>Default model: {diagnostics.model}</p>
                <p>Assist timeout: {diagnostics.assistTimeoutMs}ms</p>
                <p>Refresh timeout: {diagnostics.refreshTimeoutMs}ms</p>
                <p>Translate timeout: {diagnostics.translateTimeoutMs}ms</p>
                <p>Generate timeout: {diagnostics.generateTimeoutMs}ms</p>
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
  assistTimeoutMs: number;
  refreshTimeoutMs: number;
  translateTimeoutMs: number;
  generateTimeoutMs: number;
  baseUrlConfigured: boolean;
  note: string;
};
