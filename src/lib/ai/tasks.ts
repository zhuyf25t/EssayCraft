import {
  AI_FAST_MODEL,
  AI_MODEL,
  CHAT_TIMEOUT_MS,
  EDIT_TIMEOUT_MS,
  GENERATE_TIMEOUT_MS,
  REFRESH_TIMEOUT_MS,
  TRANSLATE_TIMEOUT_MS
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
    timeoutMs: CHAT_TIMEOUT_MS,
    model: AI_FAST_MODEL,
    retryInvalidJson: true
  },
  rewriteSelection: {
    id: "rewriteSelection",
    purpose: "Rewrite only the submitted selection using the user's instruction.",
    timeoutMs: EDIT_TIMEOUT_MS,
    model: AI_FAST_MODEL,
    retryInvalidJson: true
  },
  academicRewrite: {
    id: "academicRewrite",
    purpose: "Make only the submitted selection more academic while preserving meaning.",
    timeoutMs: EDIT_TIMEOUT_MS,
    model: AI_FAST_MODEL,
    retryInvalidJson: true
  },
  analyzeSelection: {
    id: "analyzeSelection",
    purpose: "Give read-only analysis of selected or active text.",
    timeoutMs: EDIT_TIMEOUT_MS,
    model: AI_FAST_MODEL,
    retryInvalidJson: true
  },
  translateSelection: {
    id: "translateSelection",
    purpose: "Translate selected or active text as a read-only preview.",
    timeoutMs: TRANSLATE_TIMEOUT_MS,
    model: AI_FAST_MODEL,
    retryInvalidJson: true
  },
  explainHighlight: {
    id: "explainHighlight",
    purpose: "Explain why the active highlighted range has its label.",
    timeoutMs: EDIT_TIMEOUT_MS,
    model: AI_FAST_MODEL,
    retryInvalidJson: true
  },
  refreshAnnotations: {
    id: "refreshAnnotations",
    purpose: "Annotate current text by rhetorical function without rewriting it.",
    timeoutMs: REFRESH_TIMEOUT_MS,
    model: AI_FAST_MODEL,
    retryInvalidJson: true
  },
  applyNotesRevision: {
    id: "applyNotesRevision",
    purpose: "Use user notes as instructions to propose a clean-text revision preview.",
    timeoutMs: REFRESH_TIMEOUT_MS,
    model: AI_FAST_MODEL,
    retryInvalidJson: true
  },
  generateNextModule: {
    id: "generateNextModule",
    purpose: "Generate the next course module from the current module.",
    timeoutMs: GENERATE_TIMEOUT_MS,
    model: AI_MODEL,
    retryInvalidJson: true
  },
  citationReview: {
    id: "citationReview",
    purpose: "Review source use, citation gaps, in-text citations, and reference-list readiness.",
    timeoutMs: REFRESH_TIMEOUT_MS,
    model: AI_FAST_MODEL,
    retryInvalidJson: true
  },
  finalReview: {
    id: "finalReview",
    purpose: "Review final essay content, structure, clarity, style, proofreading, citations, and conclusion.",
    timeoutMs: REFRESH_TIMEOUT_MS,
    model: AI_FAST_MODEL,
    retryInvalidJson: true
  }
};

