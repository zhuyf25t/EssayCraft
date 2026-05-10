"use client";

import { useState } from "react";
import type { ModuleNumber } from "@/types/essaycraft";

type ToolbarProps = {
  currentModule: ModuleNumber;
  loading: boolean;
  busyAction?: "generate" | "refresh" | "assist" | "translate" | null;
  status: string;
  toastVisible: boolean;
  canUndo: boolean;
  hasOpenPatches: boolean;
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
  onUndo: () => void;
};

export function Toolbar(props: ToolbarProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const finalModule = props.currentModule >= 6;
  const hasDetails = Boolean(props.lastAction.details?.length || props.lastAction.retryGenerate);
  const statusText = props.loading ? busyStatus(props.busyAction) : compactStatus(props.status, props.lastAction.message);

  return (
    <div data-testid="action-toolbar" className="relative z-20 shrink-0 border-t border-slate-200 bg-white/95 px-4 py-2">
      <div data-testid="bottom-action-bar" className="mx-auto grid max-w-5xl grid-cols-[minmax(8rem,1fr)_minmax(18rem,2fr)_minmax(8rem,1fr)_minmax(8rem,1fr)] items-center gap-2">
        <button className="btn-secondary whitespace-nowrap px-3 py-2 text-sm" onClick={props.onBack} disabled={props.currentModule <= 1 || props.loading}>
          Back
        </button>

        <button
          data-testid="workflow-generate"
          aria-label={finalModule ? "Finalize / Export" : `Generate Module ${props.currentModule + 1} from Module ${props.currentModule}`}
          className="btn-primary whitespace-nowrap px-5 py-2 text-base shadow-sketch"
          onClick={finalModule ? props.onFinalizeExport : props.onGenerateNext}
          disabled={props.loading}
        >
          {props.loading && props.busyAction === "generate" && !finalModule
            ? `Generating Module ${props.currentModule + 1}...`
            : finalModule
              ? "Finalize / Export"
              : `Generate Module ${props.currentModule + 1} from Module ${props.currentModule}`}
        </button>

        <button className="btn-secondary whitespace-nowrap px-3 py-2 text-sm" onClick={props.onSaveSnapshot} disabled={props.loading}>
          Save Snapshot
        </button>

        <button className="btn-secondary whitespace-nowrap px-3 py-2 text-sm" onClick={props.onRefresh} disabled={props.loading}>
          {props.loading && props.busyAction === "refresh" ? "Refreshing" : props.hasOpenPatches ? "Apply Notes & Refresh" : "Refresh Highlighting"}
        </button>

        <div className="absolute right-4 top-2 flex min-w-0 items-center gap-2">
          {hasDetails ? (
            <button
              type="button"
              data-testid="status-details-button"
              className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              onClick={() => setDetailsOpen((value) => !value)}
              aria-expanded={detailsOpen}
            >
              Details
            </button>
          ) : null}
        </div>
      </div>

      {props.toastVisible && statusText !== "Saved" ? (
        <div
          data-testid="toolbar-status"
          className={`absolute bottom-[calc(100%+0.25rem)] right-4 z-30 flex max-w-[26rem] items-center gap-2 truncate rounded-full border px-3 py-1 text-xs shadow-sm ${statusClasses(props.lastAction.tone)}`}
          title={statusText}
          aria-live="polite"
        >
          <span className="truncate">{statusText}</span>
          {props.canUndo ? (
            <button type="button" className="rounded-full bg-white/80 px-2 py-0.5 font-semibold text-slate-700 hover:bg-white" onClick={props.onUndo}>
              Undo
            </button>
          ) : null}
        </div>
      ) : null}

      {detailsOpen && hasDetails ? (
        <div data-testid="status-details-popover" className="absolute bottom-[calc(100%+0.35rem)] right-4 w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-lg">
          <div className="mb-1 font-semibold text-slate-800">{props.lastAction.message}</div>
          {props.lastAction.details?.length ? (
            <ul className="space-y-1">
              {props.lastAction.details.slice(0, 5).map((detail, index) => <li key={`${index}-${detail.slice(0, 48)}`}>- {detail}</li>)}
            </ul>
          ) : null}
          {props.lastAction.retryGenerate ? (
            <button className="btn-secondary mt-2 px-2 py-1 text-xs" onClick={props.onRetryGenerate} disabled={props.loading}>Retry</button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function compactStatus(status: string, lastActionMessage: string) {
  const value = status && status !== "Ready" ? status : lastActionMessage;
  return value === "Ready" ? "Saved" : value;
}

function busyStatus(action: ToolbarProps["busyAction"]) {
  if (action === "refresh") return "Refreshing";
  if (action === "generate") return "Generating";
  if (action === "assist") return "Copilot thinking";
  if (action === "translate") return "Translating";
  return "Working...";
}

function statusClasses(tone: ToolbarProps["lastAction"]["tone"]) {
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-800";
  if (tone === "error") return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}
