import type { Annotation, ModuleDocument, Project, SegmentLabel } from "@/types/essaycraft";
import { LABELS } from "@/lib/labels";
import { normalizeAnnotations, normalizeText } from "@/lib/annotations";

const COLORS: Record<SegmentLabel, string> = {
  background: "#fff3a3",
  thesis: "#ffd1dc",
  evidence: "#d9f7be",
  analysis: "#cce7ff",
  counterargument: "#ead7ff",
  citation: "#eeeeee",
  conclusion: "#ffd8a8",
  issue: "#ffc9c9",
  plain: "transparent"
};

export async function copyRichText(doc: ModuleDocument) {
  const html = documentHtmlFragment(doc.text, doc.annotations);

  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    const item = new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([doc.text], { type: "text/plain" })
    });
    await navigator.clipboard.write([item]);
    return;
  }

  await navigator.clipboard.writeText(doc.text);
}

export function downloadProjectJson(project: Project) {
  const safeProject = removeRuntimeOnlyData(project);
  const blob = new Blob([JSON.stringify(safeProject, null, 2)], { type: "application/json" });
  triggerDownload(blob, `${slugify(project.title || "essaycraft")}.json`);
}

export function downloadCurrentModuleHtml(project: Project) {
  const doc = project.modules[project.currentModule];
  const legend = Object.entries(LABELS)
    .map(([key, value]) => {
      const label = key as SegmentLabel;
      return `<li><span style="background:${COLORS[label]}; padding:2px 8px; border-radius:4px;">${escapeHtml(value.name)}</span> - ${escapeHtml(value.description)}</li>`;
    })
    .join("\n");

  const patches = doc.patches
    .map(
      (patch) =>
        `<li><strong>${escapeHtml(patch.anchorQuote || "Selected range")}:</strong> ${escapeHtml(patch.text)}</li>`
    )
    .join("\n");

  const sources = doc.sources
    .map((source) => `<li>${escapeHtml(formatSource(source))}</li>`)
    .join("\n");

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(project.title)}</title></head>
<body style="font-family:Arial,sans-serif; line-height:1.7; padding:32px; max-width:900px; margin:auto; color:#172033;">
<h1>${escapeHtml(project.title)}</h1>
<p><strong>Topic:</strong> ${escapeHtml(project.topic)}</p>
<p><strong>Module:</strong> ${project.currentModule} - ${escapeHtml(doc.title)}</p>
${documentHtmlFragment(doc.text, doc.annotations)}
<h2>Highlight Key</h2>
<ul>${legend}</ul>
${patches ? `<h2>Patch Notes</h2><ul>${patches}</ul>` : ""}
${sources ? `<h2>Source Cards</h2><ul>${sources}</ul>` : ""}
<hr />
<p style="color:#64748b;">Generated with EssayCraft. Inspired by John-Paul Grima's argumentative essay journey.</p>
</body></html>`;

  triggerDownload(new Blob([html], { type: "text/html" }), `${slugify(project.title || "essaycraft")}-module-${project.currentModule}.html`);
}

export function documentHtmlFragment(text: string, annotations: Annotation[]) {
  const normalized = normalizeText(text);
  const ranges = paragraphRanges(normalized);
  if (ranges.length === 0) return "<p><br /></p>";

  return ranges
    .map((range) => {
      const paragraph = renderAnnotatedInline(normalized, range.start, range.end, annotations);
      return `<p style="margin:0 0 1.1em 0;">${paragraph || "<br />"}</p>`;
    })
    .join("\n");
}

export function renderAnnotatedInline(text: string, start: number, end: number, annotations: Annotation[]) {
  const valid = normalizeAnnotations(text, annotations)
    .filter((annotation) => annotation.end > start && annotation.start < end)
    .map((annotation) => ({
      ...annotation,
      start: Math.max(annotation.start, start),
      end: Math.min(annotation.end, end)
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  let cursor = start;
  let html = "";

  for (const annotation of valid) {
    if (annotation.start > cursor) {
      html += escapeHtml(text.slice(cursor, annotation.start)).replaceAll("\n", "<br />");
    }

    const label = annotation.label;
    const value = escapeHtml(text.slice(annotation.start, annotation.end)).replaceAll("\n", "<br />");
    html += `<span data-label="${label}" title="${escapeHtml(annotation.comment ?? LABELS[label].description)}" style="background-color:${COLORS[label]}; padding:2px 3px; border-radius:4px;${label === "issue" ? " border-bottom:2px dashed #ef4444;" : ""}">${value}</span>`;
    cursor = annotation.end;
  }

  if (cursor < end) {
    html += escapeHtml(text.slice(cursor, end)).replaceAll("\n", "<br />");
  }

  return html;
}

function paragraphRanges(text: string) {
  const ranges: Array<{ start: number; end: number }> = [];
  let start = 0;
  const pattern = /\n{2,}/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    ranges.push({ start, end: match.index });
    start = match.index + match[0].length;
  }

  ranges.push({ start, end: text.length });
  return ranges.filter((range) => range.end > range.start || text.length === 0);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function removeRuntimeOnlyData(project: Project): Project {
  return JSON.parse(JSON.stringify(project)) as Project;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "essaycraft";
}

function formatSource(source: { title?: string; authors?: string[]; year?: string; sourceType?: string; verified?: boolean; placeholder?: boolean }) {
  const authors = source.authors?.filter(Boolean).join(", ");
  const bits = [authors, source.year, source.title, source.sourceType].filter(Boolean).join(". ");
  const status = source.placeholder ? "placeholder" : source.verified ? "user marked verified" : "unverified";
  return `${bits || "Untitled source"} (${status})`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
