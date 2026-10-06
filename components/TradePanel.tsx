"use client";

import { useState } from "react";
import { ArrowLeftRight, ExternalLink, Info, ShieldCheck, X } from "lucide-react";
import { explorerAddressUrl, explorerTxUrl } from "@/lib/chain";
import { formatBpsPercent, formatEth, formatPriceEth, shortenAddress } from "@/lib/format";
import { isGraduationPending, phaseMeta } from "@/lib/phase";
import type { TokenSummary } from "@/lib/tokens";
import type { WalletState } from "@/hooks/useWallet";
import { useGraduateToken } from "@/hooks/useGraduateToken";
import { BuyForm } from "@/components/BuyForm";
import { SellForm } from "@/components/SellForm";
import { TokenDetailsCard } from "@/components/TokenDetailsCard";
import { TokenLogo } from "@/components/TokenLogo";
import { Alert, Badge, Button, Card, LabelValue, ProgressBar } from "@/components/ui";
import { cn } from "@/lib/cn";

type Tab = "buy" | "sell" | "details";

function GraduateAction({ token, onDone }: { token: TokenSummary; onDone: () => void }) {
  const graduate = useGraduateToken();
  const [succeeded, setSucceeded] = useState(false);

  return (
    <Alert tone="info" title="Curve filled — pool not created yet">
      <p>
        The bonding curve is fully bought out. Anyone can complete graduation by creating the Uniswap v4 pool. This is
        permissionless and may need a few attempts.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="primary"
          loading={graduate.isBusy}
          onClick={async () => {
            const ok = await graduate.createPool(token.launch.token);
            if (ok) {
              setSucceeded(true);
              onDone();
            }
          }}
        >
          Finish graduation
        </Button>
        {graduate.hash ? (
          <a
            href={explorerTxUrl(graduate.hash)}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-[11px] font-semibold underline decoration-dotted"
          >
            Explorer
            <ExternalLink className="size-3" aria-hidden />
          </a>
        ) : null}
      </div>
      {graduate.phase === "reverted" || graduate.phase === "failed" ? (
        <p className="mt-2 text-[12px]">{graduate.error?.message}</p>
      ) : null}
      {succeeded ? <p className="mt-2 text-[12px]">Pool creation submitted successfully.</p> : null}
    </Alert>
  );
}

export type TradePanelProps = {
  token: TokenSummary | undefined;
  wallet: WalletState;
  ethBalance: bigint | undefined;
  onClose: () => void;
  onRefresh: () => void;
};

/**
 * Right-hand panel: token summary, buy form, sell form and reference data.
 * Rendered inline on desktop and as a full-screen sheet on small screens.
 */
export function TradePanel({ token, wallet, ethBalance, onClose, onRefresh }: TradePanelProps) {
  const [tab, setTab] = useState<Tab>("buy");

  if (!token) {
    return (
      <Card className="hidden flex-col items-center gap-3 p-8 text-center lg:flex">
        <span className="flex size-11 items-center justify-center rounded-full bg-white/[0.06] text-zinc-400">
          <ArrowLeftRight className="size-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Pick a token</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
            Select a token from the list to see its bonding curve and buy it with ETH. Prices, graduation progress and
            your balances all update from chain state.
          </p>
        </div>
      </Card>
    );
  }

  const phase = phaseMeta(token.phase);
  const progressPercent = Number(token.progressBps) / 100;
  const threshold = token.graduationThreshold > 0n ? token.graduationThreshold : token.launch.graduationThreshold;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--page)]/95 backdrop-blur-sm lg:static lg:z-auto lg:overflow-visible lg:bg-transparent lg:backdrop-blur-none">
      <Card className="min-h-full rounded-none border-x-0 lg:min-h-0 lg:rounded-2xl lg:border-x">
        <div className="flex items-start gap-3 border-b border-white/[0.07] p-4">
          <TokenLogo src={token.logo} symbol={token.symbol} className="size-11 text-base" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-semibold text-zinc-100">{token.name}</h2>
              <Badge className={phase.className}>{phase.label}</Badge>
            </div>
            <p className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500">
              <span className="font-mono">{shortenAddress(token.launch.token, 6)}</span>
              <a
                href={explorerAddressUrl(token.launch.token)}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 hover:text-zinc-300"
              >
                explorer
                <ExternalLink className="size-3" aria-hidden />
              </a>
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={onRefresh} className="px-2">
              <Info className="size-4" aria-hidden />
              <span className="sr-only">Refresh data</span>
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onClose} className="px-2" aria-label="Close panel">
              <X className="size-4" aria-hidden />
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-4 p-4">
          {/* Curve summary */}
          <div className="flex flex-col gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3">
            <LabelValue label="Spot price" value={`${formatPriceEth(token.priceWeiPerToken)} ETH`} />
            <LabelValue label="Real ETH collected" value={`${formatEth(token.realQuoteReserve, 6)} ETH`} />
            <LabelValue label="Graduation target" value={`${formatEth(threshold, 6)} ETH`} />
            <div className="pt-1">
              <div className="mb-1.5 flex items-center justify-between text-[11px]">
                <span className="text-zinc-500">Progress to graduation</span>
                <span className="tabular font-semibold text-zinc-300">{formatBpsPercent(token.progressBps)}</span>
              </div>
              <ProgressBar percent={progressPercent} />
            </div>
          </div>

          {token.phase === 1 ? <GraduateAction token={token} onDone={onRefresh} /> : null}

          {/*
           * The window between the curve filling and the factory phase moving
           * to `Swept`: `_tryAutoGraduate` swallowed a failed graduation, so
           * the curve is already closed while `phase` still reads
           * `NotGraduated`. Both forms block on it; this says why.
           */}
          {isGraduationPending(token) ? (
            <Alert tone="warning" title="Curve filled — graduation pending">
              The bonding curve is fully bought out, so buying and selling on it are closed. The launch has not
              finished moving into its Uniswap v4 pool yet, and that step is completed by the factory rather than from
              this panel, so there is nothing to do here until it does. This view keeps polling and will update on its
              own.
            </Alert>
          ) : null}

          {!phase.buyable ? (
            <Alert tone="info" title={phase.label}>
              {phase.description}
            </Alert>
          ) : null}

          {/* Tabs */}
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/[0.07] bg-white/[0.02] p-1">
            {(
              [
                ["buy", "Buy"],
                ["sell", "Sell"],
                ["details", "Details"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                aria-current={tab === value}
                className={cn(
                  "rounded-lg py-2 text-[13px] font-semibold transition-colors",
                  tab === value ? "bg-white/[0.1] text-zinc-100" : "text-zinc-500 hover:text-zinc-300",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "buy" ? (
            <BuyForm
              token={token}
              address={wallet.address}
              isConnected={wallet.isConnected}
              isSupportedChain={wallet.isSupportedChain}
              ethBalance={ethBalance}
              onConnect={wallet.connect}
              onSwitchNetwork={wallet.switchToRobinhood}
              isSwitchingNetwork={wallet.isSwitchingChain}
            />
          ) : null}

          {tab === "sell" ? (
            <SellForm
              token={token}
              address={wallet.address}
              isConnected={wallet.isConnected}
              isSupportedChain={wallet.isSupportedChain}
              onConnect={wallet.connect}
              onSwitchNetwork={wallet.switchToRobinhood}
              isSwitchingNetwork={wallet.isSwitchingChain}
            />
          ) : null}

          {tab === "details" ? <TokenDetailsCard token={token} /> : null}

          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-zinc-600">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Testnet ETH has no value. Contract interactions are read/written directly against Robinhood Chain Testnet
            through the public RPC — there is no backend in between.
          </p>
        </div>
      </Card>
    </div>
  );
}
