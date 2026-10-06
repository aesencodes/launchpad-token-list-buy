"use client";

import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import type { Address, ContractFunctionParameters } from "viem";
import { launchFactoryAbi } from "@/lib/abi/launchFactory";
import { bondingCurveAbi } from "@/lib/abi/bondingCurve";
import { launcherTokenAbi } from "@/lib/abi/launcherToken";
import { CONTRACTS, MULTICALL_BATCH_SIZE } from "@/lib/contracts";
import { graduationProgressBps, spotPriceWeiPerToken } from "@/lib/bondingCurve";
import type { Launch } from "@/lib/launchpad";
import type { TokenSummary } from "@/lib/tokens";

/**
 * Per-token field order inside the flat multicall array.
 * One stride per token keeps the mapping from result index back to
 * (token, field) trivial, and keeps the array shape stable when the wallet
 * connects or disconnects.
 */
const FIELDS = [
  "name",
  "symbol",
  "logo",
  "decimals",
  "description",
  "reserves",
  "realQuoteReserve",
  "graduationThreshold",
  "readyToGraduate",
  "feeBps",
  "creatorTaxBps",
  "launchedToken",
  "balanceOf",
] as const;

const STRIDE = FIELDS.length;

const ZERO = "0x0000000000000000000000000000000000000000" as Address;

export const tokenDetailsQueryKey = (tokens: readonly string[], owner?: Address) =>
  ["token-details", tokens, owner ?? null] as const;

type MulticallResult = { status: "success"; result: unknown } | { status: "failure"; error: Error };

function successValue<T>(results: readonly MulticallResult[], index: number): T | undefined {
  const entry = results[index];
  if (!entry || entry.status !== "success") return undefined;
  return entry.result as T;
}

/**
 * Reads every token's metadata, curve state, factory record and (when a wallet
 * is connected) the user's balance, through Multicall3 with `allowFailure` so
 * one broken token cannot take the whole list down.
 */
export function useTokenDetails(
  launches: readonly Launch[],
  owner: Address | undefined,
  refetchInterval = 15_000,
) {
  const contracts = useMemo<ContractFunctionParameters[]>(() => {
    const list: ContractFunctionParameters[] = [];
    for (const launch of launches) {
      // Field order must stay in lockstep with FIELDS / STRIDE.
      list.push({ address: launch.token, abi: launcherTokenAbi, functionName: "name" });
      list.push({ address: launch.token, abi: launcherTokenAbi, functionName: "symbol" });
      list.push({ address: launch.token, abi: launcherTokenAbi, functionName: "logo" });
      list.push({ address: launch.token, abi: launcherTokenAbi, functionName: "decimals" });
      list.push({ address: launch.token, abi: launcherTokenAbi, functionName: "description" });
      list.push({ address: launch.curve, abi: bondingCurveAbi, functionName: "getReserves" });
      list.push({ address: launch.curve, abi: bondingCurveAbi, functionName: "realQuoteReserve" });
      list.push({ address: launch.curve, abi: bondingCurveAbi, functionName: "graduationThreshold" });
      list.push({ address: launch.curve, abi: bondingCurveAbi, functionName: "readyToGraduate" });
      list.push({ address: launch.curve, abi: bondingCurveAbi, functionName: "feeBps" });
      list.push({ address: launch.curve, abi: bondingCurveAbi, functionName: "creatorTaxBps" });
      list.push({
        address: CONTRACTS.launchFactory,
        abi: launchFactoryAbi,
        functionName: "getLaunchedToken",
        args: [launch.token],
      });
      list.push({
        address: launch.token,
        abi: launcherTokenAbi,
        functionName: "balanceOf",
        args: [owner ?? ZERO],
      });
    }
    return list;
  }, [launches, owner]);

  const query = useReadContracts({
    contracts,
    allowFailure: true,
    batchSize: MULTICALL_BATCH_SIZE,
    query: {
      enabled: launches.length > 0,
      refetchInterval,
      placeholderData: (previous) => previous,
      retry: 2,
      retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 8_000),
    },
  });

  const tokens = useMemo<TokenSummary[]>(() => {
    const raw = (query.data ?? []) as readonly MulticallResult[];
    if (raw.length === 0) return [];

    // `placeholderData` keeps the previous result while a wider multicall is in
    // flight, so a just-discovered token can briefly have no results yet. Only
    // render tokens whose results are actually present.
    const ready = Math.min(launches.length, Math.floor(raw.length / STRIDE));

    return launches.slice(0, ready).map((launch, index) => {
      const base = index * STRIDE;
      const failedReads: string[] = [];
      const read = <T,>(field: (typeof FIELDS)[number], fallback: T): T => {
        const value = successValue<T>(raw, base + FIELDS.indexOf(field));
        if (value === undefined) {
          failedReads.push(field);
          return fallback;
        }
        return value;
      };

      const reserves = successValue<readonly [bigint, bigint]>(raw, base + FIELDS.indexOf("reserves"));
      if (!reserves) failedReads.push("reserves");
      const quoteReserve = reserves?.[0] ?? null;
      const tokenReserve = reserves?.[1] ?? null;

      const realQuoteReserve = read("realQuoteReserve", 0n);
      // The event carries the threshold too; the curve read is authoritative
      // but fall back to the event so progress still renders.
      const graduationThreshold = read("graduationThreshold", launch.graduationThreshold);

      const launched = successValue<{ phase: number | bigint; creatorFeeRecipient: Address }>(
        raw,
        base + FIELDS.indexOf("launchedToken"),
      );
      if (!launched) failedReads.push("launchedToken");

      const balanceOfRaw = successValue<bigint>(raw, base + FIELDS.indexOf("balanceOf"));
      if (balanceOfRaw === undefined) failedReads.push("balanceOf");

      return {
        launch,
        name: read("name", "Unknown token"),
        symbol: read("symbol", "?"),
        logo: read("logo", ""),
        description: read("description", ""),
        decimals: read("decimals", 18),
        phase: Number(launched?.phase ?? 0),
        creatorFeeRecipient: launched?.creatorFeeRecipient ?? ZERO,
        quoteReserve,
        tokenReserve,
        realQuoteReserve,
        graduationThreshold,
        // A failed read defaults to `false` (tradeable), which is the pre-existing
        // behaviour: the receipt-time `CurveGraduated` translation still applies.
        readyToGraduate: read("readyToGraduate", false),
        feeBps: read("feeBps", 0n),
        creatorTaxBps: read("creatorTaxBps", 0n),
        priceWeiPerToken: spotPriceWeiPerToken(quoteReserve ?? 0n, tokenReserve ?? 0n, 18),
        progressBps: graduationProgressBps(realQuoteReserve, graduationThreshold),
        userTokenBalance: owner && balanceOfRaw !== undefined ? balanceOfRaw : null,
        complete: failedReads.length === 0,
        failedReads,
      };
    });
  }, [launches, owner, query.data]);

  return {
    tokens,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: () => void query.refetch(),
    dataUpdatedAt: query.dataUpdatedAt,
  };
}
