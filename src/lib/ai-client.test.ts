import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("AI provider routing config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses task-specific timeout defaults instead of the old 2500ms chat fallback", async () => {
    vi.stubEnv("ESSAYCRAFT_ASSIST_TIMEOUT_MS", "");
    vi.stubEnv("ESSAYCRAFT_REFRESH_TIMEOUT_MS", "");
    vi.stubEnv("ESSAYCRAFT_TRANSLATE_TIMEOUT_MS", "");
    vi.stubEnv("ESSAYCRAFT_GENERATE_TIMEOUT_MS", "");
    const config = await import("./ai-client");

    expect(config.ASSIST_TIMEOUT_MS).toBe(12000);
    expect(config.REFRESH_TIMEOUT_MS).toBe(10000);
    expect(config.TRANSLATE_TIMEOUT_MS).toBe(10000);
    expect(config.GENERATE_TIMEOUT_MS).toBe(30000);
  });

  it("attempts the provider when a key exists and mock is not forced", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    vi.stubEnv("ESSAYCRAFT_FORCE_MOCK_AI", "0");
    const config = await import("./ai-client");

    expect(config.hasAiKey()).toBe(true);
    expect(config.providerSkipReason()).toBeUndefined();
  });

  it("uses mock when forced or when the provider key is absent", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    vi.stubEnv("ESSAYCRAFT_FORCE_MOCK_AI", "1");
    let config = await import("./ai-client");
    expect(config.hasAiKey()).toBe(false);
    expect(config.providerSkipReason()).toBe("forced-mock");

    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    vi.stubEnv("ESSAYCRAFT_FORCE_MOCK_AI", "0");
    config = await import("./ai-client");
    expect(config.hasAiKey()).toBe(false);
    expect(config.providerSkipReason()).toBe("missing-api-key");
  });
});
