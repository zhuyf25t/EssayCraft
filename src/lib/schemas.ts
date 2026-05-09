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
  anchorStart: z.number().int().min(0),
  anchorEnd: z.number().int().min(0),
  anchorQuote: z.string(),
  text: z.string(),
  createdAt: z.string(),
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
  moduleNumber: moduleNumberSchema,
  text: z.string(),
  annotations: z.array(annotationSchema).default([]),
  patches: z.array(patchSchema).default([]),
  sources: z.array(sourceCardSchema).default([])
});

export const refreshResponseSchema = z.object({
  annotations: z.array(annotationSchema),
  globalFeedback: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([])
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
  providerMode: z.enum(["deepseek", "mock", "fallback"]).default("deepseek")
});

export const assistantMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  text: z.string(),
  createdAt: z.string()
});

export const assistRequestSchema = z.object({
  topic: z.string(),
  moduleNumber: moduleNumberSchema,
  moduleTitle: z.string(),
  text: z.string(),
  annotations: z.array(annotationSchema).default([]),
  patches: z.array(patchSchema).default([]),
  sources: z.array(sourceCardSchema).default([]),
  selectedRange: rangeSchema.optional(),
  selectedText: z.string().optional(),
  action: z.string(),
  history: z.array(assistantMessageSchema).default([])
});

export const assistResponseSchema = z.object({
  reply: z.string(),
  title: z.string().optional(),
  actionType: z.string().optional(),
  originalExcerpt: z.string().optional(),
  explanation: z.string().optional(),
  providerMode: z.enum(["deepseek", "mock", "fallback"]).optional(),
  proposedText: z.string().optional(),
  replaceRange: rangeSchema.optional(),
  originalText: z.string().optional(),
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
  providerMode: z.enum(["deepseek", "mock", "fallback"]).default("deepseek")
});
