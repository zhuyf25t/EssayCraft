import type { Annotation, ModuleNumber } from "@/types/essaycraft";
import { buildMockAnnotations, exactAnnotations, guardAgainstCitationOverlabeling, normalizeAnnotations, relabelCitationIfOverbroad } from "@/lib/annotations";

export type RefreshAnnotationValidation = {
  annotations: Annotation[];
  warnings: string[];
  usedFallback: boolean;
  reason?: string;
};

export function validateProviderRefreshAnnotations(
  text: string,
  annotations: Annotation[],
  moduleNumber: ModuleNumber
): RefreshAnnotationValidation {
  const exact = exactAnnotations(text, annotations);
  const warnings = [...exact.warnings];
  const relabeled = exact.annotations.map((annotation) => {
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

  const guarded = guardAgainstCitationOverlabeling(text, relabeled);
  if (moduleNumber === 6 && lacksUsefulLabelMix(guarded)) {
    return {
      annotations: guarded,
      warnings: [...warnings, "Provider returned too little label variety for final review."],
      usedFallback: true,
      reason: "Provider returned too little label variety for final review."
    };
  }

  return {
    annotations: guarded,
    warnings: sameAnnotationLabelsAndRanges(guarded, relabeled) ? warnings : [...warnings, "Rebalanced overbroad citation labels."],
    usedFallback: false
  };
}

export function fallbackRefreshAnnotations(text: string, warnings: string[] = [], reason = "Local refresh fallback used."): RefreshAnnotationValidation {
  return {
    annotations: guardAgainstCitationOverlabeling(text, normalizeAnnotations(text, buildMockAnnotations(text))),
    warnings: [...warnings, reason],
    usedFallback: true,
    reason
  };
}

function lacksUsefulLabelMix(annotations: Annotation[]) {
  if (annotations.length < 3) return false;
  const labels = new Set(annotations.map((annotation) => annotation.label));
  if (labels.size > 1) return false;
  const [onlyLabel] = labels;
  return onlyLabel === "citation" || onlyLabel === "plain" || onlyLabel === "background";
}

function sameAnnotationLabelsAndRanges(a: Annotation[], b: Annotation[]) {
  if (a.length !== b.length) return false;
  return a.every((item, index) => {
    const other = b[index];
    return other && item.start === other.start && item.end === other.end && item.label === other.label;
  });
}
