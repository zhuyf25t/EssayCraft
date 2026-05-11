import { NextResponse } from "next/server";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { Annotation, GenerateNextRequest, GenerateNextResponse, ModuleNumber, SourceCard } from "@/types/essaycraft";
import {
  addAiMetadata,
  aiMetadata,
  AI_MOCK_MODEL,
  createAiClient,
  deepSeekRequestBody,
  fallbackReasonFromError,
  forceMockEnabled,
  hasAiKey,
  withAiTimeout
} from "@/lib/ai-client";
import { AI_TASKS } from "@/lib/ai/tasks";
import { buildMockAnnotations, exactAnnotations, findIssueRanges, normalizeAnnotations } from "@/lib/annotations";
import { buildCitationAudit } from "@/lib/citationAudit";
import { getTransitionPrompt } from "@/lib/moduleTransitionPrompts";
import { protectModuleText } from "@/lib/noteKernel";
import { buildGenerateNextMessages } from "@/lib/prompts";
import { generateNextRequestSchema, generateNextResponseSchema } from "@/lib/schemas";
import { cleanGeneratedText } from "@/lib/textFormat";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const startedAt = performance.now();
  try {
    const json = await request.json();
    const parsedInput = generateNextRequestSchema.parse(json);
    const input = { ...parsedInput, sourceText: protectModuleText(parsedInput.sourceText) };
    const expectedTarget = (input.sourceModuleNumber + 1) as Exclude<ModuleNumber, 1>;

    if (!input.sourceText.trim()) {
      return NextResponse.json(
        { error: `Add content to Module ${input.sourceModuleNumber} before generating Module ${expectedTarget}.` },
        { status: 400 }
      );
    }

    const task = AI_TASKS.generateNextModule;
    if (forceMockEnabled()) {
      return NextResponse.json(addAiMetadata(
        mockGenerate(input.topic, input.sourceModuleNumber, input.sourceText, input.sourceSources, input.sourceAnnotations),
        aiMetadata(startedAt, "mock", AI_MOCK_MODEL, "forced-mock")
      ));
    }
    if (!hasAiKey()) {
      return NextResponse.json(unavailableGenerate(startedAt, "missing-api-key"), { status: 503 });
    }

    try {
      const client = createAiClient(task.timeoutMs);
      const maxTokens = generateMaxTokens();
      const messages = buildGenerateNextMessages(input);
      const first = await requestGenerateJson(client, messages, task.model, task.timeoutMs, maxTokens, 0.25);
      let totalTokens = first.totalTokens;
      let candidate = await parseOrRepairGenerateCandidate(
        client,
        input,
        expectedTarget,
        first.raw,
        messages,
        task.model,
        task.timeoutMs,
        maxTokens,
        (tokens) => {
          totalTokens += tokens;
        }
      );

      if (candidate.contractIssues.length) {
        const repaired = await requestGenerateJson(
          client,
          buildGenerateRepairMessages(input, first.raw, candidate.text, candidate.contractIssues),
          task.model,
          task.timeoutMs,
          maxTokens,
          0
        );
        totalTokens += repaired.totalTokens;
        candidate = parseGenerateCandidate(repaired.raw, input, expectedTarget);
      }

      const { parsed, text, contractIssues } = candidate;
      if (contractIssues.length) {
        throw new Error(`AI output failed transition contract: ${contractIssues.join("; ")}`);
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

      return NextResponse.json(addAiMetadata(
        normalized,
        aiMetadata(startedAt, "deepseek", task.model, undefined, totalTokens)
      ));
    } catch (aiError) {
      console.warn("Generate Next AI unavailable:", aiError);
      return NextResponse.json(unavailableGenerate(startedAt, fallbackReasonFromError(aiError, task.model)), { status: 503 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function unavailableGenerate(startedAt: number, reason: string) {
  return addAiMetadata({
    error: "AI unavailable. Check DeepSeek settings or retry. Enable ESSAYCRAFT_FORCE_MOCK_AI=1 only for an offline demo.",
    providerMode: "unavailable" as const,
    warnings: [safeUnavailableReason(reason)]
  }, aiMetadata(startedAt, "unavailable", "none", reason));
}

function safeUnavailableReason(reason: string) {
  if (reason === "missing-api-key") return "DeepSeek API key is not configured.";
  return "Provider request did not complete successfully.";
}

async function requestGenerateJson(
  client: ReturnType<typeof createAiClient>,
  messages: ChatCompletionMessageParam[],
  model: string,
  timeoutMs: number,
  maxTokens: number,
  temperature: number
) {
  const completion = await withAiTimeout(
    client.chat.completions.create(deepSeekRequestBody({
      model,
      messages,
      response_format: { type: "json_object" },
      max_tokens: maxTokens,
      temperature
    })),
    timeoutMs
  );
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("AI returned empty content.");
  return {
    raw,
    totalTokens: completion.usage?.total_tokens ?? 0
  };
}

type GenerateCandidate = ReturnType<typeof parseGenerateCandidate>;

async function parseOrRepairGenerateCandidate(
  client: ReturnType<typeof createAiClient>,
  input: GenerateNextRequest,
  expectedTarget: Exclude<ModuleNumber, 1>,
  raw: string,
  originalMessages: ChatCompletionMessageParam[],
  model: string,
  timeoutMs: number,
  maxTokens: number,
  addTokens: (tokens: number) => void
): Promise<GenerateCandidate> {
  try {
    return parseGenerateCandidate(raw, input, expectedTarget);
  } catch (parseError) {
    const repaired = await requestGenerateJson(
      client,
      buildGenerateSchemaRepairMessages(input, raw, parseError, originalMessages),
      model,
      timeoutMs,
      maxTokens,
      0
    );
    addTokens(repaired.totalTokens);
    try {
      return parseGenerateCandidate(repaired.raw, input, expectedTarget);
    } catch (repairParseError) {
      throw new Error(`AI schema repair failed after first response: ${errorMessage(parseError)}; repair error: ${errorMessage(repairParseError)}`);
    }
  }
}

function parseGenerateCandidate(
  raw: string,
  input: GenerateNextRequest,
  expectedTarget: Exclude<ModuleNumber, 1>
) {
  const parsed = generateNextResponseSchema.parse(JSON.parse(raw));
  if (parsed.moduleNumber !== expectedTarget) {
    throw new Error(`AI returned Module ${parsed.moduleNumber}, expected Module ${expectedTarget}.`);
  }

  const text = normalizeGeneratedModuleText(
    sanitizeUnsupportedCitations(cleanGeneratedText(parsed.text, parsed.moduleNumber), input.sourceSources),
    parsed.moduleNumber
  );
  if (!text.trim()) {
    throw new Error("AI returned empty generated text after cleanup.");
  }
  return {
    parsed,
    text,
    contractIssues: contractIssuesFromAiSelfCheck(parsed.contractCheck)
  };
}

function buildGenerateSchemaRepairMessages(
  input: GenerateNextRequest,
  rawOutput: string,
  parseError: unknown,
  originalMessages: ChatCompletionMessageParam[]
): ChatCompletionMessageParam[] {
  const transition = getTransitionPrompt(input.sourceModuleNumber);
  return [
    {
      role: "system",
      content: `Repair the previous EssayCraft Generate Next provider response into valid JSON only.

The previous response failed JSON/schema validation. Do not rewrite the essay unless needed to satisfy the schema.
Keep target moduleNumber ${transition.toModule} and title "${transition.name}".
All annotation labels must be exactly one of:
background, thesis, evidence, analysis, counterargument, citation, conclusion, issue, plain.
Never use warning, claim, support, note, source-needed, or any other custom label. If the annotation is a warning/problem, use "issue".
annotation.text must be an exact substring of text.
Do not invent real citations, authors, years, titles, URLs, DOIs, journals, or reference entries.
Return the full required object, including contractCheck.

Required JSON shape:
{"moduleNumber":${transition.toModule},"title":"${transition.name}","text":"Paragraph 1...\\n\\nParagraph 2...","annotations":[{"id":"a1","start":0,"end":20,"text":"exact substring","label":"background","confidence":0.85,"comment":"brief reason"}],"sources":[],"contractCheck":{"passed":true,"missingItems":[],"notes":["brief self-check"]},"globalFeedback":["short feedback"],"warnings":[]}`
    },
    {
      role: "user",
      content: `Schema/validation error:
${errorMessage(parseError)}

Original task context:
${serializeMessagesForRepair(originalMessages)}

Previous raw provider output:
${rawOutput}

Return corrected JSON only.`
    }
  ];
}

function contractIssuesFromAiSelfCheck(check: GenerateNextResponse["contractCheck"]) {
  if (!check) return ["missing AI contract self-check"];
  if (check.passed) return [];
  const items = [...(check.missingItems ?? []), ...(check.notes ?? [])].map((item) => item.trim()).filter(Boolean);
  return items.length ? items : ["AI contract self-check did not pass"];
}

function serializeMessagesForRepair(messages: ChatCompletionMessageParam[]) {
  return messages
    .map((item) => `${item.role.toUpperCase()}:\n${typeof item.content === "string" ? item.content : JSON.stringify(item.content)}`)
    .join("\n\n---\n\n");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function buildGenerateRepairMessages(
  input: GenerateNextRequest,
  rawOutput: string,
  cleanedText: string,
  contractIssues: string[]
): ChatCompletionMessageParam[] {
  const transition = getTransitionPrompt(input.sourceModuleNumber);
  return [
    {
      role: "system",
      content: `Repair the previous EssayCraft Generate Next response. Return strict JSON only.

The previous JSON was syntactically readable, but its AI contract self-check did not pass or was missing.
Do not invent real citations, authors, years, titles, URLs, DOIs, journals, or reference entries.
Keep the target moduleNumber ${transition.toModule} and title "${transition.name}".
Rewrite the text so it satisfies the transition output contract, paragraph format, citation behavior, and validation rules.
Then run your own contract self-check again.

Output contract:
${transition.outputContract.map((item) => `- ${item}`).join("\n")}

Paragraph format:
${transition.paragraphFormat}

Citation behavior:
${transition.citationBehavior}

Validation rules:
${transition.validationRules.map((item) => `- ${item}`).join("\n")}

Required JSON shape:
{"moduleNumber":${transition.toModule},"title":"${transition.name}","text":"Paragraph 1...\\n\\nParagraph 2...","annotations":[{"id":"a1","start":0,"end":20,"text":"exact substring","label":"background","confidence":0.85,"comment":"brief reason"}],"sources":[],"contractCheck":{"passed":true,"missingItems":[],"notes":["brief self-check"]},"globalFeedback":["short feedback"],"warnings":[]}`
    },
    {
      role: "user",
      content: `Contract issues to fix:
${contractIssues.map((issue) => `- ${issue}`).join("\n")}

Project topic:
${input.topic}

Source module ${input.sourceModuleNumber}: ${input.sourceTitle}
${JSON.stringify(input.sourceText)}

Teacher-editable transition instruction:
${transition.userPromptTemplate}

Previous generated text after cleanup:
${JSON.stringify(cleanedText)}

Previous raw JSON output:
${rawOutput}

Return corrected JSON only.`
    }
  ];
}

function generateMaxTokens() {
  const configured = Number(process.env.ESSAYCRAFT_GENERATE_MAX_TOKENS ?? process.env.ESSAYCRAFT_MAX_TOKENS);
  return Number.isFinite(configured) && configured > 0 ? Math.round(configured) : 16384;
}

function mockGenerate(topic: string, sourceModuleNumber: Exclude<ModuleNumber, 6>, sourceText: string, sourceSources: SourceCard[] = [], sourceAnnotations: Annotation[] = []): GenerateNextResponse {
  const transition = getTransitionPrompt(sourceModuleNumber);
  const moduleNumber = transition.toModule;
  const text = normalizeGeneratedModuleText(cleanGeneratedText(mockText(topic, sourceModuleNumber, sourceText, sourceSources, sourceAnnotations), moduleNumber), moduleNumber);
  const annotations = normalizeAnnotations(text, [...buildMockAnnotations(text), ...findIssueRanges(text)]);

  return {
    moduleNumber,
    title: transition.name,
    text,
    annotations,
    sources: sourceSources,
    contractCheck: {
      passed: true,
      missingItems: [],
      notes: ["Mock mode returns deterministic demo structure only."]
    },
    globalFeedback: [`Mock generated Module ${moduleNumber} from Module ${sourceModuleNumber}.`],
    warnings: ["Mock mode did not verify any source metadata. Keep source-needed and citation-needed markers until real sources are added."],
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
    return buildDraftFromOutline(subject, sourceText);
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

type ModuleOnePlan = {
  topic: string;
  researchQuestion?: string;
  thesis?: string;
  reasons: string[];
};

type OutlineBody = {
  index: number;
  topicSentence: string;
  evidence: string;
  analysis: string;
  linkBack: string;
};

function buildResearchPlan(subject: string, sourceText: string) {
  const plan = parseModuleOnePlan(sourceText, subject);
  const planSubject = plan.topic || subject;
  const thesis = plan.thesis ??
    `The essay will argue a focused position about ${trimPeriod(planSubject).toLowerCase()} using three specific, evidence-backed reasons.`;
  const branches = plan.reasons.length ? plan.reasons : [
    `Define the most important development or problem within ${trimPeriod(subject).toLowerCase()}`,
    `Explain why ${trimPeriod(subject).toLowerCase()} matters for real people, institutions, or communities`,
    `Evaluate a practical response, design choice, policy, or ethical responsibility`
  ];

  return `Research plan for: ${trimPeriod(planSubject)}

${plan.researchQuestion ? `Research question: ${plan.researchQuestion}\n\n` : ""}Working thesis: ${thesis}

Mind map / argument branches

${branches.slice(0, 4).map((branch, index) => researchBranchBlock(planSubject, branch, index + 1)).join("\n\n")}

Counterargument to investigate: ${counterargumentFor(planSubject)}
Evidence to look for: ${counterEvidenceFor(planSubject)}

Source notes:
- Add real sources in the Source Workbench when found.
- EssayCraft must not invent authors, years, DOIs, URLs, or reference entries.
- Use the CARS check: credible, accurate, reasonable, and supportive of the exact claim.`;
}

function buildOutlineFromResearchPlan(subject: string, sourceText: string, sourceSources: SourceCard[]) {
  const parsed = parseResearchPlan(sourceText);
  const planSubject = parsed.subject || subject;
  const branches = ensureAtLeastTwoBranches(parsed.branches, planSubject).slice(0, 4);
  const thesis = parsed.thesis ??
    `The essay will argue that ${trimPeriod(planSubject).toLowerCase()} should be understood through ${branches.slice(0, 3).map((branch) => trimPeriod(branch.claim).toLowerCase()).join(", ")}.`;
  const realSources = sourceSources.filter((source) => !source.placeholder);

  return `Introduction plan
- Hook / importance: ${outlineHook(planSubject, branches)}
- Background: ${outlineBackground(planSubject, branches)}
${parsed.researchQuestion ? `- Research question: ${parsed.researchQuestion}\n` : ""}- Thesis: ${thesis}
- Thesis map: ${branches.slice(0, 3).map((branch) => trimPeriod(branch.claim)).join("; ")}.

${branches.map((branch, index) => `Body paragraph ${index + 1}
- Topic sentence: ${branchTopicSentence(branch.claim, index + 1)}
- Evidence to use: ${evidenceSlot(branch, realSources[index])}
- Analysis purpose: ${analysisPurpose(branch.claim, planSubject)}
- Link back: ${linkBack(branch.claim, planSubject)}`).join("\n\n")}

Counterargument paragraph
- Opposing view: ${parsed.counterargument ?? counterargumentFor(planSubject)}
- Response: Acknowledge the strongest part of that view, then explain why the thesis remains more persuasive when the evidence is weighed carefully.

Conclusion plan
- Rephrased thesis: ${conclusionThesis(planSubject)}
- Summary of main arguments: Synthesize ${branches.slice(0, 3).map((branch) => trimPeriod(branch.claim).toLowerCase()).join(", ")}.
- So what / implication: ${soWhatImplication(planSubject)}`;
}

function parseResearchPlan(text: string) {
  const branches: ResearchBranch[] = [];
  let current: ResearchBranch | undefined;
  let inMindMap = false;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      inMindMap = false;
      continue;
    }

    if (/^(mind map|argument branches|argument map|possible argument map)/i.test(line)) {
      inMindMap = true;
      continue;
    }

    const branchMatch = line.match(/^(?:Argument branch|Argument|Branch|Claim|Claim to investigate|Reason)\s*([A-Za-z0-9]*)\s*[:.)-]\s*(.+)$/i) ??
      (inMindMap ? line.match(/^[-*]\s*(.+)$/) : null);
    if (branchMatch) {
      const indexToken = branchMatch.length > 2 ? branchMatch[1] : "";
      const claimText = branchMatch.length > 2 ? branchMatch[2] : branchMatch[1];
      current = {
        index: Number(indexToken) || branches.length + 1,
        claim: cleanupOutlineText(claimText)
      };
      branches.push(current);
      continue;
    }

    if (current) {
      const evidence = line.match(/^Evidence (?:needed|to look for|to use|to find)\s*:\s*(.+)$/i);
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
    subject: extractField(text, "Research plan for") ?? extractField(text, "Topic"),
    researchQuestion: extractField(text, "Research question") ?? extractField(text, "Question"),
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
      claim: `A distinct consequence of ${trimPeriod(subject).toLowerCase()} deserves separate investigation`,
      evidence: "Add a source that supports this separate reason",
      status: "source needed"
    }
  ];
}

function evidenceSlot(branch: ResearchBranch, source: SourceCard | undefined) {
  if (source) {
    const citation = sourceCitation(source);
    return `Use source card ${source.id}: ${source.title || "Untitled source"}${citation ? ` ${citation}` : ""}.`;
  }

  const evidence = branch.evidence ? trimPeriod(branch.evidence) : "credible source directly supporting this claim";
  return `[source needed: ${evidence}.]`;
}

function sourceCitation(source: SourceCard) {
  const author = source.authors?.[0]?.trim().split(/\s+/).pop();
  if (!author || !source.year) return "";
  return `(${author}, ${source.year})`;
}

function branchTopicSentence(claim: string, index: number) {
  const cleaned = trimPeriod(cleanupOutlineText(claim));
  void index;
  return `${capitalizePhrase(cleaned)}.`;
}

function parseThesisMap(text: string) {
  const lines = text.split("\n");
  const reasons: string[] = [];
  let capture = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (/^(?:Thesis map|Possible argument map|Argument map|Reasons)\s*:/i.test(line)) {
      capture = true;
      const inline = line.replace(/^(?:Thesis map|Possible argument map|Argument map|Reasons)\s*:\s*/i, "").trim();
      if (inline) {
        const splitReasons = inline
          .split(/\s*(?:;|\n|\|\s*|\bReason\s*\d+\s*:)\s*/i)
          .map(cleanupOutlineText)
          .filter(Boolean);
        reasons.push(...(splitReasons.length ? splitReasons : [cleanupOutlineText(inline)]));
      }
      continue;
    }
    if (!capture) continue;
    if (!line) continue;
    if (/^[A-Z][A-Za-z ]+\s*:/.test(line) && !/^[-*]/.test(line)) break;
    const reason = line.match(/^(?:[-*]\s*)?(?:Reason\s*\d+|Argument\s*\d+|Branch\s*\d+)?\s*:?\s*(.+)$/i)?.[1];
    if (reason) reasons.push(cleanupOutlineText(reason));
  }
  return Array.from(new Set(reasons.filter(Boolean)));
}

function parseModuleOnePlan(text: string, fallbackSubject: string): ModuleOnePlan {
  return {
    topic: extractField(text, "Topic") ?? fallbackSubject,
    researchQuestion: extractField(text, "Research question") ?? extractField(text, "Question"),
    thesis: extractField(text, "Working thesis") ?? extractField(text, "Thesis"),
    reasons: parseThesisMap(text)
  };
}

function researchBranchBlock(subject: string, branch: string, index: number) {
  const profile = sourceNeedProfile(subject, branch);
  return `Argument branch ${index}: ${profile.claim}
Evidence to look for: ${profile.evidence}
Possible source type: ${profile.sourceType}
Search keywords: ${profile.keywords}
Source status: source needed
CARS check: ${profile.cars}`;
}

function sourceNeedProfile(subject: string, branch: string) {
  const cleaned = trimPeriod(cleanupOutlineText(branch));
  const lower = `${subject} ${cleaned}`.toLowerCase();

  if (isSocialMediaTopic(lower) && /(habit|passive|scroll|attention|sleep|anxiety|wellbeing)/i.test(cleaned)) {
    return {
      claim: "Intentional habits can reduce passive scrolling and help users regain control over attention.",
      evidence: "Research on screen time, passive scrolling, wellbeing, sleep, attention, or adolescent mental health.",
      sourceType: "scholarly article, professional mental-health report, or government/public-health report",
      keywords: "social media passive scrolling youth wellbeing attention sleep anxiety study",
      cars: "When a source is added, check whether it is credible, accurate, reasonable, and directly supportive of this claim."
    };
  }

  if (isSocialMediaTopic(lower) && /(platform|design|algorithm|notification|comparison|engagement)/i.test(cleaned)) {
    return {
      claim: "Platform design can intensify comparison and distraction, so healthier balance also requires design responsibility.",
      evidence: "Research or professional reports on engagement design, recommendation algorithms, notifications, social comparison, or platform regulation.",
      sourceType: "scholarly article, professional technology report, government report, or NGO report",
      keywords: "social media algorithms engagement design social comparison youth wellbeing regulation",
      cars: "When a source is added, check whether the author is reliable and whether the evidence directly supports the design-responsibility claim."
    };
  }

  if (isSocialMediaTopic(lower) && /(school|digital literacy|media literacy|education|students)/i.test(cleaned)) {
    return {
      claim: "Digital literacy education can help students evaluate social media more critically.",
      evidence: "Research on digital literacy, media education, school-based interventions, or youth online safety education.",
      sourceType: "education research article, government education policy report, or professional report",
      keywords: "digital literacy education students social media critical evaluation wellbeing",
      cars: "When a source is added, check whether it includes evidence relevant to young people or education."
    };
  }

  return {
    claim: capitalizeSentence(cleaned),
    evidence: `Research, examples, or professional evidence that directly support ${lowerFirst(cleaned)}.`,
    sourceType: "scholarly article, government report, professional report, or course-approved credible source",
    keywords: keywordLine(subject, cleaned),
    cars: "When a source is added, check whether it is credible, accurate, reasonable, and directly supportive of this branch."
  };
}

function outlineHook(subject: string, branches: ResearchBranch[]) {
  const lower = `${subject} ${branches.map((branch) => branch.claim).join(" ")}`.toLowerCase();
  if (isSocialMediaTopic(lower)) {
    return "Social media now shapes how young people communicate, relax, study, and compare themselves with others, so the question is not simply whether social media is good or bad but how it can be used more healthily.";
  }
  if (/technology|human|machine|ai|computer|phone/i.test(lower)) {
    return "Technology increasingly shapes how people communicate, work, and understand themselves, so its future should be judged by how well it serves human needs.";
  }
  return `${capitalizePhrase(trimPeriod(subject))} matters because it shapes practical choices, responsibilities, and the evidence readers need before accepting an argument.`;
}

function outlineBackground(subject: string, branches: ResearchBranch[]) {
  const lower = `${subject} ${branches.map((branch) => branch.claim).join(" ")}`.toLowerCase();
  if (isSocialMediaTopic(lower)) {
    return "The essay should briefly explain that social media offers connection and information, while also creating risks such as passive scrolling, distraction, social comparison, and pressure on wellbeing.";
  }
  if (/technology|human|machine|ai|computer|phone/i.test(lower)) {
    return "Computers, mobile phones, and AI systems can be presented as stages in a changing relationship between humans and machines.";
  }
  return `The essay should define ${trimPeriod(subject).toLowerCase()}, name the debate, and explain why the issue is worth investigating now.`;
}

function analysisPurpose(claim: string, subject: string) {
  const lower = `${subject} ${claim}`.toLowerCase();
  if (isSocialMediaTopic(lower) && /(habit|passive|scroll|attention)/i.test(claim)) {
    return "Explain how intentional habits such as app limits, no-phone study periods, or mindful checking routines reduce passive consumption and make social media use more deliberate.";
  }
  if (isSocialMediaTopic(lower) && /(platform|design|algorithm|notification|comparison)/i.test(claim)) {
    return "Explain why individual self-control is limited when platforms are designed to maximize attention, and why design changes could reduce comparison and distraction.";
  }
  if (isSocialMediaTopic(lower) && /(school|digital literacy|education|students)/i.test(claim)) {
    return "Explain how digital literacy helps students evaluate online content, recognize manipulative design, and reflect on how social media affects their emotions and attention.";
  }
  return `Explain how this evidence supports the thesis by showing why ${trimPeriod(claim).toLowerCase()} matters, rather than only summarizing the source.`;
}

function linkBack(claim: string, subject: string) {
  const lower = `${subject} ${claim}`.toLowerCase();
  if (isSocialMediaTopic(lower) && /(habit|passive|scroll|attention)/i.test(claim)) {
    return "This supports the thesis by showing that balance begins with user agency, not total rejection of social media.";
  }
  if (isSocialMediaTopic(lower) && /(platform|design|algorithm|notification|comparison)/i.test(claim)) {
    return "This supports the thesis by showing that healthier balance requires institutional responsibility as well as personal habits.";
  }
  if (isSocialMediaTopic(lower) && /(school|digital literacy|education|students)/i.test(claim)) {
    return "This supports the thesis by showing that balance can be learned and practiced.";
  }
  return `This supports the thesis by connecting ${trimPeriod(claim).toLowerCase()} back to the larger argument about ${trimPeriod(subject).toLowerCase()}.`;
}

function counterargumentFor(subject: string) {
  if (isSocialMediaTopic(subject)) {
    return "Some people may argue that strict bans or screen-time limits are more effective than balance-oriented approaches.";
  }
  return `Some readers may argue that a stricter, simpler, or competing response to ${trimPeriod(subject).toLowerCase()} would be more effective.`;
}

function counterEvidenceFor(subject: string) {
  if (isSocialMediaTopic(subject)) {
    return "Policy debate, youth rights analysis, or evidence on social media restrictions.";
  }
  return "Evidence that fairly represents the strongest opposing view before the essay responds.";
}

function conclusionThesis(subject: string) {
  if (isSocialMediaTopic(subject)) return "Social media balance is most realistic when responsibility is shared among users, platforms, and schools.";
  return `${capitalizePhrase(trimPeriod(subject))} is best understood through the combined reasons developed in the essay.`;
}

function soWhatImplication(subject: string) {
  if (isSocialMediaTopic(subject)) {
    return "End by explaining that the goal is not to reject social media entirely, but to make its benefits less dependent on constant attention and comparison.";
  }
  return "End by explaining why the argument matters beyond a single assignment and what readers should understand differently.";
}

function buildDraftFromOutline(subject: string, outlineText: string) {
  const outline = parseOutline(outlineText, subject);
  const cleanSubject = trimPeriod(outline.subject || subject);
  const thesis = ensureSentence(outline.thesis || `A balanced argument about ${cleanSubject.toLowerCase()} needs clear reasons, evidence, and analysis`);
  const bodies = ensureDraftBodies(outline.bodies, cleanSubject);
  const intro = buildIntroductionParagraph(cleanSubject, outline, thesis, bodies);
  const bodyParagraphs = bodies.slice(0, 4).map((body, index) => buildBodyParagraph(body, index + 1, cleanSubject));
  const counter = buildCounterargumentParagraph(outline, cleanSubject);
  const conclusion = buildConclusionParagraph(outline, cleanSubject, thesis, bodies);
  return [intro, ...bodyParagraphs, counter, conclusion].filter(Boolean).join("\n\n");
}

function parseOutline(text: string, fallbackSubject: string) {
  const outline = {
    subject: extractField(text, "Topic") ?? fallbackSubject,
    hook: "",
    background: "",
    researchQuestion: "",
    thesis: "",
    thesisMap: "",
    bodies: [] as OutlineBody[],
    opposingView: "",
    response: "",
    rephrasedThesis: "",
    summary: "",
    implication: ""
  };
  let section: "intro" | "body" | "counter" | "conclusion" | "" = "";
  let currentBody: OutlineBody | undefined;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const bodyHeading = line.match(/^Body paragraph\s*(\d*)/i);
    if (/^Introduction(?: plan)?$/i.test(line)) {
      section = "intro";
      continue;
    }
    if (bodyHeading) {
      section = "body";
      currentBody = {
        index: Number(bodyHeading[1]) || outline.bodies.length + 1,
        topicSentence: "",
        evidence: "",
        analysis: "",
        linkBack: ""
      };
      outline.bodies.push(currentBody);
      continue;
    }
    if (/^Counterargument(?: paragraph)?$/i.test(line)) {
      section = "counter";
      currentBody = undefined;
      continue;
    }
    if (/^Conclusion(?: plan)?$/i.test(line)) {
      section = "conclusion";
      currentBody = undefined;
      continue;
    }

    const field = line.match(/^[-*]?\s*([^:]+)\s*:\s*(.+)$/);
    if (!field) continue;
    const label = field[1].trim().toLowerCase();
    const value = cleanupDraftSourceText(field[2]);

    if (label.includes("hook") || label.includes("importance")) {
      if (!outline.hook) outline.hook = value;
      else if (!outline.background) outline.background = value;
      continue;
    }
    if (label.includes("background") || label.includes("context")) {
      outline.background = value;
      continue;
    }
    if (label.includes("research question") || label === "question") {
      outline.researchQuestion = value;
      continue;
    }
    if (label.includes("thesis map")) {
      outline.thesisMap = value;
      continue;
    }
    if (label === "thesis" || label.includes("working thesis")) {
      outline.thesis = value;
      continue;
    }

    if (currentBody) {
      if (label.includes("topic sentence")) currentBody.topicSentence = value;
      else if (label.includes("evidence")) currentBody.evidence = value;
      else if (label.includes("analysis")) currentBody.analysis = value;
      else if (label.includes("link back") || label.includes("link")) currentBody.linkBack = value;
      continue;
    }

    if (section === "counter") {
      if (label.includes("opposing") || label.includes("counter")) outline.opposingView = value;
      else if (label.includes("response") || label.includes("rebuttal")) outline.response = value;
      continue;
    }

    if (section === "conclusion") {
      if (label.includes("rephrased") || label.includes("thesis")) outline.rephrasedThesis = value;
      else if (label.includes("summary") || label.includes("main arguments")) outline.summary = value;
      else if (label.includes("so what") || label.includes("implication") || label.includes("significance")) outline.implication = value;
    }
  }

  return outline;
}

function ensureDraftBodies(bodies: OutlineBody[], subject: string) {
  const result = bodies.filter((body) => body.topicSentence || body.evidence || body.analysis);
  while (result.length < 2) {
    const index = result.length + 1;
    result.push({
      index,
      topicSentence: index === 1
        ? `${capitalizePhrase(subject)} needs a focused first reason that connects the topic to the thesis.`
        : `${capitalizePhrase(subject)} also needs a separate reason that addresses a different part of the issue.`,
      evidence: "A relevant academic or professional source is needed for this claim.",
      analysis: "This evidence would help explain why the reason supports the thesis.",
      linkBack: "This point connects back to the essay's central argument."
    });
  }
  return result;
}

function buildIntroductionParagraph(subject: string, outline: ReturnType<typeof parseOutline>, thesis: string, bodies: OutlineBody[]) {
  if (isSocialMediaTopic(`${subject} ${thesis}`)) {
    return `${outline.hook || "Social media has become a normal part of how young people communicate, relax, and understand the world around them."} It can help users maintain friendships, access information, and participate in communities, but it can also encourage distraction, passive scrolling, and constant social comparison. For this reason, the central question is not whether social media should be completely accepted or rejected, but how it can be used in a healthier way. This essay argues that ${lowerFirst(trimPeriod(thesis))}.`;
  }

  const hook = outline.hook || `${capitalizePhrase(subject)} is a significant academic issue because it affects how people make choices and evaluate responsibility.`;
  const background = outline.background || `The topic requires careful attention to context, competing views, and evidence.`;
  const map = outline.thesisMap || bodies.slice(0, 3).map((body) => trimPeriod(body.topicSentence)).join(", ");
  return `${ensureSentence(hook)} ${ensureSentence(background)} This essay argues that ${lowerFirst(trimPeriod(thesis))}. It will develop this argument through ${lowerFirst(trimPeriod(map))}.`;
}

function buildBodyParagraph(body: OutlineBody, index: number, subject: string) {
  const topic = ensureSentence(body.topicSentence || `${capitalizePhrase(subject)} requires a focused reason.`);
  const evidence = evidenceToDraftSentence(body.evidence);
  const analysis = analysisToDraftSentence(body.analysis);
  const link = linkToDraftSentence(body.linkBack, subject);
  return `${transitionFor(index)}, ${lowerFirst(trimPeriod(topic))}. ${evidence} ${analysis} ${link}`;
}

function buildCounterargumentParagraph(outline: ReturnType<typeof parseOutline>, subject: string) {
  const opposing = cleanupDraftSourceText(outline.opposingView || counterargumentFor(subject));
  const response = cleanupDraftSourceText(outline.response || `A balanced response can concede a valid concern while explaining why the thesis remains more practical or better supported.`);
  const opposingSentence = /^some (readers|people|critics)/i.test(opposing)
    ? ensureSentence(opposing)
    : `Some readers may argue that ${lowerFirst(trimPeriod(opposing))}.`;
  const responseSentence = /^however|although|a balanced|this concern/i.test(response)
    ? ensureSentence(response)
    : `However, ${lowerFirst(trimPeriod(response))}.`;
  return `${opposingSentence} ${responseSentence}`;
}

function buildConclusionParagraph(outline: ReturnType<typeof parseOutline>, subject: string, thesis: string, bodies: OutlineBody[]) {
  const rephrased = cleanupDraftSourceText(outline.rephrasedThesis || (isSocialMediaTopic(subject) ? conclusionThesis(subject) : thesis));
  const summary = cleanupDraftSourceText(outline.summary || bodies.slice(0, 3).map((body) => trimPeriod(body.topicSentence).toLowerCase()).join(", "));
  const implication = cleanupDraftSourceText(outline.implication || soWhatImplication(subject));
  return `In conclusion, ${lowerFirst(trimPeriod(rephrased))}. The essay has shown that ${summary}. ${ensureSentence(implication)}`;
}

function evidenceToDraftSentence(value: string) {
  const cleaned = cleanupDraftSourceText(value)
    .replace(/\[source needed:?\s*([^\]]*)\]/gi, "$1")
    .replace(/\[citation needed\]/gi, "")
    .trim();
  const detail = trimPeriod(cleaned || "a relevant academic or professional source is needed for this claim");
  if (/\([A-Z][A-Za-z' -]+,\s*\d{4}[a-z]?\)/.test(value)) {
    return ensureSentence(detail);
  }
  return `A relevant source is needed here to support ${lowerFirst(detail)} [citation needed].`;
}

function analysisToDraftSentence(value: string) {
  const cleaned = cleanupDraftSourceText(value);
  if (!cleaned) return "This matters because the evidence needs to be interpreted and connected back to the thesis.";
  return ensureSentence(
    cleaned
      .replace(/^Explain how\s+/i, "This shows how ")
      .replace(/^Explain why\s+/i, "This explains why ")
      .replace(/^Explain\s+/i, "This explains ")
  );
}

function linkToDraftSentence(value: string, subject: string) {
  const cleaned = cleanupDraftSourceText(value);
  if (!cleaned) return `Therefore, this point supports the broader argument about ${trimPeriod(subject).toLowerCase()}.`;
  return ensureSentence(cleaned.replace(/^This supports the thesis by\s+/i, "Therefore, this supports the thesis by "));
}

function cleanupDraftSourceText(value: string) {
  return cleanupOutlineText(value)
    .replace(/^The student should\s+/i, "")
    .replace(/^the outline suggests that\s+/i, "")
    .replace(/^the draft should\s+/i, "")
    .replace(/\bshould\s+return to\b/gi, "returns to")
    .replace(/\s+/g, " ")
    .trim();
}

function ensureSentence(value: string) {
  const text = trimPeriod(value);
  if (!text) return "";
  return `${text}.`;
}

function transitionFor(index: number) {
  return index === 1 ? "First" : index === 2 ? "Second" : index === 3 ? "Third" : "Finally";
}

function normalizeGeneratedModuleText(text: string, moduleNumber: Exclude<ModuleNumber, 1>) {
  if (moduleNumber === 2) {
    return text.replace(/\s*\[citation needed\]\s*/gi, " source needed ").replace(/[ \t]{2,}/g, " ").trim();
  }
  if (moduleNumber === 3) {
    return text.replace(/\[citation needed(?::\s*([^\]]+))?\]/gi, (_match, detail: string | undefined) =>
      detail ? `[source needed: ${detail}]` : "[source needed]"
    );
  }
  return text;
}

function sanitizeUnsupportedCitations(text: string, userSources: SourceCard[]) {
  const allowed = userSources.map(sourceCitation).filter(Boolean);
  if (!allowed.length) {
    return text.replace(/\(([A-Z][A-Za-z' -]+(?:\s*&\s*[A-Z][A-Za-z' -]+)?),\s*\d{4}[a-z]?\)/g, "[citation needed]");
  }
  return text.replace(/\(([A-Z][A-Za-z' -]+(?:\s*&\s*[A-Z][A-Za-z' -]+)?),\s*\d{4}[a-z]?\)/g, (citation) =>
    allowed.some((allowedCitation) => allowedCitation.toLowerCase() === citation.toLowerCase()) ? citation : "[citation needed]"
  );
}

function isSocialMediaTopic(value: string) {
  return /social media|platforms?|scrolling|digital literacy|youth wellbeing|wellbeing/.test(value.toLowerCase());
}

function capitalizePhrase(value: string) {
  const text = trimPeriod(value);
  if (!text) return "";
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
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
  return value.replace(/\s*\[(?:citation|source) needed(?::[^\]]*)?\]\s*/gi, " ").replace(/\s+/g, " ").trim();
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
