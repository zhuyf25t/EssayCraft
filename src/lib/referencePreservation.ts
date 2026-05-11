export function preserveSourceReferenceSection(targetText: string, sourceText: string) {
  const sourceReferences = extractStandaloneReferenceSection(sourceText);
  if (!sourceReferences) return targetText;

  const normalizedTarget = normalizeReferenceCompareText(targetText);
  const firstEntry = referenceEntryLines(sourceReferences)[0];
  const hasReferenceHeading = /(^|\n)\s*(references|reference list|works cited|bibliography)\s*:?\s*(\n|$)/i.test(targetText);
  const alreadyHasSourceReferences = firstEntry
    ? normalizedTarget.includes(normalizeReferenceCompareText(firstEntry))
    : normalizedTarget.includes(normalizeReferenceCompareText(sourceReferences));

  if (alreadyHasSourceReferences) return targetText;
  if (hasReferenceHeading && referenceEntryLines(targetText).length > 0) return targetText;

  return `${targetText.trim()}\n\n${sourceReferences.trim()}`;
}

export function extractStandaloneReferenceSection(text: string) {
  const lines = text.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) =>
    /^\s*(references|reference list|works cited|bibliography)\s*:?\s*$/i.test(line)
  );
  if (headingIndex < 0) return "";

  const block = lines.slice(headingIndex).join("\n").trim();
  return referenceEntryLines(block).length ? block : "";
}

function referenceEntryLines(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const headingPattern = /^(references|reference list|works cited|bibliography)\s*:?\s*$/i;
  return lines.filter((line) => !headingPattern.test(line));
}

function normalizeReferenceCompareText(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}
