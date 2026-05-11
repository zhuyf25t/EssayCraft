import "server-only";

import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";

export type AiProviderMode = "deepseek" | "mock" | "unavailable";

export type AiResponseMetadata = {
  providerMode: AiProviderMode;
  modelUsed: string;
  latencyMs: number;
  totalTokens?: number;
  fallbackReason?: string;
};

type AiRuntimeConfig = {
  timeoutsMs?: Record<string, number>;
  maxTokens?: Record<string, number>;
};

let runtimeConfigCache: AiRuntimeConfig | undefined;

export const AI_HIGH_QUALITY_MODEL = process.env.DEEPSEEK_HIGH_QUALITY_MODEL || "deepseek-v4-pro";
export const AI_MODEL = process.env.DEEPSEEK_MODEL || AI_HIGH_QUALITY_MODEL;
export const AI_FAST_MODEL = process.env.DEEPSEEK_FAST_MODEL || process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
export const AI_MOCK_MODEL = "deterministic-mock";
export const CHAT_TIMEOUT_MS = readTimeout("ESSAYCRAFT_CHAT_TIMEOUT_MS", readTimeout("ESSAYCRAFT_ASSIST_TIMEOUT_MS", readAiRuntimeTimeout("chatModule", 60000)));
export const EDIT_TIMEOUT_MS = readTimeout("ESSAYCRAFT_EDIT_TIMEOUT_MS", readTimeout("ESSAYCRAFT_ASSIST_TIMEOUT_MS", readAiRuntimeTimeout("editActions", 60000)));
export const REFRESH_TIMEOUT_MS = readTimeout("ESSAYCRAFT_REFRESH_TIMEOUT_MS", readAiRuntimeTimeout("refreshAnnotations", 120000));
export const TRANSLATE_TIMEOUT_MS = readTimeout("ESSAYCRAFT_TRANSLATE_TIMEOUT_MS", readAiRuntimeTimeout("translateSelection", 60000));
export const GENERATE_TIMEOUT_MS = readTimeout("ESSAYCRAFT_GENERATE_TIMEOUT_MS", readAiRuntimeTimeout("generateNextModule", 120000));
export const ASSIST_TIMEOUT_MS = EDIT_TIMEOUT_MS;
export const FAST_FALLBACK_MS = readTimeout("ESSAYCRAFT_FAST_FALLBACK_MS", process.env.NODE_ENV === "development" ? 2500 : 8000);
export const interactiveTimeoutMs = EDIT_TIMEOUT_MS;

export function hasAiKey() {
  return Boolean(process.env.DEEPSEEK_API_KEY?.trim());
}

export function providerSkipReason() {
  if (process.env.ESSAYCRAFT_FORCE_MOCK_AI === "1") return "forced-mock";
  if (!process.env.DEEPSEEK_API_KEY?.trim()) return "missing-api-key";
  return undefined;
}

export function forceMockEnabled() {
  return process.env.ESSAYCRAFT_FORCE_MOCK_AI === "1";
}

export function offlineMockAllowed() {
  return process.env.ESSAYCRAFT_ALLOW_OFFLINE_MOCK === "1";
}

export function createAiClient(timeoutMs = ASSIST_TIMEOUT_MS) {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not set. Add it to .env.local or enable explicit mock mode.");
  }

  return new OpenAI({
    apiKey,
    baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    maxRetries: 1,
    timeout: timeoutMs
  });
}

export function deepSeekRequestBody<T extends object>(body: T): T & {
  thinking: { type: "disabled" };
} {
  return {
    ...body,
    thinking: { type: "disabled" }
  };
}

export async function withAiTimeout<T>(promise: Promise<T>, timeoutMs = interactiveTimeoutMs): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`AI provider timed out after ${timeoutMs}ms.`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function elapsedMs(startedAt: number) {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

export function aiMetadata(
  startedAt: number,
  providerMode: AiProviderMode,
  modelUsed: string,
  fallbackReason?: string,
  totalTokens?: number
): AiResponseMetadata {
  const metadata: AiResponseMetadata = {
    providerMode,
    modelUsed,
    latencyMs: elapsedMs(startedAt)
  };
  if (typeof totalTokens === "number") {
    metadata.totalTokens = Math.max(0, Math.round(totalTokens));
  } else if (providerMode !== "deepseek") {
    metadata.totalTokens = 0;
  }
  if (fallbackReason) metadata.fallbackReason = fallbackReason;
  return metadata;
}

export function addAiMetadata<T extends object>(payload: T, metadata: AiResponseMetadata): T & AiResponseMetadata {
  return { ...payload, ...metadata };
}

export function fallbackReasonFromError(error: unknown, model: string) {
  const message = error instanceof Error ? error.message : "AI provider failed.";
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  const safeMessage = apiKey ? message.split(apiKey).join("[redacted-api-key]") : message;
  return `provider-error:${model}:${safeMessage.slice(0, 240)}`;
}

export function readAiRuntimeTimeout(taskId: string, fallback: number) {
  return readPositiveRuntimeNumber(runtimeConfig().timeoutsMs?.[taskId], fallback);
}

export function readAiRuntimeMaxTokens(key: string, fallback: number) {
  const config = runtimeConfig().maxTokens ?? {};
  return readPositiveRuntimeNumber(config[key], readPositiveRuntimeNumber(config.default, fallback));
}

export function aiRuntimeConfigSource() {
  return path.join(process.cwd(), "prompts", "ai-runtime.json");
}

function runtimeConfig(): AiRuntimeConfig {
  if (runtimeConfigCache) return runtimeConfigCache;
  const filePath = aiRuntimeConfigSource();
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as AiRuntimeConfig;
    runtimeConfigCache = parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    runtimeConfigCache = {};
  }
  return runtimeConfigCache;
}

function readTimeout(name: string, fallback: number) {
  const value = Number(process.env[name]?.trim());
  return readPositiveRuntimeNumber(value, fallback);
}

function readPositiveRuntimeNumber(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}
