import type { ModuleNumber } from "@/types/essaycraft";
import { stripEditorKernelMarkers } from "@/lib/noteKernel";

export function normalizeLineEndings(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function cleanGeneratedText(value: string, moduleNumber?: ModuleNumber) {
  let text = normalizeLineEndings(stripEditorKernelMarkers(value)).trim();
  text = stripCodeFences(text);
  text = stripHtml(text);
  text = decodeEscapedNewlinesWhenSafe(text);
  text = normalizeLineEndings(text);
  text = text.replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");

  if (moduleNumber === 4) {
    text = ensureDraftParagraphs(text);
  }

  if (moduleNumber === 6) {
    text = ensureReviewSections(text);
  }

  return text.trim();
}

export function ensureParagraphBreaks(value: string) {
  return normalizeLineEndings(value).replace(/\n{3,}/g, "\n\n");
}

export function hasUnsafeMarkup(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value) || /```/.test(value);
}

function stripCodeFences(value: string) {
  const trimmed = value.trim();
  const fence = trimmed.match(/^```(?:json|markdown|md|text|html)?\s*([\s\S]*?)\s*```$/i);
  return fence ? fence[1].trim() : trimmed.replace(/```(?:json|markdown|md|text|html)?/gi, "").replace(/```/g, "");
}

function stripHtml(value: string) {
  return value.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>\s*<p[^>]*>/gi, "\n\n").replace(/<\/?[^>]+>/g, "");
}

function decodeEscapedNewlinesWhenSafe(value: string) {
  if (!value.includes("\\n")) return value;
  const realNewlines = (value.match(/\n/g) ?? []).length;
  const escapedNewlines = (value.match(/\\n/g) ?? []).length;
  if (escapedNewlines >= realNewlines) {
    return value.replace(/\\n/g, "\n").replace(/\\"/g, '"');
  }
  return value;
}

function ensureDraftParagraphs(value: string) {
  if (value.includes("\n\n")) return value;
  const sentences = value.match(/[^.!?]+[.!?]+(?:\s+|$)/g);
  if (!sentences || sentences.length < 5) return value;
  const paragraphs: string[] = [];
  for (let index = 0; index < sentences.length; index += 3) {
    paragraphs.push(sentences.slice(index, index + 3).join(" ").replace(/\s+/g, " ").trim());
  }
  return paragraphs.join("\n\n");
}

function ensureReviewSections(value: string) {
  const headings = ["Editing checklist", "Proofreading checklist", "Conclusion check"];
  let text = value;
  for (const heading of headings) {
    text = text.replace(new RegExp(`\\s*(${escapeRegExp(heading)})`, "i"), "\n\n$1");
  }
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
