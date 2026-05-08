import type { Segment } from "@/types/essaycraft";
import { id } from "@/lib/utils";

export function splitTextIntoSegments(text: string): Segment[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphChunks = normalized.split(/\n{2,}/g);
  const result: Segment[] = [];

  for (const paragraph of paragraphChunks) {
    const sentences = paragraph
      .split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/g)
      .map((item) => item.trim())
      .filter(Boolean);

    if (sentences.length === 0) {
      result.push({ id: id("seg"), text: paragraph.trim(), label: "plain" });
      continue;
    }

    for (const sentence of sentences) {
      result.push({ id: id("seg"), text: sentence, label: "plain" });
    }
  }

  return result;
}

export function segmentsToPlainText(segments: Segment[]) {
  return segments.map((segment) => segment.text.trim()).filter(Boolean).join(" ");
}
