const REFERENCE_HEADING = /^\s*(references|works cited|bibliography)\s*$/im;

export function hasUsefulChinese(value: string) {
  const chineseChars = value.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  return chineseChars >= 12;
}

export function echoesSourceEnglish(source: string, translated: string) {
  const sourceBody = beforeReferenceList(source);
  const translatedBody = beforeReferenceList(translated);
  const englishRatio = englishLetterRatio(translatedBody);
  if (englishRatio < 0.18) return false;

  const stopWords = new Set([
    "about",
    "after",
    "also",
    "because",
    "between",
    "could",
    "every",
    "first",
    "from",
    "have",
    "into",
    "more",
    "should",
    "their",
    "there",
    "these",
    "this",
    "when",
    "where",
    "which",
    "with",
    "without",
    "would",
    "references",
    "bibliography",
    "cited"
  ]);
  const tokens = Array.from(new Set((sourceBody.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((token) => !stopWords.has(token))));
  if (tokens.length < 5) return false;
  const output = translatedBody.toLowerCase();
  const echoed = tokens.filter((token) => output.includes(token)).length;
  return echoed >= Math.min(12, tokens.length) && echoed / tokens.length > 0.35;
}

export function hasBannedTranslationCommentary(value: string) {
  return /中文参考翻译[:：]|这句话讨论了|这句话强调|核心论点是|本地参考翻译|译文\s*[:：]/.test(value);
}

function beforeReferenceList(value: string) {
  const match = REFERENCE_HEADING.exec(value);
  return match ? value.slice(0, match.index) : value;
}

function englishLetterRatio(value: string) {
  const visible = value.replace(/\s+/g, "");
  if (!visible) return 0;
  const letters = visible.match(/[A-Za-z]/g)?.length ?? 0;
  return letters / visible.length;
}
