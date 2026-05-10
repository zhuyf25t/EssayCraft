import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));

describe("AI task router provider-first behavior", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns unavailable instead of mock when no provider key is configured", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    vi.stubEnv("ESSAYCRAFT_FORCE_MOCK_AI", "0");
    const { runJsonAiTask } = await import("./taskRouter");

    const result = await runJsonAiTask({
      taskType: "chatModule",
      messages: [{ role: "user", content: "hello" }],
      schema: z.object({ answer: z.string() }),
      mock: () => ({ answer: "mock" }),
      unavailable: (reason) => ({ answer: reason }),
      parseProvider: (raw) => raw
    });

    expect(result.providerMode).toBe("unavailable");
    expect(result.answer).toBe("missing-api-key");
    expect(result.answer).not.toBe("mock");
  });

  it("uses mock only when mock mode is explicitly forced", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    vi.stubEnv("ESSAYCRAFT_FORCE_MOCK_AI", "1");
    const { runJsonAiTask } = await import("./taskRouter");

    const result = await runJsonAiTask({
      taskType: "chatModule",
      messages: [{ role: "user", content: "hello" }],
      schema: z.object({ answer: z.string() }),
      mock: () => ({ answer: "mock" }),
      unavailable: (reason) => ({ answer: reason }),
      parseProvider: (raw) => raw
    });

    expect(result.providerMode).toBe("mock");
    expect(result.answer).toBe("mock");
    expect(result.fallbackReason).toBe("forced-mock");
  });
});

