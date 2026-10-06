"use client";

import { useCallback, useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

/**
 * Read a value from the URL query string without a Suspense boundary.
 *
 * `useSyncExternalStore` uses the server snapshot (always empty) during
 * hydration and then re-reads the real value, so a deep link like
 * `/?token=0x…` preselects a token without a hydration mismatch.
 */
export function useQueryParam(key: string): string | undefined {
  const subscribeToKey = useCallback((onChange: () => void) => subscribe(onChange), []);
  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get(key) ?? "";
  }, [key]);

  const value = useSyncExternalStore(subscribeToKey, getSnapshot, () => "");
  return value === "" ? undefined : value;
}

/** Writes `key=value` into the URL without a navigation. */
export function setQueryParam(key: string, value: string | undefined) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(key, value);
  else url.searchParams.delete(key);
  window.history.replaceState(null, "", url.toString());
}
