import { NextResponse } from "next/server";
import type { Annotation, RefreshRequest, RefreshResponse } from "@/types/essaycraft";
import { normalizeAnnotations, rhetoricalUnitRanges } from "@/lib/annotations";
import { normalizedForNoopCompare, protectModuleText, stripEditorKernelMarkers } from "@/lib/noteKernel";
import { buildRefreshMessages, buildRefreshUnitMessages } from "@/lib/prompts";
import { validateProviderRefreshAnnotations } from "@/lib/refreshValidation";
import { addModuleReviewIfNeeded, moduleRefreshSuggestion } from "@/lib/refreshFallback";
import { mockPatchRevision, mockRefresh } from "@/lib/ai/mockProvider";
import { runJsonAiTask } from "@/lib/ai/taskRouter";
import { readAiRuntimeMaxTokens } from "@/lib/ai-client";
import { refreshRequestSchema, refreshResponseSchema, refreshUnitResponseSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsedInput = refreshRequestSchema.parse(json);
    const input = { ...parsedInput, text: protectModuleText(parsedInput.text) };
    const openPatches = input.patches.filter((patch) => !patch.resolved && patch.status !== "resolved" && !patch.stale && patch.text.trim());

    if (!openPatches.length) {
      const units = buildRefreshUnits(input.text, input.selectedRange);
      const result = await runJsonAiTask({
        taskType: "refreshAnnotations",
        messages: buildRefreshUnitMessages(input, units),
        schema: refreshUnitResponseSchema,
        mock: () => mockRefresh(input, "Highlights refreshed. Text was not rewritten."),
        unavailable: (reason) => unavailableRefresh(input, reason),
        parseProvider: (parsed) => {
          const unitWarnings = validateUnitLabelCoverage(units, parsed.unitLabels, { allowSparseVisibleLabels: Boolean(input.selectedRange) });
          const annotations = annotationsFromUnitLabels(units, parsed.unitLabels);
          const warnings = [...(parsed.warnings ?? []), ...unitWarnings.warnings];
          if (unitWarnings.reason) {
            throw new Error(unitWarnings.reason);
          }
          if (!annotations.length) {
            return addModuleReviewIfNeeded(input, {
              kind: parsed.kind ?? "annotations",
              annotations: [],
              globalFeedback: parsed.globalFeedback?.length ? parsed.globalFeedback : ["Refresh completed. No visible highlight labels were needed."],
              warnings,
              reviewSummary: parsed.reviewSummary,
              reviewChecklist: parsed.reviewChecklist,
              reviewSuggestions: parsed.reviewSuggestions,
              issueCount: issueCountFromAnnotations([], parsed.issueCount),
              citationGaps: parsed.citationGaps,
              inTextCitations: parsed.inTextCitations,
              realSourceCards: parsed.realSourceCards,
              referenceStatus: parsed.referenceStatus,
              nextStep: parsed.nextStep,
              providerMode: "deepseek"
            }) satisfies RefreshResponse;
          }
          const validation = validateProviderRefreshAnnotations(input.text, annotations, input.moduleNumber, {
            requireCoverage: false
          });
          warnings.push(...validation.warnings);
          if (validation.usedFallback) {
            throw new Error(validation.reason ?? "Provider returned invalid unit labels.");
          }

          return addModuleReviewIfNeeded(input, {
            kind: parsed.kind ?? "annotations",
            annotations: validation.annotations,
            globalFeedback: parsed.globalFeedback?.length ? parsed.globalFeedback : [moduleRefreshSuggestion(input, validation.annotations)],
            warnings,
            reviewSummary: parsed.reviewSummary,
            reviewChecklist: parsed.reviewChecklist,
            reviewSuggestions: parsed.reviewSuggestions,
            issueCount: issueCountFromAnnotations(validation.annotations, parsed.issueCount),
            citationGaps: parsed.citationGaps,
            inTextCitations: parsed.inTextCitations,
            realSourceCards: parsed.realSourceCards,
            referenceStatus: parsed.referenceStatus,
            nextStep: parsed.nextStep,
            providerMode: "deepseek"
          }) satisfies RefreshResponse;
        },
        maxTokens: refreshMaxTokens(),
        temperature: 0.1
      });
      return NextResponse.json(result);
    }

    const result = await runJsonAiTask({
      taskType: "applyNotesRevision",
      messages: buildRefreshMessages(input),
      schema: refreshResponseSchema,
      mock: () => mockPatchRevision(input.text, openPatches, input.projectTitle || input.topic),
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
        throw new Error("Provider returned non-revision output for open notes.");
      },
      maxTokens: refreshMaxTokens(),
      temperature: 0.1
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function buildRefreshUnits(text: string, selectedRange?: RefreshRequest["selectedRange"]) {
  const units = rhetoricalUnitRanges(text)
    .filter((unit) => unit.text.trim().length > 0);
  const scopedUnits = selectedRange
    ? units.filter((unit) => unit.start < selectedRange.end && selectedRange.start < unit.end)
    : units;
  if (selectedRange && !scopedUnits.length && selectedRange.end > selectedRange.start) {
    const start = Math.max(0, Math.min(text.length, selectedRange.start));
    const end = Math.max(start, Math.min(text.length, selectedRange.end));
    const selectedText = text.slice(start, end);
    if (selectedText.trim()) {
      scopedUnits.push({ start, end, text: selectedText });
    }
  }
  return scopedUnits.map((unit, index) => ({
    index,
    start: unit.start,
    end: unit.end,
    text: unit.text
  }));
}

function validateUnitLabelCoverage(
  units: ReturnType<typeof buildRefreshUnits>,
  labels: Array<{ index: number; label: Annotation["label"]; confidence?: number; comment?: string }>,
  options: { allowSparseVisibleLabels?: boolean } = {}
) {
  const expected = new Set(units.map((unit) => unit.index));
  const seen = new Set<number>();
  const duplicates = new Set<number>();
  const outOfRange: number[] = [];
  for (const label of labels) {
    if (!expected.has(label.index)) {
      outOfRange.push(label.index);
      continue;
    }
    if (seen.has(label.index)) duplicates.add(label.index);
    seen.add(label.index);
  }

  const missing = [...expected].filter((index) => !seen.has(index));
  const warnings: string[] = [];
  if (duplicates.size) warnings.push(`Provider returned duplicate unit labels for ${[...duplicates].slice(0, 8).join(", ")}.`);
  if (outOfRange.length) warnings.push(`Ignored ${outOfRange.length} out-of-range unit label(s).`);
  if (missing.length) {
    return {
      warnings,
      reason: `Provider omitted ${missing.length} unit label(s), including ${missing.slice(0, 8).join(", ")}.`
    };
  }

  if (!options.allowSparseVisibleLabels) {
    const meaningfulUnits = units.filter((unit) => unit.text.trim().length >= 16);
    const visibleIndexes = new Set(
      labels
        .filter((label) => label.label !== "plain" || hasExplicitNeedMarker(units[label.index]?.text ?? ""))
        .map((label) => label.index)
    );
    const visibleCount = meaningfulUnits.filter((unit) => visibleIndexes.has(unit.index)).length;
    const minimumVisible = Math.max(1, Math.ceil(meaningfulUnits.length * 0.65));
    if (meaningfulUnits.length >= 6 && visibleCount < minimumVisible) {
      return {
        warnings,
        reason: `Provider marked too many non-empty units as plain (${visibleCount}/${meaningfulUnits.length} visible; need at least ${minimumVisible}).`
      };
    }
  }
  return { warnings };
}

function annotationsFromUnitLabels(
  units: ReturnType<typeof buildRefreshUnits>,
  labels: Array<{ index: number; label: Annotation["label"]; confidence?: number; comment?: string }>
): Annotation[] {
  const byIndex = new Map(labels.map((item) => [item.index, item]));
  return units.flatMap((unit) => {
    const labeled = byIndex.get(unit.index);
    const explicitNeedMarker = hasExplicitNeedMarker(unit.text);
    if (!labeled || (labeled.label === "plain" && !explicitNeedMarker)) return [];
    const label = explicitNeedMarker ? "issue" : labeled.label;
    return [{
      id: `unit-${unit.index}`,
      start: unit.start,
      end: unit.end,
      text: unit.text,
      label,
      confidence: labeled.confidence,
      comment: explicitNeedMarker
        ? "This text contains an evidence/citation-needed placeholder that must be resolved with real support."
        : labeled.comment
    }];
  });
}

function hasExplicitNeedMarker(text: string) {
  return /\[(?:citation|evidence) needed(?::[^\]]*)?\]/i.test(text);
}

function unavailableRefresh(input: Pick<RefreshRequest, "text" | "annotations">, reason: string): RefreshResponse {
  const annotations = normalizeAnnotations(input.text, input.annotations ?? []);
  return {
    kind: "annotations",
    annotations,
    globalFeedback: ["AI unavailable. Existing text and highlights were preserved."],
    warnings: [safeUnavailableReason(reason)],
    providerMode: "unavailable",
    issueCount: issueCountFromAnnotations(annotations)
  };
}

function issueCountFromAnnotations(annotations: Annotation[], providerIssueCount = 0) {
  const localIssueCount = annotations.filter((annotation) => annotation.label === "issue").length;
  return Math.max(providerIssueCount, localIssueCount);
}

function refreshMaxTokens() {
  const configured = Number(process.env.ESSAYCRAFT_REFRESH_MAX_TOKENS ?? process.env.ESSAYCRAFT_MAX_TOKENS);
  return Number.isFinite(configured) && configured > 0 ? Math.round(configured) : readAiRuntimeMaxTokens("refreshAnnotations", 32768);
}

function safeUnavailableReason(reason: string) {
  if (reason === "missing-api-key") return "DeepSeek API key is not configured.";
  if (reason === "forced-mock") return "Mock mode was explicitly enabled.";
  return "Provider request did not complete successfully.";
}
