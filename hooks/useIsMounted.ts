"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * `false` during the server render and the first client render, `true` after.
 *
 * Implemented with `useSyncExternalStore` so there is no state update inside an
 * effect: the server snapshot is always `false`, the client snapshot always
 * `true`. Used to keep wallet-dependent markup out of the hydration pass.
 */
export function useIsMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
