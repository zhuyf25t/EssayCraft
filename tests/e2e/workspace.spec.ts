import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/");
});

test("student can edit paragraphs, add a patch, and insert a manual citation", async ({ page }) => {
  await expect(page.getByText("EssayCraft").first()).toBeVisible();

  const editor = page.locator("textarea.editor-textarea");
  await editor.fill("Topic: Campus phone habits.\n\nQuestion: How can students reduce distraction without losing connection?");
  await expect(editor).toHaveValue(/Campus phone habits\.\n\nQuestion:/);

  await editor.focus();
  await page.keyboard.press("Control+Enter");
  const patchBox = page.getByPlaceholder("Tell the AI what to fix here...");
  await expect(patchBox).toBeVisible();
  await patchBox.fill("Make the question more specific for a school policy essay.");
  await page.keyboard.press("Control+Enter");
  await expect(page.getByText("Make the question more specific")).toBeVisible();

  await page.getByPlaceholder("Source title").fill("Student focus survey");
  await page.getByPlaceholder("Authors separated by ;").fill("Rivera");
  await page.getByPlaceholder("Year").fill("2024");
  await page.getByRole("button", { name: /^Add$/ }).click();
  await expect(page.getByText("In-text preview: (Rivera, 2024)")).toBeVisible();

  await editor.focus();
  await page.keyboard.press("End");
  await page.getByRole("button", { name: "Insert citation" }).click();
  await expect(editor).toHaveValue(/\(Rivera, 2024\)/);
});

test("generate next mock preserves separate module text", async ({ page }) => {
  await page.locator("textarea.editor-textarea").fill("Topic: AI study tools.\n\nQuestion: When do AI tools help students learn?");
  await page.getByRole("button", { name: /Generate Module 2 from Module 1/ }).first().click();
  await expect(page.getByText("Module 2 of 6", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("textarea.editor-textarea")).toHaveValue(/Argument branch 1[\s\S]*\n\nArgument branch 2/);
});
