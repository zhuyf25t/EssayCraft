"use client";

import { useState, type ReactNode } from "react";
import type { ModuleNumber } from "@/types/essaycraft";

type ToolbarProps = {
  currentModule: ModuleNumber;
  loading: boolean;
  status: string;
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

  return (
    <div data-testid="action-toolbar" className="relative z-20 shrink-0 border-b border-slate-200 bg-white/95 px-3 py-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <Group label="AI">
          <button className="btn-secondary whitespace-nowrap" onClick={props.onRefresh} disabled={props.loading}>Refresh Highlighting</button>
        </Group>

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
              <button className="btn-secondary w-full text-left" onClick={() => run(props.onTranslate)} disabled={props.loading}>Translate</button>
              <button className="btn-danger w-full text-left" onClick={() => run(props.onResetDemo)} disabled={props.loading}>Reset Demo</button>
            </PanelGroup>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-r border-slate-200 pr-2">
      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
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
