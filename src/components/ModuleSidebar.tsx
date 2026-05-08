import type { ModuleNumber } from "@/types/essaycraft";

const MODULES: ModuleNumber[] = [1, 2, 3, 4, 5, 6];

export function ModuleSidebar({ currentModule, onSelect }: { currentModule: ModuleNumber; onSelect: (moduleNumber: ModuleNumber) => void }) {
  return (
    <aside className="flex w-28 shrink-0 flex-col gap-2 border-r border-slate-200 bg-white/80 p-3">
      <div className="mb-2 font-crayon text-xl font-bold text-blue-700">EssayCraft</div>
      {MODULES.map((moduleNumber) => {
        const active = moduleNumber === currentModule;
        return (
          <button
            key={moduleNumber}
            onClick={() => onSelect(moduleNumber)}
            className={`rounded-xl border px-3 py-3 text-left text-sm transition ${
              active
                ? "border-blue-500 bg-blue-50 font-semibold text-blue-700 shadow-sketch"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Module {moduleNumber}
          </button>
        );
      })}
      <div className="mt-auto rounded-xl border border-dashed border-slate-300 bg-slate-50 p-2 text-xs text-slate-500">
        MVP: local-only project state, AI through server routes.
      </div>
    </aside>
  );
}
