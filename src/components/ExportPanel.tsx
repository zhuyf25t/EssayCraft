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
  const [providerTest, setProviderTest] = useState<AiProviderTest | null>(null);
  const [providerTesting, setProviderTesting] = useState(false);

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
        offlineMockAllowed: false,
        model: "unknown",
        fastModel: "unknown",
        highQualityModel: "unknown",
        interactiveTimeoutMs: 0,
        chatTimeoutMs: 0,
        editTimeoutMs: 0,
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

  async function testProvider() {
    setProviderTesting(true);
    setProviderTest(null);
    try {
      const response = await fetch("/api/diagnostics/test", { method: "POST" });
      const body = await response.json().catch(() => ({}));
      setProviderTest({
        ok: response.ok && Boolean(body.ok),
        message: body.message ?? (response.ok ? "Provider responded." : "Provider test failed."),
        providerMode: body.providerMode ?? "unavailable",
        latencyMs: body.latencyMs,
        modelUsed: body.modelUsed
      });
    } catch {
      setProviderTest({ ok: false, message: "Provider test failed.", providerMode: "unavailable" });
    } finally {
      setProviderTesting(false);
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
                <p>Offline mock allowed: {diagnostics.offlineMockAllowed ? "yes" : "no"}</p>
                <p>Fast model: {diagnostics.fastModel}</p>
                <p>Default model: {diagnostics.model}</p>
                <p>Chat timeout: {diagnostics.chatTimeoutMs}ms</p>
                <p>Edit timeout: {diagnostics.editTimeoutMs}ms</p>
                <p>Refresh timeout: {diagnostics.refreshTimeoutMs}ms</p>
                <p>Translate timeout: {diagnostics.translateTimeoutMs}ms</p>
                <p>Generate timeout: {diagnostics.generateTimeoutMs}ms</p>
                <p>{diagnostics.note}</p>
                <button type="button" className="btn-secondary mt-2 px-2 py-1 text-xs" onClick={testProvider} disabled={providerTesting}>
                  {providerTesting ? "Testing..." : "Test provider"}
                </button>
                {providerTest ? (
                  <p data-testid="ai-provider-test-result" className={providerTest.ok ? "text-emerald-700" : "text-rose-700"}>
                    {providerTest.providerMode}: {providerTest.message}
                    {typeof providerTest.latencyMs === "number" ? ` (${providerTest.latencyMs}ms)` : ""}
                  </p>
                ) : null}
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
  offlineMockAllowed: boolean;
  model: string;
  fastModel: string;
  highQualityModel: string;
  interactiveTimeoutMs: number;
  chatTimeoutMs: number;
  editTimeoutMs: number;
  assistTimeoutMs: number;
  refreshTimeoutMs: number;
  translateTimeoutMs: number;
  generateTimeoutMs: number;
  baseUrlConfigured: boolean;
  note: string;
};

type AiProviderTest = {
  ok: boolean;
  message: string;
  providerMode: "deepseek" | "mock" | "unavailable";
  latencyMs?: number;
  modelUsed?: string;
};
