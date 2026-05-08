import type { Patch } from "@/types/essaycraft";

export function repairPatchesForText(text: string, patches: Patch[]) {
  return patches
    .map((patch) => repairPatchForText(text, patch))
    .filter((patch): patch is Patch => Boolean(patch));
}

export function repairPatchForText(text: string, patch: Patch): Patch | null {
  const quote = patch.anchorQuote.trim();
  if (!quote) return null;

  const currentSlice = text.slice(patch.anchorStart, patch.anchorEnd);
  if (currentSlice === patch.anchorQuote) return patch;

  const found = text.indexOf(quote);
  if (found >= 0) {
    return {
      ...patch,
      anchorStart: found,
      anchorEnd: found + quote.length,
      anchorQuote: text.slice(found, found + quote.length)
    };
  }

  return {
    ...patch,
    resolved: true
  };
}

export function patchAtOffset(patches: Patch[], offset: number) {
  return patches.find((patch) => offset >= patch.anchorStart && offset < patch.anchorEnd);
}
