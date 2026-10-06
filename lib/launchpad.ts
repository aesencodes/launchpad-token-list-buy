import type { Address, Hash, PublicClient } from "viem";
import { launchFactoryAbi } from "@/lib/abi/launchFactory";
import { CONTRACTS, FACTORY_DEPLOY_BLOCK, LOG_CHUNK_SIZE } from "@/lib/contracts";

/** The one event that announces a launch. There is no on-chain token list. */
export const tokenLaunchedEvent = launchFactoryAbi.find(
  (entry) => entry.type === "event" && entry.name === "TokenLaunched",
)!;

export type Launch = {
  token: Address;
  curve: Address;
  deployer: Address;
  /** `0x0` means the token trades against native ETH. */
  pairToken: Address;
  launchConfigId: bigint;
  graduationThreshold: bigint;
  blockNumber: bigint;
  transactionHash: Hash;
};

export type FetchLaunchesOptions = {
  /** Called after every chunk so the UI can show discovery progress. */
  onProgress?: (scannedTo: bigint, latest: bigint) => void;
  /** How many `eth_getLogs` calls to have in flight. */
  concurrency?: number;
};

/** Split `[from, to]` into chunks the RPC will accept (<= 50 000 blocks). */
function planChunks(from: bigint, to: bigint, size: bigint): Array<[bigint, bigint]> {
  if (from > to) return [];
  const chunks: Array<[bigint, bigint]> = [];
  for (let start = from; start <= to; start += size) {
    const end = start + size - 1n > to ? to : start + size - 1n;
    chunks.push([start, end]);
  }
  return chunks;
}

/**
 * Discover every launch by scanning `TokenLaunched` from the factory deploy
 * block to the chain head, in 50 000-block chunks (the public RPC rejects
 * anything larger).
 *
 * There is deliberately no cached "already scanned" cursor: a full rescan is
 * only ~10 requests today and it keeps the list correct if the node reorgs or
 * if a launch lands while the page is open.
 */
export async function fetchLaunches(
  client: PublicClient,
  { onProgress, concurrency = 4 }: FetchLaunchesOptions = {},
): Promise<Launch[]> {
  const latest = await client.getBlockNumber();
  const chunks = planChunks(FACTORY_DEPLOY_BLOCK, latest, LOG_CHUNK_SIZE);

  const byToken = new Map<string, Launch>();

  for (let i = 0; i < chunks.length; i += concurrency) {
    const batch = chunks.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(([fromBlock, toBlock]) =>
        client.getLogs({
          address: CONTRACTS.launchFactory,
          event: tokenLaunchedEvent,
          fromBlock,
          toBlock,
        }),
      ),
    );

    for (const logs of results) {
      for (const log of logs) {
        const { token, curve, deployer, pairToken, launchConfigId, graduationThreshold } = log.args;
        if (!token || !curve || !deployer || pairToken === undefined) continue;
        const key = token.toLowerCase();
        const previous = byToken.get(key);
        // Keep the newest observation if the same token somehow shows up twice.
        if (previous && previous.blockNumber >= log.blockNumber) continue;
        byToken.set(key, {
          token,
          curve,
          deployer,
          pairToken,
          launchConfigId: launchConfigId ?? 0n,
          graduationThreshold: graduationThreshold ?? 0n,
          blockNumber: log.blockNumber ?? 0n,
          transactionHash: log.transactionHash ?? "0x",
        });
      }
    }

    if (batch.length > 0) {
      onProgress?.(batch[batch.length - 1][1], latest);
    }
  }

  // Newest launch first, which is the order a launchpad is normally read in.
  return [...byToken.values()].sort((a, b) =>
    a.blockNumber === b.blockNumber ? 0 : a.blockNumber > b.blockNumber ? -1 : 1,
  );
}
