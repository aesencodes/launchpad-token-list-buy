"use client";

import { ExternalLink } from "lucide-react";
import { explorerAddressUrl } from "@/lib/chain";
import { formatBpsPercent, formatEth, formatPriceEth, shortenAddress } from "@/lib/format";
import { phaseMeta } from "@/lib/phase";
import type { TokenSummary } from "@/lib/tokens";
import { TokenLogo } from "@/components/TokenLogo";
import { Badge, Button, ProgressBar } from "@/components/ui";
import { cn } from "@/lib/cn";

export function TokenCard({
  token,
  selected,
  onSelect,
  pairTokenIsNative,
}: {
  token: TokenSummary;
  selected: boolean;
  onSelect: () => void;
  pairTokenIsNative: boolean;
}) {
  const phase = phaseMeta(token.phase);
  const onCurve = token.phase === 0;
  const progressPercent = Number(token.progressBps) / 100;
  const threshold = token.graduationThreshold > 0n ? token.graduationThreshold : token.launch.graduationThreshold;

  return (
    <article
      data-testid="token-card"
      data-token={token.launch.token}
      data-symbol={token.symbol}
      data-phase={token.phase}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border transition-colors",
        selected
          ? "border-emerald-400/50 bg-emerald-400/[0.05]"
          : "border-white/10 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.04]",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="flex w-full flex-col gap-3 p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-400/60"
      >
        <div className="flex items-start gap-3">
          <TokenLogo src={token.logo} symbol={token.symbol} className="size-11 text-base" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-zinc-100">{token.name}</h3>
              <span className="shrink-0 rounded-md bg-white/[0.07] px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-zinc-300">
                {token.symbol}
              </span>
            </div>
            <p className="mt-0.5 font-mono text-[11px] text-zinc-500">{shortenAddress(token.launch.token, 6)}</p>
          </div>
          <Badge className={cn("shrink-0", phase.className)}>{phase.shortLabel}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Spot price</p>
            <p className="tabular mt-0.5 text-sm font-semibold text-zinc-100">
              {formatPriceEth(token.priceWeiPerToken)}
              <span className="ml-1 text-[11px] font-normal text-zinc-500">ETH</span>
            </p>
            <p className="mt-0.5 truncate text-[11px] text-zinc-600">
              {onCurve ? "bonding-curve price" : "no longer on the curve"}
            </p>
          </div>
          <div className="min-w-0 text-right">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Raised</p>
            <p className="tabular mt-0.5 text-sm font-semibold text-zinc-100">
              {formatEth(token.realQuoteReserve)}
              <span className="ml-1 text-[11px] font-normal text-zinc-500">ETH</span>
            </p>
            <p className="mt-0.5 truncate text-[11px] text-zinc-600">target {formatEth(threshold)} ETH</p>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="text-zinc-500">{onCurve ? "Graduation progress" : "Curve status"}</span>
            <span className="tabular font-semibold text-zinc-300">
              {onCurve ? formatBpsPercent(token.progressBps) : phase.shortLabel}
            </span>
          </div>
          <ProgressBar
            percent={onCurve ? progressPercent : 100}
            barClassName={
              !onCurve
                ? "from-sky-400 to-sky-300"
                : token.progressBps >= 10_000n
                  ? "from-sky-400 to-sky-300"
                  : token.progressBps >= 5_000n
                    ? "from-amber-400 to-emerald-300"
                    : undefined
            }
          />
        </div>

        {!token.complete ? (
          <p className="text-[11px] text-amber-300/80">
            Some on-chain fields could not be read ({token.failedReads.join(", ")}). Values shown are partial.
          </p>
        ) : null}
      </button>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-white/[0.07] px-4 py-2.5">
        <a
          href={explorerAddressUrl(token.launch.token)}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 transition-colors hover:text-zinc-300"
        >
          Explorer
          <ExternalLink className="size-3" aria-hidden />
        </a>
        {pairTokenIsNative ? (
          <Button
            type="button"
            size="sm"
            variant={phase.buyable ? "primary" : "secondary"}
            onClick={onSelect}
            disabled={!phase.buyable}
            title={phase.buyable ? `Open the buy form for ${token.symbol}` : phase.description}
          >
            {phase.buyable ? "Buy" : phase.shortLabel}
          </Button>
        ) : (
          <Badge className="bg-zinc-500/15 text-zinc-300 ring-zinc-500/30">Non-ETH pair</Badge>
        )}
      </div>
    </article>
  );
}
