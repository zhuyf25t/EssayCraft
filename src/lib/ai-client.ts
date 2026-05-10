import "server-only";

import OpenAI from "openai";

export function hasAiKey() {
  return Boolean(process.env.DEEPSEEK_API_KEY?.trim()) && process.env.ESSAYCRAFT_FORCE_MOCK_AI !== "1";
}

export function createAiClient() {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not set. Add it to .env.local or use mock fallback.");
  }

  return new OpenAI({
    apiKey,
    baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    maxRetries: 1,
    timeout: 12000
  });
}

export const AI_HIGH_QUALITY_MODEL = process.env.DEEPSEEK_HIGH_QUALITY_MODEL || "deepseek-v4-pro";
export const AI_MODEL = process.env.DEEPSEEK_MODEL || AI_HIGH_QUALITY_MODEL;
export const AI_FAST_MODEL = process.env.DEEPSEEK_FAST_MODEL || process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
export const interactiveTimeoutMs = Number(process.env.ESSAYCRAFT_FAST_FALLBACK_MS ?? (process.env.NODE_ENV === "development" ? 2500 : 8000));

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
