export type ModuleNumber = 1 | 2 | 3 | 4 | 5 | 6;

export type SegmentLabel =
  | "background"
  | "thesis"
  | "evidence"
  | "analysis"
  | "counterargument"
  | "citation"
  | "conclusion"
  | "issue"
  | "plain";

export type ModuleTransitionId = "1-2" | "2-3" | "3-4" | "4-5" | "5-6";

export type ModuleTransitionPrompt = {
  id: ModuleTransitionId;
  fromModule: Exclude<ModuleNumber, 6>;
  toModule: Exclude<ModuleNumber, 1>;
  name: string;
  purpose: string;
  courseLogic: string;
  inputContract: string[];
  outputContract: string[];
  paragraphFormat: string;
  citationBehavior: string;
  failureBehavior: string;
  systemPrompt: string;
  userPromptTemplate: string;
  validationRules: string[];
};

export const SHARED_GENERATION_RULES = `
You are EssayCraft, an academic writing workflow assistant.
Return valid JSON only. Do not wrap JSON in markdown.
Preserve the user's topic, stance, and voice where possible.
Do not invent real citations, authors, publication years, titles, DOIs, URLs, journals, or reference entries.
If draft evidence is unsupported, use [citation needed] and/or label the relevant range as issue. In planning modules, prefer source-needed language.
Use labels only from: background, thesis, evidence, analysis, counterargument, citation, conclusion, issue, plain.
Expected JSON shape: { "moduleNumber": number, "title": string, "text": string, "annotations": [], "sources": [], "globalFeedback": [], "warnings": [] }.
Annotations must use start/end offsets that match substrings in the returned text.
Use \n\n between paragraphs. Do not collapse paragraphs into one glued block.
Do not return HTML or colored spans; colors are represented only by annotation labels.
`;

export const MODULE_TRANSITION_PROMPTS: Record<ModuleTransitionId, ModuleTransitionPrompt> = {
  "1-2": {
    id: "1-2",
    fromModule: 1,
    toModule: 2,
    name: "Topic & Question -> Research & Evidence",
    purpose: "Convert a topic, research question, early thesis, and stance into a research/evidence plan.",
    courseLogic:
      "Module 1 establishes essay structure, thesis statement, and thesis map. Module 2 plans through brainstorming, mind maps, source search, and CARS source evaluation.",
    inputContract: [
      "Project topic/title",
      "Module 1 text",
      "Existing annotations",
      "User patches",
      "Optional selected range",
    ],
    outputContract: [
      "Research plan for the student's actual topic/question",
      "Working thesis/position if supplied or safely inferred as a claim to test",
      "3-4 argument branches or claims to investigate",
      "Evidence needed for each branch",
      "Possible source types",
      "Search keywords",
      "Source status for each branch",
      "CARS checklist",
      "Missing-evidence warnings",
      "Source notes directing students to source cards",
    ],
    paragraphFormat: "Headings and bullets are allowed. Keep sections separated by blank lines.",
    citationBehavior: "Do not create real citations. Suggest source types, search keywords, source status, and source-needed planning notes. Do not mark Module 2 planning as citation failure.",
    failureBehavior: "If source text is too thin, return a short research plan with clear source-needed planning notes rather than inventing evidence.",
    systemPrompt: `${SHARED_GENERATION_RULES}\nYou are EssayCraft's Module 1 to Module 2 generator. Create a research and evidence plan.`,
    userPromptTemplate: `
Input contains topic/question/thesis/early notes.
Create Module 2: Research & Evidence.
Include argument branches, evidence needs, suitable source types, possible search keywords, and CARS reminders: Credible, Accurate, Reasonable, Support.
Do not fabricate sources. Use source-needed planning language, not fake author-year citations.
`,
    validationRules: [
      "Must not contain fabricated author-year citations unless supplied by user.",
      "Must include at least three evidence needs when possible.",
      "Must include CARS source-evaluation reminders.",
    ],
  },
  "2-3": {
    id: "2-3",
    fromModule: 2,
    toModule: 3,
    name: "Research & Evidence -> Outline",
    purpose: "Convert research notes and evidence needs into a structured argumentative essay outline.",
    courseLogic:
      "Module 3 focuses on putting pen to paper: strong introduction, demonstrating importance, topic sentences, supporting details, analysis, counterargument, and conclusion planning.",
    inputContract: ["Project title/topic", "Module 2 research/evidence plan", "Argument branches", "Evidence needed lines", "Source notes/cards", "Patches"],
    outputContract: [
      "Introduction plan: hook/importance, background, focus/scope, thesis, thesis map",
      "Body paragraph plans grounded in named Module 2 branches, not generic first/second reason placeholders",
      "Each body paragraph: topic sentence, evidence to use, analysis purpose, link back",
      "Counterargument paragraph with opposing view and response",
      "Conclusion plan",
      "Missing evidence warnings",
    ],
    paragraphFormat: "Use a clean outline with headings and bullets. Keep introduction/body/counterargument/conclusion sections separated by blank lines.",
    citationBehavior: "Use [source needed: ...] for outline evidence slots with no supplied source. Never fabricate sources.",
    failureBehavior: "If evidence notes are incomplete, keep the outline scaffold and mark missing evidence explicitly.",
    systemPrompt: `${SHARED_GENERATION_RULES}\nYou are EssayCraft's Module 2 to Module 3 generator. Create a structured argumentative essay outline.`,
    userPromptTemplate: `
Convert the research/evidence plan into Module 3: Outline.
Preserve the student's actual topic, working thesis, and named argument branches.
Do not use generic filler such as "Present the first reason" when Module 2 includes branch text.
For the introduction include hook/importance, background/context, focus/scope, thesis, thesis map.
For each body paragraph include topic sentence, Evidence to use, analysis, and link back to thesis.
If no source card exists for an evidence slot, write [source needed: ...].
Include counterargument paragraph and a conclusion plan explaining why the argument matters.
`,
    validationRules: [
      "Must include introduction, body, and conclusion plan.",
      "Evidence without supplied source should be marked [citation needed].",
      "At least one analysis component should appear after evidence components.",
      "Must preserve branch-specific content from Module 2 when available.",
      "Must not include nonsensical body claims such as 'Refined question: Where is...'.",
    ],
  },
  "3-4": {
    id: "3-4",
    fromModule: 3,
    toModule: 4,
    name: "Outline -> Drafting",
    purpose: "Convert a structured outline into coherent academic draft paragraphs.",
    courseLogic:
      "Module 4 emphasizes academic language, signal devices, metadiscourse, transition markers, hedging/boosting, academic tone, and effective conclusion language.",
    inputContract: ["Topic", "Module 3 outline", "Annotations", "Patches"],
    outputContract: [
      "Introduction paragraph",
      "Body paragraphs",
      "Counterargument/rebuttal if present",
      "Conclusion or conclusion placeholder",
      "Signal devices/metadiscourse",
      "Hedging where appropriate",
      "Citation placeholders for unsupported evidence",
    ],
    paragraphFormat: "Use full paragraph prose. Separate each paragraph with a blank line (\\n\\n). Do not output all sentences in one block.",
    citationBehavior: "Use [citation needed] for unsupported factual claims. Never fabricate citations.",
    failureBehavior: "If the outline is sparse, draft cautious paragraphs and avoid adding unsupported facts.",
    systemPrompt: `${SHARED_GENERATION_RULES}\nYou are EssayCraft's Module 3 to Module 4 generator. Create an academic argumentative draft.`,
    userPromptTemplate: `
Convert the outline into Module 4: Drafting.
Use paragraph form. Include an introduction with background, importance, thesis, and thesis map.
Each body paragraph should include topic sentence, evidence, analysis, and link back to thesis.
Use academic tone: formal, precise, unemotional, balanced.
Use metadiscourse and signal devices where helpful: firstly, in addition, however, for example, therefore, this essay argues.
Use hedging for uncertain claims: may, could, appears to, suggests.
Do not invent citations; use [citation needed] for unsupported factual claims.
Do not write about outline labels such as Introduction plan, Topic sentence, Evidence to use, Analysis purpose, or Link back. Use them only to compose real paragraphs.
`,
    validationRules: [
      "Must be paragraph-like draft, not only bullets.",
      "Must not invent citations.",
      "Should include thesis and analysis labels.",
      "Must not contain template phrases such as 'The student should' or 'the strongest body paragraph should'.",
    ],
  },
  "4-5": {
    id: "4-5",
    fromModule: 4,
    toModule: 5,
    name: "Drafting -> Referencing / Citation Check",
    purpose: "Turn draft into a citation-aware source-integrity review.",
    courseLogic:
      "Module 5 focuses on plagiarism avoidance, ethical source use, paraphrasing/summarizing, in-text citations, and reference list entries. Every source needs both an in-text citation and a reference list entry.",
    inputContract: ["Topic", "Module 4 draft", "Annotations", "Patches", "Source notes if any"],
    outputContract: [
      "Preserved draft as much as possible",
      "Missing citation markers",
      "Existing citation recognition",
      "Reference list checklist",
      "Plagiarism/paraphrase risk notes when source notes are supplied",
      "Issue labels for unresolved citation problems",
    ],
    paragraphFormat: "Preserve draft paragraphs first, then add a clearly separated citation checklist/workbench section.",
    citationBehavior: "Treat in-text citation and reference list as two halves. Mark missing citations and missing source details; never fabricate references.",
    failureBehavior: "If citation data is missing, preserve the draft and append a checklist of unresolved source needs.",
    systemPrompt: `${SHARED_GENERATION_RULES}\nYou are EssayCraft's Module 4 to Module 5 generator. Review citation and source integrity.`,
    userPromptTemplate: `
Create Module 5: Referencing / Citation Check.
Preserve the user's draft as much as possible.
Identify evidence and factual claims that need citation.
Preserve existing in-text citations.
Insert [citation needed] where support is required but no source is provided.
Create a reference-list checklist: in-text citation present, matching reference entry present, missing source details.
Flag potential plagiarism/paraphrase risks only if source notes are supplied and wording appears too close.
Do not generate fake references.
`,
    validationRules: [
      "Must not fabricate reference list entries.",
      "Must mark unsupported evidence.",
      "Must mention both in-text citations and reference list checks.",
    ],
  },
  "5-6": {
    id: "5-6",
    fromModule: 5,
    toModule: 6,
    name: "Referencing / Citation Check -> Final Review / Export",
    purpose: "Create final review, editing/proofreading checklist, and export readiness.",
    courseLogic:
      "Module 6 separates editing from proofreading: content, structure, clarity, style, spelling, grammar, punctuation, formatting, citations, and references. A strong conclusion rephrases thesis, reviews main points, answers the so-what question, and avoids major new evidence.",
    inputContract: ["Topic", "Module 5 citation-aware draft", "Unresolved issues", "Patches"],
    outputContract: [
      "Final revised essay if safe",
      "Editing checklist",
      "Proofreading checklist",
      "Conclusion check",
      "Unresolved issues",
      "Export readiness status",
    ],
    paragraphFormat: "Use final essay paragraphs first, then editing/proofreading/conclusion checklist sections separated by blank lines.",
    citationBehavior: "Preserve unresolved citation issues; do not add unsupported evidence or fake references.",
    failureBehavior: "If unresolved citation issues remain, keep them visible and do not claim the essay is submission-ready.",
    systemPrompt: `${SHARED_GENERATION_RULES}\nYou are EssayCraft's Module 5 to Module 6 generator. Create final review and export-ready content.`,
    userPromptTemplate: `
Create Module 6: Final Review / Conclusion / Export.
Preserve the user's argument and do not add unsupported evidence.
Produce a final revised essay if enough information is available.
Add editing checklist: content, structure, clarity, style.
Add proofreading checklist: spelling, grammar, punctuation, formatting, citations, references.
Check conclusion: rephrased thesis, synthesis of main points, significance/so-what, no major new evidence.
Mark unresolved citation/source problems as issue.
Avoid generic concluding phrases when possible.
`,
    validationRules: [
      "Must include editing and proofreading checklists.",
      "Must not add unsupported evidence.",
      "Must flag unresolved citation problems.",
    ],
  },
};

export function getTransitionPrompt(fromModule: Exclude<ModuleNumber, 6>): ModuleTransitionPrompt {
  const id = `${fromModule}-${fromModule + 1}` as ModuleTransitionId;
  const prompt = MODULE_TRANSITION_PROMPTS[id];
  if (!prompt) {
    throw new Error(`No transition prompt configured for Module ${fromModule} -> Module ${fromModule + 1}`);
  }
  return prompt;
}
