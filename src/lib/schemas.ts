import { z } from "zod";

export const moduleNumberSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6)
]);

export const sourceModuleNumberSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);

export const targetModuleNumberSchema = z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]);

export const segmentLabelSchema = z.enum([
  "background",
  "thesis",
  "evidence",
  "analysis",
  "counterargument",
  "citation",
  "conclusion",
  "issue",
  "plain"
]);

export const providerModeSchema = z.preprocess(
  (value) => value === "fallback" ? "unavailable" : value,
  z.enum(["deepseek", "mock", "unavailable"])
);

export const rangeSchema = z
  .object({
    start: z.number().int().min(0),
    end: z.number().int().min(0)
  })
  .refine((range) => range.end >= range.start, "Range end must be greater than or equal to start.");

export const annotationSchema = z.object({
  id: z.string(),
  start: z.number().int().min(0),
  end: z.number().int().min(0),
  text: z.string(),
  label: segmentLabelSchema,
  confidence: z.number().min(0).max(1).optional(),
  comment: z.string().optional(),
  sourceIds: z.array(z.string()).optional()
});

export const patchSchema = z.object({
  id: z.string(),
  moduleNumber: moduleNumberSchema.optional(),
  anchorStart: z.number().int().min(0),
  anchorEnd: z.number().int().min(0),
  anchorQuote: z.string(),
  text: z.string(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  appliedAt: z.string().optional(),
  status: z.enum(["open", "resolved"]).optional(),
  resolved: z.boolean().optional(),
  stale: z.boolean().optional()
});

export const sourceCardSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  authors: z.array(z.string()).optional(),
  year: z.string().optional(),
  containerTitle: z.string().optional(),
  publisher: z.string().optional(),
  doi: z.string().optional(),
  url: z.string().optional(),
  sourceType: z.enum(["scholarly", "professional", "government", "popular", "social", "unknown"]).optional(),
  cars: z.object({
    credible: z.boolean().optional(),
    accurate: z.boolean().optional(),
    reasonable: z.boolean().optional(),
    support: z.boolean().optional()
  }).optional(),
  credibilityNotes: z.string().optional(),
  userNotes: z.string().optional(),
  verified: z.boolean().optional(),
  placeholder: z.boolean().optional(),
  createdAt: z.string()
});

export const refreshRequestSchema = z.object({
  topic: z.string(),
  projectTitle: z.string().optional(),
  moduleNumber: moduleNumberSchema,
  text: z.string(),
  annotations: z.array(annotationSchema).default([]),
  patches: z.array(patchSchema).default([]),
  sources: z.array(sourceCardSchema).default([])
});

export const refreshResponseSchema = z.object({
  kind: z.enum(["annotations", "revision", "moduleReview"]).optional(),
  annotations: z.array(annotationSchema),
  proposedText: z.string().optional(),
  sourceText: z.string().optional(),
  proposedAnnotations: z.array(annotationSchema).optional(),
  originalSummary: z.string().optional(),
  rationale: z.string().optional(),
  patchResolutionPlan: z.array(z.string()).optional(),
  reviewSummary: z.string().optional(),
  reviewChecklist: z.array(z.object({
    label: z.string(),
    status: z.enum(["ready", "review", "issue"]),
    detail: z.string()
  })).optional(),
  reviewSuggestions: z.array(z.string()).optional(),
  issueCount: z.number().int().min(0).optional(),
  citationGaps: z.number().int().min(0).optional(),
  inTextCitations: z.number().int().min(0).optional(),
  realSourceCards: z.number().int().min(0).optional(),
  referenceStatus: z.string().optional(),
  nextStep: z.string().optional(),
  providerMode: providerModeSchema.optional(),
  modelUsed: z.string().optional(),
  latencyMs: z.number().int().min(0).optional(),
  fallbackReason: z.string().optional(),
  globalFeedback: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([])
});

export const refreshUnitResponseSchema = refreshResponseSchema.omit({
  annotations: true,
  proposedAnnotations: true
}).extend({
  unitLabels: z.array(z.object({
    index: z.number().int().min(0),
    label: segmentLabelSchema,
    confidence: z.number().min(0).max(1).optional(),
    comment: z.string().optional()
  }))
});

export const generateNextRequestSchema = z.object({
  topic: z.string(),
  sourceModuleNumber: sourceModuleNumberSchema,
  sourceTitle: z.string(),
  sourceText: z.string(),
  sourceAnnotations: z.array(annotationSchema).default([]),
  sourcePatches: z.array(patchSchema).default([]),
  sourceSources: z.array(sourceCardSchema).default([])
});

export const generateNextResponseSchema = z.object({
  moduleNumber: targetModuleNumberSchema,
  title: z.string(),
  text: z.string().min(1),
  annotations: z.array(annotationSchema).default([]),
  sources: z.array(sourceCardSchema).default([]),
  globalFeedback: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  providerMode: providerModeSchema.default("deepseek"),
  modelUsed: z.string().optional(),
  latencyMs: z.number().int().min(0).optional(),
  fallbackReason: z.string().optional()
});

export const assistantMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  text: z.string(),
  createdAt: z.string(),
  providerMode: providerModeSchema.optional(),
  warnings: z.array(z.string()).optional()
});

export const assistRequestSchema = z.object({
  topic: z.string(),
  projectTitle: z.string().optional(),
  moduleNumber: moduleNumberSchema,
  moduleTitle: z.string(),
  text: z.string(),
  annotations: z.array(annotationSchema).default([]),
  patches: z.array(patchSchema).default([]),
  sources: z.array(sourceCardSchema).default([]),
  selectedRange: rangeSchema.optional(),
  selectedText: z.string().optional(),
  selectedPatches: z.array(patchSchema).default([]),
  action: z.string(),
  history: z.array(assistantMessageSchema).default([])
});

const nullableString = z.preprocess((value) => value === null ? undefined : value, z.string().optional());
const nullableRange = z.preprocess((value) => value === null ? undefined : value, rangeSchema.optional());

export const assistResponseSchema = z.object({
  kind: z.enum(["chat", "edit", "inspect"]).optional(),
  reply: z.string(),
  title: nullableString,
  actionType: nullableString,
  originalExcerpt: nullableString,
  explanation: nullableString,
  providerMode: providerModeSchema.optional(),
  modelUsed: z.string().optional(),
  latencyMs: z.number().int().min(0).optional(),
  fallbackReason: z.string().optional(),
  proposedText: nullableString,
  replaceRange: nullableRange,
  originalText: nullableString,
  annotations: z.array(annotationSchema).default([]),
  warnings: z.array(z.string()).default([])
});

export const translateRequestSchema = z.object({
  topic: z.string(),
  moduleNumber: moduleNumberSchema,
  text: z.string(),
  selectedRange: rangeSchema.optional(),
  mode: z.enum(["en-to-zh", "zh-to-en", "auto-to-zh"])
});

export const translateResponseSchema = z.object({
  translatedText: z.string(),
  mode: z.enum(["en-to-zh", "zh-to-en", "auto-to-zh"]),
  annotations: z.array(annotationSchema).default([]),
  warnings: z.array(z.string()).default([]),
  providerMode: providerModeSchema.default("deepseek"),
  modelUsed: z.string().optional(),
  latencyMs: z.number().int().min(0).optional(),
  fallbackReason: z.string().optional()
});
