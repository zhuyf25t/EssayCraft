import type { Project } from "@/types/essaycraft";
import { createInitialProject, migrateProject, normalizeProject } from "@/lib/project";

const STORAGE_KEY = "essaycraft:mvp:project";

export function loadProject(): Project {
  if (typeof window === "undefined") return createInitialProject();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialProject();
    return migrateProject(JSON.parse(raw));
  } catch {
    return createInitialProject();
  }
}

export function saveProject(project: Project) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeProject(project)));
}

export function resetProjectStorage() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
