"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { useState } from "react";
import { fetchLaunches, type Launch } from "@/lib/launchpad";

export const launchesQueryKey = ["token-launches"] as const;

export type TokenLaunchesState = {
  launches: Launch[];
  /** `true` only for the very first load (no data yet). */
  isLoading: boolean;
  /** Any fetch in flight, including background polls. */
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
  /** Highest block scanned by the most recent chunk, for a progress hint. */
  scannedTo: bigint | null;
  dataUpdatedAt: number;
};

/**
 * Discovers launched tokens from `TokenLaunched` logs.
 *
 * Polls on an interval so tokens launched after the page opened appear without
 * a reload, and exposes `refetch` for the manual refresh button.
 */
export function useTokenLaunches(refetchInterval = 20_000): TokenLaunchesState {
  const publicClient = usePublicClient();
  const [scannedTo, setScannedTo] = useState<bigint | null>(null);

  const query = useQuery({
    queryKey: launchesQueryKey,
    enabled: Boolean(publicClient),
    queryFn: async () => {
      if (!publicClient) return [];
      return fetchLaunches(publicClient, {
        onProgress: (block) => setScannedTo(block),
      });
    },
    refetchInterval,
    // Log scanning is cheap enough to poll, but a background poll should not
    // wipe the table; keep the previous data visible while it runs.
    placeholderData: (previous) => previous,
    retry: 2,
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 8_000),
  });

  return {
    launches: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: () => void query.refetch(),
    scannedTo,
    dataUpdatedAt: query.dataUpdatedAt,
  };
}
