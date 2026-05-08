import { NextResponse } from "next/server";
import type { GenerateNextResponse, ModuleNumber, SourceCard } from "@/types/essaycraft";
import { createAiClient, AI_MODEL, hasAiKey, withAiTimeout } from "@/lib/ai-client";
import { buildMockAnnotations, exactAnnotations, findIssueRanges, normalizeAnnotations } from "@/lib/annotations";
import { buildCitationAudit } from "@/lib/citationAudit";
import { getTransitionPrompt } from "@/lib/moduleTransitionPrompts";
import { buildGenerateNextMessages } from "@/lib/prompts";
import { generateNextRequestSchema, generateNextResponseSchema } from "@/lib/schemas";
import { cleanGeneratedText } from "@/lib/textFormat";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const input = generateNextRequestSchema.parse(json);
    const expectedTarget = (input.sourceModuleNumber + 1) as Exclude<ModuleNumber, 1>;

    if (!input.sourceText.trim()) {
      return NextResponse.json(
        { error: `Add content to Module ${input.sourceModuleNumber} before generating Module ${expectedTarget}.` },
        { status: 400 }
      );
    }

    if (!hasAiKey()) {
      return NextResponse.json(mockGenerate(input.topic, input.sourceModuleNumber, input.sourceText, input.sourceSources));
    }

    try {
      const client = createAiClient();
      const completion = await withAiTimeout(client.chat.completions.create({
        model: AI_MODEL,
        messages: buildGenerateNextMessages(input),
        response_format: { type: "json_object" },
        max_tokens: 7000,
        temperature: 0.25
      }));

      const raw = completion.choices[0]?.message?.content;
      if (!raw) throw new Error("AI returned empty content.");

      const parsed = generateNextResponseSchema.parse(JSON.parse(raw));
      if (parsed.moduleNumber !== expectedTarget) {
        throw new Error(`AI returned Module ${parsed.moduleNumber}, expected Module ${expectedTarget}.`);
      }

      const text = cleanGeneratedText(parsed.text, parsed.moduleNumber);
      if (!text.trim()) {
        throw new Error("AI returned empty generated text after cleanup.");
      }
      const exact = exactAnnotations(text, parsed.annotations);
      const normalized: GenerateNextResponse = {
        ...parsed,
        text,
        annotations: exact.annotations,
        sources: sanitizeGeneratedSources(parsed.sources, input.sourceSources),
        globalFeedback: parsed.globalFeedback ?? [],
        warnings: [...(parsed.warnings ?? []), ...exact.warnings],
        providerMode: "deepseek"
      };

      return NextResponse.json(normalized);
    } catch (aiError) {
      const fallback = mockGenerate(input.topic, input.sourceModuleNumber, input.sourceText, input.sourceSources);
      fallback.providerMode = "fallback";
      fallback.warnings.push(`DeepSeek generation unavailable; used mock output. ${aiError instanceof Error ? aiError.message : ""}`.trim());
      return NextResponse.json(fallback);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function mockGenerate(topic: string, sourceModuleNumber: Exclude<ModuleNumber, 6>, sourceText: string, sourceSources: SourceCard[] = []): GenerateNextResponse {
  const transition = getTransitionPrompt(sourceModuleNumber);
  const moduleNumber = transition.toModule;
  const text = cleanGeneratedText(mockText(topic, sourceModuleNumber, sourceText, sourceSources), moduleNumber);
  const annotations = normalizeAnnotations(text, [...buildMockAnnotations(text), ...findIssueRanges(text)]);

  return {
    moduleNumber,
    title: transition.name,
    text,
    annotations,
    sources: sourceSources,
    globalFeedback: [`Mock generated Module ${moduleNumber} from Module ${sourceModuleNumber}.`],
    warnings: ["Mock mode did not verify any source metadata. Keep [citation needed] markers until real sources are added."],
    providerMode: "mock"
  };
}

function mockText(topic: string, sourceModuleNumber: ModuleNumber, sourceText: string, sourceSources: SourceCard[]) {
  const subject = deriveSubject(topic, sourceText);
  const preview = sourceText.trim() || subject;

  if (sourceModuleNumber === 1) {
    return `Refined question: ${subject}

Working thesis: A focused essay should defend a clear position while naming the main reasons that will support it.

Argument branch 1: Clarify the most important cause or problem.
Evidence needed: Add one scholarly or professional source that explains the problem [citation needed].
Suggested source type: scholarly article, government report, or professional research brief.
Search keywords: ${subject}; academic evidence; youth; policy.

Argument branch 2: Explain why the issue matters to real people or institutions.
Evidence needed: Add a credible example or data point [citation needed].

Argument branch 3: Identify a practical solution or response.
Evidence needed: Add a source that evaluates the response [citation needed].

CARS reminder: sources should be Credible, Accurate, Reasonable, and Supportive of the exact claim being made.`;
  }

  if (sourceModuleNumber === 2) {
    return `Introduction plan
- Hook / importance: Introduce why ${subject} matters now.
- Background: Define the issue and establish scope.
- Thesis: State the essay's arguable position.
- Thesis map: Preview the main reasons in order.

Body paragraph 1
- Topic sentence: Present the first reason.
- Evidence: Use a real source or mark [citation needed].
- Analysis: Explain how the evidence supports the thesis.
- Link back: Connect the paragraph to the overall argument.

Body paragraph 2
- Topic sentence: Present the second reason.
- Evidence: Add a credible source [citation needed].
- Analysis: Explain the significance rather than only summarizing.

Counterargument and rebuttal
- Opposing view: Name a reasonable alternative position.
- Rebuttal: Show why the thesis remains stronger or more practical.

Conclusion plan
- Rephrase the thesis.
- Synthesize the main reasons.
- Answer the so-what question.`;
  }

  if (sourceModuleNumber === 3) {
    return `${subject} is an important academic issue because it affects how students, institutions, and communities make practical decisions. The outline suggests that the essay should move from context to a clear thesis, then support that thesis with evidence and analysis. This draft argues that ${subject.toLowerCase()} should be addressed through focused habits, responsible institutional choices, and careful evaluation of evidence.

First, the strongest body paragraph should explain the main reason named in the outline. The student should introduce a focused topic sentence, connect it to a real source or mark the claim [citation needed], and then analyze why the evidence supports the thesis. This matters because evidence should not stand alone; it needs interpretation that makes the argument clear.

Second, the draft should develop a separate reason rather than repeating the first one. If the outline includes a policy, classroom, platform, or personal strategy, this paragraph should explain how that strategy works and what limitation it addresses [citation needed]. The analysis should show cause and effect, not just summarize the idea.

Some readers may object that the proposed approach is too difficult, too limited, or less effective than a stricter alternative. That counterargument should be represented fairly before the essay responds. A balanced rebuttal can concede a valid concern while explaining why the thesis remains more practical or better supported.

In conclusion, the essay should return to ${subject.toLowerCase()} and explain why the argument matters beyond a single assignment. The final paragraph should synthesize the main reasons, avoid introducing major new evidence, and leave the reader with a clear sense of significance.`;
  }

  if (sourceModuleNumber === 4) {
    const audit = buildCitationAudit(sourceText, [], sourceSources);
    return `Citation-checked draft

${sourceText.trim() || preview}

Citation integrity checklist
- In-text citations found: ${audit.inTextCitations.length ? audit.inTextCitations.join("; ") : "none yet"}.
- Citation-needed markers: ${audit.citationNeededMarkers.length}.
- Evidence-like claims without citation: ${audit.evidenceWithoutCitation.length}.
- Source cards supplied: ${sourceSources.length}.
- Incomplete source cards: ${audit.incompleteSources.length}.
- Reference list entries: Use only user-supplied source card metadata; EssayCraft has not verified external sources.
- Paraphrase check: Confirm that source ideas are written in the student's own sentence structure.

Unresolved issue: Do not create author names, dates, article titles, journals, URLs, or DOIs unless they come from a real source card.`;
  }

  return `Final draft

${preview}

Editing checklist
- Content: The thesis is clear, arguable, and supported by each body paragraph.
- Structure: Each paragraph has a clear role, transition, evidence, analysis, and link back.
- Clarity: Sentences use precise academic language and avoid vague claims.
- Style: Tone remains formal, balanced, and appropriate for an academic essay.

Proofreading checklist
- Grammar and punctuation have been checked.
- Formatting is consistent.
- In-text citations and reference-list entries match.
- Unresolved [citation needed] markers must be fixed before submission.

Conclusion check
- The conclusion rephrases the thesis rather than copying it.
- The final paragraph synthesizes the main points.
- The ending answers why the argument matters.
- No major new evidence is introduced in the conclusion.`;
}

function sanitizeGeneratedSources(generated: SourceCard[], userSources: SourceCard[]) {
  if (!generated.length) return userSources;
  const generatedIds = new Set(generated.map((source) => source.id));
  const preservedUserSources = userSources.filter((source) => generatedIds.has(source.id));
  return preservedUserSources.length ? preservedUserSources : userSources;
}

function deriveSubject(topic: string, sourceText: string) {
  const topicLine = sourceText.match(/^\s*(?:topic|question|research question)\s*:\s*(.+)$/im)?.[1]?.trim();
  if (topicLine) return topicLine.slice(0, 160);

  const firstMeaningfulLine = sourceText
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .find((line) => line.length > 0);

  return (firstMeaningfulLine || topic || "this essay topic").slice(0, 160);
}
