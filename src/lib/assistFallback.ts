import type { AssistRequest, ModuleNumber, Patch, SourceCard } from "@/types/essaycraft";
import { stripEditorKernelMarkers } from "@/lib/noteKernel";
import { cleanReplacement } from "@/lib/rewriteFallback";

type ModuleFacts = {
  title: string;
  text: string;
  topicLine: string;
  questionLine: string;
  thesisLine: string;
  paragraphCount: number;
  reasonCount: number;
  citationNeeds: number;
  sourceNeeds: number;
  inTextCitations: number;
  realSourceCards: number;
  placeholderSources: number;
  relevantNotes: Patch[];
  openNotes: Patch[];
};

export function buildContextualModuleFeedback(input: AssistRequest) {
  const facts = collectModuleFacts(input);
  if (wantsChinese(input.action)) return buildChineseModuleFeedback(input, facts);
  if (asksAboutCitations(input.action)) return buildCitationCheckReply(input);

  const titleClause = facts.title ? `For "${facts.title}", ` : "";
  if (!facts.text) {
    return `${titleClause}Module ${input.moduleNumber} is empty. Add your own notes first; then I can respond to the actual topic, question, thesis, evidence, and citation state.`;
  }

  return [
    `${titleClause}Module ${input.moduleNumber} currently has ${englishFactSummary(facts)}.`,
    directQuestionFocus(input.action, facts),
    `Next, ${modulePriority(input.moduleNumber, facts)}`,
    noteContextSentence(input, facts)
  ].filter(Boolean).join(" ");
}

export function buildCitationCheckReply(input: AssistRequest) {
  const facts = collectModuleFacts(input);
  if (wantsChinese(input.action)) {
    const title = facts.title ? `\u9879\u76ee\u9898\u76ee\u300a${facts.title}\u300b` : `Module ${input.moduleNumber}`;
    const gaps = facts.citationNeeds
      ? `\u6211\u770b\u5230 ${facts.citationNeeds} \u4e2a [citation needed] \u6807\u8bb0\uff0c\u9700\u8981\u4fdd\u7559\u5230\u4f60\u6dfb\u52a0\u771f\u5b9e\u6765\u6e90\u3002`
      : "\u6211\u6ca1\u6709\u770b\u5230\u660e\u663e\u7684 [citation needed] \u6807\u8bb0\uff0c\u4f46\u4ecd\u8981\u624b\u52a8\u6838\u5bf9\u4e8b\u5b9e\u6027\u8868\u8ff0\u3002";
    const cards = facts.realSourceCards
      ? `\u5df2\u6709 ${facts.realSourceCards} \u5f20\u5b66\u751f\u586b\u5199\u7684\u6765\u6e90\u5361\u3002`
      : "\u8fd8\u6ca1\u6709\u53ef\u7528\u7684\u771f\u5b9e\u6765\u6e90\u5361\u3002";
    return `${title}\u7684\u5f15\u7528\u68c0\u67e5\uff1a${gaps} ${cards}\u4e0d\u8981\u8ba9 EssayCraft \u865a\u6784\u4f5c\u8005\u3001\u5e74\u4efd\u3001\u6807\u9898\u6216 DOI\u3002`;
  }

  const titleClause = facts.title ? `For "${facts.title}" in Module ${input.moduleNumber}, ` : `In Module ${input.moduleNumber}, `;
  const gaps = facts.citationNeeds
    ? `I found ${facts.citationNeeds} [citation needed] marker(s) that should stay until you add real source details.`
    : "I did not find an explicit [citation needed] marker, but factual claims still need a manual source check.";
  const cards = facts.realSourceCards
    ? `${facts.realSourceCards} real source card(s) are available; match each in-text citation to one of them.`
    : "No complete real source card is available yet, so do not format a final reference entry from this fallback.";
  const sourceNeeds = facts.sourceNeeds ? ` I also see ${facts.sourceNeeds} [source needed] planning cue(s); those are research tasks, not finished citations.` : "";
  return `${titleClause}${gaps} ${cards}${sourceNeeds}`;
}

export function relevantOpenNotesForAssist(input: AssistRequest) {
  const submitted = (input.selectedPatches ?? []).filter(isOpenNote);
  if (submitted.length) return submitted;
  const open = input.patches.filter(isOpenNote);
  if (!input.selectedRange) return open;
  return open.filter((patch) => rangesOverlap(patch.anchorStart, patch.anchorEnd, input.selectedRange!.start, input.selectedRange!.end));
}

function collectModuleFacts(input: AssistRequest): ModuleFacts {
  const text = stripEditorKernelMarkers(input.text).trim();
  const sourceCounts = countSources(input.sources);
  return {
    title: normalizeTitle(input.projectTitle || input.topic),
    text,
    topicLine: lineAfterLabel(text, /^(?:topic)\s*:\s*(.+)$/im),
    questionLine: lineAfterLabel(text, /^(?:research question|question)\s*:\s*(.+)$/im),
    thesisLine: lineAfterLabel(text, /^(?:working thesis|thesis)\s*:\s*(.+)$/im),
    paragraphCount: text.split(/\n\s*\n/).filter((paragraph) => paragraph.trim()).length,
    reasonCount: (text.match(/^[-*]?\s*reason\s*\d+\s*:/gim) ?? []).length,
    citationNeeds: (text.match(/\[citation needed\]/gi) ?? []).length,
    sourceNeeds: (text.match(/\[source needed(?::[^\]]*)?\]/gi) ?? []).length,
    inTextCitations: (text.match(/\([A-Z][A-Za-z' .&-]+,\s*\d{4}[a-z]?\)/g) ?? []).length,
    realSourceCards: sourceCounts.real,
    placeholderSources: sourceCounts.placeholder,
    relevantNotes: relevantOpenNotesForAssist(input),
    openNotes: input.patches.filter(isOpenNote)
  };
}

function englishFactSummary(facts: ModuleFacts) {
  const parts = [
    facts.paragraphCount ? `${facts.paragraphCount} paragraph block(s)` : "",
    facts.questionLine ? "a research question" : "",
    facts.thesisLine ? "a working thesis" : "",
    facts.reasonCount ? `${facts.reasonCount} reason line(s)` : "",
    facts.citationNeeds ? `${facts.citationNeeds} citation-needed marker(s)` : "",
    facts.sourceNeeds ? `${facts.sourceNeeds} source-needed cue(s)` : "",
    facts.realSourceCards ? `${facts.realSourceCards} real source card(s)` : ""
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "early notes that still need clearer academic roles";
}

function directQuestionFocus(action: string, facts: ModuleFacts) {
  const cleaned = action.trim();
  if (asksAboutStructure(cleaned)) {
    return facts.thesisLine
      ? `Structurally, keep the thesis "${shortQuote(facts.thesisLine)}" visible in each body paragraph.`
      : "Structurally, add a clear thesis before expanding body paragraphs.";
  }
  if (asksAboutEvidence(cleaned)) {
    return facts.citationNeeds || facts.sourceNeeds
      ? "For evidence, convert each source-needed or citation-needed marker into a searchable source-card task."
      : "For evidence, check that each factual claim names where support will come from.";
  }
  if (/what should|improve|next|feedback|help|should i/i.test(cleaned)) {
    if (facts.questionLine) return `The current question is "${shortQuote(facts.questionLine)}", so the feedback should stay tied to that focus.`;
    if (facts.topicLine) return `The current topic is "${shortQuote(facts.topicLine)}", so the next edit should make the research question more precise.`;
  }
  return facts.questionLine
    ? `I am using the current question "${shortQuote(facts.questionLine)}" as the context for this reply.`
    : "I am using the current module text rather than a generic assistant template.";
}

function modulePriority(moduleNumber: ModuleNumber, facts: ModuleFacts) {
  if (moduleNumber === 1) {
    if (!facts.questionLine) return "write one focused research question that names the problem, people affected, and arguable tension.";
    if (!facts.thesisLine) return "turn the question into a debatable working thesis with two or three clear reasons.";
    if (facts.reasonCount < 2) return "make the thesis map more parallel by adding at least two support reasons.";
    return "tighten the thesis map so each reason directly answers the research question.";
  }
  if (moduleNumber === 2) {
    if (facts.sourceNeeds || !facts.realSourceCards) return "make each evidence need searchable by naming a study type, data source, report, policy example, or keyword set.";
    return "link every source card to the argument branch it supports.";
  }
  if (moduleNumber === 3) return "check that each body paragraph plan has a topic sentence, evidence to use, analysis purpose, and link back to the thesis.";
  if (moduleNumber === 4) {
    if (facts.citationNeeds) return "resolve citation-needed claims with real source cards, then strengthen the analysis after each evidence sentence.";
    return "revise paragraph endings so each one explains how the evidence supports the thesis.";
  }
  if (moduleNumber === 5) return "compare in-text citations, source cards, and the reference list as three separate checks; do not invent missing metadata.";
  return "run a final pass for thesis alignment, paragraph order, sentence clarity, citation readiness, and conclusion strength.";
}

function noteContextSentence(input: AssistRequest, facts: ModuleFacts) {
  if (!facts.openNotes.length) return "";
  if (input.selectedRange && !facts.relevantNotes.length) return "";
  const selected = input.selectedRange && facts.relevantNotes.length < facts.openNotes.length;
  const note = facts.relevantNotes[0]?.text.trim();
  const scope = selected ? "The selected range has" : "The module has";
  const count = selected ? facts.relevantNotes.length : facts.openNotes.length;
  return note
    ? `${scope} ${count} open note(s); treat "${shortQuote(note)}" as an instruction, not essay text.`
    : `${scope} ${count} open note(s); apply them through a preview before resolving them.`;
}

function buildChineseModuleFeedback(input: AssistRequest, facts: ModuleFacts) {
  const title = facts.title ? `\u9879\u76ee\u9898\u76ee\u300a${facts.title}\u300b` : `Module ${input.moduleNumber}`;
  if (!facts.text) {
    return `${title}\u76ee\u524d\u8fd8\u6ca1\u6709\u6b63\u6587\u3002\u5148\u5199\u51fa\u4f60\u81ea\u5df1\u7684\u4e3b\u9898\u3001\u95ee\u9898\u6216\u8bba\u70b9\uff0c\u7136\u540e\u6211\u518d\u6839\u636e\u6587\u672c\u7ed9\u5177\u4f53\u5efa\u8bae\u3002`;
  }

  const question = facts.questionLine ? `\u76ee\u524d\u7684\u7814\u7a76\u95ee\u9898\u662f\u201c${shortQuote(facts.questionLine)}\u201d\u3002` : "\u76ee\u524d\u8fd8\u9700\u8981\u66f4\u660e\u786e\u7684\u7814\u7a76\u95ee\u9898\u3002";
  const thesis = facts.thesisLine ? `\u8bba\u70b9\u662f\u201c${shortQuote(facts.thesisLine)}\u201d\u3002` : "\u4e0b\u4e00\u6b65\u8981\u628a\u95ee\u9898\u53d8\u6210\u53ef\u4e89\u8bba\u7684\u8bba\u70b9\u3002";
  const citation = facts.citationNeeds
    ? `\u6211\u8fd8\u770b\u5230 ${facts.citationNeeds} \u4e2a [citation needed]\uff0c\u9700\u8981\u771f\u5b9e\u6765\u6e90\u5361\u652f\u6301\u3002`
    : "\u5f15\u7528\u65b9\u9762\u6682\u65f6\u6ca1\u6709\u660e\u663e\u7684 [citation needed]\uff0c\u4f46\u4e8b\u5b9e\u6027\u8868\u8ff0\u4ecd\u8981\u6838\u5bf9\u6765\u6e90\u3002";
  return `${title}\u7684 Module ${input.moduleNumber}\u53cd\u9988\uff1a${question}${thesis}${citation}\u4e0b\u4e00\u6b65\uff1a${chineseModulePriority(input.moduleNumber, facts)}`;
}

function chineseModulePriority(moduleNumber: ModuleNumber, facts: ModuleFacts) {
  if (moduleNumber === 1) {
    if (!facts.questionLine) return "\u5199\u51fa\u4e00\u4e2a\u66f4\u805a\u7126\u7684\u7814\u7a76\u95ee\u9898\uff0c\u70b9\u660e\u95ee\u9898\u3001\u53d7\u5f71\u54cd\u7684\u4eba\u548c\u53ef\u4e89\u8bba\u7684\u77db\u76fe\u3002";
    if (!facts.thesisLine) return "\u628a\u7814\u7a76\u95ee\u9898\u53d8\u6210\u53ef\u4e89\u8bba\u7684 working thesis\uff0c\u5e76\u914d\u4e24\u5230\u4e09\u4e2a\u7406\u7531\u3002";
    return "\u8ba9 thesis map \u66f4\u5e73\u884c\uff0c\u6bcf\u4e2a\u7406\u7531\u90fd\u76f4\u63a5\u56de\u7b54\u7814\u7a76\u95ee\u9898\u3002";
  }
  if (moduleNumber === 2) return "\u628a\u6bcf\u4e2a evidence need \u53d8\u6210\u53ef\u68c0\u7d22\u7684\u6765\u6e90\u4efb\u52a1\uff0c\u5199\u660e\u7814\u7a76\u7c7b\u578b\u3001\u6570\u636e\u6216\u5173\u952e\u8bcd\u3002";
  if (moduleNumber === 3) return "\u68c0\u67e5\u6bcf\u4e2a body paragraph \u662f\u5426\u6709 topic sentence\u3001evidence\u3001analysis \u548c link back\u3002";
  if (moduleNumber === 4) return facts.citationNeeds
    ? "\u5148\u7528\u771f\u5b9e\u6765\u6e90\u5361\u89e3\u51b3 [citation needed]\uff0c\u7136\u540e\u52a0\u5f3a\u8bc1\u636e\u540e\u7684\u5206\u6790\u3002"
    : "\u4fee\u6539\u6bb5\u843d\u7ed3\u5c3e\uff0c\u8bf4\u6e05\u8bc1\u636e\u5982\u4f55\u652f\u6301 thesis\u3002";
  if (moduleNumber === 5) return "\u5206\u522b\u6838\u5bf9 in-text citation\u3001source card \u548c reference list\uff0c\u4e0d\u8981\u865a\u6784\u7f3a\u5931\u4fe1\u606f\u3002";
  return "\u6700\u540e\u68c0\u67e5 thesis \u4e00\u81f4\u6027\u3001\u6bb5\u843d\u987a\u5e8f\u3001\u53e5\u5b50\u6e05\u6670\u5ea6\u3001\u5f15\u7528\u51c6\u5907\u5ea6\u548c\u7ed3\u8bba\u529b\u5ea6\u3002";
}

function asksAboutCitations(action: string) {
  return /citation|cite|source|reference|\u5f15\u7528|\u6765\u6e90|\u53c2\u8003/i.test(action);
}

function asksAboutStructure(action: string) {
  return /structure|outline|paragraph|order|flow|\u7ed3\u6784|\u6bb5\u843d|\u5927\u7eb2/i.test(action);
}

function asksAboutEvidence(action: string) {
  return /evidence|support|source|citation|proof|\u8bc1\u636e|\u6765\u6e90|\u5f15\u7528/i.test(action);
}

function wantsChinese(action: string) {
  return /[\u4e00-\u9fff]|\bchinese\b|\u4e2d\u6587/i.test(action);
}

function lineAfterLabel(text: string, pattern: RegExp) {
  return text.match(pattern)?.[1]?.trim() ?? "";
}

function normalizeTitle(value: string) {
  return cleanReplacement(value).replace(/[.!?]+$/, "").trim();
}

function countSources(sources: SourceCard[]) {
  return sources.reduce(
    (acc, source) => {
      const real = !source.placeholder && Boolean(source.title?.trim()) && Boolean(source.authors?.length) && Boolean(source.year?.trim());
      if (real) acc.real += 1;
      else if (source.placeholder) acc.placeholder += 1;
      return acc;
    },
    { real: 0, placeholder: 0 }
  );
}

function isOpenNote(patch: Patch) {
  return !patch.resolved && patch.status !== "resolved" && !patch.stale && patch.text.trim();
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

function shortQuote(value: string) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > 110 ? `${cleaned.slice(0, 107)}...` : cleaned;
}
