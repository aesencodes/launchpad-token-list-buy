"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { parseEventLogs, type Address, type TransactionReceipt } from "viem";
import { usePublicClient } from "wagmi";
import { bondingCurveAbi } from "@/lib/abi/bondingCurve";
import { launcherTokenAbi } from "@/lib/abi/launcherToken";
import { useContractWrite, type ContractWriteState } from "@/hooks/useContractWrite";

export type BuyParams = {
  curve: Address;
  token: Address;
  /** Exact wei to spend; also sent as `msg.value`. */
  quoteIn: bigint;
  minTokensOut: bigint;
  recipient: Address;
};

export type BuyResult = {
  quoteIn: bigint;
  /** Tokens actually received. */
  tokensOut: bigint;
  /** `true` when the `CurveBuy` event was missing and the balance delta was used. */
  fromBalanceDelta: boolean;
};

/**
 * Authoritative result of a mined buy: the `CurveBuy` event the curve emitted,
 * matched to this curve and recipient. `quoteIn` there is what was actually
 * spent, which can be less than requested on a partial fill.
 */
export function curveBuyFromReceipt(
  receipt: TransactionReceipt,
  params: BuyParams,
): { tokensOut: bigint; quoteIn: bigint } | undefined {
  const decoded = parseEventLogs({
    abi: bondingCurveAbi,
    eventName: "CurveBuy",
    logs: receipt.logs,
  });
  const match = decoded.find(
    (log) =>
      log.address.toLowerCase() === params.curve.toLowerCase() &&
      log.args.recipient?.toLowerCase() === params.recipient.toLowerCase(),
  );
  if (!match?.args) return undefined;
  return { tokensOut: match.args.tokensOut, quoteIn: match.args.quoteIn };
}

export type BuyTokenState = ContractWriteState & {
  buy: (params: BuyParams) => Promise<BuyResult | undefined>;
  /** Set once a buy is mined successfully. */
  result: BuyResult | undefined;
};

/**
 * Buys from a bonding curve and, on success, invalidates the query cache so
 * the token list, the buy form and the wallet balances all re-read the new
 * on-chain state without a page reload.
 */
export function useBuyToken(): BuyTokenState {
  const tx = useContractWrite();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const [result, setResult] = useState<BuyResult>();

  const { reset: resetTx, send } = tx;

  const readBalance = useCallback(
    async (token: Address, owner: Address) => {
      if (!publicClient) return undefined;
      try {
        return await publicClient.readContract({
          address: token,
          abi: launcherTokenAbi,
          functionName: "balanceOf",
          args: [owner],
        });
      } catch {
        return undefined;
      }
    },
    [publicClient],
  );

  const buy = useCallback(
    async (params: BuyParams) => {
      setResult(undefined);
      resetTx();

      // Snapshot for the balance-delta fallback, in case the event is missing.
      const balanceBefore = await readBalance(params.token, params.recipient);

      const receipt = await send({
        address: params.curve,
        abi: bondingCurveAbi,
        functionName: "buy",
        args: [params.quoteIn, params.minTokensOut, params.recipient],
        // `msg.value` must equal `quoteIn` exactly (NativeValueMismatch otherwise).
        value: params.quoteIn,
      });

      if (!receipt || receipt.status !== "success") return undefined;

      const fromEvent = curveBuyFromReceipt(receipt, params);
      let buyResult: BuyResult | undefined;
      if (fromEvent) {
        buyResult = { quoteIn: fromEvent.quoteIn, tokensOut: fromEvent.tokensOut, fromBalanceDelta: false };
      } else {
        const after = await readBalance(params.token, params.recipient);
        if (after !== undefined && balanceBefore !== undefined && after >= balanceBefore) {
          buyResult = { quoteIn: params.quoteIn, tokensOut: after - balanceBefore, fromBalanceDelta: true };
        }
      }

      setResult(buyResult);
      await queryClient.invalidateQueries();
      return buyResult;
    },
    [queryClient, readBalance, resetTx, send],
  );

  return { ...tx, buy, result };
}
