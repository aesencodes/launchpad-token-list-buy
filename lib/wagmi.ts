import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { robinhoodTestnet } from "@/lib/chain";

/**
 * wagmi config for a single-chain app.
 *
 * - `injected()` targets `window.ethereum`, which is MetaMask in the browsers
 *   this test is assessed in.
 * - `multiInjectedProviderDiscovery` is off so the UI shows exactly one
 *   connect button instead of one per EIP-6963 announcement.
 * - `ssr: true` keeps the server render and the first client render identical
 *   (disconnected), which avoids hydration mismatches; wagmi reconnects right
 *   after mount.
 */
export const wagmiConfig = createConfig({
  chains: [robinhoodTestnet],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [robinhoodTestnet.id]: http(robinhoodTestnet.rpcUrls.default.http[0]),
  },
  multiInjectedProviderDiscovery: false,
  ssr: true,
});
