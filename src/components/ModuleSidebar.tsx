import { HighlightKey } from "@/components/HighlightKey";
import type { ModuleNumber, Project, SegmentLabel } from "@/types/essaycraft";
import { MODULE_TITLES } from "@/lib/project";
import { moduleDisplayStatus, moduleStatusTone, type ModuleDisplayStatus } from "@/lib/moduleStatus";

const MODULES: ModuleNumber[] = [1, 2, 3, 4, 5, 6];
const MODULE_ICONS: Record<ModuleNumber, string> = {
  1: "\u2736",
  2: "\u2315",
  3: "\u2630",
  4: "\u270e",
  5: "\u00a7",
  6: "\u2713"
};

export function ModuleSidebar({
  project,
  activeLabel,
  onSelect
}: {
  project: Project;
  activeLabel?: SegmentLabel;
  onSelect: (moduleNumber: ModuleNumber) => void;
}) {
  return (
    <aside data-testid="module-sidebar" className="flex h-full min-h-0 w-52 shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-[#fffdf7]/95 p-2">
      <div className="mb-1.5 flex shrink-0 items-start gap-2">
        <div className="rounded-lg border-2 border-blue-600 px-1.5 py-0.5 text-sm text-blue-700">EC</div>
        <div>
          <div className="font-crayon text-2xl font-bold leading-6 text-blue-700">EssayCraft</div>
          <div className="text-[11px] leading-3 text-slate-500">Write better essays.</div>
        </div>
      </div>

      <div className="relative shrink-0 space-y-1">
        <div className="absolute left-[1.15rem] top-6 h-[calc(100%-2.5rem)] border-l border-dashed border-slate-200" aria-hidden="true" />
        {MODULES.map((moduleNumber) => {
          const doc = project.modules[moduleNumber];
          const active = moduleNumber === project.currentModule;
          const status = moduleDisplayStatus(doc, project.currentModule);
          const tone = moduleStatusTone(status);
          return (
            <button
              key={moduleNumber}
              onClick={() => onSelect(moduleNumber)}
              className={`relative z-10 grid w-full grid-cols-[1.75rem_1fr] items-center gap-1.5 rounded-lg border px-1.5 py-1 text-left transition ${
                active
                  ? "border-blue-500 bg-blue-50 text-blue-800 shadow-sketch"
                  : status === "has issues"
                    ? "border-rose-200 bg-white text-slate-700 hover:bg-rose-50"
                    : status === "done"
                      ? "border-emerald-200 bg-emerald-50/70 text-slate-700 hover:bg-emerald-50"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
              title={`Module ${moduleNumber}: ${MODULE_TITLES[moduleNumber]} - ${status}`}
            >
              <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 bg-white text-xs font-bold ${active ? "border-blue-600 text-blue-700" : tone === "emerald" ? "border-emerald-600 text-emerald-700" : tone === "red" ? "border-rose-300 text-rose-600" : "border-slate-300 text-slate-500"}`}>
                {status === "done" && !active ? "\u2713" : MODULE_ICONS[moduleNumber]}
              </span>
              <span className="min-w-0">
                <span className="block text-[9px] font-semibold uppercase tracking-wide text-slate-400">Module {moduleNumber}</span>
                <span className="line-clamp-2 block text-[12px] font-semibold leading-3.5">{MODULE_TITLES[moduleNumber]}</span>
                <span className={`mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[9px] leading-none ${statusClass(status)}`}>{status}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-auto shrink-0 pt-2">
        <HighlightKey activeLabel={activeLabel} />
      </div>
    </aside>
  );
}

function statusClass(status: ModuleDisplayStatus) {
  if (status === "has issues") return "bg-rose-50 text-rose-700";
  if (status === "done") return "bg-emerald-100 text-emerald-700";
  if (status === "current") return "bg-blue-100 text-blue-700";
  if (status === "in progress") return "bg-blue-100 text-blue-700";
  return "bg-slate-100 text-slate-500";
}
