import "server-only";

import { NextResponse } from "next/server";
import {
  addAiMetadata,
  aiMetadata,
  AI_FAST_MODEL,
  AI_MOCK_MODEL,
  createAiClient,
  fallbackReasonFromError,
  forceMockEnabled,
  hasAiKey,
  CHAT_TIMEOUT_MS,
  withAiTimeout
} from "@/lib/ai-client";

export const dynamic = "force-dynamic";

export async function POST() {
  const startedAt = performance.now();
  if (forceMockEnabled()) {
    return NextResponse.json(addAiMetadata({
      ok: true,
      message: "Mock mode is explicitly enabled.",
      providerMode: "mock" as const
    }, aiMetadata(startedAt, "mock", AI_MOCK_MODEL, "forced-mock")));
  }
  if (!hasAiKey()) {
    return NextResponse.json(addAiMetadata({
      ok: false,
      message: "AI unavailable. DEEPSEEK_API_KEY is not configured.",
      providerMode: "unavailable" as const
    }, aiMetadata(startedAt, "unavailable", "none", "missing-api-key")), { status: 503 });
  }

  try {
    const client = createAiClient(Math.min(CHAT_TIMEOUT_MS, 15000));
    const completion = await withAiTimeout(
      client.chat.completions.create({
        model: AI_FAST_MODEL,
        messages: [
          { role: "system", content: "Return a short plain-text provider health response." },
          { role: "user", content: "Reply with: EssayCraft provider ready." }
        ],
        max_tokens: 40,
        temperature: 0
      }),
      Math.min(CHAT_TIMEOUT_MS, 15000)
    );
    const message = completion.choices[0]?.message?.content?.trim() || "Provider responded.";
    return NextResponse.json(addAiMetadata({
      ok: true,
      message,
      providerMode: "deepseek" as const
    }, aiMetadata(startedAt, "deepseek", AI_FAST_MODEL)));
  } catch (error) {
    const reason = fallbackReasonFromError(error, AI_FAST_MODEL);
    return NextResponse.json(addAiMetadata({
      ok: false,
      message: "AI unavailable. Provider health check failed.",
      providerMode: "unavailable" as const
    }, aiMetadata(startedAt, "unavailable", "none", reason)), { status: 503 });
  }
}

