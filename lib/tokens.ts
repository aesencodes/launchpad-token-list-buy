import type { Address } from "viem";
import type { Launch } from "@/lib/launchpad";

/**
 * Everything the UI knows about one launched token, already derived.
 * All amounts are `bigint` in base units; formatting happens at the edge.
 */
export type TokenSummary = {
  /** Raw discovery record. */
  launch: Launch;
  name: string;
  symbol: string;
  logo: string;
  description: string;
  decimals: number;

  /** `GraduationPhase` from `getLaunchedToken`. */
  phase: number;
  creatorFeeRecipient: Address;

  /** `getReserves()`, or `null` when the read failed. */
  quoteReserve: bigint | null;
  tokenReserve: bigint | null;
  /** `realQuoteReserve()` — the ETH actually collected, excluding virtuals/fees. */
  realQuoteReserve: bigint;
  graduationThreshold: bigint;
  /**
   * `readyToGraduate()` on the curve: the sellable allocation is exhausted.
   * Trading is already closed when this is true, even while `phase` is still
   * `NotGraduated` (the crossing buy's auto-graduation preflight can fail).
   */
  readyToGraduate: boolean;

  feeBps: bigint;
  creatorTaxBps: bigint;

  /** `quoteReserve / tokenReserve`, scaled to 18 decimals. `null` if unpriced. */
  priceWeiPerToken: bigint | null;
  /** Graduation progress in basis points, capped at 10 000. */
  progressBps: bigint;

  /** The connected wallet's balance of this token, or `null` when disconnected. */
  userTokenBalance: bigint | null;

  /** `false` when one or more reads failed and defaulted. */
  complete: boolean;
  /** Names of the reads that failed, for diagnostics. */
  failedReads: string[];
};
