import type { AssistRequest, GenerateNextRequest, RefreshRequest, TranslateRequest } from "@/types/essaycraft";
import { COURSE_WORKFLOW_CONTEXT } from "@/lib/prompts";

export function buildAssistContext(input: AssistRequest) {
  return {
    projectTitle: input.projectTitle || input.topic,
    currentModule: {
      number: input.moduleNumber,
      title: input.moduleTitle,
      purpose: COURSE_WORKFLOW_CONTEXT
    },
    cleanModuleText: input.text,
    selectedText: input.selectedText ?? "",
    selectedRange: input.selectedRange,
    notesInsideSelection: input.selectedPatches ?? [],
    openNotes: input.patches.filter((patch) => !patch.resolved && patch.status !== "resolved" && patch.text.trim()),
    sources: input.sources,
    recentChatHistory: input.history?.slice(-6) ?? [],
    userInstruction: input.action
  };
}

export function buildRefreshContext(input: RefreshRequest) {
  return {
    projectTitle: input.projectTitle || input.topic,
    currentModule: {
      number: input.moduleNumber,
      purpose: COURSE_WORKFLOW_CONTEXT
    },
    cleanModuleText: input.text,
    openNotes: input.patches.filter((patch) => !patch.resolved && patch.status !== "resolved" && patch.text.trim()),
    sources: input.sources,
    annotations: input.annotations
  };
}

export function buildGenerateContext(input: GenerateNextRequest) {
  return {
    projectTitle: input.topic,
    sourceModule: input.sourceModuleNumber,
    sourceTitle: input.sourceTitle,
    cleanSourceText: input.sourceText,
    sourceAnnotations: input.sourceAnnotations,
    openNotes: input.sourcePatches.filter((patch) => !patch.resolved && patch.status !== "resolved" && patch.text.trim()),
    sources: input.sourceSources,
    userInstruction: input.instruction ?? ""
  };
}

export function buildTranslateContext(input: TranslateRequest) {
  return {
    projectTitle: input.topic,
    currentModule: input.moduleNumber,
    selectedRange: input.selectedRange,
    textToTranslate: input.text,
    mode: input.mode
  };
}
