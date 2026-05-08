import type { ModuleNumber } from "@/types/essaycraft";

type ToolbarProps = {
  currentModule: ModuleNumber;
  loading: boolean;
  status: string;
  onPrev: () => void;
  onNext: () => void;
  onGenerateNext: () => void;
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
  const canPrev = props.currentModule > 1;
  const canNext = props.currentModule < 6;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white/90 p-3">
      <button className="btn-secondary" onClick={props.onPrev} disabled={!canPrev || props.loading}>← Prev</button>
      <button className="btn-secondary" onClick={props.onNext} disabled={!canNext || props.loading}>Next →</button>
      <button className="btn-primary min-w-64" onClick={props.onGenerateNext} disabled={!canNext || props.loading}>
        Generate Module {Math.min(6, props.currentModule + 1)} from Module {props.currentModule}
      </button>
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
