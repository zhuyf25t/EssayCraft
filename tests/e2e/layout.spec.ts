import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import * as h from "./helpers";

test.beforeEach(h.setupPage);

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
  await h.setEditorText(page, longText);

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

  await h.editor(page).evaluate((node) => {
    node.scrollTop = 240;
    node.dispatchEvent(new Event("scroll"));
  });
  await expect.poll(async () => h.editor(page).evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
});

test("toolbar hierarchy stays visible without global page scroll", async ({ page }) => {
  const nextConfig = await readFile("next.config.ts", "utf8");
  expect(nextConfig).toContain("devIndicators: false");

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 720 }
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.getByTestId("action-toolbar")).toBeVisible();
    await expect(page.getByTestId("workflow-generate")).toBeVisible();
    await expect(page.getByTestId("bottom-action-bar")).toBeVisible();
    await expect(page.getByTestId("highlight-key")).toBeVisible();
    await expect(page.getByTestId("module-progress")).toBeVisible();
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
  for (const label of ["Background", "Thesis", "Evidence", "Analysis", "Counterargument", "Citation", "Conclusion", "Issue", "Plain / no highlight"]) {
    await expect(key).toContainText(label);
  }
  const swatches = await key.locator('span[style*="background-color"]').evaluateAll((nodes) =>
    nodes.map((node) => getComputedStyle(node as HTMLElement).backgroundColor)
  );
  expect(swatches.length).toBeGreaterThanOrEqual(9);
  expect(swatches.every((color) => color && color !== "rgba(0, 0, 0, 0)" && color !== "transparent")).toBe(true);
  await expect(page.getByText("Project title and Module 1 research question differ")).toHaveCount(0);
});

test("highlight rendering ignores stale and blank annotation bars", async ({ page }) => {
  await h.setEditorText(page, "Topic: Clean highlights\n\nWorking thesis: Highlight bars should only appear behind text.");
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
  await expect(page.getByTestId("ai-diagnostics")).toContainText(/Assist timeout|Provider configured/i);

  await rail.getByRole("tab", { name: /Assistant/i }).click();
  await expect(rail.getByRole("tabpanel", { name: "Assistant" })).toContainText("Chat");

  await expect(page.getByTestId("toolbar-more")).toHaveCount(0);
  await expect(page.getByTestId("last-action")).toHaveCount(0);

  await rail.getByRole("tab", { name: /Snapshots/i }).click();
  await rail.getByRole("tabpanel", { name: "Snapshots" }).getByRole("button", { name: "Save Snapshot" }).click();
  await expect(page.getByText("Manual snapshot")).toBeVisible();

  await h.openExportTab(page);
  for (const name of ["Copy Rich Text", "Download HTML", "Download full project JSON", "Import full project JSON", "Reference Translation", "Reset Demo"]) {
    await expect(page.getByRole("button", { name })).toBeVisible();
  }
});
