import { describe, expect, it } from "vitest";
import { documentHtmlFragment } from "./export";

describe("essay export rendering", () => {
  it("renders only canonical essay text by default", () => {
    const html = documentHtmlFragment("Topic: Clean export", []);
    expect(html).toContain("Topic: Clean export");
    expect(html).not.toContain("Note:");
  });

  it("strips leaked editor note markers from normal HTML export", () => {
    const html = documentHtmlFragment("Topic: Clean export NOTE:patch-abc123 \u2063/NOTE\u2064", []);
    expect(html).toContain("Topic: Clean export");
    expect(html).not.toMatch(/NOTE:|\/NOTE|patch-abc123|\u2063|\u2064|\[object Object\]/);
  });
});
