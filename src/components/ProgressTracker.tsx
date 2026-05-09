import type { ModuleNumber, Project } from "@/types/essaycraft";
import { MODULE_TITLES } from "@/lib/project";
import { moduleDisplayStatus } from "@/lib/moduleStatus";

type ProgressTrackerProps = {
  project: Project;
  actionSteps?: string[];
  activeStep?: string;
  onSelect: (moduleNumber: ModuleNumber) => void;
};

export function ProgressTracker({ project, onSelect }: ProgressTrackerProps) {
  const modules = [1, 2, 3, 4, 5, 6] as ModuleNumber[];

  return (
    <section className="flex min-w-0 shrink-0 flex-col items-end gap-1">
      <nav
        data-testid="module-progress"
        className="flex min-w-0 items-center gap-3 rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 shadow-[1px_1px_0_rgba(30,41,59,0.06)]"
        aria-label="Compact module progress"
      >
        <span className="hidden max-w-52 truncate text-xs font-semibold text-slate-700 lg:inline">
          Module {project.currentModule} of 6: {MODULE_TITLES[project.currentModule]}
        </span>
        <div data-testid="compact-progress-circles" className="flex items-center gap-1.5">
          {modules.map((moduleNumber) => {
            const doc = project.modules[moduleNumber];
            const status = moduleDisplayStatus(doc, project.currentModule);
            const isCurrent = moduleNumber === project.currentModule;
            return (
              <button
                key={moduleNumber}
                type="button"
                onClick={() => onSelect(moduleNumber)}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition ${
                  isCurrent
                    ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                    : status === "done"
                      ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                      : status === "has issues"
                        ? "border-red-300 bg-red-50 text-red-600"
                        : "border-slate-300 bg-slate-50 text-slate-500"
                }`}
                title={`Module ${moduleNumber}: ${MODULE_TITLES[moduleNumber]} (${status})`}
                aria-label={`Open Module ${moduleNumber}: ${MODULE_TITLES[moduleNumber]}, ${isCurrent ? "current" : status}`}
              >
                {status === "done" && !isCurrent ? "ok" : moduleNumber}
              </button>
            );
          })}
        </div>
      </nav>

    </section>
  );
}
