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
  it("repairs provider ranges by exact annotation text instead of dropping useful labels", () => {
    const text = "First sentence sets context. Second sentence explains why it matters.";
    const result = validateProviderRefreshAnnotations(text, [{
      id: "ann-bad-offset",
      start: 0,
      end: 5,
      text: "Second sentence explains why it matters.",
      label: "analysis",
      confidence: 0.8
    }], 6);

    expect(result.usedFallback).toBe(false);
    expect(result.annotations[0].start).toBe(text.indexOf("Second sentence"));
    expect(result.annotations[0].label).toBe("analysis");
  });

  it("splits overbroad provider paragraph labels into sentence-level ranges", () => {
    const text = "Technology changes work. This essay argues that human judgment should guide AI. Therefore, humanities education remains important.";
    const result = validateProviderRefreshAnnotations(text, [exactAnnotation(text, "analysis")], 6);

    expect(result.usedFallback).toBe(false);
    expect(result.annotations.length).toBeGreaterThan(1);
    expect(result.annotations.every((annotation) => annotation.end - annotation.start < 350)).toBe(true);
    expect(result.warnings.join(" ")).toMatch(/Split overbroad/);
  });

  it("relabels provider citation labels when the range is evidence prose", () => {
    const text = "Research shows that structured notification limits can improve student attention (Rivera, 2024).";
    const result = validateProviderRefreshAnnotations(text, [exactAnnotation(text, "citation")], 4);

    expect(result.usedFallback).toBe(false);
    expect(result.annotations[0].label).toBe("evidence");
    expect(result.warnings.join(" ")).toMatch(/Rebalanced overbroad citation/);
  });

  it("rejects provider annotations that do not match the submitted text", () => {
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
    expect(result.annotations.length).toBe(0);
    expect(result.warnings.join(" ")).toMatch(/no exact annotation ranges/i);
  });

  it("marks one-label Module 6 provider output invalid instead of inventing local labels", () => {
    const text = `Technology should serve humanity by protecting human agency.

This essay argues that innovation needs ethical responsibility.

Overall, the final version should return to the thesis and check references.`;
    const result = validateProviderRefreshAnnotations(text, paragraphAnnotations(text, "background"), 6);
    const labels = new Set(result.annotations.map((annotation) => annotation.label));

    expect(result.usedFallback).toBe(true);
    expect(labels.size).toBe(1);
    expect(result.warnings.join(" ")).toMatch(/label variety/i);
  });
});
