"use client";

import { useCallback, useRef, useState } from "react";
import { usePublicClient, useWriteContract } from "wagmi";
import {
  decodeErrorResult,
  encodeFunctionData,
  type Abi,
  type Address,
  type Hash,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { describeError, type FriendlyError } from "@/lib/errors";

/**
 * Every state a contract write can be in, mapped 1:1 to the states the brief
 * requires the UI to show.
 */
export type TxPhase =
  | "idle"
  /** Handed to the wallet, waiting for the user to confirm. */
  | "awaiting-wallet"
  /** Broadcast, waiting for a block. */
  | "pending"
  | "success"
  /** Mined, but the EVM reverted it. */
  | "reverted"
  /** User dismissed the wallet prompt. */
  | "rejected"
  | "failed";

export type ContractWriteRequest = {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
};

export type ContractWriteState = {
  phase: TxPhase;
  hash: Hash | undefined;
  receipt: TransactionReceipt | undefined;
  error: FriendlyError | undefined;
  /** `true` while the wallet prompt or the block wait is outstanding. */
  isBusy: boolean;
  send: (request: ContractWriteRequest) => Promise<TransactionReceipt | undefined>;
  reset: () => void;
};

/**
 * Explains a reverted transaction by replaying it with `eth_call` and decoding
 * the custom error against the same ABI.
 *
 * A receipt only tells you *that* it reverted; the reason has to be recovered
 * by re-executing. If the replay now succeeds (state moved on) we fall back to
 * a generic message rather than inventing a cause.
 */
async function explainRevert(
  client: ReturnType<typeof usePublicClient>,
  request: ContractWriteRequest,
): Promise<FriendlyError> {
  const generic: FriendlyError = {
    kind: "reverted",
    title: "Transaction reverted on-chain",
    message:
      "The transaction was mined but the contract reverted it. The price or curve state most likely moved past your slippage tolerance — review the numbers and retry.",
  };
  if (!client) return generic;

  try {
    await client.call({
      to: request.address,
      data: encodeFunctionData(request as never),
      value: request.value,
    });
    return generic;
  } catch (error) {
    const data = (error as { data?: Hex }).data;
    if (!data) return generic;
    try {
      const decoded = decodeErrorResult({ abi: request.abi, data });
      return describeError(
        // Reuse the translator by shaping the decoded name like a viem error.
        Object.assign(new Error(decoded.errorName), { decodedErrorName: decoded.errorName }),
      );
    } catch {
      return generic;
    }
  }
}

/**
 * Owns the full write lifecycle: wallet confirmation → broadcast → receipt →
 * decoded result. Custom errors are decoded by viem's built-in simulation step
 * inside `writeContract`, and again here if the mined transaction reverted.
 */
export function useContractWrite(): ContractWriteState {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [phase, setPhase] = useState<TxPhase>("idle");
  const [hash, setHash] = useState<Hash>();
  const [receipt, setReceipt] = useState<TransactionReceipt>();
  const [error, setError] = useState<FriendlyError>();

  // Guards against a stale receipt wait writing state after a reset/unmount.
  const runIdRef = useRef(0);

  const reset = useCallback(() => {
    runIdRef.current += 1;
    setPhase("idle");
    setHash(undefined);
    setReceipt(undefined);
    setError(undefined);
  }, []);

  const send = useCallback(
    async (request: ContractWriteRequest): Promise<TransactionReceipt | undefined> => {
      const runId = runIdRef.current + 1;
      runIdRef.current = runId;

      setError(undefined);
      setReceipt(undefined);
      setHash(undefined);
      setPhase("awaiting-wallet");

      let txHash: Hash;
      try {
        txHash = await writeContractAsync(request as never);
      } catch (writeError) {
        const friendly = describeError(writeError);
        setPhase(friendly.kind === "rejected" ? "rejected" : "failed");
        setError(friendly);
        return undefined;
      }

      if (runIdRef.current !== runId) return undefined;
      setHash(txHash);
      setPhase("pending");

      if (!publicClient) {
        setPhase("failed");
        setError({
          kind: "rpc",
          title: "No RPC connection",
          message: "Could not reach Robinhood Chain Testnet. Check your connection and retry.",
        });
        return undefined;
      }

      try {
        const txReceipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        if (runIdRef.current !== runId) return txReceipt;

        if (txReceipt.status === "reverted") {
          setReceipt(txReceipt);
          setPhase("reverted");
          setError(await explainRevert(publicClient, request));
        } else {
          setReceipt(txReceipt);
          setPhase("success");
        }
        return txReceipt;
      } catch (receiptError) {
        if (runIdRef.current !== runId) return undefined;
        setPhase("failed");
        setError(describeError(receiptError));
        return undefined;
      }
    },
    [publicClient, writeContractAsync],
  );

  return {
    phase,
    hash,
    receipt,
    error,
    isBusy: phase === "awaiting-wallet" || phase === "pending",
    send,
    reset,
  };
}
