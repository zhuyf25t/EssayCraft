import type { GenerateNextRequest, RefreshRequest } from "@/types/essaycraft";

export const COURSE_WORKFLOW_CONTEXT = `
EssayCraft is based on a six-module argumentative essay journey:
Module 1: define topic, question, position, thesis, and essay structure.
Module 2: brainstorm, plan arguments, gather/evaluate sources, summarize and paraphrase.
Module 3: turn the plan into an outline with introduction, body paragraph structure, topic sentences, evidence, analysis, counterargument, and conclusion.
Module 4: draft academic paragraphs with metadiscourse, signal devices, hedging/boosting, formal tone, and strong conclusion logic.
Module 5: check ethical source use, plagiarism risk, in-text citations, and reference-list needs.
Module 6: edit and proofread for content, structure, clarity, style, grammar, punctuation, formatting, citations, and final readiness.
`;

export function buildRefreshMessages(input: RefreshRequest) {
  const system = `You are EssayCraft's academic writing annotation engine. Return strict json only.

Task:
Classify each sentence segment by rhetorical function.

Allowed labels:
background, thesis, evidence, analysis, counterargument, citation, conclusion, issue, plain.

Rules:
- Do not rewrite the user's text.
- Do not merge, split, or remove segments.
- Return exactly one label for every input segment id.
- Respect user patches when they are reasonable.
- Use issue when a factual/evidence claim appears to need a source but has no citation, or when the role is unclear.
- Use evidence for source-based facts, data, examples, findings, or source claims.
- Use analysis for reasoning, explanation, interpretation, or connecting evidence to thesis.
- Use thesis only for the main arguable position or thesis map.
- Use citation only when the segment's primary function is a source signal/citation rather than evidence content.
- Include brief aiComment fields when helpful.
- Output valid json matching this shape:
{"segments":[{"id":"s1","label":"background","confidence":0.9,"aiComment":"brief reason"}],"globalFeedback":["one short comment"]}

${COURSE_WORKFLOW_CONTEXT}`;

  const user = `Topic: ${input.topic}
Current module: ${input.moduleNumber}

Segments:
${JSON.stringify(input.segments.map(({ id, text, label }) => ({ id, text, currentLabel: label })), null, 2)}

User patches:
${JSON.stringify(input.patches.map(({ segmentId, text }) => ({ segmentId, text })), null, 2)}

Return json only.`;

  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user }
  ];
}

export function buildGenerateNextMessages(input: GenerateNextRequest) {
  const target = Math.min(6, input.sourceModuleNumber + 1);

  const system = `You are EssayCraft's academic writing workflow generator. Return strict json only.

Task:
Generate Module ${target} from Module ${input.sourceModuleNumber}.

Rules:
- Preserve the user's topic, position, and existing useful wording.
- Never invent specific sources, authors, years, statistics, DOIs, or citations that are not provided by the user.
- If evidence is needed but missing, write [citation needed] in the text and label the segment as issue or evidence depending on the function.
- Output sentence-level segments.
- Each segment must have id, text, label, confidence, and optional aiComment.
- Use labels from: background, thesis, evidence, analysis, counterargument, citation, conclusion, issue, plain.
- Return json matching this shape:
{"targetModuleNumber":2,"segments":[{"id":"gen-1","text":"...","label":"background","confidence":0.85,"aiComment":"..."}],"summary":"short description of what changed"}

Module expectations:
- 1 to 2: produce a planning/research map with argument branches, evidence needs, and source questions.
- 2 to 3: produce an outline with introduction, body paragraph structure, counterargument, and conclusion plan.
- 3 to 4: produce a coherent academic draft.
- 4 to 5: produce citation/referencing review notes and mark missing citation needs.
- 5 to 6: produce final revision/editing checklist and a polished final draft if enough text exists.

${COURSE_WORKFLOW_CONTEXT}`;

  const user = `Topic: ${input.topic}
Source module: ${input.sourceModuleNumber}
Target module: ${target}

Source segments:
${JSON.stringify(input.sourceSegments.map(({ id, text, label }) => ({ id, text, label })), null, 2)}

Source patches:
${JSON.stringify(input.sourcePatches.map(({ segmentId, text }) => ({ segmentId, text })), null, 2)}

Return json only.`;

  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user }
  ];
}
