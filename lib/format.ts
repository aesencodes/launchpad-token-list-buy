import { formatUnits } from "viem";

/** Subscript digits, used to keep very small prices readable (`0.0₅1234`). */
const SUBSCRIPTS = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];

function subscript(n: number): string {
  return String(n)
    .split("")
    .map((d) => SUBSCRIPTS[Number(d)])
    .join("");
}

function trimTrailingZeros(frac: string): string {
  return frac.replace(/0+$/, "");
}

/**
 * Format a fixed-point value with at most `significant` significant digits.
 * Values below 1 use `0.0ₙ` subscript notation once there are 4+ leading zeros,
 * so a price of 1.7e-11 ETH renders as `0.0₁₀1699` instead of `0.00`.
 *
 * Pure string/bigint work — never converts the value to a float.
 */
export function formatUnitsSignificant(value: bigint, decimals: number, significant = 4): string {
  if (value < 0n) return `-${formatUnitsSignificant(-value, decimals, significant)}`;
  if (value === 0n) return "0";

  const raw = formatUnits(value, decimals);
  const [intPart, rawFrac = ""] = raw.split(".");
  const frac = trimTrailingZeros(rawFrac);

  if (intPart !== "0" || frac.length === 0) {
    // Values >= 1: keep the whole integer part and at most `significant`
    // fractional digits, without trailing zeros.
    const digits = intPart.replace(/^0+(?=\d)/, "");
    const keep = frac.slice(0, significant);
    const trimmed = trimTrailingZeros(keep);
    return trimmed.length > 0 ? `${digits}.${trimmed}` : digits;
  }

  const leadingZeros = frac.match(/^0*/)?.[0].length ?? 0;
  const digits = frac.slice(leadingZeros, leadingZeros + significant);

  if (leadingZeros >= 4) {
    return `0.0${subscript(leadingZeros)}${digits}`;
  }
  return `0.${"0".repeat(leadingZeros)}${digits}`;
}

/** ETH amount (18 decimals). `0.042`, `0.0005`, `0.0₁₀1699`. */
export function formatEth(value: bigint | undefined | null, significant = 6): string {
  if (value === undefined || value === null) return "—";
  return formatUnitsSignificant(value, 18, significant);
}

/** ETH amount with a trailing unit, e.g. `0.042 ETH`. */
export function formatEthWithSymbol(value: bigint | undefined | null, significant = 6): string {
  const formatted = formatEth(value, significant);
  return formatted === "—" ? formatted : `${formatted} ETH`;
}

/**
 * Token amount, compacted once the whole part gets long
 * (`994.14K`, `1.00B`), otherwise significant digits.
 */
export function formatTokenAmount(value: bigint | undefined | null, decimals = 18, significant = 4): string {
  if (value === undefined || value === null) return "—";

  const scales: ReadonlyArray<readonly [bigint, string]> = [
    [10n ** 12n, "T"],
    [10n ** 9n, "B"],
    [10n ** 6n, "M"],
    [10n ** 3n, "K"],
  ];
  const scale = 10n ** BigInt(decimals);
  const whole = value / scale;

  for (const [unit, suffix] of scales) {
    if (whole >= unit) {
      const unitValue = whole / unit;
      const remainder = whole % unit;
      const frac2 = (remainder * 100n) / unit;
      return `${unitValue}.${frac2.toString().padStart(2, "0")}${suffix}`;
    }
  }

  return formatUnitsSignificant(value, decimals, significant);
}

/**
 * Spot price in wei per whole token → readable ETH-per-token string.
 * `null` (no liquidity / graduated curve) renders as an em dash.
 */
export function formatPriceEth(weiPerToken: bigint | null | undefined, significant = 4): string {
  if (weiPerToken === null || weiPerToken === undefined) return "—";
  return formatUnitsSignificant(weiPerToken, 18, significant);
}

/** Basis points → percent string with one decimal, e.g. `890n` → `8.9%`. */
export function formatBpsPercent(bps: bigint): string {
  const percent = Number(bps) / 100;
  return `${percent.toFixed(1)}%`;
}

/** 0x1234…abcd */
export function shortenAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}

/**
 * Exact fixed-point value as an editable string (no rounding, trailing zeros
 * trimmed). Used to prefill the amount input from a wallet balance.
 */
export function formatInputAmount(value: bigint, decimals = 18): string {
  const raw = formatUnits(value, decimals);
  return raw.includes(".") ? raw.replace(/0+$/, "").replace(/\.$/, "") : raw;
}

/** `12.3s`, `4m 05s`, `1h 02m` — for relative timestamps. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes}m ${String(totalSeconds % 60).padStart(2, "0")}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
}
