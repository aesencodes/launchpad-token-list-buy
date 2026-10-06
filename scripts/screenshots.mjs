/**
 * Dev-only screenshot harness.
 *
 * Drives headless Chrome over the DevTools Protocol (no extra npm deps — Node's
 * global `fetch` and `WebSocket` are enough), navigates the running app, records
 * console errors and writes PNGs into `demo/`.
 *
 * Usage:
 *   node scripts/screenshots.mjs [baseUrl] [outDir]
 *   node scripts/screenshots.mjs http://localhost:3000 demo
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE_URL = process.argv[2] ?? "http://localhost:3000";
const OUT_DIR = process.argv[3] ?? "demo";
const PORT = 9333;
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PROFILE = "/tmp/launchpad-screenshot-profile";

const SHOTS = [
  {
    file: "01-desktop-list.png",
    url: "/",
    width: 1440,
    height: 1000,
    waitMs: 14_000,
  },
  {
    file: "02-desktop-buy-form.png",
    url: "/?token=0x505181e3114a6d147839Cb809C84d4e83575a97C",
    width: 1440,
    height: 1100,
    waitMs: 16_000,
  },
  {
    file: "03-desktop-graduated-token.png",
    url: "/?token=0xD32266729F628f14c44962FF359aa5d1Cce3dDE0",
    width: 1440,
    height: 1100,
    waitMs: 14_000,
  },
  {
    file: "04-mobile-list.png",
    url: "/",
    width: 390,
    height: 844,
    waitMs: 14_000,
    deviceScaleFactor: 2,
    viewport: true,
  },
  {
    file: "05-mobile-buy-form.png",
    url: "/?token=0x505181e3114a6d147839Cb809C84d4e83575a97C",
    width: 390,
    height: 844,
    waitMs: 16_000,
    deviceScaleFactor: 2,
    viewport: true,
  },
  {
    file: "06-desktop-launch-token-form.png",
    url: "/",
    width: 1440,
    height: 1000,
    waitMs: 14_000,
    clickSelector: '[data-testid="launch-token-toggle"]',
  },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForDevTools() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      // Chrome is not up yet.
    }
    await sleep(250);
  }
  throw new Error("Chrome DevTools endpoint never became available");
}

function createClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const listeners = new Set();

  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
      return;
    }
    for (const listener of listeners) listener(message);
  });

  const ready = new Promise((resolve, reject) => {
    ws.addEventListener("open", () => resolve());
    ws.addEventListener("error", (error) => reject(error));
  });

  return {
    ready,
    send(method, params = {}) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    on(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close() {
      ws.close();
    },
  };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      `--user-data-dir=${PROFILE}`,
      `--remote-debugging-port=${PORT}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  const problems = [];
  try {
    const target = await waitForDevTools();
    const client = createClient(target.webSocketDebuggerUrl);
    await client.ready;

    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Log.enable");

    client.on((message) => {
      if (message.method === "Runtime.exceptionThrown") {
        problems.push(`[exception] ${message.params.exceptionDetails?.text ?? "unknown"}`);
      }
      if (message.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(message.params.type)) {
        const text = (message.params.args ?? [])
          .map((arg) => arg.value ?? arg.description ?? arg.type)
          .join(" ");
        problems.push(`[console.${message.params.type}] ${text}`);
      }
      if (message.method === "Log.entryAdded" && ["error", "warning"].includes(message.params.entry.level)) {
        problems.push(`[log.${message.params.entry.level}] ${message.params.entry.text}`);
      }
    });

    for (const shot of SHOTS) {
      await client.send("Emulation.setDeviceMetricsOverride", {
        width: shot.width,
        height: shot.height,
        deviceScaleFactor: shot.deviceScaleFactor ?? 1,
        mobile: shot.width < 500,
      });
      await client.send("Page.navigate", { url: `${BASE_URL}${shot.url}` });
      await sleep(shot.waitMs);

      if (shot.clickSelector) {
        const { result } = await client.send("Runtime.evaluate", {
          expression: `(() => {
            const el = document.querySelector(${JSON.stringify(shot.clickSelector)});
            if (!el) return false;
            el.click();
            return true;
          })()`,
          returnByValue: true,
        });
        if (!result.value) problems.push(`[screenshot] selector not found: ${shot.clickSelector}`);
        await sleep(1_500);
      }

      const { data } = await client.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: !shot.viewport,
      });
      const path = join(OUT_DIR, shot.file);
      writeFileSync(path, Buffer.from(data, "base64"));
      console.log(`wrote ${path}`);
    }

    client.close();
  } finally {
    chrome.kill("SIGKILL");
  }

  const unique = [...new Set(problems)];
  if (unique.length > 0) {
    console.log("\nBrowser console problems:");
    for (const problem of unique) console.log(`  ${problem}`);
  } else {
    console.log("\nNo console errors or warnings.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
