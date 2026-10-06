"use client";

import { useState } from "react";
import { ExternalLink, Rocket } from "lucide-react";
import { explorerAddressUrl, explorerTxUrl } from "@/lib/chain";
import { CONTRACTS } from "@/lib/contracts";
import { formatEth } from "@/lib/format";
import type { WalletState } from "@/hooks/useWallet";
import { useLaunchToken, withDefaultLaunchParams } from "@/hooks/useLaunchToken";
import { Alert, Button, Card, CardHeader, LabelValue } from "@/components/ui";

const NAME_MAX = 64;
const SYMBOL_MAX = 16;
const CREATOR_TAX_MAX_BPS = 1_000;

/**
 * Bonus: launch a token through `launchToken(TokenParams, uint256, address)`.
 *
 * `expectedEconomics` is read from `previewLaunchEconomics(1, address(0))` as
 * part of the same flow that sends the transaction, `value` is exactly
 * `launchFee()`, and a fresh random salt is generated per attempt.
 */
export function LaunchTokenForm({ wallet, launchFee }: { wallet: WalletState; launchFee: bigint | undefined }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("TEST");
  const [logo, setLogo] = useState("");
  const [description, setDescription] = useState("");
  const [creatorTaxPercent, setCreatorTaxPercent] = useState(0);
  const [buybackEnabled, setBuybackEnabled] = useState(false);
  const [configId, setConfigId] = useState("1");

  const launch = useLaunchToken();

  const nameValid = name.trim().length > 0 && name.trim().length <= NAME_MAX;
  const symbolValid = symbol.trim().length > 0 && symbol.trim().length <= SYMBOL_MAX;
  const configValid = /^\d+$/.test(configId.trim());
  const canSubmit = wallet.isConnected && wallet.isSupportedChain && nameValid && symbolValid && configValid;

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Rocket className="size-4 text-emerald-400" aria-hidden />
            Launch your own token
          </span>
        }
        subtitle="Bonus — optionally restricted by the factory's canLaunch() check."
        right={
          <Button
            type="button"
            size="sm"
            variant="secondary"
            data-testid="launch-token-toggle"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Hide" : "Open"}
          </Button>
        }
      />

      {open ? (
        <div className="flex flex-col gap-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-zinc-400">
                Name <span className="text-zinc-600">(max {NAME_MAX})</span>
              </span>
              <input
                value={name}
                maxLength={NAME_MAX}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your Full Name"
                className="h-10 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-400/40 focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-zinc-400">
                Ticker <span className="text-zinc-600">(max {SYMBOL_MAX})</span>
              </span>
              <input
                value={symbol}
                maxLength={SYMBOL_MAX}
                onChange={(event) => setSymbol(event.target.value)}
                placeholder="TEST"
                className="h-10 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm font-mono uppercase text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-400/40 focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-[12px] font-medium text-zinc-400">Logo URL (optional)</span>
              <input
                value={logo}
                onChange={(event) => setLogo(event.target.value)}
                placeholder="https://…"
                className="h-10 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-400/40 focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-[12px] font-medium text-zinc-400">Description (optional)</span>
              <textarea
                value={description}
                rows={2}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Short description stored on the token contract"
                className="resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-400/40 focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-zinc-400">
                Creator tax <span className="text-zinc-600">(0–{(CREATOR_TAX_MAX_BPS / 100).toFixed(0)}%)</span>
              </span>
              <input
                type="number"
                min={0}
                max={CREATOR_TAX_MAX_BPS / 100}
                step={0.1}
                value={creatorTaxPercent}
                onChange={(event) => setCreatorTaxPercent(Number(event.target.value))}
                className="h-10 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-zinc-100 focus:border-emerald-400/40 focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-zinc-400">
                Launch config id <span className="text-zinc-600">(1 = graduates at 0.042 ETH)</span>
              </span>
              <input
                value={configId}
                onChange={(event) => setConfigId(event.target.value)}
                inputMode="numeric"
                className="h-10 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-zinc-100 focus:border-emerald-400/40 focus:outline-none"
              />
            </label>

            <label className="flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                checked={buybackEnabled}
                onChange={(event) => setBuybackEnabled(event.target.checked)}
                className="size-4 accent-emerald-500"
              />
              <span className="text-[13px] text-zinc-300">Enable buyback-and-lock on the curve fee share</span>
            </label>
          </div>

          <div className="flex flex-col gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3">
            <LabelValue label="Launch fee (must be paid exactly)" value={`${formatEth(launchFee, 6)} ETH`} />
            <LabelValue label="Pair asset" value="ETH (native, address(0))" />
            <LabelValue
              label="Expected economics"
              value="read live from previewLaunchEconomics() right before sending"
            />
          </div>

          {launch.gateError ? (
            <Alert tone="warning" title={launch.gateError.title}>
              {launch.gateError.message}
            </Alert>
          ) : null}

          {launch.phase === "awaiting-wallet" ? (
            <Alert tone="info" title="Confirm in wallet">
              Approve the launch transaction in MetaMask. The fee is {formatEth(launchFee, 6)} ETH plus gas.
            </Alert>
          ) : null}

          {launch.phase === "pending" && launch.hash ? (
            <Alert
              tone="info"
              title="Launch submitted"
              action={
                <a
                  href={explorerTxUrl(launch.hash)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-[12px] font-semibold underline decoration-dotted"
                >
                  Explorer
                </a>
              }
            >
              Waiting for the launch to be mined…
            </Alert>
          ) : null}

          {launch.phase === "success" && launch.launched ? (
            <Alert tone="success" title="Token launched">
              <p>
                The new token appears in the list automatically — no code change needed. Token&nbsp;
                <a
                  href={explorerAddressUrl(launch.launched.token)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-mono font-semibold underline decoration-dotted"
                >
                  {launch.launched.token.slice(0, 10)}…
                </a>
                , curve&nbsp;
                <a
                  href={explorerAddressUrl(launch.launched.curve)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-mono font-semibold underline decoration-dotted"
                >
                  {launch.launched.curve.slice(0, 10)}…
                </a>
              </p>
            </Alert>
          ) : null}

          {launch.phase === "rejected" ? (
            <Alert tone="warning" title="Launch rejected in your wallet">
              Nothing was sent. Adjust the details and try again.
            </Alert>
          ) : null}

          {launch.phase === "reverted" || launch.phase === "failed" ? (
            <Alert tone="error" title={launch.error?.title ?? "Launch failed"}>
              {launch.error?.message ?? "The launch transaction could not be completed."}
              {launch.hash ? (
                <>
                  {" "}
                  <a
                    href={explorerTxUrl(launch.hash)}
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

          {!wallet.isConnected ? (
            <Alert tone="info" title="Wallet required">
              Connect your wallet on Robinhood Chain Testnet first.{" "}
              {wallet.hasInjectedProvider ? null : "No injected wallet was detected in this browser."}
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            {!wallet.isConnected ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => void wallet.connect()}
                loading={wallet.isConnecting}
              >
                Connect wallet
              </Button>
            ) : !wallet.isSupportedChain ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => void wallet.switchToRobinhood()}
                loading={wallet.isSwitchingChain}
              >
                Switch to Robinhood Chain Testnet
              </Button>
            ) : null}

            <Button
              type="button"
              variant="primary"
              onClick={() => {
                void launch.launch(
                  withDefaultLaunchParams({
                    name: name.trim(),
                    symbol: symbol.trim().toUpperCase(),
                    logo: logo.trim(),
                    description: description.trim(),
                    creatorTaxBps: Math.round(Math.max(0, Math.min(10, creatorTaxPercent)) * 100),
                    buybackEnabled,
                  }),
                  BigInt(configId.trim()),
                  { account: wallet.address },
                );
              }}
              loading={launch.isBusy || launch.isCheckingGate}
              disabled={!canSubmit}
              icon={<Rocket className="size-4" aria-hidden />}
            >
              {launch.phase === "awaiting-wallet"
                ? "Confirm in wallet…"
                : launch.phase === "pending"
                  ? "Launching…"
                  : "Launch token"}
            </Button>
            <a
              href={explorerAddressUrl(CONTRACTS.launchFactory)}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300"
            >
              Factory on explorer
              <ExternalLink className="size-3" aria-hidden />
            </a>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
