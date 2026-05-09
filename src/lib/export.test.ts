import { describe, expect, it } from "vitest";
import { documentHtmlFragment } from "./export";

describe("essay export rendering", () => {
  it("renders only canonical essay text by default", () => {
    const html = documentHtmlFragment("Topic: Clean export", []);
    expect(html).toContain("Topic: Clean export");
    expect(html).not.toContain("Note:");
  });
});
