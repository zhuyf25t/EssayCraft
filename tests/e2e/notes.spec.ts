import { expect, test } from "@playwright/test";
import * as h from "./helpers";

test.beforeEach(h.setupPage);

test.describe.skip("inline note token flow is disabled while local Edit Refresh replaces patch notes", () => {

test("inline notes drive apply notes preview and preserve text until accepted", async ({ page }) => {
  const original = "Research shows that better phone habits improve student attention.";
  await h.setEditorText(page, original);
  await h.selectEditorRange(page, 0, "Research shows".length);
  await expect(page.getByTestId("assistant-edit-context")).toContainText("Selected range");
  await page.keyboard.press("Control+Enter");
  const patchBox = h.inlineNoteInput(page);
  await patchBox.fill("This is analysis, not evidence.");
  await page.keyboard.press("Enter");

  const noteMarker = page.getByTestId("patch-margin-marker").first();
  await expect(page.getByTestId("patch-marker")).toBeVisible();
  await expect(noteMarker).toBeVisible();
  await expect(noteMarker).toHaveCSS("position", "static");
  await expect(page.getByTestId("patch-marker")).toContainText("This is analysis");
  const visibleText = await page.getByTestId("editor-textarea").textContent();
  expect(visibleText?.indexOf("Research shows")).toBeLessThan(visibleText?.indexOf("This is analysis") ?? -1);
  expect(visibleText?.indexOf("This is analysis")).toBeLessThan(visibleText?.indexOf(" that better phone") ?? -1);
  const noteOverflow = await page.getByTestId("editor-textarea").evaluate((node) => node.scrollWidth - node.clientWidth);
  expect(noteOverflow).toBeLessThanOrEqual(4);
  expect(await h.canonicalModuleText(page)).toBe(original);
  await h.expectCleanEditorAndModuleText(page, original);
  await expect(page.getByTestId("patch-list")).toHaveCount(0);
  await page.getByTestId("patch-margin-marker").click();
  await expect(patchBox).toHaveValue("This is analysis, not evidence.");
  await patchBox.fill("This is analysis, not evidence. Find a stronger source.");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("patch-margin-marker")).toHaveAttribute("title", /Find a stronger source/);
  await page.getByTestId("patch-margin-marker").getByRole("button", { name: "Delete note" }).click();
  await expect(page.getByTestId("patch-margin-marker")).toHaveCount(0);
  expect(await h.canonicalModuleText(page)).toBe(original);
  await h.selectEditorRange(page, 0, "Research shows".length);
  await expect(page.getByTestId("assistant-edit-context")).toContainText("Selected range");
  await page.keyboard.press("Control+Enter");
  await h.inlineNoteInput(page).fill("This is analysis, not evidence. Find a stronger source.");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("patch-margin-marker")).toBeVisible();

  await page.getByRole("button", { name: "Apply Notes & Refresh" }).click();
  await expect(page.getByTestId("apply-notes-preview")).toContainText("Apply notes preview", { timeout: 20_000 });
  expect(await h.canonicalModuleText(page)).toBe(original);
  await page.getByRole("button", { name: "Reject" }).click();
  expect(await h.canonicalModuleText(page)).toBe(original);
  let stateAfterPreview = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
  expect(stateAfterPreview.modules["1"].patches[0].resolved).toBe(false);
  await expect(page.getByTestId("patch-margin-marker")).toBeVisible();

  await page.getByRole("button", { name: "Apply Notes & Refresh" }).click();
  await expect(page.getByTestId("apply-notes-preview")).toContainText("Apply notes preview", { timeout: 20_000 });
  await page.getByRole("button", { name: "Accept" }).click();
  await expect.poll(async () => h.canonicalModuleText(page)).not.toBe(original);
  stateAfterPreview = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
  expect(stateAfterPreview.modules["1"].snapshots[0].text).toBe(original);
  await expect.poll(async () => {
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
    return state.modules["1"].patches[0]?.status ?? (state.modules["1"].patches[0]?.resolved ? "resolved" : "open");
  }).toBe("resolved");
  await expect(page.getByTestId("patch-margin-marker")).toHaveCount(0);

  await page.getByTestId("toolbar-status").getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => h.canonicalModuleText(page)).toBe(original);
  const undoState = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
  expect(undoState.modules["1"].patches[0].resolved).toBe(false);
});

test("Chinese note input persists and Project Title drives Apply Notes", async ({ page }) => {
  const original = "Topic: Social media balance\n\nResearch question: How can social media be healthier?";
  await page.getByLabel("Project Title").fill("Technology vs. Humanity.");
  await h.setEditorText(page, original);
  await h.selectEditorRange(page, 0, "Topic: Social media balance".length);
  await page.keyboard.press("Control+Enter");

  const noteInput = h.inlineNoteInput(page);
  await noteInput.pressSequentially("根据我的 title 重写这个 topic");
  await expect(noteInput).toHaveValue("根据我的 title 重写这个 topic");
  await page.waitForTimeout(300);
  await expect(noteInput).toHaveValue("根据我的 title 重写这个 topic");
  expect(await h.canonicalModuleText(page)).toBe(original);
  expect(await h.canonicalModuleText(page)).not.toContain("根据我的 title");
  await page.getByTestId("inline-patch-editor").getByRole("button", { name: "Save" }).click();

  await expect(page.getByTestId("patch-margin-marker")).toHaveAttribute("title", "根据我的 title 重写这个 topic");
  const stateAfterSave = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
  expect(stateAfterSave.modules["1"].text).toBe(original);
  expect(stateAfterSave.modules["1"].text).not.toMatch(h.NOTE_LEAK_RE);
  expect(stateAfterSave.modules["1"].patches[0].text).toBe("根据我的 title 重写这个 topic");

  await page.getByTestId("patch-margin-marker").click();
  await expect(noteInput).toHaveValue("根据我的 title 重写这个 topic");
  await page.getByTestId("inline-patch-editor").getByRole("button", { name: "Save" }).click();

  await page.getByRole("button", { name: "Apply Notes & Refresh" }).click();
  await expect(page.getByTestId("apply-notes-preview")).toContainText("Technology", { timeout: 20_000 });
  await expect(page.getByTestId("apply-notes-preview")).toContainText(/humanity/i);
  expect(await h.canonicalModuleText(page)).toBe(original);

  await page.getByRole("button", { name: "Accept" }).click();
  await expect.poll(async () => h.canonicalModuleText(page)).toContain("Topic: Technology vs. Humanity");
  const acceptedState = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
  expect(acceptedState.modules["1"].text).not.toContain("根据我的 title");
  expect(acceptedState.modules["1"].text).not.toMatch(h.NOTE_LEAK_RE);
  expect(acceptedState.modules["1"].patches[0].resolved).toBe(true);
  await expect(page.getByTestId("patch-margin-marker")).toHaveCount(0);
});

test("inline note draft keeps caret through refresh rerender", async ({ page }) => {
  const original = "Topic: Social media balance\n\nResearch question: How can social media be healthier?";
  await h.setEditorText(page, original);
  await h.selectEditorRange(page, 0, "Topic: Social media balance".length);
  await page.keyboard.press("Control+Enter");

  const noteInput = h.inlineNoteInput(page);
  await noteInput.fill("alpha beta");
  await h.setInlineNoteCaret(page, 5);

  await page.getByRole("button", { name: "Refresh Highlighting" }).click();
  await expect(page.getByRole("button", { name: "Refresh Highlighting" })).toBeEnabled({ timeout: 20_000 });
  await expect(noteInput).toHaveValue("alpha beta");
  await expect.poll(async () => h.inlineNoteCaret(page)).toEqual([5, 5]);

  await noteInput.pressSequentially(" plus");
  await expect(noteInput).toHaveValue("alpha plus beta");
  expect(await h.canonicalModuleText(page)).toBe(original);
  await noteInput.press("Control+Enter");

  await expect(page.getByTestId("patch-margin-marker")).toHaveAttribute("title", "alpha plus beta");
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
  expect(state.modules["1"].text).toBe(original);
  expect(state.modules["1"].text).not.toMatch(h.NOTE_LEAK_RE);
  expect(state.modules["1"].patches[0].text).toBe("alpha plus beta");
});

test("inline note save and Escape preserve editor scroll", async ({ page }) => {
  const original = Array.from({ length: 60 }, (_, index) => `Paragraph ${index + 1}. Social media study habits need careful revision.`).join("\n\n");
  const anchor = "Paragraph 36. Social media";
  const start = original.indexOf(anchor);
  const stableScrollTop = 520;

  await h.setEditorText(page, original);
  await h.selectEditorRange(page, start, start + anchor.length);
  await page.keyboard.press("Control+Enter");
  await h.inlineNoteInput(page).fill("Keep the source request focused.");
  await h.editor(page).evaluate((node, value) => {
    node.scrollTop = value;
    node.dispatchEvent(new Event("scroll"));
  }, stableScrollTop);
  const beforeSave = await h.editor(page).evaluate((node) => Math.round(node.scrollTop));

  await h.inlineNoteInput(page).press("Control+Enter");
  await expect(page.getByTestId("patch-margin-marker")).toHaveAttribute("title", "Keep the source request focused.");
  await h.expectEditorScrollWithin(page, beforeSave);

  await page.getByTestId("patch-margin-marker").click();
  await expect(h.inlineNoteInput(page)).toHaveValue("Keep the source request focused.");
  await h.editor(page).evaluate((node, value) => {
    node.scrollTop = value;
    node.dispatchEvent(new Event("scroll"));
  }, stableScrollTop);
  const beforeEscape = await h.editor(page).evaluate((node) => Math.round(node.scrollTop));

  await h.inlineNoteInput(page).press("Escape");
  await expect(page.getByTestId("inline-patch-editor")).toHaveCount(0);
  await h.expectEditorScrollWithin(page, beforeEscape);
  expect(await h.canonicalModuleText(page)).toBe(original);
});

test("inline note tokens do not corrupt normal text, spaces, brackets, or paragraphs", async ({ page }) => {
  const literalNoteText = "Research note: compare the phrase [Note: compare sources] with the source cards.";
  await h.setEditorText(page, literalNoteText);
  expect(await h.canonicalModuleText(page)).toBe(literalNoteText);
  const literalState = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
  expect(literalState.modules["1"].patches).toHaveLength(0);

  const original = "Research shows that better phone habits improve student attention.\n\nSecond paragraph keeps its blank line.";
  await h.setEditorText(page, original);
  await h.selectEditorRange(page, 0, "Research shows".length);
  await page.keyboard.press("Control+Enter");
  await h.inlineNoteInput(page).fill("Use a source with ] bracket and [citation needed] marker.");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("patch-margin-marker")).toBeVisible();
  await expect.poll(async () => {
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
    return state.modules["1"].patches.length;
  }).toBe(1);
  await page.getByTestId("patch-margin-marker").evaluate((node) => {
    const root = node.closest('[data-testid="editor-textarea"]') as HTMLElement;
    node.remove();
    root.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward", data: null }));
  });
  await expect(page.getByTestId("patch-margin-marker")).toBeVisible();
  await h.expectCleanEditorAndModuleText(page, original);

  await h.editor(page).evaluate((node, insertion) => {
    const root = node as HTMLElement;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(current) {
        const parent = current.parentElement;
        return parent?.closest("[data-inline-note-id], [data-inline-note-editor]")
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT;
      }
    });
    let last: Text | null = null;
    while (walker.nextNode()) last = walker.currentNode as Text;
    if (last) last.textContent = `${last.textContent ?? ""}${insertion}`;
    root.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: insertion }));
  }, " Added ending.");

  const canonical = await h.canonicalModuleText(page);
  expect(canonical).toContain("Research shows that better phone habits");
  expect(canonical).toContain("\n\nSecond paragraph keeps its blank line. Added ending.");
  expect(canonical).not.toContain("[Note:");
  await h.expectCleanEditorAndModuleText(page);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
  expect(state.modules["1"].patches).toHaveLength(1);
  expect(state.modules["1"].patches[0].text).toContain("] bracket");
  expect(state.modules["1"].patches[0].text).toContain("[citation needed]");
});

test("Chinese title note visibly revises topic only after Accept", async ({ page }) => {
  const original = "Topic: Social media balance\n\nResearch question: How can social media be healthier?";
  await h.setEditorText(page, original);
  await h.selectEditorRange(page, 0, "Topic: Social media balance".length);
  await page.keyboard.press("Control+Enter");
  await h.inlineNoteInput(page).fill("标题可以更长一点");
  await page.keyboard.press("Enter");

  await expect(page.getByTestId("patch-marker")).toBeVisible();
  await expect(page.getByTestId("patch-margin-marker")).toBeVisible();
  expect(await h.canonicalModuleText(page)).toBe(original);
  expect(await h.canonicalModuleText(page)).not.toContain("标题可以更长一点");

  await page.getByRole("button", { name: "Apply Notes & Refresh" }).click();
  await expect(page.getByTestId("apply-notes-preview")).toContainText("Apply notes preview", { timeout: 20_000 });
  await expect(page.getByTestId("apply-notes-preview")).toContainText(/responsible platform design/i);
  expect(await h.canonicalModuleText(page)).toBe(original);
  await page.getByRole("button", { name: "Accept" }).click();
  await expect.poll(async () => h.canonicalModuleText(page)).not.toBe(original);
  await expect.poll(async () => h.canonicalModuleText(page)).toContain("Topic: Social media balance, youth wellbeing, and responsible platform design");
  await expect(page.getByTestId("patch-margin-marker")).toHaveCount(0);
});

test("Chinese question note revises research question in preview", async ({ page }) => {
  const original = "Topic: Social media balance\n\nResearch question: How can we strike a healthier social media balance?";
  const question = "Research question: How can we strike a healthier social media balance?";
  await h.setEditorText(page, original);
  const start = original.indexOf(question);
  await h.selectEditorRange(page, start, start + question.length);
  await page.keyboard.press("Control+Enter");
  await h.inlineNoteInput(page).fill("为什么我觉得这个问题看起来有点呆板呢？意思就是，没有太多新意。");
  await page.keyboard.press("Enter");

  await page.getByRole("button", { name: "Apply Notes & Refresh" }).click();
  await expect(page.getByTestId("apply-notes-preview")).toContainText("individuals, schools, and social media platforms", { timeout: 20_000 });
  expect(await h.canonicalModuleText(page)).toBe(original);
  await page.getByRole("button", { name: "Reject" }).click();
  expect(await h.canonicalModuleText(page)).toBe(original);
  await expect(page.getByTestId("patch-margin-marker")).toBeVisible();
});

test("Apply Notes blocks stale preview after manual text edits", async ({ page }) => {
  const original = "Topic: Social media balance\n\nResearch question: How can social media be healthier?";
  await h.setEditorText(page, original);
  await h.selectEditorRange(page, 0, "Topic: Social media balance".length);
  await page.keyboard.press("Control+Enter");
  await h.inlineNoteInput(page).fill("Make this title longer.");
  await page.keyboard.press("Enter");

  await page.getByRole("button", { name: "Apply Notes & Refresh" }).click();
  await expect(page.getByTestId("apply-notes-preview")).toContainText("Apply notes preview", { timeout: 20_000 });

  const edited = `${original}\n\nManual sentence added after preview.`;
  await h.setEditorText(page, edited);

  await h.expectEditorText(page, edited);
  await expect(page.getByTestId("apply-notes-preview")).toHaveCount(0);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
  expect(state.modules["1"].text).toBe(edited);
  expect(state.modules["1"].patches).toHaveLength(1);
  expect(state.modules["1"].patches[0].resolved).toBe(false);
});

test("assistant apply snapshots selected replacement and blocks stale ranges", async ({ page }) => {
  const original = "Alpha sentence. kids get good things.";
  await h.setEditorText(page, original);
  await h.selectEditorRange(page, 16, original.length);
  await page.getByRole("button", { name: "Rewrite", exact: true }).click();
  await expect(page.getByTestId("assistant-edit-preview")).toContainText("Revision preview", { timeout: 20_000 });
  const preview = page.getByTestId("assistant-edit-preview");
  for (const banned of [
    "A more academic version could state",
    "could state:",
    "The student should",
    "Here is a revised version",
    "citation needed if this includes factual evidence",
    "if this includes factual evidence",
    "I would rewrite it as"
  ]) {
    await expect(preview).not.toContainText(banned);
  }
  await page.getByRole("button", { name: "Accept" }).click();
  await h.expectEditorText(page, /^Alpha sentence\. young people (get|gain) beneficial factors\./);
  const appliedState = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
  expect(appliedState.modules["1"].snapshots[0].text).toBe(original);
  await page.keyboard.press("Control+Z");
  await h.expectEditorText(page, original);

  const staleOriginal = "Alpha sentence. Beta sentence.";
  await h.setEditorText(page, staleOriginal);
  await h.selectEditorRange(page, 16, staleOriginal.length);
  await page.getByRole("button", { name: "Rewrite", exact: true }).click();
  await expect(page.getByTestId("assistant-edit-preview")).toContainText("Revision preview", { timeout: 20_000 });
  await h.setEditorText(page, `Inserted prefix. ${staleOriginal}`);
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByTestId("toolbar-status")).toContainText(/blocked|changed after the preview/i);
  await h.expectEditorText(page, `Inserted prefix. ${staleOriginal}`);
});

});
