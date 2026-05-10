import { NextResponse } from "next/server";
import type { TranslateRequest, TranslateResponse } from "@/types/essaycraft";
import {
  addAiMetadata,
  aiMetadata,
  AI_FAST_MODEL,
  AI_MOCK_MODEL,
  createAiClient,
  fallbackReasonFromError,
  providerSkipReason,
  TRANSLATE_TIMEOUT_MS,
  withAiTimeout
} from "@/lib/ai-client";
import { buildMockAnnotations, exactAnnotations, normalizeAnnotations } from "@/lib/annotations";
import { buildTranslateMessages } from "@/lib/prompts";
import { translateRequestSchema, translateResponseSchema } from "@/lib/schemas";
import { cleanGeneratedText } from "@/lib/textFormat";

export const dynamic = "force-dynamic";

const ZH_GENERIC_LINE = "\u8fd9\u6bb5\u5185\u5bb9\u53ef\u4ee5\u4f5c\u4e3a\u4e2d\u6587\u53c2\u8003\u8bd1\u6587\u8fdb\u4e00\u6b65\u6da6\u8272\u3002";

export async function POST(request: Request) {
  const startedAt = performance.now();
  try {
    const json = await request.json();
    const input = translateRequestSchema.parse(json);
    const textToTranslate = selectedText(input.text, input.selectedRange);
    if (!textToTranslate.trim()) {
      return NextResponse.json({ error: "Select or add text before translating." }, { status: 400 });
    }
    const scopedInput = { ...input, text: textToTranslate, selectedRange: undefined };

    const skipReason = providerSkipReason();
    if (skipReason) {
      return NextResponse.json(addAiMetadata(mockTranslate(scopedInput, "mock"), aiMetadata(startedAt, "mock", AI_MOCK_MODEL, skipReason)));
    }

    try {
      const client = createAiClient(TRANSLATE_TIMEOUT_MS);
      const completion = await withAiTimeout(
        client.chat.completions.create({
          model: AI_FAST_MODEL,
          messages: buildTranslateMessages(scopedInput),
          response_format: { type: "json_object" },
          max_tokens: 4500,
          temperature: 0.1
        }),
        TRANSLATE_TIMEOUT_MS
      );

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
      if (input.mode !== "zh-to-en" && hasBannedTranslationCommentary(translatedText)) {
        throw new Error("AI translation added commentary instead of a reference translation.");
      }
      const exact = exactAnnotations(translatedText, parsed.annotations);
      return NextResponse.json(addAiMetadata({
        ...parsed,
        translatedText,
        annotations: exact.annotations,
        warnings: [...(parsed.warnings ?? []), ...exact.warnings, "Translate is preview-only; the original document was not changed."],
        providerMode: "deepseek"
      }, aiMetadata(startedAt, "deepseek", AI_FAST_MODEL)));
    } catch (aiError) {
      const fallback = mockTranslate(scopedInput, "fallback");
      fallback.warnings = ["Reference translation preview. No document text was changed automatically."];
      return NextResponse.json(addAiMetadata(fallback, aiMetadata(startedAt, "fallback", AI_MOCK_MODEL, fallbackReasonFromError(aiError, AI_FAST_MODEL))));
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

function mockTranslate(input: TranslateRequest, providerMode: TranslateResponse["providerMode"] = "mock"): TranslateResponse {
  const translatedText =
    input.mode === "zh-to-en"
      ? mockEnglishPreview(input.text)
      : mockChinesePreview(input.text);
  const text = cleanGeneratedText(translatedText);

  return {
    translatedText: text,
    mode: input.mode,
    annotations: normalizeAnnotations(text, buildMockAnnotations(text)),
    warnings: ["Reference translation preview. No document text was changed automatically."],
    providerMode
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

function translateAcademicPhrase(value: string): string {
  const known = translateKnownSentence(value);
  if (known) return known;

  const placeholder = value.match(/\[(?:citation|source) needed(?::[^\]]*)?\]/i)?.[0];
  if (placeholder) {
    const withoutMarker = value.replace(placeholder, "").trim();
    if (!withoutMarker) return placeholder;
    return `${translateAcademicPhrase(withoutMarker)} ${placeholder}`;
  }

  const concepts = academicConcepts(value);
  const lower = value.toLowerCase();
  if (concepts.length) {
    if (lower.includes("?") || lower.startsWith("how ")) {
      return `\u8fd9\u4e2a\u95ee\u9898\u5173\u6ce8${joinChinese(concepts)}\u4e4b\u95f4\u5982\u4f55\u5efa\u7acb\u66f4\u5065\u5eb7\u3001\u66f4\u6709\u8d23\u4efb\u7684\u5173\u7cfb\u3002`;
    }
    if (lower.includes("thesis") || lower.includes("argues") || lower.includes("possible")) {
      return `${joinChinese(concepts)}\u9700\u8981\u5171\u540c\u652f\u6301\u4e00\u4e2a\u66f4\u5e73\u8861\u7684\u7acb\u573a\u3002`;
    }
    if (lower.includes("evidence") || lower.includes("research") || lower.includes("study") || lower.includes("report")) {
      return `\u8fd9\u91cc\u9700\u8981\u5bfb\u627e\u4e0e${joinChinese(concepts)}\u76f8\u5173\u7684\u7814\u7a76\u6216\u62a5\u544a\u6765\u652f\u6301\u8bba\u8bc1\u3002`;
    }
    return `${joinChinese(concepts)}\u4e4b\u95f4\u7684\u5173\u7cfb\u9700\u8981\u7ed3\u5408\u4e0a\u4e0b\u6587\u8fdb\u4e00\u6b65\u8bf4\u660e\u3002`;
  }

  return ZH_GENERIC_LINE;
}

function translateKnownSentence(value: string) {
  const normalized = value.toLowerCase().replace(/\s+/g, " ").trim();
  const matches: Array<[RegExp, string]> = [
    [/social media now shapes how young people communicate, relax, study, and compare themselves with others/, "\u793e\u4ea4\u5a92\u4f53\u5982\u4eca\u5df2\u7ecf\u5f71\u54cd\u9752\u5c11\u5e74\u4ea4\u6d41\u3001\u653e\u677e\u3001\u5b66\u4e60\u4ee5\u53ca\u4e0e\u4ed6\u4eba\u6bd4\u8f83\u7684\u65b9\u5f0f\u3002"],
    [/the question is not simply whether social media is good or bad/, "\u56e0\u6b64\uff0c\u95ee\u9898\u4e0d\u53ea\u662f\u793e\u4ea4\u5a92\u4f53\u662f\u597d\u662f\u574f\uff0c\u800c\u662f\u5b83\u5982\u4f55\u88ab\u66f4\u5065\u5eb7\u5730\u4f7f\u7528\u3002"],
    [/this essay argues that a healthier social media balance is possible/, "\u672c\u6587\u8ba4\u4e3a\uff0c\u5f53\u7528\u6237\u5efa\u7acb\u6709\u610f\u8bc6\u7684\u4e60\u60ef\u3001\u5e73\u53f0\u91cd\u65b0\u8bbe\u8ba1\u53c2\u4e0e\u673a\u5236\uff0c\u5e76\u4e14\u5b66\u6821\u6559\u6388\u66f4\u5f3a\u7684\u6570\u5b57\u7d20\u517b\u65f6\uff0c\u66f4\u5065\u5eb7\u7684\u793e\u4ea4\u5a92\u4f53\u5e73\u8861\u662f\u53ef\u80fd\u7684\u3002"],
    [/first, individual habits are important/, "\u9996\u5148\uff0c\u4e2a\u4eba\u4e60\u60ef\u5f88\u91cd\u8981\uff0c\u56e0\u4e3a\u8bb8\u591a\u6709\u5bb3\u7684\u793e\u4ea4\u5a92\u4f53\u4f7f\u7528\u6a21\u5f0f\u6765\u81ea\u88ab\u52a8\u548c\u65e0\u8ba1\u5212\u7684\u6d4f\u89c8\u3002"],
    [/second, responsibility should not rest only on individual users/, "\u5176\u6b21\uff0c\u8d23\u4efb\u4e0d\u5e94\u53ea\u843d\u5728\u4e2a\u4eba\u7528\u6237\u8eab\u4e0a\uff0c\u56e0\u4e3a\u5e73\u53f0\u4e5f\u4f1a\u901a\u8fc7\u8bbe\u8ba1\u5851\u9020\u7528\u6237\u884c\u4e3a\u3002"],
    [/third, schools can help students develop the digital literacy/, "\u7b2c\u4e09\uff0c\u5b66\u6821\u53ef\u4ee5\u5e2e\u52a9\u5b66\u751f\u53d1\u5c55\u6570\u5b57\u7d20\u517b\uff0c\u4f7f\u4ed6\u4eec\u80fd\u591f\u6279\u5224\u6027\u5730\u4f7f\u7528\u793e\u4ea4\u5a92\u4f53\u3002"],
    [/in conclusion, a healthier social media balance is most realistic/, "\u603b\u4e4b\uff0c\u5f53\u7528\u6237\u3001\u5e73\u53f0\u548c\u5b66\u6821\u5171\u540c\u627f\u62c5\u8d23\u4efb\u65f6\uff0c\u66f4\u5065\u5eb7\u7684\u793e\u4ea4\u5a92\u4f53\u5e73\u8861\u6700\u6709\u53ef\u80fd\u5b9e\u73b0\u3002"],
    [/topic: campus notification habits/, "\u4e3b\u9898\uff1a\u6821\u56ed\u901a\u77e5\u4e60\u60ef"],
    [/campus notification habits/, "\u6821\u56ed\u901a\u77e5\u4e60\u60ef"],
    [/how can schools reduce distraction while keeping students connected/, "\u5b66\u6821\u5982\u4f55\u5728\u4fdd\u6301\u5b66\u751f\u8054\u7cfb\u7684\u540c\u65f6\u51cf\u5c11\u5206\u5fc3\uff1f"]
  ];
  const translated = matches
    .filter(([pattern]) => pattern.test(normalized))
    .map(([, translation]) => translation);
  return translated.length ? translated.join("") : "";
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
        ? "This line needs a clearer English reference translation."
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

function hasBannedTranslationCommentary(value: string) {
  return /中文参考翻译|这句话讨论了|这句话强调|核心论点是|本地参考翻译|译文\s*[:：]/.test(value);
}
