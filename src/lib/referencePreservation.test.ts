import { describe, expect, it } from "vitest";
import { extractStandaloneReferenceSection, preserveSourceReferenceSection } from "./referencePreservation";

describe("reference preservation", () => {
  it("extracts a standalone reference section from source text", () => {
    const source = `Draft paragraph with citation (Smith, 2024).

References
Smith, J. (2024). Human guidance in AI. Journal of AI Ethics.`;

    expect(extractStandaloneReferenceSection(source)).toBe("References\nSmith, J. (2024). Human guidance in AI. Journal of AI Ethics.");
  });

  it("appends supplied references to generated next-module text when missing", () => {
    const target = "Final essay paragraph.\n\nEditing checklist\n- Check citations.";
    const source = `Citation-checked draft.

Works Cited
Smith, J. (2024). Human guidance in AI. Journal of AI Ethics.`;

    const preserved = preserveSourceReferenceSection(target, source);
    expect(preserved).toContain("Works Cited");
    expect(preserved).toContain("Smith, J. (2024). Human guidance in AI.");
  });

  it("does not duplicate references already present in target text", () => {
    const target = `Final essay paragraph.

References
Smith, J. (2024). Human guidance in AI. Journal of AI Ethics.`;
    const source = `Source draft.

References
Smith, J. (2024). Human guidance in AI. Journal of AI Ethics.`;

    expect(preserveSourceReferenceSection(target, source)).toBe(target);
  });
});
