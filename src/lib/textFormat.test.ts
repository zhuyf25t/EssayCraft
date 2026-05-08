import { describe, expect, it } from "vitest";
import { cleanGeneratedText, normalizeLineEndings } from "./textFormat";

describe("textFormat", () => {
  it("normalizes Windows line endings and preserves blank paragraphs", () => {
    expect(normalizeLineEndings("One\r\n\r\nTwo")).toBe("One\n\nTwo");
  });

  it("turns safe escaped newlines into real paragraph breaks", () => {
    expect(cleanGeneratedText("Paragraph one.\\n\\nParagraph two.")).toBe("Paragraph one.\n\nParagraph two.");
  });

  it("removes code fences and html from generated text", () => {
    expect(cleanGeneratedText("```html\n<p>One</p><p>Two</p>\n```")).toBe("One\n\nTwo");
  });

  it("splits an overlong Module 4 draft into readable paragraphs", () => {
    const text = cleanGeneratedText("One sentence. Two sentence. Three sentence. Four sentence. Five sentence. Six sentence.", 4);
    expect(text).toContain("\n\n");
  });
});
