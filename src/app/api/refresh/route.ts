import { NextResponse } from "next/server";
import type { RefreshResponse, Segment, SegmentLabel } from "@/types/essaycraft";
import { createAiClient, AI_MODEL, hasAiKey } from "@/lib/ai-client";
import { buildRefreshMessages } from "@/lib/prompts";
import { refreshRequestSchema, refreshResponseSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const input = refreshRequestSchema.parse(json);

    if (!hasAiKey()) {
      return NextResponse.json(mockRefresh(input.segments));
    }

    const client = createAiClient();
    const completion = await client.chat.completions.create({
      model: AI_MODEL,
      messages: buildRefreshMessages(input),
      response_format: { type: "json_object" },
      max_tokens: 4096,
      temperature: 0.1
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("AI returned empty content.");

    const parsed = refreshResponseSchema.parse(JSON.parse(raw));
    const idSet = new Set(input.segments.map((segment) => segment.id));
    const byId = new Map(parsed.segments.filter((segment) => idSet.has(segment.id)).map((segment) => [segment.id, segment]));

    const normalized: RefreshResponse = {
      segments: input.segments.map((segment) => {
        const updated = byId.get(segment.id);
        return {
          id: segment.id,
          label: updated?.label ?? segment.label,
          confidence: updated?.confidence,
          aiComment: updated?.aiComment
        };
      }),
      globalFeedback: parsed.globalFeedback ?? []
    };

    return NextResponse.json(normalized);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function mockRefresh(segments: Segment[]): RefreshResponse {
  return {
    segments: segments.map((segment) => ({
      id: segment.id,
      label: guessLabel(segment.text),
      confidence: 0.61,
      aiComment: "Mock label. Add DEEPSEEK_API_KEY to enable AI refresh."
    })),
    globalFeedback: ["Mock refresh completed locally because no API key is configured."]
  };
}

function guessLabel(text: string): SegmentLabel {
  const lower = text.toLowerCase();
  if (lower.includes("this essay argues") || lower.includes("this paper will argue") || lower.includes("working thesis") || lower.includes("thesis")) return "thesis";
  if (lower.includes("according to") || /\([a-z][a-z\s&.,-]+,\s*\d{4}\)/i.test(text)) return "evidence";
  if (lower.includes("for example") || lower.includes("study") || lower.includes("research") || lower.includes("data") || lower.includes("evidence")) return "evidence";
  if (lower.includes("because") || lower.includes("therefore") || lower.includes("this means") || lower.includes("as a result") || lower.includes("suggests")) return "analysis";
  if (lower.includes("some argue") || lower.includes("however") || lower.includes("although") || lower.includes("counterargument")) return "counterargument";
  if (lower.includes("in conclusion") || lower.includes("finally") || lower.includes("to conclude") || lower.includes("overall")) return "conclusion";
  if (lower.includes("[citation needed]") || lower.includes("needs source")) return "issue";
  if (lower.includes("topic:") || lower.includes("introduction") || lower.includes("background")) return "background";
  return "plain";
}
