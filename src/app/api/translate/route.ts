import { NextResponse } from "next/server";
import type { TranslateRequest, TranslateResponse } from "@/types/essaycraft";
import { createAiClient, AI_FAST_MODEL, hasAiKey, withAiTimeout } from "@/lib/ai-client";
import { buildMockAnnotations, exactAnnotations, normalizeAnnotations } from "@/lib/annotations";
import { buildTranslateMessages } from "@/lib/prompts";
import { translateRequestSchema, translateResponseSchema } from "@/lib/schemas";
import { cleanGeneratedText } from "@/lib/textFormat";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const input = translateRequestSchema.parse(json);
    const textToTranslate = selectedText(input.text, input.selectedRange);
    const scopedInput = { ...input, text: textToTranslate, selectedRange: undefined };

    if (!hasAiKey()) {
      return NextResponse.json(mockTranslate(scopedInput));
    }

    try {
      const client = createAiClient();
      const completion = await withAiTimeout(client.chat.completions.create({
        model: AI_FAST_MODEL,
        messages: buildTranslateMessages(scopedInput),
        response_format: { type: "json_object" },
        max_tokens: 4500,
        temperature: 0.1
      }));

      const raw = completion.choices[0]?.message?.content;
      if (!raw) throw new Error("AI returned empty content.");

      const parsed = translateResponseSchema.parse(JSON.parse(raw));
      const translatedText = cleanGeneratedText(parsed.translatedText);
      const exact = exactAnnotations(translatedText, parsed.annotations);
      return NextResponse.json({
        ...parsed,
        translatedText,
        annotations: exact.annotations,
        warnings: [...(parsed.warnings ?? []), ...exact.warnings]
      });
    } catch (aiError) {
      const fallback = mockTranslate(scopedInput);
      fallback.warnings.push(`DeepSeek translation unavailable; used mock preview. ${aiError instanceof Error ? aiError.message : ""}`.trim());
      return NextResponse.json(fallback);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function selectedText(text: string, range: { start: number; end: number } | undefined) {
  if (!range) return text;
  if (range.start < 0 || range.end < range.start || range.end > text.length) {
    throw new Error("Selected range is outside the submitted text.");
  }
  return text.slice(range.start, range.end);
}

function mockTranslate(input: TranslateRequest): TranslateResponse {
  const translatedText =
    input.mode === "en-to-zh"
      ? `[Chinese translation preview]\n${input.text}\n\n(Mock translation: configure DEEPSEEK_API_KEY for natural Chinese.)`
      : `English translation preview:\n${input.text}\n\n(Mock translation: configure DEEPSEEK_API_KEY for natural English.)`;
  const text = cleanGeneratedText(translatedText);

  return {
    translatedText: text,
    mode: input.mode,
    annotations: normalizeAnnotations(text, buildMockAnnotations(text)),
    warnings: ["Mock translation preview. No document text was changed automatically."]
  };
}
