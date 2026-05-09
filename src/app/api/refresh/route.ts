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
    const openPatches = input.patches.filter((patch) => !patch.resolved && patch.status !== "resolved" && !patch.stale && patch.text.trim());

    if (!hasAiKey()) {
      return NextResponse.json(
        openPatches.length
          ? mockPatchRevision(input.text, openPatches)
          : mockRefresh(input.text, input.patches, "Mock refresh completed locally because no API key is configured.")
      );
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
      if (openPatches.length && parsed.kind === "revision" && parsed.proposedText?.trim()) {
        return NextResponse.json({
          ...parsed,
          providerMode: "deepseek",
          proposedAnnotations: normalizeAnnotations(parsed.proposedText, parsed.proposedAnnotations ?? buildMockAnnotations(parsed.proposedText)),
          patchResolutionPlan: parsed.patchResolutionPlan ?? openPatches.map((patch) => patch.id)
        });
      }
      if (openPatches.length) {
        return NextResponse.json(mockPatchRevision(input.text, openPatches));
      }

      const exact = exactAnnotations(input.text, parsed.annotations);
      const normalized: RefreshResponse = {
        kind: "annotations",
        annotations: exact.annotations,
        globalFeedback: parsed.globalFeedback ?? [],
        warnings: [...(parsed.warnings ?? []), ...exact.warnings],
        providerMode: "deepseek"
      };

      return NextResponse.json(normalized);
    } catch (aiError) {
      const fallback = openPatches.length
        ? mockPatchRevision(input.text, openPatches)
        : mockRefresh(input.text, input.patches, "Fallback refresh completed locally because the configured AI provider was unavailable.");
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
    kind: "annotations",
    annotations,
    globalFeedback: [message],
    warnings: [],
    providerMode: "mock"
  };
}

function mockPatchRevision(text: string, patches: Patch[]): RefreshResponse {
  const proposedText = applyPatchNotesToText(text, patches);
  const annotations = normalizeAnnotations(proposedText, buildMockAnnotations(proposedText));
  return {
    kind: "revision",
    annotations: [],
    proposedText,
    proposedAnnotations: annotations,
    originalSummary: summarizeChanges(text, proposedText),
    rationale: summarizePatchIntent(patches),
    patchResolutionPlan: patches.map((patch) => patch.id),
    globalFeedback: ["Notes preview ready. Accept to apply text changes and refresh highlights."],
    warnings: [],
    providerMode: "mock"
  };
}

function applyPatchNotesToText(text: string, patches: Patch[]) {
  let next = text;
  const ordered = [...patches]
    .filter((patch) => patch.anchorEnd >= patch.anchorStart && patch.anchorStart >= 0 && patch.anchorEnd <= text.length)
    .sort((a, b) => b.anchorStart - a.anchorStart);

  for (const patch of ordered) {
    const original = next.slice(patch.anchorStart, patch.anchorEnd);
    const replacement = reviseSegment(original, patch.text);
    next = `${next.slice(0, patch.anchorStart)}${replacement}${next.slice(patch.anchorEnd)}`;
  }
  return next;
}

function reviseSegment(original: string, note: string) {
  const trimmed = original.trim();
  const leading = original.match(/^\s*/)?.[0] ?? "";
  const trailing = original.match(/\s*$/)?.[0] ?? "";
  const lower = note.toLowerCase();
  let revised = trimmed;

  if (/\u66f4\u957f|\u53d1\u5c55|\u8be6\u7ec6|longer|expand|more detail/i.test(note)) {
    return `${leading}${stripMeta(expandSegment(trimmed))}${trailing}`;
  }
  if (/\u6807\u9898|title/i.test(note)) {
    return `${leading}${stripMeta(expandSegment(trimmed))}${trailing}`;
  }
  if (/\u95ee\u9898.*\u5446\u677f|\u81ea\u7136|natural/i.test(note)) {
    return `${leading}${stripMeta(naturalQuestion(trimmed))}${trailing}`;
  }
  if (/\u592a\u7b3c\u7edf|too general|specific/i.test(note)) {
    return `${leading}${stripMeta(makeSpecific(trimmed))}${trailing}`;
  }
  if (/\u6539\u6210\u82f1\u6587|\u50cf\u4e2d\u6587|clean english/i.test(note)) {
    return `${leading}${stripMeta(cleanEnglish(trimmed))}${trailing}`;
  }
  if (/\u66f4\u77ed|\u7b80\u77ed|\u7cbe\u7b80|shorter|concise/i.test(note)) {
    return `${leading}${stripMeta(shortenSegment(trimmed))}${trailing}`;
  }

  if (/analysis|分析/i.test(note)) {
    revised = stripMeta(trimmed);
    if (!/[.!?]$/.test(revised)) revised += ".";
    revised += " This matters because it explains how the point supports the essay's main claim.";
  } else if (/academic|formal|学术|正式/i.test(note)) {
    revised = makeAcademic(trimmed);
  } else if (/source|citation|evidence|来源|引用|证据/i.test(note)) {
    revised = trimmed.includes("[citation needed]") || trimmed.includes("[source needed]")
      ? trimmed
      : `${trimmed.replace(/[.!?]?$/, "")} [citation needed].`;
  } else if (/clear|specific|简洁|清楚|具体/i.test(note)) {
    revised = makeAcademic(trimmed);
  } else if (lower.includes("not evidence")) {
    revised = `${trimmed.replace(/[.!?]?$/, "")}. This sentence should be treated as analysis because it explains the meaning of the point rather than presenting source-based proof.`;
  } else {
    revised = makeAcademic(trimmed);
  }

  return `${leading}${stripMeta(revised)}${trailing}`;
}

function makeAcademic(value: string) {
  return value
    .replace(/\bthings\b/gi, "factors")
    .replace(/\bbad\b/gi, "harmful")
    .replace(/\bgood\b/gi, "beneficial")
    .replace(/\bkids\b/gi, "young people")
    .replace(/\bget\b/gi, "become")
    .replace(/\s+/g, " ")
    .trim();
}

function expandSegment(value: string) {
  const cleaned = makeAcademic(value);
  if (!cleaned) return value;
  if (/^Topic\s*:/i.test(cleaned)) {
    const topic = cleaned.replace(/^Topic\s*:\s*/i, "").replace(/[.!?]?$/, "");
    return `Topic: ${topic}, including its causes, consequences, and practical responses for students and communities.`;
  }
  if (/^(Research question|Question)\s*:/i.test(cleaned)) {
    const question = cleaned.replace(/^(Research question|Question)\s*:\s*/i, "").replace(/[?？.]?$/, "");
    return `Research question: ${question}, and what shared responsibilities should individuals, institutions, and communities consider?`;
  }
  if (/because|therefore|this matters|supports/i.test(cleaned)) return cleaned;
  return `${cleaned.replace(/[.!?]?$/, "")}, which should be developed by explaining the cause, effect, and connection to the essay's main claim.`;
}

function shortenSegment(value: string) {
  const cleaned = makeAcademic(value);
  const firstClause = cleaned.split(/[,;]|\band\b|\bbecause\b/i)[0]?.trim() || cleaned;
  return firstClause.replace(/[.!?]?$/, ".");
}

function naturalQuestion(value: string) {
  const cleaned = makeAcademic(value);
  if (/^(Research question|Question)\s*:/i.test(cleaned)) {
    const question = cleaned.replace(/^(Research question|Question)\s*:\s*/i, "").replace(/[?？.]?$/, "");
    return `Research question: How can ${question.charAt(0).toLowerCase()}${question.slice(1)} in a way that is realistic for students and schools?`;
  }
  return makeSpecific(cleaned);
}

function makeSpecific(value: string) {
  const cleaned = makeAcademic(value);
  if (/^Topic\s*:/i.test(cleaned) || /^(Research question|Question)\s*:/i.test(cleaned)) return expandSegment(cleaned);
  return `${cleaned.replace(/[.!?]?$/, "")}, especially by naming who is affected, what changes are needed, and why the point matters.`;
}

function cleanEnglish(value: string) {
  return makeAcademic(value)
    .replace(/\bComputer become\b/gi, "Computers are becoming")
    .replace(/\btechnology become\b/gi, "technology is becoming")
    .replace(/\bmore close to\b/gi, "closer to")
    .replace(/\s+/g, " ")
    .trim();
}

function stripMeta(value: string) {
  return value
    .replace(/^A more academic version could state:\s*/i, "")
    .replace(/^Here is a revised version:\s*/i, "")
    .replace(/^I would rewrite it as:\s*/i, "")
    .replace(/\s*\[citation needed if this includes factual evidence\]\.?/gi, "")
    .replace(/\s*if this includes factual evidence\.?/gi, "")
    .trim();
}

function summarizePatchIntent(patches: Patch[]) {
  const first = patches[0]?.text.trim();
  if (!first) return "EssayCraft used the open note to prepare a focused revision.";
  return patches.length === 1
    ? `Used note: ${first.slice(0, 120)}`
    : `Used ${patches.length} open notes to prepare focused revisions.`;
}

function summarizeChanges(before: string, after: string) {
  if (before === after) return "No text change was needed; highlights can be refreshed.";
  return "Open notes were converted into a proposed text revision. Review before accepting.";
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
