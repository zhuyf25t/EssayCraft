import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const port = process.env.PLAYWRIGHT_PORT ?? "3210";
const distDir = process.env.PLAYWRIGHT_NEXT_DIST_DIR ?? `.next-playwright-${port}`;
const snapshot = snapshotGeneratedTypeFiles();
const playwrightArgs = ["playwright", "test", ...process.argv.slice(2)];
const command = process.platform === "win32" ? "cmd.exe" : "npx";
const args = process.platform === "win32"
  ? ["/d", "/s", "/c", `npx ${playwrightArgs.map(quoteForCmd).join(" ")}`]
  : playwrightArgs;

const child = spawn(command, args, {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PLAYWRIGHT_NEXT_DIST_DIR: distDir
  },
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  restoreGeneratedTypeFiles(snapshot);
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  restoreGeneratedTypeFiles(snapshot);
  console.error(error);
  process.exit(1);
});

function snapshotGeneratedTypeFiles() {
  return ["next-env.d.ts", "tsconfig.json"].map((file) => ({
    file,
    existed: existsSync(file),
    content: existsSync(file) ? readFileSync(file, "utf8") : ""
  }));
}

function restoreGeneratedTypeFiles(snapshotItems) {
  for (const item of snapshotItems) {
    if (!item.existed) continue;
    try {
      writeFileSync(item.file, item.content);
    } catch {
      // Best-effort cleanup so e2e cannot leave Next's distDir rewrites in git.
    }
  }
}

function quoteForCmd(value) {
  if (/^[A-Za-z0-9_./:=\\-]+$/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}
