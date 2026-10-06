import { defineChain } from "viem";
import { CONTRACTS } from "@/lib/contracts";

/**
 * Robinhood Chain Testnet.
 *
 * The Multicall3 address is registered on the chain object so viem/wagmi
 * automatically route `multicall`/`useReadContracts` reads through
 * `aggregate3` instead of one RPC request per call. The value is imported from
 * `lib/contracts.ts` rather than repeated here, so there is exactly one literal
 * to update if it ever changes.
 */
export const robinhoodTestnet = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://robinhood-sepolia-rpc.publicnode.com"],
    },
  },
  blockExplorers: {
    default: {
      name: "Robinhood Chain Explorer",
      url: "https://explorer.testnet.chain.robinhood.com",
    },
  },
  contracts: {
    multicall3: {
      address: CONTRACTS.multicall3,
    },
  },
  testnet: true,
});

export const EXPLORER_URL = robinhoodTestnet.blockExplorers.default.url;

export function explorerTxUrl(hash: string) {
  return `${EXPLORER_URL}/tx/${hash}`;
}

export function explorerAddressUrl(address: string) {
  return `${EXPLORER_URL}/address/${address}`;
}
