import { describe, expect, it } from "vitest";
import { applyNotesFallback, restoreStructuredLineBreaks, rewriteWithInstruction } from "./rewriteFallback";
import type { Patch } from "@/types/essaycraft";

const BANNED = [
  "A more academic version could state",
  "could state:",
  "Here is a revised version",
  "I would rewrite it as",
  "The student should",
  "This rewrite improves",
  "if this includes factual evidence",
  "citation needed if this includes factual evidence",
  "In this context",
  "The following sentence"
];

describe("rewriteFallback", () => {
  it("uses project title for Chinese longer research-question rewrites", () => {
    const original = "Research question: How can social media be healthier?";
    const proposed = rewriteWithInstruction(original, "可以把问题写得更长一点，并且结合 project title", "Technology vs. Humanity.");

    expect(proposed).not.toBe(original);
    expect(proposed.length).toBeGreaterThan(original.length);
    expect(proposed).toContain("Research question:");
    expect(proposed).toMatch(/technolog|human/i);
    for (const phrase of BANNED) expect(proposed).not.toContain(phrase);
  });

  it("uses project title for note-driven topic revisions", () => {
    const text = "Topic: Social media balance\n\nResearch question: How can social media be healthier?";
    const patch: Patch = {
      id: "patch-test",
      moduleNumber: 1,
      anchorStart: 0,
      anchorEnd: "Topic: Social media balance".length,
      anchorQuote: "Topic: Social media balance",
      text: "根据我的 title 重写这个 topic",
      createdAt: "2026-05-10T00:00:00.000Z",
      status: "open",
      resolved: false
    };

    const proposed = applyNotesFallback(text, [patch], "Technology vs. Humanity.");
    expect(proposed).toContain("Topic: Technology vs. Humanity");
    expect(proposed).not.toContain(patch.text);
    expect(proposed).not.toContain("Social media balance\n\nResearch question");
  });

  it("keeps question prefix when title note is anchored to a question", () => {
    const question = "Research question: How can social media be healthier?";
    const text = `Topic: Social media balance\n\n${question}`;
    const start = text.indexOf(question);
    const patch: Patch = {
      id: "patch-question",
      moduleNumber: 1,
      anchorStart: start,
      anchorEnd: start + question.length,
      anchorQuote: question,
      text: "根据我的 title 重写，可以把问题写得更长一点",
      createdAt: "2026-05-10T00:00:00.000Z",
      status: "open",
      resolved: false
    };

    const proposed = applyNotesFallback(text, [patch], "Technology vs. Humanity.");
    expect(proposed).toContain("Research question:");
    expect(proposed).toMatch(/technolog|human/i);
    expect(proposed).not.toContain("Topic: Technology, humanity\n\nTopic:");
  });

  it("restores reason list line breaks instead of applying one long line", () => {
    const raw = "- Reason 1: Technology improves productivity, - Reason 2: AI adapts quickly, - Reason 3: complex global problems need new tools.";

    expect(restoreStructuredLineBreaks(raw)).toBe(
      "- Reason 1: Technology improves productivity\n- Reason 2: AI adapts quickly\n- Reason 3: complex global problems need new tools."
    );
  });
});
