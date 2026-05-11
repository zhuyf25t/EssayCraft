import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("AI provider routing config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses provider-first task timeout defaults", async () => {
    vi.stubEnv("ESSAYCRAFT_CHAT_TIMEOUT_MS", "");
    vi.stubEnv("ESSAYCRAFT_EDIT_TIMEOUT_MS", "");
    vi.stubEnv("ESSAYCRAFT_ASSIST_TIMEOUT_MS", "");
    vi.stubEnv("ESSAYCRAFT_REFRESH_TIMEOUT_MS", "");
    vi.stubEnv("ESSAYCRAFT_TRANSLATE_TIMEOUT_MS", "");
    vi.stubEnv("ESSAYCRAFT_GENERATE_TIMEOUT_MS", "");
    const config = await import("./ai-client");

    expect(config.CHAT_TIMEOUT_MS).toBe(60000);
    expect(config.EDIT_TIMEOUT_MS).toBe(60000);
    expect(config.ASSIST_TIMEOUT_MS).toBe(60000);
    expect(config.REFRESH_TIMEOUT_MS).toBe(300000);
    expect(config.TRANSLATE_TIMEOUT_MS).toBe(60000);
    expect(config.GENERATE_TIMEOUT_MS).toBe(300000);
  });

  it("attempts the provider when a key exists and mock is not forced", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    vi.stubEnv("ESSAYCRAFT_FORCE_MOCK_AI", "0");
    const config = await import("./ai-client");

    expect(config.hasAiKey()).toBe(true);
    expect(config.providerSkipReason()).toBeUndefined();
  });

  it("reports forced mock separately from missing provider key", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    vi.stubEnv("ESSAYCRAFT_FORCE_MOCK_AI", "1");
    let config = await import("./ai-client");
    expect(config.hasAiKey()).toBe(true);
    expect(config.providerSkipReason()).toBe("forced-mock");

    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    vi.stubEnv("ESSAYCRAFT_FORCE_MOCK_AI", "0");
    config = await import("./ai-client");
    expect(config.hasAiKey()).toBe(false);
    expect(config.providerSkipReason()).toBe("missing-api-key");
  });

  it("keeps DeepSeek thinking configurable", async () => {
    vi.stubEnv("ESSAYCRAFT_DEEPSEEK_THINKING", "enabled");
    let config = await import("./ai-client");
    expect(config.deepSeekThinkingMode()).toBe("enabled");
    expect(config.deepSeekRequestBody({ model: "x" })).toMatchObject({ thinking: { type: "enabled" } });

    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("ESSAYCRAFT_DEEPSEEK_THINKING", "omit");
    config = await import("./ai-client");
    expect(config.deepSeekThinkingMode()).toBe("omit");
    expect(config.deepSeekRequestBody({ model: "x" })).toEqual({ model: "x" });
  });
});
