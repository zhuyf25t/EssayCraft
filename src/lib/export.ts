import type { Project, Segment } from "@/types/essaycraft";
import { LABELS } from "@/lib/labels";

const COLORS: Record<string, string> = {
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

export function segmentsToHtml(segments: Segment[]) {
  return segments
    .map((segment) => {
      const safe = escapeHtml(segment.text);
      const color = COLORS[segment.label] ?? "transparent";
      return `<span data-label="${segment.label}" style="background-color:${color}; padding:2px 3px; border-radius:4px;">${safe}</span>`;
    })
    .join(" ");
}

export async function copyRichText(segments: Segment[]) {
  const html = segmentsToHtml(segments);
  const text = segments.map((segment) => segment.text).join(" ");

  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    const item = new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([text], { type: "text/plain" })
    });
    await navigator.clipboard.write([item]);
    return;
  }

  await navigator.clipboard.writeText(text);
}

export function downloadProjectJson(project: Project) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  triggerDownload(blob, `${slugify(project.title || "essaycraft")}.json`);
}

export function downloadCurrentModuleHtml(project: Project) {
  const doc = project.modules[project.currentModule];
  const legend = Object.entries(LABELS)
    .filter(([key]) => key !== "plain")
    .map(([key, value]) => `<li><span style="background:${COLORS[key]}; padding:2px 8px; border-radius:4px;">${value.name}</span> — ${value.description}</li>`)
    .join("\n");

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(project.title)}</title></head>
<body style="font-family:Arial,sans-serif; line-height:1.7; padding:32px; max-width:900px; margin:auto;">
<h1>${escapeHtml(project.title)}</h1>
<p><strong>Topic:</strong> ${escapeHtml(project.topic)}</p>
<p><strong>Module:</strong> ${project.currentModule}</p>
<div>${segmentsToHtml(doc.segments)}</div>
<h2>Highlight Key</h2>
<ul>${legend}</ul>
<hr />
<p style="color:#64748b;">Generated with EssayCraft. Inspired by John-Paul Grima's argumentative essay workflow.</p>
</body></html>`;

  triggerDownload(new Blob([html], { type: "text/html" }), `${slugify(project.title || "essaycraft")}-module-${project.currentModule}.html`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "essaycraft";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
