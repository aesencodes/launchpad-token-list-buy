"use client";

import { useState } from "react";
import { Check, Copy, LogOut, Wallet } from "lucide-react";
import { useBalance } from "wagmi";
import { robinhoodTestnet } from "@/lib/chain";
import { formatEth, shortenAddress } from "@/lib/format";
import type { WalletState } from "@/hooks/useWallet";
import { Badge, Button } from "@/components/ui";
import { cn } from "@/lib/cn";

function CopyAddressButton({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(address);
          setCopied(true);
          setTimeout(() => setCopied(false), 1_500);
        } catch {
          setCopied(false);
        }
      }}
      className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-white/[0.07] hover:text-zinc-200"
      aria-label="Copy wallet address"
      title="Copy wallet address"
    >
      {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
    </button>
  );
}

/**
 * Connect / disconnect, the connected address, and its ETH balance.
 * The balance is read from Robinhood Chain Testnet explicitly, so it is the
 * right number even while the wallet is pointed at another network.
 */
export function WalletBar({ wallet, className }: { wallet: WalletState; className?: string }) {
  const balance = useBalance({
    address: wallet.address,
    chainId: robinhoodTestnet.id,
    query: { enabled: Boolean(wallet.address) },
  });

  if (!wallet.mounted) {
    // Keep the server render and first client render identical.
    return <div className={cn("h-10 w-40 animate-pulse rounded-xl bg-white/[0.05]", className)} aria-hidden />;
  }

  if (!wallet.isConnected || !wallet.address) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Button
          type="button"
          variant="primary"
          onClick={wallet.connect}
          loading={wallet.isConnecting}
          icon={<Wallet className="size-4" aria-hidden />}
          data-testid="connect-wallet"
        >
          Connect wallet
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* `data-testid` here and on the badge is the contract `scripts/check-wallet.mjs`
          drives the browser against; keep them in sync with that script. */}
      <div
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-1.5 pl-3 pr-1.5"
        data-testid="wallet-bar"
      >
        <span
          className={cn("size-2 rounded-full", wallet.isSupportedChain ? "bg-emerald-400" : "bg-amber-400")}
          aria-hidden
        />
        <span className="font-mono text-xs font-medium text-zinc-200">{shortenAddress(wallet.address, 4)}</span>
        <CopyAddressButton address={wallet.address} />
        <span className="mx-0.5 h-4 w-px bg-white/10" aria-hidden />
        <Badge className="border-0 bg-white/[0.06] text-zinc-200 ring-white/10" data-testid="wallet-balance">
          {balance.isLoading && !balance.data ? "…" : `${formatEth(balance.data?.value, 4)} ETH`}
        </Badge>
      </div>
      <Button
        type="button"
        variant="ghost"
        onClick={wallet.disconnect}
        aria-label="Disconnect wallet"
        title="Disconnect wallet"
        className="px-2.5"
      >
        <LogOut className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
