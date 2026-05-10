import { NextResponse } from "next/server";
import type { RefreshResponse } from "@/types/essaycraft";
import {
  addAiMetadata,
  aiMetadata,
  AI_FAST_MODEL,
  AI_MOCK_MODEL,
  createAiClient,
  fallbackReasonFromError,
  providerSkipReason,
  REFRESH_TIMEOUT_MS,
  withAiTimeout
} from "@/lib/ai-client";
import { buildMockAnnotations, normalizeAnnotations } from "@/lib/annotations";
import { normalizedForNoopCompare, protectModuleText, stripEditorKernelMarkers } from "@/lib/noteKernel";
import { buildRefreshMessages } from "@/lib/prompts";
import { validateProviderRefreshAnnotations } from "@/lib/refreshValidation";
import { addModuleReviewIfNeeded, mockPatchRevision, mockRefresh, moduleRefreshSuggestion } from "@/lib/refreshFallback";
import { refreshRequestSchema, refreshResponseSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const startedAt = performance.now();
  try {
    const json = await request.json();
    const parsedInput = refreshRequestSchema.parse(json);
    const input = { ...parsedInput, text: protectModuleText(parsedInput.text) };
    const openPatches = input.patches.filter((patch) => !patch.resolved && patch.status !== "resolved" && !patch.stale && patch.text.trim());

    const skipReason = providerSkipReason();
    if (skipReason) {
      const mock = openPatches.length
        ? mockPatchRevision(input.text, openPatches, input.projectTitle || input.topic)
        : mockRefresh(input, "Highlights refreshed. Text was not rewritten.");
      return NextResponse.json(addAiMetadata(mock, aiMetadata(startedAt, "mock", AI_MOCK_MODEL, skipReason)));
    }

    try {
      const client = createAiClient(REFRESH_TIMEOUT_MS);
      const completion = await withAiTimeout(
        client.chat.completions.create({
          model: AI_FAST_MODEL,
          messages: buildRefreshMessages(input),
          response_format: { type: "json_object" },
          max_tokens: 4096,
          temperature: 0.1
        }),
        REFRESH_TIMEOUT_MS
      );

      const raw = completion.choices[0]?.message?.content;
      if (!raw) throw new Error("AI returned empty content.");

      const parsed = refreshResponseSchema.parse(JSON.parse(raw));
      if (openPatches.length && parsed.kind === "revision" && parsed.proposedText?.trim()) {
        const proposedText = stripEditorKernelMarkers(parsed.proposedText);
        if (normalizedForNoopCompare(proposedText) === normalizedForNoopCompare(input.text)) {
          throw new Error("Provider returned an unchanged note revision.");
        }
        return NextResponse.json(addAiMetadata({
          ...parsed,
          proposedText,
          providerMode: "deepseek",
          sourceText: input.text,
          proposedAnnotations: normalizeAnnotations(proposedText, parsed.proposedAnnotations ?? buildMockAnnotations(proposedText)),
          patchResolutionPlan: (parsed.patchResolutionPlan ?? []).filter((patchId) => openPatches.some((patch) => patch.id === patchId))
        }, aiMetadata(startedAt, "deepseek", AI_FAST_MODEL)));
      }
      if (openPatches.length) {
        const fallback = mockPatchRevision(input.text, openPatches, input.projectTitle || input.topic);
        return NextResponse.json(addAiMetadata(
          fallback,
          aiMetadata(startedAt, "fallback", AI_MOCK_MODEL, "provider-returned-non-revision-for-notes")
        ));
      }

      const validation = validateProviderRefreshAnnotations(input.text, parsed.annotations, input.moduleNumber);
      const providerWarnings = [...(parsed.warnings ?? []), ...validation.warnings];
      if (validation.usedFallback) {
        return NextResponse.json(addAiMetadata(addModuleReviewIfNeeded(input, {
          kind: "annotations",
          annotations: validation.annotations,
          globalFeedback: ["Highlights refreshed. Text was not rewritten.", moduleRefreshSuggestion(input, validation.annotations)].filter(Boolean),
          warnings: providerWarnings,
          providerMode: "fallback"
        }), aiMetadata(startedAt, "fallback", AI_MOCK_MODEL, validation.reason ?? "provider-refresh-validation-fallback")));
      }

      const normalized: RefreshResponse = addModuleReviewIfNeeded(input, {
        kind: "annotations",
        annotations: validation.annotations,
        globalFeedback: parsed.globalFeedback?.length ? parsed.globalFeedback : [moduleRefreshSuggestion(input, validation.annotations)],
        warnings: providerWarnings,
        providerMode: "deepseek"
      });

      return NextResponse.json(addAiMetadata(normalized, aiMetadata(startedAt, "deepseek", AI_FAST_MODEL)));
    } catch (aiError) {
      const fallback = openPatches.length
        ? mockPatchRevision(input.text, openPatches, input.projectTitle || input.topic)
        : mockRefresh(input, "Highlights refreshed. Text was not rewritten.");
      fallback.providerMode = "fallback";
      fallback.warnings.push("Refresh used a local fallback. Text was not rewritten.");
      return NextResponse.json(addAiMetadata(fallback, aiMetadata(startedAt, "fallback", AI_MOCK_MODEL, fallbackReasonFromError(aiError, AI_FAST_MODEL))));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
