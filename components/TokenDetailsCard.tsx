"use client";

import { ExternalLink, Globe, MessageCircle, Send, Bird } from "lucide-react";
import { useReadContract } from "wagmi";
import type { ReactNode } from "react";
import { launcherTokenAbi } from "@/lib/abi/launcherToken";
import { explorerAddressUrl } from "@/lib/chain";
import { NATIVE_PAIR_TOKEN } from "@/lib/contracts";
import { formatBpsPercent, formatEth, shortenAddress } from "@/lib/format";
import type { TokenSummary } from "@/lib/tokens";
import { LabelValue } from "@/components/ui";

function AddressRow({ label, address }: { label: string; address: string }) {
  return (
    <LabelValue
      label={label}
      value={
        <a
          href={explorerAddressUrl(address)}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 font-mono text-[11px] underline decoration-dotted hover:text-emerald-300"
        >
          {shortenAddress(address, 6)}
          <ExternalLink className="size-3" aria-hidden />
        </a>
      }
    />
  );
}

function SocialLink({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      title={label}
      aria-label={label}
      className="inline-flex size-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-zinc-400 transition-colors hover:border-emerald-400/40 hover:text-emerald-300"
    >
      {icon}
    </a>
  );
}

/**
 * Reference data for the selected token: description, creator, socials and the
 * contract addresses, all read from the token contract. Read lazily so it only
 * costs RPC calls while a token is actually selected.
 */
export function TokenDetailsCard({ token }: { token: TokenSummary }) {
  const socials = useReadContract({
    address: token.launch.token,
    abi: launcherTokenAbi,
    functionName: "socials",
    query: { retry: false, staleTime: 60_000 },
  });

  const [twitter, telegram, discord, website, farcaster] = socials.data ?? ["", "", "", "", ""];
  const links: Array<{ href: string; icon: ReactNode; label: string }> = [];
  if (twitter) links.push({ href: twitter, icon: <Bird className="size-3.5" />, label: "Twitter / X" });
  if (telegram) links.push({ href: telegram, icon: <Send className="size-3.5" />, label: "Telegram" });
  if (discord) links.push({ href: discord, icon: <MessageCircle className="size-3.5" />, label: "Discord" });
  if (website) links.push({ href: website, icon: <Globe className="size-3.5" />, label: "Website" });
  if (farcaster) links.push({ href: farcaster, icon: <Globe className="size-3.5" />, label: "Farcaster" });

  const isNative = token.launch.pairToken === NATIVE_PAIR_TOKEN;

  return (
    <div className="flex flex-col gap-3">
      {token.description ? (
        <p className="text-[13px] leading-relaxed text-zinc-400">{token.description}</p>
      ) : (
        <p className="text-[13px] italic text-zinc-600">No description on the token contract.</p>
      )}

      {links.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {links.map((link) => (
            <SocialLink key={link.label} {...link} />
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3">
        <LabelValue
          label="Creator"
          value={
            <span className="font-mono text-[11px]">{shortenAddress(token.creatorFeeRecipient, 6)}</span>
          }
          title={token.creatorFeeRecipient}
        />
        <LabelValue
          label="Deployer"
          value={<span className="font-mono text-[11px]">{shortenAddress(token.launch.deployer, 6)}</span>}
          title={token.launch.deployer}
        />
        <LabelValue label="Launch config" value={`#${token.launch.launchConfigId.toString()}`} />
        <LabelValue label="Pair asset" value={isNative ? "ETH (native)" : shortenAddress(token.launch.pairToken, 6)} />
        <LabelValue
          label="Graduation target"
          value={`${formatEth(token.graduationThreshold, 6)} ETH`}
        />
        <LabelValue label="Curve fee" value={formatBpsPercent(token.feeBps)} />
        <LabelValue label="Creator tax" value={formatBpsPercent(token.creatorTaxBps)} />
        <LabelValue label="Discovered in block" value={token.launch.blockNumber.toString()} />
        <AddressRow label="Token" address={token.launch.token} />
        <AddressRow label="Curve" address={token.launch.curve} />
      </div>
    </div>
  );
}
