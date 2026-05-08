"use client";

import { useMemo, useState } from "react";
import type { Annotation, SourceCard } from "@/types/essaycraft";

type DraftSource = {
  title: string;
  authors: string;
  year: string;
  sourceType: SourceCard["sourceType"];
  userNotes: string;
};

const EMPTY_SOURCE: DraftSource = {
  title: "",
  authors: "",
  year: "",
  sourceType: "unknown",
  userNotes: ""
};

export function SourceWorkbench({
  moduleNumber,
  annotations,
  sources,
  onAdd,
  onToggleVerified,
  onDelete,
  onAddPlaceholder
}: {
  moduleNumber: number;
  annotations: Annotation[];
  sources: SourceCard[];
  onAdd: (source: Omit<SourceCard, "id" | "createdAt">) => void;
  onToggleVerified: (sourceId: string) => void;
  onDelete: (sourceId: string) => void;
  onAddPlaceholder: () => void;
}) {
  const [draft, setDraft] = useState<DraftSource>(EMPTY_SOURCE);
  const citationIssues = useMemo(
    () => annotations.filter((annotation) => annotation.label === "issue" || annotation.text.includes("[citation needed]")),
    [annotations]
  );

  function submit() {
    if (!draft.title.trim() && !draft.userNotes.trim()) return;
    onAdd({
      title: draft.title.trim() || "Untitled source",
      authors: draft.authors
        .split(";")
        .map((author) => author.trim())
        .filter(Boolean),
      year: draft.year.trim(),
      sourceType: draft.sourceType,
      userNotes: draft.userNotes.trim(),
      verified: false,
      placeholder: false
    });
    setDraft(EMPTY_SOURCE);
  }

  return (
    <section className="panel">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Sources & Citations</h2>
          <p className="text-xs text-slate-500">Manual source cards only. EssayCraft does not verify sources yet.</p>
        </div>
        {moduleNumber === 5 ? <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">Module 5 check</span> : null}
      </div>

      <div className="space-y-2">
        <input
          value={draft.title}
          onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
          placeholder="Source title"
          className="input"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            value={draft.authors}
            onChange={(event) => setDraft((prev) => ({ ...prev, authors: event.target.value }))}
            placeholder="Authors separated by ;"
            className="input"
          />
          <input
            value={draft.year}
            onChange={(event) => setDraft((prev) => ({ ...prev, year: event.target.value }))}
            placeholder="Year"
            className="input"
          />
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <select
            value={draft.sourceType}
            onChange={(event) => setDraft((prev) => ({ ...prev, sourceType: event.target.value as SourceCard["sourceType"] }))}
            className="input"
          >
            <option value="unknown">Unknown</option>
            <option value="scholarly">Scholarly</option>
            <option value="professional">Professional</option>
            <option value="popular">Popular</option>
            <option value="social">Social</option>
          </select>
          <button className="btn-secondary" onClick={submit}>Add</button>
        </div>
        <textarea
          value={draft.userNotes}
          onChange={(event) => setDraft((prev) => ({ ...prev, userNotes: event.target.value }))}
          placeholder="Credibility notes, useful quote, or where this source supports the essay"
          className="input min-h-16 resize-y"
        />
      </div>

      <div className="mt-4 space-y-2">
        {sources.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">No sources yet. Add real source details before final export.</p>
        ) : (
          sources.map((source) => (
            <div key={source.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs">
              <div className="font-semibold text-slate-800">{source.title || "Untitled source"}</div>
              <div className="mt-1 text-slate-500">{source.authors?.join(", ") || "No authors"} {source.year ? `(${source.year})` : ""}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-600" onClick={() => onToggleVerified(source.id)}>
                  {source.verified ? "User marked verified" : "Mark verified"}
                </button>
                {source.placeholder ? <span className="rounded-md bg-amber-100 px-2 py-1 text-amber-800">placeholder</span> : null}
                <button className="rounded-md border border-red-100 bg-white px-2 py-1 text-red-600" onClick={() => onDelete(source.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-3 text-xs text-red-800">
        <div className="mb-2 font-semibold">Citation gaps</div>
        {citationIssues.length === 0 ? (
          <p>No current issue annotations. Refresh highlighting to scan for unsupported evidence.</p>
        ) : (
          <ul className="space-y-1">
            {citationIssues.slice(0, 5).map((issue) => (
              <li key={issue.id}>- {issue.text}</li>
            ))}
          </ul>
        )}
        <button className="mt-2 rounded-md border border-red-200 bg-white px-2 py-1 text-red-700" onClick={onAddPlaceholder}>
          Add placeholder source card
        </button>
      </div>
    </section>
  );
}
