import { describe, expect, it } from "vitest";
import { buildMockAnnotations, normalizeAnnotations } from "./annotations";

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
