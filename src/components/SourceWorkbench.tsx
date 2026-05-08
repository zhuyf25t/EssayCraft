"use client";

import { useMemo, useState } from "react";
import type { Annotation, SourceCard } from "@/types/essaycraft";
import { buildCitationAudit, inTextCitationPreview, referencePreview } from "@/lib/citationAudit";

type DraftSource = {
  title: string;
  authors: string;
  year: string;
  containerTitle: string;
  publisher: string;
  doi: string;
  url: string;
  sourceType: SourceCard["sourceType"];
  credibilityNotes: string;
  userNotes: string;
};

const EMPTY_SOURCE: DraftSource = {
  title: "",
  authors: "",
  year: "",
  containerTitle: "",
  publisher: "",
  doi: "",
  url: "",
  sourceType: "unknown",
  credibilityNotes: "",
  userNotes: ""
};

export function SourceWorkbench({
  moduleNumber,
  text,
  annotations,
  sources,
  onAdd,
  onToggleVerified,
  onDelete,
  onAddPlaceholder,
  onInsertCitation,
  onMarkSelectionNeedsCitation
}: {
  moduleNumber: number;
  text: string;
  annotations: Annotation[];
  sources: SourceCard[];
  onAdd: (source: Omit<SourceCard, "id" | "createdAt">) => void;
  onToggleVerified: (sourceId: string) => void;
  onDelete: (sourceId: string) => void;
  onAddPlaceholder: () => void;
  onInsertCitation: (source: SourceCard) => void;
  onMarkSelectionNeedsCitation: () => void;
}) {
  const [draft, setDraft] = useState<DraftSource>(EMPTY_SOURCE);
  const [expanded, setExpanded] = useState(false);
  const audit = useMemo(() => buildCitationAudit(text, annotations, sources), [annotations, sources, text]);
  const citationIssues = useMemo(
    () => [...audit.evidenceWithoutCitation, ...annotations.filter((annotation) => annotation.label === "issue").map((annotation) => annotation.text)],
    [annotations, audit.evidenceWithoutCitation]
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
      containerTitle: draft.containerTitle.trim(),
      publisher: draft.publisher.trim(),
      doi: draft.doi.trim(),
      url: draft.url.trim(),
      sourceType: draft.sourceType,
      credibilityNotes: draft.credibilityNotes.trim(),
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
          <p className="text-xs text-slate-500">Manual source cards only. No automatic search or verification.</p>
        </div>
        {moduleNumber === 5 ? <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">Module 5 check</span> : null}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <Metric label="Needs citation" value={audit.citationNeededMarkers.length + audit.evidenceWithoutCitation.length} tone="red" />
        <Metric label="Source cards" value={sources.length} tone="blue" />
        <Metric label="In-text cites" value={audit.inTextCitations.length} tone="slate" />
        <Metric label="Incomplete" value={audit.incompleteSources.length} tone="amber" />
      </div>

      <div className="mt-3 space-y-2">
        <input value={draft.title} onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))} placeholder="Source title" className="input w-full" />
        <div className="grid grid-cols-2 gap-2">
          <input value={draft.authors} onChange={(event) => setDraft((prev) => ({ ...prev, authors: event.target.value }))} placeholder="Authors separated by ;" className="input" />
          <input value={draft.year} onChange={(event) => setDraft((prev) => ({ ...prev, year: event.target.value }))} placeholder="Year" className="input" />
        </div>
        {expanded ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <input value={draft.containerTitle} onChange={(event) => setDraft((prev) => ({ ...prev, containerTitle: event.target.value }))} placeholder="Journal / container" className="input" />
              <input value={draft.publisher} onChange={(event) => setDraft((prev) => ({ ...prev, publisher: event.target.value }))} placeholder="Publisher" className="input" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input value={draft.doi} onChange={(event) => setDraft((prev) => ({ ...prev, doi: event.target.value }))} placeholder="DOI" className="input" />
              <input value={draft.url} onChange={(event) => setDraft((prev) => ({ ...prev, url: event.target.value }))} placeholder="URL" className="input" />
            </div>
            <textarea value={draft.credibilityNotes} onChange={(event) => setDraft((prev) => ({ ...prev, credibilityNotes: event.target.value }))} placeholder="Credibility notes" className="input min-h-14 w-full resize-y" />
          </>
        ) : null}
        <div className="grid grid-cols-[1fr_auto_auto] gap-2">
          <select value={draft.sourceType} onChange={(event) => setDraft((prev) => ({ ...prev, sourceType: event.target.value as SourceCard["sourceType"] }))} className="input">
            <option value="unknown">Unknown</option>
            <option value="scholarly">Scholarly</option>
            <option value="professional">Professional</option>
            <option value="popular">Popular</option>
            <option value="social">Social</option>
          </select>
          <button className="btn-secondary" onClick={() => setExpanded((value) => !value)}>{expanded ? "Less" : "More"}</button>
          <button className="btn-secondary" onClick={submit}>Add</button>
        </div>
        <textarea value={draft.userNotes} onChange={(event) => setDraft((prev) => ({ ...prev, userNotes: event.target.value }))} placeholder="Useful quote, source note, or where this supports the essay" className="input min-h-16 w-full resize-y" />
      </div>

      <div className="mt-4 space-y-2">
        {sources.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">No sources yet. Add real source details before final export.</p>
        ) : (
          sources.map((source) => {
            const inText = inTextCitationPreview(source);
            return (
              <div key={source.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs">
                <div className="font-semibold text-slate-800">{source.title || "Untitled source"}</div>
                <div className="mt-1 text-slate-500">{source.authors?.join(", ") || "No authors"} {source.year ? `(${source.year})` : ""}</div>
                <div className="mt-2 rounded-md bg-white p-2 text-slate-600">
                  <div>In-text preview: {inText || "[missing author/year]"}</div>
                  <div>Reference preview: {referencePreview(source)}</div>
                  <div className="mt-1 text-amber-700">Draft from your source card, not verified by EssayCraft.</div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-600 disabled:opacity-50" onClick={() => onToggleVerified(source.id)} disabled={source.placeholder || !source.title || !source.authors?.length || !source.year}>
                    {source.verified ? "User-checked" : "I checked this source"}
                  </button>
                  <button className="rounded-md border border-blue-100 bg-white px-2 py-1 text-blue-700 disabled:opacity-50" onClick={() => onInsertCitation(source)} disabled={!inText}>
                    Insert citation
                  </button>
                  {source.placeholder ? <span className="rounded-md bg-amber-100 px-2 py-1 text-amber-800">placeholder</span> : null}
                  <button className="rounded-md border border-red-100 bg-white px-2 py-1 text-red-600" onClick={() => onDelete(source.id)}>Delete</button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-3 text-xs text-red-800">
        <div className="mb-2 font-semibold">Citation gaps</div>
        {citationIssues.length === 0 ? (
          <p>No current gaps detected. Refresh highlighting to scan again.</p>
        ) : (
          <ul className="space-y-1">
            {citationIssues.slice(0, 5).map((issue) => <li key={issue}>- {issue}</li>)}
          </ul>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <button className="rounded-md border border-red-200 bg-white px-2 py-1 text-red-700" onClick={onMarkSelectionNeedsCitation}>Mark selection needs citation</button>
          <button className="rounded-md border border-red-200 bg-white px-2 py-1 text-red-700" onClick={onAddPlaceholder}>Add placeholder source card</button>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "red" | "blue" | "slate" | "amber" }) {
  const classes = {
    red: "bg-red-50 text-red-700",
    blue: "bg-blue-50 text-blue-700",
    slate: "bg-slate-50 text-slate-700",
    amber: "bg-amber-50 text-amber-700"
  };
  return (
    <div className={`rounded-lg px-2 py-2 ${classes[tone]}`}>
      <div className="text-base font-semibold">{value}</div>
      <div>{label}</div>
    </div>
  );
}
