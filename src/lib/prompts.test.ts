import { describe, expect, it } from "vitest";
import type { AssistRequest } from "@/types/essaycraft";
import { buildAssistMessages } from "./prompts";

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
    expect(messages[0].content).toContain("Inspect responses explain a highlight/annotation");
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

    expect(messages[1].content).toContain("Relevant open notes for the submitted selection/module");
    const relevantSection = messages[1].content.split("Relevant open notes for the submitted selection/module:")[1].split("Sources:")[0];
    expect(relevantSection).toContain("p-selected");
    expect(relevantSection).not.toContain("p-other");
  });
});
