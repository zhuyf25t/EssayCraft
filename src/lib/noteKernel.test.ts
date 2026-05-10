import { describe, expect, it } from "vitest";
import { hasEditorKernelMarkers, normalizedForNoopCompare, protectModuleText, stripEditorKernelMarkers } from "./noteKernel";

describe("noteKernel", () => {
  it("strips legacy sentinel note blocks from canonical text", () => {
    const polluted = "balance\u2063NOTE:patch-123456\u2064[Note: hidden]\u2063/NOTE\u2064 and wellbeing";

    expect(stripEditorKernelMarkers(polluted)).toBe("balance and wellbeing");
    expect(protectModuleText(polluted)).not.toMatch(/NOTE:|patch-123456|\[Note:/);
  });

  it("detects raw note ids and object leaks before saving", () => {
    expect(hasEditorKernelMarkers("Topic patch-123456-aaaa text")).toBe(true);
    expect(hasEditorKernelMarkers("Topic [object Object] text")).toBe(true);
    expect(hasEditorKernelMarkers("Topic: Social media balance")).toBe(false);
  });

  it("strips every internal marker shape without removing ordinary prose notes", () => {
    const cases = [
      "Topic \u2063 hidden",
      "Topic \u2064 hidden",
      "Topic NOTE:patch-abc123 hidden",
      "Topic /NOTE hidden",
      "Topic NOTEabcdef123456 hidden",
      "Topic PATCHabcdef123456 hidden",
      "Topic note-z9x8c7v6 hidden",
      "Topic patch-z9x8c7v6 hidden",
      "Topic [object Object] hidden"
    ];

    for (const value of cases) {
      expect(hasEditorKernelMarkers(value)).toBe(true);
      expect(stripEditorKernelMarkers(value)).not.toMatch(/\u2063|\u2064|NOTE:|\/NOTE|NOTE[A-Za-z0-9_-]{6,}|PATCH[A-Za-z0-9_-]{6,}|(?:note|patch)-[a-z0-9-]{6,}|\[object Object\]/i);
    }

    expect(stripEditorKernelMarkers("Literal [Note: compare sources] stays in student prose.")).toBe("Literal [Note: compare sources] stays in student prose.");
  });

  it("normalizes leaked markers before no-op comparisons", () => {
    expect(normalizedForNoopCompare("Question NOTE:patch-abc123")).toBe("question");
    expect(normalizedForNoopCompare("Question")).toBe("question");
  });

  it("preserves ordinary typing whitespace while stripping internal markers", () => {
    expect(protectModuleText("Topic: Technology ")).toBe("Topic: Technology ");
    expect(protectModuleText("Topic: Technology  and humanity")).toBe("Topic: Technology  and humanity");
    expect(stripEditorKernelMarkers("Topic: Technology \u2063NOTE:patch-123456\u2064hidden\u2063/NOTE\u2064 ")).toBe("Topic: Technology  ");
  });
});
