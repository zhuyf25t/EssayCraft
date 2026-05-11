import type { AssistRequest, GenerateNextRequest, RefreshRequest, TranslateRequest } from "@/types/essaycraft";
import { relevantOpenNotesForAssist } from "@/lib/assistFallback";
import { getTransitionPrompt } from "@/lib/moduleTransitionPrompts";
import { readPromptFile, renderPrompt } from "@/lib/promptFiles";

export const COURSE_WORKFLOW_CONTEXT = readPromptFile("shared/course-workflow.md");

const LABEL_RULES = "background, thesis, evidence, analysis, counterargument, citation, conclusion, issue, plain";

type RefreshUnitPromptItem = {
  index: number;
  start: number;
  end: number;
  text: string;
};

export function buildRefreshMessages(input: RefreshRequest) {
  const openPatches = input.patches.filter((patch) => !patch.resolved && patch.status !== "resolved" && !patch.stale && patch.text.trim());
  const projectTitle = input.projectTitle || input.topic;
  if (openPatches.length) {
    const system = renderPrompt(readPromptFile("refresh/revision-system.md"), {
      courseWorkflowContext: COURSE_WORKFLOW_CONTEXT
    });

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

  const system = renderPrompt(readPromptFile("refresh/range-annotation-system.md"), {
    labelRules: LABEL_RULES,
    courseWorkflowContext: COURSE_WORKFLOW_CONTEXT
  });

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

export function buildRefreshUnitMessages(input: RefreshRequest, units: RefreshUnitPromptItem[]) {
  const projectTitle = input.projectTitle || input.topic;
  const localInstruction = input.instruction?.trim();
  const requiredIndexes = units.map((unit) => unit.index);
  const system = renderPrompt(readPromptFile("refresh/unit-label-system.md"), {
    labelRules: LABEL_RULES,
    unitCount: units.length,
    requiredIndexes: requiredIndexes.join(", "),
    courseWorkflowContext: COURSE_WORKFLOW_CONTEXT
  });

  const user = `Project title: ${projectTitle}
Topic/context: ${input.topic}
Current module: ${input.moduleNumber}

Full essay context:
${JSON.stringify(input.text)}

${localInstruction ? `User local refresh note/correction:\n${JSON.stringify(localInstruction)}\n` : ""}

Sentence/rhetorical units to label:
${JSON.stringify(units, null, 2)}

Return json only with exactly ${units.length} unitLabels covering indexes ${requiredIndexes.join(", ")}.`;

  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user }
  ];
}

export function buildGenerateNextMessages(input: GenerateNextRequest) {
  const transition = getTransitionPrompt(input.sourceModuleNumber);
  const system = `${transition.systemPrompt}

${renderPrompt(readPromptFile("generate-next/system-suffix.md"), {
  transitionPurpose: transition.purpose,
  outputContract: transition.outputContract.map((item) => `- ${item}`).join("\n"),
  paragraphFormat: transition.paragraphFormat,
  citationBehavior: transition.citationBehavior,
  validationRules: transition.validationRules.map((item) => `- ${item}`).join("\n"),
  failureBehavior: transition.failureBehavior,
  targetModule: transition.toModule,
  transitionName: transition.name
})}`;

  const annotationRules = renderPrompt(readPromptFile("generate-next/annotation-rules.md"), {
    labelRules: LABEL_RULES
  });

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

User generation instruction from the Edit box:
${JSON.stringify(input.instruction?.trim() || "")}

Teacher-editable transition instruction:
${transition.userPromptTemplate}

${annotationRules}

Return json only.`;

  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user }
  ];
}

export function buildAssistMessages(input: AssistRequest) {
  const assistContext = buildAssistContextProfile(input);
  const relevantNotes = relevantOpenNotesForAssist(input);
  const system = renderPrompt(readPromptFile("assist/system.md"), {
    expectedKind: assistContext.expectedKind,
    courseWorkflowContext: COURSE_WORKFLOW_CONTEXT
  });

  const projectTitle = input.projectTitle || input.topic;
  const user = assistContext.expectedKind === "chat"
    ? buildChatUserPrompt(input, projectTitle, relevantNotes)
    : buildSelectionUserPrompt(input, projectTitle, relevantNotes, assistContext);

  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user }
  ];
}

type AssistContextProfile = {
  expectedKind: "chat" | "edit" | "inspect";
  profile: "chat-full-module" | "edit-selection" | "translation-selection" | "analysis-selection" | "highlight-explanation";
};

function buildAssistContextProfile(input: AssistRequest): AssistContextProfile {
  const isAnalyze = isAnalyzeAssistAction(input.action);
  const isTranslate = isTranslateAssistAction(input.action);
  const isHighlightExplain = isHighlightExplainAssistAction(input.action);
  const isEdit = Boolean(input.selectedRange) && !isAnalyze && !isTranslate && isEditAssistAction(input.action);
  if (isEdit) return { expectedKind: "edit", profile: "edit-selection" };
  if (isTranslate) return { expectedKind: "inspect", profile: "translation-selection" };
  if (isAnalyze) return { expectedKind: "inspect", profile: "analysis-selection" };
  if (isHighlightExplain) return { expectedKind: "inspect", profile: "highlight-explanation" };
  return { expectedKind: "chat", profile: "chat-full-module" };
}

function buildChatUserPrompt(input: AssistRequest, projectTitle: string, relevantNotes: AssistRequest["patches"]) {
  return `Project title: ${projectTitle}
Topic/context: ${input.topic}
Module ${input.moduleNumber}: ${input.moduleTitle}
Requested action: ${input.action}
Context profile: chat-full-module

Current module text:
${JSON.stringify(input.text)}

Selected/active context, if any:
${JSON.stringify(selectionPayload(input), null, 2)}

Annotation summary:
${JSON.stringify(annotationSummary(input.annotations), null, 2)}

Open notes summary:
${JSON.stringify(noteSummary(relevantNotes), null, 2)}

Source summary:
${JSON.stringify(sourceSummary(input.sources), null, 2)}

Recent assistant history:
${JSON.stringify(input.history?.slice(-6) ?? [], null, 2)}

Answer the user's actual chat message using the module text above. Do not return an edit preview. Return json only.`;
}

function buildSelectionUserPrompt(
  input: AssistRequest,
  projectTitle: string,
  relevantNotes: AssistRequest["patches"],
  assistContext: AssistContextProfile
) {
  const selectedRange = input.selectedRange ?? null;
  const selectedText = selectedRange ? input.text.slice(selectedRange.start, selectedRange.end) : input.selectedText ?? "";
  const surrounding = selectedRange ? surroundingParagraph(input.text, selectedRange) : "";
  const activeAnnotations = selectedRange ? annotationsForRange(input.annotations, selectedRange) : [];

  return `Project title: ${projectTitle}
Topic/context: ${input.topic}
Module ${input.moduleNumber}: ${input.moduleTitle}
Requested action: ${input.action}
Context profile: ${assistContext.profile}

Selected range:
${JSON.stringify(selectedRange)}

Selected clean text:
${JSON.stringify(selectedText)}

Surrounding paragraph/context:
${JSON.stringify(surrounding)}

Notes inside selected/active range, as instructions only:
${JSON.stringify(input.selectedPatches ?? relevantNotes, null, 2)}

Active highlight/annotation context:
${JSON.stringify(activeAnnotations, null, 2)}

Source summary:
${JSON.stringify(sourceSummary(input.sources), null, 2)}

${assistContext.profile === "translation-selection" ? translationCompletenessInstruction(selectedText) : assistContext.profile === "analysis-selection" ? analysisCompletenessInstruction(selectedText) : "The full module text is intentionally omitted for this local Edit action to reduce latency. Use the selected text, surrounding paragraph, project title, and user instruction above."}
Return json only.`;
}

function isAnalyzeAssistAction(action: string) {
  return /^(analy[sz]e|critique|comment|grammar|rhetorical role)\b/i.test(action);
}

function isTranslateAssistAction(action: string) {
  return /translate|\u7ffb\u8bd1|\u8bd1\u6210/i.test(action);
}

function isHighlightExplainAssistAction(action: string) {
  return /^(explain|highlight explanation|explain this highlight)\b/i.test(action);
}

function isEditAssistAction(action: string) {
  return /(rewrite|academic|revise|sentence|passage|formal|longer|shorter|natural|awkward|\u91cd\u5199|\u6539\u5199|\u66f4\u5b66\u672f|\u5b66\u672f|\u6b63\u5f0f|\u66f4\u957f|\u5199\u957f|\u66f4\u77ed|\u7b80\u77ed|\u81ea\u7136|\u5446\u677f|\u6839\u636e.*title|\u6839\u636e.*\u6807\u9898|project title)/i.test(action);
}

function selectionPayload(input: AssistRequest) {
  if (!input.selectedRange && !input.selectedText) return null;
  return {
    range: input.selectedRange ?? null,
    text: input.selectedText ?? "",
    notesInsideSelection: noteSummary(input.selectedPatches ?? [])
  };
}

function annotationSummary(annotations: AssistRequest["annotations"]) {
  const counts = annotations.reduce<Record<string, number>>((acc, annotation) => {
    acc[annotation.label] = (acc[annotation.label] ?? 0) + 1;
    return acc;
  }, {});
  return {
    count: annotations.length,
    labels: counts,
    examples: annotations.slice(0, 8).map((annotation) => ({
      label: annotation.label,
      excerpt: compactPromptText(annotation.text, 140),
      comment: compactPromptText(annotation.comment ?? "", 140)
    }))
  };
}

function noteSummary(patches: AssistRequest["patches"]) {
  return patches
    .filter((patch) => !patch.resolved && patch.status !== "resolved" && !patch.stale && patch.text.trim())
    .slice(0, 8)
    .map((patch) => ({
      id: patch.id,
      anchorStart: patch.anchorStart,
      anchorEnd: patch.anchorEnd,
      anchorExcerpt: compactPromptText(patch.anchorQuote, 120),
      note: patch.text
    }));
}

function sourceSummary(sources: AssistRequest["sources"]) {
  return {
    total: sources.length,
    real: sources.filter((source) => !source.placeholder).length,
    placeholders: sources.filter((source) => source.placeholder).length,
    examples: sources.slice(0, 5).map((source) => ({
      title: source.title || "Untitled source",
      authors: source.authors?.slice(0, 3) ?? [],
      year: source.year ?? "",
      type: source.sourceType ?? "unknown",
      verified: Boolean(source.verified),
      placeholder: Boolean(source.placeholder)
    }))
  };
}

function annotationsForRange(annotations: AssistRequest["annotations"], range: { start: number; end: number }) {
  return annotations
    .filter((annotation) => annotation.start < range.end && range.start < annotation.end)
    .slice(0, 8)
    .map((annotation) => ({
      label: annotation.label,
      range: { start: annotation.start, end: annotation.end },
      text: annotation.text,
      comment: annotation.comment ?? ""
    }));
}

function surroundingParagraph(text: string, range: { start: number; end: number }) {
  const start = Math.max(0, Math.min(text.length, range.start));
  const end = Math.max(start, Math.min(text.length, range.end));
  const beforeBreak = text.lastIndexOf("\n\n", start);
  const afterBreak = text.indexOf("\n\n", end);
  const paragraphStart = beforeBreak >= 0 ? beforeBreak + 2 : 0;
  const paragraphEnd = afterBreak >= 0 ? afterBreak : text.length;
  const paragraph = text.slice(paragraphStart, paragraphEnd).trim();
  if (paragraph.length <= 1400) return paragraph;
  const selected = text.slice(start, end);
  const localStart = Math.max(0, start - paragraphStart - 450);
  const localEnd = Math.min(paragraph.length, end - paragraphStart + 450);
  return `${paragraph.slice(localStart, start - paragraphStart)}[[selection]]${selected}[[/selection]]${paragraph.slice(end - paragraphStart, localEnd)}`.trim();
}

function compactPromptText(value: string, limit: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, Math.max(0, limit - 24))} ... ${normalized.slice(-18)}`;
}

function translationCompletenessInstruction(selectedText: string) {
  const paragraphs = selectedText.split(/\n\s*\n/).filter((part) => part.trim()).length;
  const lines = selectedText.split(/\n/).filter((part) => part.trim()).length;
  return `Translate the complete Selected clean text above. The selection has ${selectedText.length} characters, ${Math.max(1, paragraphs)} paragraph block(s), and ${Math.max(1, lines)} non-empty line(s). The reply field must contain the full translation only, preserving paragraph breaks and list order. Do not summarize, skip later sentences, or ask for a target language.`;
}

function analysisCompletenessInstruction(selectedText: string) {
  const paragraphs = selectedText.split(/\n\s*\n/).filter((part) => part.trim()).length;
  const lines = selectedText.split(/\n/).filter((part) => part.trim()).length;
  return `Analyze the complete Selected clean text above. The selection has ${selectedText.length} characters, ${Math.max(1, paragraphs)} paragraph block(s), and ${Math.max(1, lines)} non-empty line(s). If the user asks for a general evaluation, comment on the whole selection's role, structure, strengths, and issues. Do not analyze only the first sentence unless the selection is only one sentence.`;
}

export function buildTranslateMessages(input: TranslateRequest) {
  const system = renderPrompt(readPromptFile("translate/system.md"), {
    mode: input.mode
  });

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
