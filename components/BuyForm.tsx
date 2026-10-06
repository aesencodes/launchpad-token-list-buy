"use client";

import { useMemo, useState } from "react";
import { ExternalLink, TrendingUp } from "lucide-react";
import type { Address } from "viem";
import { explorerTxUrl } from "@/lib/chain";
import { applySlippage, quoteBuy } from "@/lib/bondingCurve";
import { formatBpsPercent, formatEth, formatInputAmount, formatTokenAmount } from "@/lib/format";
import { phaseMeta } from "@/lib/phase";
import { PARSE_FAILURE_MESSAGE, parseEthInput, slippageLabel } from "@/lib/tokenInput";
import { NATIVE_PAIR_TOKEN } from "@/lib/contracts";
import type { TokenSummary } from "@/lib/tokens";
import { DEFAULT_SLIPPAGE_BPS } from "@/lib/tokenInput";
import { useBuyToken } from "@/hooks/useBuyToken";
import { SlippageSelector } from "@/components/SlippageSelector";
import { Alert, Button, LabelValue } from "@/components/ui";

export const GAS_BUFFER_WEI = 200_000_000_000_000n; // 0.0002 ETH

export type BuyFormProps = {
  token: TokenSummary;
  address: Address | undefined;
  isConnected: boolean;
  isSupportedChain: boolean;
  ethBalance: bigint | undefined;
  onConnect: () => void;
  onSwitchNetwork: () => void;
  isSwitchingNetwork: boolean;
};

/**
 * Buy form: ETH amount → curve estimate → `buy(quoteIn, minTokensOut, recipient)`.
 *
 * Every number is derived with `bigint`; the only conversions happen inside
 * `lib/format.ts` at render time.
 */
export function BuyForm({
  token,
  address,
  isConnected,
  isSupportedChain,
  ethBalance,
  onConnect,
  onSwitchNetwork,
  isSwitchingNetwork,
}: BuyFormProps) {
  const [input, setInput] = useState("");
  const [slippageBps, setSlippageBps] = useState<bigint>(DEFAULT_SLIPPAGE_BPS);
  const buy = useBuyToken();

  const isNativePair = token.launch.pairToken === NATIVE_PAIR_TOKEN;
  const phase = phaseMeta(token.phase);
  const hasReserves = token.quoteReserve !== null && token.tokenReserve !== null;

  const parsed = useMemo(() => (input.trim() === "" ? null : parseEthInput(input)), [input]);
  const quote = useMemo(() => {
    if (!parsed?.ok || !hasReserves) return null;
    return quoteBuy(parsed.value, token.quoteReserve!, token.tokenReserve!, token.feeBps, token.creatorTaxBps);
  }, [parsed, hasReserves, token.quoteReserve, token.tokenReserve, token.feeBps, token.creatorTaxBps]);

  const minTokensOut = useMemo(
    () => (quote ? applySlippage(quote.tokensOut, slippageBps) : 0n),
    [quote, slippageBps],
  );

  const insufficientBalance =
    parsed?.ok === true && ethBalance !== undefined && ethBalance < parsed.value;

  /** Reasons the transaction cannot be sent right now. */
  const blockers: string[] = [];
  if (!isConnected) blockers.push("Connect your wallet to buy");
  else if (!isSupportedChain) blockers.push("Switch to Robinhood Chain Testnet");
  if (!isNativePair) blockers.push("This token is paired with a non-ETH asset, which this form does not support");
  if (!phase.buyable) blockers.push(`Token is not on the bonding curve (${phase.label})`);
  if (!hasReserves) blockers.push("Curve reserves could not be read");
  if (parsed && !parsed.ok) blockers.push(PARSE_FAILURE_MESSAGE[parsed.reason]);
  if (parsed?.ok && quote && quote.tokensOut === 0n) blockers.push("Amount too small to buy any tokens");
  if (insufficientBalance) blockers.push("Insufficient ETH balance for this amount");

  const amountReady = parsed?.ok === true && quote !== null && quote.tokensOut > 0n;
  const canSubmit = isConnected && isSupportedChain && isNativePair && phase.buyable && amountReady && !insufficientBalance;

  const maxSpendable =
    ethBalance === undefined
      ? undefined
      : ethBalance > GAS_BUFFER_WEI
        ? ethBalance - GAS_BUFFER_WEI
        : ethBalance;

  const handlePrimary = () => {
    if (!canSubmit || !address || !parsed?.ok) return;
    void buy.buy({
      curve: token.launch.curve,
      token: token.launch.token,
      quoteIn: parsed.value,
      minTokensOut,
      recipient: address,
    });
  };

  const buttonLabel = buy.phase === "awaiting-wallet"
    ? "Confirm in wallet…"
    : buy.phase === "pending"
      ? "Waiting for confirmation…"
      : `Buy ${token.symbol}`;

  const walletAction = !isConnected ? "connect" : !isSupportedChain ? "switch" : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Amount */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="buy-amount" className="text-[12px] font-medium text-zinc-400">
            Amount to spend
          </label>
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <span>
              Balance: <span className="tabular text-zinc-300">{formatEth(ethBalance, 5)} ETH</span>
            </span>
            {maxSpendable !== undefined && maxSpendable > 0n ? (
              <button
                type="button"
                onClick={() => setInput(formatInputAmount(maxSpendable))}
                className="rounded-md bg-white/[0.07] px-1.5 py-0.5 font-semibold text-zinc-300 transition-colors hover:bg-white/[0.12]"
              >
                MAX
              </button>
            ) : null}
          </div>
        </div>
        <div className="relative">
          <input
            id="buy-amount"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            placeholder="0.0"
            value={input}
            onChange={(event) => setInput(event.target.value.replace(/[^\d.]/g, ""))}
            className="h-14 w-full rounded-xl border border-white/10 bg-white/[0.03] pl-4 pr-16 text-lg font-semibold text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-400/40 focus:outline-none focus:ring-1 focus:ring-emerald-400/30"
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-zinc-500">
            ETH
          </span>
        </div>
      </div>

      <SlippageSelector value={slippageBps} onChange={setSlippageBps} disabled={buy.isBusy} />

      {/* Estimate */}
      <div
        className="flex flex-col gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3"
        data-testid="buy-estimate"
        data-raw-quote-in={parsed?.ok ? parsed.value.toString() : ""}
        data-raw-tokens-out={quote ? quote.tokensOut.toString() : ""}
        data-raw-min-tokens-out={quote && quote.tokensOut > 0n ? minTokensOut.toString() : ""}
        data-raw-fee={quote ? quote.fee.toString() : ""}
        data-raw-creator-tax={quote ? quote.creatorTax.toString() : ""}
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500">
            <TrendingUp className="size-3.5" aria-hidden />
            You receive (estimate)
          </span>
          <span className="tabular text-right text-sm font-semibold text-emerald-300">
            {quote ? formatTokenAmount(quote.tokensOut, token.decimals, 5) : "—"}
            <span className="ml-1 text-[11px] font-normal text-zinc-500">{token.symbol}</span>
          </span>
        </div>

        <LabelValue
          label={`Minimum after ${slippageLabel(slippageBps)} slippage`}
          value={
            quote && quote.tokensOut > 0n
              ? `${formatTokenAmount(minTokensOut, token.decimals, 5)} ${token.symbol}`
              : "—"
          }
        />
        <LabelValue
          label={`Curve fee (${formatBpsPercent(token.feeBps)})`}
          value={quote ? `${formatEth(quote.fee, 6)} ETH` : "—"}
        />
        <LabelValue
          label={`Creator tax (${formatBpsPercent(token.creatorTaxBps)})`}
          value={quote ? `${formatEth(quote.creatorTax, 6)} ETH` : "—"}
        />
        <LabelValue
          label="Priced against the curve"
          value={quote ? `${formatEth(quote.net, 6)} ETH` : "—"}
          title="quoteIn minus the curve fee and creator tax"
        />
        <LabelValue
          label="Your token balance"
          value={
            token.userTokenBalance === null
              ? "Connect to view"
              : `${formatTokenAmount(token.userTokenBalance, token.decimals, 5)} ${token.symbol}`
          }
        />
      </div>

      {/* Transaction feedback */}
      {buy.phase === "rejected" ? (
        <Alert tone="warning" title="Transaction rejected in your wallet">
          Nothing was sent. You can adjust the amount or slippage and try again.
        </Alert>
      ) : null}

      {buy.phase === "awaiting-wallet" ? (
        <Alert tone="info" title="Confirm in wallet">
          Approve the transaction in MetaMask to send it.
        </Alert>
      ) : null}

      {buy.phase === "pending" && buy.hash ? (
        <Alert
          tone="info"
          title="Transaction submitted"
          action={
            <a
              href={explorerTxUrl(buy.hash)}
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

      {buy.phase === "success" ? (
        <Alert
          tone="success"
          title="Purchase confirmed"
          action={
            buy.hash ? (
              <a
                href={explorerTxUrl(buy.hash)}
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
          {buy.result
            ? `You received ${formatTokenAmount(buy.result.tokensOut, token.decimals, 6)} ${token.symbol}${
                buy.result.fromBalanceDelta ? " (from your balance change)" : ""
              }.`
            : `The buy was confirmed. Balances and curve data refresh automatically.`}
        </Alert>
      ) : null}

      {buy.phase === "reverted" || buy.phase === "failed" ? (
        <Alert tone="error" title={buy.error?.title ?? "Transaction failed"}>
          {buy.error?.message ?? "The transaction could not be completed."}
          {buy.hash ? (
            <>
              {" "}
              <a
                href={explorerTxUrl(buy.hash)}
                target="_blank"
                rel="noreferrer noopener"
                className="font-semibold underline decoration-dotted"
              >
                View on explorer
              </a>
            </>
          ) : null}
        </Alert>
      ) : null}

      {blockers.length > 0 && buy.phase !== "rejected" && buy.phase !== "reverted" && buy.phase !== "failed" ? (
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
        variant="primary"
        size="lg"
        block
        onClick={handlePrimary}
        loading={buy.isBusy}
        disabled={!canSubmit}
      >
        {buttonLabel}
      </Button>

      <p className="text-center text-[11px] leading-relaxed text-zinc-600">
        The estimate uses the curve formula and rounds down. The final amount comes from the CurveBuy event on the
        receipt, so it can differ slightly.
      </p>
    </div>
  );
}
