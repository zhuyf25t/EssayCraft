import type { Annotation, SourceCard } from "@/types/essaycraft";
import { sentenceRanges } from "@/lib/annotations";

export type CitationAudit = {
  citationNeededMarkers: string[];
  evidenceWithoutCitation: string[];
  inTextCitations: string[];
  citationsWithoutSourceCard: string[];
  realSources: SourceCard[];
  matchedSources: SourceCard[];
  uncitedSources: SourceCard[];
  incompleteSources: SourceCard[];
  placeholderSources: SourceCard[];
};

const CITATION_PATTERN = /\(([A-Z][A-Za-z' -]+(?:\s*&\s*[A-Z][A-Za-z' -]+)?),\s*(\d{4}[a-z]?)\)/g;

export function buildCitationAudit(text: string, annotations: Annotation[], sources: SourceCard[]): CitationAudit {
  const citationNeededMarkers = [...text.matchAll(/\[citation needed\]/gi)].map((match) => match[0]);
  const inTextCitations = [...text.matchAll(CITATION_PATTERN)].map((match) => match[0]);
  const evidenceWithoutCitation = findEvidenceWithoutCitation(text, annotations);
  const placeholderSources = sources.filter((source) => source.placeholder);
  const realSources = sources.filter((source) => !source.placeholder);
  const matchedSources = realSources.filter((source) => sourceMatchesAnyCitation(source, inTextCitations));
  const uncitedSources = realSources.filter((source) => !sourceMatchesAnyCitation(source, inTextCitations));
  const incompleteSources = realSources.filter((source) => !source.title || !source.authors?.length || !source.year);
  const citationsWithoutSourceCard = inTextCitations.filter((citation) =>
    !realSources.some((source) => sourceMatchesAnyCitation(source, [citation]))
  );

  return {
    citationNeededMarkers,
    evidenceWithoutCitation,
    inTextCitations,
    citationsWithoutSourceCard,
    realSources,
    matchedSources,
    uncitedSources,
    incompleteSources,
    placeholderSources
  };
}

export function inTextCitationPreview(source: SourceCard) {
  const author = firstAuthorLastName(source);
  if (!author || !source.year) return "";
  return `(${author}, ${source.year})`;
}

export function referencePreview(source: SourceCard) {
  const authors = source.authors?.filter(Boolean).join(", ") || "[missing author]";
  const year = source.year || "[missing year]";
  const title = source.title || "[missing title]";
  const container = source.containerTitle ? ` ${source.containerTitle}.` : "";
  const publisher = source.publisher ? ` ${source.publisher}.` : "";
  const doi = source.doi ? ` https://doi.org/${source.doi.replace(/^https?:\/\/doi\.org\//i, "")}` : "";
  const url = !doi && source.url ? ` ${source.url}` : "";
  return `${authors}. (${year}). ${title}.${container}${publisher}${doi}${url}`.replace(/\s+/g, " ").trim();
}

function findEvidenceWithoutCitation(text: string, annotations: Annotation[]) {
  const issueRanges = annotations.filter((annotation) => annotation.label === "issue" || annotation.label === "evidence");
  const sentences = sentenceRanges(text);
  return sentences
    .filter((sentence) => {
      const lower = sentence.text.toLowerCase();
      const citationLike = CITATION_PATTERN.test(sentence.text) || lower.includes("[citation needed]");
      CITATION_PATTERN.lastIndex = 0;
      const evidenceLike =
        lower.includes("research") ||
        lower.includes("study") ||
        lower.includes("data") ||
        lower.includes("evidence") ||
        lower.includes("found") ||
        issueRanges.some((annotation) => annotation.start < sentence.end && annotation.end > sentence.start);
      return evidenceLike && !citationLike;
    })
    .map((sentence) => sentence.text);
}

function sourceMatchesAnyCitation(source: SourceCard, citations: string[]) {
  const author = firstAuthorLastName(source);
  if (!author || !source.year) return false;
  return citations.some((citation) => citation.toLowerCase().includes(author.toLowerCase()) && citation.includes(source.year ?? ""));
}

function firstAuthorLastName(source: SourceCard) {
  const first = source.authors?.find(Boolean);
  if (!first) return "";
  const parts = first.trim().split(/\s+/);
  return parts[parts.length - 1] ?? "";
}
