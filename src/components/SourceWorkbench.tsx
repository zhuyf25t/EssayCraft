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
  cars: NonNullable<SourceCard["cars"]>;
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
  cars: {
    credible: false,
    accurate: false,
    reasonable: false,
    support: false
  },
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
  const planningModule = moduleNumber <= 3;
  const sourceNeeds = useMemo(
    () => [...audit.sourceNeedMarkers, ...audit.placeholderSources.map((source) => source.title || "Source need placeholder")],
    [audit.placeholderSources, audit.sourceNeedMarkers]
  );
  const citationIssues = useMemo(
    () => planningModule ? [] : [...audit.evidenceWithoutCitation, ...annotations.filter((annotation) => annotation.label === "issue").map((annotation) => annotation.text)],
    [annotations, audit.evidenceWithoutCitation, planningModule]
  );
  const moduleFive = moduleNumber === 5;

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
      cars: draft.cars,
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
          <h2 className="text-sm font-semibold text-slate-800">{moduleFive ? "Citation & Reference Check" : "Research Source Cards"}</h2>
          <p className="text-xs text-slate-500">
            {moduleFive
              ? "Every source needs an in-text citation and a reference-list entry from your source card."
              : "Add sources you actually found. EssayCraft will not search the web or invent source details."}
          </p>
        </div>
        {moduleFive ? <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">Module 5 check</span> : <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">manual</span>}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <Metric label="Citation gaps" value={planningModule ? 0 : audit.citationNeededMarkers.length + audit.evidenceWithoutCitation.length} tone="red" />
        <Metric label="Real sources" value={audit.realSources.length} tone="blue" />
        <Metric label="In-text cites" value={audit.inTextCitations.length} tone="slate" />
        <Metric label="Source needs" value={sourceNeeds.length} tone="amber" />
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
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <div className="mb-1 text-xs font-semibold text-slate-600">CARS check</div>
              <div className="grid grid-cols-2 gap-1 text-xs text-slate-600">
                <CarsBox label="Credible" checked={Boolean(draft.cars.credible)} onChange={(checked) => setDraft((prev) => ({ ...prev, cars: { ...prev.cars, credible: checked } }))} />
                <CarsBox label="Accurate" checked={Boolean(draft.cars.accurate)} onChange={(checked) => setDraft((prev) => ({ ...prev, cars: { ...prev.cars, accurate: checked } }))} />
                <CarsBox label="Reasonable" checked={Boolean(draft.cars.reasonable)} onChange={(checked) => setDraft((prev) => ({ ...prev, cars: { ...prev.cars, reasonable: checked } }))} />
                <CarsBox label="Support" checked={Boolean(draft.cars.support)} onChange={(checked) => setDraft((prev) => ({ ...prev, cars: { ...prev.cars, support: checked } }))} />
              </div>
            </div>
            <textarea value={draft.credibilityNotes} onChange={(event) => setDraft((prev) => ({ ...prev, credibilityNotes: event.target.value }))} placeholder="Credibility notes" className="input min-h-14 w-full resize-y" />
          </>
        ) : null}
        <div className="grid grid-cols-[1fr_auto_auto] gap-2">
          <select value={draft.sourceType} onChange={(event) => setDraft((prev) => ({ ...prev, sourceType: event.target.value as SourceCard["sourceType"] }))} className="input">
            <option value="unknown">Unknown</option>
            <option value="scholarly">Scholarly</option>
            <option value="professional">Professional</option>
            <option value="government">Government</option>
            <option value="popular">Popular</option>
            <option value="social">Social</option>
          </select>
          <button className="btn-secondary" onClick={() => setExpanded((value) => !value)}>{expanded ? "Less" : "More"}</button>
          <button className="btn-secondary" onClick={submit}>Add real source</button>
        </div>
        <textarea value={draft.userNotes} onChange={(event) => setDraft((prev) => ({ ...prev, userNotes: event.target.value }))} placeholder="Useful quote, source note, or where this supports the essay" className="input min-h-16 w-full resize-y" />
      </div>

      <div className="mt-4 space-y-2">
        {sources.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            No source cards yet. Add a real source you found, such as a scholarly article title, author, year, and a note about which claim it supports. Source needs are planning reminders, not references.
          </p>
        ) : (
          sources.map((source) => {
            const inText = inTextCitationPreview(source);
            return (
              <div key={source.id} data-testid="source-card" className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-slate-800">{source.title || "Untitled source"}</div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${source.placeholder ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-700"}`}>
                    {source.placeholder ? "Source need, not a real source yet" : "Student supplied"}
                  </span>
                </div>
                <div className="mt-1 text-slate-500">{source.authors?.join(", ") || "No authors"} {source.year ? `(${source.year})` : ""}</div>
                <div className="mt-2 rounded-md bg-white p-2 text-slate-600">
                  <div>In-text preview: {source.placeholder ? "Not available until this is a real source card." : inText || "[missing author/year]"}</div>
                  <div>Reference preview: {source.placeholder ? "No reference entry. Replace this source need with student-supplied metadata first." : referencePreview(source)}</div>
                  <div>CARS: {carsSummary(source)}</div>
                  <div className="mt-1 text-amber-700">Built only from student-supplied metadata. Not verified by EssayCraft.</div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-600 disabled:opacity-50" onClick={() => onToggleVerified(source.id)} disabled={source.placeholder || !source.title || !source.authors?.length || !source.year}>
                    {source.verified ? "Student reviewed metadata" : "I reviewed this metadata"}
                  </button>
                  <button data-testid="source-insert-citation" className="rounded-md border border-blue-100 bg-white px-2 py-1 text-blue-700 disabled:opacity-50" onClick={() => onInsertCitation(source)} disabled={!inText || source.placeholder}>
                    Insert citation
                  </button>
                  <button className="rounded-md border border-red-100 bg-white px-2 py-1 text-red-600" onClick={() => onDelete(source.id)}>Delete</button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs text-amber-900">
        <div className="mb-2 font-semibold">Source needs to research</div>
        {sourceNeeds.length === 0 ? (
          <p>No planned source needs detected yet. Add a source card or create a source need from selected text.</p>
        ) : (
          <ul className="space-y-1">
            {sourceNeeds.slice(0, 5).map((need, index) => <li key={`${index}-${need.slice(0, 48)}`}>- {need}</li>)}
          </ul>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <button className="rounded-md border border-amber-200 bg-white px-2 py-1 text-amber-800" onClick={onAddPlaceholder}>Create source need</button>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-red-100 bg-red-50 p-3 text-xs text-red-800">
        <div className="mb-2 font-semibold">Citation gaps</div>
        {citationIssues.length === 0 ? (
          <p>{planningModule ? "Citation-gap checking becomes central in Module 4 and Module 5." : "No current gaps detected. Refresh highlighting to scan again."}</p>
        ) : (
          <ul className="space-y-1">
            {citationIssues.slice(0, 5).map((issue, index) => <li key={`${index}-${issue.slice(0, 48)}`}>- {issue}</li>)}
          </ul>
        )}
        {moduleFive ? (
          <div className="mt-2 space-y-1 text-red-800">
            <p>In-text citations with no source card: {audit.citationsWithoutSourceCard.length}</p>
            <p>Source cards not cited in essay: {audit.uncitedSources.length}</p>
            <p>Reference cards missing details: {audit.incompleteSources.length}</p>
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          {!planningModule ? (
            <button className="rounded-md border border-red-200 bg-white px-2 py-1 text-red-700" onClick={onMarkSelectionNeedsCitation}>Mark selected text as evidence</button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function CarsBox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-1">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} />
      <span>{label}</span>
    </label>
  );
}

function carsSummary(source: SourceCard) {
  const entries = [
    ["credible", "credible"],
    ["accurate", "accurate"],
    ["reasonable", "reasonable"],
    ["support", "support"]
  ] as const;
  const checked = entries.filter(([key]) => source.cars?.[key]).map(([, label]) => label);
  return checked.length ? checked.join(", ") : "not checked yet";
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
