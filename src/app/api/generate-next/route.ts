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

    if (!hasAiKey()) {
      return NextResponse.json(mockGenerate(input.topic, input.sourceModuleNumber, input.sourceText));
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
      const exact = exactAnnotations(text, parsed.annotations);
      const normalized: GenerateNextResponse = {
        ...parsed,
        text,
        annotations: exact.annotations,
        sources: sanitizeGeneratedSources(parsed.sources, input.sourceSources),
        globalFeedback: parsed.globalFeedback ?? [],
        warnings: [...(parsed.warnings ?? []), ...exact.warnings]
      };

      return NextResponse.json(normalized);
    } catch (aiError) {
      const fallback = mockGenerate(input.topic, input.sourceModuleNumber, input.sourceText, input.sourceSources);
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
    warnings: ["Mock mode did not verify any source metadata. Keep [citation needed] markers until real sources are added."]
  };
}

function mockText(topic: string, sourceModuleNumber: ModuleNumber, sourceText: string, sourceSources: SourceCard[]) {
  const preview = sourceText.trim().slice(0, 420) || topic;

  if (sourceModuleNumber === 1) {
    return `Refined question: ${topic}

Working thesis: A focused essay should defend a clear position while naming the main reasons that will support it.

Argument branch 1: Clarify the most important cause or problem.
Evidence needed: Add one scholarly or professional source that explains the problem [citation needed].
Suggested source type: scholarly article, government report, or professional research brief.
Search keywords: ${topic}; academic evidence; youth; policy.

Argument branch 2: Explain why the issue matters to real people or institutions.
Evidence needed: Add a credible example or data point [citation needed].

Argument branch 3: Identify a practical solution or response.
Evidence needed: Add a source that evaluates the response [citation needed].

CARS reminder: sources should be Credible, Accurate, Reasonable, and Supportive of the exact claim being made.`;
  }

  if (sourceModuleNumber === 2) {
    return `Introduction plan
- Hook / importance: Introduce why ${topic} matters now.
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
    return `Social media has become a defining feature of modern communication, shaping how people learn, maintain relationships, and participate in public life. The challenge is not simply that people use these platforms, but that their design can encourage constant comparison, distraction, and pressure. This essay argues that a healthier balance requires intentional user habits, more responsible platform design, and stronger digital literacy education.

First, individuals can reduce the most harmful patterns of social media use by making their habits more deliberate. Passive scrolling may make users feel informed or connected, but it can also replace focused study, rest, and face-to-face interaction [citation needed]. This matters because healthy use depends not only on how much time people spend online, but also on whether that time supports a meaningful purpose.

Second, platforms also share responsibility because design choices shape user behaviour. Notifications, recommendation feeds, and engagement metrics can reward content that keeps attention even when it increases stress or comparison [citation needed]. Therefore, individual self-control is important but incomplete; healthier platform design would make balanced use easier rather than forcing users to resist persuasive systems alone.

Some critics argue that the benefits of social media outweigh the risks because platforms can support learning, marginalized voices, and community during difficult moments. This counterargument is important because a total rejection of social media would ignore these real benefits. However, those benefits do not require unlimited use or attention-maximizing design.

In conclusion, balance is possible when individuals build mindful habits, platforms reduce harmful engagement pressures, and schools teach digital literacy. Together, these steps can preserve the advantages of social media while reducing the conditions that make it damaging.`;
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
  const userIds = new Set(userSources.map((source) => source.id));
  const preserved = generated.filter((source) => userIds.has(source.id));
  return preserved.length ? preserved : userSources;
}
