import { spawn } from "node:child_process";

const port = process.env.PORT || "8787";
const origin = `http://127.0.0.1:${port}`;
const schedulerSecret = process.env.SCHEDULER_SECRET?.trim();

const worker = spawn("pnpm", [
  "exec", "wrangler", "dev", "--local",
  "--config", "wrangler.portfolio.jsonc",
  "--ip", "0.0.0.0", "--port", port,
  "--log-level", "warn", "--show-interactive-dev-session", "false",
], { stdio: "inherit", env: process.env });

let stopping = false;
let scheduler;

async function waitForWorker() {
  for (let attempt = 0; attempt < 60 && !stopping; attempt += 1) {
    try {
      const response = await fetch(`${origin}/api/health`);
      if (response.ok) return true;
    } catch {
      // Wrangler is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return false;
}

async function runScheduledWork() {
  if (!schedulerSecret || stopping) return;
  try {
    const response = await fetch(`${origin}/api/internal/scheduled`, {
      method: "POST",
      headers: { authorization: `Bearer ${schedulerSecret}` },
    });
    if (!response.ok) console.error(`TDS scheduler request failed with HTTP ${response.status}.`);
  } catch (error) {
    console.error("TDS scheduler request failed.", error instanceof Error ? error.message : error);
  }
}

if (await waitForWorker()) {
  if (schedulerSecret) {
    await runScheduledWork();
    scheduler = setInterval(runScheduledWork, 5 * 60 * 1_000);
  } else {
    console.warn("SCHEDULER_SECRET is not configured; background RAG indexing is paused.");
  }
} else {
  console.error("TDS Worker did not become healthy within 60 seconds.");
  worker.kill("SIGTERM");
}

function stop(signal) {
  if (stopping) return;
  stopping = true;
  if (scheduler) clearInterval(scheduler);
  worker.kill(signal);
}

process.on("SIGTERM", () => stop("SIGTERM"));
process.on("SIGINT", () => stop("SIGINT"));

worker.on("exit", (code) => {
  if (scheduler) clearInterval(scheduler);
  process.exit(stopping ? 0 : (code ?? 1));
});
