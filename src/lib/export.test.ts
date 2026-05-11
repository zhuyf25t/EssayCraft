import { describe, expect, it } from "vitest";
import { buildCurrentModuleHtml, documentHtmlFragment } from "./export";
import { createInitialProject } from "./project";

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

  it("omits the workflow module line from final Module 6 HTML export", () => {
    const project = createInitialProject();
    const finalProject = {
      ...project,
      currentModule: 6 as const,
      modules: {
        ...project.modules,
        6: {
          ...project.modules[6],
          text: "Final essay text."
        }
      }
    };

    const html = buildCurrentModuleHtml(finalProject);
    expect(html).toContain("<h1>");
    expect(html).toContain("Final essay text.");
    expect(html).not.toContain("<strong>Module:</strong>");
    expect(html).not.toContain("Final Review / Conclusion / Export");
  });
});
