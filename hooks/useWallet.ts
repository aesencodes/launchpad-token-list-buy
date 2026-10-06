"use client";

import { useChains, useConnect, useConnection, useConnectors, useDisconnect, useSwitchChain } from "wagmi";
import { useCallback, useMemo, useState } from "react";
import { robinhoodTestnet } from "@/lib/chain";
import { describeError, type FriendlyError } from "@/lib/errors";
import { useIsMounted } from "@/hooks/useIsMounted";

export type WalletState = {
  mounted: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  address: `0x${string}` | undefined;
  chainId: number | undefined;
  /** Connected wallet is on Robinhood Chain Testnet. */
  isSupportedChain: boolean;
  /** True when at least one injected provider is available. */
  hasInjectedProvider: boolean;
  connectorName: string | undefined;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToRobinhood: () => Promise<void>;
  /** `false` while the chain is outside the wagmi config (also true before mount). */
  canSwitchChain: boolean;
  isSwitchingChain: boolean;
  connectError: FriendlyError | null;
  switchError: FriendlyError | null;
};

/**
 * Single place that owns connection state, chain state and the
 * switch/add-network action.
 *
 * `useSwitchChain` goes through the injected connector, which performs
 * `wallet_switchEthereumChain` and, on error 4902 (network unknown to the
 * wallet), falls back to `wallet_addEthereumChain` using the chain definition
 * from `lib/chain.ts` — so "add the network" and "switch the network" are the
 * same button.
 */
export function useWallet(): WalletState {
  const mounted = useIsMounted();
  const connection = useConnection();
  const { connectAsync } = useConnect();
  /**
   * The chain the *wallet* is on, read from the connection.
   *
   * `useChainId()` is not that value: it returns the wagmi config's chain, and
   * in this single-chain config the config only follows the connection when the
   * reported chain is itself configured (`createConfig`'s `syncConnectedChain`
   * subscriber bails out otherwise). So a wallet sitting on another network
   * left `useChainId()` reading `46630` and this hook reporting a supported
   * chain — the wrong-network banner never rendered and a write went to
   * whatever chain the wallet was really on. The connection carries the live
   * wallet chain, and `change` events keep it current after a switch.
   */
  const chainId = connection.chainId;
  const chains = useChains();
  const connectors = useConnectors();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();

  const [connectError, setConnectError] = useState<FriendlyError | null>(null);
  const [switchError, setSwitchError] = useState<FriendlyError | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const connector = connectors[0];

  const connect = useCallback(async () => {
    setConnectError(null);
    if (!connector) {
      setConnectError({
        kind: "unknown",
        title: "No wallet found",
        message:
          "No injected wallet was detected. Install MetaMask in a Chromium browser, then reload this page.",
      });
      return;
    }
    setIsConnecting(true);
    try {
      // The connector comes from `useConnectors`, so it is a concrete injected
      // connector; the cast keeps this wrapper usable from one button.
      await connectAsync({ connector } as Parameters<typeof connectAsync>[0]);
    } catch (error) {
      setConnectError(describeError(error));
    } finally {
      setIsConnecting(false);
    }
  }, [connector, connectAsync]);

  const switchToRobinhood = useCallback(async () => {
    setSwitchError(null);
    try {
      await switchChainAsync({ chainId: robinhoodTestnet.id });
    } catch (error) {
      setSwitchError(describeError(error));
    }
  }, [switchChainAsync]);

  const switchable = useMemo(
    () => chains.some((chain) => chain.id === robinhoodTestnet.id) && mounted,
    [chains, mounted],
  );

  return {
    mounted,
    isConnected: mounted && connection.isConnected,
    isConnecting: isConnecting || connection.isConnecting,
    address: connection.address,
    chainId: mounted ? chainId : undefined,
    isSupportedChain: mounted && connection.isConnected && chainId === robinhoodTestnet.id,
    hasInjectedProvider: connectors.length > 0,
    connectorName: connector?.name,
    connect,
    disconnect: () => {
      setConnectError(null);
      setSwitchError(null);
      disconnect();
    },
    switchToRobinhood,
    canSwitchChain: switchable,
    isSwitchingChain,
    connectError,
    switchError,
  };
}
