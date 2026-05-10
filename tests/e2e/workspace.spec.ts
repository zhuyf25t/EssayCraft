import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const editor = (page: Page) => page.getByTestId("editor-textarea");
const NOTE_LEAK_RE = /\u2063|\u2064|NOTE:[A-Za-z0-9_-]+|\/NOTE|NOTE[A-Za-z0-9_-]{6,}|PATCH[A-Za-z0-9_-]{6,}|\b(?:note|patch)-[0-9a-f-]{6,}\b|\[object Object\]/i;
const generateButton = (page: Page, fromModule: number) =>
  page.getByRole("button", { name: new RegExp(`^Generate Module ${fromModule + 1} from Module ${fromModule}$`) });
const moduleButton = (page: Page, moduleNumber: number, title: string) =>
  page.getByTitle(`Module ${moduleNumber}: ${title}`).first();

async function setEditorText(page: Page, value: string) {
  await editor(page).evaluate((node, text) => {
    const root = node as HTMLElement;
    root.textContent = text;
    root.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: null }));
  }, value);
  await expect.poll(async () => canonicalModuleText(page)).toBe(value);
}

async function selectEditorRange(page: Page, start: number, end: number) {
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

async function openExportTab(page: Page) {
  await page.getByRole("tab", { name: /Export/i }).click();
  await expect(page.getByRole("tabpanel", { name: "Export" })).toBeVisible();
}

async function openReferenceTranslation(page: Page) {
  await openExportTab(page);
  await page.getByRole("button", { name: "Reference Translation" }).click();
}

async function expectEditorAtTop(page: Page) {
  await expect.poll(async () => editor(page).evaluate((node) => Math.round(node.scrollTop))).toBeLessThanOrEqual(2);
}

async function canonicalModuleText(page: Page, moduleNumber?: number) {
  return page.evaluate((mod) => {
    const state = JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}");
    const moduleKey = mod ?? state.currentModule ?? 1;
    return state.modules[String(moduleKey)].text as string;
  }, moduleNumber);
}

async function editorText(page: Page) {
  return editor(page).evaluate((node) => {
    const cleanText = (node as HTMLElement).dataset.cleanText;
    if (cleanText !== undefined) return cleanText;
    const clone = (node as HTMLElement).cloneNode(true) as HTMLElement;
    clone.querySelectorAll("[data-inline-note-id], [data-inline-note-editor]").forEach((item) => item.remove());
    return (clone.textContent ?? "").replace(/\r\n/g, "\n").replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trimEnd();
  });
}

async function expectEditorText(page: Page, expected: string | RegExp) {
  const value = await editorText(page);
  if (typeof expected === "string") expect(value).toBe(expected);
  else expect(value).toMatch(expected);
}

async function expectCleanEditorAndModuleText(page: Page, expectedText?: string) {
  const visible = await editor(page).evaluate((node) => (node as HTMLElement).innerText);
  const clean = await editorText(page);
  const moduleText = await canonicalModuleText(page);
  if (expectedText !== undefined) expect(moduleText).toBe(expectedText);
  expect(visible).not.toMatch(NOTE_LEAK_RE);
  expect(clean).not.toMatch(NOTE_LEAK_RE);
  expect(moduleText).not.toMatch(NOTE_LEAK_RE);
  expect(moduleText).not.toContain("[Note:");
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/");
});

test("homepage renders EssayCraft title without runtime 500", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByText("EssayCraft").first()).toBeVisible();
  await expect(page.getByTestId("app-shell")).toBeVisible();
  expect(consoleErrors.filter((message) => message.includes("Encountered two children with the same key"))).toHaveLength(0);
});

test("fixed shell keeps browser page from scrolling while editor owns long text scroll", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const longText = Array.from({ length: 55 }, (_, index) => `Paragraph ${index + 1}. This paragraph makes the writing canvas long enough to scroll internally.`).join("\n\n");
  await setEditorText(page, longText);

  const metrics = await page.evaluate(() => {
    const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement;
    const textArea = q("editor-textarea");
    const highlightKey = q("highlight-key");
    const sidebar = q("module-sidebar");
    const keyRect = highlightKey.getBoundingClientRect();
    return {
      documentOverflow: document.documentElement.scrollHeight - window.innerHeight,
      bodyOverflow: document.body.scrollHeight - window.innerHeight,
      editorOverflow: textArea.scrollHeight - textArea.clientHeight,
      editorResize: getComputedStyle(textArea).resize,
      keyVisible: keyRect.bottom <= window.innerHeight + 1 && keyRect.top >= 0,
      keyInSidebar: sidebar.contains(highlightKey)
    };
  });

  expect(metrics.documentOverflow).toBeLessThanOrEqual(4);
  expect(metrics.bodyOverflow).toBeLessThanOrEqual(4);
  expect(metrics.editorOverflow).toBeGreaterThan(100);
  expect(metrics.editorResize).toBe("none");
  expect(metrics.keyVisible).toBe(true);
  expect(metrics.keyInSidebar).toBe(true);

  await page.mouse.wheel(0, 600);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  await editor(page).evaluate((node) => {
    node.scrollTop = 240;
    node.dispatchEvent(new Event("scroll"));
  });
  await expect.poll(async () => editor(page).evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
});

test("toolbar hierarchy stays visible without global page scroll", async ({ page }) => {
  const nextConfig = await readFile("next.config.ts", "utf8");
  expect(nextConfig).toContain("devIndicators: false");

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 720 }
  ]) {
    await page.setViewportSize(viewport);
    const metrics = await page.evaluate(() => {
      const toolbar = document.querySelector('[data-testid="action-toolbar"]') as HTMLElement;
      const generate = document.querySelector('[data-testid="workflow-generate"]') as HTMLElement;
      const bottomBar = document.querySelector('[data-testid="bottom-action-bar"]') as HTMLElement;
      const key = document.querySelector('[data-testid="highlight-key"]') as HTMLElement;
      const progress = document.querySelector('[data-testid="module-progress"]') as HTMLElement;
      const toolbarRect = toolbar.getBoundingClientRect();
      const generateRect = generate.getBoundingClientRect();
      const bottomRect = bottomBar.getBoundingClientRect();
      const keyRect = key.getBoundingClientRect();
      const progressRect = progress.getBoundingClientRect();
      return {
        toolbarLeft: toolbarRect.left,
        toolbarRight: toolbarRect.right,
        generateTop: generateRect.top,
        generateRight: generateRect.right,
        bottomBarTop: bottomRect.top,
        keyBottom: keyRect.bottom,
        progressHeight: progressRect.height,
        documentOverflow: document.documentElement.scrollHeight - window.innerHeight
      };
    });
    expect(metrics.toolbarLeft).toBeGreaterThanOrEqual(0);
    expect(metrics.toolbarRight).toBeLessThanOrEqual(viewport.width + 1);
    expect(metrics.generateTop).toBeGreaterThanOrEqual(0);
    expect(metrics.generateRight).toBeLessThanOrEqual(viewport.width + 1);
    expect(metrics.bottomBarTop).toBeGreaterThan(viewport.height - 90);
    expect(metrics.keyBottom).toBeLessThanOrEqual(viewport.height + 1);
    expect(metrics.progressHeight).toBeLessThanOrEqual(44);
    expect(metrics.documentOverflow).toBeLessThanOrEqual(4);
  }
  await expect(page.getByTestId("compact-progress-circles")).toBeVisible();
  await expect(page.getByText("Module progress")).toHaveCount(0);
  for (const step of ["Preparing context", "Drafting preview", "Ready"]) {
    await expect(page.getByText(step, { exact: true })).toHaveCount(0);
  }
  await expect(page.getByTestId("bottom-action-bar")).toContainText("Save Snapshot");
});

test("left sidebar highlight key uses visible marker chips", async ({ page }) => {
  const key = page.getByTestId("highlight-key");
  await expect(key).toBeVisible();
  await expect(page.getByTestId("module-sidebar").getByTestId("highlight-key")).toBeVisible();
  for (const label of ["Background", "Thesis", "Evidence", "Analysis", "Counterargument", "Citation", "Conclusion", "Issue"]) {
    await expect(key).toContainText(label);
  }
  const swatches = await key.locator('span[style*="background-color"]').evaluateAll((nodes) =>
    nodes.map((node) => getComputedStyle(node as HTMLElement).backgroundColor)
  );
  expect(swatches.length).toBeGreaterThanOrEqual(8);
  expect(swatches.every((color) => color && color !== "rgba(0, 0, 0, 0)" && color !== "transparent")).toBe(true);
  await expect(page.getByText("Project title and Module 1 research question differ")).toHaveCount(0);
});

test("highlight rendering ignores stale and blank annotation bars", async ({ page }) => {
  await setEditorText(page, "Topic: Clean highlights\n\nWorking thesis: Highlight bars should only appear behind text.");
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}");
    state.modules["1"].annotations = [
      { id: "blank", start: 23, end: 25, text: "\n\n", label: "thesis" },
      { id: "stale", start: 999, end: 1005, text: "ghost", label: "thesis" },
      { id: "valid", start: 0, end: 23, text: "Topic: Clean highlights", label: "background" }
    ];
    localStorage.setItem("essaycraft:mvp:project", JSON.stringify(state));
  });
  await page.reload();
  await expect(page.getByTestId("editor-textarea")).toBeVisible();
  const blankMarks = await page.locator(".highlight-backdrop").evaluateAll((nodes) =>
    nodes.filter((node) => !((node.textContent ?? "").trim())).length
  );
  expect(blankMarks).toBe(0);
});

test("right panel tabs keep secondary work organized and toolbar clutter is reduced", async ({ page }) => {
  const rail = page.getByTestId("right-rail");
  await expect(rail.getByRole("tablist", { name: "Right workspace" })).toBeVisible();

  await rail.getByRole("tab", { name: /Sources/i }).click();
  await expect(rail.getByRole("tab", { name: /Sources/i })).toHaveAttribute("aria-selected", "true");
  await expect(rail.getByRole("tabpanel", { name: "Sources" })).toBeVisible();
  await expect(rail.getByRole("tabpanel", { name: "Assistant" })).toBeHidden();

  await rail.getByRole("tab", { name: /Snapshots/i }).click();
  await expect(rail.getByRole("tabpanel", { name: "Snapshots" })).toContainText("saved");

  await rail.getByRole("tab", { name: /Export/i }).click();
  await expect(rail.getByRole("tabpanel", { name: "Export" })).toContainText("Export & Project Files");
  await expect(page.getByTestId("editor-shell")).not.toContainText("AI diagnostics");
  await rail.getByRole("tabpanel", { name: "Export" }).getByRole("button", { name: /AI diagnostics/ }).click();
  await expect(page.getByTestId("ai-diagnostics")).toContainText(/Interactive timeout|Provider configured/i);

  await rail.getByRole("tab", { name: /Assistant/i }).click();
  await expect(rail.getByRole("tabpanel", { name: "Assistant" })).toContainText("Chat");

  await expect(page.getByTestId("toolbar-more")).toHaveCount(0);
  await expect(page.getByTestId("last-action")).toHaveCount(0);

  await rail.getByRole("tab", { name: /Snapshots/i }).click();
  await rail.getByRole("tabpanel", { name: "Snapshots" }).getByRole("button", { name: "Save Snapshot" }).click();
  await expect(page.getByText("Manual snapshot")).toBeVisible();

  await openExportTab(page);
  for (const name of ["Copy Rich Text", "Download HTML", "Download full project JSON", "Import full project JSON", "Reference Translation", "Reset Demo"]) {
    await expect(page.getByRole("button", { name })).toBeVisible();
  }
});

test("student can edit paragraphs, add a patch, and insert a manual citation", async ({ page }) => {
  await expect(page.getByText("EssayCraft").first()).toBeVisible();

  const textEditor = editor(page);
  await setEditorText(page, "Topic: Campus phone habits.\n\nQuestion: How can students reduce distraction without losing connection?");
  await expectEditorText(page, /Campus phone habits\.\n\nQuestion:/);

  await textEditor.focus();
  await page.keyboard.press("Control+Enter");
  const patchBox = page.getByPlaceholder("Add a note for EssayCraft");
  await expect(patchBox).toBeVisible();
  await patchBox.fill("Make the question more specific for a school policy essay.");
  await page.keyboard.press("Control+Enter");
  await expect(page.getByTestId("patch-marker")).toBeVisible();
  await expect(page.getByTestId("patch-margin-marker")).toBeVisible();
  await expect(page.getByTestId("patch-margin-marker")).toHaveAttribute("title", /Make the question more specific/);
  await expect(page.getByTestId("patch-list")).toHaveCount(0);
  expect(await canonicalModuleText(page)).not.toContain("Make the question more specific");

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
  await expectEditorText(page, /\(Rivera, 2024\)/);
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
  const textEditor = editor(page);
  await setEditorText(page, `Topic: AI study tools.

Question: When do AI tools help students learn?

${Array.from({ length: 28 }, (_, index) => `Planning note ${index + 1}: AI study tools should support revision without replacing student thinking.`).join("\n\n")}`);
  await expectEditorText(page, /AI study tools\.\n\nQuestion:/);
  await textEditor.evaluate((node) => {
    node.scrollTop = 500;
    node.dispatchEvent(new Event("scroll"));
  });

  await expect(generateButton(page, 1)).toBeEnabled();
  await generateButton(page, 1).click();

  await expect(page.getByText(/Module 2 of 6/)).toBeVisible({ timeout: 20_000 });
  await expectEditorAtTop(page);
  await expectEditorText(page, /Research plan for: AI study tools[\s\S]*Argument branch 1[\s\S]*\n\nArgument branch 2/);
  await expect(page.getByTestId("toolbar-status")).toContainText("Module 2 generated and opened. Previous Module 2 saved as a snapshot.");
});

test("Module 2 to Module 3 creates a coherent branch-specific outline and opens at top", async ({ page }) => {
  await moduleButton(page, 2, "Research & Evidence").click();
  await setEditorText(page, `Research plan for: technology and humanity

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
  await editor(page).evaluate((node) => {
    node.scrollTop = 500;
    node.dispatchEvent(new Event("scroll"));
  });

  await generateButton(page, 2).click();

  await expect(page.getByText(/Module 3 of 6/)).toBeVisible({ timeout: 20_000 });
  await expectEditorAtTop(page);
  const value = await editorText(page);
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
  await setEditorText(page, `Topic: technology and humanity

Research question: How will future technology change the relationship between human needs and machine systems?

Working thesis: Future technology should be judged by how well it supports human agency, accessibility, and ethical responsibility.

Thesis map:
- Reason 1: Human-centered design can make technology easier to use.
- Reason 2: AI assistants can extend human capability when users remain in control.
- Reason 3: Ethical design is needed to prevent dependency and privacy harms.`);

  await generateButton(page, 1).click();
  await expect(page.getByText(/Module 2 of 6/)).toBeVisible({ timeout: 20_000 });
  await expectEditorText(page, /technology and humanity/i);
  expect(await editorText(page)).not.toMatch(/social media/i);

  await generateButton(page, 2).click();
  await expect(page.getByText(/Module 3 of 6/)).toBeVisible({ timeout: 20_000 });
  await expectEditorText(page, /technology and humanity|human-centered design/i);
  expect(await editorText(page)).not.toMatch(/social media/i);
});

test("generate next moves Module 3 outline to Module 4 draft paragraphs and opens at top", async ({ page }) => {
  await moduleButton(page, 3, "Outline").click();
  const textEditor = editor(page);
  await setEditorText(page, `Topic: Social media balance and youth wellbeing

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

  await expect(generateButton(page, 3)).toBeEnabled();
  await textEditor.evaluate((node) => {
    node.scrollTop = 500;
    node.dispatchEvent(new Event("scroll"));
  });
  await generateButton(page, 3).click();

  await expect(page.getByText(/Module 4 of 6/)).toBeVisible({ timeout: 20_000 });
  await expectEditorAtTop(page);
  const value = await editorText(page);
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
  await moduleButton(page, 4, "Drafting").click();
  await expectEditorText(page, "");

  await generateButton(page, 4).click();

  await expect(page.getByTestId("toolbar-status")).toContainText("Add content to Module 4 before generating Module 5.");
  await expect(page.getByText(/Module 4 of 6/)).toBeVisible();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
  expect(state.currentModule).toBe(4);
  expect(state.modules["5"].text).toBe("");
});

test("refresh highlighting preserves exact editor text", async ({ page }) => {
  const original = "Topic: Citation testing.\n\nResearch shows an important pattern [citation needed].\n\nThis paragraph must stay exactly the same.";
  await setEditorText(page, original);
  await page.getByRole("button", { name: "Refresh Highlighting" }).click();
  await expectEditorText(page, original);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
  expect(state.modules["1"].text).toBe(original);
  expect(state.modules["1"].annotations.every((annotation: { start: number; end: number; text: string }) =>
    state.modules["1"].text.slice(annotation.start, annotation.end) === annotation.text
  )).toBe(true);
});

test("Translate preview shows Chinese mock output without changing the document", async ({ page }) => {
  const original = "Topic: Campus notification habits.\n\nQuestion: How can schools reduce distraction while keeping students connected?\n\nEvidence note: This claim needs support [citation needed].\n\nResearch plan marker: Add a study [source needed].";
  await setEditorText(page, original);
  const beforeState = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
  const beforeSnapshots = beforeState.modules["1"].snapshots.length;

  await openReferenceTranslation(page);
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
  await expect(dialog).not.toContainText(/DeepSeek|provider|fallback|debug|AI returned|no API key/i);
  for (const banned of ["中文参考翻译：", "这句话讨论了", "这句话强调", "核心论点是", "本地参考翻译", "译文:"]) {
    await expect(translation).not.toContainText(banned);
  }
  const translatedText = await translation.textContent();
  expect((translatedText?.match(/\n\s*\n/g) ?? []).length).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole("button", { name: "Apply translation" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Copy translation" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send to Assistant" })).toBeVisible();
  await expectEditorText(page, original);

  await page.getByRole("button", { name: "Copy translation" }).click();
  await expectEditorText(page, original);

  await page.getByRole("button", { name: "Send to Assistant" }).click();
  await expect(page.getByTestId("assistant-chat-messages")).toContainText("Reference translation");
  await expect(page.getByTestId("assistant-chat-messages")).toContainText("reading aid only");
  await expectEditorText(page, original);

  await openReferenceTranslation(page);
  await page.getByRole("button", { name: "Close" }).last().click();
  await expectEditorText(page, original);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
  expect(state.modules["1"].text).toBe(original);
  expect(state.modules["1"].snapshots.length).toBe(beforeSnapshots);
});

test("Translate modal does not corrupt editor scroll position", async ({ page }) => {
  const original = Array.from({ length: 45 }, (_, index) => `Paragraph ${index + 1}. This text keeps the editor scrollable for translation preview checks.`).join("\n\n");
  await setEditorText(page, original);
  await editor(page).evaluate((node) => {
    node.scrollTop = 420;
    node.dispatchEvent(new Event("scroll"));
  });
  const beforeScroll = await editor(page).evaluate((node) => node.scrollTop);
  expect(beforeScroll).toBeGreaterThan(100);

  await openReferenceTranslation(page);
  await expect(page.getByTestId("translate-dialog").getByRole("heading", { name: "Reference Translation" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).last().click();

  await expectEditorText(page, original);
  await expect.poll(async () => editor(page).evaluate((node) => node.scrollTop)).toBeGreaterThan(100);
});

test("assistant chat mode answers module-level Ask without a preview card", async ({ page }) => {
  await expect(page.getByTestId("assistant-chat-mode")).toBeVisible();
  await expect(page.getByTestId("assistant-chat-composer")).toBeVisible();
  const overflow = await page.getByTestId("assistant-chat-messages").evaluate((node) => getComputedStyle(node as HTMLElement).overflowY);
  expect(overflow).toBe("auto");

  await page.getByPlaceholder("Ask EssayCraft about this module...").fill("What do you think of this paragraph?");
  await page.getByRole("button", { name: "Send" }).click();

  const messages = page.getByTestId("assistant-chat-messages");
  await expect(messages).toContainText("What do you think of this paragraph?");
  await expect(messages).toContainText("Your Module 1 has", { timeout: 20_000 });
  await expect(messages).toContainText("thesis map");
  await expect(messages).not.toContainText("I can explain highlights");
  await expect(page.getByTestId("assistant-edit-preview")).toHaveCount(0);
  for (const raw of ["proposedText", "replaceRange", "invalid_type", "Expected string"]) {
    await expect(messages).not.toContainText(raw);
  }
  const atBottom = await messages.evaluate((node) => {
    const el = node as HTMLElement;
    return el.scrollTop + el.clientHeight >= el.scrollHeight - 6;
  });
  expect(atBottom).toBe(true);
});

test("clicking a sentence activates Edit selection mode", async ({ page }) => {
  await setEditorText(page, "First sentence has a clear claim. Second sentence adds detail.");
  const box = await editor(page).boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.click(box!.x + 80, box!.y + 55);

  await expect(page.getByTestId("assistant-edit-mode")).toBeVisible();
  await expect(page.getByTestId("assistant-edit-context")).toContainText("Active sentence");
  await expect(page.getByTestId("assistant-edit-context")).toContainText("First sentence has a clear claim.");
  await expect(page.locator(".active-sentence-backdrop")).toHaveCount(1);
});

test("Edit mode explains active highlight without confidence or relabel controls", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Inspect" })).toHaveCount(0);
  await selectEditorRange(page, 0, "Topic: Social media balance and youth wellbeing".length);
  const editContext = page.getByTestId("assistant-edit-context");
  await expect(editContext).toContainText("Background");
  await expect(editContext).toContainText("Topic: Social media balance");
  await expect(editContext).not.toContainText(/confidence|%/i);
  await expect(page.getByRole("combobox")).toHaveCount(0);
  await expect(page.getByTestId("highlight-key-background")).toHaveClass(/border-black/);

  await page.getByRole("button", { name: "Explain highlight" }).click();
  await expect(page.getByTestId("assistant-highlight-explanation")).toContainText("Highlight explanation", { timeout: 20_000 });
  await expect(page.getByTestId("assistant-highlight-explanation")).toContainText(/background|thesis|highlight/i);
  await expect(page.getByTestId("assistant-highlight-explanation").getByRole("button", { name: "Accept" })).toHaveCount(0);
  await expectEditorText(page, /Topic: Social media balance/);

  await setEditorText(page, "Plain draft without refreshed annotations.");
  await editor(page).click();
  await expect(page.getByRole("button", { name: "Explain highlight" })).toBeEnabled();
  await page.getByRole("button", { name: "Explain highlight" }).click();
  await expect(page.getByTestId("assistant-highlight-explanation")).toContainText("Highlight explanation", { timeout: 20_000 });
  await expect(page.getByTestId("assistant-highlight-explanation").getByRole("button", { name: "Accept" })).toHaveCount(0);
});

test("assistant uses selection context and dismisses preview without changing text", async ({ page }) => {
  const original = "Working thesis: Social media balance requires intentional habits and platform responsibility. This long explanation adds enough words to prove the side panel only shows the head and tail of a long active selection instead of taking over the entire assistant panel.";
  await setEditorText(page, original);
  await editor(page).click();
  await expect(page.getByTestId("assistant-edit-context")).toContainText("Active sentence");
  await selectEditorRange(page, 0, original.length);

  await expect(page.getByTestId("assistant-edit-context")).toContainText("Selected range");
  await expect(page.getByTestId("assistant-edit-context")).toContainText(`${original.length} chars`);
  await expect(page.getByTestId("assistant-edit-context")).toContainText("(compact)");
  await expect(page.getByRole("button", { name: "Rewrite", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Make academic" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Translate" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Explain highlight" })).toBeVisible();
  const academicButtonStyle = await page.getByRole("button", { name: "Make academic" }).evaluate((node) => {
    const style = getComputedStyle(node as HTMLElement);
    return { background: style.backgroundColor, color: style.color };
  });
  expect(academicButtonStyle.background).not.toBe("rgb(255, 255, 255)");
  await expect(page.getByRole("button", { name: "Strengthen" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add note" })).toHaveCount(0);
  await page.getByRole("button", { name: "Rewrite", exact: true }).click();
  await expect(page.getByTestId("assistant-edit-preview")).toContainText("Revision preview", { timeout: 20_000 });
  await expect(page.getByTestId("assistant-edit-preview").getByRole("button", { name: "Accept" })).toBeVisible();
  await expect(page.getByTestId("assistant-edit-preview").getByRole("button", { name: "Copy" })).toBeVisible();
  await page.getByRole("button", { name: "Reject" }).click();
  await expectEditorText(page, original);
});

test("rewrite follows English and Chinese length instructions without meta text", async ({ page }) => {
  const original = "Research question: How can students use AI responsibly?";
  await page.getByLabel("Project Title").fill("Technology vs. Humanity.");
  await setEditorText(page, original);
  await selectEditorRange(page, 0, original.length);

  await page.getByPlaceholder("Tell EssayCraft what you want to change").fill("可以把问题写得更长一点，并且结合 project title");
  await page.getByRole("button", { name: "Rewrite", exact: true }).click();
  await expect(page.getByTestId("assistant-edit-preview")).toContainText("Revision preview", { timeout: 20_000 });

  const proposed = await page.getByTestId("assistant-edit-preview").locator("p").nth(1).innerText();
  expect(proposed.length).toBeGreaterThan(original.length);
  expect(proposed).toContain("Research question:");
  expect(proposed).toMatch(/technolog|human/i);
  for (const banned of [
    "A more academic version could state",
    "could state:",
    "Here is a revised version",
    "I would rewrite it as",
    "This rewrite improves",
    "The student should",
    "if this includes factual evidence",
    "citation needed if this includes factual evidence",
    "This selected text means",
    "The following sentence",
    "In this context, the sentence could be"
  ]) {
    expect(proposed).not.toContain(banned);
  }
  await page.getByRole("button", { name: "Accept" }).click();
  expect(await editorText(page)).not.toBe(original);
  await expect.poll(async () => (await editorText(page)).length).toBeGreaterThan(original.length);
});

test("selected text translation is read-only in Edit mode", async ({ page }) => {
  const original = "Social media balance requires intentional habits.";
  await setEditorText(page, original);
  await selectEditorRange(page, 0, "Social media balance".length);

  await page.getByRole("button", { name: "Translate" }).click();
  await expect(page.getByTestId("assistant-edit-preview")).toContainText("Translation preview", { timeout: 20_000 });
  await expect(page.getByTestId("assistant-edit-preview")).toContainText(/[\u4e00-\u9fff]/);
  await expect(page.getByTestId("assistant-edit-preview")).not.toContainText(/DeepSeek|provider|fallback|debug|AI returned|no API key/i);
  await expect(page.getByTestId("assistant-edit-preview").getByRole("button", { name: "Accept" })).toHaveCount(0);
  await expect(page.getByTestId("assistant-edit-preview").getByRole("button", { name: "Copy" })).toBeVisible();
  await expect(page.getByTestId("assistant-edit-preview")).not.toContainText("requires intentional habits");
  await expectEditorText(page, original);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
  expect(state.modules["1"].snapshots.length).toBe(0);
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expectEditorText(page, original);
});

test("inline notes drive apply notes preview and preserve text until accepted", async ({ page }) => {
  const original = "Research shows that better phone habits improve student attention.";
  await setEditorText(page, original);
  await selectEditorRange(page, 0, "Research shows".length);
  await expect(page.getByTestId("assistant-edit-context")).toContainText("Selected range");
  await page.keyboard.press("Control+Enter");
  const patchBox = page.getByPlaceholder("Add a note for EssayCraft");
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
  expect(await canonicalModuleText(page)).toBe(original);
  await expectCleanEditorAndModuleText(page, original);
  await expect(page.getByTestId("patch-list")).toHaveCount(0);
  await page.getByTestId("patch-margin-marker").click();
  await expect(patchBox).toHaveValue("This is analysis, not evidence.");
  await patchBox.fill("This is analysis, not evidence. Find a stronger source.");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("patch-margin-marker")).toHaveAttribute("title", /Find a stronger source/);
  await page.getByTestId("patch-margin-marker").getByRole("button", { name: "Delete note" }).click();
  await expect(page.getByTestId("patch-margin-marker")).toHaveCount(0);
  expect(await canonicalModuleText(page)).toBe(original);
  await selectEditorRange(page, 0, "Research shows".length);
  await expect(page.getByTestId("assistant-edit-context")).toContainText("Selected range");
  await page.keyboard.press("Control+Enter");
  await page.getByPlaceholder("Add a note for EssayCraft").fill("This is analysis, not evidence. Find a stronger source.");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("patch-margin-marker")).toBeVisible();

  await page.getByRole("button", { name: "Apply Notes & Refresh" }).click();
  await expect(page.getByTestId("apply-notes-preview")).toContainText("Apply notes preview", { timeout: 20_000 });
  expect(await canonicalModuleText(page)).toBe(original);
  await page.getByRole("button", { name: "Reject" }).click();
  expect(await canonicalModuleText(page)).toBe(original);
  let stateAfterPreview = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
  expect(stateAfterPreview.modules["1"].patches[0].resolved).toBe(false);
  await expect(page.getByTestId("patch-margin-marker")).toBeVisible();

  await page.getByRole("button", { name: "Apply Notes & Refresh" }).click();
  await expect(page.getByTestId("apply-notes-preview")).toContainText("Apply notes preview", { timeout: 20_000 });
  await page.getByRole("button", { name: "Accept" }).click();
  await expect.poll(async () => canonicalModuleText(page)).not.toBe(original);
  stateAfterPreview = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
  expect(stateAfterPreview.modules["1"].snapshots[0].text).toBe(original);
  await expect.poll(async () => {
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
    return state.modules["1"].patches[0]?.status ?? (state.modules["1"].patches[0]?.resolved ? "resolved" : "open");
  }).toBe("resolved");
  await expect(page.getByTestId("patch-margin-marker")).toHaveCount(0);

  await page.getByTestId("toolbar-status").getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => canonicalModuleText(page)).toBe(original);
  const undoState = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
  expect(undoState.modules["1"].patches[0].resolved).toBe(false);
});

test("Chinese note input persists and Project Title drives Apply Notes", async ({ page }) => {
  const original = "Topic: Social media balance\n\nResearch question: How can social media be healthier?";
  await page.getByLabel("Project Title").fill("Technology vs. Humanity.");
  await setEditorText(page, original);
  await selectEditorRange(page, 0, "Topic: Social media balance".length);
  await page.keyboard.press("Control+Enter");

  const noteInput = page.getByPlaceholder("Add a note for EssayCraft");
  await noteInput.pressSequentially("根据我的 title 重写这个 topic");
  await expect(noteInput).toHaveValue("根据我的 title 重写这个 topic");
  await page.waitForTimeout(300);
  await expect(noteInput).toHaveValue("根据我的 title 重写这个 topic");
  expect(await canonicalModuleText(page)).toBe(original);
  expect(await canonicalModuleText(page)).not.toContain("根据我的 title");
  await page.getByTestId("inline-patch-editor").getByRole("button", { name: "Save" }).click();

  await expect(page.getByTestId("patch-margin-marker")).toHaveAttribute("title", "根据我的 title 重写这个 topic");
  const stateAfterSave = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
  expect(stateAfterSave.modules["1"].text).toBe(original);
  expect(stateAfterSave.modules["1"].text).not.toMatch(NOTE_LEAK_RE);
  expect(stateAfterSave.modules["1"].patches[0].text).toBe("根据我的 title 重写这个 topic");

  await page.getByTestId("patch-margin-marker").click();
  await expect(noteInput).toHaveValue("根据我的 title 重写这个 topic");
  await page.getByTestId("inline-patch-editor").getByRole("button", { name: "Save" }).click();

  await page.getByRole("button", { name: "Apply Notes & Refresh" }).click();
  await expect(page.getByTestId("apply-notes-preview")).toContainText("Technology", { timeout: 20_000 });
  await expect(page.getByTestId("apply-notes-preview")).toContainText(/humanity/i);
  expect(await canonicalModuleText(page)).toBe(original);

  await page.getByRole("button", { name: "Accept" }).click();
  await expect.poll(async () => canonicalModuleText(page)).toContain("Topic: Technology, humanity");
  const acceptedState = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
  expect(acceptedState.modules["1"].text).not.toContain("根据我的 title");
  expect(acceptedState.modules["1"].text).not.toMatch(NOTE_LEAK_RE);
  expect(acceptedState.modules["1"].patches[0].resolved).toBe(true);
  await expect(page.getByTestId("patch-margin-marker")).toHaveCount(0);
});

test("inline note tokens do not corrupt normal text, spaces, brackets, or paragraphs", async ({ page }) => {
  const literalNoteText = "Research note: compare the phrase [Note: compare sources] with the source cards.";
  await setEditorText(page, literalNoteText);
  expect(await canonicalModuleText(page)).toBe(literalNoteText);
  const literalState = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
  expect(literalState.modules["1"].patches).toHaveLength(0);

  const original = "Research shows that better phone habits improve student attention.\n\nSecond paragraph keeps its blank line.";
  await setEditorText(page, original);
  await selectEditorRange(page, 0, "Research shows".length);
  await page.keyboard.press("Control+Enter");
  await page.getByPlaceholder("Add a note for EssayCraft").fill("Use a source with ] bracket and [citation needed] marker.");
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
  await expectCleanEditorAndModuleText(page, original);

  await editor(page).evaluate((node, insertion) => {
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

  const canonical = await canonicalModuleText(page);
  expect(canonical).toContain("Research shows that better phone habits");
  expect(canonical).toContain("\n\nSecond paragraph keeps its blank line. Added ending.");
  expect(canonical).not.toContain("[Note:");
  await expectCleanEditorAndModuleText(page);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
  expect(state.modules["1"].patches).toHaveLength(1);
  expect(state.modules["1"].patches[0].text).toContain("] bracket");
  expect(state.modules["1"].patches[0].text).toContain("[citation needed]");
});

test("Chinese title note visibly revises topic only after Accept", async ({ page }) => {
  const original = "Topic: Social media balance\n\nResearch question: How can social media be healthier?";
  await setEditorText(page, original);
  await selectEditorRange(page, 0, "Topic: Social media balance".length);
  await page.keyboard.press("Control+Enter");
  await page.getByPlaceholder("Add a note for EssayCraft").fill("标题可以更长一点");
  await page.keyboard.press("Enter");

  await expect(page.getByTestId("patch-marker")).toBeVisible();
  await expect(page.getByTestId("patch-margin-marker")).toBeVisible();
  expect(await canonicalModuleText(page)).toBe(original);
  expect(await canonicalModuleText(page)).not.toContain("标题可以更长一点");

  await page.getByRole("button", { name: "Apply Notes & Refresh" }).click();
  await expect(page.getByTestId("apply-notes-preview")).toContainText("Apply notes preview", { timeout: 20_000 });
  await expect(page.getByTestId("apply-notes-preview")).toContainText(/responsible platform design/i);
  expect(await canonicalModuleText(page)).toBe(original);
  await page.getByRole("button", { name: "Accept" }).click();
  await expect.poll(async () => canonicalModuleText(page)).not.toBe(original);
  await expect.poll(async () => canonicalModuleText(page)).toContain("Topic: Social media balance, youth wellbeing, and responsible platform design");
  await expect(page.getByTestId("patch-margin-marker")).toHaveCount(0);
});

test("Chinese question note revises research question in preview", async ({ page }) => {
  const original = "Topic: Social media balance\n\nResearch question: How can we strike a healthier social media balance?";
  const question = "Research question: How can we strike a healthier social media balance?";
  await setEditorText(page, original);
  const start = original.indexOf(question);
  await selectEditorRange(page, start, start + question.length);
  await page.keyboard.press("Control+Enter");
  await page.getByPlaceholder("Add a note for EssayCraft").fill("为什么我觉得这个问题看起来有点呆板呢？意思就是，没有太多新意。");
  await page.keyboard.press("Enter");

  await page.getByRole("button", { name: "Apply Notes & Refresh" }).click();
  await expect(page.getByTestId("apply-notes-preview")).toContainText("individuals, schools, and social media platforms", { timeout: 20_000 });
  expect(await canonicalModuleText(page)).toBe(original);
  await page.getByRole("button", { name: "Reject" }).click();
  expect(await canonicalModuleText(page)).toBe(original);
  await expect(page.getByTestId("patch-margin-marker")).toBeVisible();
});

test("Apply Notes blocks stale preview after manual text edits", async ({ page }) => {
  const original = "Topic: Social media balance\n\nResearch question: How can social media be healthier?";
  await setEditorText(page, original);
  await selectEditorRange(page, 0, "Topic: Social media balance".length);
  await page.keyboard.press("Control+Enter");
  await page.getByPlaceholder("Add a note for EssayCraft").fill("Make this title longer.");
  await page.keyboard.press("Enter");

  await page.getByRole("button", { name: "Apply Notes & Refresh" }).click();
  await expect(page.getByTestId("apply-notes-preview")).toContainText("Apply notes preview", { timeout: 20_000 });

  const edited = `${original}\n\nManual sentence added after preview.`;
  await setEditorText(page, edited);

  await expectEditorText(page, edited);
  await expect(page.getByTestId("apply-notes-preview")).toHaveCount(0);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
  expect(state.modules["1"].text).toBe(edited);
  expect(state.modules["1"].patches).toHaveLength(1);
  expect(state.modules["1"].patches[0].resolved).toBe(false);
});

test("assistant apply snapshots selected replacement and blocks stale ranges", async ({ page }) => {
  const original = "Alpha sentence. kids get good things.";
  await setEditorText(page, original);
  await selectEditorRange(page, 16, original.length);
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
  await expectEditorText(page, /^Alpha sentence\. young people (get|gain) beneficial factors\./);
  const appliedState = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
  expect(appliedState.modules["1"].snapshots[0].text).toBe(original);
  await page.keyboard.press("Control+Z");
  await expectEditorText(page, original);

  const staleOriginal = "Alpha sentence. Beta sentence.";
  await setEditorText(page, staleOriginal);
  await selectEditorRange(page, 16, staleOriginal.length);
  await page.getByRole("button", { name: "Rewrite", exact: true }).click();
  await expect(page.getByTestId("assistant-edit-preview")).toContainText("Revision preview", { timeout: 20_000 });
  await setEditorText(page, `Inserted prefix. ${staleOriginal}`);
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByTestId("toolbar-status")).toContainText(/blocked|changed after the preview/i);
  await expectEditorText(page, `Inserted prefix. ${staleOriginal}`);
});

test("Module 5 citation check and Module 6 final export workflow are clear", async ({ page }) => {
  await moduleButton(page, 4, "Drafting").click();
  await setEditorText(page, "This draft makes a factual research claim about attention and wellbeing [citation needed].\n\nThe conclusion returns to the thesis.");
  await generateButton(page, 4).click();
  await expect(page.getByText(/Module 5 of 6/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("tab", { name: /Sources/i })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("module5-citation-checklist")).toContainText("Referencing / Citation Check checklist");
  await expect(page.getByTestId("module5-citation-checklist")).toContainText("Any [citation needed] markers?");

  await generateButton(page, 5).click();
  await expect(page.getByText(/Module 6 of 6/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("tab", { name: /Export/i })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("module6-final-checklist")).toContainText("Final review checklist");
  await expect(page.getByText("Generate Module 7 from Module 6")).toHaveCount(0);
  await expect(page.getByTestId("workflow-generate")).toContainText("Finalize / Export");
  await page.getByTestId("workflow-generate").click();
  await expect(page.getByText("EssayCraft Finish")).toBeVisible();
  await expect(page.getByText("Inspired by John-Paul Grima's argumentative essay journey.")).toBeVisible();
  await expect(page.getByAltText("EssayCraft finish moment")).toBeVisible();
});

test("full project JSON export includes six modules and all metadata groups", async ({ page }) => {
  await setEditorText(page, "Topic: Export test.\n\nWorking thesis: Export should preserve project metadata.");
  await selectEditorRange(page, 0, "Topic: Export test.".length);
  await page.keyboard.press("Control+Enter");
  await page.getByPlaceholder("Add a note for EssayCraft").fill("This patch should be exported.");
  await page.keyboard.press("Enter");

  await page.getByRole("tab", { name: /Snapshots/i }).click();
  await page.getByRole("tabpanel", { name: "Snapshots" }).getByRole("button", { name: "Save Snapshot" }).click();

  await page.getByRole("tab", { name: /Sources/i }).click();
  await page.getByPlaceholder("Source title").fill("Export source");
  await page.getByPlaceholder("Authors separated by ;").fill("Chen");
  await page.getByPlaceholder("Year").fill("2025");
  await page.getByRole("button", { name: "Add real source" }).click();

  await page.getByRole("tab", { name: /Assistant/i }).click();
  await page.getByRole("button", { name: "Chat" }).click();
  await page.getByPlaceholder("Ask EssayCraft about this module...").fill("What should I improve?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByTestId("assistant-chat-messages")).toContainText("What should I improve?");
  await expect(page.getByTestId("assistant-chat-messages")).toContainText(/Module 1|thesis|topic/i, { timeout: 20_000 });

  await page.getByRole("button", { name: "Apply Notes & Refresh" }).click();
  await expect(page.getByTestId("apply-notes-preview")).toContainText("Apply notes preview", { timeout: 20_000 });
  await page.getByRole("button", { name: "Accept" }).click();

  await page.getByRole("tab", { name: /Export/i }).click();
  await expect(page.getByRole("tabpanel", { name: "Export" })).toContainText("Full project JSON includes all 6 modules");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download full project JSON" }).click()
  ]);
  const filePath = await download.path();
  expect(filePath).toBeTruthy();
  const exported = JSON.parse(await readFile(filePath!, "utf8"));

  expect(exported.schemaVersion).toBe(1);
  expect(Object.keys(exported.modules).sort()).toEqual(["1", "2", "3", "4", "5", "6"]);
  expect(exported.modules["1"].text).not.toMatch(NOTE_LEAK_RE);
  expect(exported.modules["1"].text).not.toContain("This patch should be exported");
  expect(exported.modules["1"].text).not.toContain("[Note:");
  expect(exported.modules["1"].annotations.length).toBeGreaterThan(0);
  expect(exported.modules["1"].patches[0].text).toContain("This patch should be exported");
  expect(exported.modules["1"].snapshots.length).toBeGreaterThan(0);
  expect(exported.modules["1"].sources[0].title).toBe("Export source");
  expect(exported.assistantHistory.length).toBeGreaterThan(0);
  expect(JSON.stringify(exported)).not.toContain("DEEPSEEK_API_KEY");
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
  expect(body.text).toMatch(/\[source needed(?::[^\]]*)?\]/);
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

test("refresh API mock visibly revises naturalness notes", async ({ request }) => {
  const sourceText = "Research question: How can we strike a healthier social media balance?";
  const response = await request.post("/api/refresh", {
    data: {
      topic: "Social media balance",
      moduleNumber: 1,
      text: sourceText,
      annotations: [],
      patches: [{
        id: "patch-natural",
        moduleNumber: 1,
        anchorStart: 0,
        anchorEnd: sourceText.length,
        anchorQuote: sourceText,
        text: "让它更自然一点，也更有研究感。",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "open",
        resolved: false,
        stale: false
      }],
      sources: []
    }
  });

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.kind).toBe("revision");
  expect(body.proposedText).not.toBe(sourceText);
  expect(body.proposedText).toContain("individuals, schools, and social media platforms");
  expect(JSON.stringify(body)).not.toMatch(/DeepSeek|debug|AI returned|no API key/i);
});

test("assist API mock uses Project Title for Chinese rewrite instructions", async ({ request }) => {
  const selected = "Research question: How can social media be healthier?";
  const response = await request.post("/api/assist", {
    data: {
      topic: "Technology vs. Humanity.",
      projectTitle: "Technology vs. Humanity.",
      moduleNumber: 1,
      moduleTitle: "Topic & Question",
      text: selected,
      annotations: [],
      patches: [],
      sources: [],
      selectedRange: { start: 0, end: selected.length },
      selectedText: selected,
      action: "根据我的 title 重写，可以把问题写得更长一点",
      history: []
    }
  });

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.kind).toBe("edit");
  expect(body.proposedText).toContain("Research question:");
  expect(body.proposedText).toMatch(/technolog|human/i);
  expect(body.proposedText).not.toBe(selected);
  expect(body.proposedText.length).toBeGreaterThan(selected.length);
  expect(body.proposedText).not.toMatch(/A more academic version could state|Here is a revised version|The student should|In this context/i);
});

test("refresh API mock uses Project Title without inserting note text", async ({ request }) => {
  const text = "Topic: Social media balance\n\nResearch question: How can social media be healthier?";
  const response = await request.post("/api/refresh", {
    data: {
      topic: "Technology vs. Humanity.",
      projectTitle: "Technology vs. Humanity.",
      moduleNumber: 1,
      text,
      annotations: [],
      patches: [{
        id: "patch-title",
        moduleNumber: 1,
        anchorStart: 0,
        anchorEnd: "Topic: Social media balance".length,
        anchorQuote: "Topic: Social media balance",
        text: "根据我的 title 重写这个 topic",
        createdAt: "2026-05-10T00:00:00.000Z",
        status: "open",
        resolved: false
      }],
      sources: []
    }
  });

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.kind).toBe("revision");
  expect(body.sourceText).toBe(text);
  expect(body.proposedText).toContain("Topic: Technology, humanity");
  expect(body.proposedText).not.toContain("根据我的 title");
  expect(body.proposedText).not.toMatch(NOTE_LEAK_RE);
});
