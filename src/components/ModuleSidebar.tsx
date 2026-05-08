import type { ModuleNumber, Project } from "@/types/essaycraft";
import { MODULE_TITLES } from "@/lib/project";

const MODULES: ModuleNumber[] = [1, 2, 3, 4, 5, 6];

export function ModuleSidebar({ project, onSelect }: { project: Project; onSelect: (moduleNumber: ModuleNumber) => void }) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white/85 p-4">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-lg border-2 border-blue-600 px-2 py-1 text-blue-700">EC</div>
        <div>
          <div className="font-crayon text-3xl font-bold text-blue-700">EssayCraft</div>
          <div className="text-xs text-slate-500">Write better essays, step by step.</div>
        </div>
      </div>

      <div className="relative space-y-3">
        <div className="absolute left-5 top-8 h-[calc(100%-4rem)] border-l border-dashed border-slate-300" aria-hidden="true" />
        {MODULES.map((moduleNumber) => {
          const doc = project.modules[moduleNumber];
          const active = moduleNumber === project.currentModule;
          const hasContent = doc.text.trim().length > 0;
          const hasIssues = doc.annotations.some((annotation) => annotation.label === "issue") || doc.text.includes("[citation needed]");
          const status = !hasContent ? "empty" : hasIssues ? "has issues" : doc.snapshots.length > 0 ? "done" : "draft";
          return (
            <button
              key={moduleNumber}
              onClick={() => onSelect(moduleNumber)}
              className={`relative z-10 grid w-full grid-cols-[2.5rem_1fr] items-center gap-3 rounded-lg border px-3 py-3 text-left transition ${
                active
                  ? "border-blue-500 bg-blue-50 text-blue-800 shadow-sketch"
                  : hasIssues
                    ? "border-red-200 bg-red-50/70 text-slate-700 hover:bg-red-50"
                    : hasContent
                      ? "border-emerald-200 bg-emerald-50/70 text-slate-700 hover:bg-emerald-50"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className={`flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white text-sm font-bold ${active ? "border-blue-600 text-blue-700" : hasContent ? "border-emerald-600 text-emerald-700" : "border-slate-300 text-slate-500"}`}>
                {hasContent && !active ? "ok" : moduleNumber}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Module {moduleNumber}</span>
                <span className="block text-sm font-semibold">{MODULE_TITLES[moduleNumber]}</span>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] ${hasIssues ? "bg-red-100 text-red-700" : hasContent ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{status}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-auto rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-500">
        Local-first MVP. AI runs only through server routes; mock mode works without an API key.
      </div>
    </aside>
  );
}
