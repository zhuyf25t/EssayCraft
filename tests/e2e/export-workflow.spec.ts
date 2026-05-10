import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import * as h from "./helpers";

test.beforeEach(h.setupPage);

test("Module 5 citation check and Module 6 final export workflow are clear", async ({ page }) => {
  await h.moduleButton(page, 4, "Drafting").click();
  await h.setEditorText(page, "This draft makes a factual research claim about attention and wellbeing [citation needed].\n\nThe conclusion returns to the thesis.");
  await h.generateButton(page, 4).click();
  await expect(page.getByText(/Module 5 of 6/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("tab", { name: /Sources/i })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("module5-citation-checklist")).toContainText("Referencing / Citation Check checklist");
  await expect(page.getByTestId("module5-citation-checklist")).toContainText("Any [citation needed] markers?");

  await h.generateButton(page, 5).click();
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
  await h.setEditorText(page, "Topic: Export test.\n\nWorking thesis: Export should preserve project metadata.");
  await h.selectEditorRange(page, 0, "Topic: Export test.".length);
  await page.keyboard.press("Control+Enter");
  await h.inlineNoteInput(page).fill("This patch should be exported.");
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
  expect(exported.modules["1"].text).not.toMatch(h.NOTE_LEAK_RE);
  expect(exported.modules["1"].text).not.toContain("This patch should be exported");
  expect(exported.modules["1"].text).not.toContain("[Note:");
  expect(exported.modules["1"].annotations.length).toBeGreaterThan(0);
  expect(exported.modules["1"].patches[0].text).toContain("This patch should be exported");
  expect(exported.modules["1"].snapshots.length).toBeGreaterThan(0);
  expect(exported.modules["1"].sources[0].title).toBe("Export source");
  expect(exported.assistantHistory.length).toBeGreaterThan(0);
  expect(JSON.stringify(exported)).not.toContain("DEEPSEEK_API_KEY");
});
