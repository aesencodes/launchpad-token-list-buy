"use client";

import { useMemo, useState } from "react";
import { ExternalLink, TrendingDown } from "lucide-react";
import type { Address } from "viem";
import { explorerTxUrl } from "@/lib/chain";
import { applySlippage, quoteSell } from "@/lib/bondingCurve";
import { formatBpsPercent, formatEth, formatInputAmount, formatTokenAmount } from "@/lib/format";
import { phaseMeta } from "@/lib/phase";
import { NATIVE_PAIR_TOKEN } from "@/lib/contracts";
import { DEFAULT_SLIPPAGE_BPS, PARSE_FAILURE_MESSAGE, parseDecimalInput, slippageLabel } from "@/lib/tokenInput";
import type { TokenSummary } from "@/lib/tokens";
import { useSellToken } from "@/hooks/useSellToken";
import { SlippageSelector } from "@/components/SlippageSelector";
import { Alert, Button, LabelValue } from "@/components/ui";

export type SellFormProps = {
  token: TokenSummary;
  address: Address | undefined;
  isConnected: boolean;
  isSupportedChain: boolean;
  onConnect: () => void;
  onSwitchNetwork: () => void;
  isSwitchingNetwork: boolean;
};

/**
 * Sell form: approve the curve, then `sell(tokensIn, minQuoteOut, recipient)`.
 * The quote estimate mirrors `BondingCurve.sell()` — fee and tax come off the
 * gross quote output — and is fully `bigint`.
 */
export function SellForm({
  token,
  address,
  isConnected,
  isSupportedChain,
  onConnect,
  onSwitchNetwork,
  isSwitchingNetwork,
}: SellFormProps) {
  const [input, setInput] = useState("");
  const [slippageBps, setSlippageBps] = useState<bigint>(DEFAULT_SLIPPAGE_BPS);
  const sell = useSellToken();

  const isNativePair = token.launch.pairToken === NATIVE_PAIR_TOKEN;
  const phase = phaseMeta(token.phase);
  const hasReserves = token.quoteReserve !== null && token.tokenReserve !== null;
  const tokenBalance = token.userTokenBalance ?? 0n;

  const parsed = useMemo(
    () => (input.trim() === "" ? null : parseDecimalInput(input, token.decimals)),
    [input, token.decimals],
  );
  const quote = useMemo(() => {
    if (!parsed?.ok || !hasReserves) return null;
    return quoteSell(parsed.value, token.quoteReserve!, token.tokenReserve!, token.feeBps, token.creatorTaxBps);
  }, [parsed, hasReserves, token.quoteReserve, token.tokenReserve, token.feeBps, token.creatorTaxBps]);

  const minQuoteOut = useMemo(() => (quote ? applySlippage(quote.quoteOut, slippageBps) : 0n), [quote, slippageBps]);

  const insufficientTokens = parsed?.ok === true && tokenBalance < parsed.value;

  const blockers: string[] = [];
  if (!isConnected) blockers.push("Connect your wallet to sell");
  else if (!isSupportedChain) blockers.push("Switch to Robinhood Chain Testnet");
  if (!isNativePair) blockers.push("This token is paired with a non-ETH asset, which this form does not support");
  if (!phase.buyable) blockers.push(`Token is not on the bonding curve (${phase.label})`);
  if (!hasReserves) blockers.push("Curve reserves could not be read");
  if (parsed && !parsed.ok) blockers.push(PARSE_FAILURE_MESSAGE[parsed.reason]);
  if (parsed?.ok && quote && quote.quoteOut === 0n) blockers.push("Amount too small to receive any ETH");
  if (insufficientTokens) blockers.push("You do not hold that many tokens");

  const amountReady = parsed?.ok === true && quote !== null && quote.quoteOut > 0n;
  const canSubmit =
    isConnected && isSupportedChain && isNativePair && phase.buyable && amountReady && !insufficientTokens;

  const handlePrimary = () => {
    if (!canSubmit || !address || !parsed?.ok) return;
    void sell.sell({
      curve: token.launch.curve,
      token: token.launch.token,
      tokensIn: parsed.value,
      minQuoteOut,
      recipient: address,
    });
  };

  const buttonLabel = sell.step === "approving"
    ? "Approving token…"
    : sell.phase === "awaiting-wallet"
      ? "Confirm in wallet…"
      : sell.phase === "pending"
        ? "Waiting for confirmation…"
        : `Sell ${token.symbol}`;

  const walletAction = !isConnected ? "connect" : !isSupportedChain ? "switch" : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="sell-amount" className="text-[12px] font-medium text-zinc-400">
            Amount of {token.symbol} to sell
          </label>
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <span>
              Balance: <span className="tabular text-zinc-300">{formatTokenAmount(tokenBalance, token.decimals, 5)}</span>
            </span>
            {tokenBalance > 0n ? (
              <button
                type="button"
                onClick={() => setInput(formatInputAmount(tokenBalance, token.decimals))}
                className="rounded-md bg-white/[0.07] px-1.5 py-0.5 font-semibold text-zinc-300 transition-colors hover:bg-white/[0.12]"
              >
                MAX
              </button>
            ) : null}
          </div>
        </div>
        <div className="relative">
          <input
            id="sell-amount"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            placeholder="0.0"
            value={input}
            onChange={(event) => setInput(event.target.value.replace(/[^\d.]/g, ""))}
            className="h-14 w-full rounded-xl border border-white/10 bg-white/[0.03] pl-4 pr-20 text-lg font-semibold text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-400/40 focus:outline-none focus:ring-1 focus:ring-emerald-400/30"
          />
          <span className="pointer-events-none absolute right-4 top-1/2 max-w-[5rem] -translate-y-1/2 truncate text-sm font-semibold text-zinc-500">
            {token.symbol}
          </span>
        </div>
      </div>

      <SlippageSelector value={slippageBps} onChange={setSlippageBps} disabled={sell.isBusy} />

      <div
        className="flex flex-col gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3"
        data-testid="sell-estimate"
        data-raw-tokens-in={parsed?.ok ? parsed.value.toString() : ""}
        data-raw-quote-out={quote ? quote.quoteOut.toString() : ""}
        data-raw-min-quote-out={quote && quote.quoteOut > 0n ? minQuoteOut.toString() : ""}
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500">
            <TrendingDown className="size-3.5" aria-hidden />
            You receive (estimate)
          </span>
          <span className="tabular text-right text-sm font-semibold text-emerald-300">
            {quote ? formatEth(quote.quoteOut, 6) : "—"}
            <span className="ml-1 text-[11px] font-normal text-zinc-500">ETH</span>
          </span>
        </div>
        <LabelValue
          label={`Minimum after ${slippageLabel(slippageBps)} slippage`}
          value={quote && quote.quoteOut > 0n ? `${formatEth(minQuoteOut, 6)} ETH` : "—"}
        />
        <LabelValue
          label={`Curve fee (${formatBpsPercent(token.feeBps)})`}
          value={quote ? `${formatEth(quote.fee, 6)} ETH` : "—"}
        />
        <LabelValue
          label={`Creator tax (${formatBpsPercent(token.creatorTaxBps)})`}
          value={quote ? `${formatEth(quote.creatorTax, 6)} ETH` : "—"}
        />
      </div>

      {sell.phase === "rejected" ? (
        <Alert tone="warning" title="Transaction rejected in your wallet">
          Nothing was sent. You can try again whenever you are ready.
        </Alert>
      ) : null}

      {sell.step === "approving" || (sell.phase === "awaiting-wallet" && sell.step === "selling") ? (
        <Alert tone="info" title="Confirm in wallet">
          {sell.step === "approving"
            ? `Step 1 of 2 — approve the curve to spend your ${token.symbol}.`
            : "Step 2 of 2 — confirm the sell."}
        </Alert>
      ) : null}

      {sell.phase === "pending" && sell.hash ? (
        <Alert
          tone="info"
          title="Transaction submitted"
          action={
            <a
              href={explorerTxUrl(sell.hash)}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-[12px] font-semibold underline decoration-dotted"
            >
              Explorer
              <ExternalLink className="size-3" aria-hidden />
            </a>
          }
        >
          Waiting for it to be included in a block…
        </Alert>
      ) : null}

      {sell.phase === "success" ? (
        <Alert
          tone="success"
          title="Sale confirmed"
          action={
            sell.hash ? (
              <a
                href={explorerTxUrl(sell.hash)}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-[12px] font-semibold underline decoration-dotted"
              >
                Explorer
                <ExternalLink className="size-3" aria-hidden />
              </a>
            ) : null
          }
        >
          {sell.result?.quoteOut !== undefined
            ? `You received ${formatEth(sell.result.quoteOut, 6)} ETH.`
            : "The sale was confirmed. Balances and curve data refresh automatically."}
        </Alert>
      ) : null}

      {sell.phase === "reverted" || sell.phase === "failed" ? (
        <Alert tone="error" title={sell.error?.title ?? "Transaction failed"}>
          {sell.error?.message ?? "The transaction could not be completed."}
        </Alert>
      ) : null}

      {blockers.length > 0 && sell.phase !== "rejected" && sell.phase !== "reverted" && sell.phase !== "failed" ? (
        <ul className="flex flex-col gap-1 text-[11px] text-zinc-500">
          {blockers.map((blocker) => (
            <li key={blocker}>• {blocker}</li>
          ))}
        </ul>
      ) : null}

      {walletAction ? (
        <Button
          type="button"
          variant="secondary"
          size="lg"
          block
          onClick={walletAction === "connect" ? onConnect : onSwitchNetwork}
          loading={walletAction === "connect" ? false : isSwitchingNetwork}
        >
          {walletAction === "connect" ? "Connect wallet" : `Switch to Robinhood Chain Testnet`}
        </Button>
      ) : null}

      <Button
        type="button"
        variant="secondary"
        size="lg"
        block
        onClick={handlePrimary}
        loading={sell.isBusy}
        disabled={!canSubmit}
      >
        {buttonLabel}
      </Button>

      <p className="text-center text-[11px] leading-relaxed text-zinc-600">
        Selling needs two confirmations the first time: an ERC-20 approve, then the sell itself.
      </p>
    </div>
  );
}
