import { describe, expect, it } from "vitest";
import { buildMockAnnotations, normalizeAnnotations, rhetoricalUnitRanges, sentenceRanges } from "./annotations";

function labelFor(text: string, needle: string) {
  const annotation = buildMockAnnotations(text).find((item) => item.text.includes(needle));
  if (!annotation) throw new Error(`No annotation found for ${needle}`);
  return annotation.label;
}

describe("fallback annotations", () => {
  it("labels Module 1 planning structure without treating the research question as evidence", () => {
    const text = `Topic: Social media balance and youth wellbeing

Research question: How can we strike a healthier social media balance?

Working thesis: A healthier social media balance is possible when users build intentional habits.
Thesis map:
- Reason 1: Users can build intentional habits that reduce passive scrolling.`;

    expect(labelFor(text, "Topic:")).toBe("background");
    expect(labelFor(text, "Research question:")).toBe("background");
    expect(labelFor(text, "Working thesis:")).toBe("thesis");
    expect(labelFor(text, "Reason 1:")).toBe("thesis");
  });

  it("keeps Module 2 source-planning metadata calm", () => {
    const text = `Argument branch 1: Intentional habits can reduce passive scrolling.
Evidence to look for: Research on screen time and youth wellbeing.
Possible source type: scholarly article
Search keywords: social media passive scrolling youth wellbeing
Source status: source needed
CARS check: Check credibility and support.`;

    expect(labelFor(text, "Argument branch 1")).toBe("thesis");
    expect(labelFor(text, "Evidence to look for")).toBe("evidence");
    expect(labelFor(text, "Possible source type")).toBe("plain");
    expect(labelFor(text, "Search keywords")).toBe("plain");
    expect(labelFor(text, "Source status")).toBe("plain");
    expect(labelFor(text, "CARS check")).toBe("plain");
  });

  it("labels Module 3 outline roles predictably", () => {
    const text = `Introduction plan
- Hook / importance: Social media shapes young people's attention.
- Thesis: A healthier balance is possible.

Body paragraph 1
- Topic sentence: Individual habits reduce passive scrolling.
- Evidence to use: [source needed: study on screen time.]
- Analysis purpose: Explain how habits support the thesis.

Counterargument paragraph
- Opposing view: Some people may argue that bans are necessary.
- Response: Balance is more sustainable.

Conclusion plan
- So what / implication: The goal is healthier use.`;

    expect(labelFor(text, "Introduction plan")).toBe("background");
    expect(labelFor(text, "Thesis:")).toBe("thesis");
    expect(labelFor(text, "Evidence to use")).toBe("evidence");
    expect(labelFor(text, "Analysis purpose")).toBe("analysis");
    expect(labelFor(text, "Opposing view")).toBe("counterargument");
    expect(labelFor(text, "Response")).toBe("analysis");
    expect(labelFor(text, "So what")).toBe("conclusion");
  });

  it("treats citation-needed in draft prose as an issue", () => {
    const text = "Research on social media wellbeing would strengthen this claim [citation needed].";
    expect(labelFor(text, "[citation needed]")).toBe("issue");
  });

  it("does not turn cited evidence sentences into citation labels", () => {
    const text = "Research shows that structured notification limits can improve student attention (Rivera, 2024).";
    expect(labelFor(text, "Research shows")).toBe("evidence");
  });

  it("reserves citation labels for citation or reference signals", () => {
    expect(labelFor("In-text citation: (Rivera, 2024)", "In-text citation")).toBe("citation");
    expect(labelFor("Reference list: Rivera. (2024). Student focus survey.", "Reference list")).toBe("citation");
    expect(labelFor("Source card: Rivera, 2024, Student focus survey.", "Source card")).toBe("citation");
    expect(labelFor("Source status: source needed", "Source status")).toBe("plain");
    expect(labelFor("The reference list should be checked during final review.", "reference list")).not.toBe("citation");
  });

  it("splits paragraph prose into sentence-level fallback annotations", () => {
    const text = "Technology can support learning when students keep control. Research on attention can help the essay define the problem. This matters because the argument is about human judgment, not just tools.";
    const annotations = buildMockAnnotations(text);

    expect(annotations).toHaveLength(3);
    expect(annotations.map((annotation) => annotation.text)).toEqual([
      "Technology can support learning when students keep control.",
      "Research on attention can help the essay define the problem.",
      "This matters because the argument is about human judgment, not just tools."
    ]);
  });

  it("keeps decimals inside sentence ranges", () => {
    const text = "The survey found a 3.5 point change and a 12.4% drop in passive scrolling. This matters because the essay needs precise evidence.";

    expect(sentenceRanges(text).map((range) => range.text)).toEqual([
      "The survey found a 3.5 point change and a 12.4% drop in passive scrolling.",
      "This matters because the essay needs precise evidence."
    ]);
  });

  it("keeps parenthetical citation punctuation inside one evidence sentence", () => {
    const text = "Research shows that structured notification limits can improve student attention by 3.5 points (Rivera et al., 2024). This evidence matters because it connects habits to academic focus.";
    const annotations = buildMockAnnotations(text);

    expect(annotations.map((annotation) => annotation.text)).toEqual([
      "Research shows that structured notification limits can improve student attention by 3.5 points (Rivera et al., 2024).",
      "This evidence matters because it connects habits to academic focus."
    ]);
    expect(annotations[0].label).toBe("evidence");
    expect(annotations[1].label).toBe("analysis");
  });

  it("keeps fallback annotation ranges under the long-range limit", () => {
    const longSentence = `Analysis: ${Array.from({ length: 90 }, (_, index) => `reason${index}`).join(" ")}`;
    const ranges = rhetoricalUnitRanges(longSentence);

    expect(ranges.length).toBeGreaterThan(1);
    expect(Math.max(...ranges.map((range) => range.text.length))).toBeLessThanOrEqual(350);
  });

  it("splits mixed paragraphs into sentence-level rhetorical labels", () => {
    const text = "Technology has always changed the way human beings live. According to Stanford's 2025 AI Index Report, AI investment is increasing quickly. This evidence suggests that students need humanities-based judgment. This essay argues that technology needs human guidance.";
    const annotations = buildMockAnnotations(text);

    expect(annotations.length).toBeGreaterThanOrEqual(4);
    expect(annotations.some((annotation) => annotation.label === "background" && annotation.text.includes("Technology has always"))).toBe(true);
    expect(annotations.some((annotation) => annotation.label === "citation" && annotation.text.includes("According to Stanford"))).toBe(true);
    expect(annotations.some((annotation) => annotation.label === "analysis" && annotation.text.includes("This evidence suggests"))).toBe(true);
    expect(annotations.some((annotation) => annotation.label === "thesis" && annotation.text.includes("This essay argues"))).toBe(true);
  });

  it("does not create long paragraph-sized fallback annotations", () => {
    const longSentence = `This paragraph starts with context about technology and human learning, then adds multiple connected details about classroom practice, institutional responsibility, platform design, student judgment, ethical reasoning, and civic consequences, while continuing long enough that the fallback splitter should divide it into shorter rhetorical units instead of painting the whole paragraph one color for the student editor to review carefully and practically.`;
    const annotations = buildMockAnnotations(longSentence);

    expect(annotations.length).toBeGreaterThan(1);
    expect(Math.max(...annotations.map((annotation) => annotation.text.length))).toBeLessThanOrEqual(350);
  });

  it("does not let one citation cue color an entire paragraph as citation", () => {
    const text = "The draft begins by explaining why technology changes human habits. According to Stanford's 2025 AI Index Report, AI systems are being adopted quickly. This shows why the essay needs analysis of human judgment rather than a simple technology narrative. In conclusion, the final review should return to the thesis.";
    const annotations = buildMockAnnotations(text);
    const labels = new Set(annotations.map((annotation) => annotation.label));
    const citationChars = annotations
      .filter((annotation) => annotation.label === "citation")
      .reduce((sum, annotation) => sum + annotation.text.length, 0);

    expect(labels.size).toBeGreaterThan(2);
    expect(citationChars / text.length).toBeLessThan(0.6);
  });

  it("does not split decimal values or citation years as sentence boundaries", () => {
    const text = "AI investment reached 33.9 billion dollars in 2024 (Stanford HAI, 2025). These facts show why students need better evidence checks.";
    const ranges = rhetoricalUnitRanges(text);

    expect(ranges.map((range) => range.text)).toEqual([
      "AI investment reached 33.9 billion dollars in 2024 (Stanford HAI, 2025).",
      "These facts show why students need better evidence checks."
    ]);
    expect(ranges[0].text).toContain("33.9 billion");
    expect(ranges[0].text).toContain("(Stanford HAI, 2025)");
  });

  it("protects abbreviations, initials, URLs, and DOI strings during segmentation", () => {
    const text = "Dr. J. K. Smith studies U.S. policy, e.g., school phone rules. The DOI is 10.1234/example.v2 and the source is https://example.org/report. The same report found 55.5% agreement.";
    const ranges = rhetoricalUnitRanges(text);

    expect(ranges.map((range) => range.text)).toEqual([
      "Dr. J. K. Smith studies U.S. policy, e.g., school phone rules.",
      "The DOI is 10.1234/example.v2 and the source is https://example.org/report.",
      "The same report found 55.5% agreement."
    ]);
  });

  it("keeps source-signal citation ranges intact without painting nearby analysis", () => {
    const text = "According to Stanford's 2025 AI Index Report, 55% of schools are testing AI tools. The same report suggests that students need clearer guidance. This shows why the essay should discuss responsibility.";
    const annotations = buildMockAnnotations(text);

    expect(annotations).toHaveLength(3);
    expect(annotations[0].label).toBe("citation");
    expect(annotations[0].text).toContain("55%");
    expect(annotations[1].label).toBe("evidence");
    expect(annotations[2].label).toBe("analysis");
  });

  it("drops stale or whitespace-only annotation ranges before rendering", () => {
    const text = "Topic: Social media balance\n\nWorking thesis: Balance is possible.";
    const annotations = normalizeAnnotations(text, [
      {
        id: "stale",
        start: 999,
        end: 1009,
        text: "missing",
        label: "thesis"
      },
      {
        id: "blank",
        start: 27,
        end: 29,
        text: "\n\n",
        label: "thesis"
      },
      {
        id: "valid",
        start: 0,
        end: 27,
        text: "Topic: Social media balance",
        label: "background"
      }
    ]);

    expect(annotations).toHaveLength(1);
    expect(annotations[0].id).toBe("valid");
  });
});
