import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export const editor = (page: Page) => page.getByTestId("editor-textarea");
export const inlineNoteInput = (page: Page) => page.getByTestId("inline-note-input");
export const NOTE_LEAK_RE = /\u2063|\u2064|NOTE:[A-Za-z0-9_-]+|\/NOTE|NOTE[A-Za-z0-9_-]{6,}|PATCH[A-Za-z0-9_-]{6,}|\b(?:note|patch)-[0-9a-f-]{6,}\b|\[object Object\]/i;
export const generateButton = (page: Page, fromModule: number) =>
  page.getByRole("button", { name: new RegExp(`^Generate Module ${fromModule + 1} from Module ${fromModule}$`) });
export const moduleButton = (page: Page, moduleNumber: number, title: string) =>
  page.getByTitle(`Module ${moduleNumber}: ${title}`).first();

export async function setEditorText(page: Page, value: string) {
  await editor(page).evaluate((node, text) => {
    const root = node as HTMLElement;
    root.textContent = text;
    root.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: null }));
  }, value);
  await expect.poll(async () => canonicalModuleText(page)).toBe(value);
}

export async function selectEditorRange(page: Page, start: number, end: number) {
  await editor(page).evaluate(async (node, range) => {
    const root = node as HTMLElement;
    const positionForOffset = (target: number) => {
      let count = 0;
      let fallback: { node: Node; offset: number } = { node: root, offset: root.childNodes.length };
      const walk = (current: Node): { node: Node; offset: number } | null => {
        if (current.nodeType === Node.TEXT_NODE) {
          const length = current.textContent?.length ?? 0;
          if (target <= count + length) return { node: current, offset: Math.max(0, target - count) };
          count += length;
          fallback = { node: current, offset: length };
          return null;
        }
        if (current instanceof HTMLElement && (current.dataset.inlineNoteId || current.dataset.inlineNoteEditor)) return null;
        for (const child of Array.from(current.childNodes)) {
          const result = walk(child);
          if (result) return result;
        }
        return null;
      };
      return walk(root) ?? fallback;
    };
    const applySelection = () => {
      root.focus();
      const startPos = positionForOffset(range.start);
      const endPos = positionForOffset(range.end);
      const domRange = document.createRange();
      domRange.setStart(startPos.node, startPos.offset);
      domRange.setEnd(endPos.node, endPos.offset);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(domRange);
      root.dispatchEvent(new Event("select", { bubbles: true }));
      document.dispatchEvent(new Event("selectionchange"));
    };
    applySelection();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    applySelection();
  }, { start, end });
}

export async function openExportTab(page: Page) {
  await page.getByRole("tab", { name: /Export/i }).click();
  await expect(page.getByRole("tabpanel", { name: "Export" })).toBeVisible();
}

export async function openReferenceTranslation(page: Page) {
  await openExportTab(page);
  await page.getByRole("button", { name: "Reference Translation" }).click();
}

export async function expectEditorAtTop(page: Page) {
  await expect.poll(async () => editor(page).evaluate((node) => Math.round(node.scrollTop))).toBeLessThanOrEqual(2);
}

export async function expectEditorScrollWithin(page: Page, expected: number, tolerance = 4) {
  await expect.poll(async () => {
    const current = await editor(page).evaluate((node) => Math.round(node.scrollTop));
    return Math.abs(current - expected);
  }).toBeLessThanOrEqual(tolerance);
}

export async function canonicalModuleText(page: Page, moduleNumber?: number) {
  return page.evaluate((mod) => {
    const state = JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}");
    const moduleKey = mod ?? state.currentModule ?? 1;
    return state.modules[String(moduleKey)].text as string;
  }, moduleNumber);
}

export async function editorText(page: Page) {
  return editor(page).evaluate((node) => {
    const cleanText = (node as HTMLElement).dataset.cleanText;
    if (cleanText !== undefined) return cleanText;
    const clone = (node as HTMLElement).cloneNode(true) as HTMLElement;
    clone.querySelectorAll("[data-inline-note-id], [data-inline-note-editor]").forEach((item) => item.remove());
    return (clone.textContent ?? "").replace(/\r\n/g, "\n").replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trimEnd();
  });
}

export async function setInlineNoteCaret(page: Page, offset: number) {
  await inlineNoteInput(page).evaluate((node, target) => {
    if (node instanceof HTMLTextAreaElement || node instanceof HTMLInputElement) {
      const position = Math.max(0, Math.min(node.value.length, target));
      node.focus();
      node.setSelectionRange(position, position);
      return;
    }
    const root = node as HTMLElement;
    const textNode = root.firstChild ?? root;
    const length = textNode.textContent?.length ?? 0;
    const range = document.createRange();
    range.setStart(textNode, Math.max(0, Math.min(length, target)));
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, offset);
}

export async function inlineNoteCaret(page: Page) {
  return inlineNoteInput(page).evaluate((node) => {
    if (node instanceof HTMLTextAreaElement || node instanceof HTMLInputElement) {
      return [node.selectionStart ?? 0, node.selectionEnd ?? 0];
    }
    const root = node as HTMLElement;
    const selection = window.getSelection();
    if (!selection?.rangeCount) return [0, 0];
    const range = selection.getRangeAt(0);
    const offsetFor = (container: Node, offset: number) => {
      let count = 0;
      let found = false;
      const walk = (current: Node) => {
        if (found) return;
        if (current === container) {
          if (current.nodeType === Node.TEXT_NODE) count += offset;
          else count += Array.from(current.childNodes).slice(0, offset).reduce((sum, child) => sum + (child.textContent?.length ?? 0), 0);
          found = true;
          return;
        }
        if (current.nodeType === Node.TEXT_NODE) {
          count += current.textContent?.length ?? 0;
          return;
        }
        for (const child of Array.from(current.childNodes)) walk(child);
      };
      walk(root);
      return count;
    };
    return [offsetFor(range.startContainer, range.startOffset), offsetFor(range.endContainer, range.endOffset)];
  });
}

export async function expectEditorText(page: Page, expected: string | RegExp) {
  const value = await editorText(page);
  if (typeof expected === "string") expect(value).toBe(expected);
  else expect(value).toMatch(expected);
}

export async function expectCleanEditorAndModuleText(page: Page, expectedText?: string) {
  const visible = await editor(page).evaluate((node) => (node as HTMLElement).innerText);
  const clean = await editorText(page);
  const moduleText = await canonicalModuleText(page);
  if (expectedText !== undefined) expect(moduleText).toBe(expectedText);
  expect(visible).not.toMatch(NOTE_LEAK_RE);
  expect(clean).not.toMatch(NOTE_LEAK_RE);
  expect(moduleText).not.toMatch(NOTE_LEAK_RE);
  expect(moduleText).not.toContain("[Note:");
}

export async function setupPage({ page }: { page: Page }) {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/");
}
