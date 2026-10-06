"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import { launchFactoryAbi } from "@/lib/abi/launchFactory";
import { CONTRACTS } from "@/lib/contracts";
import { useContractWrite, type ContractWriteState } from "@/hooks/useContractWrite";

export type GraduateTokenState = ContractWriteState & {
  /** `createGraduatedPool(token)` — completes graduation for a phase-1 token. */
  createPool: (token: Address) => Promise<boolean>;
};

export function useGraduateToken(): GraduateTokenState {
  const tx = useContractWrite();
  const queryClient = useQueryClient();
  const { reset: resetTx, send } = tx;

  const createPool = useCallback(
    async (token: Address) => {
      resetTx();
      const receipt = await send({
        address: CONTRACTS.launchFactory,
        abi: launchFactoryAbi,
        functionName: "createGraduatedPool",
        args: [token],
      });
      if (!receipt || receipt.status !== "success") return false;
      await queryClient.invalidateQueries();
      return true;
    },
    [queryClient, resetTx, send],
  );

  return { ...tx, createPool };
}
