"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { parseEventLogs, type Address, type TransactionReceipt } from "viem";
import { usePublicClient } from "wagmi";
import { bondingCurveAbi } from "@/lib/abi/bondingCurve";
import { launcherTokenAbi } from "@/lib/abi/launcherToken";
import { useContractWrite, type ContractWriteState } from "@/hooks/useContractWrite";

export type SellParams = {
  curve: Address;
  token: Address;
  tokensIn: bigint;
  minQuoteOut: bigint;
  recipient: Address;
};

export type SellResult = {
  tokensIn: bigint;
  quoteOut: bigint | undefined;
};

export type SellTokenState = ContractWriteState & {
  sell: (params: SellParams) => Promise<SellResult | undefined>;
  /** Which of the two transactions the user is currently in. */
  step: "idle" | "approving" | "selling";
  result: SellResult | undefined;
};

function quoteOutFromReceipt(receipt: TransactionReceipt, params: SellParams): bigint | undefined {
  const decoded = parseEventLogs({ abi: bondingCurveAbi, eventName: "CurveSell", logs: receipt.logs });
  const match = decoded.find(
    (log) =>
      log.address.toLowerCase() === params.curve.toLowerCase() &&
      log.args.recipient?.toLowerCase() === params.recipient.toLowerCase(),
  );
  return match?.args?.quoteOut;
}

/**
 * Sells tokens back to the curve. Selling needs two transactions: an ERC-20
 * `approve` on the token (skipped when the curve is already approved for at
 * least `tokensIn`), then `sell` on the curve.
 */
export function useSellToken(): SellTokenState {
  const tx = useContractWrite();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const [result, setResult] = useState<SellResult>();
  const [step, setStep] = useState<"idle" | "approving" | "selling">("idle");

  const { reset: resetTx, send } = tx;

  const sell = useCallback(
    async (params: SellParams) => {
      if (!publicClient) return undefined;
      setResult(undefined);
      resetTx();

      let allowance = 0n;
      try {
        allowance = await publicClient.readContract({
          address: params.token,
          abi: launcherTokenAbi,
          functionName: "allowance",
          args: [params.recipient, params.curve],
        });
      } catch {
        allowance = 0n;
      }

      if (allowance < params.tokensIn) {
        setStep("approving");
        const approveReceipt = await send({
          address: params.token,
          abi: launcherTokenAbi,
          functionName: "approve",
          args: [params.curve, params.tokensIn],
        });
        if (!approveReceipt || approveReceipt.status !== "success") {
          setStep("idle");
          return undefined;
        }
        // Clear the approve phase so the sell's own states are what the user sees.
        resetTx();
      }

      setStep("selling");
      const receipt = await send({
        address: params.curve,
        abi: bondingCurveAbi,
        functionName: "sell",
        args: [params.tokensIn, params.minQuoteOut, params.recipient],
      });
      setStep("idle");

      if (!receipt || receipt.status !== "success") return undefined;

      const sellResult: SellResult = {
        tokensIn: params.tokensIn,
        quoteOut: quoteOutFromReceipt(receipt, params),
      };
      setResult(sellResult);
      await queryClient.invalidateQueries();
      return sellResult;
    },
    [publicClient, queryClient, resetTx, send],
  );

  return { ...tx, sell, step, result };
}
