/**
 * Standalone verification script: reads the deployed Robinhood Chain Testnet
 * launchpad contracts directly and prints the raw on-chain values.
 *
 * Usage:  node scripts/verify-onchain.mjs
 *
 * This is a developer/diagnostic tool (also used to double-check the numbers
 * the UI shows). It does not require a wallet or any secret.
 */
import {
  createPublicClient,
  http,
  parseAbiItem,
  formatEther,
  getAddress,
  zeroAddress,
} from "viem";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const CHAIN_ID = 46630;
const RPC_URL = "https://robinhood-sepolia-rpc.publicnode.com";
const FACTORY = getAddress("0x533cE670f1372cb402D49866608b92e7bc2b4493");
const FACTORY_DEPLOY_BLOCK = 129157568n;
const LOG_CHUNK = 50000n;

const abiDir = join(__dirname, "..", "technical-brief", "abi");
const factoryAbi = JSON.parse(readFileSync(join(abiDir, "LaunchFactory.json"), "utf8"));
const curveAbi = JSON.parse(readFileSync(join(abiDir, "BondingCurve.json"), "utf8"));
const tokenAbi = JSON.parse(readFileSync(join(abiDir, "LauncherToken.json"), "utf8"));

const tokenLaunched = parseAbiItem(
  "event TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address pairToken, uint256 launchConfigId, uint256 graduationThreshold)",
);

const chain = {
  id: CHAIN_ID,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
};

const client = createPublicClient({ chain, transport: http(RPC_URL) });

const PHASES = ["NotGraduated", "Swept", "PoolCreated", "Rescued"];

async function main() {
  const blockNumber = await client.getBlockNumber();
  console.log(`chain            ${CHAIN_ID}`);
  console.log(`latest block     ${blockNumber}`);

  const [launchFee, configCount] = await Promise.all([
    client.readContract({ address: FACTORY, abi: factoryAbi, functionName: "launchFee" }),
    client.readContract({ address: FACTORY, abi: factoryAbi, functionName: "launchConfigCount" }),
  ]);
  console.log(`launchFee        ${launchFee} wei (${formatEther(launchFee)} ETH)`);
  console.log(`launchConfigs    ${configCount}`);

  for (let id = 0n; id < configCount; id++) {
    const cfg = await client.readContract({
      address: FACTORY,
      abi: factoryAbi,
      functionName: "getLaunchConfig",
      args: [id],
    });
    console.log(
      `  config[${id}] supply=${cfg.supply} curveFeeBps=${cfg.curveFeeBps} phantomQuote=${cfg.phantomQuote} graduationThreshold=${cfg.graduationThreshold} (${formatEther(cfg.graduationThreshold)} ETH) poolFee=${cfg.poolFee} tickSpacing=${cfg.tickSpacing} enabled=${cfg.enabled}`,
    );
  }

  const economics = await client.readContract({
    address: FACTORY,
    abi: factoryAbi,
    functionName: "previewLaunchEconomics",
    args: [1n, zeroAddress],
  });
  console.log(`previewLaunchEconomics(1, 0x0) = ${economics}`);

  console.log(`\nfetching TokenLaunched logs from ${FACTORY_DEPLOY_BLOCK} to ${blockNumber} ...`);
  const logs = [];
  for (let from = FACTORY_DEPLOY_BLOCK; from <= blockNumber; from += LOG_CHUNK) {
    const to = from + LOG_CHUNK - 1n > blockNumber ? blockNumber : from + LOG_CHUNK - 1n;
    const chunk = await client.getLogs({ address: FACTORY, event: tokenLaunched, fromBlock: from, toBlock: to });
    logs.push(...chunk);
    console.log(`  ${from}-${to}: ${chunk.length} logs`);
  }
  console.log(`total launches: ${logs.length}\n`);

  for (const log of logs) {
    const { token, curve, deployer, pairToken, launchConfigId, graduationThreshold } = log.args;
    const [
      name,
      symbol,
      logo,
      reserves,
      real,
      feeBps,
      creatorTaxBps,
      snipeTaxBps,
      snipeTaxSeconds,
      readyToGraduate,
      sellableTokens,
      launched,
    ] = await Promise.all([
      client.readContract({ address: token, abi: tokenAbi, functionName: "name" }),
      client.readContract({ address: token, abi: tokenAbi, functionName: "symbol" }),
      client.readContract({ address: token, abi: tokenAbi, functionName: "logo" }),
      client.readContract({ address: curve, abi: curveAbi, functionName: "getReserves" }),
      client.readContract({ address: curve, abi: curveAbi, functionName: "realQuoteReserve" }),
      client.readContract({ address: curve, abi: curveAbi, functionName: "feeBps" }),
      client.readContract({ address: curve, abi: curveAbi, functionName: "creatorTaxBps" }),
      client.readContract({ address: curve, abi: curveAbi, functionName: "snipeTaxStartBps" }),
      client.readContract({ address: curve, abi: curveAbi, functionName: "snipeTaxSeconds" }),
      client.readContract({ address: curve, abi: curveAbi, functionName: "readyToGraduate" }),
      client.readContract({ address: curve, abi: curveAbi, functionName: "sellableTokens" }),
      client.readContract({ address: FACTORY, abi: factoryAbi, functionName: "getLaunchedToken", args: [token] }),
    ]);
    const [quoteReserve, tokenReserve] = reserves;
    const price = tokenReserve > 0n ? (quoteReserve * 10n ** 18n) / tokenReserve : 0n;
    const progressBps = graduationThreshold > 0n ? (real * 10000n) / graduationThreshold : 0n;
    console.log(`${symbol.padEnd(8)} ${name}`);
    console.log(`  token=${token}`);
    console.log(`  curve=${curve}`);
    console.log(`  deployer=${deployer} pairToken=${pairToken} configId=${launchConfigId} logo=${JSON.stringify(logo)}`);
    console.log(
      `  phase=${launched.phase} (${PHASES[Number(launched.phase)]}) exists=${launched.exists} creatorTaxBps=${launched.creatorTaxBps}`,
    );
    console.log(
      `  quoteReserve=${quoteReserve} tokenReserve=${tokenReserve} realQuoteReserve=${real} threshold=${graduationThreshold}`,
    );
    console.log(
      `  readyToGraduate=${readyToGraduate} sellableTokens=${sellableTokens} (trading is closed whenever readyToGraduate is true, even if phase is still 0)`,
    );
    console.log(
      `  price=${price} wei/token (${price / 10n ** 12n === 0n ? "very small" : ""}) progressBps=${progressBps} feeBps=${feeBps} creatorTaxBps=${creatorTaxBps} snipeTaxStartBps=${snipeTaxBps} snipeTaxSeconds=${snipeTaxSeconds}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
