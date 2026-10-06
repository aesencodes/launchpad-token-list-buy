/**
 * Wallet preflight for the funding ticket (#5) and the live-trade proof (#7).
 *
 * What this script proves, and what it deliberately does not:
 *
 *   PROVES (chain read, no browser): the address exists on chain 46630 and the
 *   RPC reports the balance printed on the `RECORD` line, at the block named
 *   there. That is the number to paste into the ticket.
 *
 *   PROVES (app wiring, `--app`): the running app connects to that address,
 *   renders it and the live balance in its wallet bar, and its network banner
 *   asks the wallet for exactly chain 46630 — including the `4902` →
 *   `wallet_addEthereumChain` fallback that adds the network when the wallet
 *   does not know it yet, with this repo's RPC URL, explorer URL and
 *   `nativeCurrency` (brief step 2).
 *
 *   DOES NOT PROVE: that a human's MetaMask holds those funds, or that any
 *   transaction was signed or mined. The funding transfer is the dev's step
 *   (faucet, or the supervisor's send), and a mined buy is issue #7. The
 *   `--app` phase drives a **mock** EIP-1193 provider, because the only
 *   automatable part of "MetaMask shows the balance" is the app's side of it:
 *   wiring evidence is not funding evidence, and this file never pretends
 *   otherwise.
 *
 * Usage:
 *   node scripts/check-wallet.mjs <address> [--min 0.05] [--app <url>]
 *
 *   <address>      the wallet to check (any EIP-55 or lowercase 0x address)
 *   --min <eth>    required balance in ETH (default 0.05, the ticket's target)
 *   --app [url]    also drive the app in headless Chrome (needs it running;
 *                  the URL defaults to http://localhost:3000)
 *
 * The `--app` phase asserts on the app's `data-testid` hooks, not on button
 * copy, so a wording change cannot turn a working app into a FAIL.
 *
 * Exit code is 0 only when every check that ran passed.
 */
import { spawn } from "node:child_process";
import { createPublicClient, formatUnits, getAddress, http, parseEther } from "viem";

/* Chain configuration, kept in sync with `lib/chain.ts` (the scripts are plain
 * Node and cannot resolve the app's `@/` path alias). Same shape as
 * `scripts/verify-buy-quote.mjs`, and the single source for both the client
 * below and the add-network parameters the app must send. */
const CHAIN = {
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://robinhood-sepolia-rpc.publicnode.com"] } },
  blockExplorers: { default: { name: "Robinhood Chain Explorer", url: "https://explorer.testnet.chain.robinhood.com" } },
  testnet: true,
};
const RPC_URL = CHAIN.rpcUrls.default.http[0];
const CHAIN_NAME = CHAIN.name;
const EXPLORER_URL = CHAIN.blockExplorers.default.url;
const NATIVE_CURRENCY = CHAIN.nativeCurrency;

/** Read-only chain access, through viem rather than hand-rolled JSON-RPC. */
const client = createPublicClient({ chain: CHAIN, transport: http(RPC_URL) });

/**
 * DOM contract of the running app: the test hooks in `components/WalletBar.tsx`
 * and `components/NetworkBanner.tsx`. Asserting on these instead of on button
 * copy means a wording change cannot turn a working app into a FAIL.
 */
const SEL = {
  connect: '[data-testid="connect-wallet"]',
  walletBar: '[data-testid="wallet-bar"]',
  balance: '[data-testid="wallet-balance"]',
  banner: '[data-testid="network-banner"]',
  switchNetwork: '[data-testid="switch-network"]',
};

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const CDP_PORT = 9336;
const PROFILE_DIR = "/tmp/launchpad-wallet-profile";
const APP_TIMEOUT_MS = 60_000;
const CDP_CALL_TIMEOUT_MS = 30_000;

/* ----------------------------------- args ---------------------------------- */

const argv = process.argv.slice(2);
const positional = argv.filter((arg) => !arg.startsWith("--"));
const flag = (name, fallback) => {
  const index = argv.findIndex((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`));
  if (index === -1) return fallback;
  const inline = argv[index].split("=")[1];
  if (inline !== undefined) return inline;
  const next = argv[index + 1];
  return next === undefined || next.startsWith("--") ? fallback : next;
};

const rawAddress = positional[0];
const MIN_ETH = flag("min", "0.05");
/** `--app` on its own means the documented dev URL; no flag means "chain read only". */
const APP_URL = flag("app", undefined) ?? (argv.some((arg) => arg === "--app" || arg.startsWith("--app=")) ? "http://localhost:3000" : undefined);

/* --------------------------------- results --------------------------------- */

let failures = 0;
let passes = 0;
let skipped = 0;

function check(label, ok, detail = "") {
  const line = `${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`;
  console.log(line);
  if (ok) passes += 1;
  else failures += 1;
}

function skip(label, reason) {
  console.log(`SKIP  ${label} — ${reason}`);
  skipped += 1;
}

/* ------------------------------- formatting -------------------------------- */
/* An exact mirror of `formatUnitsSignificant` in `lib/format.ts` (the wallet bar
 * renders `formatEth(value, 4)`), so the script can predict the string the app
 * must show. Mirrored, not imported, for the same reason the chain constants
 * are: this is plain Node. */

const SUBSCRIPTS = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];

function subscript(n) {
  return String(n)
    .split("")
    .map((digit) => SUBSCRIPTS[Number(digit)])
    .join("");
}

function trimTrailingZeros(fraction) {
  return fraction.replace(/0+$/, "");
}

function formatUnitsSignificant(value, decimals, significant = 4) {
  if (value < 0n) return `-${formatUnitsSignificant(-value, decimals, significant)}`;
  if (value === 0n) return "0";

  const raw = formatUnits(value, decimals);
  const [intPart, rawFraction = ""] = raw.split(".");
  const fraction = trimTrailingZeros(rawFraction);

  if (intPart !== "0" || fraction.length === 0) {
    const digits = intPart.replace(/^0+(?=\d)/, "");
    const trimmed = trimTrailingZeros(fraction.slice(0, significant));
    return trimmed.length > 0 ? `${digits}.${trimmed}` : digits;
  }

  const leadingZeros = fraction.match(/^0*/)?.[0].length ?? 0;
  const digits = fraction.slice(leadingZeros, leadingZeros + significant);
  if (leadingZeros >= 4) return `0.0${subscript(leadingZeros)}${digits}`;
  return `0.${"0".repeat(leadingZeros)}${digits}`;
}

/* ---------------------------------- chain ---------------------------------- */

/* --------------------------- headless app driving --------------------------- */
/*
 * Installed into the page *before* any app script runs, so wagmi sees a wallet
 * on first render. It answers only the EIP-1193 methods a wallet connection
 * needs; every other call is rejected, exactly as an unknown method would be.
 * The app's own chain reads go straight to the RPC with viem, so they stay real.
 */
function installMockWallet(address) {
  const listeners = new Map();
  const log = [];
  const state = { chainId: 1, added: false };

  const emit = (event, payload) => {
    for (const listener of listeners.get(event) ?? []) listener(payload);
  };

  const hexChainId = (id) => `0x${id.toString(16)}`;

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
          // MetaMask iOS and others do not implement it; wagmi swallows this.
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
          // What MetaMask answers for a chain it has never seen: 4902.
          throw Object.assign(
            new Error(`Unrecognized chain ID "${requested}". Try adding the chain using wallet_addEthereumChain first.`),
            { code: 4902 },
          );
        }
        case "wallet_addEthereumChain": {
          log.push({ method, params });
          const chain = params[0];
          state.added = true;
          state.chainId = Number.parseInt(chain.chainId, 16);
          setTimeout(() => emit("chainChanged", hexChainId(state.chainId)), 0);
          return null;
        }
        default:
          throw Object.assign(new Error(`Method not found: ${method}`), { code: -32601 });
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
  window.__walletHarness = { log, state };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function driveApp({ url, address, expectedBalanceText }) {
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${PROFILE_DIR}`,
      `--remote-debugging-port=${CDP_PORT}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  try {
    let target;
    for (let attempt = 0; attempt < 60 && !target; attempt++) {
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
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !pending.has(message.id)) return;
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    });
    ws.addEventListener("close", () => {
      for (const { reject } of pending.values()) reject(new Error("the Chrome DevTools connection closed"));
      pending.clear();
    });
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve);
      ws.addEventListener("error", reject);
    });
    // Every CDP call is bounded: a wedged browser must fail loudly instead of
    // hanging the script with no output.
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

    await send("Page.enable");
    await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await send("Page.addScriptToEvaluateOnNewDocument", {
      source: `(${installMockWallet.toString()})(${JSON.stringify(address)})`,
    });
    await send("Page.navigate", { url });

    const present = (selector) => `Boolean(document.querySelector(${JSON.stringify(selector)}))`;
    const textOf = (selector) =>
      `((document.querySelector(${JSON.stringify(selector)})?.textContent ?? '').replace(/\\s+/g, ' ').trim())`;
    const click = (selector) =>
      evaluate(`(() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        if (!element) return false;
        element.click();
        return true;
      })()`);

    const waitFor = async (label, expression, timeout = APP_TIMEOUT_MS) => {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        try {
          if (await evaluate(expression)) return true;
        } catch (error) {
          // A destroyed execution context (navigation, HMR reload) is not the
          // condition being waited for; retry until the deadline.
          if (!/context|destroyed|closed/i.test(String(error))) throw error;
        }
        await sleep(500);
      }
      throw new Error(`timed out waiting for ${label}`);
    };

    await waitFor("the app's connect button", `${present(SEL.connect)} || ${present(SEL.walletBar)}`);
    if (!(await click(SEL.connect))) {
      throw new Error(`no connect button (${SEL.connect}) on the page — is the app running the current code?`);
    }
    await waitFor("the wallet to connect", present(SEL.walletBar));

    // The mock wallet reports chain 1, so the app must warn before it switches.
    const bannerShown = await evaluate(present(SEL.banner));
    check(
      "the app warns about the wrong network (wallet on chain 1)",
      bannerShown,
      bannerShown ? await evaluate(textOf(SEL.banner)) : `no ${SEL.banner} element`,
    );

    const clicked = await click(SEL.switchNetwork);
    check("the banner offers a switch/add-network button", clicked);

    const bannerCleared = await evaluate(`(async () => {
      const deadline = Date.now() + 30000;
      while (Date.now() < deadline) {
        if (!document.querySelector(${JSON.stringify(SEL.banner)})) return true;
        await new Promise((r) => setTimeout(r, 500));
      }
      return false;
    })()`).catch(() => false);
    check("the banner clears once the wallet reports chain 46630", bannerCleared);

    const harness = await evaluate(
      "window.__walletHarness ? { log: window.__walletHarness.log, chainId: window.__walletHarness.state.chainId } : null",
    );
    const switchCall = harness?.log.find((entry) => entry.method === "wallet_switchEthereumChain");
    const addCall = harness?.log.find((entry) => entry.method === "wallet_addEthereumChain");
    const chainIdHex = `0x${CHAIN.id.toString(16)}`;

    check(
      "the switch button asks the wallet for chain 46630",
      switchCall?.params?.[0]?.chainId?.toLowerCase() === chainIdHex,
      switchCall ? JSON.stringify(switchCall.params) : "no wallet_switchEthereumChain call",
    );
    check(
      "a wallet that does not know the chain gets it added (4902 → wallet_addEthereumChain)",
      Boolean(addCall),
      addCall ? "the wallet answered 4902, so the app added the network" : "no wallet_addEthereumChain call",
    );

    if (addCall) {
      const chain = addCall.params?.[0] ?? {};
      check(
        "the added network is chain 46630 with this repo's RPC, explorer and currency",
        chain.chainId?.toLowerCase() === chainIdHex &&
          chain.chainName === CHAIN_NAME &&
          Array.isArray(chain.rpcUrls) &&
          chain.rpcUrls[0] === RPC_URL &&
          Array.isArray(chain.blockExplorerUrls) &&
          chain.blockExplorerUrls[0] === EXPLORER_URL &&
          chain.nativeCurrency?.symbol === NATIVE_CURRENCY.symbol &&
          chain.nativeCurrency?.decimals === NATIVE_CURRENCY.decimals,
        JSON.stringify(chain),
      );
      check(
        "the wallet ends up on chain 46630",
        harness?.chainId === CHAIN.id,
        `wallet chainId ${harness?.chainId}`,
      );
    }

    const barText = await evaluate(textOf(SEL.walletBar));
    const shortened = `${address.slice(0, 6)}…${address.slice(-4)}`;
    check("the wallet bar shows the wallet address", barText.includes(shortened), barText || `no ${SEL.walletBar} element`);

    const renderedBalance = await evaluate(`(async () => {
      const deadline = Date.now() + 30000;
      let seen = '';
      while (Date.now() < deadline) {
        const text = ${textOf(SEL.balance)};
        // The app renders a loading placeholder until the balance read lands;
        // both the value and the error state carry the unit.
        if (text.includes(' ETH')) return text;
        seen = text;
        await new Promise((r) => setTimeout(r, 500));
      }
      return seen;
    })()`);
    check(
      `the wallet bar shows the live balance (${expectedBalanceText})`,
      renderedBalance === expectedBalanceText,
      renderedBalance || `no ${SEL.balance} element`,
    );

    ws.close();
  } finally {
    chrome.kill("SIGKILL");
  }
}

/* ----------------------------------- main ----------------------------------- */

async function main() {
  if (!rawAddress) {
    console.error("usage: node scripts/check-wallet.mjs <address> [--min 0.05] [--app http://localhost:3000]");
    process.exit(2);
  }

  let address;
  try {
    address = getAddress(rawAddress);
  } catch {
    console.error(`${rawAddress} is not an Ethereum address.`);
    process.exit(2);
  }

  let minWei;
  try {
    minWei = parseEther(MIN_ETH);
  } catch {
    console.error(`--min ${MIN_ETH} is not an ETH amount.`);
    process.exit(2);
  }

  console.log(`wallet ${address}`);
  console.log(`explorer ${EXPLORER_URL}/address/${address}`);
  console.log("");

  const reportedChainId = await client.getChainId();
  check(
    `the RPC answers on chain ${CHAIN.id}`,
    reportedChainId === CHAIN.id,
    `eth_chainId ${reportedChainId}`,
  );

  const [balance, block] = await Promise.all([
    client.getBalance({ address }),
    client.getBlockNumber({ cacheTime: 0 }),
  ]);
  const balanceText = `${formatUnitsSignificant(balance, 18, 4)} ETH`;

  check(`the balance is at least ${MIN_ETH} ETH`, balance >= minWei, `${balanceText} at block ${block}`);
  if (balance < minWei) {
    console.log("");
    console.log(`  Not enough to trade with yet. Fund this address from https://faucet.testnet.chain.robinhood.com/`);
    console.log("  (it is behind a Cloudflare check, so it needs a real browser), or hand the address to the");
    console.log("  supervisor — the brief says they will send testnet ETH on the spot.");
  }

  if (APP_URL === undefined) {
    console.log("");
    skip("app wiring", "pass --app <url> with the app running to check the wallet bar and the banner");
  } else {
    console.log("");
    console.log(`--- app wiring (${APP_URL}) ---`);
    let reachable = false;
    try {
      const res = await fetch(APP_URL, { headers: { "user-agent": "launchpad-check-wallet/1.0" } });
      reachable = res.ok;
    } catch {
      reachable = false;
    }
    if (!reachable) {
      check(`the app answers at ${APP_URL}`, false, "is \`npm run dev\` (or \`npm start\`) running?");
    } else {
      check(`the app answers at ${APP_URL}`, true);
      await driveApp({ url: APP_URL, address, expectedBalanceText: balanceText });
    }
  }

  console.log("");
  console.log(`SUMMARY  ${passes} passed, ${failures} failed, ${skipped} skipped`);
  console.log(`RECORD address=${address} chainId=${CHAIN.id} balance=${balance} wei (${balanceText}) block=${block}`);
  console.log("NOTE  the chain read is evidence; the --app phase drives a mock wallet, so it is wiring evidence, not funding evidence.");
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
