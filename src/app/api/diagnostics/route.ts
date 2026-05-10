import "server-only";

import { NextResponse } from "next/server";
import { AI_FAST_MODEL, AI_HIGH_QUALITY_MODEL, AI_MODEL, hasAiKey, interactiveTimeoutMs } from "@/lib/ai-client";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    providerConfigured: hasAiKey(),
    forceMock: process.env.ESSAYCRAFT_FORCE_MOCK_AI === "1",
    model: AI_MODEL,
    fastModel: AI_FAST_MODEL,
    highQualityModel: AI_HIGH_QUALITY_MODEL,
    interactiveTimeoutMs,
    baseUrlConfigured: Boolean(process.env.DEEPSEEK_BASE_URL?.trim()),
    note: "Next dev compile logs such as Compiled /api/refresh are normal and are not product errors."
  });
}
