import type { ModuleNumber } from "@/types/essaycraft";
import type { ReactNode } from "react";

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
  return (
    <div data-testid="action-toolbar" className="shrink-0 border-b border-slate-200 bg-white/90 px-3 py-2">
      <div className="flex items-center gap-2 overflow-x-auto">
        <Group label="AI">
          <button className="btn-warning whitespace-nowrap" onClick={props.onRefresh} disabled={props.loading}>Refresh Highlighting</button>
        </Group>
        <Group label="Module">
          <button className="btn-secondary whitespace-nowrap" onClick={props.onSaveSnapshot} disabled={props.loading}>Save Snapshot</button>
          <button className="btn-secondary whitespace-nowrap" onClick={props.onClearModule} disabled={props.loading}>Clear Module</button>
        </Group>
        <Group label="Export">
          <button className="btn-secondary whitespace-nowrap" onClick={props.onCopyRichText} disabled={props.loading}>Copy Rich Text</button>
          <button className="btn-secondary whitespace-nowrap" onClick={props.onDownloadHtml} disabled={props.loading}>HTML</button>
          <button className="btn-secondary whitespace-nowrap" onClick={props.onDownloadJson} disabled={props.loading}>JSON</button>
          <button className="btn-secondary whitespace-nowrap" onClick={props.onImportJson} disabled={props.loading}>Import</button>
        </Group>
        <Group label="Tools">
          <button className="btn-secondary whitespace-nowrap" onClick={props.onTranslate} disabled={props.loading}>Translate</button>
          <button className="btn-danger whitespace-nowrap" onClick={props.onResetDemo} disabled={props.loading}>Reset Demo</button>
        </Group>
        <div data-testid="toolbar-status" className="ml-auto min-w-48 shrink-0 text-right text-xs text-slate-500">{props.loading ? "Working..." : props.status}</div>
      </div>
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
