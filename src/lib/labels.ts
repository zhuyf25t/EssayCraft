import type { SegmentLabel } from "@/types/essaycraft";

export const LABELS: Record<SegmentLabel, { name: string; description: string; className: string; swatch: string }> = {
  background: {
    name: "Background",
    description: "Context, topic introduction, importance, scope.",
    className: "label-background",
    swatch: "bg-yellow-300"
  },
  thesis: {
    name: "Thesis",
    description: "Main arguable claim or thesis map.",
    className: "label-thesis",
    swatch: "bg-pink-300"
  },
  evidence: {
    name: "Evidence",
    description: "Facts, data, examples, source-based support.",
    className: "label-evidence",
    swatch: "bg-green-300"
  },
  analysis: {
    name: "Analysis",
    description: "Explanation, reasoning, why the evidence matters.",
    className: "label-analysis",
    swatch: "bg-blue-300"
  },
  counterargument: {
    name: "Counterargument",
    description: "Alternative view, concession, rebuttal.",
    className: "label-counterargument",
    swatch: "bg-purple-300"
  },
  citation: {
    name: "Citation",
    description: "Source signal, in-text citation, reference cue.",
    className: "label-citation",
    swatch: "bg-slate-300"
  },
  conclusion: {
    name: "Conclusion",
    description: "Restated thesis, summary, implication, call to action.",
    className: "label-conclusion",
    swatch: "bg-orange-300"
  },
  issue: {
    name: "Issue",
    description: "Needs attention: missing source, weak logic, unclear role.",
    className: "label-issue",
    swatch: "bg-red-300"
  },
  plain: {
    name: "Plain",
    description: "Unclassified or draft note.",
    className: "label-plain",
    swatch: "bg-white"
  }
};

export const LABEL_ORDER: SegmentLabel[] = [
  "background",
  "thesis",
  "evidence",
  "analysis",
  "counterargument",
  "citation",
  "conclusion",
  "issue",
  "plain"
];
