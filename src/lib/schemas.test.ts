import { describe, expect, it } from "vitest";
import { assistRequestSchema } from "./schemas";

describe("schemas", () => {
  it("accepts legacy fallback providerMode in assistant history and normalizes it", () => {
    const parsed = assistRequestSchema.parse({
      topic: "Technology and humanity",
      projectTitle: "Technology and humanity",
      moduleNumber: 6,
      moduleTitle: "Final Review / Conclusion / Export",
      text: "Topic: Technology and humanity",
      annotations: [],
      patches: [],
      sources: [],
      action: "What is this about?",
      history: [
        {
          id: "old",
          role: "assistant",
          text: "Old unavailable message",
          createdAt: "2026-05-10T00:00:00.000Z",
          providerMode: "fallback"
        }
      ]
    });

    expect(parsed.history[0].providerMode).toBe("unavailable");
  });
});

