import {
  AI_FAST_MODEL,
  AI_MODEL,
  CHAT_TIMEOUT_MS,
  EDIT_TIMEOUT_MS,
  GENERATE_TIMEOUT_MS,
  REFRESH_TIMEOUT_MS,
  TRANSLATE_TIMEOUT_MS,
  readAiRuntimeTimeout
} from "@/lib/ai-client";

export type AiTaskType =
  | "chatModule"
  | "rewriteSelection"
  | "academicRewrite"
  | "analyzeSelection"
  | "translateSelection"
  | "explainHighlight"
  | "refreshAnnotations"
  | "applyNotesRevision"
  | "generateNextModule"
  | "citationReview"
  | "finalReview";

export type AiTaskConfig = {
  id: AiTaskType;
  purpose: string;
  timeoutMs: number;
  model: string;
  retryInvalidJson: boolean;
};

export const AI_TASKS: Record<AiTaskType, AiTaskConfig> = {
  chatModule: {
    id: "chatModule",
    purpose: "Discuss the current module using project and module context.",
    timeoutMs: readAiRuntimeTimeout("chatModule", CHAT_TIMEOUT_MS),
    model: AI_FAST_MODEL,
    retryInvalidJson: true
  },
  rewriteSelection: {
    id: "rewriteSelection",
    purpose: "Rewrite only the submitted selection using the user's instruction.",
    timeoutMs: readAiRuntimeTimeout("rewriteSelection", EDIT_TIMEOUT_MS),
    model: AI_FAST_MODEL,
    retryInvalidJson: true
  },
  academicRewrite: {
    id: "academicRewrite",
    purpose: "Make only the submitted selection more academic while preserving meaning.",
    timeoutMs: readAiRuntimeTimeout("academicRewrite", EDIT_TIMEOUT_MS),
    model: AI_FAST_MODEL,
    retryInvalidJson: true
  },
  analyzeSelection: {
    id: "analyzeSelection",
    purpose: "Give read-only analysis of selected or active text.",
    timeoutMs: readAiRuntimeTimeout("analyzeSelection", EDIT_TIMEOUT_MS),
    model: AI_FAST_MODEL,
    retryInvalidJson: true
  },
  translateSelection: {
    id: "translateSelection",
    purpose: "Translate selected or active text as a read-only preview.",
    timeoutMs: readAiRuntimeTimeout("translateSelection", TRANSLATE_TIMEOUT_MS),
    model: AI_FAST_MODEL,
    retryInvalidJson: true
  },
  explainHighlight: {
    id: "explainHighlight",
    purpose: "Explain why the active highlighted range has its label.",
    timeoutMs: readAiRuntimeTimeout("explainHighlight", EDIT_TIMEOUT_MS),
    model: AI_FAST_MODEL,
    retryInvalidJson: true
  },
  refreshAnnotations: {
    id: "refreshAnnotations",
    purpose: "Annotate current text by rhetorical function without rewriting it.",
    timeoutMs: readAiRuntimeTimeout("refreshAnnotations", REFRESH_TIMEOUT_MS),
    model: AI_FAST_MODEL,
    retryInvalidJson: true
  },
  applyNotesRevision: {
    id: "applyNotesRevision",
    purpose: "Use user notes as instructions to propose a clean-text revision preview.",
    timeoutMs: readAiRuntimeTimeout("applyNotesRevision", REFRESH_TIMEOUT_MS),
    model: AI_FAST_MODEL,
    retryInvalidJson: true
  },
  generateNextModule: {
    id: "generateNextModule",
    purpose: "Generate the next course module from the current module.",
    timeoutMs: readAiRuntimeTimeout("generateNextModule", GENERATE_TIMEOUT_MS),
    model: AI_MODEL,
    retryInvalidJson: true
  },
  citationReview: {
    id: "citationReview",
    purpose: "Review source use, citation gaps, in-text citations, and reference-list readiness.",
    timeoutMs: readAiRuntimeTimeout("citationReview", REFRESH_TIMEOUT_MS),
    model: AI_FAST_MODEL,
    retryInvalidJson: true
  },
  finalReview: {
    id: "finalReview",
    purpose: "Review final essay content, structure, clarity, style, proofreading, citations, and conclusion.",
    timeoutMs: readAiRuntimeTimeout("finalReview", REFRESH_TIMEOUT_MS),
    model: AI_FAST_MODEL,
    retryInvalidJson: true
  }
};
