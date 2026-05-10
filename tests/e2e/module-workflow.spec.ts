import { expect, test } from "@playwright/test";
import * as h from "./helpers";

test.beforeEach(h.setupPage);

test("student can edit paragraphs, use local refresh, and insert a manual citation", async ({ page }) => {
  await expect(page.getByText("EssayCraft").first()).toBeVisible();

  const textEditor = h.editor(page);
  await h.setEditorText(page, "Topic: Campus phone habits.\n\nQuestion: How can students reduce distraction without losing connection?");
  await h.expectEditorText(page, /Campus phone habits\.\n\nQuestion:/);

  await textEditor.focus();
  await page.keyboard.press("Control+Enter");
  await expect(page.getByTestId("assistant-edit-mode")).toBeVisible();
  await expect(h.inlineNoteInput(page)).toHaveCount(0);
  await page.getByPlaceholder("Tell EssayCraft what you want to change").fill("I think this should be background.");
  await page.getByRole("button", { name: "Refresh selected labels" }).click();
  await expect(page.getByTestId("assistant-local-refresh-result")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("assistant-local-refresh-result").getByRole("button", { name: "Copy" })).toBeVisible();
  await expect(page.getByTestId("assistant-local-refresh-result").getByRole("button", { name: "Dismiss" })).toBeVisible();
  await expect(page.getByTestId("patch-list")).toHaveCount(0);
  expect(await h.canonicalModuleText(page)).not.toContain("I think this should be background.");

  await page.getByRole("tab", { name: /Sources/i }).click();
  await page.getByPlaceholder("Source title").fill("Student focus survey");
  await page.getByPlaceholder("Authors separated by ;").fill("Rivera");
  await page.getByPlaceholder("Year").fill("2024");
  await page.getByRole("button", { name: "Add real source" }).click();
  await expect(page.getByText("In-text preview: (Rivera, 2024)")).toBeVisible();
  await expect(page.getByText("Student supplied")).toBeVisible();

  await textEditor.focus();
  await page.keyboard.press("End");
  await page.getByTestId("source-insert-citation").click();
  await h.expectEditorText(page, /\(Rivera, 2024\)/);
  await expect(page.getByTestId("toolbar-status")).toContainText("Inserted (Rivera, 2024) from your source card");
});

test("source needs are not treated as insertable citations", async ({ page }) => {
  await page.getByRole("tab", { name: /Sources/i }).click();
  await page.getByRole("button", { name: "Create source need" }).click();
  await expect(page.getByText("Source need, not a real source yet")).toBeVisible();
  await expect(page.getByText("No reference entry. Replace this source need with student-supplied metadata first.")).toBeVisible();
  await expect(page.getByTestId("source-insert-citation")).toBeDisabled();
});

test("generate next moves Module 1 to Module 2 with visible success and top scroll", async ({ page }) => {
  const textEditor = h.editor(page);
  await h.setEditorText(page, `Topic: AI study tools.

Question: When do AI tools help students learn?

${Array.from({ length: 28 }, (_, index) => `Planning note ${index + 1}: AI study tools should support revision without replacing student thinking.`).join("\n\n")}`);
  await h.expectEditorText(page, /AI study tools\.\n\nQuestion:/);
  await textEditor.evaluate((node) => {
    node.scrollTop = 500;
    node.dispatchEvent(new Event("scroll"));
  });

  await expect(h.generateButton(page, 1)).toBeEnabled();
  await h.generateButton(page, 1).click();

  await expect(page.getByText(/Module 2 of 6/)).toBeVisible({ timeout: 20_000 });
  await h.expectEditorAtTop(page);
  await h.expectEditorText(page, /Research plan for: AI study tools[\s\S]*Argument branch 1[\s\S]*\n\nArgument branch 2/);
  await expect(page.getByTestId("toolbar-status")).toContainText("Module 2 generated and opened. Previous Module 2 saved as a snapshot.");
});

test("Module 2 to Module 3 creates a coherent branch-specific outline and opens at top", async ({ page }) => {
  await h.moduleButton(page, 2, "Research & Evidence").click();
  await h.setEditorText(page, `Research plan for: technology and humanity

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
  await h.editor(page).evaluate((node) => {
    node.scrollTop = 500;
    node.dispatchEvent(new Event("scroll"));
  });

  await h.generateButton(page, 2).click();

  await expect(page.getByText(/Module 3 of 6/)).toBeVisible({ timeout: 20_000 });
  await h.expectEditorAtTop(page);
  const value = await h.editorText(page);
  expect(value.startsWith("Introduction plan")).toBe(true);
  expect(value).toContain("Body paragraph 1");
  expect(value).toContain("Body paragraph 2");
  expect(value).toContain("Evidence to use");
  expect(value).toMatch(/\[source needed(?::[^\]]*)?\]/);
  expect(value).toContain("technology is becoming more human-centered");
  expect(value).toContain("human-centered design can make tools more accessible and useful");
  expect(value).not.toContain("Present the first reason");
  expect(value).not.toContain("State the essay's arguable position");
  expect(value).not.toContain("Refined question: Where is");
  expect(value).not.toContain("social media");
});

test("custom Module 1 topic does not drift back to the old demo topic", async ({ page }) => {
  await h.setEditorText(page, `Topic: technology and humanity

Research question: How will future technology change the relationship between human needs and machine systems?

Working thesis: Future technology should be judged by how well it supports human agency, accessibility, and ethical responsibility.

Thesis map:
- Reason 1: Human-centered design can make technology easier to use.
- Reason 2: AI assistants can extend human capability when users remain in control.
- Reason 3: Ethical design is needed to prevent dependency and privacy harms.`);

  await h.generateButton(page, 1).click();
  await expect(page.getByText(/Module 2 of 6/)).toBeVisible({ timeout: 20_000 });
  await h.expectEditorText(page, /technology and humanity/i);
  expect(await h.editorText(page)).not.toMatch(/social media/i);

  await h.generateButton(page, 2).click();
  await expect(page.getByText(/Module 3 of 6/)).toBeVisible({ timeout: 20_000 });
  await h.expectEditorText(page, /technology and humanity|human-centered design/i);
  expect(await h.editorText(page)).not.toMatch(/social media/i);
});

test("generate next moves Module 3 outline to Module 4 draft paragraphs and opens at top", async ({ page }) => {
  await h.moduleButton(page, 3, "Outline").click();
  const textEditor = h.editor(page);
  await h.setEditorText(page, `Topic: Social media balance and youth wellbeing

Introduction plan
- Hook / importance: Social media now shapes how young people communicate, relax, study, and compare themselves with others.
- Background: Social media offers connection and information, while also creating risks such as passive scrolling, distraction, social comparison, and pressure on wellbeing.
- Research question: How can we strike a healthier social media balance?
- Thesis: A healthier social media balance is possible when users build intentional habits, platforms redesign engagement systems, and schools teach stronger digital literacy.
- Thesis map: The essay will first discuss intentional user habits, then examine platform design responsibilities, and finally consider the role of digital literacy education.

Body paragraph 1
- Topic sentence: Individual habits are important because many harmful patterns of social media use come from passive and unplanned scrolling.
- Evidence to use: [source needed: study or report on passive social media use, screen time, sleep, attention, or youth wellbeing]
- Analysis purpose: Explain how intentional habits such as app limits, no-phone study periods, or mindful checking routines reduce passive consumption and make social media use more deliberate.
- Link back: This supports the thesis by showing that balance begins with user agency, not total rejection of social media.

Body paragraph 2
- Topic sentence: Platform design also matters because recommendation systems, notifications, and engagement metrics influence what users see and how long they stay online.
- Evidence to use: [source needed: study or professional report on engagement design, recommendation algorithms, notifications, or social comparison]
- Analysis purpose: Explain why individual self-control is limited when platforms are designed to maximize attention, and why design changes could reduce comparison and distraction.
- Link back: This supports the thesis by showing that healthier balance requires institutional responsibility as well as personal habits.

Body paragraph 3
- Topic sentence: Schools can support healthier social media use by teaching digital literacy rather than leaving young people to navigate platforms alone.
- Evidence to use: [source needed: education research or policy report on digital literacy, online safety, or media education]
- Analysis purpose: Explain how digital literacy helps students evaluate online content, recognize manipulative design, and reflect on how social media affects their emotions and attention.
- Link back: This supports the thesis by showing that balance can be learned and practiced.

Counterargument paragraph
- Opposing view: Some readers may argue that stronger restrictions or age-based bans are necessary because young users cannot reliably manage social media risks on their own.
- Response: Acknowledge that restrictions may reduce some harms, but argue that long-term balance also requires habits, better design, and education.

Conclusion plan
- Rephrased thesis: Social media balance is most realistic when responsibility is shared among users, platforms, and schools.
- Summary of main arguments: Bring together personal habits, platform design, and digital literacy as complementary responses.
- So what / implication: End by explaining that the goal is not to reject social media entirely, but to make its benefits less dependent on constant attention and comparison.`);

  await expect(h.generateButton(page, 3)).toBeEnabled();
  await textEditor.evaluate((node) => {
    node.scrollTop = 500;
    node.dispatchEvent(new Event("scroll"));
  });
  await h.generateButton(page, 3).click();

  await expect(page.getByText(/Module 4 of 6/)).toBeVisible({ timeout: 20_000 });
  await h.expectEditorAtTop(page);
  const value = await h.editorText(page);
  expect(value.startsWith("Social media")).toBe(true);
  expect(value).toContain("social media");
  expect(value).toContain("intentional habits");
  expect(value).toContain("platform");
  expect(value).toContain("digital literacy");
  expect(value).toMatch(/\n\nFirst,[\s\S]*\n\nSecond,[\s\S]*\n\nThird,/);
  for (const forbidden of [
    "Introduction plan is an important academic issue",
    "The student should",
    "the strongest body paragraph should",
    "the draft should develop",
    "return to introduction plan",
    "Topic sentence:",
    "Evidence to use:",
    "Analysis purpose:",
    "Link back:"
  ]) {
    expect(value).not.toContain(forbidden);
  }
  await expect(page.getByTestId("toolbar-status")).toContainText("Module 4 generated and opened. Previous Module 4 saved as a snapshot.");
});

test("empty source module shows a friendly Generate Next error", async ({ page }) => {
  await h.moduleButton(page, 4, "Drafting").click();
  await h.expectEditorText(page, "");

  await h.generateButton(page, 4).click();

  await expect(page.getByTestId("toolbar-status")).toContainText("Add content to Module 4 before generating Module 5.");
  await expect(page.getByText(/Module 4 of 6/)).toBeVisible();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
  expect(state.currentModule).toBe(4);
  expect(state.modules["5"].text).toBe("");
});
