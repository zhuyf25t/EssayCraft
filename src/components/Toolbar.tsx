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
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white/90 p-3">
      <div className="mr-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Module {props.currentModule} tools</div>
      <button className="btn-warning" onClick={props.onRefresh} disabled={props.loading}>Refresh Highlighting</button>
      <button className="btn-secondary" onClick={props.onSaveSnapshot} disabled={props.loading}>Save Snapshot</button>
      <button className="btn-secondary" onClick={props.onClearModule} disabled={props.loading}>Clear Module</button>
      <button className="btn-secondary" onClick={props.onCopyRichText} disabled={props.loading}>Copy Rich Text</button>
      <button className="btn-secondary" onClick={props.onDownloadHtml} disabled={props.loading}>Download HTML</button>
      <button className="btn-secondary" onClick={props.onDownloadJson} disabled={props.loading}>Download JSON</button>
      <button className="btn-secondary" onClick={props.onImportJson} disabled={props.loading}>Import JSON</button>
      <button className="btn-secondary" onClick={props.onTranslate} disabled={props.loading}>Translate</button>
      <button className="btn-danger" onClick={props.onResetDemo} disabled={props.loading}>Reset Demo</button>
      <div className="ml-auto min-w-48 text-right text-xs text-slate-500">{props.loading ? "Working..." : props.status}</div>
    </div>
  );
}
