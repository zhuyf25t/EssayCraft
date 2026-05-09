import { NextResponse } from "next/server";
import type { AssistRequest, AssistResponse, AssistResponseLegacy } from "@/types/essaycraft";
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

      const parsed = coerceAssistResponse(input, JSON.parse(raw), "deepseek");
      const exact = exactAnnotations(input.text, parsed.annotations ?? []);
      const rangeWarning = validateAssistReplaceRange(input, parsed);
      const normalized: AssistResponse = {
        ...parsed,
        providerMode: "deepseek",
        reply: rangeWarning ? parsed.reply : parsed.reply,
        annotations: exact.annotations,
        warnings: rangeWarning ? [...(parsed.warnings ?? []), ...exact.warnings, "Selection changed; preview apply was disabled."] : [...(parsed.warnings ?? []), ...exact.warnings]
      };

      return NextResponse.json(normalized);
    } catch (aiError) {
      const fallback = mockAssist(input);
      console.warn("DeepSeek assistant fallback:", aiError);
      fallback.warnings.push("Provider unavailable; using local fallback.");
      return NextResponse.json(fallback);
    }
  } catch (error) {
    console.warn("Invalid assistant request:", error);
    return NextResponse.json({ error: "Assistant could not use that request." }, { status: 400 });
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

function coerceAssistResponse(input: AssistRequest, raw: unknown, providerMode: "deepseek" | "mock" | "fallback"): AssistResponse {
  const parsed = assistResponseSchema.parse(raw) as AssistResponseLegacy;
  const kind = parsed.kind ?? expectedAssistKind(input);
  const base = {
    reply: parsed.reply,
    title: parsed.title,
    actionType: normalizedActionType(input, parsed.actionType),
    explanation: parsed.explanation,
    providerMode,
    annotations: parsed.annotations ?? [],
    warnings: parsed.warnings ?? []
  };

  if (kind === "edit") {
    if (!parsed.proposedText?.trim() || !parsed.replaceRange) {
      throw new Error("Provider returned an unusable edit preview.");
    }
    const proposedText = sanitizeReplacement(parsed.proposedText, input.selectedText ?? input.text.slice(parsed.replaceRange.start, parsed.replaceRange.end));
    return {
      ...base,
      kind: "edit",
      proposedText,
      replaceRange: parsed.replaceRange,
      originalText: parsed.originalText,
      originalExcerpt: parsed.originalExcerpt
    };
  }

  if (kind === "inspect") {
    return {
      ...base,
      kind: "inspect",
      originalExcerpt: parsed.originalExcerpt
    };
  }

  return {
    ...base,
    kind: "chat"
  };
}

function normalizedActionType(input: AssistRequest, actionType?: string) {
  const action = input.action.toLowerCase();
  if (action.includes("translate")) return "translate-selection";
  if (action.includes("academic")) return "academic-rewrite";
  if (action.includes("rewrite")) return "rewrite-selection";
  if (action.includes("explain")) return "highlight-explanation";
  return actionType;
}

function expectedAssistKind(input: AssistRequest): AssistResponse["kind"] {
  const action = input.action.toLowerCase();
  if (input.selectedRange && /(rewrite|academic|analysis|translate|revise|sentence|passage)/i.test(action)) return "edit";
  if (/(explain|relabel|highlight|citation)/i.test(action)) return "inspect";
  return "chat";
}

function mockAssist(input: AssistRequest): AssistResponse {
  const range = input.selectedRange;
  const selected = input.selectedText || (range ? input.text.slice(range.start, range.end) : input.text);
  const action = input.action.toLowerCase();
  const warnings = ["Provider unavailable; using local mock suggestion."];

  if (action.includes("citation")) {
    return {
      title: "Citation-gap check",
      kind: "inspect",
      actionType: "citation-check",
      reply: "I found citation-risk areas. Evidence claims should keep [citation needed] until you add real source details in source cards.",
      explanation: "This check only marks possible citation gaps. It does not invent authors, dates, titles, or references.",
      annotations: normalizeAnnotations(input.text, buildMockAnnotations(input.text).filter((annotation) => annotation.label === "issue" || annotation.text.includes("[citation needed]"))),
      warnings,
      providerMode: "mock"
    };
  }

  if (action.includes("explain current module")) {
    return {
      title: "Module highlight explanation",
      kind: "chat",
      actionType: "highlight-explanation",
      reply: moduleHighlightSummary(input),
      explanation: "Click inside a specific highlighted sentence for a focused explanation of one color label.",
      annotations: [],
      warnings,
      providerMode: "mock"
    };
  }

  if (action.includes("explain")) {
    return {
      title: "Highlight explanation",
      kind: "inspect",
      actionType: "highlight-explanation",
      originalExcerpt: selected ? excerpt(selected) : undefined,
      reply: selected
        ? explainSelection(selected)
        : "Select a sentence or range first, then ask me to explain the highlight.",
      explanation: selected ? "Use Relabel selected range if the color does not match your intended rhetorical function." : undefined,
      annotations: [],
      warnings,
      providerMode: "mock"
    };
  }

  if (action.includes("relabel")) {
    const label = selected && /because|therefore|this means|supports|shows/i.test(selected) ? "analysis" : "thesis";
    return {
      title: "Relabel preview",
      kind: "inspect",
      actionType: "relabel",
      originalExcerpt: selected ? excerpt(selected) : undefined,
      reply: range
        ? `I prepared a label change for the selected range: ${label}. Apply only if that matches the sentence role.`
        : "Select text first before relabeling a range.",
      annotations: range
        ? [
            {
              id: "assist-relabel",
              start: range.start,
              end: range.end,
              text: input.text.slice(range.start, range.end),
              label,
              confidence: 0.7,
              comment: "Mock relabel suggestion."
            }
          ]
        : [],
      explanation: "Applying this updates annotation metadata only; it does not rewrite the document text.",
      warnings,
      providerMode: "mock"
    };
  }

  if (action.includes("translate")) {
    const translated = mockAssistantChinese(selected || input.text);
    if (range) {
      return {
        title: "Translation preview",
        kind: "edit",
        actionType: "translate-selection",
        originalExcerpt: selected ? excerpt(selected) : undefined,
        reply: "Translation preview ready for the selected text. Apply only if you want to replace that selection.",
        proposedText: translated,
        replaceRange: range,
        annotations: [],
        explanation: "This path is the only translation workflow that can replace text, and it still requires Apply.",
        warnings,
        providerMode: "mock"
      };
    }
    return {
      title: "Translation preview",
      kind: "chat",
      actionType: "translate-selection",
      reply: "Translation preview ready. Select a passage first if you want an applyable replacement.",
      annotations: [],
      explanation: "This chat reply is reference-only and cannot overwrite document text.",
      warnings,
      providerMode: "mock"
    };
  }

  if ((action.includes("rewrite") || action.includes("academic") || action.includes("analysis")) && range) {
    const base = selected.trim() || "This point needs clearer explanation.";
    const proposedText = action.includes("analysis")
      ? strengthenAnalysis(base)
      : rewriteWithInstruction(base, input.action);

    return {
      title: action.includes("analysis") ? "Strengthen analysis preview" : "Rewrite preview",
      kind: "edit",
      actionType: action.includes("analysis") ? "strengthen-analysis" : "rewrite-selection",
      originalExcerpt: excerpt(base),
      reply: "Preview ready. I did not change the document; apply the suggestion only if it matches your intended meaning.",
      proposedText: sanitizeReplacement(proposedText, base),
      replaceRange: range,
      annotations: [],
      explanation: "Cleaner replacement; apply only if it preserves your meaning.",
      warnings,
      providerMode: "mock"
    };
  }

  return {
    title: `Module ${input.moduleNumber} feedback`,
    kind: "chat",
    actionType: "module-feedback",
    reply: moduleFeedback(input),
    explanation: "This is module-level feedback because no text is selected. Select a sentence for an applyable rewrite.",
    annotations: [],
    warnings,
    providerMode: "mock"
  };
}

function rewriteWithInstruction(value: string, instruction: string) {
  const lower = instruction.toLowerCase();
  if (/更长|longer|develop|expand|more detail|更详细/.test(lower)) return makeLongerReplacement(value);
  if (/更短|shorter|concise|简短|精简/.test(lower)) return makeShorterReplacement(value);
  if (/academic|formal|正式|学术/.test(lower)) return makeAcademicReplacement(value);
  return makeAcademicReplacement(value);
}

function moduleFeedback(input: AssistRequest) {
  const text = input.text.trim();
  if (!text) return `Module ${input.moduleNumber} is empty. Add draft text first, then I can comment on structure, clarity, and evidence needs.`;
  const lower = text.toLowerCase();
  if (input.moduleNumber === 1) {
    const hasTopic = /^topic\s*:/im.test(text);
    const hasQuestion = /^(research question|question)\s*:/im.test(text);
    const hasThesis = /(working thesis|thesis)\s*:/i.test(text);
    const reasons = (text.match(/reason\s*\d+\s*:/gi) ?? []).length;
    const strengths = [
      hasTopic ? "clear topic" : "",
      hasQuestion ? "research question" : "",
      hasThesis ? "working thesis" : "",
      reasons ? `${reasons}-part thesis map` : ""
    ].filter(Boolean).join(", ");
    return `Your Module 1 has ${strengths || "the beginning of a topic plan"}. The strongest part is that the essay has a focused direction. A useful improvement is to make the thesis map parallel: each reason should use the same grammatical structure and clearly support the thesis.`;
  }
  if (input.moduleNumber === 2) {
    return "Your research plan is moving in the right direction because it separates argument branches from source needs. The next improvement is to make each evidence need specific enough to search for: name the kind of study, report, data, or policy example that would support each branch.";
  }
  if (input.moduleNumber === 3) {
    return "Your outline gives the draft a workable sequence. The next improvement is to check whether every body paragraph has four parts: a topic sentence, evidence to use, analysis purpose, and a link back to the thesis.";
  }
  if (input.moduleNumber === 4) {
    const citations = (text.match(/\[citation needed\]/gi) ?? []).length;
    return `Your draft is readable as essay prose rather than an outline. The main improvement is evidence integration: ${citations ? `${citations} citation-needed marker(s) still need real sources` : "check that factual claims have citations"}. Also make sure each paragraph ends by linking back to the thesis.`;
  }
  if (input.moduleNumber === 5) {
    return "This module should focus on citation integrity. Check that every in-text citation has a matching source card and every source card used in the reference list is actually cited in the draft.";
  }
  if (lower.includes("final review") || input.moduleNumber === 6) {
    return "Your final review should confirm content, structure, clarity, academic style, proofreading, and citation readiness. If any citation-needed marker remains, the essay is exportable but not submission-ready.";
  }
  return `Your Module ${input.moduleNumber} has usable material. The next improvement is to make the paragraph roles explicit: claim, evidence, analysis, and link back to the thesis.`;
}

function moduleHighlightSummary(input: AssistRequest) {
  const annotations = buildMockAnnotations(input.text);
  const counts = annotations.reduce<Record<string, number>>((acc, annotation) => {
    acc[annotation.label] = (acc[annotation.label] ?? 0) + 1;
    return acc;
  }, {});
  const summary = Object.entries(counts).map(([label, count]) => `${count} ${label}`).join(", ");
  return summary
    ? `The current module contains these local highlight roles: ${summary}. Use the colors to check whether each sentence is doing the job you intended.`
    : "No highlightable text was found yet. Add text or refresh highlighting first.";
}

function explainSelection(value: string) {
  const annotation = buildMockAnnotations(value)[0];
  const label = annotation?.label ?? "plain";
  const trimmed = value.trim();
  if (/^Topic\s*:/i.test(trimmed)) return `This is background because it names the essay's subject: ${shortQuote(trimmed.replace(/^Topic\s*:\s*/i, ""))}.`;
  if (/^(Research question|Question)\s*:/i.test(trimmed)) return "This is background because it frames the guiding question the essay will answer. A strong question should be specific enough to lead toward an arguable thesis.";
  if (/^(Working thesis|Thesis)\s*:/i.test(trimmed) || /this essay argues/i.test(trimmed)) return "This is thesis writing because it states the main arguable claim and signals the essay's direction.";
  if (/^Thesis map\s*:/i.test(trimmed)) return "This maps the thesis because it previews the main reasons the essay will develop.";
  if (/Reason\s*\d+\s*:/i.test(trimmed)) return "This reason belongs to the thesis map: it should clearly support the working thesis and stay parallel with the other reasons.";
  if (/Evidence needed|Evidence to use|\[source needed/i.test(trimmed)) return "This marks a source need. It is a planning reminder to find real evidence, not a real citation.";
  if (/\[citation needed\]/i.test(trimmed)) return "This is an issue because the draft makes a claim that still needs a real source or citation before submission.";
  if (/counterargument|opposing view|some readers may argue/i.test(trimmed)) return "This is counterargument writing because it introduces a reasonable opposing view before the response.";
  if (/conclusion|in conclusion|so what|implication/i.test(trimmed)) return "This is conclusion writing because it closes the argument and explains why the point matters.";
  if (/because|therefore|this shows|this means|supports|matters/i.test(trimmed)) return "This is analysis because it explains how the idea supports the essay's claim rather than simply naming a fact.";
  return `This sentence is currently treated as ${label}. Check whether it is naming context, making a claim, giving evidence, or explaining why the claim matters.`;
}

function shortQuote(value: string) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > 80 ? `${cleaned.slice(0, 77)}...` : cleaned;
}

function excerpt(value: string) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > 220 ? `${cleaned.slice(0, 217)}...` : cleaned;
}

function makeLongerReplacement(value: string) {
  const cleaned = sanitizeReplacement(value, value).replace(/\s+/g, " ").trim();
  const base = /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
  if (/^Research question\s*:/i.test(cleaned) || /^Question\s*:/i.test(cleaned)) {
    const question = cleaned.replace(/^(Research question|Question)\s*:\s*/i, "").replace(/[?？.]?$/, "");
    return `Research question: ${question}, and what responsibilities should individuals, institutions, and communities share in creating a more balanced solution?`;
  }
  if (/^Topic\s*:/i.test(cleaned)) {
    const topic = cleaned.replace(/^Topic\s*:\s*/i, "").replace(/[.!?]?$/, "");
    return `Topic: ${topic}, with attention to causes, consequences, and practical responses that affect students and communities.`;
  }
  if (/^(Working thesis|Thesis)\s*:/i.test(cleaned)) {
    const thesis = cleaned.replace(/^(Working thesis|Thesis)\s*:\s*/i, "");
    return `Working thesis: ${thesis.replace(/[.!?]?$/, "")}, because the issue requires both individual choices and wider social or institutional support.`;
  }
  if (/because|therefore|as a result|this means/i.test(base)) return base;
  return `${base} This point can be developed further by naming the specific cause, explaining its effect, and connecting it back to the essay's central claim.`;
}

function makeShorterReplacement(value: string) {
  const cleaned = sanitizeReplacement(value, value).replace(/\s+/g, " ").trim();
  const prefix = cleaned.match(/^(Topic|Research question|Question|Working thesis|Thesis)\s*:\s*/i)?.[0] ?? "";
  const body = prefix ? cleaned.slice(prefix.length) : cleaned;
  const firstClause = body.split(/[,;]|\band\b|\bbecause\b/i)[0]?.trim() || body.trim();
  const ending = prefix.toLowerCase().includes("question") && !/[?？]$/.test(firstClause) ? "?" : "";
  return `${prefix}${firstClause.replace(/[.!?？]?$/, "")}${ending || (/[.!?]$/.test(firstClause) ? "" : ".")}`;
}

function makeAcademicReplacement(value: string) {
  const cleaned = sanitizeReplacement(value, value);
  if (/^Topic\s*:/i.test(cleaned) || /^Research question\s*:/i.test(cleaned) || /^Working thesis\s*:/i.test(cleaned)) {
    return cleaned
      .replace(/\bkids\b/gi, "young people")
      .replace(/\bgood\b/gi, "beneficial")
      .replace(/\bbad\b/gi, "harmful")
      .replace(/\s+/g, " ");
  }
  return cleaned
    .replace(/\bkids\b/gi, "young people")
    .replace(/\bgood\b/gi, "beneficial")
    .replace(/\bbad\b/gi, "harmful")
    .replace(/\bthings\b/gi, "factors")
    .replace(/\s+/g, " ")
    .trim();
}

function strengthenAnalysis(value: string) {
  const cleaned = sanitizeReplacement(value, value).replace(/\s+/g, " ").trim();
  const sentence = /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
  if (/because|therefore|this (shows|suggests|means|matters)/i.test(sentence)) return sentence;
  return `${sentence} This matters because it explains how the point supports the essay's main claim.`;
}

function sanitizeReplacement(value: string, fallback: string) {
  const cleaned = value
    .replace(/^A more academic version could state:\s*/i, "")
    .replace(/^A more academic version could state\s*/i, "")
    .replace(/^could state:\s*/i, "")
    .replace(/^Here is a revised version:\s*/i, "")
    .replace(/^I would rewrite it as:\s*/i, "")
    .replace(/^This selected text means\s*/i, "")
    .replace(/^The following sentence\s*/i, "")
    .replace(/^In this context, the sentence could be\s*/i, "")
    .replace(/^The student should\s*/i, "")
    .replace(/\s*\[citation needed if this includes factual evidence\]\.?/gi, "")
    .replace(/\s*if this includes factual evidence\.?/gi, "")
    .replace(/This rewrite improves.*$/i, "")
    .trim();
  return cleaned || fallback.trim();
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
