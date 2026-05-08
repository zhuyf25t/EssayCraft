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
    if (!textToTranslate.trim()) {
      return NextResponse.json({ error: "Select or add text before translating." }, { status: 400 });
    }
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
      if (parsed.mode !== input.mode) {
        throw new Error(`AI returned ${parsed.mode}, expected ${input.mode}.`);
      }
      if (!translatedText.trim()) {
        throw new Error("AI returned empty translated text after cleanup.");
      }
      const exact = exactAnnotations(translatedText, parsed.annotations);
      return NextResponse.json({
        ...parsed,
        translatedText,
        annotations: exact.annotations,
        warnings: [...(parsed.warnings ?? []), ...exact.warnings, "Translate is preview-only; the original document was not changed."],
        providerMode: "deepseek"
      });
    } catch (aiError) {
      const fallback = mockTranslate(scopedInput);
      fallback.providerMode = "fallback";
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
    input.mode === "zh-to-en"
      ? `English translation preview:\n${mockEnglishPreview(input.text)}\n\n(Mock translation: provider translation is unavailable in this session.)`
      : `中文翻译预览：\n${mockChinesePreview(input.text)}\n\n（模拟翻译：当前会话未调用真实翻译提供方，原文不会被自动修改。）`;
  const text = cleanGeneratedText(translatedText);

  return {
    translatedText: text,
    mode: input.mode,
    annotations: normalizeAnnotations(text, buildMockAnnotations(text)),
    warnings: ["Mock translation preview. No document text was changed automatically."],
    providerMode: "mock"
  };
}

function mockChinesePreview(value: string) {
  return value
    .split("\n")
    .map((line) => translateLineToChinese(line))
    .join("\n");
}

function translateLineToChinese(line: string) {
  if (!line.trim()) return "";
  const leading = line.match(/^(\s*[-*]\s*)/)?.[1] ?? "";
  const body = line.slice(leading.length).trim();
  const rules: Array<[RegExp, string]> = [
    [/^Topic\s*:\s*/i, "主题："],
    [/^Question\s*:\s*/i, "问题："],
    [/^Research question\s*:\s*/i, "研究问题："],
    [/^Working thesis\s*:\s*/i, "工作论点："],
    [/^Thesis\s*:\s*/i, "论点："],
    [/^Thesis map\s*:\s*/i, "论点路线图："],
    [/^Research plan for\s*:\s*/i, "研究计划主题："],
    [/^Argument branch\s*(\d*)\s*:\s*/i, "论证分支$1："],
    [/^Evidence needed\s*:\s*/i, "需要寻找的证据："],
    [/^Evidence to look for\s*:\s*/i, "需要寻找的证据："],
    [/^Evidence to use\s*:\s*/i, "可使用的证据："],
    [/^Possible source type\s*:\s*/i, "可能的来源类型："],
    [/^Suggested source type\s*:\s*/i, "建议来源类型："],
    [/^Search keywords\s*:\s*/i, "搜索关键词："],
    [/^Source status\s*:\s*/i, "来源状态："],
    [/^CARS check\s*:\s*/i, "CARS 来源检查："],
    [/^Counterargument(?: to investigate)?\s*:\s*/i, "需要调查的反方观点："],
    [/^Introduction plan$/i, "引言计划"],
    [/^Body paragraph\s*(\d*)$/i, "主体段落$1"],
    [/^Counterargument paragraph$/i, "反方观点段落"],
    [/^Conclusion plan$/i, "结论计划"]
  ];

  for (const [pattern, label] of rules) {
    if (pattern.test(body)) {
      return `${leading}${label}${translateAcademicPhrase(body.replace(pattern, ""))}`;
    }
  }

  if (/[\u4e00-\u9fff]/.test(body)) return `${leading}${body}`;
  if (body.includes("[citation needed]") || body.includes("[source needed")) {
    return `${leading}此处需要来源支持 ${body.match(/\[(?:citation|source) needed(?::[^\]]*)?\]/i)?.[0] ?? "[citation needed]"}`;
  }
  return `${leading}${translateAcademicPhrase(body)}`;
}

function translateAcademicPhrase(value: string) {
  const placeholders: string[] = [];
  let text = value.replace(/\[(?:citation|source) needed(?::[^\]]*)?\]/gi, (match) => {
    placeholders.push(match);
    return `__PLACEHOLDER_${placeholders.length - 1}__`;
  });
  const replacements: Array<[RegExp, string]> = [
    [/social media/gi, "社交媒体"],
    [/balance/gi, "平衡"],
    [/youth wellbeing|young people's wellbeing/gi, "青少年福祉"],
    [/intentional habits/gi, "有意识的使用习惯"],
    [/passive scrolling/gi, "被动刷屏"],
    [/platform design/gi, "平台设计"],
    [/engagement systems?/gi, "参与度机制"],
    [/digital literacy/gi, "数字素养"],
    [/schools?/gi, "学校"],
    [/students?/gi, "学生"],
    [/research|study/gi, "研究"],
    [/evidence/gi, "证据"],
    [/source needed/gi, "需要来源"],
    [/citation needed/gi, "需要引用"],
    [/technology/gi, "技术"],
    [/human needs?/gi, "人的需求"],
    [/AI tools?/gi, "人工智能工具"],
    [/academic/gi, "学术"],
    [/argument/gi, "论证"],
    [/thesis/gi, "论点"],
    [/counterargument/gi, "反方观点"]
  ];
  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }
  text = text.replace(/\b(can|could|may|should|will|is|are|and|or|the|a|an|of|to|in|for|with|when|by|from|that|this)\b/gi, " ");
  text = text.replace(/\s+/g, " ").trim();
  const translated = /[\u4e00-\u9fff]/.test(text)
    ? text
    : `这部分表达了原文的主要意思，并保留关键词：${value.slice(0, 90)}`;
  return placeholders.reduce((result, placeholder, index) => result.replace(`__PLACEHOLDER_${index}__`, placeholder), translated);
}

function mockEnglishPreview(value: string) {
  return value
    .split("\n")
    .map((line) => {
      if (!line.trim()) return "";
      if (/^主题[:：]/.test(line)) return line.replace(/^主题[:：]\s*/, "Topic: ");
      if (/^问题[:：]/.test(line)) return line.replace(/^问题[:：]\s*/, "Question: ");
      if (/^研究问题[:：]/.test(line)) return line.replace(/^研究问题[:：]\s*/, "Research question: ");
      if (/^工作论点[:：]/.test(line)) return line.replace(/^工作论点[:：]\s*/, "Working thesis: ");
      return `Translation: ${line}`;
    })
    .join("\n");
}
