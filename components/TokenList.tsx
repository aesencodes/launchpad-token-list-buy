"use client";

import { useMemo, useState } from "react";
import { RefreshCw, Search, TriangleAlert } from "lucide-react";
import type { TokenSummary } from "@/lib/tokens";
import { TokenCard } from "@/components/TokenCard";
import { Button, Card, Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";

type SortKey = "newest" | "progress" | "price-asc" | "name";

const SORT_LABELS: Record<SortKey, string> = {
  newest: "Newest",
  progress: "Closest to graduation",
  "price-asc": "Lowest price",
  name: "Name (A–Z)",
};

export type TokenListProps = {
  tokens: TokenSummary[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  selectedToken: string | undefined;
  onSelect: (token: TokenSummary) => void;
  lastUpdated: number;
  scannedTo: bigint | null;
};

export function TokenList({
  tokens,
  isLoading,
  isFetching,
  isError,
  onRetry,
  selectedToken,
  onSelect,
  lastUpdated,
  scannedTo,
}: TokenListProps) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? tokens.filter(
          (token) =>
            token.name.toLowerCase().includes(needle) ||
            token.symbol.toLowerCase().includes(needle) ||
            token.launch.token.toLowerCase().includes(needle),
        )
      : tokens;

    const sorted = [...filtered];
    switch (sort) {
      case "progress":
        sorted.sort((a, b) => (a.progressBps === b.progressBps ? 0 : a.progressBps > b.progressBps ? -1 : 1));
        break;
      case "price-asc":
        sorted.sort((a, b) => {
          if (a.priceWeiPerToken === null) return 1;
          if (b.priceWeiPerToken === null) return -1;
          return a.priceWeiPerToken === b.priceWeiPerToken ? 0 : a.priceWeiPerToken < b.priceWeiPerToken ? -1 : 1;
        });
        break;
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "newest":
      default:
        // Already newest-first from discovery; keep that order stable.
        break;
    }
    return sorted;
  }, [tokens, query, sort]);

  const showFirstLoad = isLoading && tokens.length === 0;
  const showError = isError && tokens.length === 0;
  const showEmpty = !isLoading && !isError && tokens.length === 0;

  return (
    <section aria-labelledby="token-list-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="token-list-heading" className="text-lg font-semibold text-zinc-100">
            Launched tokens
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            {tokens.length > 0 ? `${tokens.length} token${tokens.length === 1 ? "" : "s"} discovered from TokenLaunched events` : "Discovered from TokenLaunched events"}
            {scannedTo !== null && showFirstLoad ? ` · scanning up to block ${scannedTo}` : null}
            {lastUpdated && !showFirstLoad ? ` · updated ${new Date(lastUpdated).toLocaleTimeString()}` : null}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-56 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, symbol, address"
              aria-label="Search tokens"
              className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.03] pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-400/40 focus:outline-none focus:ring-1 focus:ring-emerald-400/30"
            />
          </div>

          <label className="sr-only" htmlFor="token-sort">
            Sort tokens
          </label>
          <select
            id="token-sort"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className="h-10 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-zinc-200 focus:border-emerald-400/40 focus:outline-none"
          >
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value} className="bg-zinc-900">
                {label}
              </option>
            ))}
          </select>

          <Button
            type="button"
            size="md"
            variant="secondary"
            onClick={onRetry}
            aria-label="Refresh token list"
            title="Refresh token list"
            className="px-3"
          >
            <RefreshCw className={cn("size-4", isFetching && "animate-spin")} aria-hidden />
          </Button>
        </div>
      </div>

      {showError ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-rose-500/15 text-rose-300">
            <TriangleAlert className="size-5" aria-hidden />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Could not load the token list</h3>
            <p className="mx-auto mt-1 max-w-sm text-[13px] text-zinc-500">
              The launch events could not be read from the RPC. Check your connection and try again.
            </p>
          </div>
          <Button type="button" variant="primary" onClick={onRetry} loading={isFetching}>
            Try again
          </Button>
        </Card>
      ) : null}

      {showFirstLoad ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="flex flex-col gap-3 p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="size-11 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-1.5 w-full rounded-full" />
              <Skeleton className="h-8 w-full" />
            </Card>
          ))}
        </div>
      ) : null}

      {showEmpty ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-white/[0.06] text-zinc-400">
            <Search className="size-5" aria-hidden />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">No tokens launched yet</h3>
            <p className="mx-auto mt-1 max-w-sm text-[13px] text-zinc-500">
              The factory has not emitted a TokenLaunched event in the scanned range. Launch one from the panel below, or
              refresh to re-scan.
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={onRetry} loading={isFetching}>
            Re-scan
          </Button>
        </Card>
      ) : null}

      {!showFirstLoad && !showEmpty && !showError && visible.length === 0 && tokens.length > 0 ? (
        <Card className="px-6 py-10 text-center">
          <p className="text-sm font-medium text-zinc-200">No token matches “{query}”</p>
          <p className="mt-1 text-[13px] text-zinc-500">Try a different name, symbol or address.</p>
        </Card>
      ) : null}

      {visible.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((token) => (
            <TokenCard
              key={token.launch.token}
              token={token}
              selected={selectedToken?.toLowerCase() === token.launch.token.toLowerCase()}
              onSelect={() => onSelect(token)}
              pairTokenIsNative={
                token.launch.pairToken === "0x0000000000000000000000000000000000000000"
              }
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
