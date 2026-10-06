"use client";

import { AlertTriangle, Info } from "lucide-react";
import { robinhoodTestnet } from "@/lib/chain";
import type { WalletState } from "@/hooks/useWallet";
import { Alert, Button } from "@/components/ui";

/**
 * Guides the user onto Robinhood Chain Testnet.
 *
 * The switch button also *adds* the network, because MetaMask does not ship
 * with chain 46630: wagmi's injected connector falls back to
 * `wallet_addEthereumChain` when `wallet_switchEthereumChain` returns 4902.
 *
 * `data-testid="network-banner"` / `"switch-network"` are the contract
 * `scripts/check-wallet.mjs` drives the browser against.
 */
export function NetworkBanner({ wallet }: { wallet: WalletState }) {
  if (!wallet.mounted) return null;

  if (!wallet.hasInjectedProvider && !wallet.isConnected) {
    return (
      <Alert tone="warning" title="No browser wallet detected" className="mb-4">
        Install <span className="font-medium">MetaMask</span> (or another injected wallet) in a Chromium browser, then
        reload this page to connect.
      </Alert>
    );
  }

  if (wallet.isConnected && !wallet.isSupportedChain) {
    return (
      <Alert
        tone="warning"
        title={`Wrong network — your wallet is on chain ${wallet.chainId ?? "unknown"}`}
        className="mb-4"
        data-testid="network-banner"
        action={
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={wallet.switchToRobinhood}
            loading={wallet.isSwitchingChain}
            disabled={!wallet.canSwitchChain}
            data-testid="switch-network"
          >
            Switch to {robinhoodTestnet.name}
          </Button>
        }
      >
        {wallet.switchError
          ? wallet.switchError.message
          : `Switch to ${robinhoodTestnet.name} (chain ${robinhoodTestnet.id}) to trade. If MetaMask does not know the network yet, this button adds it too.`}
      </Alert>
    );
  }

  if (wallet.connectError) {
    return (
      <Alert tone="warning" title={wallet.connectError.title} className="mb-4">
        {wallet.connectError.message}
      </Alert>
    );
  }

  return (
    <p className="mb-4 hidden items-center gap-1.5 text-[11px] text-zinc-500 sm:flex">
      <Info className="size-3.5 text-zinc-600" aria-hidden />
      Connected to {robinhoodTestnet.name} · chain {robinhoodTestnet.id} · ETH
      <AlertTriangle className="ml-1 size-3 text-amber-400/70" aria-hidden />
      testnet only, no real value
    </p>
  );
}
