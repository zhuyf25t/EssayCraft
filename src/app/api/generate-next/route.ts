import { NextResponse } from "next/server";
import type { Annotation, GenerateNextResponse, ModuleNumber, SourceCard } from "@/types/essaycraft";
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
      return NextResponse.json(mockGenerate(input.topic, input.sourceModuleNumber, input.sourceText, input.sourceSources, input.sourceAnnotations));
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
      const fallback = mockGenerate(input.topic, input.sourceModuleNumber, input.sourceText, input.sourceSources, input.sourceAnnotations);
      fallback.providerMode = "fallback";
      fallback.warnings.push(`DeepSeek generation unavailable; used mock output. ${aiError instanceof Error ? aiError.message : ""}`.trim());
      return NextResponse.json(fallback);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function mockGenerate(topic: string, sourceModuleNumber: Exclude<ModuleNumber, 6>, sourceText: string, sourceSources: SourceCard[] = [], sourceAnnotations: Annotation[] = []): GenerateNextResponse {
  const transition = getTransitionPrompt(sourceModuleNumber);
  const moduleNumber = transition.toModule;
  const text = cleanGeneratedText(mockText(topic, sourceModuleNumber, sourceText, sourceSources, sourceAnnotations), moduleNumber);
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

function mockText(topic: string, sourceModuleNumber: ModuleNumber, sourceText: string, sourceSources: SourceCard[], sourceAnnotations: Annotation[] = []) {
  const subject = deriveSubject(topic, sourceText);
  const preview = sourceText.trim() || subject;

  if (sourceModuleNumber === 1) {
    return buildResearchPlan(subject, sourceText);
  }

  if (sourceModuleNumber === 2) {
    return buildOutlineFromResearchPlan(subject, sourceText, sourceSources);
  }

  if (sourceModuleNumber === 3) {
    return `${subject} is an important academic issue because it affects how students, institutions, and communities make practical decisions. The outline suggests that the essay should move from context to a clear thesis, then support that thesis with evidence and analysis. This draft argues that ${subject.toLowerCase()} should be addressed through focused habits, responsible institutional choices, and careful evaluation of evidence.

First, the strongest body paragraph should explain the main reason named in the outline. The student should introduce a focused topic sentence, connect it to a real source or mark the claim [citation needed], and then analyze why the evidence supports the thesis. This matters because evidence should not stand alone; it needs interpretation that makes the argument clear.

Second, the draft should develop a separate reason rather than repeating the first one. If the outline includes a policy, classroom, platform, or personal strategy, this paragraph should explain how that strategy works and what limitation it addresses [citation needed]. The analysis should show cause and effect, not just summarize the idea.

Some readers may object that the proposed approach is too difficult, too limited, or less effective than a stricter alternative. That counterargument should be represented fairly before the essay responds. A balanced rebuttal can concede a valid concern while explaining why the thesis remains more practical or better supported.

In conclusion, the essay should return to ${subject.toLowerCase()} and explain why the argument matters beyond a single assignment. The final paragraph should synthesize the main reasons, avoid introducing major new evidence, and leave the reader with a clear sense of significance.`;
  }

  if (sourceModuleNumber === 4) {
    const audit = buildCitationAudit(sourceText, sourceAnnotations, sourceSources);
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

type ResearchBranch = {
  index: number;
  claim: string;
  evidence?: string;
  sourceType?: string;
  keywords?: string;
  status?: string;
};

function buildResearchPlan(subject: string, sourceText: string) {
  const thesis = extractField(sourceText, "Working thesis") ??
    extractField(sourceText, "Thesis") ??
    `The essay will argue a focused position about ${trimPeriod(subject).toLowerCase()} using three specific, evidence-backed reasons.`;
  const thesisMap = parseThesisMap(sourceText);
  const branches = thesisMap.length ? thesisMap : [
    `Define the most important development or problem within ${trimPeriod(subject).toLowerCase()}`,
    `Explain why ${trimPeriod(subject).toLowerCase()} matters for real people, institutions, or communities`,
    `Evaluate a practical response, design choice, policy, or ethical responsibility`
  ];

  return `Research plan for: ${subject}

Working thesis: ${thesis}

${branches.map((branch, index) => `Argument branch ${index + 1}: ${capitalizeSentence(branch)}
Evidence needed: Add a credible source that directly supports this branch [citation needed].
Possible source type: scholarly article / government report / professional report
Search keywords: ${keywordLine(subject, branch)}
Source status: source needed`).join("\n\n")}

Counterargument to investigate: Identify a reasonable opposing view and what evidence would make it persuasive.

Source notes:
- Add source cards in the Source Workbench. Do not invent citations.
- Use the CARS check: credible, accurate, reasonable, and supportive of the exact claim.`;
}

function buildOutlineFromResearchPlan(subject: string, sourceText: string, sourceSources: SourceCard[]) {
  const parsed = parseResearchPlan(sourceText);
  const branches = ensureAtLeastTwoBranches(parsed.branches, subject).slice(0, 4);
  const thesis = parsed.thesis ??
    `The essay will argue that ${trimPeriod(subject).toLowerCase()} should be understood through ${branches.slice(0, 3).map((branch) => trimPeriod(branch.claim).toLowerCase()).join(", ")}.`;
  const realSources = sourceSources.filter((source) => !source.placeholder);

  return `Introduction plan
- Hook / importance: ${capitalizeSentence(trimPeriod(subject))} matters because it shapes how people make choices, solve problems, and judge future responsibilities.
- Background: The essay should define the topic, name the debate, and show why the issue is worth investigating now.
- Thesis: ${thesis}
- Thesis map: ${branches.slice(0, 3).map((branch) => trimPeriod(branch.claim)).join("; ")}.

${branches.map((branch, index) => `Body paragraph ${index + 1}
- Topic sentence: ${branchTopicSentence(branch.claim, index + 1)}
- Evidence to use: ${evidenceSlot(branch, realSources[index])}
- Analysis: Explain how this evidence supports the thesis by showing why ${trimPeriod(branch.claim).toLowerCase()} is significant, not just by summarizing the source.
- Link back: Connect this paragraph back to the claim that ${trimPeriod(subject).toLowerCase()} requires a focused academic argument.`).join("\n\n")}

Counterargument paragraph
- Opposing view: ${parsed.counterargument ?? `Some readers may argue that another explanation or response matters more than ${trimPeriod(branches[0]?.claim ?? subject).toLowerCase()}.`}
- Response: Acknowledge the strongest part of that view, then explain why the thesis remains more persuasive when the evidence is weighed carefully.

Conclusion plan
- Rephrased thesis: Return to the central claim without copying the introduction word-for-word.
- Summary of main arguments: Synthesize ${branches.slice(0, 3).map((branch) => trimPeriod(branch.claim).toLowerCase()).join(", ")}.
- So what / implication: Explain what the reader should understand or do differently after considering the argument.`;
}

function parseResearchPlan(text: string) {
  const branches: ResearchBranch[] = [];
  let current: ResearchBranch | undefined;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const branchMatch = line.match(/^Argument branch\s*(\d+)?\s*:\s*(.+)$/i) ??
      line.match(/^Claim to investigate\s*(\d+)?\s*:\s*(.+)$/i);
    if (branchMatch) {
      current = {
        index: Number(branchMatch[1]) || branches.length + 1,
        claim: cleanupOutlineText(branchMatch[2])
      };
      branches.push(current);
      continue;
    }

    if (current) {
      const evidence = line.match(/^Evidence needed\s*:\s*(.+)$/i) ?? line.match(/^Evidence to find\s*:\s*(.+)$/i);
      if (evidence) {
        current.evidence = cleanupOutlineText(evidence[1]);
        continue;
      }

      const sourceType = line.match(/^(?:Possible|Suggested) source type\s*:\s*(.+)$/i);
      if (sourceType) {
        current.sourceType = cleanupOutlineText(sourceType[1]);
        continue;
      }

      const keywords = line.match(/^Search keywords\s*:\s*(.+)$/i);
      if (keywords) {
        current.keywords = cleanupOutlineText(keywords[1]);
        continue;
      }

      const status = line.match(/^Source status\s*:\s*(.+)$/i);
      if (status) {
        current.status = cleanupOutlineText(status[1]);
      }
    }
  }

  return {
    thesis: extractField(text, "Working thesis") ?? extractField(text, "Thesis"),
    counterargument: extractField(text, "Counterargument to investigate") ?? extractField(text, "Counterargument"),
    branches
  };
}

function ensureAtLeastTwoBranches(branches: ResearchBranch[], subject: string) {
  const result = branches.filter((branch) => branch.claim.trim());
  if (result.length >= 2) return result;
  return [
    ...result,
    {
      index: result.length + 1,
      claim: `A second argument branch should explain a distinct consequence of ${trimPeriod(subject).toLowerCase()}`,
      evidence: "Add a source that supports this separate reason [citation needed]",
      status: "source needed"
    }
  ];
}

function evidenceSlot(branch: ResearchBranch, source: SourceCard | undefined) {
  if (source) {
    const citation = sourceCitation(source);
    return `Use source card ${source.id}: ${source.title || "Untitled source"}${citation ? ` ${citation}` : ""}.`;
  }

  const evidence = branch.evidence ? trimPeriod(branch.evidence) : "Add a credible source for this claim";
  return `[source needed] ${evidence}.`;
}

function sourceCitation(source: SourceCard) {
  const author = source.authors?.[0]?.trim().split(/\s+/).pop();
  if (!author || !source.year) return "";
  return `(${author}, ${source.year})`;
}

function branchTopicSentence(claim: string, index: number) {
  const cleaned = trimPeriod(cleanupOutlineText(claim));
  if (/^(the|a|an|technology|education|schools|students|people|platforms|government|research|evidence)\b/i.test(cleaned)) {
    return capitalizeSentence(cleaned);
  }
  return `The essay's ${ordinal(index)} body paragraph should argue that ${lowerFirst(cleaned)}.`;
}

function parseThesisMap(text: string) {
  const lines = text.split("\n");
  const reasons: string[] = [];
  let capture = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (/^Thesis map\s*:/i.test(line)) {
      capture = true;
      const inline = line.replace(/^Thesis map\s*:\s*/i, "").trim();
      if (inline) reasons.push(cleanupOutlineText(inline));
      continue;
    }
    if (!capture) continue;
    if (!line) continue;
    if (/^[A-Z][A-Za-z ]+\s*:/.test(line) && !/^[-*]/.test(line)) break;
    const reason = line.match(/^[-*]\s*(?:Reason\s*\d+\s*:\s*)?(.+)$/i)?.[1];
    if (reason) reasons.push(cleanupOutlineText(reason));
  }
  return reasons;
}

function extractField(text: string, field: string) {
  return text.match(new RegExp(`^\\s*${field}\\s*:\\s*(.+)$`, "im"))?.[1]?.trim();
}

function keywordLine(subject: string, branch: string) {
  const branchWords = branch
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 4)
    .slice(0, 4)
    .join(", ");
  return [subject, branchWords, "academic evidence"].filter(Boolean).join("; ");
}

function cleanupOutlineText(value: string) {
  return value.replace(/\s*\[(?:citation|source) needed\]\s*/gi, "").replace(/\s+/g, " ").trim();
}

function capitalizeSentence(value: string) {
  const text = trimPeriod(value);
  if (!text) return "";
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

function trimPeriod(value: string) {
  return value.trim().replace(/[.?!]+$/g, "");
}

function lowerFirst(value: string) {
  if (!value) return value;
  return `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

function ordinal(value: number) {
  return value === 1 ? "first" : value === 2 ? "second" : value === 3 ? "third" : `${value}th`;
}

function sanitizeGeneratedSources(_generated: SourceCard[], userSources: SourceCard[]) {
  return userSources;
}

function deriveSubject(topic: string, sourceText: string) {
  const topicLine = sourceText.match(/^\s*(?:research plan for|research question|topic|question)\s*:\s*(.+)$/im)?.[1]?.trim();
  if (topicLine) return topicLine.slice(0, 160);

  const firstMeaningfulLine = sourceText
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .find((line) => line.length > 0);

  return (firstMeaningfulLine || topic || "this essay topic").slice(0, 160);
}
