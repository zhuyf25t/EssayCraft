import { expect, test } from "@playwright/test";
import * as h from "./helpers";

test.beforeEach(h.setupPage);

test("assistant chat mode answers module-level Ask without a preview card", async ({ page }) => {
  await expect(page.getByTestId("assistant-chat-mode")).toBeVisible();
  await expect(page.getByTestId("assistant-chat-composer")).toBeVisible();
  const overflow = await page.getByTestId("assistant-chat-messages").evaluate((node) => getComputedStyle(node as HTMLElement).overflowY);
  expect(overflow).toBe("auto");

  await page.getByPlaceholder("Ask EssayCraft about this module...").fill("What do you think of this paragraph?");
  await page.getByRole("button", { name: "Send" }).click();

  const messages = page.getByTestId("assistant-chat-messages");
  await expect(messages).toContainText("What do you think of this paragraph?");
  await expect(messages).toContainText(/Module 1 .*has|Module 1 currently has/, { timeout: 20_000 });
  await expect(messages).toContainText(/research question|working thesis|thesis map/i);
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

test("assistant chat composer sends on Enter or Ctrl Enter and keeps Shift Enter newline", async ({ page }) => {
  const composer = page.getByPlaceholder("Ask EssayCraft about this module...");
  const messages = page.getByTestId("assistant-chat-messages");

  await composer.fill("Line one");
  await composer.press("Shift+Enter");
  await composer.pressSequentially("Line two");
  await expect(composer).toHaveValue("Line one\nLine two");
  await expect(messages).not.toContainText("Line two");

  await composer.press("Control+Enter");
  await expect(messages).toContainText("Line one");
  await expect(messages).toContainText("Line two");
  await expect(messages).toContainText(/Module 1|current module text/i, { timeout: 20_000 });

  await composer.fill("Plain Enter sends");
  await composer.press("Enter");
  await expect(messages).toContainText("Plain Enter sends");
});

test("assistant chat history can be cleared after confirmation", async ({ page }) => {
  const composer = page.getByPlaceholder("Ask EssayCraft about this module...");
  const messages = page.getByTestId("assistant-chat-messages");

  await composer.fill("Clear this chat later");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(messages).toContainText("Clear this chat later");
  await expect(messages).toContainText(/Module 1|current module text/i, { timeout: 20_000 });

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toMatch(/clear chat history/i);
    await dialog.accept();
  });

  await page.getByTestId("assistant-clear-chat").click();

  await expect(messages).not.toContainText("Clear this chat later");
  await expect(messages).toContainText("Ask about the current module");

  await page.reload();
  await expect(page.getByTestId("assistant-chat-messages")).toContainText("Ask about the current module");
});

test("assistant chat answers Chinese contextual questions instead of a template", async ({ page }) => {
  const composer = page.getByPlaceholder("Ask EssayCraft about this module...");
  const messages = page.getByTestId("assistant-chat-messages");

  await composer.fill("为什么这个 research question 有点弱？用中文。");
  await composer.press("Enter");

  await expect(messages).toContainText("为什么这个 research question 有点弱？", { timeout: 20_000 });
  await expect(messages).toContainText(/研究问题|方向清楚|责任|题目/);
  await expect(messages).not.toContainText("I can explain highlights");
  await expect(page.getByTestId("assistant-edit-preview")).toHaveCount(0);
});

test("clicking a sentence activates Edit selection mode", async ({ page }) => {
  await h.setEditorText(page, "First sentence has a clear claim. Second sentence adds detail.");
  const box = await h.editor(page).boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.click(box!.x + 80, box!.y + 55);

  await expect(page.getByTestId("assistant-edit-mode")).toBeVisible();
  await expect(page.getByTestId("assistant-edit-context")).toContainText("Active sentence");
  await expect(page.getByTestId("assistant-edit-context")).toContainText("First sentence has a clear claim.");
  await expect(page.locator(".active-sentence-backdrop")).toHaveCount(1);
});

test("Edit mode explains active highlight without confidence or relabel controls", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Inspect" })).toHaveCount(0);
  await h.selectEditorRange(page, 0, "Topic: Social media balance and youth wellbeing".length);
  const editContext = page.getByTestId("assistant-edit-context");
  await expect(editContext).toContainText("Background");
  await expect(editContext).toContainText("Topic: Social media balance");
  await expect(editContext).not.toContainText(/confidence|%/i);
  await expect(page.getByRole("combobox")).toHaveCount(0);
  await expect(page.getByTestId("highlight-key-background")).toHaveClass(/border-black/);

  await page.getByRole("button", { name: "Explain highlight" }).click();
  await expect(page.getByTestId("assistant-highlight-explanation")).toContainText("Highlight explanation", { timeout: 20_000 });
  await expect(page.getByTestId("assistant-highlight-explanation")).toContainText("Topic: Social media balance");
  await expect(page.getByTestId("assistant-highlight-explanation")).toContainText(/Background|highlight/i);
  await expect(page.getByTestId("assistant-highlight-explanation").getByRole("button", { name: "Accept" })).toHaveCount(0);
  await h.expectEditorText(page, /Topic: Social media balance/);

  await h.setEditorText(page, "Plain draft without refreshed annotations.");
  await h.editor(page).click();
  await expect(page.getByRole("button", { name: "Explain highlight" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Explain highlight" })).toHaveAttribute("title", /Click a highlighted sentence first/);
});

test("assistant uses selection context and dismisses preview without changing text", async ({ page }) => {
  const original = "Working thesis: Social media balance requires intentional habits and platform responsibility. This long explanation adds enough words to prove the side panel only shows the head and tail of a long active selection instead of taking over the entire assistant panel.";
  await h.setEditorText(page, original);
  await h.editor(page).click();
  await expect(page.getByTestId("assistant-edit-context")).toContainText("Active sentence");
  await h.selectEditorRange(page, 0, original.length);

  await expect(page.getByTestId("assistant-edit-context")).toContainText("Selected range");
  await expect(page.getByTestId("assistant-edit-context")).toContainText(`${original.length} chars`);
  await expect(page.getByTestId("assistant-edit-context")).toContainText("(compact)");
  await expect(page.getByRole("button", { name: "Rewrite", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Academic" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Analyze" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Translate" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Explain highlight" })).toBeVisible();
  const rewriteButtonStyle = await page.getByRole("button", { name: "Rewrite", exact: true }).evaluate((node) => {
    const style = getComputedStyle(node as HTMLElement);
    return { background: style.backgroundColor, color: style.color };
  });
  const academicButtonStyle = await page.getByRole("button", { name: "Academic" }).evaluate((node) => {
    const style = getComputedStyle(node as HTMLElement);
    return { background: style.backgroundColor, color: style.color };
  });
  const secondaryButtonStyles = await Promise.all(["Analyze", "Translate", "Explain highlight"].map((name) =>
    page.getByRole("button", { name }).evaluate((node) => {
      const style = getComputedStyle(node as HTMLElement);
      return { background: style.backgroundColor, color: style.color };
    })
  ));
  expect(academicButtonStyle).toEqual(rewriteButtonStyle);
  for (const style of secondaryButtonStyles) {
    expect(style.background).toBe("rgb(255, 255, 255)");
    expect(style.color).not.toBe(rewriteButtonStyle.color);
  }
  await expect(page.getByRole("button", { name: "Strengthen" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add note" })).toHaveCount(0);
  await page.getByRole("button", { name: "Rewrite", exact: true }).click();
  await expect(page.getByTestId("assistant-edit-preview")).toContainText("Revision preview", { timeout: 20_000 });
  await expect(page.getByTestId("assistant-edit-preview").getByRole("button", { name: "Accept" })).toBeVisible();
  await expect(page.getByTestId("assistant-edit-preview").getByRole("button", { name: "Copy" })).toBeVisible();
  await page.getByRole("button", { name: "Reject" }).click();
  await h.expectEditorText(page, original);
});

test("selection containing notes shows clean text and sends notes as instructions", async ({ page }) => {
  type CapturedAssistPayload = {
    selectedText?: string;
    selectedPatches?: Array<{ text: string }>;
  };
  const original = "First claim needs support. Second sentence stays clean.";
  const noteText = "Use this note as an instruction only.";
  const selected = "First claim needs support. Second sentence";
  let capturedPayload: CapturedAssistPayload | undefined;

  await h.setEditorText(page, original);
  await h.selectEditorRange(page, 0, "First claim".length);
  await page.keyboard.press("Control+Enter");
  await h.inlineNoteInput(page).fill(noteText);
  await h.inlineNoteInput(page).press("Control+Enter");

  await h.selectEditorRange(page, 0, selected.length);
  const context = page.getByTestId("assistant-edit-context");
  await expect(context).toContainText("Selected range");
  await expect(context).toContainText("1 note");
  await expect(context).toContainText(selected);
  await expect(context).not.toContainText(noteText);

  await page.route("**/api/assist", async (route) => {
    capturedPayload = JSON.parse(route.request().postData() ?? "{}") as CapturedAssistPayload;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        kind: "inspect",
        title: "Analysis",
        actionType: "analyze-selection",
        reply: "Selection is clean.",
        annotations: [],
        warnings: [],
        providerMode: "mock"
      })
    });
  });

  await page.getByRole("button", { name: "Analyze" }).click();
  await expect(page.getByTestId("assistant-analysis-result")).toContainText("Selection is clean.");
  expect(capturedPayload?.selectedText).toBe(selected);
  expect(capturedPayload?.selectedText).not.toContain(noteText);
  expect(capturedPayload?.selectedPatches).toHaveLength(1);
  expect(capturedPayload?.selectedPatches?.[0].text).toBe(noteText);
});

test("accepted rewrite resolves notes inside the selected range", async ({ page }) => {
  const original = "Research question: How can students use AI responsibly?";
  await page.getByLabel("Project Title").fill("Technology vs. Humanity.");
  await h.setEditorText(page, original);
  await h.selectEditorRange(page, 0, original.length);
  await page.keyboard.press("Control+Enter");
  await h.inlineNoteInput(page).fill("可以把问题写得更长一点");
  await page.keyboard.press("Enter");

  await h.selectEditorRange(page, 0, original.length);
  await expect(page.getByTestId("assistant-edit-context")).toContainText("1 note included");
  await page.getByPlaceholder("Tell EssayCraft what you want to change").fill("结合 project title");
  await page.getByRole("button", { name: "Rewrite", exact: true }).click();
  await expect(page.getByTestId("assistant-edit-preview")).toContainText("Revision preview", { timeout: 20_000 });
  await expect(page.getByTestId("assistant-edit-preview")).not.toContainText("可以把问题写得更长一点");
  const proposed = await page.getByTestId("assistant-edit-preview").locator("p").nth(1).innerText();
  expect(proposed.length).toBeGreaterThan(original.length);
  expect(proposed).toMatch(/technolog|human/i);

  await page.getByRole("button", { name: "Accept" }).click();
  await expect.poll(async () => h.canonicalModuleText(page)).not.toBe(original);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
  expect(state.modules["1"].text).not.toContain("可以把问题写得更长一点");
  expect(state.modules["1"].patches[0].resolved).toBe(true);
});

test("Analyze uses instruction language and is read-only", async ({ page }) => {
  const original = "Technology has always changed the way human beings live.";
  await h.setEditorText(page, original);
  await h.selectEditorRange(page, 0, original.length);
  await page.getByPlaceholder("Tell EssayCraft what you want to change").fill("你评价一下这句话。用中文。");
  await page.getByRole("button", { name: "Analyze" }).click();

  const analysis = page.getByTestId("assistant-analysis-result");
  await expect(analysis).toContainText("Analysis", { timeout: 20_000 });
  await expect(analysis).toContainText(/这句话|建议/);
  await expect(analysis.getByRole("button", { name: "Accept" })).toHaveCount(0);
  await expect(analysis.getByRole("button", { name: "Copy" })).toBeVisible();
  await h.expectEditorText(page, original);
});

test("rewrite follows English and Chinese length instructions without meta text", async ({ page }) => {
  const original = "Research question: How can students use AI responsibly?";
  await page.getByLabel("Project Title").fill("Technology vs. Humanity.");
  await h.setEditorText(page, original);
  await h.selectEditorRange(page, 0, original.length);

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
  expect(await h.editorText(page)).not.toBe(original);
  await expect.poll(async () => (await h.editorText(page)).length).toBeGreaterThan(original.length);
});

test("selected text translation is read-only in Edit mode", async ({ page }) => {
  const original = "Social media balance requires intentional habits.";
  await h.setEditorText(page, original);
  await h.selectEditorRange(page, 0, "Social media balance".length);

  await page.getByRole("button", { name: "Translate" }).click();
  await expect(page.getByTestId("assistant-edit-preview")).toContainText("Translation preview", { timeout: 20_000 });
  await expect(page.getByTestId("assistant-edit-preview")).toContainText(/[\u4e00-\u9fff]/);
  await expect(page.getByTestId("assistant-edit-preview")).not.toContainText(/DeepSeek|debug|AI returned|no API key/i);
  await expect(page.getByTestId("assistant-edit-preview").getByTestId("provider-mode-badge")).toContainText(/deepseek|mock|unavailable/i);
  await expect(page.getByTestId("assistant-edit-preview").getByRole("button", { name: "Accept" })).toHaveCount(0);
  await expect(page.getByTestId("assistant-edit-preview").getByRole("button", { name: "Copy" })).toBeVisible();
  await expect(page.getByTestId("assistant-edit-preview")).not.toContainText("requires intentional habits");
  await h.expectEditorText(page, original);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("essaycraft:mvp:project") ?? "{}"));
  expect(state.modules["1"].snapshots.length).toBe(0);
  await page.getByRole("button", { name: "Dismiss" }).click();
  await h.expectEditorText(page, original);
});
