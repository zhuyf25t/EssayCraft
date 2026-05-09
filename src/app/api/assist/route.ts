import { NextResponse } from "next/server";
import type { AssistRequest, AssistResponse } from "@/types/essaycraft";
import { createAiClient, AI_FAST_MODEL, hasAiKey, withAiTimeout } from "@/lib/ai-client";
import { buildMockAnnotations, exactAnnotations, normalizeAnnotations } from "@/lib/annotations";
import { buildAssistMessages } from "@/lib/prompts";
import { assistRequestSchema, assistResponseSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const input = normalizeAssistInput(assistRequestSchema.parse(json));

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

function normalizeAssistInput(input: AssistRequest): AssistRequest {
  const range = input.selectedRange;
  if (!range || range.end <= range.start) {
    return { ...input, selectedRange: undefined, selectedText: undefined };
  }
  return {
    ...input,
    selectedText: input.selectedText ?? input.text.slice(range.start, range.end)
  };
}

function validateAssistReplaceRange(input: AssistRequest, response: AssistResponse) {
  if (!response.replaceRange) return "";
  const range = response.replaceRange;
  const inBounds = range.start >= 0 && range.end > range.start && range.end <= input.text.length;
  if (!inBounds) return "Assistant replacement was blocked because it did not target a valid text selection.";
  if (!input.selectedRange) return "Assistant replacement was blocked because no text selection was submitted.";
  if (range.start !== input.selectedRange.start || range.end !== input.selectedRange.end) {
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
      reply: range
        ? "I prepared a label refresh for the selected area. Apply and refresh if the current color does not match the sentence role."
        : "Select text first before relabeling a range.",
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
  if (!text) return "\u8bf7\u9009\u62e9\u6216\u8f93\u5165\u8981\u7ffb\u8bd1\u7684\u6587\u672c\u3002";
  return text
    .split("\n")
    .map((line) => {
      if (!line.trim()) return "";
      if (/^Topic\s*:/i.test(line)) return `\u4e3b\u9898\uff1a${assistantChineseConcepts(line)}`;
      if (/^Research question\s*:/i.test(line) || /^Question\s*:/i.test(line)) return `\u7814\u7a76\u95ee\u9898\uff1a${assistantChineseConcepts(line)}`;
      if (/^Working thesis\s*:/i.test(line) || /^Thesis\s*:/i.test(line)) return `\u8bba\u70b9\uff1a${assistantChineseConcepts(line)}`;
      const concepts = assistantChineseConcepts(line);
      return concepts
        ? concepts
        : "\u8fd9\u4e00\u6bb5\u9700\u8981\u8fde\u63a5\u7ffb\u8bd1\u63d0\u4f9b\u65b9\u540e\u8fdb\u884c\u66f4\u7cbe\u786e\u7684\u4e2d\u6587\u7ffb\u8bd1\u3002";
    })
    .join("\n");
}

function assistantChineseConcepts(value: string) {
  const lower = value.toLowerCase();
  const concepts: string[] = [];
  const add = (condition: boolean, text: string) => {
    if (condition && !concepts.includes(text)) concepts.push(text);
  };
  add(/social media/.test(lower), "\u793e\u4ea4\u5a92\u4f53");
  add(/balance|healthier/.test(lower), "\u5065\u5eb7\u5e73\u8861");
  add(/youth|young|student/.test(lower), "\u9752\u5c11\u5e74\u548c\u5b66\u751f");
  add(/intentional habits|passive scrolling|screen time/.test(lower), "\u6709\u610f\u8bc6\u7684\u4f7f\u7528\u4e60\u60ef");
  add(/platform|algorithm|notification|engagement/.test(lower), "\u5e73\u53f0\u8bbe\u8ba1\u4e0e\u53c2\u4e0e\u673a\u5236");
  add(/digital literacy|media education|school/.test(lower), "\u6570\u5b57\u7d20\u517b\u6559\u80b2");
  add(/evidence|source|citation|reference/.test(lower), "\u8bc1\u636e\u4e0e\u6765\u6e90");
  add(/technology|ai|human/.test(lower), "\u6280\u672f\u4e0e\u4eba\u7684\u9700\u8981");
  if (!concepts.length) return "";
  return `${concepts.join("\u3001")}\u4e4b\u95f4\u7684\u5173\u7cfb\u9700\u8981\u5728\u8bd1\u6587\u4e2d\u4fdd\u6301\u6e05\u6670\u3002`;
}
