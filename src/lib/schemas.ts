import { z } from "zod";

export const moduleNumberSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6)
]);

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

export const segmentSchema = z.object({
  id: z.string(),
  text: z.string(),
  label: segmentLabelSchema,
  confidence: z.number().min(0).max(1).optional(),
  aiComment: z.string().optional()
});

export const patchSchema = z.object({
  id: z.string(),
  segmentId: z.string(),
  text: z.string(),
  createdAt: z.string(),
  resolved: z.boolean().optional()
});

export const refreshRequestSchema = z.object({
  topic: z.string(),
  moduleNumber: moduleNumberSchema,
  segments: z.array(segmentSchema),
  patches: z.array(patchSchema)
});

export const refreshResponseSchema = z.object({
  segments: z.array(
    z.object({
      id: z.string(),
      label: segmentLabelSchema,
      confidence: z.number().min(0).max(1).optional(),
      aiComment: z.string().optional()
    })
  ),
  globalFeedback: z.array(z.string()).default([])
});

export const generateNextRequestSchema = z.object({
  topic: z.string(),
  sourceModuleNumber: moduleNumberSchema,
  sourceSegments: z.array(segmentSchema),
  sourcePatches: z.array(patchSchema)
});

export const generateNextResponseSchema = z.object({
  targetModuleNumber: moduleNumberSchema,
  segments: z.array(segmentSchema),
  summary: z.string().default("")
});
