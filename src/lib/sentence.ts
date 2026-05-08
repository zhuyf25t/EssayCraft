import { sentenceRangeAt, sentenceRanges } from "@/lib/annotations";

export { sentenceRangeAt, sentenceRanges };

export function countWords(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function countCharacters(text: string) {
  return text.length;
}
