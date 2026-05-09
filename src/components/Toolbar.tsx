"use client";

import { useState, type ReactNode } from "react";
import type { ModuleNumber } from "@/types/essaycraft";

type ToolbarProps = {
  currentModule: ModuleNumber;
  loading: boolean;
  status: string;
  lastAction: {
    tone: "info" | "success" | "error" | "warning";
    message: string;
    details?: string[];
    retryGenerate?: boolean;
  };
  onBack: () => void;
  onGenerateNext: () => void;
  onFinalizeExport: () => void;
  onRetryGenerate: () => void;
  onRefresh: () => void;
  onSaveSnapshot: () => void;
  onClearModule: () => void;
  onCopyRichText: () => void;
  onDownloadHtml: () => void;
  onDownloadJson: () => void;
  onImportJson: () => void;
  onResetDemo: () => void;
  onTranslate: () => void;
};

export function Toolbar(props: ToolbarProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  function run(action: () => void) {
    setMoreOpen(false);
    action();
  }

  const finalModule = props.currentModule >= 6;
  const showLastAction = props.lastAction.message !== "Ready" || props.lastAction.retryGenerate || props.lastAction.details?.length;

  return (
    <div data-testid="action-toolbar" className="relative z-20 shrink-0 border-b border-slate-200 bg-white/95 px-3 py-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <button className="btn-secondary whitespace-nowrap" onClick={props.onBack} disabled={props.currentModule <= 1 || props.loading}>
          Back to Module {Math.max(1, props.currentModule - 1)}
        </button>

        <button
          data-testid="workflow-generate"
          className="btn-primary min-w-72 whitespace-nowrap px-6 text-base"
          onClick={finalModule ? props.onFinalizeExport : props.onGenerateNext}
          disabled={props.loading}
        >
          {props.loading && !finalModule
            ? `Generating Module ${props.currentModule + 1}...`
            : finalModule
              ? "Finalize / Export"
              : `Generate Module ${props.currentModule + 1} from Module ${props.currentModule}`}
        </button>

        <button className="btn-secondary whitespace-nowrap" onClick={props.onRefresh} disabled={props.loading}>Refresh Highlighting</button>

        <button
          type="button"
          data-testid="toolbar-more"
          className="btn-secondary whitespace-nowrap"
          onClick={() => setMoreOpen((value) => !value)}
          disabled={props.loading}
          aria-expanded={moreOpen}
        >
          More tools
        </button>

        <div data-testid="toolbar-status" className="ml-auto min-w-0 truncate text-right text-xs text-slate-500">
          Module {props.currentModule} - {props.loading ? "Working..." : props.status}
        </div>
      </div>

      {showLastAction ? (
        <div data-testid="last-action" className={`mt-1 rounded-lg border px-3 py-1.5 text-sm ${lastActionClasses(props.lastAction.tone)}`} aria-live="polite">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="font-semibold">Last action:</span> {props.lastAction.message}
              {props.lastAction.details?.length ? (
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
                  {props.lastAction.details.slice(0, 3).map((detail, index) => <li key={`${index}-${detail.slice(0, 48)}`}>{detail}</li>)}
                </ul>
              ) : null}
            </div>
            {props.lastAction.retryGenerate ? (
              <button className="btn-secondary" onClick={props.onRetryGenerate} disabled={props.loading}>Retry</button>
            ) : null}
          </div>
        </div>
      ) : null}

      {moreOpen ? (
        <div data-testid="toolbar-more-panel" className="absolute left-3 top-[calc(100%+0.35rem)] w-[min(720px,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <div className="grid gap-3 md:grid-cols-3">
            <PanelGroup label="Module">
              <button className="btn-secondary w-full text-left" onClick={() => run(props.onSaveSnapshot)} disabled={props.loading}>Save Snapshot</button>
              <button className="btn-secondary w-full text-left" onClick={() => run(props.onClearModule)} disabled={props.loading}>Clear Module</button>
            </PanelGroup>
            <PanelGroup label="Export">
              <button className="btn-secondary w-full text-left" onClick={() => run(props.onCopyRichText)} disabled={props.loading}>Copy Rich Text</button>
              <button className="btn-secondary w-full text-left" onClick={() => run(props.onDownloadHtml)} disabled={props.loading}>Download HTML</button>
              <button className="btn-secondary w-full text-left" onClick={() => run(props.onDownloadJson)} disabled={props.loading}>Download JSON</button>
              <button className="btn-secondary w-full text-left" onClick={() => run(props.onImportJson)} disabled={props.loading}>Import JSON</button>
            </PanelGroup>
            <PanelGroup label="Tools">
              <button className="btn-secondary w-full text-left" onClick={() => run(props.onTranslate)} disabled={props.loading}>Reference Translation</button>
              <button className="btn-danger w-full text-left" onClick={() => run(props.onResetDemo)} disabled={props.loading}>Reset Demo</button>
            </PanelGroup>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PanelGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function lastActionClasses(tone: ToolbarProps["lastAction"]["tone"]) {
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-900";
  if (tone === "error") return "border-red-200 bg-red-50 text-red-900";
  return "border-blue-100 bg-blue-50 text-blue-900";
}
