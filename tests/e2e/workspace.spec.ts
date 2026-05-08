import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const editor = (page: Page) => page.locator("textarea.editor-textarea");
const generateButton = (page: Page, fromModule: number) =>
  page.getByRole("button", { name: new RegExp(`^Generate Module ${fromModule + 1} from Module ${fromModule}$`) });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/");
});

test("student can edit paragraphs, add a patch, and insert a manual citation", async ({ page }) => {
  await expect(page.getByText("EssayCraft").first()).toBeVisible();

  const textEditor = editor(page);
  await textEditor.fill("Topic: Campus phone habits.\n\nQuestion: How can students reduce distraction without losing connection?");
  await expect(textEditor).toHaveValue(/Campus phone habits\.\n\nQuestion:/);

  await textEditor.focus();
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

  await textEditor.focus();
  await page.keyboard.press("End");
  await page.getByRole("button", { name: "Insert citation" }).click();
  await expect(textEditor).toHaveValue(/\(Rivera, 2024\)/);
});

test("generate next moves Module 1 to Module 2 with visible success", async ({ page }) => {
  const textEditor = editor(page);
  await textEditor.fill("Topic: AI study tools.\n\nQuestion: When do AI tools help students learn?");
  await expect(textEditor).toHaveValue(/AI study tools\.\n\nQuestion:/);

  await expect(generateButton(page, 1)).toBeEnabled();
  await generateButton(page, 1).click();

  await expect(page.getByText("Module 2 of 6", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(editor(page)).toHaveValue(/AI study tools[\s\S]*Argument branch 1[\s\S]*\n\nArgument branch 2/);
  await expect(page.getByTestId("last-action")).toContainText("Module 2 generated and opened. Previous Module 2 saved as a snapshot.");
});

test("generate next moves Module 3 outline to Module 4 draft paragraphs", async ({ page }) => {
  await page.getByTitle("Module 3: Outline").first().click();
  const textEditor = editor(page);
  await textEditor.fill(`Topic: AI study tools

Introduction
- Hook: AI tutoring is common.
- Thesis: AI tools help when students use them to ask questions, not outsource thinking.

Body paragraph 1
- Topic sentence: Guided feedback can improve revision.
- Evidence: Add source [citation needed].
- Analysis: Explain feedback loops.

Conclusion
- Restate thesis and significance.`);

  await expect(generateButton(page, 3)).toBeEnabled();
  await generateButton(page, 3).click();

  await expect(page.getByText("Module 4 of 6", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(editor(page)).toHaveValue(/AI study tools[\s\S]*\n\nFirst,[\s\S]*\n\nSecond,/);
  await expect(page.getByTestId("last-action")).toContainText("Module 4 generated and opened. Previous Module 4 saved as a snapshot.");
});

test("empty source module shows a friendly Generate Next error", async ({ page }) => {
  await page.getByTitle("Module 4: Drafting").first().click();
  await expect(editor(page)).toHaveValue("");

  await generateButton(page, 4).click();

  await expect(page.getByTestId("last-action")).toContainText("Add content to Module 4 before generating Module 5.");
  await expect(page.getByText("Module 4 of 6", { exact: true })).toBeVisible();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
  expect(state.currentModule).toBe(4);
  expect(state.modules["5"].text).toBe("");
});

test("generate-next API returns valid mock response shape", async ({ request }) => {
  const response = await request.post("/api/generate-next", {
    data: {
      topic: "AI study tools",
      sourceModuleNumber: 1,
      sourceTitle: "Topic & Question",
      sourceText: "Topic: AI study tools\n\nQuestion: When do AI tools help students learn?",
      sourceAnnotations: [],
      sourcePatches: [],
      sourceSources: []
    }
  });

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.moduleNumber).toBe(2);
  expect(body.providerMode).toBe("mock");
  expect(body.text).toContain("AI study tools");
  expect(body.text.length).toBeGreaterThan(50);
  expect(Array.isArray(body.annotations)).toBe(true);
  expect(Array.isArray(body.sources)).toBe(true);
  expect(Array.isArray(body.globalFeedback)).toBe(true);
  expect(Array.isArray(body.warnings)).toBe(true);
  for (const annotation of body.annotations) {
    expect(annotation.start).toBeGreaterThanOrEqual(0);
    expect(annotation.end).toBeGreaterThan(annotation.start);
    expect(annotation.end).toBeLessThanOrEqual(body.text.length);
    expect(body.text.slice(annotation.start, annotation.end)).toBe(annotation.text);
  }
});
