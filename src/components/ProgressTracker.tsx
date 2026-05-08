import type { ModuleNumber, Project } from "@/types/essaycraft";

const MODULE_NAMES: Record<ModuleNumber, string> = {
  1: "Topic & Question",
  2: "Research & Evidence",
  3: "Outline",
  4: "Drafting",
  5: "Citation Check",
  6: "Final Review",
};

type ProgressTrackerProps = {
  project: Project;
  onSelect: (moduleNumber: ModuleNumber) => void;
};

export function ProgressTracker({ project, onSelect }: ProgressTrackerProps) {
  const modules = [1, 2, 3, 4, 5, 6] as ModuleNumber[];

  return (
    <nav className="rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm" aria-label="Module progress">
      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
        <span>Module progress</span>
        <span>
          Module {project.currentModule} of 6: {MODULE_NAMES[project.currentModule]}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {modules.map((moduleNumber, index) => {
          const doc = project.modules[moduleNumber];
          const hasContent = Boolean(doc?.segments?.some((segment) => segment.text.trim().length > 0));
          const isCurrent = moduleNumber === project.currentModule;
          return (
            <button
              key={moduleNumber}
              type="button"
              onClick={() => onSelect(moduleNumber)}
              className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-2 py-2 text-left text-xs transition ${
                isCurrent
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : hasContent
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-slate-50 text-slate-500"
              }`}
              title={`Module ${moduleNumber}: ${MODULE_NAMES[moduleNumber]}`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-white font-semibold">
                {hasContent && !isCurrent ? "✓" : moduleNumber}
              </span>
              <span className="hidden truncate md:block">{MODULE_NAMES[moduleNumber]}</span>
              {index < modules.length - 1 ? <span className="sr-only">then</span> : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
