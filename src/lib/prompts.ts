import type { AssistRequest, GenerateNextRequest, RefreshRequest, TranslateRequest } from "@/types/essaycraft";
import { relevantOpenNotesForAssist } from "@/lib/assistFallback";
import { getTransitionPrompt } from "@/lib/moduleTransitionPrompts";

export const COURSE_WORKFLOW_CONTEXT = `
EssayCraft is based on a six-module argumentative essay journey:
Module 1: define topic, question, position, thesis, and essay structure.
Module 2: brainstorm, plan arguments, gather/evaluate sources, summarize and paraphrase.
Module 3: turn the plan into an outline with introduction, body paragraph structure, topic sentences, evidence, analysis, counterargument, and conclusion.
Module 4: draft academic paragraphs with metadiscourse, signal devices, hedging/boosting, formal tone, and strong conclusion logic.
Module 5: check ethical source use, plagiarism risk, in-text citations, and reference-list needs.
Module 6: edit and proofread for content, structure, clarity, style, grammar, punctuation, formatting, citations, and final readiness.
`;

const LABEL_RULES = "background, thesis, evidence, analysis, counterargument, citation, conclusion, issue, plain";

export function buildRefreshMessages(input: RefreshRequest) {
  const openPatches = input.patches.filter((patch) => !patch.resolved && patch.status !== "resolved" && !patch.stale && patch.text.trim());
  const projectTitle = input.projectTitle || input.topic;
  if (openPatches.length) {
    const system = `You are EssayCraft's revision-note engine. Return strict json only.

Task:
Use the user's temporary revision notes as instructions to propose a revised version of the current module text.

Rules:
- Return a preview only; do not claim the text has already been applied.
- Preserve the student's topic, claim, paragraph breaks, and academic workflow module purpose.
- Do not invent citations, sources, authors, years, URLs, DOIs, or reference entries.
- Notes are instructions, not essay prose. Do not copy note text into the revised essay.
- Resolve only the notes whose instructions are reflected in proposedText.
- Also return proposedAnnotations over proposedText.
- proposedAnnotations must be sentence-level or short rhetorical-unit ranges, not whole paragraphs.
- Prefer one annotation per sentence. Split paragraphs that contain multiple rhetorical roles.
- Keep ordinary annotation ranges under 250 characters unless the range is a reference-list entry or a short deliberate quote.
- annotation.text must be an exact substring of proposedText.
- Output valid json matching this shape:
{"kind":"revision","annotations":[],"proposedText":"revised text","proposedAnnotations":[{"id":"a1","start":0,"end":20,"text":"exact substring","label":"background","confidence":0.9,"comment":"brief reason"}],"originalSummary":"one sentence summary","rationale":"one sentence rationale","patchResolutionPlan":["patch-id"],"globalFeedback":["short preview note"],"warnings":[]}

${COURSE_WORKFLOW_CONTEXT}`;

    const user = `Project title: ${projectTitle}
Topic/context: ${input.topic}
Current module: ${input.moduleNumber}

Current essay text:
${JSON.stringify(input.text)}

Temporary revision notes:
${JSON.stringify(openPatches, null, 2)}

Existing annotations:
${JSON.stringify(input.annotations, null, 2)}

User source cards:
${JSON.stringify(input.sources, null, 2)}

Return json only.`;

    return [
      { role: "system" as const, content: system },
      { role: "user" as const, content: user }
    ];
  }

  const system = `You are EssayCraft's academic writing annotation engine. Return strict json only.

Task:
Annotate the current module text by rhetorical function.

Allowed labels:
${LABEL_RULES}

Rules:
- Do not rewrite the user's text.
- Return annotations with start/end offsets over the exact input text.
- annotation.text must equal text.slice(start, end).
- Annotate sentences or short rhetorical units, not whole paragraphs.
- Prefer one annotation per sentence. A paragraph can contain background, evidence, citation, analysis, thesis, and conclusion labels.
- Keep ordinary annotation ranges under 250 characters unless the range is a reference-list entry or a short deliberate quote.
- Respect user patches when they are reasonable.
- Use issue when a factual/evidence claim appears to need a source but has no citation, or when the role is unclear.
- Use evidence for source-based facts, data, examples, findings, or source claims.
- Use analysis for reasoning, explanation, interpretation, or connecting evidence to thesis.
- Use thesis only for the main arguable position or thesis map.
- Use citation only when the range's primary function is a source signal/citation rather than evidence content.
- Never invent citations, authors, years, titles, journals, URLs, or DOIs.
- Output valid json matching this shape:
{"annotations":[{"id":"a1","start":0,"end":20,"text":"exact substring","label":"background","confidence":0.9,"comment":"brief reason"}],"globalFeedback":["one short comment"],"warnings":[]}

${COURSE_WORKFLOW_CONTEXT}`;

  const user = `Project title: ${projectTitle}
Topic/context: ${input.topic}
Current module: ${input.moduleNumber}

Full text:
${JSON.stringify(input.text)}

Existing annotations:
${JSON.stringify(input.annotations, null, 2)}

User patches:
${JSON.stringify(input.patches, null, 2)}

User source cards:
${JSON.stringify(input.sources, null, 2)}

Return json only.`;

  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user }
  ];
}

export function buildGenerateNextMessages(input: GenerateNextRequest) {
  const transition = getTransitionPrompt(input.sourceModuleNumber);

  const system = `${transition.systemPrompt}

Use this transition-specific purpose:
${transition.purpose}

Output contract:
${transition.outputContract.map((item) => `- ${item}`).join("\n")}

Paragraph format:
${transition.paragraphFormat}

Citation behavior:
${transition.citationBehavior}

Validation rules:
${transition.validationRules.map((item) => `- ${item}`).join("\n")}

Failure behavior:
${transition.failureBehavior}

Return json only. Required JSON shape:
{"moduleNumber":${transition.toModule},"title":"${transition.name}","text":"Paragraph 1...\\n\\nParagraph 2...","annotations":[{"id":"a1","start":0,"end":20,"text":"exact substring","label":"background","confidence":0.85,"comment":"brief reason"}],"sources":[],"globalFeedback":["short feedback"],"warnings":[]}`;

  const user = `Topic: ${input.topic}
Source module: ${input.sourceModuleNumber}
Target module: ${transition.toModule}
Source title: ${input.sourceTitle}

Source text:
${JSON.stringify(input.sourceText)}

Source annotations:
${JSON.stringify(input.sourceAnnotations, null, 2)}

Source patches:
${JSON.stringify(input.sourcePatches, null, 2)}

Source cards:
${JSON.stringify(input.sourceSources, null, 2)}

Teacher-editable transition instruction:
${transition.userPromptTemplate}

Return json only.`;

  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user }
  ];
}

export function buildAssistMessages(input: AssistRequest) {
  const isAnalyze = isAnalyzeAssistAction(input.action);
  const isEdit = Boolean(input.selectedRange) && !isAnalyze && isEditAssistAction(input.action);
  const isInspect = (/(explain|relabel|highlight|citation)/i.test(input.action) || isAnalyze) && !isEdit;
  const expectedKind = isEdit ? "edit" : isInspect ? "inspect" : "chat";
  const relevantNotes = relevantOpenNotesForAssist(input);
  const system = `You are EssayCraft's AI Assistant. Return strict json only.

Rules:
- Help the student understand and revise their own writing.
- Use kind "${expectedKind}" for this request.
- Chat responses are conversational module feedback. They must not include proposedText or replaceRange.
- Edit responses are selection previews. They must include proposedText and the exact selected replaceRange.
- Inspect responses explain a highlight/annotation. They must not include proposedText or replaceRange.
- Suggestions must be previewable; do not assume changes are applied.
- Prefer selected-range replacement. Do not replace the full module unless explicitly requested.
- Never invent citations or references. Use [citation needed] or source-search suggestions when sources are missing.
- If you propose text, preserve the student's stance and paragraph breaks.
- For normal student questions, answer the actual question about the current module and avoid generic capability text.
- Output valid json matching one of these shapes:
Chat: {"kind":"chat","reply":"human-readable module-level response","annotations":[],"warnings":[]}
Edit: {"kind":"edit","reply":"brief preview note","proposedText":"replacement text","replaceRange":{"start":0,"end":10},"originalExcerpt":"optional excerpt","annotations":[],"warnings":[]}
Inspect: {"kind":"inspect","reply":"highlight explanation","originalExcerpt":"optional excerpt","annotations":[],"warnings":[]}

${COURSE_WORKFLOW_CONTEXT}`;

  const projectTitle = input.projectTitle || input.topic;
  const user = `Project title: ${projectTitle}
Topic/context: ${input.topic}
Module ${input.moduleNumber}: ${input.moduleTitle}
Requested action: ${input.action}

Selected range: ${JSON.stringify(input.selectedRange ?? null)}
Selected text: ${JSON.stringify(input.selectedText ?? "")}
Notes inside selected/active range:
${JSON.stringify(input.selectedPatches ?? [], null, 2)}

Full module text:
${JSON.stringify(input.text)}

Annotations:
${JSON.stringify(input.annotations, null, 2)}

Patches:
${JSON.stringify(input.patches, null, 2)}

Relevant open notes for the submitted selection/module:
${JSON.stringify(relevantNotes, null, 2)}

Sources:
${JSON.stringify(input.sources, null, 2)}

Recent assistant history:
${JSON.stringify(input.history?.slice(-6) ?? [], null, 2)}

Return json only.`;

  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user }
  ];
}

function isAnalyzeAssistAction(action: string) {
  return /(analy[sz]e|critique|comment|grammar|\u5206\u6790|\u8bc4\u4ef7|\u70b9\u8bc4|\u7528\u4e2d\u6587)/i.test(action);
}

function isEditAssistAction(action: string) {
  return /(rewrite|academic|analysis|translate|revise|sentence|passage|formal|longer|shorter|natural|awkward|\u91cd\u5199|\u6539\u5199|\u66f4\u5b66\u672f|\u5b66\u672f|\u6b63\u5f0f|\u66f4\u957f|\u5199\u957f|\u66f4\u77ed|\u7b80\u77ed|\u81ea\u7136|\u5446\u677f|\u6839\u636e.*title|\u6839\u636e.*\u6807\u9898|project title)/i.test(action);
}

export function buildTranslateMessages(input: TranslateRequest) {
  const system = `You are EssayCraft's bilingual academic translation assistant. Return strict json only.

Rules:
- Translate between English and Chinese using mode ${input.mode}.
- Preserve academic meaning, citations, paragraph breaks, and bracketed placeholders such as [citation needed].
- Do not overwrite the original. Return preview JSON only.
- Never create new citations, authors, dates, or source details.
- Output valid json:
{"translatedText":"...","mode":"${input.mode}","annotations":[],"warnings":[]}`;

  const user = `Topic: ${input.topic}
Module: ${input.moduleNumber}
Selected range: ${JSON.stringify(input.selectedRange ?? null)}
Text to translate:
${JSON.stringify(input.text)}

Return json only.`;

  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user }
  ];
}
