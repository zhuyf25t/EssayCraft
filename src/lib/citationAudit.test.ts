import { describe, expect, it } from "vitest";
import { buildCitationAudit, inTextCitationPreview, referencePreview } from "./citationAudit";
import type { SourceCard } from "@/types/essaycraft";

const source: SourceCard = {
  id: "s1",
  title: "A real user-entered source",
  authors: ["Jane Smith"],
  year: "2024",
  sourceType: "scholarly",
  verified: false,
  createdAt: "2026-05-08T00:00:00.000Z"
};

describe("citationAudit", () => {
  it("detects citation-needed markers and citation previews", () => {
    const audit = buildCitationAudit("Research shows a pattern [citation needed].", [], [source]);
    expect(audit.citationNeededMarkers).toHaveLength(1);
    expect(inTextCitationPreview(source)).toBe("(Smith, 2024)");
  });

  it("builds reference previews only from source-card metadata", () => {
    expect(referencePreview(source)).toContain("Jane Smith");
    expect(referencePreview(source)).toContain("A real user-entered source");
  });
});
