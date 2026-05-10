import { describe, expect, it } from "vitest";
import { buildAssistMessages } from "./prompts";
import type { AssistRequest } from "@/types/essaycraft";

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
    const messages = buildAssistMessages(request("根据我的 title 重写，可以把问题写得更长一点"));

    expect(messages[0].content).toContain('Use kind "edit"');
    expect(messages[1].content).toContain("Project title: Technology vs. Humanity.");
  });

  it("keeps Analyze read-only even with a selected range", () => {
    const messages = buildAssistMessages(request("Analyze selected text: 你评价一下这句话。用中文。"));

    expect(messages[0].content).toContain('Use kind "inspect"');
    expect(messages[0].content).toContain("Inspect responses explain a highlight/annotation");
  });
});
