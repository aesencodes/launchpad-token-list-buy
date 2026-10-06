"use client";

import { SLIPPAGE_OPTIONS_BPS, slippageLabel } from "@/lib/tokenInput";
import { cn } from "@/lib/cn";

export function SlippageSelector({
  value,
  onChange,
  disabled,
}: {
  value: bigint;
  onChange: (next: bigint) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-zinc-500">Slippage</span>
      <div className="flex flex-1 gap-1" role="radiogroup" aria-label="Slippage tolerance">
        {SLIPPAGE_OPTIONS_BPS.map((option) => {
          const active = option === value;
          return (
            <button
              key={option.toString()}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(option)}
              className={cn(
                "flex-1 rounded-lg border px-1 py-1.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                active
                  ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-200"
                  : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20 hover:text-zinc-200",
              )}
            >
              {slippageLabel(option)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
