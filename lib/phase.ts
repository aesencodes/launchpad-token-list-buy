/**
 * `getLaunchedToken(token).phase` — the `GraduationPhase` enum in the contract.
 * Verified against `src/v2/interfaces/ILaunchpadV2.sol`:
 *   NotGraduated, Swept, PoolCreated, Rescued
 */
export const GraduationPhase = {
  /** 0 — still trading on the bonding curve; the only buyable phase. */
  NotGraduated: 0,
  /** 1 — curve bought out, Uniswap v4 pool not created yet. */
  Swept: 1,
  /** 2 — graduated into a Uniswap v4 pool. */
  PoolCreated: 2,
  /** 3 — graduation cancelled, reserves released manually. */
  Rescued: 3,
} as const;

export type PhaseValue = (typeof GraduationPhase)[keyof typeof GraduationPhase];

export type PhaseMeta = {
  label: string;
  shortLabel: string;
  description: string;
  /** Tailwind classes for the badge. */
  className: string;
  /** Only phase 0 tokens can be bought from the curve. */
  buyable: boolean;
};

const PHASE_META: Record<number, PhaseMeta> = {
  [GraduationPhase.NotGraduated]: {
    label: "On bonding curve",
    shortLabel: "Live",
    description: "Trading on the bonding curve. Buys and sells are open.",
    className: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    buyable: true,
  },
  [GraduationPhase.Swept]: {
    label: "Curve filled",
    shortLabel: "Filled",
    description:
      "The curve is fully bought out and trading is halted. The Uniswap v4 pool has not been created yet.",
    className: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
    buyable: false,
  },
  [GraduationPhase.PoolCreated]: {
    label: "Graduated",
    shortLabel: "Graduated",
    description: "Graduated into a Uniswap v4 pool. It no longer trades on the curve.",
    className: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
    buyable: false,
  },
  [GraduationPhase.Rescued]: {
    label: "Graduation cancelled",
    shortLabel: "Cancelled",
    description:
      "Graduation was cancelled and the swept reserves were released manually. The curve is closed.",
    className: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
    buyable: false,
  },
};

const UNKNOWN_PHASE: PhaseMeta = {
  label: "Unknown phase",
  shortLabel: "Unknown",
  description: "The factory report did not match a known graduation phase.",
  className: "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30",
  buyable: false,
};

export function phaseMeta(phase: number | bigint | undefined | null): PhaseMeta {
  if (phase === undefined || phase === null) return UNKNOWN_PHASE;
  return PHASE_META[Number(phase)] ?? UNKNOWN_PHASE;
}

/**
 * The window between the curve filling and the factory phase moving to `Swept`:
 * `readyToGraduate()` is true while `phase` still reads `NotGraduated`, because
 * the crossing buy's auto-graduation preflight failed. Both curve sides are
 * already closed to trades, so the buy and sell forms block on this and the
 * trade panel explains it.
 */
export function isGraduationPending(token: { phase: number; readyToGraduate: boolean }): boolean {
  return token.phase === GraduationPhase.NotGraduated && token.readyToGraduate;
}
