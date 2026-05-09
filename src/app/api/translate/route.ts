import { NextResponse } from "next/server";
import type { TranslateRequest, TranslateResponse } from "@/types/essaycraft";
import { createAiClient, AI_FAST_MODEL, hasAiKey, withAiTimeout } from "@/lib/ai-client";
import { buildMockAnnotations, exactAnnotations, normalizeAnnotations } from "@/lib/annotations";
import { buildTranslateMessages } from "@/lib/prompts";
import { translateRequestSchema, translateResponseSchema } from "@/lib/schemas";
import { cleanGeneratedText } from "@/lib/textFormat";

const ZH_PREVIEW_TITLE = "\u4e2d\u6587\u7ffb\u8bd1\u9884\u89c8\uff1a";
const ZH_PREVIEW_NOTE = "\uff08\u6a21\u62df\u7ffb\u8bd1\uff1a\u5f53\u524d\u4f7f\u7528\u672c\u5730\u9884\u89c8\uff0c\u539f\u6587\u4e0d\u4f1a\u88ab\u81ea\u52a8\u4fee\u6539\u3002\uff09";
const ZH_GENERIC_LINE = "\u8fd9\u90e8\u5206\u8868\u8fbe\u4e86\u539f\u6587\u4e2d\u7684\u4e00\u4e2a\u5199\u4f5c\u8981\u70b9\uff0c\u53ef\u4ee5\u7ed3\u5408\u4e0a\u4e0b\u6587\u7ee7\u7eed\u7406\u89e3\u3002";

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
      if (input.mode !== "zh-to-en" && !hasUsefulChinese(translatedText)) {
        throw new Error("AI translation did not contain enough Simplified Chinese.");
      }
      if (input.mode !== "zh-to-en" && echoesSourceEnglish(textToTranslate, translatedText)) {
        throw new Error("AI translation echoed too much of the English source.");
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
      : `${ZH_PREVIEW_TITLE}\n${mockChinesePreview(input.text)}\n\n${ZH_PREVIEW_NOTE}`;
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
    [/^Topic\s*:\s*/i, "\u4e3b\u9898\uff1a"],
    [/^Question\s*:\s*/i, "\u95ee\u9898\uff1a"],
    [/^Research question\s*:\s*/i, "\u7814\u7a76\u95ee\u9898\uff1a"],
    [/^Working thesis\s*:\s*/i, "\u5de5\u4f5c\u8bba\u70b9\uff1a"],
    [/^Thesis\s*:\s*/i, "\u8bba\u70b9\uff1a"],
    [/^Thesis map\s*:\s*/i, "\u8bba\u70b9\u8def\u7ebf\u56fe\uff1a"],
    [/^Research plan for\s*:\s*/i, "\u7814\u7a76\u8ba1\u5212\u4e3b\u9898\uff1a"],
    [/^Argument branch\s*(\d*)\s*:\s*/i, "\u8bba\u8bc1\u5206\u652f$1\uff1a"],
    [/^Evidence needed\s*:\s*/i, "\u9700\u8981\u5bfb\u627e\u7684\u8bc1\u636e\uff1a"],
    [/^Evidence to look for\s*:\s*/i, "\u9700\u8981\u5bfb\u627e\u7684\u8bc1\u636e\uff1a"],
    [/^Evidence to use\s*:\s*/i, "\u53ef\u4f7f\u7528\u7684\u8bc1\u636e\uff1a"],
    [/^Possible source type\s*:\s*/i, "\u53ef\u80fd\u7684\u6765\u6e90\u7c7b\u578b\uff1a"],
    [/^Suggested source type\s*:\s*/i, "\u5efa\u8bae\u6765\u6e90\u7c7b\u578b\uff1a"],
    [/^Search keywords\s*:\s*/i, "\u641c\u7d22\u5173\u952e\u8bcd\uff1a"],
    [/^Source status\s*:\s*/i, "\u6765\u6e90\u72b6\u6001\uff1a"],
    [/^CARS check\s*:\s*/i, "CARS \u6765\u6e90\u68c0\u67e5\uff1a"],
    [/^Counterargument(?: to investigate)?\s*:\s*/i, "\u9700\u8981\u8c03\u67e5\u7684\u53cd\u65b9\u89c2\u70b9\uff1a"]
  ];

  for (const [pattern, label] of rules) {
    if (pattern.test(body)) {
      return `${leading}${label}${translateAcademicPhrase(body.replace(pattern, ""))}`;
    }
  }

  if (/^Introduction plan$/i.test(body)) return `${leading}\u5f15\u8a00\u8ba1\u5212`;
  if (/^Body paragraph\s*(\d*)$/i.test(body)) return `${leading}\u4e3b\u4f53\u6bb5\u843d${body.match(/\d+/)?.[0] ?? ""}`;
  if (/^Counterargument paragraph$/i.test(body)) return `${leading}\u53cd\u65b9\u89c2\u70b9\u6bb5\u843d`;
  if (/^Conclusion plan$/i.test(body)) return `${leading}\u7ed3\u8bba\u8ba1\u5212`;
  if (/[\u4e00-\u9fff]/.test(body)) return `${leading}${body}`;
  return `${leading}${translateAcademicPhrase(body)}`;
}

function translateAcademicPhrase(value: string) {
  const placeholder = value.match(/\[(?:citation|source) needed(?::[^\]]*)?\]/i)?.[0];
  if (placeholder) {
    return placeholder.toLowerCase().includes("source")
      ? `\u8fd9\u91cc\u9700\u8981\u5bfb\u627e\u771f\u5b9e\u6765\u6e90\u652f\u6301\u3002 ${placeholder}`
      : `\u8fd9\u91cc\u9700\u8981\u6dfb\u52a0\u771f\u5b9e\u6765\u6e90\u7684\u5f15\u7528\u3002 ${placeholder}`;
  }

  const concepts = academicConcepts(value);
  const lower = value.toLowerCase();
  if (concepts.length) {
    if (lower.includes("?") || lower.startsWith("how ")) {
      return `\u8fd9\u4e2a\u95ee\u9898\u5173\u6ce8${joinChinese(concepts)}\u4e4b\u95f4\u5982\u4f55\u5efa\u7acb\u66f4\u5065\u5eb7\u3001\u66f4\u6709\u8d23\u4efb\u7684\u5173\u7cfb\u3002`;
    }
    if (lower.includes("thesis") || lower.includes("argues") || lower.includes("possible")) {
      return `\u6838\u5fc3\u8bba\u70b9\u662f\uff1a${joinChinese(concepts)}\u9700\u8981\u5171\u540c\u652f\u6301\u4e00\u4e2a\u66f4\u5e73\u8861\u7684\u5199\u4f5c\u7acb\u573a\u3002`;
    }
    if (lower.includes("evidence") || lower.includes("research") || lower.includes("study") || lower.includes("report")) {
      return `\u8fd9\u91cc\u9700\u8981\u5bfb\u627e\u4e0e${joinChinese(concepts)}\u76f8\u5173\u7684\u7814\u7a76\u6216\u62a5\u544a\u6765\u652f\u6301\u8bba\u8bc1\u3002`;
    }
    return `\u8fd9\u53e5\u8bdd\u8ba8\u8bba\u4e86${joinChinese(concepts)}\u7684\u5173\u7cfb\uff0c\u5e76\u6307\u5411\u6587\u7ae0\u7684\u8bba\u8bc1\u91cd\u70b9\u3002`;
  }

  return ZH_GENERIC_LINE;
}

function academicConcepts(value: string) {
  const lower = value.toLowerCase();
  const pairs: Array<[RegExp, string]> = [
    [/social media/, "\u793e\u4ea4\u5a92\u4f53"],
    [/balance|balanced|healthier/, "\u5065\u5eb7\u5e73\u8861"],
    [/youth|young people|students|adolescent/, "\u9752\u5c11\u5e74\u548c\u5b66\u751f"],
    [/wellbeing|mental health|sleep|attention|anxiety/, "\u8eab\u5fc3\u798f\u7949\u4e0e\u6ce8\u610f\u529b"],
    [/intentional habits|habits|passive scrolling|screen time/, "\u6709\u610f\u8bc6\u7684\u4f7f\u7528\u4e60\u60ef"],
    [/platform|algorithm|notification|engagement design/, "\u5e73\u53f0\u8bbe\u8ba1\u4e0e\u63a8\u8350\u673a\u5236"],
    [/digital literacy|media education|online safety/, "\u6570\u5b57\u7d20\u517b\u6559\u80b2"],
    [/school|classroom|education/, "\u5b66\u6821\u6559\u80b2"],
    [/technology|ai|human-centered|human needs|machine/, "\u6280\u672f\u4e0e\u4eba\u7684\u9700\u8981"],
    [/citation|source|evidence|reference/, "\u8bc1\u636e\u4e0e\u6765\u6e90"],
    [/counterargument|restriction|ban|limits?/, "\u53cd\u65b9\u89c2\u70b9\u4e0e\u9650\u5236\u63aa\u65bd"],
    [/academic|essay|argument|thesis|claim/, "\u5b66\u672f\u8bba\u8bc1"]
  ];
  const result: string[] = [];
  for (const [pattern, concept] of pairs) {
    if (pattern.test(lower) && !result.includes(concept)) result.push(concept);
  }
  return result.slice(0, 4);
}

function joinChinese(values: string[]) {
  if (values.length <= 1) return values[0] ?? "";
  return values.slice(0, -1).join("\u3001") + "\u548c" + values[values.length - 1];
}

function mockEnglishPreview(value: string) {
  return value
    .split("\n")
    .map((line) => {
      if (!line.trim()) return "";
      return /[\u4e00-\u9fff]/.test(line)
        ? "Translation: This line explains the academic writing point in English for reference."
        : line;
    })
    .join("\n");
}

function hasUsefulChinese(value: string) {
  const chineseChars = value.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  return chineseChars >= 12;
}

function echoesSourceEnglish(source: string, translated: string) {
  const stopWords = new Set(["about", "after", "also", "because", "between", "could", "every", "first", "from", "have", "into", "more", "should", "their", "there", "these", "this", "when", "where", "which", "with", "without", "would"]);
  const tokens = Array.from(new Set((source.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((token) => !stopWords.has(token))));
  if (tokens.length < 5) return false;
  const output = translated.toLowerCase();
  const echoed = tokens.filter((token) => output.includes(token)).length;
  return echoed / tokens.length > 0.25;
}
