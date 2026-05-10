import { NextResponse } from "next/server";
import type { RefreshRequest, RefreshResponse } from "@/types/essaycraft";
import { normalizeAnnotations } from "@/lib/annotations";
import { normalizedForNoopCompare, protectModuleText, stripEditorKernelMarkers } from "@/lib/noteKernel";
import { buildRefreshMessages } from "@/lib/prompts";
import { validateProviderRefreshAnnotations } from "@/lib/refreshValidation";
import { addModuleReviewIfNeeded, moduleRefreshSuggestion } from "@/lib/refreshFallback";
import { mockPatchRevision, mockRefresh } from "@/lib/ai/mockProvider";
import { runJsonAiTask } from "@/lib/ai/taskRouter";
import { refreshRequestSchema, refreshResponseSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsedInput = refreshRequestSchema.parse(json);
    const input = { ...parsedInput, text: protectModuleText(parsedInput.text) };
    const openPatches = input.patches.filter((patch) => !patch.resolved && patch.status !== "resolved" && !patch.stale && patch.text.trim());

    const result = await runJsonAiTask({
      taskType: openPatches.length ? "applyNotesRevision" : input.moduleNumber === 6 ? "finalReview" : input.moduleNumber === 5 ? "citationReview" : "refreshAnnotations",
      messages: buildRefreshMessages(input),
      schema: refreshResponseSchema,
      mock: () => openPatches.length
        ? mockPatchRevision(input.text, openPatches, input.projectTitle || input.topic)
        : mockRefresh(input, "Highlights refreshed. Text was not rewritten."),
      unavailable: (reason) => unavailableRefresh(input, reason),
      parseProvider: (parsed) => {
        if (openPatches.length && parsed.kind === "revision" && parsed.proposedText?.trim()) {
          const proposedText = stripEditorKernelMarkers(parsed.proposedText);
          if (normalizedForNoopCompare(proposedText) === normalizedForNoopCompare(input.text)) {
            throw new Error("Provider returned an unchanged note revision.");
          }
          const proposedValidation = validateProviderRefreshAnnotations(
            proposedText,
            parsed.proposedAnnotations ?? parsed.annotations ?? [],
            input.moduleNumber
          );
          if (proposedValidation.usedFallback) {
            throw new Error(proposedValidation.reason ?? "Provider returned invalid proposed annotations.");
          }
          return {
            ...parsed,
            proposedText,
            providerMode: "deepseek",
            sourceText: input.text,
            proposedAnnotations: proposedValidation.annotations,
            patchResolutionPlan: (parsed.patchResolutionPlan ?? []).filter((patchId) => openPatches.some((patch) => patch.id === patchId)),
            globalFeedback: parsed.globalFeedback ?? [],
            warnings: [...(parsed.warnings ?? []), ...proposedValidation.warnings]
          } satisfies RefreshResponse;
        }
        if (openPatches.length) {
          throw new Error("Provider returned non-revision output for open notes.");
        }

        const validation = validateProviderRefreshAnnotations(input.text, parsed.annotations, input.moduleNumber);
        const providerWarnings = [...(parsed.warnings ?? []), ...validation.warnings];
        if (validation.usedFallback) {
          throw new Error(validation.reason ?? "Provider returned invalid annotation output.");
        }

        return addModuleReviewIfNeeded(input, {
          kind: "annotations",
          annotations: validation.annotations,
          globalFeedback: parsed.globalFeedback?.length ? parsed.globalFeedback : [moduleRefreshSuggestion(input, validation.annotations)],
          warnings: providerWarnings,
          providerMode: "deepseek"
        }) satisfies RefreshResponse;
      },
      maxTokens: 16384,
      temperature: 0.1
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function unavailableRefresh(input: Pick<RefreshRequest, "text" | "annotations">, reason: string): RefreshResponse {
  return {
    kind: "annotations",
    annotations: normalizeAnnotations(input.text, input.annotations ?? []),
    globalFeedback: ["AI unavailable. Existing text and highlights were preserved."],
    warnings: [safeUnavailableReason(reason)],
    providerMode: "unavailable"
  };
}

function safeUnavailableReason(reason: string) {
  if (reason === "missing-api-key") return "DeepSeek API key is not configured.";
  if (reason === "forced-mock") return "Mock mode was explicitly enabled.";
  return "Provider request did not complete successfully.";
}
