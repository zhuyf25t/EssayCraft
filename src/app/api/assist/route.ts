import { NextResponse } from "next/server";
import type { AssistRequest, AssistResponse } from "@/types/essaycraft";
import { createAiClient, AI_FAST_MODEL, hasAiKey, withAiTimeout } from "@/lib/ai-client";
import { buildMockAnnotations, exactAnnotations, normalizeAnnotations } from "@/lib/annotations";
import { buildAssistMessages } from "@/lib/prompts";
import { assistRequestSchema, assistResponseSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const input = assistRequestSchema.parse(json);

    if (!hasAiKey()) {
      return NextResponse.json(mockAssist(input));
    }

    try {
      const client = createAiClient();
      const completion = await withAiTimeout(client.chat.completions.create({
        model: AI_FAST_MODEL,
        messages: buildAssistMessages(input),
        response_format: { type: "json_object" },
        max_tokens: 3500,
        temperature: 0.2
      }));

      const raw = completion.choices[0]?.message?.content;
      if (!raw) throw new Error("AI returned empty content.");

      const parsed = assistResponseSchema.parse(JSON.parse(raw));
      const exact = exactAnnotations(input.text, parsed.annotations ?? []);
      const rangeWarning = validateAssistReplaceRange(input, parsed);
      const normalized: AssistResponse = rangeWarning
        ? {
            reply: `${parsed.reply} ${rangeWarning}`,
            annotations: exact.annotations,
            warnings: [...(parsed.warnings ?? []), ...exact.warnings, rangeWarning]
          }
        : {
            ...parsed,
            annotations: exact.annotations,
            warnings: [...(parsed.warnings ?? []), ...exact.warnings]
          };

      return NextResponse.json(normalized);
    } catch (aiError) {
      const fallback = mockAssist(input);
      fallback.warnings.push(`DeepSeek assistant unavailable; used mock suggestion. ${aiError instanceof Error ? aiError.message : ""}`.trim());
      return NextResponse.json(fallback);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function validateAssistReplaceRange(input: AssistRequest, response: AssistResponse) {
  if (!response.replaceRange) return "";
  const range = response.replaceRange;
  const inBounds = range.start >= 0 && range.end >= range.start && range.end <= input.text.length;
  if (!inBounds) return "Assistant replacement was blocked because it targeted an invalid range.";
  if (input.selectedRange && (range.start !== input.selectedRange.start || range.end !== input.selectedRange.end)) {
    return "Assistant replacement was blocked because it did not target the submitted selection.";
  }
  return "";
}

function mockAssist(input: AssistRequest): AssistResponse {
  const range = input.selectedRange;
  const selected = input.selectedText || (range ? input.text.slice(range.start, range.end) : input.text);
  const action = input.action.toLowerCase();
  const warnings = ["Mock assistant response. Provider suggestions are unavailable or forced off in this session."];

  if (action.includes("citation")) {
    return {
      reply: "I found citation-risk areas. Evidence claims should keep [citation needed] until you add real source details in source cards.",
      annotations: normalizeAnnotations(input.text, buildMockAnnotations(input.text).filter((annotation) => annotation.label === "issue" || annotation.text.includes("[citation needed]"))),
      warnings
    };
  }

  if (action.includes("explain")) {
    return {
      reply: selected
        ? `This selection appears to function as ${buildMockAnnotations(selected)[0]?.label ?? "plain"} writing. Use the comment to decide whether the label matches your intention.`
        : "Select a sentence or range first, then ask me to explain the highlight.",
      annotations: [],
      warnings
    };
  }

  if (action.includes("relabel")) {
    return {
      reply: "I prepared a label refresh for the selected area. Apply and refresh if the current color does not match the sentence role.",
      annotations: range
        ? [
            {
              id: "assist-relabel",
              start: range.start,
              end: range.end,
              text: input.text.slice(range.start, range.end),
              label: "analysis",
              confidence: 0.7,
              comment: "Mock relabel suggestion."
            }
          ]
        : [],
      warnings
    };
  }

  if (action.includes("translate")) {
    const translated = mockAssistantChinese(selected || input.text);
    return {
      reply: range
        ? "Translation preview ready for the selected text. Apply only if you want to replace that selection."
        : "Translation preview ready. Select a passage first if you want an applyable replacement.",
      proposedText: translated,
      replaceRange: range,
      annotations: [],
      warnings
    };
  }

  if ((action.includes("rewrite") || action.includes("academic") || action.includes("analysis")) && range) {
    const base = selected.trim() || "This point needs clearer explanation.";
    const proposedText = action.includes("analysis")
      ? `${base} This matters because it connects the evidence back to the thesis and explains why the reader should accept the argument.`
      : `A more academic version could state: ${base.replace(/\s+/g, " ")} [citation needed if this includes factual evidence].`;

    return {
      reply: "Preview ready. I did not change the document; apply the suggestion only if it matches your intended meaning.",
      proposedText,
      replaceRange: range,
      annotations: [],
      warnings
    };
  }

  return {
    reply: "I can explain highlights, relabel a selected range, rewrite selected text, strengthen analysis, find citation gaps, or prepare translation. Select text for the most precise help.",
    annotations: [],
    warnings
  };
}

function mockAssistantChinese(value: string) {
  const text = value.trim();
  if (!text) return "请选择或输入要翻译的文本。";
  return text
    .replace(/social media/gi, "社交媒体")
    .replace(/intentional habits/gi, "有意识的使用习惯")
    .replace(/platforms?/gi, "平台")
    .replace(/digital literacy/gi, "数字素养")
    .replace(/students?/gi, "学生")
    .replace(/evidence/gi, "证据")
    .replace(/thesis/gi, "论点")
    .replace(/research question/gi, "研究问题")
    .replace(/Topic:/gi, "主题：")
    .replace(/Question:/gi, "问题：");
}
