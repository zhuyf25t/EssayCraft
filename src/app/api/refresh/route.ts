import { NextResponse } from "next/server";
import type { Annotation, Patch, RefreshResponse } from "@/types/essaycraft";
import { createAiClient, AI_FAST_MODEL, hasAiKey, withAiTimeout } from "@/lib/ai-client";
import { buildMockAnnotations, exactAnnotations, findIssueRanges, normalizeAnnotations } from "@/lib/annotations";
import { buildRefreshMessages } from "@/lib/prompts";
import { refreshRequestSchema, refreshResponseSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const input = refreshRequestSchema.parse(json);

    if (!hasAiKey()) {
      return NextResponse.json(mockRefresh(input.text, input.patches, "Mock refresh completed locally because no API key is configured."));
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
      const fallback = mockRefresh(input.text, input.patches, "Fallback refresh completed locally because the configured AI provider was unavailable.");
      fallback.warnings.push(`DeepSeek refresh unavailable; used mock labels. ${aiError instanceof Error ? aiError.message : ""}`.trim());
      return NextResponse.json(fallback);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function mockRefresh(text: string, patches: Patch[], message: string): RefreshResponse {
  const patchAnnotations = annotationsFromPatches(text, patches);
  const annotations = normalizeAnnotations(text, [...patchAnnotations, ...buildMockAnnotations(text), ...findIssueRanges(text)]);

  return {
    annotations,
    globalFeedback: [message],
    warnings: []
  };
}

function annotationsFromPatches(text: string, patches: Patch[]): Annotation[] {
  const result: Annotation[] = [];
  for (const patch of patches) {
    if (patch.resolved || patch.stale || patch.anchorEnd <= patch.anchorStart || patch.anchorEnd > text.length) continue;
    const lower = patch.text.toLowerCase();
    if (lower.includes("analysis") && lower.includes("not evidence")) {
      result.push({
        id: `patch-analysis-${patch.id}`,
        start: patch.anchorStart,
        end: patch.anchorEnd,
        text: text.slice(patch.anchorStart, patch.anchorEnd),
        label: "analysis",
        confidence: 0.82,
        comment: `Patch request: ${patch.text}`
      });
      continue;
    }
    if (lower.includes("source") || lower.includes("citation")) {
      result.push({
        id: `patch-source-${patch.id}`,
        start: patch.anchorStart,
        end: patch.anchorEnd,
        text: text.slice(patch.anchorStart, patch.anchorEnd),
        label: "issue",
        confidence: 0.82,
        comment: "Patch asks for stronger source support. Add a real source card; EssayCraft will not invent one."
      });
    }
  }
  return result;
}
