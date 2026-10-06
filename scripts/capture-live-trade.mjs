/**
 * Live-trade capture harness for issue #7 ("prove the live buy/sell path").
 *
 * WHAT THIS PROVES, WHEN RUN WITH A FUNDED KEY
 *
 *   It drives the real UI in headless Chrome through the whole transaction
 *   path — connect → (wrong-network banner) → switch/add chain → buy → the
 *   five states the brief requires → sell (approve then sell) — and signs
 *   every transaction locally with the supplied key. The hashes it prints are
 *   real, broadcast to chain 46630, and mineable on the explorer; the
 *   `tokensOut` / `quoteOut` it records are parsed from the `CurveBuy` /
 *   `CurveSell` events on the mined receipts, exactly like the app does.
 *
 *   Nothing about the wallet is mocked. The injected EIP-1193 provider owns a
 *   real account, forwards every read to the public RPC, and hands
 *   `eth_sendTransaction` to a local signer endpoint that holds the key for
 *   the lifetime of the process only.
 *
 * WHAT THIS DOES NOT PROVE
 *
 *   It is not a MetaMask run: the wallet is scripted, not an extension, so the
 *   "Confirm in wallet" prompt is the harness holding the request open rather
 *   than a human clicking approve. It proves the app's transaction path and
 *   the contracts accept it; a manual MetaMask pass is still the thing to do
 *   before the interview. The key never touches the repo or the page — it is
 *   read from the environment or a file outside the working tree and is never
 *   logged.
 *
 * USAGE
 *
 *   node scripts/capture-live-trade.mjs [baseUrl] [outDir] [flags]
 *
 *     baseUrl                 app origin (default http://localhost:3000)
 *     outDir                  screenshot directory (default demo)
 *
 *     --key <hex>             test-wallet private key (hex)
 *     --key-file <path>       file containing only the key
 *     --expect <address>      refuse to trade unless the key derives this
 *                             address (default: the #5 funded wallet)
 *     --allow-any-address     drop the --expect guard
 *     --symbol <SYMBOL>       sample token to buy and sell (default FRESH)
 *     --amount <eth>          ETH to spend on the buy (default 0.001)
 *     --sell-fraction <n>     fraction of the received tokens to sell (default 0.2)
 *     --wait-ms <ms>          per-state timeout (default 120000)
 *     --skip-sell             buy only
 *     --skip-grad             do not open the graduated token
 *     --headful               show Chrome instead of running headless
 *     --help
 *
 *   The key is resolved in this order: --key, LIVE_TRADE_KEY,
 *   --key-file, LIVE_TRADE_KEY_FILE, then `~/.launchpad-live.key`. Exporting
 *   MetaMask's *test-wallet* key to that file is the intended path; it is a
 *   testnet-only account and must never be committed.
 *
 *   For example:
 *     npm run build && npm run start &            # or npm run dev
 *     LIVE_TRADE_KEY_FILE=~/.launchpad-live.key \
 *       node scripts/capture-live-trade.mjs http://localhost:3000 demo
 *
 * Exit code is 0 only when every capture and check that ran passed.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  formatUnits,
  getAddress,
  http,
  parseEventLogs,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

/* The provided ABIs, as JSON. The app's generated `lib/abi/*.ts` cannot be imported here:
 * this repo documents Node 20.9+, which predates unflagged TypeScript type-stripping, and
 * the other scripts read the same JSON for the same reason (`verify-buy-quote.mjs`). */
const ABI_DIR = fileURLToPath(new URL("../technical-brief/abi/", import.meta.url));
const bondingCurveAbi = JSON.parse(readFileSync(join(ABI_DIR, "BondingCurve.json"), "utf8"));
const launcherTokenAbi = JSON.parse(readFileSync(join(ABI_DIR, "LauncherToken.json"), "utf8"));

/* ------------------------- chain configuration ---------------------------- */
/* Kept in sync with `lib/chain.ts` — these scripts are plain Node and cannot
 * resolve the app's `@/` path alias, exactly like `check-wallet.mjs`. */

const CHAIN = {
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://robinhood-sepolia-rpc.publicnode.com"] } },
  blockExplorers: {
    default: { name: "Robinhood Chain Explorer", url: "https://explorer.testnet.chain.robinhood.com" },
  },
  testnet: true,
};
const RPC_URL = CHAIN.rpcUrls.default.http[0];
const EXPLORER_URL = CHAIN.blockExplorers.default.url;

/** #5's funded wallet. The `--expect` default keeps a stray key from trading. */
const EXPECTED_ADDRESS = "0x79E7bCB512c170192E1E0a47c0Ccd812FE62C60F";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const CDP_PORT = 9337;
const CDP_CALL_TIMEOUT_MS = 30_000;

/* --------------------------------- args ----------------------------------- */

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  // The file header is the help text; strip the JSDoc furniture.
  const help = readFileSync(new URL(import.meta.url), "utf8")
    .split("*/")[0]
    .replace(/^\/\*\*?/, "")
    .split("\n")
    .map((line) => line.replace(/^ ?\* ?/, ""))
    .join("\n")
    .trim();
  console.log(help);
  process.exit(0);
}

const positional = argv.filter((arg) => !arg.startsWith("--"));
const flag = (name, fallback) => {
  const index = argv.findIndex((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`));
  if (index === -1) return fallback;
  const inline = argv[index].split("=")[1];
  if (inline !== undefined) return inline;
  const next = argv[index + 1];
  return next === undefined || next.startsWith("--") ? fallback : next;
};
const has = (name) => argv.some((arg) => arg === `--${name}`);

const BASE_URL = (positional[0] ?? "http://localhost:3000").replace(/\/$/, "");
const OUT_DIR = positional[1] ?? "demo";
const EXPECT = has("allow-any-address") ? undefined : flag("expect", EXPECTED_ADDRESS);
const SYMBOL = flag("symbol", "FRESH").toUpperCase();
/* Issue #7 names the safe targets: FRESH, EARLY or TAXED. HALF can graduate mid-session
 * and GRAD is phase 2 (its buy button must stay disabled), so refuse them as buy targets
 * rather than letting a flag quietly produce the wrong evidence. GRAD is still opened on
 * purpose by the disabled-state capture, which is a read-only check. */
if (["HALF", "GRAD"].includes(SYMBOL)) {
  console.error(`--symbol ${SYMBOL} is not a valid buy target for issue #7: use FRESH, EARLY or TAXED.`);
  process.exit(2);
}
const BUY_AMOUNT_ETH = flag("amount", "0.001");
const SELL_FRACTION = Number(flag("sell-fraction", "0.2"));
const SKIP_SELL = has("skip-sell");
const SKIP_GRAD = has("skip-grad");
const HEADFUL = has("headful");
/** How long to wait for a UI state transition. Lower it for a fast smoke run. */
const STATE_WAIT_MS = Number(flag("wait-ms", "120000"));

function resolveKey() {
  if (flag("key")) return flag("key");
  if (process.env.LIVE_TRADE_KEY) return process.env.LIVE_TRADE_KEY;
  const file = flag("key-file") ?? process.env.LIVE_TRADE_KEY_FILE ?? join(homedir(), ".launchpad-live.key");
  try {
    const content = readFileSync(file, "utf8").trim();
    if (content) return content;
  } catch {
    // No file at that path; fall through to the usage error below.
  }
  return undefined;
}

/* -------------------------------- results --------------------------------- */

let passes = 0;
let failures = 0;
const problems = [];
const shots = [];
const record = { address: undefined, chainId: CHAIN.id, screenshots: shots, trades: [] };

function check(label, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (ok) passes += 1;
  else failures += 1;
  return ok;
}

/* ------------------------------- formatting ------------------------------- */

const eth = (wei) => `${formatUnits(wei, 18)} ETH`;

/* --------------------------------- signer --------------------------------- */
/*
 * A local HTTP endpoint the injected provider calls for `eth_sendTransaction`.
 * It is the only place the private key exists. It binds 127.0.0.1 only and
 * deliberately has no auth: the page is the caller, the process is short-lived,
 * the key comes from the environment, and nothing here is exposed beyond the
 * loopback interface. `holdNext` is how the harness keeps the request outstanding
 * long enough to photograph the app's "Confirm in wallet" state; `setMode` is how
 * it produces the rejected and reverted captures without touching the app.
 */
async function createSigner({ account, mode }) {
  const walletClient = createWalletClient({ account, chain: CHAIN, transport: http(RPC_URL) });

  let currentMode = mode ?? "accept";
  let holds = 0;
  let waiters = [];
  const calls = [];

  const passGate = async () => {
    if (holds <= 0) return;
    holds -= 1;
    await new Promise((resolve) => waiters.push(resolve));
  };

  const server = createServer((req, res) => {
    const respond = (status, payload) => {
      const body = JSON.stringify(payload);
      res.writeHead(status, {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
      });
      res.end(body);
    };

    if (req.method === "OPTIONS") {
      res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-headers": "*" });
      res.end();
      return;
    }
    if (req.method !== "POST") {
      respond(404, { error: { code: -32601, message: "POST /send only" } });
      return;
    }

    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", async () => {
      try {
        const { tx } = JSON.parse(body);
        await passGate();
        calls.push({ mode: currentMode, to: tx?.to, value: tx?.value ?? "0x0" });

        if (currentMode === "reject") {
          return respond(200, {
            error: { code: 4001, message: "User rejected the request." },
          });
        }

        const request = { account, to: tx?.to, data: tx?.data };
        if (tx?.value !== undefined) request.value = BigInt(tx.value);
        if (tx?.gas !== undefined) request.gas = BigInt(tx.gas);
        if (tx?.nonce !== undefined) request.nonce = Number(BigInt(tx.nonce));
        if (tx?.maxFeePerGas !== undefined) request.maxFeePerGas = BigInt(tx.maxFeePerGas);
        if (tx?.maxPriorityFeePerGas) request.maxPriorityFeePerGas = BigInt(tx.maxPriorityFeePerGas);
        if (tx?.gasPrice !== undefined) request.gasPrice = BigInt(tx.gasPrice);

        if (currentMode === "revert") {
          /* A payable call with `msg.value == 0` trips the curve's own
           * `NativeValueMismatch` guard, so the transaction is mined and the
           * receipt really reverts. That is the failure capture the brief asks
           * for: a real hash, a real reverted receipt, a translated message.
           * The gas limit is forced so viem broadcasts instead of re-estimating
           * (an estimate with value 0 would fail before broadcasting). */
          if (tx?.value === undefined) {
            return respond(200, {
              error: { code: -32000, message: "revert mode needs a payable call (no value in the request)" },
            });
          }
          request.value = 0n;
          request.gas = request.gas ?? 600_000n;
        }

        const hash = await walletClient.sendTransaction(request);
        respond(200, { result: hash });
      } catch (error) {
        respond(200, {
          error: {
            code: typeof error?.code === "number" ? error.code : -32603,
            message: error?.shortMessage ?? error?.message ?? String(error),
            data: error?.data,
          },
        });
      }
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  return {
    url: `http://127.0.0.1:${port}/send`,
    /** Hold the next `n` sends until `release()` is called. */
    holdNext: (n = 1) => {
      holds += n;
    },
    release: () => {
      const pending = waiters;
      waiters = [];
      for (const resolve of pending) resolve();
    },
    setMode: (next) => {
      currentMode = next;
    },
    calls,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

/* --------------------------- injected provider ---------------------------- */
/*
 * Installed into the page before the app runs. It owns the account, reports
 * the "wallet" chain (chain 1 until the app switches it, so the wrong-network
 * banner is reachable), forwards every read to the real RPC, and routes
 * `eth_sendTransaction` to the signer. The chain survives reloads through
 * localStorage so a deep link does not re-trigger the banner.
 */
function installLiveWallet(config) {
  const { address, signerUrl, rpcUrl, initialChainId } = config;
  const listeners = new Map();
  const log = [];
  let storedChain = initialChainId;
  try {
    storedChain = Number(localStorage.getItem("__launchpadLiveChainId")) || initialChainId;
  } catch {
    // Private mode; the first load just re-triggers the banner.
  }
  const state = { chainId: storedChain, added: false, hash: null, error: null };

  const emit = (event, payload) => {
    for (const listener of listeners.get(event) ?? []) listener(payload);
  };
  const hexChainId = (id) => `0x${id.toString(16)}`;

  let idSeq = 0;
  const forward = async (method, params) => {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++idSeq, method, params: params ?? [] }),
    });
    const json = await res.json();
    if (json.error) {
      throw Object.assign(new Error(json.error.message ?? "RPC error"), {
        code: json.error.code,
        data: json.error.data,
      });
    }
    return json.result;
  };

  const provider = {
    isMetaMask: true,
    isConnected: () => true,
    request: async ({ method, params }) => {
      switch (method) {
        case "eth_requestAccounts":
        case "eth_accounts":
          return [address];
        case "eth_chainId":
          return hexChainId(state.chainId);
        case "net_version":
          return String(state.chainId);
        case "wallet_requestPermissions":
          throw Object.assign(new Error("Method not supported"), { code: -32601 });
        case "wallet_switchEthereumChain": {
          log.push({ method, params });
          const requested = params[0].chainId;
          if (requested.toLowerCase() === hexChainId(state.chainId)) return null;
          if (state.added) {
            state.chainId = Number.parseInt(requested, 16);
            setTimeout(() => emit("chainChanged", hexChainId(state.chainId)), 0);
            return null;
          }
          throw Object.assign(
            new Error(`Unrecognized chain ID "${requested}". Try adding the chain using wallet_addEthereumChain first.`),
            { code: 4902 },
          );
        }
        case "wallet_addEthereumChain": {
          log.push({ method, params });
          state.added = true;
          state.chainId = Number.parseInt(params[0].chainId, 16);
          try {
            localStorage.setItem("__launchpadLiveChainId", String(state.chainId));
          } catch {
            // Private mode; the next navigation just re-switches.
          }
          setTimeout(() => emit("chainChanged", hexChainId(state.chainId)), 0);
          return null;
        }
        case "eth_sendTransaction": {
          log.push({ method, params });
          const res = await fetch(signerUrl, {
            method: "POST",
            headers: { "content-type": "text/plain" },
            body: JSON.stringify({ tx: params[0] }),
          });
          const json = await res.json();
          if (json.error) {
            state.error = json.error.message;
            throw Object.assign(new Error(json.error.message), {
              code: json.error.code,
              data: json.error.data,
            });
          }
          state.hash = json.result;
          return json.result;
        }
        default:
          return forward(method, params);
      }
    },
    on(event, listener) {
      const set = listeners.get(event) ?? new Set();
      set.add(listener);
      listeners.set(event, set);
      return provider;
    },
    removeListener(event, listener) {
      listeners.get(event)?.delete(listener);
      return provider;
    },
    once(event, listener) {
      const wrapped = (payload) => {
        provider.removeListener(event, wrapped);
        listener(payload);
      };
      return provider.on(event, wrapped);
    },
  };

  provider.off = provider.removeListener;
  window.ethereum = provider;
  window.__liveTradeWallet = { log, state, readStoredChain: () => localStorage.getItem("__launchpadLiveChainId") };
}

/* --------------------------------- CDP ------------------------------------ */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connectCdp(profileDir) {
  const chromeArgs = [
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${profileDir}`,
    `--remote-debugging-port=${CDP_PORT}`,
    "about:blank",
  ];
  if (!HEADFUL) chromeArgs.unshift("--headless=new");
  const chrome = spawn(CHROME, chromeArgs, { stdio: "ignore" });

  let target;
  for (let attempt = 0; attempt < 80 && !target; attempt++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
      target = (await res.json()).find((entry) => entry.type === "page" && entry.webSocketDebuggerUrl);
    } catch {
      // Chrome is not up yet.
    }
    if (!target) await sleep(250);
  }
  if (!target) throw new Error("Chrome DevTools endpoint never became available");

  const ws = new WebSocket(target.webSocketDebuggerUrl);
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
  ws.addEventListener("close", () => {
    for (const { reject } of pending.values()) reject(new Error("the Chrome DevTools connection closed"));
    pending.clear();
  });
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`the browser did not answer ${method} within ${CDP_CALL_TIMEOUT_MS / 1000}s`));
      }, CDP_CALL_TIMEOUT_MS);
      pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      ws.send(JSON.stringify({ id, method, params }));
    });

  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? "page evaluation failed");
    return result.value;
  };

  /* Bounded polling inside the page keeps the round-trips low and survives a
   * navigation that destroys the execution context. */
  const waitFor = async (label, expression, timeout = STATE_WAIT_MS) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      try {
        if (await evaluate(expression)) return true;
      } catch (error) {
        if (!/context|destroyed|closed/i.test(String(error))) throw error;
      }
      await sleep(250);
    }
    throw new Error(`timed out waiting for ${label}`);
  };

  return { chrome, ws, send, evaluate, waitFor, on: (listener) => listeners.add(listener) };
}

/* ------------------------------ page helpers ------------------------------ */

const SEL = {
  connect: '[data-testid="connect-wallet"]',
  walletBar: '[data-testid="wallet-bar"]',
  balance: '[data-testid="wallet-balance"]',
  banner: '[data-testid="network-banner"]',
  switchNetwork: '[data-testid="switch-network"]',
  tokenCard: '[data-testid="token-card"]',
  tradePanel: '[data-testid="trade-panel"]',
  buyForm: '[data-testid="buy-form"]',
  buySubmit: '[data-testid="buy-submit"]',
  buyBlockers: '[data-testid="buy-blockers"]',
  buyAmount: "#buy-amount",
  sellForm: '[data-testid="sell-form"]',
  sellSubmit: '[data-testid="sell-submit"]',
  sellAmount: "#sell-amount",
};

const textOf = (selector) =>
  `((document.querySelector(${JSON.stringify(selector)})?.textContent ?? '').replace(/\\s+/g, ' ').trim())`;
const attrOf = (selector, attribute) =>
  `(document.querySelector(${JSON.stringify(selector)})?.getAttribute(${JSON.stringify(attribute)}) ?? null)`;
const present = (selector) => `Boolean(document.querySelector(${JSON.stringify(selector)}))`;
const click = (selector) =>
  `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return false;
    element.click();
    return true;
  })()`;
/* React owns the input's value; set it through the native setter so the
 * `input` event the app listens for actually fires. */
const setInput = (selector, value) =>
  `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(element, ${JSON.stringify(value)});
    element.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  })()`;
const disabled = (selector) => `Boolean(document.querySelector(${JSON.stringify(selector)})?.disabled)`;

/* ------------------------------- the flow --------------------------------- */

async function main() {
  console.log("live-trade capture harness (issue #7)");
  console.log(`app      ${BASE_URL}`);
  console.log(`outDir   ${OUT_DIR}`);
  console.log(`rpc      ${RPC_URL}`);
  console.log(`chain    ${CHAIN.id}`);
  console.log("");

  const key = resolveKey();
  if (!key) {
    console.error("No signing key found. The live capture needs a funded test wallet.");
    console.error("");
    console.error("Export the key MetaMask holds for the funded test account (never a main wallet) and");
    console.error("put it somewhere outside the repo, then re-run:");
    console.error("");
    console.error("  printf '%s' '0x<test-wallet-private-key>' > ~/.launchpad-live.key");
    console.error("  chmod 600 ~/.launchpad-live.key");
    console.error("  node scripts/capture-live-trade.mjs http://localhost:3000 demo");
    console.error("");
    console.error("Alternatively pass --key <hex> or set LIVE_TRADE_KEY in the environment. The key is");
    console.error("never written to the repo, never printed, and never sent to the page.");
    process.exit(2);
  }

  const account = privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`);
  const address = getAddress(account.address);
  record.address = address;

  console.log(`wallet   ${address}`);
  console.log(`explorer ${EXPLORER_URL}/address/${address}`);
  if (EXPECT && address !== getAddress(EXPECT)) {
    console.error("");
    console.error(`The key derives ${address}, not the expected ${getAddress(EXPECT)}.`);
    console.error("Refusing to trade: pass --expect <address> for the intended wallet, or");
    console.error("--allow-any-address if you really mean this one.");
    process.exit(2);
  }
  if (!EXPECT) console.log("         --allow-any-address is set: the --expect guard is off");
  if (Number.isNaN(SELL_FRACTION) || SELL_FRACTION <= 0 || SELL_FRACTION > 1) {
    console.error(`--sell-fraction ${flag("sell-fraction")} must be in (0, 1].`);
    process.exit(2);
  }

  const publicClient = createPublicClient({ chain: CHAIN, transport: http(RPC_URL) });

  /* App reachability before anything expensive. */
  let appUp = false;
  try {
    const res = await fetch(BASE_URL, { headers: { "user-agent": "launchpad-capture-live-trade/1.0" } });
    appUp = res.ok;
  } catch {
    appUp = false;
  }
  if (!appUp) {
    console.error(`\n${BASE_URL} did not answer. Start the app first (npm run dev, or npm run build && npm run start).`);
    process.exit(1);
  }

  const [reportedChainId, balanceBefore, nonce] = await Promise.all([
    publicClient.getChainId(),
    publicClient.getBalance({ address }),
    publicClient.getTransactionCount({ address }),
  ]);
  check(`the RPC answers on chain ${CHAIN.id}`, reportedChainId === CHAIN.id, `eth_chainId ${reportedChainId}`);
  check(
    "the wallet holds enough to trade (amount + gas)",
    balanceBefore > 2_000_000_000_000_000n,
    `${eth(balanceBefore)} at nonce ${nonce}`,
  );
  record.balanceBefore = balanceBefore.toString();

  const signer = await createSigner({ account });
  const profileDir = mkdtempSync(join(tmpdir(), "launchpad-live-trade-"));
  mkdirSync(OUT_DIR, { recursive: true });

  const cdp = await connectCdp(profileDir);
  const { ws, send, evaluate, waitFor, on } = cdp;

  try {
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Log.enable");
    on((message) => {
      if (message.method === "Runtime.exceptionThrown") {
        problems.push(`[exception] ${message.params.exceptionDetails?.text ?? "unknown"}`);
      }
      if (message.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(message.params.type)) {
        const text = (message.params.args ?? []).map((arg) => arg.value ?? arg.description ?? arg.type).join(" ");
        problems.push(`[console.${message.params.type}] ${text}`);
      }
      if (message.method === "Log.entryAdded" && ["error", "warning"].includes(message.params.entry.level)) {
        problems.push(`[log.${message.params.entry.level}] ${message.params.entry.text}`);
      }
    });

    await send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await send("Page.addScriptToEvaluateOnNewDocument", {
      source: `(${installLiveWallet.toString()})(${JSON.stringify({
        address,
        signerUrl: signer.url,
        rpcUrl: RPC_URL,
        initialChainId: 1,
      })})`,
    });

    const shoot = async (file) => {
      const path = join(OUT_DIR, file);
      const { data } = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
      writeFileSync(path, Buffer.from(data, "base64"));
      shots.push(file);
      console.log(`      → ${path}`);
    };

    /* Navigate and leave the app connected on chain 46630. */
    const open = async (path) => {
      await send("Page.navigate", { url: `${BASE_URL}${path}` });
      await waitFor("the connect button or the wallet bar", `${present(SEL.connect)} || ${present(SEL.walletBar)}`);
      if (await evaluate(present(SEL.connect))) {
        await evaluate(click(SEL.connect));
        await waitFor("the wallet to connect", present(SEL.walletBar));
      }
    };
    const settleChain = async () => {
      if (!(await evaluate(present(SEL.banner)))) return false;
      await evaluate(click(SEL.switchNetwork));
      await evaluate(`(async () => {
        const deadline = Date.now() + 30000;
        while (Date.now() < deadline) {
          if (!document.querySelector(${JSON.stringify(SEL.banner)})) return true;
          await new Promise((r) => setTimeout(r, 250));
        }
        return false;
      })()`);
      return true;
    };

    /* ---------------------------- connected wallet ---------------------------- */
    await open("/");
    await waitFor("the list to load", present(SEL.tokenCard));

    const bannerShown = await evaluate(present(SEL.banner));
    check("the app warns about the wrong network (wallet starts on chain 1)", bannerShown);

    await settleChain();
    await waitFor("the balance to render", `${textOf(SEL.balance)}.includes(' ETH')`);
    const barText = await evaluate(textOf(SEL.walletBar));
    const balanceText = await evaluate(textOf(SEL.balance));
    const shortened = `${address.slice(0, 6)}…${address.slice(-4)}`;
    check("the wallet bar shows the connected address", barText.includes(shortened), barText);
    check("the wallet bar shows the live balance", /\d.* ETH/.test(balanceText), balanceText);
    await shoot("07-desktop-connected-wallet.png");
    record.balanceTextBefore = balanceText;

    /* ------------------------- the graduated token -------------------------- */
    if (!SKIP_GRAD) {
      const gradAddress = await findTokenBySymbol(evaluate, waitFor, "GRAD");
      if (gradAddress) {
        await open(`/?token=${gradAddress}`);
        await waitFor("the trade panel", present(SEL.tradePanel));
        await settleChain();
        const isDisabled = await evaluate(disabled(SEL.buySubmit));
        const blockers = await evaluate(textOf(SEL.buyBlockers));
        check("the graduated token keeps the buy button disabled", isDisabled, blockers || "no blocker text");
        await shoot("09-desktop-grad-buy-disabled.png");
      } else {
        check("a GRAD sample token is listed", false, "no card matched GRAD; is the app listing the samples?");
      }
    }

    /* --------------------------- the wrong-network banner ------------------- */
    /* Re-derived after the deep links so the screenshot lands on the list. The
     * stored chain is cleared first so the fresh document really starts on 1. */
    if (bannerShown) {
      await evaluate("localStorage.removeItem('__launchpadLiveChainId')");
      await open("/");
      await waitFor("the wrong-network banner", present(SEL.banner));
      await shoot("08-desktop-wrong-network-banner.png");
      await settleChain();
    }

    /* -------------------------------- the buy ------------------------------- */
    const buyAddress = await findTokenBySymbol(evaluate, waitFor, SYMBOL);
    if (!buyAddress) {
      check(`a ${SYMBOL} sample token is listed`, false, "no card matched; pass --symbol <SYMBOL>");
      return finish(ws, signer, cdp, address, profileDir);
    }
    console.log(`\nbuying ${SYMBOL} at ${buyAddress}`);
    await open(`/?token=${buyAddress}`);
    await waitFor("the buy form", present(SEL.buyForm));
    await settleChain();

    const cardBefore = await evaluate(textOf(`[data-token="${buyAddress}"]`));
    const summaryBefore = await evaluate(textOf('[data-testid="trade-summary"]'));
    const tokenBalanceBefore = await evaluate(attrOf('[data-testid="buy-estimate"]', "data-raw-token-balance"));

    await evaluate(setInput(SEL.buyAmount, BUY_AMOUNT_ETH));
    await waitFor("the buy estimate", `${attrOf('[data-testid="buy-estimate"]', "data-raw-tokens-out")} !== ''`);
    const estimate = await evaluate(attrOf('[data-testid="buy-estimate"]', "data-raw-tokens-out"));
    const buyDisabledBefore = await evaluate(disabled(SEL.buySubmit));
    check("the buy form produces an estimate", Boolean(estimate), `tokensOut=${estimate}`);
    check("the buy button is enabled once the form is ready", !buyDisabledBefore);
    if (buyDisabledBefore) {
      /* Nothing can be signed from here, so stop with the app's own reason
       * instead of burning the state wait. The usual cause is an unfunded
       * wallet, which is the app behaving correctly. */
      check("the buy could be attempted", false, await evaluate(textOf(SEL.buyBlockers)));
      return finish(ws, signer, cdp, address, profileDir);
    }

    signer.setMode("accept");
    signer.holdNext(1);
    await evaluate(click(SEL.buySubmit));
    await waitFor("the Confirm in wallet state", `${attrOf(SEL.buyForm, "data-phase")} === "awaiting-wallet"`);
    const confirmDisabled = await evaluate(disabled(SEL.buySubmit));
    check("Confirm in wallet disables the buy button", confirmDisabled);
    await shoot("10-desktop-buy-confirm-in-wallet.png");

    signer.release();
    await waitFor("the pending state", `${attrOf(SEL.buyForm, "data-phase")} === "pending"`);
    const buyHash = await evaluate(attrOf(SEL.buyForm, "data-hash"));
    const pendingLink = await evaluate(
      `(document.querySelector(${JSON.stringify(SEL.buyForm)})?.innerHTML.includes(${JSON.stringify(`${EXPLORER_URL}/tx/`)}))`,
    );
    check("the pending state carries the submitted hash", /^0x[0-9a-fA-F]{64}$/.test(buyHash ?? ""), buyHash ?? "none");
    check("the pending state links to the explorer", Boolean(pendingLink));
    await shoot("11-desktop-buy-pending.png");

    await waitFor("the success state", `${attrOf(SEL.buyForm, "data-phase")} === "success"`);
    const buyReceipt = await publicClient.waitForTransactionReceipt({ hash: buyHash });
    const [curveBuy] = parseEventLogs({ abi: bondingCurveAbi, eventName: "CurveBuy", logs: buyReceipt.logs });
    check("the buy transaction is mined successfully", buyReceipt.status === "success", buyHash);
    check(
      "the CurveBuy event carries the received amount",
      Boolean(curveBuy?.args?.tokensOut),
      curveBuy?.args ? `tokensOut=${curveBuy.args.tokensOut} quoteIn=${curveBuy.args.quoteIn}` : "no CurveBuy log",
    );
    const successText = await evaluate(textOf(SEL.buyForm));
    check("the success message shows the received amount", /You received/.test(successText), successText.slice(0, 160));
    const successLink = await evaluate(
      `(document.querySelector(${JSON.stringify(SEL.buyForm)})?.innerHTML.includes(${JSON.stringify(
        `${EXPLORER_URL}/tx/${buyHash}`,
      )}))`,
    );
    check("the success alert links to the mined transaction", Boolean(successLink), buyHash);
    await shoot("12-desktop-buy-success.png");
    record.trades.push({
      kind: "buy",
      symbol: SYMBOL,
      token: buyAddress,
      hash: buyHash,
      value: curveBuy?.args?.quoteIn?.toString(),
      tokensOut: curveBuy?.args?.tokensOut?.toString(),
    });

    /* ------------------- the reload-free refresh (brief step 8) ------------- */
    /* Compare the same DOM the user is looking at, before and after. The token
     * balance is the decisive one: it is 0 until the buy, so it cannot change
     * without a real re-read and it is not satisfiable by the 20 s poll alone. */
    await sleep(3_000);
    const cardAfter = await evaluate(textOf(`[data-token="${buyAddress}"]`));
    const summaryAfter = await evaluate(textOf('[data-testid="trade-summary"]'));
    const balanceAfterBuy = await evaluate(textOf(SEL.balance));
    const tokenBalanceAfter = await evaluate(attrOf('[data-testid="buy-estimate"]', "data-raw-token-balance"));
    check(
      "the card updates with no reload (price/progress/raised)",
      cardBefore !== cardAfter,
      cardBefore === cardAfter ? "the card text did not change" : "card text changed",
    );
    check(
      "the trade summary updates with no reload",
      summaryBefore !== summaryAfter,
      summaryBefore === summaryAfter ? "the summary did not change" : "summary changed",
    );
    check("the ETH balance updates with no reload", balanceText !== balanceAfterBuy, `${balanceText} → ${balanceAfterBuy}`);
    check(
      "the token balance updates with no reload",
      tokenBalanceAfter !== "" && (tokenBalanceBefore === "" || BigInt(tokenBalanceAfter) > BigInt(tokenBalanceBefore)),
      `${tokenBalanceBefore || "0"} → ${tokenBalanceAfter || "0"} (raw units)`,
    );
    record.balanceTextAfterBuy = balanceAfterBuy;

    /* ------------------------------ the rejection --------------------------- */
    signer.setMode("reject");
    await evaluate(click(SEL.buySubmit));
    await waitFor("the rejected state", `${attrOf(SEL.buyForm, "data-phase")} === "rejected"`);
    const usableAfterReject = !(await evaluate(disabled(SEL.buySubmit)));
    check("a rejected prompt re-enables the buy button", usableAfterReject);
    await shoot("13-desktop-buy-rejected.png");

    /* ------------------------------ the failure ----------------------------- */
    signer.setMode("revert");
    await evaluate(click(SEL.buySubmit));
    await waitFor(
      "the reverted state",
      `["reverted","failed"].includes(${attrOf(SEL.buyForm, "data-phase")})`,
    );
    const revertHash = await evaluate(attrOf(SEL.buyForm, "data-hash"));
    const revertError = await evaluate(attrOf(SEL.buyForm, "data-error"));
    check("the failed buy shows a translated, non-hex error", Boolean(revertError) && !/0x[0-9a-fA-F]{8,}/.test(revertError), revertError || "no error text");
    if (revertHash) {
      const revertReceipt = await publicClient.waitForTransactionReceipt({ hash: revertHash });
      check("the failed buy really reverted on-chain", revertReceipt.status === "reverted", revertHash);
      record.trades.push({ kind: "buy-revert", symbol: SYMBOL, token: buyAddress, hash: revertHash });
    } else {
      check("the failed buy reverted on-chain", false, "no hash — the failure was a pre-broadcast rejection");
    }
    await shoot("14-desktop-buy-reverted.png");
    signer.setMode("accept");

    /* -------------------------------- the sell ------------------------------ */
    if (!SKIP_SELL) {
      const rawTokens = curveBuy?.args?.tokensOut;
      if (!rawTokens) {
        check("the sell path could be exercised", false, "no tokensOut from the buy to sell");
      } else {
        const decimals = await publicClient.readContract({
          address: buyAddress,
          abi: launcherTokenAbi,
          functionName: "decimals",
        });
        const sellTokens = (rawTokens * BigInt(Math.round(SELL_FRACTION * 10_000))) / 10_000n;
        await evaluate(click('[data-testid="tab-sell"]'));
        await waitFor("the sell form", present(SEL.sellForm));
        await evaluate(setInput(SEL.sellAmount, formatUnits(sellTokens, decimals)));
        await waitFor("the sell estimate", `${attrOf('[data-testid="sell-estimate"]', "data-raw-quote-out")} !== ''`);

        signer.holdNext(2);
        await evaluate(click(SEL.sellSubmit));
        await waitFor(
          "the approve confirmation",
          `${attrOf(SEL.sellForm, "data-phase")} === "awaiting-wallet"`,
        );
        const step = await evaluate(attrOf(SEL.sellForm, "data-step"));
        check("the sell asks for the ERC-20 approve first", step === "approving", `step=${step}`);
        await shoot("15-desktop-sell-confirm-in-wallet.png");

        signer.release();
        await waitFor(
          "the sell confirmation",
          `${attrOf(SEL.sellForm, "data-step")} === "selling" && ${attrOf(SEL.sellForm, "data-phase")} === "awaiting-wallet"`,
        );
        signer.release();
        await waitFor("the sell success state", `${attrOf(SEL.sellForm, "data-phase")} === "success"`);
        const sellHash = await evaluate(attrOf(SEL.sellForm, "data-hash"));
        const sellReceipt = await publicClient.waitForTransactionReceipt({ hash: sellHash });
        const [curveSell] = parseEventLogs({ abi: bondingCurveAbi, eventName: "CurveSell", logs: sellReceipt.logs });
        check("the sell transaction is mined successfully", sellReceipt.status === "success", sellHash);
        check(
          "the CurveSell event carries the ETH received",
          Boolean(curveSell?.args?.quoteOut),
          curveSell?.args ? `quoteOut=${curveSell.args.quoteOut}` : "no CurveSell log",
        );
        await shoot("16-desktop-sell-success.png");
        record.trades.push({
          kind: "sell",
          symbol: SYMBOL,
          token: buyAddress,
          hash: sellHash,
          tokensIn: curveSell?.args?.tokensIn?.toString(),
          quoteOut: curveSell?.args?.quoteOut?.toString(),
        });
      }
    }

    /* -------------------------------- wrap up ------------------------------- */
    const balanceAfter = await publicClient.getBalance({ address });
    record.balanceAfter = balanceAfter.toString();
    console.log("");
    console.log(`balance ${eth(balanceBefore)} → ${eth(balanceAfter)}`);
    for (const trade of record.trades) {
      console.log(`tx      ${trade.kind.padEnd(10)} ${trade.hash}  ${EXPLORER_URL}/tx/${trade.hash}`);
    }
    writeFileSync(join(OUT_DIR, "live-trade-record.json"), `${JSON.stringify(record, null, 2)}\n`);
    console.log(`record  ${join(OUT_DIR, "live-trade-record.json")}`);

    return finish(ws, signer, cdp, address, profileDir);
  } catch (error) {
    failures += 1;
    console.error(`\n${error instanceof Error ? error.message : String(error)}`);
    return finish(ws, signer, cdp, address, profileDir);
  }
}

/** Find a listed token's address by its symbol, from the app's own cards. */
async function findTokenBySymbol(evaluate, waitFor, symbol) {
  await waitFor(
    `the ${symbol} card to be listed`,
    `Array.from(document.querySelectorAll(${JSON.stringify(SEL.tokenCard)})).some(
      (card) => (card.getAttribute("data-symbol") ?? "").toUpperCase() === ${JSON.stringify(symbol)})`,
  );
  const cards = await evaluate(
    `Array.from(document.querySelectorAll(${JSON.stringify(SEL.tokenCard)})).map((card) => ({
      token: card.getAttribute("data-token"),
      symbol: card.getAttribute("data-symbol"),
      phase: card.getAttribute("data-phase"),
    }))`,
  );
  const match = cards.find((card) => (card.symbol ?? "").toUpperCase() === symbol);
  return match?.token;
}

async function finish(ws, signer, cdp, address, profileDir) {
  const problemsUnique = [...new Set(problems)];
  console.log("");
  console.log(`--- browser console (${problemsUnique.length}) ---`);
  if (problemsUnique.length === 0) console.log("no errors or warnings");
  for (const problem of problemsUnique) console.log(`  ${problem}`);

  if (problemsUnique.length > 0) failures += problemsUnique.length;

  console.log("");
  console.log(`SUMMARY  ${passes} passed, ${failures} failed`);
  console.log(`RECORD address=${address} chainId=${CHAIN.id} screenshots=${shots.length} trades=${record.trades.length}`);
  for (const trade of record.trades) console.log(`TX ${trade.kind} ${trade.hash}`);

  ws.close();
  cdp.chrome.kill("SIGKILL");
  await signer.close();
  try {
    rmSync(profileDir, { recursive: true, force: true });
  } catch {
    // The temp profile is disposable; leaving it is harmless.
  }
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
