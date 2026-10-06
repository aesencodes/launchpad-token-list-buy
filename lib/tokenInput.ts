import { parseEther, parseUnits } from "viem";

export type ParseFailure =
  | "empty"
  | "not-a-number"
  | "too-many-decimals"
  | "zero"
  | "negative"
  | "too-large";

export type ParseResult =
  | { ok: true; value: bigint }
  | { ok: false; reason: ParseFailure };

/** Max decimals any input may carry (ERC-20/ETH are 18). */
export const MAX_INPUT_DECIMALS = 18;

/** Human hints for each failure mode. */
export const PARSE_FAILURE_MESSAGE: Record<ParseFailure, string> = {
  empty: "Enter an amount",
  "not-a-number": "Enter a valid number",
  "too-many-decimals": `Use at most ${MAX_INPUT_DECIMALS} decimals`,
  zero: "Amount must be greater than zero",
  negative: "Amount cannot be negative",
  "too-large": "Amount is too large",
};

const DECIMAL_RE = /^\d*(?:\.\d*)?$/;

/**
 * Parse a human-typed decimal string into base units with `decimals` decimals.
 * Rejects anything with more decimals than the token supports rather than
 * silently rounding, and never goes through `Number`.
 */
export function parseDecimalInput(input: string, decimals = 18): ParseResult {
  const trimmed = input.trim();
  if (trimmed === "") return { ok: false, reason: "empty" };
  if (trimmed.startsWith("-")) return { ok: false, reason: "negative" };
  if (!DECIMAL_RE.test(trimmed)) return { ok: false, reason: "not-a-number" };

  // ".5" and "5." are both fine to type — normalise before measuring.
  const normalised = trimmed.startsWith(".") ? `0${trimmed}` : trimmed;
  const [, fraction = ""] = normalised.split(".");
  if (fraction.length > decimals) return { ok: false, reason: "too-many-decimals" };

  let value: bigint;
  try {
    value = decimals === 18 ? parseEther(normalised) : parseUnits(normalised, decimals);
  } catch {
    return { ok: false, reason: "not-a-number" };
  }

  if (value === 0n) return { ok: false, reason: "zero" };
  // 2^256 / 1e18 is the practical ceiling; guard absurd input early so the
  // RPC never sees an overflowing uint256.
  if (value > 2n ** 255n) return { ok: false, reason: "too-large" };
  return { ok: true, value };
}

/** ETH input convenience wrapper. */
export function parseEthInput(input: string): ParseResult {
  return parseDecimalInput(input, 18);
}

/** Slippage presets in basis points (1% = 100). */
export const SLIPPAGE_OPTIONS_BPS = [50n, 100n, 200n, 500n, 1000n] as const;
export const DEFAULT_SLIPPAGE_BPS = 100n;

export function slippageLabel(bps: bigint): string {
  const percent = Number(bps) / 100;
  return `${percent}%`;
}
