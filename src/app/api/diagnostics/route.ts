import "server-only";

import { NextResponse } from "next/server";
import {
  AI_FAST_MODEL,
  AI_HIGH_QUALITY_MODEL,
  AI_MODEL,
  ASSIST_TIMEOUT_MS,
  CHAT_TIMEOUT_MS,
  EDIT_TIMEOUT_MS,
  GENERATE_TIMEOUT_MS,
  REFRESH_TIMEOUT_MS,
  TRANSLATE_TIMEOUT_MS,
  hasAiKey,
  interactiveTimeoutMs,
  offlineMockAllowed
} from "@/lib/ai-client";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    providerConfigured: hasAiKey(),
    forceMock: process.env.ESSAYCRAFT_FORCE_MOCK_AI === "1",
    offlineMockAllowed: offlineMockAllowed(),
    model: AI_MODEL,
    fastModel: AI_FAST_MODEL,
    highQualityModel: AI_HIGH_QUALITY_MODEL,
    interactiveTimeoutMs,
    chatTimeoutMs: CHAT_TIMEOUT_MS,
    editTimeoutMs: EDIT_TIMEOUT_MS,
    assistTimeoutMs: ASSIST_TIMEOUT_MS,
    refreshTimeoutMs: REFRESH_TIMEOUT_MS,
    translateTimeoutMs: TRANSLATE_TIMEOUT_MS,
    generateTimeoutMs: GENERATE_TIMEOUT_MS,
    baseUrlConfigured: Boolean(process.env.DEEPSEEK_BASE_URL?.trim()),
    note: "No silent semantic fallback: mock output is used only when ESSAYCRAFT_FORCE_MOCK_AI=1. Next dev compile logs are normal."
  });
}
