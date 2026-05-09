import type { ModuleDocument } from "@/types/essaycraft";

export type ModuleStatus = "empty" | "in progress" | "has issues" | "done";
export type ModuleDisplayStatus = ModuleStatus | "current";

export function moduleStatus(doc: ModuleDocument): ModuleStatus {
  const text = doc.text.trim();
  if (!text) return "empty";

  const planningModule = doc.moduleNumber <= 3;
  const hasIssues =
    doc.annotations.some((annotation) => annotation.label === "issue") ||
    /\[citation needed\]/i.test(text) ||
    (!planningModule && /\[source needed(?::[^\]]*)?\]/i.test(text));

  if (hasIssues) return "has issues";

  const generatedOrChecked =
    (doc.globalFeedback ?? []).some((message) => /\b(generated|checked|reviewed|final)\b/i.test(message));

  return generatedOrChecked ? "done" : "in progress";
}

export function moduleDisplayStatus(doc: ModuleDocument, currentModule: number): ModuleDisplayStatus {
  if (doc.moduleNumber === currentModule) return "current";
  const base = moduleStatus(doc);
  if (doc.moduleNumber < currentModule && base === "in progress") return "done";
  return base;
}

export function moduleStatusTone(status: ModuleDisplayStatus) {
  if (status === "empty") return "slate";
  if (status === "has issues") return "red";
  if (status === "done") return "emerald";
  return "blue";
}
