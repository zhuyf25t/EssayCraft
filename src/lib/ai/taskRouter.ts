import "server-only";

import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { z } from "zod";
import {
  addAiMetadata,
  aiMetadata,
  AI_MOCK_MODEL,
  createAiClient,
  fallbackReasonFromError,
  forceMockEnabled,
  hasAiKey,
  withAiTimeout
} from "@/lib/ai-client";
import { AI_TASKS, type AiTaskType } from "@/lib/ai/tasks";

export type AiTaskResult<T> = T & {
  providerMode: "deepseek" | "mock" | "unavailable";
  modelUsed: string;
  latencyMs: number;
  totalTokens?: number;
  fallbackReason?: string;
};

export class AiUnavailableError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = "AiUnavailableError";
    this.reason = reason;
  }
}

type RunJsonAiTaskOptions<TRaw, TOutput extends object> = {
  taskType: AiTaskType;
  messages: ChatCompletionMessageParam[];
  schema: z.ZodType<TRaw>;
  mock: () => TOutput;
  unavailable: (reason: string) => TOutput;
  parseProvider: (raw: TRaw) => TOutput;
  maxTokens?: number;
  temperature?: number;
};

export async function runJsonAiTask<TRaw, TOutput extends object>({
  taskType,
  messages,
  schema,
  mock,
  unavailable,
  parseProvider,
  maxTokens = 4096,
  temperature = 0.2
}: RunJsonAiTaskOptions<TRaw, TOutput>): Promise<AiTaskResult<TOutput>> {
  const startedAt = performance.now();
  const task = AI_TASKS[taskType];

  if (forceMockEnabled()) {
    return addAiMetadata(mock(), aiMetadata(startedAt, "mock", AI_MOCK_MODEL, "forced-mock")) as AiTaskResult<TOutput>;
  }

  if (!hasAiKey()) {
    return unavailableResult(unavailable, startedAt, "missing-api-key");
  }

  try {
    const client = createAiClient(task.timeoutMs);
    const completion = await requestJsonText(client, messages, task.model, task.timeoutMs, maxTokens, temperature);
    try {
      return addAiMetadata(
        parseProvider(schema.parse(JSON.parse(completion.raw))),
        aiMetadata(startedAt, "deepseek", task.model, undefined, completion.totalTokens)
      ) as AiTaskResult<TOutput>;
    } catch (parseError) {
      if (!task.retryInvalidJson) throw parseError;
      const repaired = await requestJsonText(
        client,
        buildRepairMessages(completion.raw, parseError, messages),
        task.model,
        task.timeoutMs,
        maxTokens,
        0
      );
      return addAiMetadata(
        parseProvider(schema.parse(JSON.parse(repaired.raw))),
        aiMetadata(startedAt, "deepseek", task.model, undefined, completion.totalTokens + repaired.totalTokens)
      ) as AiTaskResult<TOutput>;
    }
  } catch (error) {
    console.warn(`AI task ${taskType} unavailable:`, error);
    return unavailableResult(unavailable, startedAt, fallbackReasonFromError(error, task.model));
  }
}

export function unavailableResult<TOutput extends object>(
  unavailable: (reason: string) => TOutput,
  startedAt: number,
  reason: string
): AiTaskResult<TOutput> {
  return addAiMetadata(
    unavailable(reason),
    aiMetadata(startedAt, "unavailable", "none", reason)
  ) as AiTaskResult<TOutput>;
}

async function requestJsonText(
  client: ReturnType<typeof createAiClient>,
  messages: ChatCompletionMessageParam[],
  model: string,
  timeoutMs: number,
  maxTokens: number,
  temperature: number
) {
  const completion = await withAiTimeout(
    client.chat.completions.create({
      model,
      messages,
      response_format: { type: "json_object" },
      max_tokens: maxTokens,
      temperature
    }),
    timeoutMs
  );
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("AI returned empty content.");
  return {
    raw,
    totalTokens: completion.usage?.total_tokens ?? 0
  };
}

function buildRepairMessages(
  raw: string,
  parseError: unknown,
  originalMessages: ChatCompletionMessageParam[]
): ChatCompletionMessageParam[] {
  const message = parseError instanceof Error ? parseError.message : "Invalid JSON response.";
  return [
    {
      role: "system",
      content: "Repair the assistant output into valid JSON matching the requested schema and validation rules. Use the original task context to fix exact text ranges, missing required fields, and invalid labels. Return JSON only. Do not add prose."
    },
    {
      role: "user",
      content: `Schema/validation error:\n${message}\n\nOriginal task context:\n${serializeMessagesForRepair(originalMessages)}\n\nOriginal output:\n${raw}`
    }
  ];
}

function serializeMessagesForRepair(messages: ChatCompletionMessageParam[]) {
  return messages
    .map((item) => `${item.role.toUpperCase()}:\n${typeof item.content === "string" ? item.content : JSON.stringify(item.content)}`)
    .join("\n\n---\n\n");
}
