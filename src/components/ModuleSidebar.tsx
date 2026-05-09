import type { ModuleNumber, Project } from "@/types/essaycraft";
import { MODULE_TITLES } from "@/lib/project";
import { moduleDisplayStatus, moduleStatusTone, type ModuleDisplayStatus } from "@/lib/moduleStatus";

const MODULES: ModuleNumber[] = [1, 2, 3, 4, 5, 6];

export function ModuleSidebar({ project, onSelect }: { project: Project; onSelect: (moduleNumber: ModuleNumber) => void }) {
  return (
    <aside data-testid="module-sidebar" className="flex h-full min-h-0 w-60 shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white/85 p-3">
      <div className="mb-4 flex shrink-0 items-start gap-3">
        <div className="rounded-lg border-2 border-blue-600 px-2 py-1 text-blue-700">EC</div>
        <div>
          <div className="font-crayon text-3xl font-bold text-blue-700">EssayCraft</div>
          <div className="text-xs text-slate-500">Write better essays, step by step.</div>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        <div className="absolute left-5 top-8 h-[calc(100%-4rem)] border-l border-dashed border-slate-300" aria-hidden="true" />
        {MODULES.map((moduleNumber) => {
          const doc = project.modules[moduleNumber];
          const active = moduleNumber === project.currentModule;
          const status = moduleDisplayStatus(doc, project.currentModule);
          const tone = moduleStatusTone(status);
          return (
            <button
              key={moduleNumber}
              onClick={() => onSelect(moduleNumber)}
              className={`relative z-10 grid w-full grid-cols-[2.35rem_1fr] items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                active
                  ? "border-blue-500 bg-blue-50 text-blue-800 shadow-sketch"
                  : status === "has issues"
                    ? "border-red-200 bg-red-50/70 text-slate-700 hover:bg-red-50"
                    : status === "done"
                      ? "border-emerald-200 bg-emerald-50/70 text-slate-700 hover:bg-emerald-50"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
              title={`Module ${moduleNumber}: ${MODULE_TITLES[moduleNumber]} - ${status}`}
            >
              <span className={`flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white text-sm font-bold ${active ? "border-blue-600 text-blue-700" : tone === "emerald" ? "border-emerald-600 text-emerald-700" : tone === "red" ? "border-red-400 text-red-600" : "border-slate-300 text-slate-500"}`}>
                {status === "done" && !active ? "ok" : moduleNumber}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Module {moduleNumber}</span>
                <span className="block text-sm font-semibold">{MODULE_TITLES[moduleNumber]}</span>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] ${statusClass(status)}`}>{status}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 shrink-0 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-2 text-xs text-slate-500">
        Local-first. AI runs through server routes; mock mode works without an API key.
      </div>
    </aside>
  );
}

function statusClass(status: ModuleDisplayStatus) {
  if (status === "has issues") return "bg-red-100 text-red-700";
  if (status === "done") return "bg-emerald-100 text-emerald-700";
  if (status === "current") return "bg-blue-100 text-blue-700";
  if (status === "in progress") return "bg-blue-100 text-blue-700";
  return "bg-slate-100 text-slate-500";
}
