import { describe, expect, it } from "vitest";
import type { AssistRequest, Patch } from "@/types/essaycraft";
import { buildCitationCheckReply, buildContextualModuleFeedback, relevantOpenNotesForAssist } from "./assistFallback";

function baseRequest(overrides: Partial<AssistRequest> = {}): AssistRequest {
  const text = [
    "Topic: Technology and humanity in AI learning",
    "",
    "Research question: How can AI learning tools protect student judgment while improving access?",
    "",
    "Working thesis: AI learning tools need humanities-guided design because students need agency, fairness, and critical thinking.",
    "Reason 1: Human judgment should guide automated feedback."
  ].join("\n");
  return {
    topic: "Technology and Humanity",
    projectTitle: "Technology and Humanity",
    moduleNumber: 1,
    moduleTitle: "Topic & Question",
    text,
    annotations: [],
    patches: [],
    sources: [],
    action: "What should I improve?",
    history: [],
    ...overrides
  };
}

function patch(id: string, anchorStart: number, anchorEnd: number, text: string): Patch {
  return {
    id,
    moduleNumber: 1,
    anchorStart,
    anchorEnd,
    anchorQuote: "",
    text,
    createdAt: "2026-05-10T00:00:00.000Z",
    status: "open",
    resolved: false
  };
}

describe("assistant fallback", () => {
  it("builds contextual module chat from title and current module text", () => {
    const reply = buildContextualModuleFeedback(baseRequest());

    expect(reply).toContain("Technology and Humanity");
    expect(reply).toContain("Module 1");
    expect(reply).toContain("research question");
    expect(reply).toContain("working thesis");
    expect(reply).toContain("AI learning tools protect student judgment");
    expect(reply).not.toMatch(/I can help with|select a sentence first/i);
  });

  it("answers Chinese chat in Chinese while preserving project context", () => {
    const reply = buildContextualModuleFeedback(baseRequest({ action: "\u7528\u4e2d\u6587\u8bc4\u4ef7\u4e00\u4e0b\u6211\u7684\u95ee\u9898" }));

    expect(reply).toContain("\u9879\u76ee\u9898\u76ee");
    expect(reply).toContain("Technology and Humanity");
    expect(reply).toContain("\u7814\u7a76\u95ee\u9898");
    expect(reply).toContain("\u4e0b\u4e00\u6b65");
  });

  it("keeps selected-note semantics scoped to overlapping notes", () => {
    const text = "First sentence needs work. Second sentence is separate.";
    const firstEnd = "First sentence needs work.".length;
    const request = baseRequest({
      text,
      selectedRange: { start: 0, end: firstEnd },
      selectedText: text.slice(0, firstEnd),
      patches: [
        patch("p1", 0, firstEnd, "Make this more academic."),
        patch("p2", firstEnd + 1, text.length, "Do not use this note for the first sentence.")
      ]
    });

    const notes = relevantOpenNotesForAssist(request);
    expect(notes.map((note) => note.id)).toEqual(["p1"]);
  });

  it("honors an explicit selectedPatches payload when provided", () => {
    const selectedPatch = patch("selected-only", 0, 5, "Use the selected note.");
    const notes = relevantOpenNotesForAssist(baseRequest({
      selectedRange: { start: 0, end: 5 },
      selectedPatches: [selectedPatch],
      patches: []
    }));

    expect(notes.map((note) => note.id)).toEqual(["selected-only"]);
  });

  it("citation fallback counts gaps and real source cards without inventing references", () => {
    const reply = buildCitationCheckReply(baseRequest({
      moduleNumber: 4,
      moduleTitle: "Drafting",
      text: "AI tools can improve learning outcomes [citation needed].",
      action: "Any citation issues?",
      sources: [{
        id: "s1",
        title: "Student AI Literacy Survey",
        authors: ["Rivera"],
        year: "2024",
        createdAt: "2026-05-10T00:00:00.000Z"
      }]
    }));

    expect(reply).toContain("1 [citation needed]");
    expect(reply).toContain("1 real source card");
    expect(reply).not.toMatch(/DOI|journal|invented/i);
  });
});
