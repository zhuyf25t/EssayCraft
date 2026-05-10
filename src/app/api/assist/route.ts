import { NextResponse } from "next/server";
import type { AssistRequest, AssistResponse, AssistResponseLegacy } from "@/types/essaycraft";
import {
  addAiMetadata,
  aiMetadata,
  AI_FAST_MODEL,
  AI_MOCK_MODEL,
  ASSIST_TIMEOUT_MS,
  createAiClient,
  fallbackReasonFromError,
  providerSkipReason,
  withAiTimeout
} from "@/lib/ai-client";
import { exactAnnotations } from "@/lib/annotations";
import { normalizedForNoopCompare, protectModuleText, stripEditorKernelMarkers } from "@/lib/noteKernel";
import { buildAssistMessages } from "@/lib/prompts";
import { changeRequested } from "@/lib/rewriteFallback";
import { mockAssist, sanitizeReplacement } from "@/lib/assistMock";
import { assistRequestSchema, assistResponseSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const startedAt = performance.now();
  try {
    const json = await request.json();
    const input = normalizeAssistInput(assistRequestSchema.parse(json));

    const skipReason = providerSkipReason();
    if (skipReason) {
      return NextResponse.json(addAiMetadata(mockAssist(input), aiMetadata(startedAt, "mock", AI_MOCK_MODEL, skipReason)));
    }

    try {
      const client = createAiClient(ASSIST_TIMEOUT_MS);
      const completion = await withAiTimeout(
        client.chat.completions.create({
          model: AI_FAST_MODEL,
          messages: buildAssistMessages(input),
          response_format: { type: "json_object" },
          max_tokens: 3500,
          temperature: 0.2
        }),
        ASSIST_TIMEOUT_MS
      );

      const raw = completion.choices[0]?.message?.content;
      if (!raw) throw new Error("AI returned empty content.");

      const parsed = coerceAssistResponse(input, JSON.parse(raw), "deepseek");
      const exact = exactAnnotations(input.text, parsed.annotations ?? []);
      const rangeWarning = validateAssistReplaceRange(input, parsed);
      if (rangeWarning && parsed.kind === "edit") {
        return NextResponse.json(addAiMetadata({
          kind: "inspect",
          title: "Selection changed",
          actionType: parsed.actionType,
          originalExcerpt: input.selectedText,
          reply: rangeWarning,
          explanation: "Ask for a new preview before applying an edit.",
          annotations: exact.annotations,
          warnings: exact.warnings,
          providerMode: "deepseek"
        } satisfies AssistResponse, aiMetadata(startedAt, "deepseek", AI_FAST_MODEL)));
      }
      const normalized: AssistResponse = {
        ...parsed,
        providerMode: "deepseek",
        annotations: exact.annotations,
        warnings: [...(parsed.warnings ?? []), ...exact.warnings]
      };

      return NextResponse.json(addAiMetadata(normalized, aiMetadata(startedAt, "deepseek", AI_FAST_MODEL)));
    } catch (aiError) {
      const fallback = mockAssist(input);
      console.warn("DeepSeek assistant fallback:", aiError);
      fallback.providerMode = "fallback";
      fallback.warnings.push("Local fallback suggestion used.");
      return NextResponse.json(addAiMetadata(fallback, aiMetadata(startedAt, "fallback", AI_MOCK_MODEL, fallbackReasonFromError(aiError, AI_FAST_MODEL))));
    }
  } catch (error) {
    console.warn("Invalid assistant request:", error);
    return NextResponse.json({ error: "Assistant could not use that request." }, { status: 400 });
  }
}

function normalizeAssistInput(input: AssistRequest): AssistRequest {
  const text = protectModuleText(input.text);
  const range = input.selectedRange;
  if (!range || range.end <= range.start) {
    return { ...input, text, selectedRange: undefined, selectedText: undefined, selectedPatches: [] };
  }
  const safeRange = {
    start: Math.max(0, Math.min(text.length, range.start)),
    end: Math.max(0, Math.min(text.length, range.end))
  };
  return {
    ...input,
    text,
    selectedRange: safeRange.end > safeRange.start ? safeRange : undefined,
    selectedText: safeRange.end > safeRange.start ? text.slice(safeRange.start, safeRange.end) : undefined,
    selectedPatches: safeRange.end > safeRange.start ? selectedPatchesForRange(input, safeRange) : []
  };
}

function selectedPatchesForRange(input: AssistRequest, range: { start: number; end: number }) {
  const submitted = (input.selectedPatches ?? []).filter(isOpenPatch);
  if (submitted.length) return submitted;
  return input.patches.filter((patch) => isOpenPatch(patch) && patch.anchorStart < range.end && range.start < patch.anchorEnd);
}

function isOpenPatch(patch: AssistRequest["patches"][number]) {
  return !patch.resolved && patch.status !== "resolved" && !patch.stale && patch.text.trim();
}

function validateAssistReplaceRange(input: AssistRequest, response: AssistResponse) {
  if (!response.replaceRange) return "";
  const range = response.replaceRange;
  const inBounds = range.start >= 0 && range.end > range.start && range.end <= input.text.length;
  if (!inBounds) return "Assistant replacement was blocked because it did not target a valid text selection.";
  if (!input.selectedRange) return "Assistant replacement was blocked because no text selection was submitted.";
  if (range.start !== input.selectedRange.start || range.end !== input.selectedRange.end) {
    return "Assistant replacement was blocked because it did not target the submitted selection.";
  }
  return "";
}

function coerceAssistResponse(input: AssistRequest, raw: unknown, providerMode: "deepseek" | "mock" | "fallback"): AssistResponse {
  const parsed = assistResponseSchema.parse(raw) as AssistResponseLegacy;
  const expectedKind = expectedAssistKind(input);
  const kind = expectedKind !== "edit" ? expectedKind : parsed.kind ?? expectedKind;
  const base = {
    reply: parsed.reply,
    title: parsed.title,
    actionType: normalizedActionType(input, parsed.actionType),
    explanation: parsed.explanation,
    providerMode,
    annotations: parsed.annotations ?? [],
    warnings: parsed.warnings ?? []
  };

  if (kind === "edit") {
    if (!parsed.proposedText?.trim() || !parsed.replaceRange) {
      throw new Error("Provider returned an unusable edit preview.");
    }
    const original = input.selectedText ?? input.text.slice(parsed.replaceRange.start, parsed.replaceRange.end);
    const proposedText = sanitizeReplacement(stripEditorKernelMarkers(parsed.proposedText), original);
    if (changeRequested(input.action) && normalizedForNoopCompare(proposedText) === normalizedForNoopCompare(original)) {
      throw new Error("Provider returned an unchanged edit preview.");
    }
    return {
      ...base,
      kind: "edit",
      proposedText,
      replaceRange: parsed.replaceRange,
      originalText: parsed.originalText,
      originalExcerpt: parsed.originalExcerpt
    };
  }

  if (kind === "inspect") {
    return {
      ...base,
      kind: "inspect",
      originalExcerpt: parsed.originalExcerpt
    };
  }

  return {
    ...base,
    kind: "chat"
  };
}

function normalizedActionType(input: AssistRequest, actionType?: string) {
  const action = input.action.toLowerCase();
  if (action.includes("translate")) return "translate-selection";
  if (/academic|\u5b66\u672f|\u6b63\u5f0f/.test(action)) return "academic-rewrite";
  if (/rewrite|revise|\u91cd\u5199|\u6539\u5199|\u66f4\u957f|\u5199\u957f|\u6839\u636e.*title/.test(action)) return "rewrite-selection";
  if (isAnalyzeAction(input.action)) return "analyze-selection";
  if (action.includes("explain")) return "highlight-explanation";
  return actionType;
}

function expectedAssistKind(input: AssistRequest): AssistResponse["kind"] {
  const action = input.action.toLowerCase();
  if (input.selectedRange && isEditAction(action)) return "edit";
  if (/(explain|relabel|highlight|citation)/i.test(action) || isAnalyzeAction(input.action)) return "inspect";
  return "chat";
}

function isEditAction(action: string) {
  return /(rewrite|academic|analysis|translate|revise|sentence|passage|formal|longer|shorter|natural|awkward|\u91cd\u5199|\u6539\u5199|\u66f4\u5b66\u672f|\u5b66\u672f|\u6b63\u5f0f|\u66f4\u957f|\u5199\u957f|\u66f4\u77ed|\u7b80\u77ed|\u81ea\u7136|\u5446\u677f|\u6839\u636e.*title|\u6839\u636e.*\u6807\u9898)/i.test(action);
}

function isAnalyzeAction(action: string) {
  return /(analy[sz]e|critique|comment|grammar|rhetorical role|\u5206\u6790|\u8bc4\u4ef7|\u70b9\u8bc4|\u7528\u4e2d\u6587)/i.test(action);
}
