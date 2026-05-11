import { NextResponse } from "next/server";
import type { AssistRequest, AssistResponse, AssistResponseLegacy } from "@/types/essaycraft";
import { exactAnnotations } from "@/lib/annotations";
import { normalizedForNoopCompare, protectModuleText, stripEditorKernelMarkers } from "@/lib/noteKernel";
import { buildAssistMessages } from "@/lib/prompts";
import { changeRequested } from "@/lib/rewriteFallback";
import { sanitizeReplacement } from "@/lib/assistMock";
import { mockAssist } from "@/lib/ai/mockProvider";
import { runJsonAiTask } from "@/lib/ai/taskRouter";
import type { AiTaskType } from "@/lib/ai/tasks";
import { assistRequestSchema, assistResponseSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const input = normalizeAssistInput(assistRequestSchema.parse(json));
    const result = await runJsonAiTask({
      taskType: assistTaskType(input),
      messages: buildAssistMessages(input),
      schema: assistResponseSchema,
      mock: () => mockAssist(input),
      unavailable: (reason) => unavailableAssist(input, reason),
      parseProvider: (raw) => {
        const parsed = coerceAssistResponse(input, raw, "deepseek");
      const exact = exactAnnotations(input.text, parsed.annotations ?? []);
      const rangeWarning = validateAssistReplaceRange(input, parsed);
      if (rangeWarning && parsed.kind === "edit") {
        return {
          kind: "inspect",
          title: "Selection changed",
          actionType: parsed.actionType,
          originalExcerpt: input.selectedText,
          reply: rangeWarning,
          explanation: "Ask for a new preview before applying an edit.",
          annotations: exact.annotations,
          warnings: exact.warnings,
          providerMode: "deepseek"
        } satisfies AssistResponse;
      }
      return {
        ...parsed,
        providerMode: "deepseek",
        annotations: exact.annotations,
        warnings: [...(parsed.warnings ?? []), ...exact.warnings]
      } satisfies AssistResponse;
      },
      maxTokens: 3500,
      temperature: 0.2
    });
    return NextResponse.json(result);
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

function coerceAssistResponse(input: AssistRequest, raw: unknown, providerMode: "deepseek" | "mock" | "unavailable"): AssistResponse {
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
  if (isTranslateAction(input.action) || isAnalyzeAction(input.action) || /(explain|relabel|highlight|citation)/i.test(action)) return "inspect";
  if (input.selectedRange && isEditAction(action)) return "edit";
  return "chat";
}

function isEditAction(action: string) {
  return /(rewrite|academic|revise|sentence|passage|formal|longer|shorter|natural|awkward|\u91cd\u5199|\u6539\u5199|\u66f4\u5b66\u672f|\u5b66\u672f|\u6b63\u5f0f|\u66f4\u957f|\u5199\u957f|\u66f4\u77ed|\u7b80\u77ed|\u81ea\u7136|\u5446\u677f|\u6839\u636e.*title|\u6839\u636e.*\u6807\u9898)/i.test(action);
}

function isAnalyzeAction(action: string) {
  return /^(analy[sz]e|critique|comment|grammar|rhetorical role)\b/i.test(action);
}

function isTranslateAction(action: string) {
  return /translate|\u7ffb\u8bd1|\u8bd1\u6210/i.test(action);
}

function assistTaskType(input: AssistRequest): AiTaskType {
  const normalized = normalizedActionType(input);
  if (normalized === "academic-rewrite") return "academicRewrite";
  if (normalized === "rewrite-selection") return "rewriteSelection";
  if (normalized === "translate-selection") return "translateSelection";
  if (normalized === "highlight-explanation") return "explainHighlight";
  if (normalized === "analyze-selection") return "analyzeSelection";
  return "chatModule";
}

function unavailableAssist(input: AssistRequest, reason: string): AssistResponse {
  const expectedKind = expectedAssistKind(input);
  const reply = "AI unavailable. Check DeepSeek settings or retry. Enable ESSAYCRAFT_FORCE_MOCK_AI=1 only for an offline demo.";
  const warnings = [safeUnavailableReason(reason)];
  if (expectedKind === "chat") {
    return {
      kind: "chat",
      reply,
      annotations: [],
      warnings,
      providerMode: "unavailable"
    };
  }
  return {
    kind: "inspect",
    title: "AI unavailable",
    actionType: "ai-unavailable",
    originalExcerpt: input.selectedText,
    reply,
    explanation: "No document text was changed.",
    annotations: [],
    warnings,
    providerMode: "unavailable"
  };
}

function safeUnavailableReason(reason: string) {
  if (reason === "missing-api-key") return "DeepSeek API key is not configured.";
  if (reason === "forced-mock") return "Mock mode was explicitly enabled.";
  return "Provider request did not complete successfully.";
}
