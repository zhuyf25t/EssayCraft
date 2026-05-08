import "server-only";

import OpenAI from "openai";

export function hasAiKey() {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

export function createAiClient() {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error("DEEPSEEK_API_KEY is not set. Add it to .env.local or use mock fallback.");
  }

  return new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    maxRetries: 1,
    timeout: 12000
  });
}

export const AI_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-pro";
export const AI_FAST_MODEL = process.env.DEEPSEEK_FAST_MODEL || process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

export async function withAiTimeout<T>(promise: Promise<T>, timeoutMs = 8000): Promise<T> {
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
