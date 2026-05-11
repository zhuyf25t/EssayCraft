import type { Annotation, ModuleNumber } from "@/types/essaycraft";
import { normalizeAnnotations, relabelCitationIfOverbroad, rhetoricalUnitRanges } from "@/lib/annotations";

export type RefreshAnnotationValidation = {
  annotations: Annotation[];
  warnings: string[];
  usedFallback: boolean;
  reason?: string;
};

export function validateProviderRefreshAnnotations(
  text: string,
  annotations: Annotation[],
  moduleNumber: ModuleNumber,
  options: { requireCoverage?: boolean } = {}
): RefreshAnnotationValidation {
  const repaired = normalizeAnnotations(text, annotations);
  const warnings: string[] = repaired.length < annotations.length
    ? [`Repaired ${repaired.length} of ${annotations.length} provider annotation ranges.`]
    : [];
  const relabeled = repaired.map((annotation) => {
    const next = relabelCitationIfOverbroad(annotation);
    if (next.label !== annotation.label) {
      warnings.push(`Rebalanced overbroad citation annotation at ${annotation.start}-${annotation.end}.`);
    }
    return next;
  });

  if (text.trim() && relabeled.length === 0) {
    return {
      annotations: [],
      warnings: [...warnings, "Provider returned no exact annotation ranges."],
      usedFallback: true,
      reason: "Provider returned no exact annotation ranges."
    };
  }

  const granular = splitOverbroadProviderAnnotations(text, relabeled, warnings).map((annotation) => {
    const next = relabelExplicitCitationNeeded(annotation);
    if (next.label !== annotation.label) {
      warnings.push(`Marked explicit citation-needed placeholder as issue at ${annotation.start}-${annotation.end}.`);
    }
    return next;
  });
  const coverageWarning = options.requireCoverage === false ? "" : insufficientLongTextCoverage(text, granular);
  if (coverageWarning) {
    return {
      annotations: granular,
      warnings: [...warnings, coverageWarning],
      usedFallback: true,
      reason: coverageWarning
    };
  }

  if (citationOverlabelDetected(text, granular)) {
    return {
      annotations: granular,
      warnings: [...warnings, "Provider over-labeled citation ranges."],
      usedFallback: true,
      reason: "Provider over-labeled citation ranges."
    };
  }

  if (moduleNumber === 6 && lacksUsefulLabelMix(granular)) {
    return {
      annotations: granular,
      warnings: [...warnings, "Provider returned too little label variety for final review."],
      usedFallback: true,
      reason: "Provider returned too little label variety for final review."
    };
  }

  return {
    annotations: granular,
    warnings,
    usedFallback: false
  };
}

export function fallbackRefreshAnnotations(text: string, warnings: string[] = [], reason = "Local refresh fallback used."): RefreshAnnotationValidation {
  return {
    annotations: [],
    warnings: [...warnings, reason],
    usedFallback: true,
    reason
  };
}

function relabelExplicitCitationNeeded(annotation: Annotation): Annotation {
  if (!/\[citation needed\]/i.test(annotation.text)) return annotation;
  return {
    ...annotation,
    label: "issue",
    comment: annotation.comment?.trim()
      ? annotation.comment
      : "This text contains a citation-needed placeholder that must be resolved with a real source."
  };
}

function splitOverbroadProviderAnnotations(text: string, annotations: Annotation[], warnings: string[]) {
  const units = rhetoricalUnitRanges(text);
  const result: Annotation[] = [];

  for (const annotation of annotations) {
    const contained = units.filter((unit) =>
      unit.start >= annotation.start &&
      unit.end <= annotation.end &&
      unit.text.trim()
    );
    const shouldSplit = annotation.end - annotation.start > 350 || contained.length > 1;
    if (!shouldSplit || contained.length <= 1) {
      result.push(annotation);
      continue;
    }
    warnings.push(`Split overbroad ${annotation.label} annotation at ${annotation.start}-${annotation.end}.`);
    result.push(...contained.map((unit, index) => ({
      ...annotation,
      id: `${annotation.id}-u${index + 1}`,
      start: unit.start,
      end: unit.end,
      text: unit.text
    })));
  }

  return normalizeAnnotations(text, result);
}

function citationOverlabelDetected(text: string, annotations: Annotation[]) {
  const nonEmptyLength = text.replace(/\s+/g, "").length;
  if (!nonEmptyLength) return false;
  const citationLength = annotations
    .filter((annotation) => annotation.label === "citation")
    .reduce((total, annotation) => total + annotation.text.replace(/\s+/g, "").length, 0);
  const hasReferenceList = /\b(references|works cited)\b|doi:|https?:\/\//i.test(text);
  return !hasReferenceList && citationLength / nonEmptyLength > 0.4;
}

function lacksUsefulLabelMix(annotations: Annotation[]) {
  if (annotations.length < 3) return false;
  const labels = new Set(annotations.map((annotation) => annotation.label));
  if (labels.size > 1) return false;
  const [onlyLabel] = labels;
  return onlyLabel === "citation" || onlyLabel === "plain" || onlyLabel === "background";
}

function insufficientLongTextCoverage(text: string, annotations: Annotation[]) {
  const units = rhetoricalUnitRanges(text)
    .filter((unit) => unit.text.trim().length >= 24);
  if (text.trim().length < 1200 || units.length < 8) return "";

  const coveredUnits = units.filter((unit) =>
    annotations.some((annotation) => rangeOverlap(unit.start, unit.end, annotation.start, annotation.end) / (unit.end - unit.start) >= 0.6)
  ).length;
  const minimumCovered = Math.max(8, Math.ceil(units.length * 0.55));
  if (coveredUnits >= minimumCovered) return "";

  return `Provider returned too few sentence-level annotations for this long text (${coveredUnits}/${units.length} units covered; need at least ${minimumCovered}).`;
}

function rangeOverlap(startA: number, endA: number, startB: number, endB: number) {
  return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
}
