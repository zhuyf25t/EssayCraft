import { describe, expect, it } from "vitest";
import type { Annotation } from "@/types/essaycraft";
import { validateProviderRefreshAnnotations } from "./refreshValidation";

function exactAnnotation(text: string, label: Annotation["label"]): Annotation {
  return {
    id: `ann-${label}`,
    start: 0,
    end: text.length,
    text,
    label,
    confidence: 0.7
  };
}

function paragraphAnnotations(text: string, label: Annotation["label"]): Annotation[] {
  const annotations: Annotation[] = [];
  let offset = 0;
  for (const paragraph of text.split("\n\n")) {
    annotations.push({
      id: `ann-${annotations.length}`,
      start: offset,
      end: offset + paragraph.length,
      text: paragraph,
      label,
      confidence: 0.7
    });
    offset += paragraph.length + 2;
  }
  return annotations;
}

describe("refresh validation", () => {
  it("relabels provider citation labels when the range is evidence prose", () => {
    const text = "Research shows that structured notification limits can improve student attention (Rivera, 2024).";
    const result = validateProviderRefreshAnnotations(text, [exactAnnotation(text, "citation")], 4);

    expect(result.usedFallback).toBe(false);
    expect(result.annotations[0].label).toBe("evidence");
    expect(result.warnings.join(" ")).toMatch(/Rebalanced overbroad citation/);
  });

  it("falls back when provider annotations do not match the submitted text", () => {
    const text = "Topic: Refresh validation\n\nWorking thesis: The route should keep exact text.";
    const result = validateProviderRefreshAnnotations(text, [{
      id: "bad-range",
      start: 0,
      end: 5,
      text: "wrong",
      label: "thesis",
      confidence: 0.8
    }], 1);

    expect(result.usedFallback).toBe(true);
    expect(result.annotations.length).toBeGreaterThan(0);
    expect(result.warnings.join(" ")).toMatch(/no exact annotation ranges/i);
  });

  it("falls back to mixed local labels for one-note Module 6 provider output", () => {
    const text = `Technology should serve humanity by protecting human agency.

This essay argues that innovation needs ethical responsibility.

Overall, the final version should return to the thesis and check references.`;
    const result = validateProviderRefreshAnnotations(text, paragraphAnnotations(text, "background"), 6);
    const labels = new Set(result.annotations.map((annotation) => annotation.label));

    expect(result.usedFallback).toBe(true);
    expect(labels.size).toBeGreaterThan(1);
    expect(result.warnings.join(" ")).toMatch(/label variety/i);
  });
});
