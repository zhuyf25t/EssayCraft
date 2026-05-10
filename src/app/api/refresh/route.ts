import { NextResponse } from "next/server";
import type { Annotation, Patch, RefreshRequest, RefreshResponse, SourceCard } from "@/types/essaycraft";
import { createAiClient, AI_FAST_MODEL, hasAiKey, withAiTimeout } from "@/lib/ai-client";
import { buildMockAnnotations, findIssueRanges, guardAgainstCitationOverlabeling, normalizeAnnotations } from "@/lib/annotations";
import { normalizedForNoopCompare, protectModuleText, stripEditorKernelMarkers } from "@/lib/noteKernel";
import { buildRefreshMessages } from "@/lib/prompts";
import { validateProviderRefreshAnnotations } from "@/lib/refreshValidation";
import { applyNotesFallback } from "@/lib/rewriteFallback";
import { refreshRequestSchema, refreshResponseSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsedInput = refreshRequestSchema.parse(json);
    const input = { ...parsedInput, text: protectModuleText(parsedInput.text) };
    const openPatches = input.patches.filter((patch) => !patch.resolved && patch.status !== "resolved" && !patch.stale && patch.text.trim());

    if (!hasAiKey()) {
      return NextResponse.json(
        openPatches.length
          ? mockPatchRevision(input.text, openPatches, input.projectTitle || input.topic)
          : mockRefresh(input, "Highlights refreshed. Text was not rewritten.")
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
        const proposedText = stripEditorKernelMarkers(parsed.proposedText);
        if (normalizedForNoopCompare(proposedText) === normalizedForNoopCompare(input.text)) {
          throw new Error("Provider returned an unchanged note revision.");
        }
        return NextResponse.json({
          ...parsed,
          proposedText,
          providerMode: "deepseek",
          sourceText: input.text,
          proposedAnnotations: normalizeAnnotations(proposedText, parsed.proposedAnnotations ?? buildMockAnnotations(proposedText)),
          patchResolutionPlan: (parsed.patchResolutionPlan ?? []).filter((patchId) => openPatches.some((patch) => patch.id === patchId))
        });
      }
      if (openPatches.length) {
        return NextResponse.json(mockPatchRevision(input.text, openPatches, input.projectTitle || input.topic));
      }

      const validation = validateProviderRefreshAnnotations(input.text, parsed.annotations, input.moduleNumber);
      const providerWarnings = [...(parsed.warnings ?? []), ...validation.warnings];
      if (validation.usedFallback) {
        return NextResponse.json(addModuleReviewIfNeeded(input, {
          kind: "annotations",
          annotations: validation.annotations,
          globalFeedback: ["Highlights refreshed. Text was not rewritten.", moduleRefreshSuggestion(input, validation.annotations)].filter(Boolean),
          warnings: providerWarnings,
          providerMode: "fallback"
        }));
      }

      const normalized: RefreshResponse = addModuleReviewIfNeeded(input, {
        kind: "annotations",
        annotations: validation.annotations,
        globalFeedback: parsed.globalFeedback?.length ? parsed.globalFeedback : [moduleRefreshSuggestion(input, validation.annotations)],
        warnings: providerWarnings,
        providerMode: "deepseek"
      });

      return NextResponse.json(normalized);
    } catch {
      const fallback = openPatches.length
        ? mockPatchRevision(input.text, openPatches, input.projectTitle || input.topic)
        : mockRefresh(input, "Highlights refreshed. Text was not rewritten.");
      fallback.providerMode = "fallback";
      fallback.warnings.push("Refresh used a local fallback. Text was not rewritten.");
      return NextResponse.json(fallback);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function mockRefresh(input: RefreshRequest, message: string): RefreshResponse {
  const patchAnnotations = annotationsFromPatches(input.text, input.patches);
  const annotations = guardAgainstCitationOverlabeling(input.text, [...patchAnnotations, ...buildMockAnnotations(input.text), ...findIssueRanges(input.text)]);

  return addModuleReviewIfNeeded(input, {
    kind: "annotations",
    annotations,
    globalFeedback: [message, moduleRefreshSuggestion(input, annotations)].filter(Boolean),
    warnings: [],
    providerMode: "mock"
  });
}

function mockPatchRevision(text: string, patches: Patch[], projectTitle = ""): RefreshResponse {
  const proposedText = applyNotesFallback(text, patches, projectTitle);
  const annotations = guardAgainstCitationOverlabeling(proposedText, buildMockAnnotations(proposedText));
  return {
    kind: "revision",
    annotations: [],
    proposedText,
    sourceText: text,
    proposedAnnotations: annotations,
    originalSummary: summarizeChanges(text, proposedText),
    rationale: summarizePatchIntent(patches),
    patchResolutionPlan: patches.map((patch) => patch.id),
    globalFeedback: ["Notes preview ready. Accept to apply text changes and refresh highlights."],
    warnings: [],
    providerMode: "mock"
  };
}

// Kept temporarily for comparing old note-revision behavior while the P0 kernel stabilizes.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function applyPatchNotesToText(text: string, patches: Patch[]) {
  let next = text;
  const ordered = [...patches]
    .map((patch) => ({ patch, range: effectivePatchRange(text, patch) }))
    .filter(({ range }) => range.end >= range.start && range.start >= 0 && range.end <= text.length)
    .sort((a, b) => b.range.start - a.range.start || b.range.end - a.range.end);

  for (const { patch, range } of ordered) {
    const original = next.slice(range.start, range.end);
    const replacement = reviseSegment(original, patch.text);
    next = `${next.slice(0, range.start)}${replacement}${next.slice(range.end)}`;
  }
  return next;
}

function effectivePatchRange(text: string, patch: Patch) {
  const start = Math.max(0, Math.min(text.length, patch.anchorStart));
  const end = Math.max(start, Math.min(text.length, patch.anchorEnd));
  if (end > start) return { start, end };

  const lineStart = text.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const nextBreak = text.indexOf("\n", start);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  if (text.slice(lineStart, lineEnd).trim()) {
    return trimRange(text, lineStart, lineEnd);
  }

  const beforeStart = text.lastIndexOf("\n", Math.max(0, lineStart - 2)) + 1;
  const beforeEnd = Math.max(beforeStart, lineStart - 1);
  if (text.slice(beforeStart, beforeEnd).trim()) return trimRange(text, beforeStart, beforeEnd);

  const afterStart = nextBreak === -1 ? start : nextBreak + 1;
  const afterBreak = text.indexOf("\n", afterStart);
  const afterEnd = afterBreak === -1 ? text.length : afterBreak;
  return trimRange(text, afterStart, afterEnd);
}

function trimRange(text: string, start: number, end: number) {
  let nextStart = start;
  let nextEnd = end;
  while (nextStart < nextEnd && /\s/.test(text[nextStart] ?? "")) nextStart += 1;
  while (nextEnd > nextStart && /\s/.test(text[nextEnd - 1] ?? "")) nextEnd -= 1;
  return { start: nextStart, end: nextEnd };
}

function reviseSegment(original: string, note: string) {
  const trimmed = original.trim();
  const leading = original.match(/^\s*/)?.[0] ?? "";
  const trailing = original.match(/\s*$/)?.[0] ?? "";
  const lower = note.toLowerCase();
  let revised = trimmed;

  if (/\u6807\u9898|title/i.test(note)) {
    return `${leading}${stripMeta(reviseTopic(trimmed))}${trailing}`;
  }
  if (/\u95ee\u9898|question/i.test(note)) {
    return `${leading}${stripMeta(reviseQuestion(trimmed, note))}${trailing}`;
  }
  if (/\u8bba\u70b9|thesis/i.test(note)) {
    return `${leading}${stripMeta(reviseThesis(trimmed))}${trailing}`;
  }
  if (/\u66f4\u957f|\u5199\u957f|\u53d1\u5c55|\u8be6\u7ec6|longer|expand|more detail/i.test(note)) {
    return `${leading}${stripMeta(expandSegment(trimmed))}${trailing}`;
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
  if (/\u66f4\u81ea\u7136|\u81ea\u7136|\u5446\u677f|\u666e\u901a|\u65b0\u610f|natural|awkward|less generic/i.test(note)) {
    return `${leading}${stripMeta(makeNatural(trimmed))}${trailing}`;
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

  const cleaned = stripMeta(revised);
  const visible = cleaned === trimmed ? makeNatural(trimmed) : cleaned;
  return `${leading}${stripMeta(visible)}${trailing}`;
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

function reviseTopic(value: string) {
  const cleaned = makeAcademic(value);
  const topic = cleaned.replace(/^Topic\s*:\s*/i, "").replace(/[.!?]?$/, "").trim();
  if (/social media|youth|wellbeing/i.test(topic)) {
    return "Topic: Social media balance, youth wellbeing, and responsible platform design";
  }
  if (!topic) return "Topic: A clearer academic topic with causes, consequences, and practical responses";
  return `Topic: ${topic}, including its causes, consequences, and practical responses`;
}

function reviseQuestion(value: string, note: string) {
  const cleaned = makeAcademic(value);
  const question = cleaned.replace(/^(Research question|Question)\s*:\s*/i, "").replace(/[?？.]?$/, "").trim();
  if (/social media|healthier|balance|young|youth|platform|school/i.test(question) || /\u5446\u677f|\u65b0\u610f|\u81ea\u7136/.test(note)) {
    return "Research question: How can individuals, schools, and social media platforms share responsibility for building a healthier digital environment for young people?";
  }
  if (!question) return "Research question: What specific problem should this essay investigate, and why does it matter?";
  return `Research question: How can ${question.charAt(0).toLowerCase()}${question.slice(1)} in a way that names the people affected, the causes involved, and the practical response?`;
}

function reviseThesis(value: string) {
  const cleaned = makeAcademic(value);
  const thesis = cleaned.replace(/^(Working thesis|Thesis)\s*:\s*/i, "").replace(/[.!?]?$/, "").trim();
  if (!thesis) return "Working thesis: The essay should make a specific, arguable claim supported by clear reasons.";
  return `Working thesis: ${thesis}, because the issue requires a clear argument, specific evidence, and practical responsibility.`;
}

function makeNatural(value: string) {
  const cleaned = makeAcademic(value);
  if (/^Topic\s*:/i.test(cleaned)) return reviseTopic(cleaned);
  if (/^(Research question|Question)\s*:/i.test(cleaned)) return reviseQuestion(cleaned, "\u66f4\u81ea\u7136 \u65b0\u610f");
  if (/^(Working thesis|Thesis)\s*:/i.test(cleaned)) return reviseThesis(cleaned);
  if (!cleaned) return value;
  if (cleaned.length < 80) {
    return `${cleaned.replace(/[.!?]?$/, "")}, with clearer wording that names the issue, the people affected, and why the point matters.`;
  }
  return cleaned.replace(/\bimportant\b/gi, "significant").replace(/\bvery\b/gi, "particularly");
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

function addModuleReviewIfNeeded(input: RefreshRequest, response: RefreshResponse): RefreshResponse {
  if (input.moduleNumber === 6) {
    return {
      ...response,
      kind: "moduleReview",
      ...buildFinalReview(input, response.annotations),
      globalFeedback: ["Final review ready.", ...response.globalFeedback.filter((message) => message !== "Final review ready.")]
    };
  }
  if (input.moduleNumber === 5) {
    return {
      ...response,
      kind: "moduleReview",
      ...buildCitationReview(input, response.annotations),
      globalFeedback: ["Citation review ready.", ...response.globalFeedback.filter((message) => message !== "Citation review ready.")]
    };
  }
  return {
    ...response,
    issueCount: response.annotations.filter((annotation) => annotation.label === "issue").length
  };
}

function moduleRefreshSuggestion(input: RefreshRequest, annotations: Annotation[]) {
  const issues = annotations.filter((annotation) => annotation.label === "issue").length;
  if (input.moduleNumber === 1) return "Check that the topic, research question, thesis, and thesis map still match each other.";
  if (input.moduleNumber === 2) return "Make each source need searchable by naming the evidence type, keyword, or source category.";
  if (input.moduleNumber === 3) return "Check that every body paragraph plan includes claim, evidence, analysis, and link back.";
  if (input.moduleNumber === 4) return issues
    ? `Draft highlights refreshed. Resolve ${issues} issue marker(s), especially citation-needed claims.`
    : "Draft highlights refreshed. Next, check transitions and evidence integration.";
  if (input.moduleNumber === 5) return "Citation review refreshed. Compare in-text citations with the source cards and reference list.";
  return "Final review refreshed. Use the checklist before export.";
}

function buildFinalReview(input: RefreshRequest, annotations: Annotation[]) {
  const text = input.text;
  const lower = text.toLowerCase();
  const paragraphCount = text.split(/\n\s*\n/).filter((paragraph) => paragraph.trim()).length;
  const citationGaps = countCitationGaps(text, annotations);
  const inTextCitations = countInTextCitations(text);
  const realSourceCards = countRealSourceCards(input.sources);
  const hasConclusion = /in conclusion|overall|to conclude|conclusion|why it matters|implication/i.test(text);
  const hasQuestion = /\?/.test(text) || /research question/i.test(text);
  const hasThesis = /thesis|argues|should|because/i.test(lower);
  const longSentences = (text.match(/[^.!?\n]{180,}[.!?]/g) ?? []).length;
  const issueCount = citationGaps + annotations.filter((annotation) => annotation.label === "issue").length;
  const citationDetail = citationGaps
    ? `${citationGaps} citation-needed marker(s) remain.`
    : inTextCitations && realSourceCards
      ? "In-text citation signals and source cards are present; compare each pair before submission."
      : "No obvious citation-needed marker was found, but source cards should still be checked manually.";

  return {
    reviewSummary: buildFinalSummary({ hasThesis, paragraphCount, citationGaps, longSentences, realSourceCards }),
    reviewChecklist: [
      {
        label: "Content",
        status: hasThesis ? "ready" as const : "review" as const,
        detail: hasThesis
          ? "The essay appears to have a central argument; confirm every paragraph answers the prompt."
          : "Add or clarify the main argument so the final review has a clear target."
      },
      {
        label: "Structure",
        status: paragraphCount >= 4 ? "ready" as const : "review" as const,
        detail: paragraphCount >= 4
          ? `The draft has ${paragraphCount} visible paragraph block(s); check transitions between major points.`
          : "The essay may need clearer introduction, body, and conclusion separation."
      },
      {
        label: "Clarity",
        status: longSentences ? "review" as const : "ready" as const,
        detail: longSentences
          ? `${longSentences} long sentence(s) may need splitting for readability.`
          : "Sentence length looks manageable in the local review."
      },
      {
        label: "Style",
        status: /\bi think\b|\bkids\b|\bthings\b|\bbad\b/gi.test(text) ? "review" as const : "ready" as const,
        detail: "Keep the tone academic by using precise nouns, cautious claims, and formal transitions."
      },
      {
        label: "Proofreading",
        status: / {2,}|[ \t]+\n|[.!?]{2,}/.test(text) ? "review" as const : "ready" as const,
        detail: "Check grammar, spelling, punctuation, capitalization, and formatting before final export."
      },
      {
        label: "Citations / References",
        status: citationGaps || !realSourceCards ? "issue" as const : "review" as const,
        detail: citationDetail
      },
      {
        label: "Conclusion",
        status: hasConclusion ? "ready" as const : "review" as const,
        detail: hasConclusion
          ? "The ending appears to return to the argument; make sure it synthesizes rather than repeats."
          : "Strengthen the conclusion by returning to the thesis, synthesizing main points, and explaining why the argument matters."
      }
    ],
    reviewSuggestions: finalSuggestions({ hasQuestion, hasThesis, citationGaps, longSentences, realSourceCards, hasConclusion }),
    issueCount,
    citationGaps,
    inTextCitations,
    realSourceCards,
    referenceStatus: realSourceCards
      ? "Reference preview can use the student-supplied source cards only."
      : "No real source cards are available yet; EssayCraft will not invent references.",
    nextStep: citationGaps
      ? "Resolve citation-needed markers and source-card gaps before final submission."
      : "Read the essay once aloud, then export from Module 6 when the checklist looks ready."
  };
}

function buildCitationReview(input: RefreshRequest, annotations: Annotation[]) {
  const citationGaps = countCitationGaps(input.text, annotations);
  const inTextCitations = countInTextCitations(input.text);
  const realSourceCards = countRealSourceCards(input.sources);
  const issueCount = citationGaps + input.sources.filter((source) => source.placeholder).length;
  return {
    reviewSummary: citationGaps
      ? "Citation check found claims that still need source support."
      : "Citation check refreshed. Continue matching every in-text citation to a student-supplied source card.",
    reviewChecklist: [
      {
        label: "Citation gaps",
        status: citationGaps ? "issue" as const : "ready" as const,
        detail: citationGaps ? `${citationGaps} citation gap(s) remain.` : "No citation-needed markers were found locally."
      },
      {
        label: "In-text citations",
        status: inTextCitations ? "review" as const : "issue" as const,
        detail: inTextCitations ? `${inTextCitations} in-text citation pattern(s) found.` : "No in-text citation patterns were found."
      },
      {
        label: "Source cards",
        status: realSourceCards ? "review" as const : "issue" as const,
        detail: realSourceCards ? `${realSourceCards} real source card(s) are available.` : "Add real student-supplied source cards before building a reference list."
      },
      {
        label: "Reference list",
        status: realSourceCards ? "review" as const : "issue" as const,
        detail: realSourceCards ? "Reference preview uses only source cards you entered." : "EssayCraft will not invent reference entries."
      }
    ],
    reviewSuggestions: [
      "Check that each in-text citation has a matching source card.",
      "Replace placeholders with real author, year, title, and container details.",
      "Keep [citation needed] until real evidence is supplied."
    ],
    issueCount,
    citationGaps,
    inTextCitations,
    realSourceCards,
    referenceStatus: realSourceCards ? "Manual source cards available." : "No real source cards yet.",
    nextStep: "Open Sources and verify cards before final export."
  };
}

function buildFinalSummary({
  hasThesis,
  paragraphCount,
  citationGaps,
  longSentences,
  realSourceCards
}: {
  hasThesis: boolean;
  paragraphCount: number;
  citationGaps: number;
  longSentences: number;
  realSourceCards: number;
}) {
  const parts = [
    hasThesis ? "The essay has a visible argumentative direction" : "The essay still needs a clearer central claim",
    paragraphCount >= 4 ? "the paragraph structure is visible" : "the structure may need clearer paragraph separation",
    citationGaps ? `${citationGaps} evidence claim(s) still need citation checks` : "no citation-needed marker was found locally",
    longSentences ? "some long sentences may need proofreading" : "sentence length is mostly manageable",
    realSourceCards ? "student-supplied source cards are available" : "no real source cards are available yet"
  ];
  return `${parts.join("; ")}.`;
}

function finalSuggestions({
  hasQuestion,
  hasThesis,
  citationGaps,
  longSentences,
  realSourceCards,
  hasConclusion
}: {
  hasQuestion: boolean;
  hasThesis: boolean;
  citationGaps: number;
  longSentences: number;
  realSourceCards: number;
  hasConclusion: boolean;
}) {
  const suggestions: string[] = [];
  if (!hasQuestion) suggestions.push("Make the final version clearly answer the research question from Module 1.");
  if (!hasThesis) suggestions.push("Restate the working thesis in a more precise final form.");
  suggestions.push("Check paragraph order: each body paragraph should move from claim to evidence to analysis.");
  if (longSentences) suggestions.push("Split the longest sentences so the meaning is easier to follow.");
  if (citationGaps || !realSourceCards) suggestions.push("Resolve citation-needed claims with real source cards; do not invent references.");
  if (!hasConclusion) suggestions.push("Add a conclusion that synthesizes the argument and explains why it matters.");
  if (suggestions.length < 3) suggestions.push("Proofread punctuation, formatting, and repeated phrases before export.");
  return suggestions.slice(0, 5);
}

function countCitationGaps(text: string, annotations: Annotation[]) {
  const markers = (text.match(/\[citation needed\]/gi) ?? []).length;
  const issueAnnotations = annotations.filter((annotation) => annotation.label === "issue").length;
  return Math.max(markers, issueAnnotations);
}

function countInTextCitations(text: string) {
  return (text.match(/\([A-Z][A-Za-z .&-]+,\s*\d{4}[a-z]?\)/g) ?? []).length;
}

function countRealSourceCards(sources: SourceCard[]) {
  return sources.filter((source) => !source.placeholder && Boolean(source.title?.trim()) && Boolean(source.authors?.length) && Boolean(source.year?.trim())).length;
}
