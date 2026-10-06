"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

type TokenLogoProps = {
  /** Raw `logo()` value. Empty string for every sample token. */
  src?: string;
  symbol: string;
  className?: string;
};

function isLoadableUrl(value: string): boolean {
  const trimmed = value.trim();
  return /^(https?:|data:image\/)/i.test(trimmed);
}

function LogoFallback({ symbol }: { symbol: string }) {
  return (
    <span
      aria-hidden
      className="flex size-full items-center justify-center bg-gradient-to-br from-emerald-500/25 via-teal-500/15 to-sky-500/20 text-[0.95em] font-bold uppercase text-emerald-200"
    >
      {symbol.trim().slice(0, 3) || "?"}
    </span>
  );
}

/**
 * The image itself, keyed by `src` from the parent so a new logo URL remounts
 * this component and resets the load state without an effect.
 */
function LogoImage({ src, symbol }: { src: string; symbol: string }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (failed) return <LogoFallback symbol={symbol} />;

  return (
    <>
      {/* Remote logos are arbitrary URLs, so next/image would need a wildcard
          remotePatterns entry; a plain img keeps that surface closed. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`${symbol} logo`}
        className={cn("size-full object-cover transition-opacity", loaded ? "opacity-100" : "opacity-0")}
        loading="lazy"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
      {!loaded ? (
        <span className="absolute inset-0">
          <LogoFallback symbol={symbol} />
        </span>
      ) : null}
    </>
  );
}

/**
 * Token logo with a graceful placeholder.
 *
 * Covers the three cases the brief calls out: no logo string, a logo URL that
 * fails to load, and a usable logo.
 */
export function TokenLogo({ src, symbol, className }: TokenLogoProps) {
  const usable = Boolean(src) && isLoadableUrl(src ?? "");

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.04]",
        className,
      )}
    >
      {usable ? <LogoImage key={src} src={src as string} symbol={symbol} /> : <LogoFallback symbol={symbol} />}
    </span>
  );
}
