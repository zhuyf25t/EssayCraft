"use client";

import type { TranslateResponse } from "@/types/essaycraft";

type TranslateMode = "en-to-zh" | "zh-to-en" | "auto-to-zh";

export function TranslateModal({
  open,
  sourceText,
  mode,
  loading,
  preview,
  onModeChange,
  onRequest,
  onCopy,
  onSendToAssistant,
  onClose
}: {
  open: boolean;
  sourceText: string;
  mode: TranslateMode;
  loading: boolean;
  preview?: TranslateResponse;
  onModeChange: (mode: TranslateMode) => void;
  onRequest: () => void;
  onCopy: () => void;
  onSendToAssistant: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div data-testid="translate-dialog" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-5xl rounded-xl border border-white bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-crayon text-2xl font-bold text-blue-700">Reference Translation</h2>
            <p className="text-sm text-slate-500">Preview-only reading aid. It never changes the original document.</p>
          </div>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <select value={mode} onChange={(event) => onModeChange(event.target.value as TranslateMode)} className="input max-w-64">
            <option value="en-to-zh">English to Simplified Chinese</option>
            <option value="zh-to-en">Simplified Chinese to English</option>
            <option value="auto-to-zh">Auto-detect to Simplified Chinese</option>
          </select>
          <button className="btn-primary" onClick={onRequest} disabled={loading}>{loading ? "Translating..." : "Create preview"}</button>
          {preview ? <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">Preview ready</span> : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Original</h3>
            <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{sourceText}</pre>
          </section>
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Translation / Chinese Reference</h3>
            <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-slate-800">{preview?.translatedText ?? "No preview yet."}</pre>
          </section>
        </div>

        {preview?.warnings.length ? (
          <ul data-testid="translate-status" className="mt-3 space-y-1 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
            {preview.warnings.map((warning, index) => <li key={`${index}-${warning.slice(0, 48)}`}>- {warning}</li>)}
          </ul>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>Close</button>
          <button className="btn-secondary" onClick={onSendToAssistant} disabled={!preview}>Send to Assistant</button>
          <button className="btn-primary" onClick={onCopy} disabled={!preview}>Copy translation</button>
        </div>
      </div>
    </div>
  );
}
