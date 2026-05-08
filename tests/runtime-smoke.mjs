import { spawn, execFileSync } from "node:child_process";

const port = process.env.RUNTIME_SMOKE_PORT ?? "3225";
const url = `http://127.0.0.1:${port}`;
const timeoutMs = 60_000;
const child = process.platform === "win32"
  ? spawn("cmd.exe", ["/d", "/s", "/c", `npm run dev -- --port ${port}`], processOptions())
  : spawn("npm", ["run", "dev", "--", "--port", port], processOptions());

function processOptions() {
  return {
  cwd: process.cwd(),
  env: {
    ...process.env,
    ESSAYCRAFT_FORCE_MOCK_AI: "1"
  },
  stdio: ["ignore", "pipe", "pipe"]
  };
}

let output = "";
child.stdout.on("data", (chunk) => {
  output += chunk.toString();
});
child.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

try {
  const response = await waitForOk(url, timeoutMs);
  const body = await response.text();
  if (!body.includes("EssayCraft")) {
    throw new Error("Homepage returned 200 but did not include EssayCraft markup.");
  }
  const generateResponse = await fetch(`${url}/api/generate-next`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic: "Runtime smoke topic",
      sourceModuleNumber: 1,
      sourceTitle: "Topic & Question",
      sourceText: "Topic: Runtime smoke topic\n\nResearch question: Can the app generate Module 2 during smoke validation?",
      sourceAnnotations: [],
      sourcePatches: [],
      sourceSources: []
    })
  });
  if (generateResponse.status !== 200) {
    throw new Error(`/api/generate-next returned ${generateResponse.status}: ${await generateResponse.text()}`);
  }
  console.log(`Runtime smoke passed: ${url} returned ${response.status}.`);
} catch (error) {
  console.error(output);
  throw error;
} finally {
  stopProcessTree(child.pid);
}

async function waitForOk(targetUrl, timeout) {
  const started = Date.now();
  let lastError;

  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(targetUrl, { cache: "no-store" });
      if (response.status === 200) return response;
      lastError = new Error(`Expected 200, got ${response.status}.`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw lastError instanceof Error ? lastError : new Error(`Timed out waiting for ${targetUrl}.`);
}

function stopProcessTree(pid) {
  if (!pid) return;
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/pid", String(pid), "/t", "/f"], { stdio: "ignore" });
    } catch {
      // Process may already have exited.
    }
    return;
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // Process may already have exited.
  }
}
