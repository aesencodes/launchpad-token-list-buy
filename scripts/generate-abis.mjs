// One-off generator: emits typed `as const` ABI modules from the brief's JSON ABIs.
// Run: node scripts/generate-abis.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const src = join(root, "technical-brief", "abi");
const out = join(root, "lib", "abi");
mkdirSync(out, { recursive: true });

const plan = {
  LaunchFactory: {
    file: "launchFactory.ts",
    exportName: "launchFactoryAbi",
    functions: [
      "launchFee",
      "launchConfigCount",
      "getLaunchConfig",
      "canLaunch",
      "getLaunchedToken",
      "previewLaunchEconomics",
      "launchToken", // both overloads kept (3-arg used by the UI)
      "createGraduatedPool",
    ],
    events: ["TokenLaunched"],
  },
  BondingCurve: {
    file: "bondingCurve.ts",
    exportName: "bondingCurveAbi",
    functions: [
      "buy",
      "sell",
      "getReserves",
      "quoteReserve",
      "tokenReserve",
      "realQuoteReserve",
      "graduationThreshold",
      "feeBps",
      "creatorTaxBps",
      "protocolFeeShareBps",
      "maxInternalPriceImpactBps",
      "token",
      "pairToken",
      "deployer",
      "graduated",
      "readyToGraduate",
      "trackedQuote",
      "trackedTokens",
      "reservedTokens",
      "launchSupply",
      "sellableTokens",
      "launchedAt",
      "snipeTaxStartBps",
      "snipeTaxSeconds",
      "currentSnipeTaxBps",
      "isNativeQuote",
    ],
    events: ["CurveBuy", "CurveSell", "CurveCompleted", "Initialized", "BuybackLocked", "SnipeTaxCharged"],
  },
  LauncherToken: {
    file: "launcherToken.ts",
    exportName: "launcherTokenAbi",
    functions: [
      "name",
      "symbol",
      "decimals",
      "totalSupply",
      "logo",
      "description",
      "socials",
      "getTokenInfo",
      "deployer",
      "curve",
      "launchFactory",
      "balanceOf",
      "allowance",
      "approve",
      "transfer",
      "transferFrom",
    ],
    events: ["Transfer", "Approval"],
  },
};

const header = (name) =>
  `// Generated from technical-brief/abi/${name}.json — do not edit by hand.\n` +
  `// Regenerate with: node scripts/generate-abis.mjs\n\n`;

for (const [name, spec] of Object.entries(plan)) {
  const abi = JSON.parse(readFileSync(join(src, `${name}.json`), "utf8"));
  const keep = abi.filter((entry) => {
    if (entry.type === "error") return true; // keep every custom error for revert decoding
    if (entry.type === "function") return spec.functions.includes(entry.name);
    if (entry.type === "event") return spec.events.includes(entry.name);
    return false;
  });
  const body = JSON.stringify(keep, null, 2);
  writeFileSync(join(out, spec.file), `${header(name)}export const ${spec.exportName} = ${body} as const;\n`);
  console.log(`${spec.file}: ${keep.length}/${abi.length} entries`);
}
