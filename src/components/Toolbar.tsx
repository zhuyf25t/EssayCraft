"use client";

import { useState } from "react";
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
};

export function Toolbar(props: ToolbarProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const finalModule = props.currentModule >= 6;
  const hasDetails = Boolean(props.lastAction.details?.length || props.lastAction.retryGenerate);
  const statusText = props.loading ? "Working..." : compactStatus(props.status, props.lastAction.message);

  return (
    <div data-testid="action-toolbar" className="relative z-20 shrink-0 border-b border-slate-200 bg-white/95 px-3 py-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <button className="btn-secondary whitespace-nowrap px-3 py-1.5 text-xs" onClick={props.onBack} disabled={props.currentModule <= 1 || props.loading}>
          Back to Module {Math.max(1, props.currentModule - 1)}
        </button>

        <button
          data-testid="workflow-generate"
          className="btn-primary min-w-[20rem] whitespace-nowrap px-5 py-1.5 text-sm"
          onClick={finalModule ? props.onFinalizeExport : props.onGenerateNext}
          disabled={props.loading}
        >
          {props.loading && !finalModule
            ? `Generating Module ${props.currentModule + 1}...`
            : finalModule
              ? "Finalize / Export"
              : `Generate Module ${props.currentModule + 1} from Module ${props.currentModule}`}
        </button>

        <button className="btn-secondary whitespace-nowrap px-3 py-1.5 text-xs" onClick={props.onRefresh} disabled={props.loading}>Refresh Highlighting</button>

        <div className="ml-auto flex min-w-0 items-center gap-2">
          <div
            data-testid="toolbar-status"
            className={`max-w-[22rem] truncate rounded-full border px-3 py-1 text-right text-xs ${statusClasses(props.lastAction.tone)}`}
            title={statusText}
            aria-live="polite"
          >
            Module {props.currentModule} - {statusText}
          </div>
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

      {detailsOpen && hasDetails ? (
        <div data-testid="status-details-popover" className="absolute right-3 top-[calc(100%+0.35rem)] w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-lg">
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

function statusClasses(tone: ToolbarProps["lastAction"]["tone"]) {
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-800";
  if (tone === "error") return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}
