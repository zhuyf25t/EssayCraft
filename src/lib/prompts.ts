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
  const isAnalyze = isAnalyzeAssistAction(input.action);
  const isTranslate = isTranslateAssistAction(input.action);
  const isEdit = Boolean(input.selectedRange) && !isAnalyze && !isTranslate && isEditAssistAction(input.action);
  const isInspect = (/(explain|relabel|highlight|citation)/i.test(input.action) || isAnalyze || isTranslate) && !isEdit;
  const expectedKind = isEdit ? "edit" : isInspect ? "inspect" : "chat";
  const relevantNotes = relevantOpenNotesForAssist(input);
  const system = renderPrompt(readPromptFile("assist/system.md"), {
    expectedKind,
    courseWorkflowContext: COURSE_WORKFLOW_CONTEXT
  });

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

function isTranslateAssistAction(action: string) {
  return /translate|\u7ffb\u8bd1|\u8bd1\u6210/i.test(action);
}

function isEditAssistAction(action: string) {
  return /(rewrite|academic|revise|sentence|passage|formal|longer|shorter|natural|awkward|\u91cd\u5199|\u6539\u5199|\u66f4\u5b66\u672f|\u5b66\u672f|\u6b63\u5f0f|\u66f4\u957f|\u5199\u957f|\u66f4\u77ed|\u7b80\u77ed|\u81ea\u7136|\u5446\u677f|\u6839\u636e.*title|\u6839\u636e.*\u6807\u9898|project title)/i.test(action);
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
