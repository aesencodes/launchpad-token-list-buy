/**
 * Bonding-curve math. Pure `bigint`, no floats, no `Number` conversions.
 *
 * Mirrors `BondingCurveMath` / `BondingCurve.buy()` in the deployed contract:
 * the trade fee and the creator tax are taken off the quote leg first, and the
 * remaining net input is priced against the real (phantom-inclusive) reserves
 * with an integer constant-product formula, rounding down.
 */

export const BPS_DENOMINATOR = 10_000n;
export const MAX_PROGRESS_BPS = 10_000n;

export type Quote = {
  /** Fee taken by the protocol/curve, in wei. */
  fee: bigint;
  /** Creator tax, in wei. */
  creatorTax: bigint;
  /** Amount actually priced against the curve, in wei. */
  net: bigint;
  /** Estimated tokens received, in token base units. */
  tokensOut: bigint;
};

/**
 * Estimate a buy: `quoteIn` wei spent → `tokensOut` token base units.
 *
 * `fee        = quoteIn * feeBps / 10000`
 * `creatorTax = quoteIn * creatorTaxBps / 10000`
 * `net        = quoteIn - fee - creatorTax`
 * `tokensOut  = net * tokenReserve / (quoteReserve + net)`
 *
 * Returns `tokensOut = 0n` when the trade cannot be priced (empty reserves,
 * zero net input) instead of throwing — the UI uses that to disable the button.
 */
export function quoteBuy(
  quoteIn: bigint,
  quoteReserve: bigint,
  tokenReserve: bigint,
  feeBps: bigint,
  creatorTaxBps: bigint,
): Quote {
  const fee = (quoteIn * feeBps) / BPS_DENOMINATOR;
  const creatorTax = (quoteIn * creatorTaxBps) / BPS_DENOMINATOR;
  const net = quoteIn - fee - creatorTax;

  if (quoteIn <= 0n || net <= 0n || quoteReserve <= 0n || tokenReserve <= 0n) {
    return { fee, creatorTax, net: net > 0n ? net : 0n, tokensOut: 0n };
  }

  return { fee, creatorTax, net, tokensOut: (net * tokenReserve) / (quoteReserve + net) };
}

export type SellQuote = {
  /** Gross quote value of the tokens, before fees, in wei. */
  grossQuote: bigint;
  fee: bigint;
  creatorTax: bigint;
  /** Quote actually received, in wei. */
  quoteOut: bigint;
};

/**
 * Estimate a sell: `tokensIn` token base units → wei received.
 * Mirrors `sell()`: the fee and tax come off the gross quote output.
 */
export function quoteSell(
  tokensIn: bigint,
  quoteReserve: bigint,
  tokenReserve: bigint,
  feeBps: bigint,
  creatorTaxBps: bigint,
): SellQuote {
  const grossQuote =
    tokensIn <= 0n || quoteReserve <= 0n || tokenReserve <= 0n
      ? 0n
      : (tokensIn * quoteReserve) / (tokenReserve + tokensIn);
  const fee = (grossQuote * feeBps) / BPS_DENOMINATOR;
  const creatorTax = (grossQuote * creatorTaxBps) / BPS_DENOMINATOR;
  const quoteOut = grossQuote - fee - creatorTax;
  return { grossQuote, fee, creatorTax, quoteOut: quoteOut > 0n ? quoteOut : 0n };
}

/** `minTokensOut = tokensOut * (10000 - slippageBps) / 10000` (floor). */
export function applySlippage(amount: bigint, slippageBps: bigint): bigint {
  if (slippageBps <= 0n) return amount;
  if (slippageBps >= BPS_DENOMINATOR) return 0n;
  return (amount * (BPS_DENOMINATOR - slippageBps)) / BPS_DENOMINATOR;
}

/**
 * Spot price in wei per whole token (`quoteReserve / tokenReserve` scaled by
 * 1e18 so it stays an integer). Returns `null` when the curve has no tokens
 * left to price, e.g. after graduation.
 */
export function spotPriceWeiPerToken(
  quoteReserve: bigint,
  tokenReserve: bigint,
  tokenDecimals = 18,
): bigint | null {
  if (tokenReserve <= 0n || quoteReserve <= 0n) return null;
  return (quoteReserve * 10n ** BigInt(tokenDecimals)) / tokenReserve;
}

/** Graduation progress in basis points, capped at 10 000 (100%). */
export function graduationProgressBps(realQuoteReserve: bigint, graduationThreshold: bigint): bigint {
  if (graduationThreshold <= 0n) return 0n;
  const bps = (realQuoteReserve * BPS_DENOMINATOR) / graduationThreshold;
  return bps > MAX_PROGRESS_BPS ? MAX_PROGRESS_BPS : bps;
}

/** Percent (0-100, one decimal) from basis points, for display only. */
export function bpsToPercentNumber(bps: bigint): number {
  return Number(bps) / 100;
}
