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
    baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com"
  });
}

export const AI_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-pro";
