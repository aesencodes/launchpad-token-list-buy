import type { Address } from "viem";

/**
 * Every contract address used by the app, in one place.
 * Verified against the brief table and the live chain (see README).
 */
export const CONTRACTS = {
  /** LaunchFactory on Robinhood Chain Testnet. */
  launchFactory: "0x533cE670f1372cb402D49866608b92e7bc2b4493" as Address,
  /** Canonical Multicall3 deployment, same address on most EVM chains. */
  multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11" as Address,
} as const;

/**
 * First block the factory existed in. Log discovery starts here.
 * (Deploy block from the brief, used verbatim — verified that the five sample
 * `TokenLaunched` events land in the first 50 000-block window after it.)
 */
export const FACTORY_DEPLOY_BLOCK = 129_157_568n;

/**
 * `eth_getLogs` on the public RPC rejects ranges larger than 50 000 blocks.
 * A chunk of `size` covers `[from, from + size - 1]`, i.e. exactly `size` blocks.
 */
export const LOG_CHUNK_SIZE = 50_000n;

/** Multicall3 sub-calls per `aggregate3` request. */
export const MULTICALL_BATCH_SIZE = 64;

/** Zero address, i.e. "paired with native ETH" in `TokenLaunched`. */
export const NATIVE_PAIR_TOKEN = "0x0000000000000000000000000000000000000000" as Address;
