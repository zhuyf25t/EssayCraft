"use client";

import type { Patch } from "@/types/essaycraft";

export function PatchList({
  patches,
  onJump,
  onEdit,
  onResolve,
  onDelete
}: {
  patches: Patch[];
  onJump: (patch: Patch) => void;
  onEdit: (patch: Patch) => void;
  onResolve: (patch: Patch) => void;
  onDelete: (patch: Patch) => void;
}) {
  if (!patches.length) return null;

  return (
    <section data-testid="patch-list" className="panel max-h-40 shrink-0 overflow-auto py-3">
      <h2 className="mb-2 text-sm font-semibold text-slate-800">Patch notes</h2>
      <div className="grid gap-2">
        {patches.map((patch, index) => (
          <article key={patch.id} data-testid="patch-list-item" className="rounded-lg border border-amber-100 bg-amber-50/70 p-2 text-xs text-amber-950">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">Patch {index + 1}</div>
                <div className="mt-1 line-clamp-1 text-amber-900/80">{patch.anchorQuote || "Current cursor"}</div>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${patch.stale ? "bg-red-100 text-red-700" : patch.resolved ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-800"}`}>
                {patch.stale ? "Needs re-anchor" : patch.resolved ? "resolved" : "open"}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-wrap rounded-md bg-white/80 p-2 text-slate-700">{patch.text}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="rounded-md border border-amber-200 bg-white px-2 py-1 text-amber-800" onClick={() => onJump(patch)}>Jump to text</button>
              <button className="rounded-md border border-amber-200 bg-white px-2 py-1 text-amber-800" onClick={() => onEdit(patch)}>Edit</button>
              <button className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-600" onClick={() => onResolve(patch)}>{patch.resolved ? "Reopen" : "Resolve"}</button>
              <button className="rounded-md border border-red-100 bg-white px-2 py-1 text-red-600" onClick={() => onDelete(patch)}>Delete</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
