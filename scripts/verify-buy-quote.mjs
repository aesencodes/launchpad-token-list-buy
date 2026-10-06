/**
 * End-to-end curve-math verification (dev-only; needs no wallet and no funds).
 *
 * For both `buy` and `sell` on a live bonding curve it compares three numbers:
 *
 *   1. what the running UI derived (driven in headless Chrome),
 *   2. the same formula recomputed in Node (`lib/bondingCurve.ts` semantics),
 *   3. what the contract itself returns from an `eth_call`.
 *
 * `buy` is simulated directly. `sell` needs the caller to hold tokens and to have
 * approved the curve, so the token's balance/allowance storage slots are
 * overridden with `stateOverride` for the duration of the call — the curve
 * logic that prices the trade is untouched.
 *
 * Usage:
 *   node scripts/verify-buy-quote.mjs [tokenAddress] [ethAmount] [baseUrl]
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  encodeAbiParameters,
  getAddress,
  http,
  keccak256,
  parseEther,
  toHex,
} from "viem";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const TOKEN = getAddress(process.argv[2] ?? "0x505181e3114a6d147839Cb809C84d4e83575a97C"); // TAXED
const AMOUNT = process.argv[3] ?? "0.001";
const BASE_URL = process.argv[4] ?? "http://localhost:3000";

const RPC_URL = "https://robinhood-sepolia-rpc.publicnode.com";
const CHAIN_ID = 46630;
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9334;
const TEST_ACCOUNT = getAddress("0x000000000000000000000000000000000000bEEF");

const chain = {
  id: CHAIN_ID,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: {
    default: { name: "Explorer", url: "https://explorer.testnet.chain.robinhood.com" },
  },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
  testnet: true,
};

const bondingCurveAbi = JSON.parse(
  readFileSync(join(ROOT, "technical-brief", "abi", "BondingCurve.json"), "utf8"),
);
const launcherTokenAbi = JSON.parse(
  readFileSync(join(ROOT, "technical-brief", "abi", "LauncherToken.json"), "utf8"),
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* --------------------------- the formulas under test --------------------------- */

/** Mirrors `lib/bondingCurve.ts` → `quoteBuy`. */
function quoteBuy(quoteIn, quoteReserve, tokenReserve, feeBps, creatorTaxBps) {
  const fee = (quoteIn * feeBps) / 10000n;
  const creatorTax = (quoteIn * creatorTaxBps) / 10000n;
  const net = quoteIn - fee - creatorTax;
  if (quoteIn <= 0n || net <= 0n || quoteReserve <= 0n || tokenReserve <= 0n) {
    return { fee, creatorTax, net: net > 0n ? net : 0n, tokensOut: 0n };
  }
  return { fee, creatorTax, net, tokensOut: (net * tokenReserve) / (quoteReserve + net) };
}

/** Mirrors `lib/bondingCurve.ts` → `quoteSell`. */
function quoteSell(tokensIn, quoteReserve, tokenReserve, feeBps, creatorTaxBps) {
  const grossQuote =
    tokensIn <= 0n || quoteReserve <= 0n || tokenReserve <= 0n
      ? 0n
      : (tokensIn * quoteReserve) / (tokenReserve + tokensIn);
  const fee = (grossQuote * feeBps) / 10000n;
  const creatorTax = (grossQuote * creatorTaxBps) / 10000n;
  const quoteOut = grossQuote - fee - creatorTax;
  return { grossQuote, fee, creatorTax, quoteOut: quoteOut > 0n ? quoteOut : 0n };
}

/* ------------------------------- headless browser ------------------------------ */

async function readUiEstimates() {
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--user-data-dir=/tmp/launchpad-verify-profile",
      `--remote-debugging-port=${PORT}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  try {
    let target;
    for (let attempt = 0; attempt < 60 && !target; attempt++) {
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
        const list = await res.json();
        target = list.find((entry) => entry.type === "page" && entry.webSocketDebuggerUrl);
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
      if (message.id && pending.has(message.id)) {
        const { resolve, reject } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result);
      }
    });
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve);
      ws.addEventListener("error", reject);
    });
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    const evaluate = async (expression) => {
      const { result } = await send("Runtime.evaluate", { expression, returnByValue: true });
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
    await send("Page.navigate", { url: `${BASE_URL}/?token=${TOKEN}` });

    let ready = false;
    for (let attempt = 0; attempt < 60 && !ready; attempt++) {
      await sleep(1000);
      ready = await evaluate(`Boolean(document.querySelector('[data-testid="buy-estimate"]'))`);
    }
    if (!ready) {
      throw new Error("The buy form never rendered — is the app running and the token in phase 0?");
    }

    const typeInto = (selector, value) =>
      evaluate(`(() => {
        const input = document.querySelector(${JSON.stringify(selector)});
        if (!input) return false;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, ${JSON.stringify(value)});
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })()`);

    const readAttributes = (testId) =>
      evaluate(`(() => {
        const el = document.querySelector('[data-testid="${testId}"]');
        if (!el) return null;
        return Object.fromEntries([...el.attributes].map((a) => [a.name, a.value]));
      })()`);

    // ---- buy ----
    if (!(await typeInto("#buy-amount", AMOUNT))) throw new Error("buy amount input not found");
    await sleep(1500);
    const buy = await readAttributes("buy-estimate");

    // ---- sell ----
    const switched = await evaluate(`(() => {
      const tab = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Sell');
      if (!tab) return false;
      tab.click();
      return true;
    })()`);
    if (!switched) throw new Error("Sell tab not found");
    await sleep(500);
    if (!(await typeInto("#sell-amount", "1"))) throw new Error("sell amount input not found");
    await sleep(1500);
    const sell = await readAttributes("sell-estimate");

    ws.close();
    return { buy, sell };
  } finally {
    chrome.kill("SIGKILL");
  }
}

/* ----------------------------------- main ----------------------------------- */

function storageSlot(key, slot) {
  return keccak256(encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [key, slot]));
}

function u256(value) {
  return toHex(value, { size: 32 });
}

async function main() {
  const client = createPublicClient({ chain, transport: http(RPC_URL) });

  const [name, symbol, curve] = await Promise.all([
    client.readContract({ address: TOKEN, abi: launcherTokenAbi, functionName: "name" }),
    client.readContract({ address: TOKEN, abi: launcherTokenAbi, functionName: "symbol" }),
    client.readContract({ address: TOKEN, abi: launcherTokenAbi, functionName: "curve" }),
  ]);

  const [reserves, feeBps, creatorTaxBps, phase] = await Promise.all([
    client.readContract({ address: curve, abi: bondingCurveAbi, functionName: "getReserves" }),
    client.readContract({ address: curve, abi: bondingCurveAbi, functionName: "feeBps" }),
    client.readContract({ address: curve, abi: bondingCurveAbi, functionName: "creatorTaxBps" }),
    client.readContract({
      address: "0x533cE670f1372cb402D49866608b92e7bc2b4493",
      abi: JSON.parse(readFileSync(join(ROOT, "technical-brief", "abi", "LaunchFactory.json"), "utf8")),
      functionName: "getLaunchedToken",
      args: [TOKEN],
    }),
  ]);
  const [quoteReserve, tokenReserve] = reserves;

  const quoteIn = parseEther(AMOUNT);
  const tokensIn = parseEther("1");
  const expectedBuy = quoteBuy(quoteIn, quoteReserve, tokenReserve, feeBps, creatorTaxBps);
  const expectedSell = quoteSell(tokensIn, quoteReserve, tokenReserve, feeBps, creatorTaxBps);

  console.log(`token              ${symbol} (${name}) ${TOKEN}`);
  console.log(`curve              ${curve}   phase=${phase.phase}`);
  console.log(`reserves           quoteReserve=${quoteReserve}  tokenReserve=${tokenReserve}`);
  console.log(`fees               feeBps=${feeBps}  creatorTaxBps=${creatorTaxBps}`);
  console.log("");

  // Contract answers.
  let contractBuy;
  let contractBuyError;
  try {
    const { result } = await client.simulateContract({
      account: TEST_ACCOUNT,
      address: curve,
      abi: bondingCurveAbi,
      functionName: "buy",
      args: [quoteIn, 0n, TEST_ACCOUNT],
      value: quoteIn,
    });
    contractBuy = result;
  } catch (error) {
    contractBuyError = error.shortMessage ?? error.message;
  }

  let contractSell;
  let contractSellError;
  try {
    const balanceSlot = storageSlot(TEST_ACCOUNT, 0n);
    const nestedSlot = storageSlot(TEST_ACCOUNT, 1n);
    const allowanceSlot = keccak256(
      encodeAbiParameters([{ type: "address" }, { type: "bytes32" }], [curve, nestedSlot]),
    );
    const { result } = await client.simulateContract({
      account: TEST_ACCOUNT,
      address: curve,
      abi: bondingCurveAbi,
      functionName: "sell",
      args: [tokensIn, 0n, TEST_ACCOUNT],
      // Only the caller's balance and allowance are faked; the curve's own math
      // runs against real reserves.
      stateOverride: [
        {
          address: TOKEN,
          stateDiff: [
            { slot: balanceSlot, value: u256(tokenReserve) },
            { slot: allowanceSlot, value: u256(tokensIn) },
          ],
        },
      ],
    });
    contractSell = result;
  } catch (error) {
    contractSellError = error.shortMessage ?? error.message;
  }

  const ui = await readUiEstimates();

  console.log(`BUY  ${AMOUNT} ETH`);
  console.log(`  UI                 tokensOut=${ui.buy["data-raw-tokens-out"]}`);
  console.log(`  UI                 minTokensOut=${ui.buy["data-raw-min-tokens-out"]}`);
  console.log(`  UI                 fee=${ui.buy["data-raw-fee"]}  creatorTax=${ui.buy["data-raw-creator-tax"]}`);
  console.log(`  node               tokensOut=${expectedBuy.tokensOut}`);
  console.log(`  node               fee=${expectedBuy.fee}  creatorTax=${expectedBuy.creatorTax}`);
  console.log(`  contract eth_call  tokensOut=${contractBuy ?? `(reverted: ${contractBuyError})`}`);
  console.log("");
  console.log(`SELL 1 ${symbol}`);
  console.log(`  UI                 quoteOut=${ui.sell["data-raw-quote-out"]}`);
  console.log(`  UI                 minQuoteOut=${ui.sell["data-raw-min-quote-out"]}`);
  console.log(`  node               quoteOut=${expectedSell.quoteOut}`);
  console.log(`  contract eth_call  quoteOut=${contractSell ?? `(reverted: ${contractSellError})`}`);
  console.log("");

  const checks = [
    ["buy: UI tokensOut == node estimate", ui.buy["data-raw-tokens-out"] === expectedBuy.tokensOut.toString()],
    ["buy: UI fee == node fee", ui.buy["data-raw-fee"] === expectedBuy.fee.toString()],
    [
      "buy: UI creatorTax == node creatorTax",
      ui.buy["data-raw-creator-tax"] === expectedBuy.creatorTax.toString(),
    ],
    ["sell: UI quoteOut == node estimate", ui.sell["data-raw-quote-out"] === expectedSell.quoteOut.toString()],
  ];
  if (contractBuy !== undefined) {
    checks.push(["buy: node estimate == contract tokensOut", expectedBuy.tokensOut === contractBuy]);
    checks.push(["buy: UI estimate == contract tokensOut", ui.buy["data-raw-tokens-out"] === contractBuy.toString()]);
  }
  if (contractSell !== undefined) {
    checks.push(["sell: node estimate == contract quoteOut", expectedSell.quoteOut === contractSell]);
    checks.push(["sell: UI estimate == contract quoteOut", ui.sell["data-raw-quote-out"] === contractSell.toString()]);
  }

  let failed = false;
  for (const [label, ok] of checks) {
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
    if (!ok) failed = true;
  }
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
