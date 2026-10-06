"use client";

import { useCallback, useRef, useState } from "react";
import { useConnection, usePublicClient, useWriteContract } from "wagmi";
import {
  BaseError,
  decodeErrorResult,
  encodeFunctionData,
  type Abi,
  type Address,
  type Hash,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { describeDecodedRevert, describeError, type FriendlyError } from "@/lib/errors";

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
 * Pull the revert payload out of whatever viem wrapped it in.
 *
 * `eth_call`'s revert data does not sit on the `CallExecutionError` the caller
 * catches — it is nested on the `RpcRequestError` underneath it, which is why
 * the original code's `(error as { data?: Hex }).data` always read `undefined`
 * and every replay fell through to the generic message.
 */
function revertDataFrom(error: unknown): Hex | undefined {
  const isHex = (value: unknown): value is Hex => typeof value === "string" && value.startsWith("0x");
  if (error instanceof BaseError) {
    const found = error.walk((e) => isHex((e as { data?: unknown } | null)?.data));
    return (found as { data?: Hex } | null)?.data;
  }
  return isHex((error as { data?: unknown } | null)?.data) ? (error as { data: Hex }).data : undefined;
}

/**
 * Replays a request with `eth_call` on the RPC this app already trusts and
 * decodes the revert against the same ABI.
 *
 * Returns `undefined` when the replay succeeds (the curve state moved on, so
 * there is nothing to explain) or when the node returned no custom error that
 * this ABI can decode. `account` is passed so sender-dependent guards —
 * allowance, balance, whitelisting — reproduce instead of being silently
 * evaluated against the zero address.
 */
async function replayForCustomError(
  client: ReturnType<typeof usePublicClient>,
  request: ContractWriteRequest,
  account: Address | undefined,
): Promise<FriendlyError | undefined> {
  if (!client) return undefined;
  try {
    await client.call({
      to: request.address,
      data: encodeFunctionData(request as never),
      value: request.value,
      account,
    });
    return undefined;
  } catch (error) {
    const data = revertDataFrom(error);
    if (!data) return undefined;
    try {
      const decoded = decodeErrorResult({ abi: request.abi, data });
      const reason = decoded.args?.[0];
      return describeDecodedRevert(decoded.errorName, typeof reason === "string" ? reason : undefined);
    } catch {
      return undefined;
    }
  }
}

const GENERIC_REVERT: FriendlyError = {
  kind: "reverted",
  title: "Transaction reverted on-chain",
  message:
    "The transaction was mined but the contract reverted it. The price or curve state most likely moved past your slippage tolerance — review the numbers and retry.",
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
  account: Address | undefined,
): Promise<FriendlyError> {
  return (await replayForCustomError(client, request, account)) ?? GENERIC_REVERT;
}

/**
 * Owns the full write lifecycle: wallet confirmation → broadcast → receipt →
 * decoded result. Custom errors are decoded by viem's built-in simulation step
 * inside `writeContract`, and again here if the mined transaction reverted.
 */
export function useContractWrite(): ContractWriteState {
  const publicClient = usePublicClient();
  const { address: account } = useConnection();
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
        if (friendly.kind === "rejected") {
          setPhase("rejected");
          setError(friendly);
          return undefined;
        }
        // The wallet refused it before broadcast. MetaMask reports a failed
        // `eth_estimateGas` as a bare "Internal JSON-RPC error." with no
        // revert payload, so the wallet's message cannot name the cause —
        // replay the same call on the app's RPC and decode the custom error
        // there, so the user gets the contract's actual reason.
        setPhase("failed");
        setError((await replayForCustomError(publicClient, request, account)) ?? friendly);
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
          setError(await explainRevert(publicClient, request, account));
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
    [account, publicClient, writeContractAsync],
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
