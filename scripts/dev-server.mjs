#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const distDir = process.env.NEXT_DIST_DIR?.trim() || ".next-dev";
const nextDir = path.resolve(root, distDir);
const lockFile = path.join(nextDir, "essaycraft-dev.lock.json");
const allowMultiDev = process.env.ESSAYCRAFT_ALLOW_MULTI_DEV === "1";
const cleanNext = process.env.ESSAYCRAFT_CLEAN_NEXT !== "0";
const childEnv = {
  ...process.env,
  NEXT_DIST_DIR: distDir
};

const existing = readLock();
if (existing && existing.pid !== process.pid && isProcessAlive(existing.pid) && !allowMultiDev) {
  console.error(
    [
      "EssayCraft dev server is already running for this workspace.",
      `Existing PID: ${existing.pid}`,
      `Dist dir: ${distDir}`,
      "Stop the existing npm run dev process first. Two Next dev servers can corrupt server chunks and cause MODULE_NOT_FOUND 500s.",
      "Set ESSAYCRAFT_ALLOW_MULTI_DEV=1 only if you intentionally use a separate build directory."
    ].join("\n")
  );
  process.exit(1);
}

if (cleanNext) {
  ensureSafeDistDir(nextDir);
  fs.rmSync(nextDir, { recursive: true, force: true });
}
fs.mkdirSync(nextDir, { recursive: true });
writeLock();

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextBin, "dev", ...process.argv.slice(2)], {
  cwd: root,
  env: childEnv,
  stdio: "inherit",
  shell: false
});

let exiting = false;

child.on("exit", (code, signal) => {
  cleanupLock();
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  cleanupLock();
  console.error(error);
  process.exit(1);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (exiting) return;
    exiting = true;
    if (!child.killed) child.kill(signal);
    cleanupLock();
  });
}

process.on("exit", cleanupLock);

function readLock() {
  try {
    return JSON.parse(fs.readFileSync(lockFile, "utf8"));
  } catch {
    return undefined;
  }
}

function writeLock() {
  fs.writeFileSync(lockFile, JSON.stringify({
    pid: process.pid,
    startedAt: new Date().toISOString(),
    cwd: root
  }, null, 2));
}

function cleanupLock() {
  const lock = readLock();
  if (!lock || lock.pid !== process.pid) return;
  try {
    fs.unlinkSync(lockFile);
  } catch {
    // Best effort cleanup only.
  }
}

function ensureSafeDistDir(target) {
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to remove dist dir outside repository: ${target}`);
  }
  if (!relative.startsWith(".next")) {
    throw new Error(`Refusing to remove unexpected dist dir: ${target}`);
  }
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
