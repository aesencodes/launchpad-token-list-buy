"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { parseEventLogs, toHex, zeroAddress, type Address, type Hash } from "viem";
import { usePublicClient } from "wagmi";
import { launchFactoryAbi } from "@/lib/abi/launchFactory";
import { CONTRACTS } from "@/lib/contracts";
import { describeError, type FriendlyError } from "@/lib/errors";
import { useContractWrite, type ContractWriteState } from "@/hooks/useContractWrite";

/** Mirrors `LaunchFactory.TokenParams` (with `LauncherToken.Socials` inlined). */
export type LaunchTokenParams = {
  name: string;
  symbol: string;
  logo: string;
  description: string;
  socials: {
    twitter: string;
    telegram: string;
    discord: string;
    website: string;
    farcaster: string;
  };
  /** `address(0)` = the sending wallet. */
  creatorFeeRecipient: Address;
  /** 0…1000 bps. */
  creatorTaxBps: number;
  buybackEnabled: boolean;
};

export type LaunchedToken = {
  token: Address;
  curve: Address;
  hash: Hash;
};

export type LaunchOptions = {
  pairToken?: Address;
  /** Checked against `canLaunch` before anything is sent. */
  account?: Address;
};

export type LaunchTokenState = ContractWriteState & {
  launch: (
    params: LaunchTokenParams,
    launchConfigId: bigint,
    options?: LaunchOptions,
  ) => Promise<LaunchedToken | undefined>;
  launched: LaunchedToken | undefined;
  /** Set when the launch was refused locally, before any transaction. */
  gateError: FriendlyError | undefined;
  isCheckingGate: boolean;
};

/** 32 fresh random bytes, hex encoded. A new salt on every attempt. */
export function randomSalt(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

const EMPTY_SOCIALS = { twitter: "", telegram: "", discord: "", website: "", farcaster: "" };

/** Fills in the optional `TokenParams` fields. */
export function withDefaultLaunchParams(
  params: Partial<LaunchTokenParams> & { name: string; symbol: string },
): LaunchTokenParams {
  return {
    logo: "",
    description: "",
    socials: EMPTY_SOCIALS,
    creatorFeeRecipient: zeroAddress,
    creatorTaxBps: 0,
    buybackEnabled: false,
    ...params,
  };
}

/**
 * Launches a token through the 3-argument
 * `launchToken(TokenParams,uint256,address)` overload.
 *
 * Reads `launchFee()`, `previewLaunchEconomics(...)` and `canLaunch(...)`
 * immediately before sending: the fee must match exactly, the economics digest
 * must match what the factory recomputes (it reverts on mismatch), and the
 * caller must be allowed to launch. A fresh random salt is generated per
 * attempt.
 */
export function useLaunchToken(): LaunchTokenState {
  const tx = useContractWrite();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const [launched, setLaunched] = useState<LaunchedToken>();
  const [gateError, setGateError] = useState<FriendlyError>();
  const [isCheckingGate, setIsCheckingGate] = useState(false);

  const { reset: resetTx, send } = tx;

  const launch = useCallback(
    async (params: LaunchTokenParams, launchConfigId: bigint, options: LaunchOptions = {}) => {
      const pairToken = options.pairToken ?? zeroAddress;
      setLaunched(undefined);
      setGateError(undefined);
      resetTx();

      if (!publicClient) {
        setGateError({
          kind: "rpc",
          title: "No RPC connection",
          message: "Could not reach Robinhood Chain Testnet. Check your connection and retry.",
        });
        return undefined;
      }

      setIsCheckingGate(true);
      try {
        const [launchFee, expectedEconomics, allowed] = await Promise.all([
          publicClient.readContract({
            address: CONTRACTS.launchFactory,
            abi: launchFactoryAbi,
            functionName: "launchFee",
          }),
          publicClient.readContract({
            address: CONTRACTS.launchFactory,
            abi: launchFactoryAbi,
            functionName: "previewLaunchEconomics",
            args: [launchConfigId, pairToken],
          }),
          options.account
            ? publicClient.readContract({
                address: CONTRACTS.launchFactory,
                abi: launchFactoryAbi,
                functionName: "canLaunch",
                args: [options.account],
              })
            : Promise.resolve(true),
        ]);

        if (!allowed) {
          setGateError({
            kind: "reverted",
            title: "Launching is restricted",
            message:
              "The factory's canLaunch() check returns false for this wallet. Ask the supervisor to whitelist your address, then retry.",
          });
          return undefined;
        }

        setIsCheckingGate(false);

        const receipt = await send({
          address: CONTRACTS.launchFactory,
          abi: launchFactoryAbi,
          functionName: "launchToken",
          args: [
            { ...params, expectedEconomics, salt: randomSalt() },
            launchConfigId,
            pairToken,
          ],
          // Must equal `launchFee()` exactly (LaunchFeeNotPaid otherwise).
          value: launchFee,
        });

        if (!receipt || receipt.status !== "success") return undefined;

        const [event] = parseEventLogs({
          abi: launchFactoryAbi,
          eventName: "TokenLaunched",
          logs: receipt.logs,
        });
        await queryClient.invalidateQueries();
        if (!event?.args) return undefined;

        const result: LaunchedToken = {
          token: event.args.token,
          curve: event.args.curve,
          hash: receipt.transactionHash,
        };
        setLaunched(result);
        return result;
      } catch (error) {
        setIsCheckingGate(false);
        setGateError(describeError(error));
        return undefined;
      }
    },
    [publicClient, queryClient, resetTx, send],
  );

  return { ...tx, launch, launched, gateError, isCheckingGate };
}
