import { describe, expect, it } from "vitest";
import type { AssistRequest, GenerateNextRequest, RefreshRequest } from "@/types/essaycraft";
import { buildAssistMessages, buildGenerateNextMessages, buildRefreshUnitMessages } from "./prompts";

function request(action: string): AssistRequest {
  const text = "Research question: How can social media be healthier?";
  return {
    topic: "Technology vs. Humanity.",
    projectTitle: "Technology vs. Humanity.",
    moduleNumber: 1,
    moduleTitle: "Topic & Question",
    text,
    annotations: [],
    patches: [],
    sources: [],
    selectedRange: { start: 0, end: text.length },
    selectedText: text,
    action,
    history: []
  };
}

describe("assistant prompts", () => {
  it("treats direct Chinese project-title rewrites as edit previews", () => {
    const messages = buildAssistMessages(request("\u6839\u636e\u6211\u7684 title \u91cd\u5199\uff0c\u53ef\u4ee5\u628a\u95ee\u9898\u5199\u5f97\u66f4\u957f\u4e00\u70b9?"));

    expect(messages[0].content).toContain('Use kind "edit"');
    expect(messages[1].content).toContain("Project title: Technology vs. Humanity.");
  });

  it("keeps Analyze read-only even with a selected range", () => {
    const messages = buildAssistMessages(request("Analyze selected text: \u4f60\u8bc4\u4ef7\u4e00\u4e0b\u8fd9\u53e5\u8bdd\u3002\u7528\u4e2d\u6587\u3002"));

    expect(messages[0].content).toContain('Use kind "inspect"');
    expect(messages[0].content).toContain("Inspect responses are read-only analysis, translation, or highlight explanation");
    expect(messages[1].content).toContain("Analyze the complete Selected clean text");
  });

  it("keeps Translate read-only and carries the target-language instruction", () => {
    const messages = buildAssistMessages(request("Translate selected text: Please translate into Chinese"));

    expect(messages[0].content).toContain('Use kind "inspect"');
    expect(messages[0].content).toContain("translate the entire selected text exactly as selected");
    expect(messages[1].content).toContain("Please translate into Chinese");
  });

  it("keeps Rewrite as an edit preview even when the instruction mentions citation-needed markers", () => {
    const messages = buildAssistMessages(request("Rewrite selected passage: remove every citation needed issue without inventing sources"));

    expect(messages[0].content).toContain('Use kind "edit"');
    expect(messages[0].content).toContain("still return an Edit response with proposedText");
    expect(messages[1].content).toContain("Context profile: edit-selection");
    expect(messages[1].content).toContain("remove every citation needed issue");
  });

  it("includes relevant open notes separately from all module patches", () => {
    const base = request("Rewrite using the selected note");
    const messages = buildAssistMessages({
      ...base,
      patches: [
        {
          id: "p-selected",
          moduleNumber: 1,
          anchorStart: 0,
          anchorEnd: base.text.length,
          anchorQuote: base.text,
          text: "Make the question more specific.",
          createdAt: "2026-05-10T00:00:00.000Z",
          status: "open",
          resolved: false
        },
        {
          id: "p-other",
          moduleNumber: 1,
          anchorStart: base.text.length + 10,
          anchorEnd: base.text.length + 20,
          anchorQuote: "",
          text: "Unrelated note.",
          createdAt: "2026-05-10T00:00:00.000Z",
          status: "open",
          resolved: false
        }
      ]
    });

    expect(messages[1].content).toContain("Notes inside selected/active range, as instructions only");
    const relevantSection = messages[1].content.split("Notes inside selected/active range, as instructions only:")[1].split("Active highlight/annotation context:")[0];
    expect(relevantSection).toContain("p-selected");
    expect(relevantSection).not.toContain("p-other");
  });

  it("keeps Rewrite prompts local instead of sending unrelated full module text", () => {
    const text = [
      "Research question: How can social media be healthier?",
      "This selected paragraph has the local sentence that should be revised.",
      "",
      "UNRELATED FULL MODULE PARAGRAPH SHOULD NOT BE SENT TO LOCAL EDIT."
    ].join("\n");
    const messages = buildAssistMessages({
      ...request("Rewrite selected passage: make it more specific"),
      text,
      selectedRange: { start: 0, end: 53 },
      selectedText: text.slice(0, 53)
    });

    expect(messages[1].content).toContain("Context profile: edit-selection");
    expect(messages[1].content).toContain("Selected clean text");
    expect(messages[1].content).toContain("Surrounding paragraph/context");
    expect(messages[1].content).not.toContain("Full module text:");
    expect(messages[1].content).not.toContain("UNRELATED FULL MODULE PARAGRAPH");
  });

  it("keeps Edit-mode Translate scoped to selected text and target instruction", () => {
    const text = "Translate this sentence only.\n\nDo not send this unrelated paragraph.";
    const messages = buildAssistMessages({
      ...request("Translate selected text: 请翻译成中文"),
      text,
      selectedRange: { start: 0, end: "Translate this sentence only.".length },
      selectedText: "Translate this sentence only."
    });

    expect(messages[1].content).toContain("Context profile: translation-selection");
    expect(messages[1].content).toContain("请翻译成中文");
    expect(messages[1].content).toContain("Translate this sentence only.");
    expect(messages[1].content).toContain("Translate the complete Selected clean text");
    expect(messages[1].content).toContain("Do not summarize, skip later sentences, or ask for a target language.");
    expect(messages[1].content).not.toContain("Do not send this unrelated paragraph");
    expect(messages[1].content).not.toContain("Full module text:");
  });

  it("lets Chat prompts include full module context for module-level conversation", () => {
    const text = "Topic: AI and humanities.\n\nUNRELATED BUT VALID FULL MODULE CONTEXT.";
    const messages = buildAssistMessages({
      ...request("为什么这个 research question 有点弱？用中文。"),
      text,
      selectedRange: undefined,
      selectedText: undefined
    });

    expect(messages[0].content).toContain('Use kind "chat"');
    expect(messages[1].content).toContain("Context profile: chat-full-module");
    expect(messages[1].content).toContain("Current module text:");
    expect(messages[1].content).toContain("UNRELATED BUT VALID FULL MODULE CONTEXT");
  });

  it("asks refresh to label pre-segmented units instead of returning fragile offsets", () => {
    const refresh: RefreshRequest = {
      topic: "Technology vs. Humanity.",
      projectTitle: "Technology vs. Humanity.",
      moduleNumber: 6,
      text: "Technology changes society. This essay argues that humanities guidance matters.",
      annotations: [],
      patches: [],
      sources: []
    };
    const messages = buildRefreshUnitMessages(refresh, [
      { index: 0, start: 0, end: 27, text: "Technology changes society." },
      { index: 1, start: 28, end: 80, text: "This essay argues that humanities guidance matters." }
    ]);

    expect(messages[0].content).toContain("Label every provided sentence/rhetorical unit");
    expect(messages[0].content).toContain("exactly 2 unitLabels");
    expect(messages[0].content).toContain("Required unit indexes: 0, 1");
    expect(messages[0].content).toContain("First read the full essay context");
    expect(messages[0].content).toContain("Do not label a unit in isolation");
    expect(messages[0].content).toContain("most non-empty units should receive a visible label");
    expect(messages[0].content).toContain("Use \"plain\" only for decorative separators");
    expect(messages[0].content).toContain("[evidence needed]");
    expect(messages[0].content).toContain("high-priority issue markers");
    expect(messages[0].content).toContain("unitLabels");
    expect(messages[0].content).not.toContain("\"start\":0,\"end\":20");
    expect(messages[0].content).not.toContain("final review checklist");
    expect(messages[1].content).toContain("Full essay context");
    expect(messages[1].content).toContain("\"index\": 0");
    expect(messages[1].content).toContain("Technology changes society.");
  });

  it("asks Generate Next to run an AI-native contract self-check", () => {
    const request: GenerateNextRequest = {
      topic: "Technology and humanity",
      sourceModuleNumber: 1,
      sourceTitle: "Topic & Question",
      sourceText: "Topic: Technology and humanity\n\nResearch question: How should AI be guided?",
      sourceAnnotations: [],
      sourcePatches: [],
      sourceSources: [],
      instruction: "Preserve existing citations and references."
    };

    const messages = buildGenerateNextMessages(request);
    expect(messages[0].content).toContain("AI-native contract self-check");
    expect(messages[0].content).toContain("Do not rely on exact heading wording");
    expect(messages[0].content).toContain("Do not use Markdown heading markers");
    expect(messages[0].content).toContain("Do not replace existing concrete citations or references");
    expect(messages[1].content).toContain("User generation instruction from the Edit box");
    expect(messages[1].content).toContain("Preserve existing citations and references.");
    expect(messages[0].content).toContain("contractCheck");
  });
});
