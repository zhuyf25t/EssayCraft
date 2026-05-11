import type { AssistRequest, AssistResponse } from "@/types/essaycraft";
import { buildCitationCheckReply, buildContextualModuleFeedback } from "@/lib/assistFallback";
import { buildMockAnnotations, normalizeAnnotations } from "@/lib/annotations";
import { normalizedForNoopCompare } from "@/lib/noteKernel";
import { changeRequested, cleanReplacement, rewriteWithInstruction } from "@/lib/rewriteFallback";

function isEditAction(action: string) {
  return /(rewrite|academic|revise|sentence|passage|formal|longer|shorter|natural|awkward|\u91cd\u5199|\u6539\u5199|\u66f4\u5b66\u672f|\u5b66\u672f|\u6b63\u5f0f|\u66f4\u957f|\u5199\u957f|\u66f4\u77ed|\u7b80\u77ed|\u81ea\u7136|\u5446\u677f|\u6839\u636e.*title|\u6839\u636e.*\u6807\u9898)/i.test(action);
}

function isAnalyzeAction(action: string) {
  return /(analy[sz]e|critique|comment|grammar|rhetorical role|\u5206\u6790|\u8bc4\u4ef7|\u70b9\u8bc4|\u7528\u4e2d\u6587)/i.test(action);
}

export function mockAssist(input: AssistRequest): AssistResponse {
  const range = input.selectedRange;
  const selected = input.selectedText || (range ? input.text.slice(range.start, range.end) : input.text);
  const action = input.action.toLowerCase();
  const warnings: string[] = [];

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

  if (isAnalyzeAction(input.action)) {
    return {
      title: "Analysis",
      kind: "inspect",
      actionType: "analyze-selection",
      originalExcerpt: selected ? excerpt(selected) : undefined,
      reply: selected
        ? analyzeSelection(selected, input.action, input)
        : "Click a sentence or select text first, then ask for analysis.",
      explanation: "Read-only analysis. It does not change the document.",
      annotations: [],
      warnings,
      providerMode: "mock"
    };
  }

  if (action.includes("explain")) {
    const active = findSelectedAnnotation(input);
    return {
      title: "Highlight explanation",
      kind: "inspect",
      actionType: "highlight-explanation",
      originalExcerpt: selected ? excerpt(selected) : undefined,
      reply: selected
        ? explainSelection(selected, active)
        : "Select a sentence or range first, then ask me to explain the highlight.",
      explanation: selected ? "Read-only explanation. It does not change the document." : undefined,
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
    return {
      title: "Translation preview",
      kind: "inspect",
      actionType: "translate-selection",
      originalExcerpt: selected ? excerpt(selected) : undefined,
      reply: translated,
      annotations: [],
      explanation: "Read-only translation. Copy it if useful; EssayCraft will not replace the document from Translate.",
      warnings,
      providerMode: "mock"
    };
  }

  if (isEditAction(action) && range && !action.includes("translate")) {
    const base = selected.trim() || "This point needs clearer explanation.";
    const noteInstruction = selectedPatchInstruction(input);
    const actionWithNotes = noteInstruction ? `${input.action}\nSelection notes: ${noteInstruction}` : input.action;
    const proposedText = action.includes("analysis")
      ? strengthenAnalysis(base)
      : rewriteWithInstruction(base, actionWithNotes, input.projectTitle || input.topic);
    const safeProposed = normalizedForNoopCompare(proposedText) === normalizedForNoopCompare(base) && changeRequested(input.action)
      ? rewriteWithInstruction(base, `${actionWithNotes} longer project title`, input.projectTitle || input.topic)
      : proposedText;

    return {
      title: action.includes("analysis") ? "Strengthen analysis preview" : "Rewrite preview",
      kind: "edit",
      actionType: action.includes("analysis") ? "strengthen-analysis" : "rewrite-selection",
      originalExcerpt: excerpt(base),
      reply: "Preview ready. I did not change the document; apply the suggestion only if it matches your intended meaning.",
      proposedText: sanitizeReplacement(safeProposed, base),
      replaceRange: range,
      annotations: [],
      explanation: "Cleaner replacement; apply only if it preserves your meaning.",
      warnings,
      providerMode: "mock"
    };
  }

  if (action.includes("citation")) {
    return {
      title: "Citation-gap check",
      kind: "inspect",
      actionType: "citation-check",
      reply: buildCitationCheckReply(input),
      explanation: "This check only marks possible citation gaps. It does not invent authors, dates, titles, or references.",
      annotations: normalizeAnnotations(input.text, buildMockAnnotations(input.text).filter((annotation) => annotation.label === "issue" || annotation.text.includes("[citation needed]"))),
      warnings,
      providerMode: "mock"
    };
  }

  return {
    title: `Module ${input.moduleNumber} feedback`,
    kind: "chat",
    actionType: "module-feedback",
    reply: buildContextualModuleFeedback(input),
    explanation: "Chat is read-only. Use Edit for preview/apply changes.",
    annotations: [],
    warnings,
    providerMode: "mock"
  };
}

function selectedPatchInstruction(input: AssistRequest) {
  return (input.selectedPatches ?? [])
    .filter((patch) => !patch.resolved && patch.status !== "resolved" && !patch.stale && patch.text.trim())
    .map((patch) => patch.text.trim())
    .join("\n");
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

function findSelectedAnnotation(input: AssistRequest) {
  if (!input.selectedRange) return undefined;
  return input.annotations.find((annotation) =>
    annotation.start < input.selectedRange!.end && input.selectedRange!.start < annotation.end
  );
}

function explainSelection(value: string, active?: AssistRequest["annotations"][number]) {
  const annotation = active ?? buildMockAnnotations(value)[0];
  const label = annotation?.label ?? "plain";
  const trimmed = value.trim();
  const quote = shortQuote(trimmed);
  const labelName = label.charAt(0).toUpperCase() + label.slice(1);
  const comment = annotation?.comment ? ` Current note: ${annotation.comment}` : "";
  if (/^Topic\s*:/i.test(trimmed)) return `This is marked as ${labelName} because "${quote}" sets the essay's topic and scope. If it starts making a debatable claim, it may belong closer to Thesis.`;
  if (/^(Research question|Question)\s*:/i.test(trimmed)) return `This is marked as ${labelName} because "${quote}" frames the question the essay must answer, not evidence by itself.`;
  if (/^(Working thesis|Thesis)\s*:/i.test(trimmed) || /this essay argues/i.test(trimmed)) return `This is marked as ${labelName} because "${quote}" states or points toward the essay's central arguable claim.`;
  if (/^Thesis map\s*:/i.test(trimmed) || /Reason\s*\d+\s*:/i.test(trimmed)) return `This is marked as ${labelName} because "${quote}" previews a main reason that should support the thesis.`;
  if (/Evidence needed|Evidence to use|\[source needed/i.test(trimmed)) return `This is marked as ${labelName} because "${quote}" names evidence the student still needs to find; it is a planning cue, not a real citation.`;
  if (/\[citation needed\]/i.test(trimmed) || label === "citation" || label === "issue") return `This is marked as ${labelName} because "${quote}" contains a source-support concern. If the sentence is doing argumentative work, treat its role separately from the citation marker and keep source details in source cards.${comment}`;
  if (/counterargument|opposing view|some readers may argue/i.test(trimmed)) return `This is marked as ${labelName} because "${quote}" introduces or signals an opposing view before the response.`;
  if (/conclusion|in conclusion|so what|implication/i.test(trimmed)) return `This is marked as ${labelName} because "${quote}" closes the argument or explains why it matters.`;
  if (/because|therefore|this shows|this means|supports|matters/i.test(trimmed)) return `This is marked as ${labelName} because "${quote}" explains why a point matters for the essay's claim.`;
  return `This is marked as ${labelName} because of the role this sentence appears to play: "${quote}". Check whether it is context, claim, evidence, analysis, or a citation issue.`;
}

function analyzeSelection(value: string, action: string, input: AssistRequest) {
  const trimmed = value.trim();
  const quote = shortQuote(trimmed);
  const wantsChinese = /[\u4e00-\u9fff]|用中文|中文/.test(action);
  const active = findSelectedAnnotation(input);
  const label = active?.label;
  const title = normalizeAssistantTitle(input.projectTitle || input.topic);
  const titlePhrase = title ? ` Project title: "${title}".` : "";
  const focus = analysisFocus(trimmed, label, title);
  const noteCount = (input.selectedPatches ?? []).filter((patch) => !patch.resolved && patch.status !== "resolved" && !patch.stale && patch.text.trim()).length;
  const notePhrase = noteCount ? ` This selection also includes ${noteCount} note${noteCount === 1 ? "" : "s"} that should be treated as revision instructions, not essay text.` : "";
  if (wantsChinese) {
    const role = label ? `它目前更像是“${label}”功能` : "它需要先判断在段落中的功能";
    const chineseFocus = /grammar|语法|proofread|润色/.test(action)
      ? "语法和表达上，建议检查句子是否过长、主谓是否清楚，以及关键词是否重复。"
      : `${focus} 建议把它和中心论点的关系说得更明确，并补足必要的证据或分析。`;
    const chineseTitle = title ? `项目题目是“${title}”。` : "";
    const chineseNotes = noteCount ? `这个选区还有 ${noteCount} 条 note，它们会作为修改指令，不算正文。` : "";
    return `这句话是：“${quote}”。${chineseTitle}${role}。${chineseFocus}${chineseNotes} 如果你想修改它，可以用 Rewrite 或 Academic；Analyze 只提供评论，不会改正文。`;
  }
  if (/grammar|proofread|punctuation/i.test(action)) {
    return `This passage says: "${quote}".${titlePhrase} Grammar check: look for sentence length, clear subject-verb structure, and repeated wording.${notePhrase} Analyze is read-only; use Rewrite or Academic for a replacement preview.`;
  }
  if (/critique|evaluate|what do you think/i.test(action)) {
    return `This passage says: "${quote}".${titlePhrase} ${focus} It should more clearly connect its claim to the essay's main argument and name what evidence or reasoning supports it.${notePhrase}`;
  }
  return `This passage says: "${quote}".${titlePhrase} Its likely role is ${label ?? "a draft sentence"}. ${focus} Check whether it gives context, states a claim, supplies evidence, or explains why the point matters.${notePhrase}`;
}

function analysisFocus(value: string, label: string | undefined, projectTitle: string) {
  const lower = value.toLowerCase();
  const titleLower = projectTitle.toLowerCase();
  if (/\[citation needed\]|\([A-Z][A-Za-z' .&-]+,\s*\d{4}[a-z]?\)/.test(value) || label === "citation" || label === "issue") {
    return "The key issue is source support: keep citation markers until a real source card can support the factual claim.";
  }
  if (/technology|human|ai|computer/.test(lower) || /technology|humanity|human|ai/.test(titleLower)) {
    return "The strongest direction is to connect the sentence to human agency, ethical responsibility, or the social effect of technology.";
  }
  if (/because|therefore|this means|this shows|suggests|matters/.test(lower) || label === "analysis") {
    return "The sentence is trying to explain significance; make the cause-effect link explicit.";
  }
  if (/argues|should|must|thesis/.test(lower) || label === "thesis") {
    return "The sentence is close to a claim; make sure it is debatable and specific enough to guide the paragraph.";
  }
  if (/research|study|data|evidence|found/.test(lower) || label === "evidence") {
    return "The sentence is evidence-oriented; make the source status and connection to the claim clear.";
  }
  return "The sentence needs a clearer job in the paragraph.";
}

function normalizeAssistantTitle(value: string) {
  return cleanReplacement(value).replace(/[.!?]+$/, "").trim();
}

function shortQuote(value: string) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > 80 ? `${cleaned.slice(0, 77)}...` : cleaned;
}

function excerpt(value: string) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > 220 ? `${cleaned.slice(0, 217)}...` : cleaned;
}

function strengthenAnalysis(value: string) {
  const cleaned = sanitizeReplacement(value, value).replace(/\s+/g, " ").trim();
  const sentence = /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
  if (/because|therefore|this (shows|suggests|means|matters)/i.test(sentence)) return sentence;
  return `${sentence} This matters because it explains how the point supports the essay's main claim.`;
}

export function sanitizeReplacement(value: string, fallback: string) {
  const cleaned = cleanReplacement(value);
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
      return concepts || "\u6240\u9009\u5185\u5bb9\u9700\u8981\u7ed3\u5408\u4e0a\u4e0b\u6587\u8868\u8fbe\u4e3a\u6e05\u6670\u7684\u4e2d\u6587\u3002";
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
  if (/requires|need|needs/.test(lower)) return `${concepts.join("\u3001")}\u9700\u8981\u88ab\u6e05\u6670\u5730\u8bf4\u660e\u3002`;
  if (/question|how can/.test(lower)) return `\u5982\u4f55\u5728${concepts.join("\u3001")}\u4e4b\u95f4\u5efa\u7acb\u66f4\u5065\u5eb7\u7684\u5173\u7cfb\uff1f`;
  return concepts.join("\u3001");
}
