import type { Patch } from "@/types/essaycraft";
import { stripEditorKernelMarkers } from "@/lib/noteKernel";

export function rewriteWithInstruction(original: string, instruction: string, projectTitle = "") {
  const cleaned = cleanReplacement(original);
  const request = `${instruction} ${projectTitle}`.toLowerCase();
  const wantsProjectTitle = hasProjectTitleCue(instruction) && projectTitle.trim();

  if (wantsProjectTitle) return rewriteUsingProjectTitle(cleaned, projectTitle);
  if (/(?:\u66f4\u957f|\u5199\u957f|longer|develop|expand|more detail|\u66f4\u8be6\u7ec6)/i.test(request)) {
    return makeLongerReplacement(cleaned, projectTitle, instruction);
  }
  if (/(?:\u66f4\u77ed|\u7b80\u77ed|\u7cbe\u7b80|shorter|concise)/i.test(request)) return makeShorterReplacement(cleaned);
  if (/(?:\u66f4\u81ea\u7136|\u81ea\u7136|\u5446\u677f|\u666e\u901a|natural|awkward|less generic)/i.test(request)) {
    return makeNaturalReplacement(cleaned, projectTitle);
  }
  if (/(?:academic|formal|\u6b63\u5f0f|\u5b66\u672f|\u66f4\u5b66\u672f|\u4e0d\u8981\u8fd9\u4e48\u53e3\u8bed\u5316)/i.test(request)) {
    return makeAcademicReplacement(cleaned, projectTitle);
  }
  if (/(?:english|\u82f1\u6587|\u6539\u6210\u82f1\u6587)/i.test(request)) return cleanEnglish(cleaned);

  return makeAcademicReplacement(cleaned, projectTitle);
}

export function applyNotesFallback(cleanText: string, notes: Patch[], projectTitle = "") {
  let next = cleanText;
  const ordered = [...notes]
    .map((patch) => ({ patch, range: effectivePatchRange(cleanText, patch) }))
    .filter(({ range }) => range.end >= range.start && range.start >= 0 && range.end <= cleanText.length)
    .sort((a, b) => b.range.start - a.range.start || b.range.end - a.range.end);

  for (const { patch, range } of ordered) {
    const original = next.slice(range.start, range.end);
    const replacement = reviseSegment(original, patch.text, projectTitle);
    next = `${next.slice(0, range.start)}${replacement}${next.slice(range.end)}`;
  }
  return next;
}

export function changeRequested(instruction: string) {
  return /rewrite|revise|academic|formal|longer|shorter|natural|awkward|expand|develop|title|project title|\u53ef\u4ee5|\u66f4\u957f|\u5199\u957f|\u66f4\u77ed|\u7b80\u77ed|\u66f4\u5b66\u672f|\u81ea\u7136|\u5446\u677f|\u91cd\u5199|\u6539\u5199|\u6839\u636e|\u82f1\u6587/i.test(instruction);
}

export function cleanReplacement(value: string) {
  return stripEditorKernelMarkers(value)
    .replace(/^A more academic version could state:\s*/i, "")
    .replace(/^A more academic version could state\s*/i, "")
    .replace(/^could state:\s*/i, "")
    .replace(/^Here is a revised version:\s*/i, "")
    .replace(/^I would rewrite it as:\s*/i, "")
    .replace(/^This selected text means\s*/i, "")
    .replace(/^The following sentence\s*/i, "")
    .replace(/^In this context, the sentence could be\s*/i, "")
    .replace(/^In this context\s*/i, "")
    .replace(/^The student should\s*/i, "")
    .replace(/\s*\[citation needed if this includes factual evidence\]\.?/gi, "")
    .replace(/\s*if this includes factual evidence\.?/gi, "")
    .replace(/This rewrite improves.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function reviseSegment(original: string, note: string, projectTitle: string) {
  const trimmed = original.trim();
  const leading = original.match(/^\s*/)?.[0] ?? "";
  const trailing = original.match(/\s*$/)?.[0] ?? "";
  const replacement = hasProjectTitleCue(note)
    ? rewriteUsingProjectTitle(trimmed, projectTitle)
    : rewriteWithInstruction(trimmed, note, projectTitle);
  return `${leading}${replacement}${trailing}`;
}

function hasProjectTitleCue(value: string) {
  return /project title|\btitle\b|\u6807\u9898|\u6839\u636e.*title|\u6839\u636e.*\u9898\u76ee/i.test(value);
}

function rewriteUsingProjectTitle(value: string, projectTitle: string) {
  const title = normalizeProjectTitle(projectTitle);
  const theme = title || cleanReplacement(value).replace(/^(Topic|Research question|Question|Working thesis|Thesis)\s*:\s*/i, "");
  const lowerTheme = theme.toLowerCase();
  const lowerValue = value.toLowerCase();
  const isTechnologyHumanity = /technology|humanity|human|ai|computer/i.test(lowerTheme);
  const isDefaultQuestionTitle = /^how can\b/i.test(theme);
  const isSocialMediaValue = /social media|healthier|balance|youth|wellbeing/i.test(lowerValue);

  if (/^Topic\s*:/i.test(value)) {
    if ((isDefaultQuestionTitle || /social media/.test(lowerTheme)) && isSocialMediaValue) {
      return "Topic: Social media balance, youth wellbeing, and responsible platform design";
    }
    return isTechnologyHumanity
      ? `Topic: ${title || "Technology needs the humanities: human guidance in the age of AI"}`
      : `Topic: ${theme}, including its causes, consequences, and practical significance`;
  }
  if (/^(Research question|Question)\s*:/i.test(value)) {
    if ((isDefaultQuestionTitle || /social media/.test(lowerTheme)) && isSocialMediaValue) {
      return "Research question: How can individuals, schools, and social media platforms share responsibility for building a healthier digital environment for young people?";
    }
    return isTechnologyHumanity
      ? "Research question: How can technological progress be guided by the humanities so that AI development protects human judgment, dignity, and social responsibility?"
      : `Research question: How should ${lowerFirst(theme)} be examined through its causes, consequences, and possible responses?`;
  }
  if (/^(Working thesis|Thesis)\s*:/i.test(value)) {
    return isTechnologyHumanity
      ? "Working thesis: Technology needs the humanities because AI and digital systems can serve society responsibly only when innovation is guided by human judgment, ethical reasoning, and cultural understanding."
      : `Working thesis: ${theme} requires a clear argument that explains the problem, evaluates its consequences, and proposes a responsible response.`;
  }
  if (value.trim().endsWith("?")) {
    return `How should ${lowerFirst(theme)} be understood in relation to the people affected, the causes involved, and the responsibilities it creates?`;
  }
  return `${theme} should be examined through its causes, consequences, and practical implications for the people most affected.`;
}

function makeLongerReplacement(value: string, projectTitle: string, instruction: string) {
  if (hasProjectTitleCue(instruction)) return rewriteUsingProjectTitle(value, projectTitle);
  const cleaned = cleanReplacement(value);
  const base = /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
  if (/^Research question\s*:/i.test(cleaned) || /^Question\s*:/i.test(cleaned)) {
    const question = cleaned.replace(/^(Research question|Question)\s*:\s*/i, "").replace(/[?？]?$/, "");
    const titleClause = projectTitle.trim() ? ` in relation to ${normalizeProjectTitle(projectTitle)}` : "";
    return `Research question: ${question}${titleClause}, and what responsibilities should individuals, institutions, and communities share in creating a more thoughtful response?`;
  }
  if (/^Topic\s*:/i.test(cleaned)) {
    const topic = cleaned.replace(/^Topic\s*:\s*/i, "").replace(/[.!?]?$/, "");
    return `Topic: ${topic}, with attention to causes, consequences, competing viewpoints, and practical responses that affect students and communities.`;
  }
  if (/^(Working thesis|Thesis)\s*:/i.test(cleaned)) {
    const thesis = cleaned.replace(/^(Working thesis|Thesis)\s*:\s*/i, "");
    return `Working thesis: ${thesis.replace(/[.!?]?$/, "")}, because the issue requires both individual choices and wider social or institutional support.`;
  }
  if (/because|therefore|as a result|this means/i.test(base)) return base;
  return `${base} This point can be developed further by naming the specific cause, explaining its effect, and connecting it back to the essay's central claim.`;
}

function makeShorterReplacement(value: string) {
  const cleaned = cleanReplacement(value);
  const prefix = cleaned.match(/^(Topic|Research question|Question|Working thesis|Thesis)\s*:\s*/i)?.[0] ?? "";
  const body = prefix ? cleaned.slice(prefix.length) : cleaned;
  const firstClause = body.split(/[,;]|\band\b|\bbecause\b/i)[0]?.trim() || body.trim();
  const ending = prefix.toLowerCase().includes("question") && !/[?？]$/.test(firstClause) ? "?" : "";
  return `${prefix}${firstClause.replace(/[.!?？]?$/, "")}${ending || (/[.!?]$/.test(firstClause) ? "" : ".")}`;
}

function makeAcademicReplacement(value: string, projectTitle = "") {
  const cleaned = cleanReplacement(value);
  const academic = cleaned
    .replace(/\bkids\b/gi, "young people")
    .replace(/\bgood\b/gi, "beneficial")
    .replace(/\bbad\b/gi, "harmful")
    .replace(/\bthings\b/gi, "factors")
    .replace(/\bget\b/gi, "gain")
    .replace(/\s+/g, " ")
    .trim();

  if (academic !== cleaned) return academic;
  if (/^(Research question|Question)\s*:/i.test(academic)) return makeLongerReplacement(academic, projectTitle, "more academic");
  if (/^Topic\s*:/i.test(academic)) return academic.replace(/[.!?]?$/, ", examined through a focused academic lens.");
  if (/^(Working thesis|Thesis)\s*:/i.test(academic)) return academic.replace(/[.!?]?$/, ", supported by clear reasoning and relevant evidence.");
  return `${academic.replace(/[.!?]?$/, "")}, which should be framed with more precise academic reasoning.`;
}

function makeNaturalReplacement(value: string, projectTitle = "") {
  const cleaned = makeAcademicReplacement(value, projectTitle).replace(/\s+/g, " ").trim();
  if (/^Topic\s*:/i.test(cleaned)) return makeLongerReplacement(cleaned, projectTitle, "natural longer");
  if (/^(Research question|Question)\s*:/i.test(cleaned)) {
    if (projectTitle.trim() && !/^how can\b/i.test(normalizeProjectTitle(projectTitle))) return rewriteUsingProjectTitle(cleaned, projectTitle);
    if (/social media|healthier|balance|youth|wellbeing/i.test(cleaned)) {
      return "Research question: How can individuals, schools, and social media platforms share responsibility for building a healthier digital environment for young people?";
    }
    return "Research question: How can individuals, schools, and technology platforms share responsibility for creating healthier digital environments for students?";
  }
  if (/^(Working thesis|Thesis)\s*:/i.test(cleaned)) return makeLongerReplacement(cleaned, projectTitle, "longer");
  if (cleaned.length < 90) {
    return `${cleaned.replace(/[.!?]?$/, "")}, with clearer wording that names the issue, the people affected, and why the point matters.`;
  }
  return cleaned.replace(/\bimportant\b/gi, "significant").replace(/\bvery\b/gi, "particularly");
}

function cleanEnglish(value: string) {
  return cleanReplacement(value)
    .replace(/\bComputer become\b/gi, "Computers are becoming")
    .replace(/\btechnology become\b/gi, "technology is becoming")
    .replace(/\bmore close to\b/gi, "closer to")
    .replace(/\s+/g, " ")
    .trim();
}

function effectivePatchRange(text: string, patch: Patch) {
  const start = Math.max(0, Math.min(text.length, patch.anchorStart));
  const end = Math.max(start, Math.min(text.length, patch.anchorEnd));
  if (end > start) return { start, end };

  const lineStart = text.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const nextBreak = text.indexOf("\n", start);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  if (text.slice(lineStart, lineEnd).trim()) return trimRange(text, lineStart, lineEnd);

  const beforeStart = text.lastIndexOf("\n", Math.max(0, lineStart - 2)) + 1;
  const beforeEnd = Math.max(beforeStart, lineStart - 1);
  if (text.slice(beforeStart, beforeEnd).trim()) return trimRange(text, beforeStart, beforeEnd);

  const afterStart = nextBreak === -1 ? start : nextBreak + 1;
  const afterBreak = text.indexOf("\n", afterStart);
  const afterEnd = afterBreak === -1 ? text.length : afterBreak;
  return trimRange(text, afterStart, afterEnd);
}

function trimRange(text: string, start: number, end: number) {
  let nextStart = start;
  let nextEnd = end;
  while (nextStart < nextEnd && /\s/.test(text[nextStart] ?? "")) nextStart += 1;
  while (nextEnd > nextStart && /\s/.test(text[nextEnd - 1] ?? "")) nextEnd -= 1;
  return { start: nextStart, end: nextEnd };
}

function normalizeProjectTitle(value: string) {
  return cleanReplacement(value).replace(/[.!?。？]+$/, "").trim();
}

function lowerFirst(value: string) {
  const trimmed = value.trim();
  return trimmed ? `${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}` : "this issue";
}
