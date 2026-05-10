import { expect, test } from "@playwright/test";
import * as h from "./helpers";

test.beforeEach(h.setupPage);

test("refresh highlighting preserves exact editor text", async ({ page }) => {
  const original = "Topic: Citation testing.\n\nResearch shows an important pattern [citation needed].\n\nThis paragraph must stay exactly the same.";
  await h.setEditorText(page, original);
  await page.route("**/api/refresh", async (route) => {
    await page.waitForTimeout(150);
    await route.continue();
  });
  await page.getByRole("button", { name: "Refresh Highlighting" }).click();
  await expect(page.getByRole("button", { name: "Refreshing" })).toBeVisible();
  await h.expectEditorText(page, original);
  await expect(page.getByTestId("refresh-result-card")).toContainText("Refresh result", { timeout: 20_000 });
  await expect(page.getByTestId("refresh-result-card")).toContainText("labels refreshed");
  await expect(page.getByTestId("refresh-result-card")).toContainText("topic, research question, thesis");
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
  expect(state.modules["1"].text).toBe(original);
  expect(state.modules["1"].annotations.every((annotation: { start: number; end: number; text: string }) =>
    state.modules["1"].text.slice(annotation.start, annotation.end) === annotation.text
  )).toBe(true);
});

test("Module 6 refresh shows a visible final review checklist", async ({ page }) => {
  const finalDraft = `Technology has always changed the way human beings live, but the central question is whether progress protects human agency.

This essay argues that technology should serve humanity by supporting human judgment, strengthening education, and limiting harmful design choices.

One reason is that digital tools can support learning when students use them intentionally. However, broad claims about student outcomes still need evidence [citation needed].

Overall, the final version should return to the thesis and explain why responsible design matters.`;
  await h.moduleButton(page, 6, "Final Review / Conclusion / Export").click();
  await h.setEditorText(page, finalDraft);
  await page.getByRole("button", { name: "Refresh Highlighting" }).click();

  const card = page.getByTestId("refresh-result-card");
  await expect(card).toContainText("Final review ready", { timeout: 20_000 });
  const checklist = page.getByTestId("module-review-checklist");
  for (const item of ["Content", "Structure", "Clarity", "Style", "Proofreading", "Citations / References", "Conclusion"]) {
    await expect(checklist).toContainText(item);
  }
  await expect(card).toContainText("citation-needed");
  await expect(card).toContainText(/source cards|references/i);
  expect(await h.canonicalModuleText(page, 6)).toBe(finalDraft);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
  const annotations = state.modules["6"].annotations as Array<{ label: string; text: string }>;
  const labels = new Set(annotations.map((annotation) => annotation.label));
  const citationChars = annotations
    .filter((annotation) => annotation.label === "citation")
    .reduce((sum, annotation) => sum + annotation.text.length, 0);
  expect(labels.size).toBeGreaterThan(2);
  expect(citationChars / finalDraft.length).toBeLessThan(0.6);
  expect(Math.max(...annotations.map((annotation) => annotation.text.length))).toBeLessThanOrEqual(350);
});

test("Translate preview shows Chinese mock output without changing the document", async ({ page }) => {
  const original = "Topic: Campus notification habits.\n\nQuestion: How can schools reduce distraction while keeping students connected?\n\nEvidence note: This claim needs support [citation needed].\n\nResearch plan marker: Add a study [source needed].";
  await h.setEditorText(page, original);
  const beforeState = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
  const beforeSnapshots = beforeState.modules["1"].snapshots.length;

  await h.openReferenceTranslation(page);
  const dialog = page.getByTestId("translate-dialog");
  await expect(dialog.getByRole("heading", { name: "Reference Translation" })).toBeVisible();
  await dialog.locator("select").selectOption("auto-to-zh");
  await page.getByRole("button", { name: "Create preview" }).click();
  const translation = dialog.locator("pre").last();
  await expect(translation).toContainText(/[\u4e00-\u9fff]/);
  await expect(translation).not.toContainText("Campus notification habits");
  await expect(translation).not.toContainText("How can schools reduce distraction");
  await expect(translation).toContainText("[citation needed]");
  await expect(translation).toContainText("[source needed]");
  await expect(dialog).not.toContainText(/DeepSeek|debug|AI returned|no API key/i);
  await expect(dialog.getByTestId("translate-provider-badge")).toContainText(/deepseek|mock|unavailable/i);
  for (const banned of ["中文参考翻译：", "这句话讨论了", "这句话强调", "核心论点是", "本地参考翻译", "译文:"]) {
    await expect(translation).not.toContainText(banned);
  }
  const translatedText = await translation.textContent();
  expect((translatedText?.match(/\n\s*\n/g) ?? []).length).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole("button", { name: "Apply translation" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Copy translation" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send to Assistant" })).toBeVisible();
  await h.expectEditorText(page, original);

  await page.getByRole("button", { name: "Copy translation" }).click();
  await h.expectEditorText(page, original);

  await page.getByRole("button", { name: "Send to Assistant" }).click();
  await expect(page.getByTestId("assistant-chat-messages")).toContainText("Reference translation");
  await expect(page.getByTestId("assistant-chat-messages")).toContainText("reading aid only");
  await h.expectEditorText(page, original);

  await h.openReferenceTranslation(page);
  await page.getByRole("button", { name: "Close" }).last().click();
  await h.expectEditorText(page, original);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
  expect(state.modules["1"].text).toBe(original);
  expect(state.modules["1"].snapshots.length).toBe(beforeSnapshots);
});

test("Translate modal does not corrupt editor scroll position", async ({ page }) => {
  const original = Array.from({ length: 45 }, (_, index) => `Paragraph ${index + 1}. This text keeps the editor scrollable for translation preview checks.`).join("\n\n");
  await h.setEditorText(page, original);
  await h.editor(page).evaluate((node) => {
    node.scrollTop = 420;
    node.dispatchEvent(new Event("scroll"));
  });
  const beforeScroll = await h.editor(page).evaluate((node) => node.scrollTop);
  expect(beforeScroll).toBeGreaterThan(100);

  await h.openReferenceTranslation(page);
  await expect(page.getByTestId("translate-dialog").getByRole("heading", { name: "Reference Translation" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).last().click();

  await h.expectEditorText(page, original);
  await expect.poll(async () => h.editor(page).evaluate((node) => node.scrollTop)).toBeGreaterThan(100);
});
