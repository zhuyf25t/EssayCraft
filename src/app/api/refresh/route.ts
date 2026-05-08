import { NextResponse } from "next/server";
import type { RefreshResponse } from "@/types/essaycraft";
import { createAiClient, AI_FAST_MODEL, hasAiKey, withAiTimeout } from "@/lib/ai-client";
import { buildMockAnnotations, exactAnnotations, findIssueRanges, normalizeAnnotations } from "@/lib/annotations";
import { buildRefreshMessages } from "@/lib/prompts";
import { refreshRequestSchema, refreshResponseSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const input = refreshRequestSchema.parse(json);

    if (!hasAiKey()) {
      return NextResponse.json(mockRefresh(input.text, "Mock refresh completed locally because no API key is configured."));
    }

    try {
      const client = createAiClient();
      const completion = await withAiTimeout(client.chat.completions.create({
        model: AI_FAST_MODEL,
        messages: buildRefreshMessages(input),
        response_format: { type: "json_object" },
        max_tokens: 4096,
        temperature: 0.1
      }));

      const raw = completion.choices[0]?.message?.content;
      if (!raw) throw new Error("AI returned empty content.");

      const parsed = refreshResponseSchema.parse(JSON.parse(raw));
      const exact = exactAnnotations(input.text, parsed.annotations);
      const normalized: RefreshResponse = {
        annotations: exact.annotations,
        globalFeedback: parsed.globalFeedback ?? [],
        warnings: [...(parsed.warnings ?? []), ...exact.warnings]
      };

      return NextResponse.json(normalized);
    } catch (aiError) {
      const fallback = mockRefresh(input.text, "Fallback refresh completed locally because the configured AI provider was unavailable.");
      fallback.warnings.push(`DeepSeek refresh unavailable; used mock labels. ${aiError instanceof Error ? aiError.message : ""}`.trim());
      return NextResponse.json(fallback);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function mockRefresh(text: string, message: string): RefreshResponse {
  const annotations = normalizeAnnotations(text, [...buildMockAnnotations(text), ...findIssueRanges(text)]);

  return {
    annotations,
    globalFeedback: [message],
    warnings: []
  };
}
