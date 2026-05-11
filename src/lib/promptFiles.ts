import fs from "node:fs";
import path from "node:path";

export function readPromptFile(relativePath: string) {
  const fullPath = path.join(process.cwd(), "prompts", relativePath);
  return fs.readFileSync(fullPath, "utf8").trim();
}

export function renderPrompt(template: string, values: Record<string, string | number>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}
