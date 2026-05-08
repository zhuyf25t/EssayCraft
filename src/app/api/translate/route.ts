import { NextResponse } from "next/server";
import type { TranslateRequest, TranslateResponse } from "@/types/essaycraft";
import { createAiClient, AI_FAST_MODEL, hasAiKey, withAiTimeout } from "@/lib/ai-client";
import { buildTranslateMessages } from "@/lib/prompts";
import { translateRequestSchema, translateResponseSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const input = translateRequestSchema.parse(json);

    if (!hasAiKey()) {
      return NextResponse.json(mockTranslate(input));
    }

    try {
      const client = createAiClient();
      const completion = await withAiTimeout(client.chat.completions.create({
        model: AI_FAST_MODEL,
        messages: buildTranslateMessages(input),
        response_format: { type: "json_object" },
        max_tokens: 4500,
        temperature: 0.1
      }));

      const raw = completion.choices[0]?.message?.content;
      if (!raw) throw new Error("AI returned empty content.");

      const parsed = translateResponseSchema.parse(JSON.parse(raw));
      return NextResponse.json(parsed);
    } catch (aiError) {
      const fallback = mockTranslate(input);
      fallback.warnings.push(`DeepSeek translation unavailable; used mock preview. ${aiError instanceof Error ? aiError.message : ""}`.trim());
      return NextResponse.json(fallback);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function mockTranslate(input: TranslateRequest): TranslateResponse {
  const source = input.selectedRange ? input.text.slice(input.selectedRange.start, input.selectedRange.end) : input.text;
  const translatedText =
    input.mode === "en-to-zh"
      ? `【中文翻译预览】\n${source}\n\n（模拟翻译：配置 DEEPSEEK_API_KEY 后将生成自然中文。）`
      : `English translation preview:\n${source}\n\n(Mock translation: configure DEEPSEEK_API_KEY for natural English.)`;

  return {
    translatedText,
    mode: input.mode,
    annotations: [],
    warnings: ["Mock translation preview. No document text was changed automatically."]
  };
}
