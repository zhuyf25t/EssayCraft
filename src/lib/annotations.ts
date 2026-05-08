import type { Annotation, SegmentLabel } from "@/types/essaycraft";
import { deterministicId } from "@/lib/utils";
import { normalizeLineEndings } from "@/lib/textFormat";

const LABEL_SEQUENCE: SegmentLabel[] = [
  "background",
  "thesis",
  "evidence",
  "analysis",
  "counterargument",
  "citation",
  "conclusion"
];

type Range = {
  start: number;
  end: number;
  text: string;
};

export function normalizeText(value: string) {
  return normalizeLineEndings(value);
}

export function normalizeAnnotations(text: string, annotations: Annotation[]) {
  const normalizedText = normalizeText(text);
  const sorted = annotations
    .map((annotation) => repairAnnotation(normalizedText, annotation))
    .filter((annotation): annotation is Annotation => Boolean(annotation))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const result: Annotation[] = [];
  let lastEnd = -1;

  for (const annotation of sorted) {
    if (annotation.start < lastEnd) continue;
    result.push(annotation);
    lastEnd = annotation.end;
  }

  return result;
}

export function exactAnnotations(text: string, annotations: Annotation[]) {
  const normalizedText = normalizeText(text);
  const warnings: string[] = [];
  const sorted = annotations
    .filter((annotation) => {
      const valid =
        annotation.start >= 0 &&
        annotation.end > annotation.start &&
        annotation.end <= normalizedText.length &&
        normalizedText.slice(annotation.start, annotation.end) === annotation.text;
      if (!valid) warnings.push(`Dropped invalid ${annotation.label} annotation at ${annotation.start}-${annotation.end}.`);
      return valid;
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const result: Annotation[] = [];
  let lastEnd = -1;
  for (const annotation of sorted) {
    if (annotation.start < lastEnd) {
      warnings.push(`Dropped overlapping ${annotation.label} annotation at ${annotation.start}-${annotation.end}.`);
      continue;
    }
    result.push(annotation);
    lastEnd = annotation.end;
  }

  return { annotations: result, warnings };
}

export function repairAnnotation(text: string, annotation: Annotation): Annotation | null {
  const start = Math.max(0, Math.min(text.length, annotation.start));
  const end = Math.max(start, Math.min(text.length, annotation.end));
  const slice = text.slice(start, end);

  if (slice && slice === annotation.text) {
    return { ...annotation, start, end, text: slice };
  }

  const quote = annotation.text.trim();
  if (!quote) return null;

  const found = text.indexOf(quote);
  if (found >= 0) {
    return {
      ...annotation,
      start: found,
      end: found + quote.length,
      text: quote
    };
  }

  return null;
}

export function buildMockAnnotations(text: string): Annotation[] {
  return sentenceRanges(text)
    .filter((range) => range.text.trim().length > 0)
    .map((range, index) => ({
      id: deterministicId("ann", `${range.start}:${range.end}:${range.text}:${index}`),
      start: range.start,
      end: range.end,
      text: range.text,
      label: guessLabel(range.text, index),
      confidence: 0.64,
      comment: "Local fallback label. Refresh highlighting to request provider labels when configured."
    }));
}

export function sentenceRangeAt(text: string, start: number, end = start): Range {
  const normalized = normalizeText(text);
  const boundedStart = Math.max(0, Math.min(normalized.length, start));
  const boundedEnd = Math.max(boundedStart, Math.min(normalized.length, end));

  if (boundedEnd > boundedStart) {
    return {
      start: boundedStart,
      end: boundedEnd,
      text: normalized.slice(boundedStart, boundedEnd)
    };
  }

  const ranges = sentenceRanges(normalized);
  const found = ranges.find((range) => boundedStart >= range.start && boundedStart < range.end);
  if (found) return found;

  return {
    start: boundedStart,
    end: boundedStart,
    text: ""
  };
}

export function sentenceRanges(text: string): Range[] {
  const normalized = normalizeText(text);
  const ranges: Range[] = [];
  const pattern = /[^\n.!?]+(?:[.!?]+|$)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(normalized)) !== null) {
    const raw = match[0];
    const leading = raw.match(/^\s*/)?.[0].length ?? 0;
    const trailing = raw.match(/\s*$/)?.[0].length ?? 0;
    const start = match.index + leading;
    const end = match.index + raw.length - trailing;
    if (end > start) {
      ranges.push({ start, end, text: normalized.slice(start, end) });
    }
  }

  if (ranges.length === 0 && normalized.trim()) {
    const start = normalized.search(/\S/);
    const end = normalized.length - (normalized.match(/\s*$/)?.[0].length ?? 0);
    ranges.push({ start, end, text: normalized.slice(start, end) });
  }

  return ranges;
}

export function findIssueRanges(text: string): Annotation[] {
  const annotations: Annotation[] = [];
  const pattern = /\[citation needed\]/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    annotations.push({
      id: deterministicId("ann", `${match.index}:${match[0]}`),
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
      label: "issue",
      confidence: 0.9,
      comment: "Missing source support."
    });
  }

  return annotations;
}

export function annotationAtOffset(annotations: Annotation[], offset: number) {
  return annotations.find((annotation) => offset >= annotation.start && offset < annotation.end);
}

export function guessLabel(text: string, index = 0): SegmentLabel {
  const lower = text.toLowerCase();
  if (lower.includes("[citation needed]") || lower.includes("needs source") || lower.includes("missing citation")) return "issue";
  if (/\([a-z][a-z\s&.,-]+,\s*\d{4}[a-z]?\)/i.test(text) || lower.includes("reference list") || lower.includes("doi:")) return "citation";
  if (lower.includes("this essay argues") || lower.includes("this paper argues") || lower.includes("working thesis") || lower.includes("thesis:")) return "thesis";
  if (lower.includes("some argue") || lower.includes("critics argue") || lower.includes("counterargument") || lower.includes("however")) return "counterargument";
  if (lower.includes("research") || lower.includes("study") || lower.includes("evidence") || lower.includes("data") || lower.includes("for example")) return "evidence";
  if (lower.includes("because") || lower.includes("therefore") || lower.includes("this means") || lower.includes("suggests") || lower.includes("as a result")) return "analysis";
  if (lower.includes("in conclusion") || lower.includes("overall") || lower.includes("final") || lower.includes("to conclude")) return "conclusion";
  if (lower.includes("topic:") || lower.includes("introduction") || lower.includes("background") || index === 0) return "background";
  return LABEL_SEQUENCE[index % LABEL_SEQUENCE.length] ?? "plain";
}
