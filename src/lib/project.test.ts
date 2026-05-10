import { describe, expect, it } from "vitest";
import { addSnapshot, clearModule, createInitialProject, importProject, migrateProject, replaceModuleContent } from "./project";
import { moduleDisplayStatus, moduleStatus } from "./moduleStatus";

describe("project model", () => {
  it("imports and exports six independent modules", () => {
    const project = createInitialProject();
    const imported = importProject(JSON.parse(JSON.stringify(project)));
    expect(Object.keys(imported.modules)).toHaveLength(6);
    expect(imported.modules[1].text).toContain("Research question");
  });

  it("rejects invalid import objects", () => {
    expect(() => importProject({ nope: true })).toThrow(/schemaVersion/);
  });

  it("clear module snapshots and clears only one module", () => {
    const project = createInitialProject();
    const moduleOne = clearModule(project.modules[1]);
    expect(moduleOne.text).toBe("");
    expect(moduleOne.snapshots).toHaveLength(1);
    expect(project.modules[2].text).not.toBe("");
  });

  it("snapshot preserves paragraph text", () => {
    const project = createInitialProject();
    const doc = replaceModuleContent(project.modules[4], "A paragraph.\n\nAnother paragraph.", []);
    const snap = addSnapshot(doc, "test");
    expect(snap.snapshots[0].text).toBe("A paragraph.\n\nAnother paragraph.");
  });

  it("treats planning source needs differently from draft citation gaps", () => {
    const project = createInitialProject();
    const outline = replaceModuleContent(project.modules[3], "Evidence to use: [source needed: education report.]", []);
    const draft = replaceModuleContent(project.modules[4], "This factual claim needs support [citation needed].", []);
    expect(moduleStatus(outline)).toBe("in progress");
    expect(moduleStatus(draft)).toBe("has issues");
  });

  it("does not mark a module done just because it has a snapshot", () => {
    const project = createInitialProject();
    const doc = addSnapshot(project.modules[4], "Manual snapshot");
    expect(moduleStatus(doc)).toBe("empty");
  });

  it("shows previous clean draft modules as done while keeping active module current", () => {
    const project = createInitialProject();
    const moduleOne = replaceModuleContent(project.modules[1], "Topic: Test\n\nWorking thesis: A claim.", []);
    expect(moduleDisplayStatus(moduleOne, 1)).toBe("current");
    expect(moduleDisplayStatus(moduleOne, 4)).toBe("done");
    expect(moduleDisplayStatus(project.modules[5], 4)).toBe("empty");
  });

  it("migrates legacy fallback assistant history to unavailable", () => {
    const project = createInitialProject();
    const migrated = migrateProject({
      ...project,
      assistantHistory: [
        {
          id: "legacy",
          role: "assistant",
          text: "Old fallback message",
          createdAt: "2026-05-10T00:00:00.000Z",
          providerMode: "fallback"
        }
      ]
    });
    expect(migrated.assistantHistory[0].providerMode).toBe("unavailable");
  });
});
