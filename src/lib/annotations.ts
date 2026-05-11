import type { Annotation, SegmentLabel } from "@/types/essaycraft";
import { deterministicId } from "@/lib/utils";
import { normalizeLineEndings } from "@/lib/textFormat";

const LABEL_SEQUENCE: SegmentLabel[] = [
  "background",
  "thesis",
  "evidence",
  "analysis",
  "counterargument",
  "conclusion"
];

const MAX_FALLBACK_RANGE = 350;

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

export function transformAnnotationsForTextEdit(oldText: string, newText: string, annotations: Annotation[]) {
  const before = normalizeText(oldText);
  const after = normalizeText(newText);
  const edit = changedRange(before, after);
  if (!edit) return normalizeAnnotations(after, annotations);
  if (isLargeReplacement(before, after, edit)) return [];

  const delta = edit.newEnd - edit.oldEnd;
  const transformed = annotations.map((annotation) => {
    const start = Math.max(0, Math.min(before.length, annotation.start));
    const end = Math.max(start, Math.min(before.length, annotation.end));

    let nextStart = start;
    let nextEnd = end;

    if (edit.oldEnd <= start) {
      nextStart = start + delta;
      nextEnd = end + delta;
    } else if (edit.oldStart >= end) {
      nextStart = start;
      nextEnd = end;
    } else {
      nextStart = Math.min(start, edit.oldStart);
      nextEnd = end + delta;
    }

    nextStart = Math.max(0, Math.min(after.length, nextStart));
    nextEnd = Math.max(nextStart, Math.min(after.length, nextEnd));
    const nextText = after.slice(nextStart, nextEnd);
    return {
      ...annotation,
      start: nextStart,
      end: nextEnd,
      text: nextText
    };
  }).filter((annotation) => annotation.text.trim().length > 0);

  return normalizeAnnotations(after, transformed);
}

function changedRange(oldText: string, newText: string) {
  if (oldText === newText) return null;
  let start = 0;
  while (start < oldText.length && start < newText.length && oldText[start] === newText[start]) {
    start += 1;
  }

  let oldEnd = oldText.length;
  let newEnd = newText.length;
  while (oldEnd > start && newEnd > start && oldText[oldEnd - 1] === newText[newEnd - 1]) {
    oldEnd -= 1;
    newEnd -= 1;
  }

  return { oldStart: start, oldEnd, newEnd };
}

function isLargeReplacement(
  oldText: string,
  newText: string,
  edit: NonNullable<ReturnType<typeof changedRange>>
) {
  const oldChanged = edit.oldEnd - edit.oldStart;
  const newChanged = edit.newEnd - edit.oldStart;
  const oldRatio = oldText.length ? oldChanged / oldText.length : 0;
  const newRatio = newText.length ? newChanged / newText.length : 0;
  return oldText.length >= 80 && newText.length >= 20 && oldRatio > 0.65 && newRatio > 0.65;
}

export function guardAgainstCitationOverlabeling(text: string, annotations: Annotation[]) {
  const normalizedText = normalizeText(text);
  const normalized = normalizeAnnotations(normalizedText, annotations).map(relabelCitationIfOverbroad);
  if (!citationOverlabelDetected(normalizedText, normalized)) return normalized;
  return normalizeAnnotations(normalizedText, [...buildMockAnnotations(normalizedText), ...findIssueRanges(normalizedText)]).map(relabelCitationIfOverbroad);
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

  if (slice.trim() && slice === annotation.text) {
    return { ...annotation, start, end, text: slice };
  }

  const quote = annotation.text.trim();
  if (!quote) return null;

  if (slice.trim() && looselySameAnnotationText(slice, quote)) {
    return { ...annotation, start, end, text: slice };
  }

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

function looselySameAnnotationText(slice: string, quote: string) {
  const left = normalizeForAnnotationCompare(slice);
  const right = normalizeForAnnotationCompare(quote);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) {
    return Math.min(left.length, right.length) / Math.max(left.length, right.length) >= 0.72;
  }
  return characterSimilarity(left, right) >= 0.82;
}

function normalizeForAnnotationCompare(value: string) {
  return value
    .toLowerCase()
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s'"%.,()$-]/gu, "")
    .trim();
}

function characterSimilarity(left: string, right: string) {
  const max = Math.max(left.length, right.length);
  if (!max) return 1;
  const min = Math.min(left.length, right.length);
  let same = 0;
  for (let index = 0; index < min; index += 1) {
    if (left[index] === right[index]) same += 1;
  }
  return same / max;
}

export function buildMockAnnotations(text: string): Annotation[] {
  const ranges = rhetoricalUnitRanges(text);
  return ranges
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
  if (boundedStart === normalized.length && ranges.length) return ranges[ranges.length - 1];

  return {
    start: boundedStart,
    end: boundedStart,
    text: ""
  };
}

export function sentenceRanges(text: string): Range[] {
  const normalized = normalizeText(text);
  const ranges: Range[] = [];
  let offset = 0;

  for (const line of normalized.split("\n")) {
    if (line.trim()) {
      ranges.push(...smartSentenceLikeRanges(normalized, offset, offset + line.length, ".!?"));
    }
    offset += line.length + 1;
  }

  if (ranges.length === 0 && normalized.trim()) {
    const start = normalized.search(/\S/);
    const end = normalized.length - (normalized.match(/\s*$/)?.[0].length ?? 0);
    ranges.push({ start, end, text: normalized.slice(start, end) });
  }

  return ranges;
}

export function rhetoricalUnitRanges(text: string): Range[] {
  const normalized = normalizeText(text);
  const ranges: Range[] = [];
  let offset = 0;

  for (const line of normalized.split("\n")) {
    const leading = line.match(/^\s*/)?.[0].length ?? 0;
    const trailing = line.match(/\s*$/)?.[0].length ?? 0;
    const start = offset + leading;
    const end = offset + line.length - trailing;
    if (end > start) {
      const trimmedLine = normalized.slice(start, end);
      const lineUnits = keepLineAsUnit(trimmedLine)
        ? splitLongRange(normalized, start, end)
        : splitSentenceUnits(normalized, start, end);
      ranges.push(...lineUnits);
    }
    offset += line.length + 1;
  }

  return ranges.length ? ranges : sentenceRanges(normalized).flatMap((range) => splitLongRange(normalized, range.start, range.end));
}

function keepLineAsUnit(line: string) {
  const trimmed = line.trim();
  if (trimmed.length <= 140 && /^[-*]?\s*(topic|research question|question|working thesis|thesis|thesis map|reason\s*\d+|argument branch|argument|branch|claim|topic sentence|evidence needed|evidence to look for|evidence to use|analysis|analysis purpose|counterargument|opposing view|conclusion|conclusion plan|so what|implication|possible source type|suggested source type|search keywords|source status|cars check|in-text citation|citation|reference entry|reference list|references|works cited|source card|source details|source metadata|student-supplied source|manual source)\b/i.test(trimmed)) {
    return true;
  }
  if (trimmed.length <= 90 && /^[-*]?\s*[\w /-]+:\s*$/i.test(trimmed)) return true;
  if (trimmed.length <= 120 && /^[-*]?\s*(body paragraph|introduction plan|counterargument paragraph|conclusion plan)\b/i.test(trimmed)) return true;
  return false;
}

function splitSentenceUnits(text: string, start: number, end: number): Range[] {
  const ranges = smartSentenceLikeRanges(text, start, end, ".!?;").flatMap((range) => splitLongRange(text, range.start, range.end));

  if (!ranges.length && text.slice(start, end).trim()) return splitLongRange(text, start, end);
  return ranges;
}

function smartSentenceLikeRanges(text: string, start: number, end: number, delimiters: string): Range[] {
  if (delimiters === ".!?") {
    const intl = intlSentenceRanges(text, start, end);
    if (intl.length && !hasUnsafeSentenceBoundary(text, intl, start, end)) return intl;
  }
  return sentenceLikeRanges(text, start, end, delimiters);
}

function intlSentenceRanges(text: string, start: number, end: number): Range[] {
  if (typeof Intl === "undefined" || typeof Intl.Segmenter !== "function") return [];
  const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
  const ranges: Range[] = [];
  for (const item of segmenter.segment(text.slice(start, end))) {
    const raw = item.segment;
    const leading = raw.match(/^\s*/)?.[0].length ?? 0;
    const trailing = raw.match(/\s*$/)?.[0].length ?? 0;
    const rangeStart = start + item.index + leading;
    const rangeEnd = start + item.index + raw.length - trailing;
    if (rangeEnd > rangeStart) ranges.push({ start: rangeStart, end: rangeEnd, text: text.slice(rangeStart, rangeEnd) });
  }
  return ranges;
}

function sentenceLikeRanges(text: string, start: number, end: number, delimiters: string): Range[] {
  const ranges: Range[] = [];
  let cursor = start;
  let parenDepth = 0;
  let bracketDepth = 0;

  for (let index = start; index < end; index += 1) {
    const char = text[index] ?? "";
    if (char === "(") parenDepth += 1;
    if (char === "[") bracketDepth += 1;
    if ((char === ")" || char === "]") && (parenDepth || bracketDepth)) {
      if (char === ")") parenDepth = Math.max(0, parenDepth - 1);
      if (char === "]") bracketDepth = Math.max(0, bracketDepth - 1);
    }

    if (!delimiters.includes(char)) continue;
    if ((parenDepth > 0 || bracketDepth > 0) && char !== ";") continue;
    if (char === "." && (isDecimalPoint(text, index) || isAbbreviationPoint(text, index) || isUrlOrDoiPoint(text, index))) continue;
    if (char === ";" && !shouldSplitSemicolon(text, cursor, index, end)) continue;
    if (char !== ";" && !isLikelySentenceBoundary(text, index, end)) continue;

    let boundaryEnd = index + 1;
    while (boundaryEnd < end && delimiters.includes(text[boundaryEnd] ?? "")) boundaryEnd += 1;
    while (boundaryEnd < end && /["')\]]/.test(text[boundaryEnd] ?? "")) boundaryEnd += 1;

    const range = trimAbsoluteRange(text, cursor, boundaryEnd);
    if (range.end > range.start) ranges.push({ start: range.start, end: range.end, text: text.slice(range.start, range.end) });
    cursor = boundaryEnd;
    index = boundaryEnd - 1;
  }

  const finalRange = trimAbsoluteRange(text, cursor, end);
  if (finalRange.end > finalRange.start) {
    ranges.push({ start: finalRange.start, end: finalRange.end, text: text.slice(finalRange.start, finalRange.end) });
  }

  return ranges;
}

function isDecimalPoint(text: string, index: number) {
  return /\d/.test(text[index - 1] ?? "") && /\d/.test(text[index + 1] ?? "");
}

function isAbbreviationPoint(text: string, index: number) {
  const before = text.slice(Math.max(0, index - 24), index + 1).toLowerCase();
  if (/\b(?:e\.g|i\.e|u\.s|u\.k|et al|etc|vs|mr|mrs|ms|dr|prof|sr|jr|st|fig|no|vol|pp|p)\.$/.test(before)) return true;
  if (/(^|[\s([])[A-Z]\.$/.test(text.slice(Math.max(0, index - 4), index + 1)) && /^[\s\u00a0]*[A-Z]/.test(text.slice(index + 1, index + 8))) return true;
  return /\b(?:e|i|u)\.$/.test(before) && /[a-z]/i.test(text[index + 1] ?? "");
}

function isUrlOrDoiPoint(text: string, index: number) {
  const token = text.slice(0, index + 1).match(/[^\s<>"')\]]+$/)?.[0] ?? "";
  const after = text.slice(index + 1).match(/^[^\s<>"'([]+/)?.[0] ?? "";
  return Boolean(after) && /^(?:https?:\/\/|www\.|doi:|10\.)/i.test(`${token}${after}`);
}

function shouldSplitSemicolon(text: string, unitStart: number, index: number, end: number) {
  const next = nextNonSpaceIndex(text, index + 1, end);
  return index - unitStart > 120 && next < end && end - next > 80;
}

function isLikelySentenceBoundary(text: string, index: number, end: number) {
  let cursor = index + 1;
  while (cursor < end && /["')\]]/.test(text[cursor] ?? "")) cursor += 1;
  const whitespaceStart = cursor;
  while (cursor < end && /\s/.test(text[cursor] ?? "")) cursor += 1;
  const whitespace = text.slice(whitespaceStart, cursor);
  if (cursor >= end) return true;
  if (!whitespace) return false;
  if (whitespace.includes("\n")) return true;
  return startsSentenceAt(text, cursor);
}

function nextNonSpaceIndex(text: string, start: number, end: number) {
  let cursor = start;
  while (cursor < end && /\s/.test(text[cursor] ?? "")) cursor += 1;
  return cursor;
}

function startsSentenceAt(text: string, index: number): boolean {
  const char = text[index] ?? "";
  if (/["'(\[]/.test(char)) return startsSentenceAt(text, index + 1);
  return /[A-Z0-9]/.test(char);
}

function hasUnsafeSentenceBoundary(text: string, ranges: Range[], start: number, end: number) {
  return ranges.slice(0, -1).some((range) => range.end <= start || range.end >= end || isUnsafeSentenceBoundary(text, range.end));
}

function isUnsafeSentenceBoundary(text: string, boundary: number) {
  const previous = text[boundary - 1] ?? "";
  return previous === "." && (isDecimalPoint(text, boundary - 1) || isAbbreviationPoint(text, boundary - 1) || isUrlOrDoiPoint(text, boundary - 1));
}

function splitLongRange(text: string, start: number, end: number): Range[] {
  const trimmed = trimAbsoluteRange(text, start, end);
  const result: Range[] = [];
  let cursor = trimmed.start;

  while (cursor < trimmed.end) {
    const remaining = trimmed.end - cursor;
    if (remaining <= MAX_FALLBACK_RANGE) {
      const range = trimAbsoluteRange(text, cursor, trimmed.end);
      if (range.end > range.start) result.push({ start: range.start, end: range.end, text: text.slice(range.start, range.end) });
      break;
    }

    const target = Math.min(trimmed.end, cursor + MAX_FALLBACK_RANGE);
    const slice = text.slice(cursor, target);
    const breakAt = Math.max(
      slice.lastIndexOf(". "),
      slice.lastIndexOf("? "),
      slice.lastIndexOf("! "),
      slice.lastIndexOf("; "),
      slice.lastIndexOf(", "),
      slice.lastIndexOf(" ")
    );
    const nextEnd = breakAt > 120 ? cursor + breakAt + 1 : target;
    const range = trimAbsoluteRange(text, cursor, nextEnd);
    if (range.end > range.start) result.push({ start: range.start, end: range.end, text: text.slice(range.start, range.end) });
    cursor = Math.max(range.end, cursor + 1);
  }

  return result;
}

function trimAbsoluteRange(text: string, start: number, end: number) {
  let nextStart = Math.max(0, Math.min(text.length, start));
  let nextEnd = Math.max(nextStart, Math.min(text.length, end));
  while (nextStart < nextEnd && /\s/.test(text[nextStart] ?? "")) nextStart += 1;
  while (nextEnd > nextStart && /\s/.test(text[nextEnd - 1] ?? "")) nextEnd -= 1;
  return { start: nextStart, end: nextEnd };
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
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  if (/\[citation needed\]/i.test(trimmed) || lower.includes("missing citation")) return "issue";
  if (/^(topic|research question|question)\s*:/i.test(trimmed)) return "background";
  if (/^(hook|background|context|introduction(?: plan)?)\b/i.test(trimmed)) return "background";
  if (/^[-*]?\s*(working thesis|thesis|thesis map)\s*:/i.test(trimmed)) return "thesis";
  if (/^[-*]?\s*reason\s*\d+\s*:/i.test(trimmed)) return "thesis";
  if (/^[-*]?\s*(argument branch|argument|branch|claim)\s*\w*\s*:/i.test(trimmed)) return "thesis";
  if (/^[-*]?\s*(topic sentence)\s*:/i.test(trimmed)) return "thesis";
  if (/^[-*]?\s*(possible source type|suggested source type|search keywords|source status|cars check)\s*:/i.test(trimmed)) return "plain";
  if (/\[source needed(?::[^\]]*)?\]/i.test(trimmed)) return "evidence";
  if (/^[-*]?\s*(evidence needed|evidence to look for|evidence to use|evidence to find|evidence)\s*:/i.test(trimmed)) return "evidence";
  if (isPrimaryCitationSignal(trimmed) || isSourceSignalSentence(trimmed)) return "citation";
  if (/^[-*]?\s*(analysis|analysis purpose|response)\s*:/i.test(trimmed)) return "analysis";
  if (/^[-*]?\s*(counterargument|opposing view)\b/i.test(trimmed) || lower.includes("some readers may argue") || lower.includes("critics argue") || lower.includes("however")) return "counterargument";
  if (/^[-*]?\s*(conclusion|conclusion plan|rephrased thesis|so what|implication)\b/i.test(trimmed) || lower.includes("in conclusion") || lower.includes("overall") || lower.includes("to conclude")) return "conclusion";
  if (lower.includes("this essay argues") || lower.includes("this paper argues")) return "thesis";
  if (/^(the same report|this report|the report|the same study|this study|the study)\b/i.test(trimmed)) return "evidence";
  if (lower.includes("because") || lower.includes("therefore") || lower.includes("this means") || lower.includes("this shows") || lower.includes("suggests") || lower.includes("as a result")) return "analysis";
  if (lower.includes("research") || lower.includes("study") || lower.includes("data") || lower.includes("for example") || containsInTextCitation(trimmed)) return "evidence";
  if (index === 0) return "background";
  return LABEL_SEQUENCE[index % LABEL_SEQUENCE.length] ?? "plain";
}

export function relabelCitationIfOverbroad(annotation: Annotation): Annotation {
  if (annotation.label !== "citation" || isPrimaryCitationSignal(annotation.text) || isSourceSignalSentence(annotation.text)) return annotation;
  const nextLabel = guessLabelWithoutCitation(annotation.text);
  return {
    ...annotation,
    label: nextLabel === "citation" ? "evidence" : nextLabel,
    comment: annotation.comment
      ? `${annotation.comment} Rebalanced locally because this range uses citation as support rather than acting as a citation entry.`
      : "Rebalanced locally because this range uses citation as support rather than acting as a citation entry."
  };
}

export function isPrimaryCitationSignal(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^[-*]?\s*(in-text citation|citation|reference entry|reference list|references|works cited)\s*:/i.test(trimmed)) return true;
  if (/^[-*]?\s*(source card|source details|source metadata|student-supplied source|manual source)\s*:/i.test(trimmed)) return true;
  if (/^[-*]?\s*(references|works cited)$/i.test(trimmed)) return true;
  if (/^[-*]?\s*(doi|url)\s*:/i.test(trimmed)) return true;
  if (/^(https?:\/\/|doi:|https?:\/\/doi\.org\/)/i.test(trimmed)) return true;
  if (/^[-*]?\s*(?:\([A-Z][A-Za-z' .&-]+,\s*\d{4}[a-z]?\)[,;.\s]*)+$/i.test(trimmed)) return true;
  if (/^[A-Z][A-Za-z' -]+,\s*[A-Z](?:\.[,\s]*)?\s*\(\d{4}[a-z]?\)\./.test(trimmed)) return true;
  return false;
}

function guessLabelWithoutCitation(text: string): SegmentLabel {
  const trimmed = text.trim();
  if (!trimmed) return "plain";
  const lower = trimmed.toLowerCase();
  if (/\[citation needed\]/i.test(trimmed) || lower.includes("missing citation")) return "issue";
  if (/^(topic|research question|question|hook|background|context|introduction(?: plan)?)\b/i.test(trimmed)) return "background";
  if (/^[-*]?\s*(working thesis|thesis|thesis map|reason\s*\d+|argument branch|argument|branch|claim|topic sentence)\b/i.test(trimmed)) return "thesis";
  if (/\[source needed(?::[^\]]*)?\]/i.test(trimmed) || /^[-*]?\s*(evidence needed|evidence to look for|evidence to use|evidence to find|evidence)\s*:/i.test(trimmed)) return "evidence";
  if (/^[-*]?\s*(analysis|analysis purpose|response)\s*:/i.test(trimmed)) return "analysis";
  if (/^[-*]?\s*(counterargument|opposing view)\b/i.test(trimmed) || lower.includes("some readers may argue") || lower.includes("critics argue") || lower.includes("however")) return "counterargument";
  if (/^[-*]?\s*(conclusion|conclusion plan|rephrased thesis|so what|implication)\b/i.test(trimmed) || lower.includes("in conclusion") || lower.includes("overall") || lower.includes("to conclude")) return "conclusion";
  if (lower.includes("this essay argues") || lower.includes("this paper argues")) return "thesis";
  if (/^(the same report|this report|the report|the same study|this study|the study)\b/i.test(trimmed)) return "evidence";
  if (lower.includes("because") || lower.includes("therefore") || lower.includes("this means") || lower.includes("this shows") || lower.includes("suggests") || lower.includes("as a result")) return "analysis";
  if (lower.includes("research") || lower.includes("study") || lower.includes("data") || lower.includes("for example") || containsInTextCitation(trimmed)) return "evidence";
  return "plain";
}

function containsInTextCitation(value: string) {
  return /\([A-Z][A-Za-z' .&-]+,\s*\d{4}[a-z]?\)/.test(value);
}

function isSourceSignalSentence(value: string) {
  return /^(according to|as [A-Z][A-Za-z' -]+(?: et al\.)?\s+(?:argues?|notes?|explains?|reports?|shows?)|the (?:study|report|survey|article|source) (?:argues?|notes?|explains?|reports?|shows?)|data from|a \d{4} (?:study|report|survey))/i.test(value.trim());
}

function citationOverlabelDetected(text: string, annotations: Annotation[]) {
  const meaningfulLength = text.replace(/\s/g, "").length;
  if (!meaningfulLength) return false;
  if (/(^|\n)\s*(references|reference list|works cited)\b/i.test(text)) return false;

  const citationChars = annotations
    .filter((annotation) => annotation.label === "citation")
    .reduce((sum, annotation) => sum + annotation.text.replace(/\s/g, "").length, 0);
  if (citationChars / meaningfulLength <= 0.4) return false;

  const primaryCitationChars = annotations
    .filter((annotation) => annotation.label === "citation" && (isPrimaryCitationSignal(annotation.text) || isSourceSignalSentence(annotation.text)))
    .reduce((sum, annotation) => sum + annotation.text.replace(/\s/g, "").length, 0);
  return primaryCitationChars / meaningfulLength <= 0.4;
}

