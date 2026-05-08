import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const editor = (page: Page) => page.getByTestId("editor-textarea");
const generateButton = (page: Page, fromModule: number) =>
  page.getByRole("button", { name: new RegExp(`^Generate Module ${fromModule + 1} from Module ${fromModule}$`) });
const moduleButton = (page: Page, moduleNumber: number, title: string) =>
  page.getByTitle(`Module ${moduleNumber}: ${title}`).first();

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/");
});

test("homepage renders EssayCraft title without runtime 500", async ({ page }) => {
  await expect(page.getByText("EssayCraft").first()).toBeVisible();
  await expect(page.getByTestId("app-shell")).toBeVisible();
});

test("fixed shell keeps browser page from scrolling while editor owns long text scroll", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const longText = Array.from({ length: 55 }, (_, index) => `Paragraph ${index + 1}. This paragraph makes the writing canvas long enough to scroll internally.`).join("\n\n");
  await editor(page).fill(longText);

  const metrics = await page.evaluate(() => {
    const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement;
    const textArea = q("editor-textarea") as HTMLTextAreaElement;
    const highlightKey = q("highlight-key");
    const keyRect = highlightKey.getBoundingClientRect();
    return {
      documentOverflow: document.documentElement.scrollHeight - window.innerHeight,
      bodyOverflow: document.body.scrollHeight - window.innerHeight,
      editorOverflow: textArea.scrollHeight - textArea.clientHeight,
      editorResize: getComputedStyle(textArea).resize,
      keyVisible: keyRect.bottom <= window.innerHeight + 1 && keyRect.top >= 0
    };
  });

  expect(metrics.documentOverflow).toBeLessThanOrEqual(4);
  expect(metrics.bodyOverflow).toBeLessThanOrEqual(4);
  expect(metrics.editorOverflow).toBeGreaterThan(100);
  expect(metrics.editorResize).toBe("none");
  expect(metrics.keyVisible).toBe(true);

  await page.mouse.wheel(0, 600);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  await editor(page).evaluate((node) => {
    node.scrollTop = 240;
    node.dispatchEvent(new Event("scroll"));
  });
  await expect.poll(async () => editor(page).evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
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
  await page.getByRole("button", { name: "Add real source" }).click();
  await expect(page.getByText("In-text preview: (Rivera, 2024)")).toBeVisible();
  await expect(page.getByText("Student supplied")).toBeVisible();

  await textEditor.focus();
  await page.keyboard.press("End");
  await page.getByTestId("source-insert-citation").click();
  await expect(textEditor).toHaveValue(/\(Rivera, 2024\)/);
  await expect(page.getByTestId("toolbar-status")).toContainText("Inserted (Rivera, 2024) from your source card");
});

test("generate next moves Module 1 to Module 2 with visible success", async ({ page }) => {
  const textEditor = editor(page);
  await textEditor.fill("Topic: AI study tools.\n\nQuestion: When do AI tools help students learn?");
  await expect(textEditor).toHaveValue(/AI study tools\.\n\nQuestion:/);

  await expect(generateButton(page, 1)).toBeEnabled();
  await generateButton(page, 1).click();

  await expect(page.getByText("Module 2 of 6", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(editor(page)).toHaveValue(/Research plan for: AI study tools[\s\S]*Argument branch 1[\s\S]*\n\nArgument branch 2/);
  await expect(page.getByTestId("last-action")).toContainText("Module 2 generated and opened. Previous Module 2 saved as a snapshot.");
});

test("Module 2 to Module 3 creates a coherent branch-specific outline", async ({ page }) => {
  await moduleButton(page, 2, "Research & Evidence").click();
  await editor(page).fill(`Research plan for: technology and humanity

Working thesis: The future of technology is not simply greater power, but a closer integration between technological systems and human needs.

Argument branch 1: technology is becoming more human-centered
Evidence needed: historical example of computers, phones, and AI becoming more accessible
Possible source type: scholarly article or professional technology report
Search keywords: human-computer interaction, smartphone adoption, AI assistants
Source status: source needed

Argument branch 2: human-centered design can make tools more accessible and useful
Evidence needed: example of interface design improving daily life
Possible source type: professional technology report
Search keywords: human-centered design, accessibility, usable technology
Source status: source needed

Argument branch 3: closer integration creates ethical risks
Evidence needed: source about privacy, autonomy, or overdependence
Possible source type: scholarly article
Search keywords: AI ethics, technology dependence, privacy
Source status: source needed

Counterargument to investigate: Some people argue that technology is becoming less human because automation removes human judgment.`);

  await generateButton(page, 2).click();

  await expect(page.getByText("Module 3 of 6", { exact: true })).toBeVisible({ timeout: 20_000 });
  const value = await editor(page).inputValue();
  expect(value).toContain("Introduction plan");
  expect(value).toContain("Body paragraph 1");
  expect(value).toContain("Body paragraph 2");
  expect(value).toContain("Evidence to use");
  expect(value).toContain("[source needed]");
  expect(value).toContain("technology is becoming more human-centered");
  expect(value).toContain("human-centered design can make tools more accessible and useful");
  expect(value).not.toContain("Present the first reason");
  expect(value).not.toContain("State the essay's arguable position");
  expect(value).not.toContain("Refined question: Where is");
  expect(value).not.toContain("social media");
});

test("custom Module 1 topic does not drift back to the old demo topic", async ({ page }) => {
  await editor(page).fill(`Topic: technology and humanity

Research question: How will future technology change the relationship between human needs and machine systems?

Working thesis: Future technology should be judged by how well it supports human agency, accessibility, and ethical responsibility.

Thesis map:
- Reason 1: Human-centered design can make technology easier to use.
- Reason 2: AI assistants can extend human capability when users remain in control.
- Reason 3: Ethical design is needed to prevent dependency and privacy harms.`);

  await generateButton(page, 1).click();
  await expect(page.getByText("Module 2 of 6", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(editor(page)).toHaveValue(/technology and humanity/i);
  await expect(editor(page)).not.toHaveValue(/social media/i);

  await generateButton(page, 2).click();
  await expect(page.getByText("Module 3 of 6", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(editor(page)).toHaveValue(/technology and humanity|human-centered design/i);
  await expect(editor(page)).not.toHaveValue(/social media/i);
});

test("generate next moves Module 3 outline to Module 4 draft paragraphs", async ({ page }) => {
  await moduleButton(page, 3, "Outline").click();
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
  await moduleButton(page, 4, "Drafting").click();
  await expect(editor(page)).toHaveValue("");

  await generateButton(page, 4).click();

  await expect(page.getByTestId("last-action")).toContainText("Add content to Module 4 before generating Module 5.");
  await expect(page.getByText("Module 4 of 6", { exact: true })).toBeVisible();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
  expect(state.currentModule).toBe(4);
  expect(state.modules["5"].text).toBe("");
});

test("refresh highlighting preserves exact editor text", async ({ page }) => {
  const original = "Topic: Citation testing.\n\nResearch shows an important pattern [citation needed].\n\nThis paragraph must stay exactly the same.";
  await editor(page).fill(original);
  await page.getByRole("button", { name: "Refresh Highlighting" }).click();
  await expect(editor(page)).toHaveValue(original);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
  expect(state.modules["1"].text).toBe(original);
  expect(state.modules["1"].annotations.every((annotation: { start: number; end: number; text: string }) =>
    state.modules["1"].text.slice(annotation.start, annotation.end) === annotation.text
  )).toBe(true);
});

test("Translate preview shows Chinese mock output and applies only after confirmation", async ({ page }) => {
  const original = "Topic: Campus notification habits.\n\nQuestion: How can schools reduce distraction while keeping students connected?";
  await editor(page).fill(original);
  await page.getByRole("button", { name: "Translate", exact: true }).click();
  await expect(page.getByText("Translate Preview")).toBeVisible();
  const dialog = page.getByTestId("translate-dialog");
  await dialog.locator("select").selectOption("auto-to-zh");
  await page.getByRole("button", { name: "Create Preview" }).click();
  await expect(page.getByText("Translation / 中文翻译")).toBeVisible();
  await expect(dialog.locator("pre").last()).toContainText(/[\u4e00-\u9fff]/);
  await expect(editor(page)).toHaveValue(original);

  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(editor(page)).toHaveValue(original);

  await page.getByRole("button", { name: "Translate", exact: true }).click();
  await page.getByTestId("translate-dialog").locator("select").selectOption("en-to-zh");
  await page.getByRole("button", { name: "Create Preview" }).click();
  await page.getByRole("button", { name: "Apply translation" }).click();
  await expect(editor(page)).toHaveValue(/[\u4e00-\u9fff][\s\S]*\n\n[\s\S]*[\u4e00-\u9fff]/);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
  expect(state.modules["1"].snapshots[0].reason).toBe("Before applying translation");
});

test("generate-next API returns valid mock response shape", async ({ request }) => {
  const response = await request.post("/api/generate-next", {
    data: {
      topic: "AI study tools",
      sourceModuleNumber: 2,
      sourceTitle: "Research & Evidence",
      sourceText: `Research plan for: AI study tools

Argument branch 1: guided feedback can improve revision
Evidence needed: classroom writing source

Argument branch 2: students need boundaries to avoid outsourcing thinking
Evidence needed: academic integrity source`,
      sourceAnnotations: [],
      sourcePatches: [],
      sourceSources: []
    }
  });

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.moduleNumber).toBe(3);
  expect(body.providerMode).toBe("mock");
  expect(body.text).toContain("Introduction plan");
  expect(body.text).toContain("Body paragraph 1");
  expect(body.text).toContain("Evidence to use");
  expect(body.text).toContain("[source needed]");
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
