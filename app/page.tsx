"use client";

import { useCallback, useMemo, useState } from "react";
import { Activity, Coins, Rocket, Sparkles } from "lucide-react";
import { useBalance, useReadContract } from "wagmi";
import { launchFactoryAbi } from "@/lib/abi/launchFactory";
import { robinhoodTestnet } from "@/lib/chain";
import { CONTRACTS } from "@/lib/contracts";
import { formatEth } from "@/lib/format";
import { useTokenDetails } from "@/hooks/useTokenDetails";
import { useTokenLaunches } from "@/hooks/useTokenLaunches";
import { setQueryParam, useQueryParam } from "@/hooks/useQueryParam";
import { useWallet } from "@/hooks/useWallet";
import { LaunchTokenForm } from "@/components/LaunchTokenForm";
import { NetworkBanner } from "@/components/NetworkBanner";
import { TokenList } from "@/components/TokenList";
import { TradePanel } from "@/components/TradePanel";
import { WalletBar } from "@/components/WalletBar";
import { Badge, Card, Stat } from "@/components/ui";

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
      {icon}
      {children}
    </h3>
  );
}

export default function LaunchpadPage() {
  const wallet = useWallet();
  const launches = useTokenLaunches();
  const details = useTokenDetails(launches.launches, wallet.address);
  const [selectedToken, setSelectedToken] = useState<string>();
  // `?token=0x…` deep-links straight to a token's trade panel.
  const linkedToken = useQueryParam("token");
  const activeTokenAddress = selectedToken === undefined ? linkedToken : selectedToken || undefined;

  // Step 1 requirement: read `launchFee()` from the factory and show it.
  const launchFee = useReadContract({
    address: CONTRACTS.launchFactory,
    abi: launchFactoryAbi,
    functionName: "launchFee",
    query: { refetchInterval: 60_000 },
  });

  // Read the ETH balance from Robinhood Chain Testnet explicitly, so the buy
  // form has the right number even when the wallet is on another network.
  const ethBalance = useBalance({
    address: wallet.address,
    chainId: robinhoodTestnet.id,
    query: { enabled: Boolean(wallet.address) },
  });

  const selected = useMemo(
    () =>
      details.tokens.find(
        (token) => token.launch.token.toLowerCase() === activeTokenAddress?.toLowerCase(),
      ),
    [details.tokens, activeTokenAddress],
  );

  const selectToken = useCallback((address: string | undefined) => {
    setSelectedToken(address ?? "");
    setQueryParam("token", address);
  }, []);

  const refresh = useCallback(() => {
    launches.refetch();
    details.refetch();
    void launchFee.refetch();
  }, [details, launchFee, launches]);

  const stats = useMemo(() => {
    const totalRaised = details.tokens.reduce((sum, token) => sum + token.realQuoteReserve, 0n);
    const onCurve = details.tokens.filter((token) => token.phase === 0).length;
    const graduated = details.tokens.filter((token) => token.phase === 2).length;
    return { totalRaised, onCurve, graduated };
  }, [details.tokens]);

  const listError = launches.isError || details.isError;

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col px-4 pb-16 pt-5 sm:px-6">
      {/* Header */}
      <header className="sticky top-0 z-40 -mx-4 mb-5 border-b border-white/[0.07] bg-[var(--page)]/85 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-emerald-950 shadow-lg shadow-emerald-500/20">
              <Rocket className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold leading-tight text-zinc-100">Launchpad</p>
              <p className="text-[11px] leading-tight text-zinc-500">Robinhood Chain Testnet · bonding curves</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-0 bg-white/[0.06] font-mono text-zinc-300 ring-white/10">
              launchFee {launchFee.isLoading && !launchFee.data ? "…" : `${formatEth(launchFee.data, 6)} ETH`}
            </Badge>
            <Badge className="border-0 bg-emerald-500/10 text-emerald-300 ring-emerald-500/20">
              <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden />
              chain {robinhoodTestnet.id}
            </Badge>
            <WalletBar wallet={wallet} />
          </div>
        </div>
      </header>

      <NetworkBanner wallet={wallet} />

      {/* Hero / stats */}
      <section className="mb-6 flex flex-col gap-4">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            Every token launched on the factory, straight from chain
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Tokens are discovered from <span className="font-mono text-zinc-300">TokenLaunched</span> logs — nothing is
            hardcoded, so a fresh launch shows up on its own. Each card reads its bonding curve live and lets you buy
            with ETH until it graduates.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="Tokens found"
            value={details.isLoading ? "…" : details.tokens.length}
            hint={launches.isFetching ? "re-scanning events…" : "from TokenLaunched"}
          />
          <Stat label="On the curve" value={details.isLoading ? "…" : stats.onCurve} hint="phase 0 · buyable" />
          <Stat label="Graduated" value={details.isLoading ? "…" : stats.graduated} hint="phase 2 · v4 pool" />
          <Stat
            label="Total ETH raised"
            value={`${formatEth(stats.totalRaised, 4)}`}
            hint="realQuoteReserve, all curves"
          />
        </div>
      </section>

      {/* Main two-column area */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        <TokenList
          tokens={details.tokens}
          isLoading={details.isLoading || (launches.isLoading && launches.launches.length === 0)}
          isFetching={details.isFetching || launches.isFetching}
          isError={listError}
          error={launches.error ?? details.error}
          onRetry={refresh}
          selectedToken={activeTokenAddress}
          onSelect={(token) => selectToken(token.launch.token)}
          lastUpdated={Math.max(launches.dataUpdatedAt, details.dataUpdatedAt)}
          scannedTo={launches.scannedTo}
        />

        <div className="lg:sticky lg:top-24 lg:self-start">
          <TradePanel
            key={selected?.launch.token ?? "none"}
            token={selected}
            wallet={wallet}
            ethBalance={ethBalance.data?.value}
            onClose={() => selectToken(undefined)}
            onRefresh={refresh}
          />
        </div>
      </div>

      {/* Bonus: launch a token */}
      <section className="mt-8 grid gap-4">
        <SectionTitle icon={<Sparkles className="size-3.5" aria-hidden />}>Bonus</SectionTitle>
        <LaunchTokenForm wallet={wallet} launchFee={launchFee.data} />
      </section>

      <footer className="mt-10 flex flex-col gap-3 border-t border-white/[0.07] pt-5 text-[11px] text-zinc-600">
        <div className="flex flex-wrap items-center gap-4">
          <SectionTitle icon={<Activity className="size-3.5" aria-hidden />}>How the numbers are produced</SectionTitle>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="p-3.5">
            <p className="font-semibold text-zinc-300">Discovery</p>
            <p className="mt-1 leading-relaxed">
              Trimmed <span className="font-mono">eth_getLogs</span> calls of 50 000 blocks each, from the factory deploy
              block, polled so new launches appear without a reload.
            </p>
          </Card>
          <Card className="p-3.5">
            <p className="font-semibold text-zinc-300">Per-token data</p>
            <p className="mt-1 leading-relaxed">
              Batched through Multicall3 <span className="font-mono">aggregate3</span> with{" "}
              <span className="font-mono">allowFailure</span>, so one broken token cannot blank the list.
            </p>
          </Card>
          <Card className="p-3.5">
            <p className="font-semibold text-zinc-300">Maths</p>
            <p className="mt-1 leading-relaxed">
              Every wei, reserve, fee and progress value is <span className="font-mono">bigint</span>, formatted only at
              the last step. The <span className="font-mono">CurveBuy</span> event on the receipt is the final word on
              what you received.
            </p>
          </Card>
        </div>
        <p className="flex items-center gap-2">
          <Coins className="size-3.5" aria-hidden />
          Testnet ETH only — no real value. Everything runs client-side against the public RPC.
        </p>
      </footer>
    </div>
  );
}
