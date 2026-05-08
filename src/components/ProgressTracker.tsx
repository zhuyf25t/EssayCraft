import type { ModuleNumber, Project } from "@/types/essaycraft";
import { MODULE_TITLES } from "@/lib/project";
import { moduleStatus } from "@/lib/moduleStatus";

type ProgressTrackerProps = {
  project: Project;
  actionSteps: string[];
  activeStep?: string;
  onSelect: (moduleNumber: ModuleNumber) => void;
};

export function ProgressTracker({ project, actionSteps, activeStep, onSelect }: ProgressTrackerProps) {
  const modules = [1, 2, 3, 4, 5, 6] as ModuleNumber[];

  return (
    <section className="space-y-2">
      <nav data-testid="module-progress" className="rounded-lg border border-slate-200 bg-white/90 p-2 shadow-sm" aria-label="Module progress">
        <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
          <span>Module progress</span>
          <span>
            Module {project.currentModule} of 6: {MODULE_TITLES[project.currentModule]}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {modules.map((moduleNumber) => {
            const doc = project.modules[moduleNumber];
            const status = moduleStatus(doc);
            const isCurrent = moduleNumber === project.currentModule;
            return (
              <button
                key={moduleNumber}
                type="button"
                onClick={() => onSelect(moduleNumber)}
                className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs transition ${
                  isCurrent
                    ? "border-blue-300 bg-blue-50 text-blue-700"
                    : status === "done"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : status === "has issues"
                        ? "border-red-200 bg-red-50 text-red-700"
                      : "border-slate-200 bg-slate-50 text-slate-500"
                }`}
                title={`Module ${moduleNumber}: ${MODULE_TITLES[moduleNumber]}`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-white font-semibold">
                  {status === "done" && !isCurrent ? "✓" : moduleNumber}
                </span>
                <span className="hidden truncate md:block">{MODULE_TITLES[moduleNumber]}</span>
                <span className="sr-only">{status}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {actionSteps.length ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900">
          {actionSteps.map((step) => (
            <span key={step} className={`rounded-full px-2 py-1 ${step === activeStep ? "bg-blue-600 text-white" : "bg-white text-blue-700"}`}>
              {step}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
