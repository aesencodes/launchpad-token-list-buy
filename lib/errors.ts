import {
  BaseError,
  ContractFunctionRevertedError,
  InsufficientFundsError,
  UserRejectedRequestError,
} from "viem";
import { robinhoodTestnet } from "@/lib/chain";

export type FriendlyError = {
  kind: "rejected" | "reverted" | "insufficient_funds" | "rpc" | "unknown";
  title: string;
  message: string;
};

/**
 * Human-readable messages for the contract's custom errors, taken from the
 * verified source (`BondingCurve.sol`, `LaunchFactory.sol`, `LauncherToken.sol`).
 */
const CUSTOM_ERROR_MESSAGES: Record<string, { title: string; message: string }> = {
  SlippageExceeded: {
    title: "Slippage tolerance exceeded",
    message:
      "The price moved past your slippage tolerance before the transaction landed. Raise the slippage setting or try a smaller amount.",
  },
  CurveGraduated: {
    title: "No longer sold on the curve",
    message:
      "This token has left the bonding curve (filled or graduated), so it can no longer be bought or sold here.",
  },
  InsufficientLiquidity: {
    title: "Not enough liquidity",
    message: "The curve cannot fill this trade at its current reserves. Try a smaller amount.",
  },
  InsufficientInputAmount: {
    title: "Amount too small",
    message: "The curve requires an amount greater than zero.",
  },
  InsufficientOutputAmount: {
    title: "Amount too small",
    message: "That amount is too small to receive any tokens. Increase the ETH amount.",
  },
  NativeValueMismatch: {
    title: "Transaction value mismatch",
    message: "The ETH sent did not match the requested amount. Please retry the purchase.",
  },
  MinimumOutputRequired: {
    title: "Missing minimum output",
    message: "The contract requires an explicit minimum output for this operation.",
  },
  ZeroAmount: { title: "Invalid amount", message: "The amount must be greater than zero." },
  ZeroAddress: { title: "Invalid address", message: "The contract rejected a zero address." },
  NotInitialized: {
    title: "Curve not ready",
    message: "This bonding curve has not finished initialising yet. Try again in a moment.",
  },
  NotReadyToGraduate: {
    title: "Not ready to graduate",
    message: "The curve has not been fully bought out yet, so it cannot graduate.",
  },
  AlreadyGraduated: {
    title: "Already graduated",
    message: "This launch has already graduated.",
  },
  NothingToGraduate: {
    title: "Nothing to graduate",
    message: "There is nothing to graduate for this token.",
  },
  WrongGraduationPhase: {
    title: "Wrong graduation phase",
    message: "This token is not in a phase where that action is allowed.",
  },
  AutoGraduationFailed: {
    title: "Automatic graduation failed",
    message: "The automatic graduation did not complete. It can be retried from the factory.",
  },
  TransferFailed: { title: "Transfer failed", message: "A token or ETH transfer did not go through." },
  ReentrancyGuardReentrantCall: {
    title: "Transaction reverted",
    message: "The contract rejected a re-entrant call. Please retry.",
  },
  LaunchFeeNotPaid: {
    title: "Launch fee mismatch",
    message: "The factory's launch fee changed. Refresh the page and try again.",
  },
  NotWhitelisted: {
    title: "Launching is restricted",
    message:
      "This wallet is not currently allowed to launch tokens. Ask the supervisor to whitelist your address.",
  },
  LaunchEconomicsMismatch: {
    title: "Launch economics changed",
    message: "The launch terms changed between the preview and the transaction. Refresh and try again.",
  },
  InvalidTokenParams: {
    title: "Invalid token details",
    message: "The token name or symbol was rejected. Check the length limits and try again.",
  },
  CreatorTaxTooHigh: {
    title: "Creator tax too high",
    message: "The creator tax must stay within the factory's cap (1000 bps).",
  },
  LaunchConfigDisabled: {
    title: "Launch config disabled",
    message: "That launch configuration is currently disabled.",
  },
  InvalidLaunchConfigId: {
    title: "Unknown launch config",
    message: "That launch configuration id does not exist on the factory.",
  },
  TokenNotFound: {
    title: "Token not found",
    message: "The factory has no record of this token.",
  },
  SupplyTooHigh: { title: "Supply too high", message: "The requested supply exceeds the factory limit." },
  SupplyTooLow: { title: "Supply too low", message: "The requested supply is below the factory minimum." },
  ERC20InsufficientAllowance: {
    title: "Approval needed",
    message: "The curve is not approved to spend that many tokens. Approve them first and retry.",
  },
  ERC20InsufficientBalance: {
    title: "Insufficient token balance",
    message: "Your wallet does not hold that many of these tokens.",
  },
  OwnableUnauthorizedAccount: {
    title: "Not authorized",
    message: "This wallet is not allowed to call that factory function.",
  },
  NotFactory: {
    title: "Not authorized",
    message: "Only the launch factory can call that curve function.",
  },
};

function fromName(name: string, rawMessage?: string): FriendlyError {
  const known = CUSTOM_ERROR_MESSAGES[name];
  if (known) return { kind: "reverted", ...known };
  return {
    kind: "reverted",
    title: "Transaction reverted",
    message: rawMessage
      ? `The contract rejected the transaction: ${rawMessage}`
      : `The contract rejected the transaction (${name}).`,
  };
}

/** Best-effort lookup for a known custom-error name inside an arbitrary message. */
function nameFromMessage(message: string): string | undefined {
  return Object.keys(CUSTOM_ERROR_MESSAGES).find((name) => message.includes(name));
}

/**
 * The wallet's *own* node failing the request before it is broadcast.
 *
 * MetaMask reports a node-side failure before broadcast — gas estimation or
 * the send itself — as a bare "Internal JSON-RPC error." (`-32603`) with no
 * revert payload, so nothing can be decoded from it and the string on its own
 * tells the user nothing. Say what happened, that nothing was sent, and what
 * to check.
 */
const PROVIDER_INTERNAL_ERROR = /internal json-rpc error|an internal error was received|unexpected error/i;

function walletNodeFailed(): FriendlyError {
  return {
    kind: "rpc",
    title: "Your wallet's node rejected the request",
    message:
      "Nothing was sent — the transaction never left your wallet. Your wallet's RPC for " +
      `${robinhoodTestnet.name} failed the request, usually while estimating gas. Check the ` +
      `network's RPC URL in your wallet (this app uses ${robinhoodTestnet.rpcUrls.default.http[0]}) ` +
      "and try again.",
  };
}

/**
 * Translate an already-decoded custom error — used when a revert payload was
 * recovered from a manual `eth_call` replay instead of from viem's own
 * `ContractFunctionRevertedError`.
 */
export function describeDecodedRevert(errorName: string, reason?: string): FriendlyError {
  return fromName(errorName, reason);
}

/**
 * Turn anything thrown by wagmi/viem/MetaMask into something a user can read.
 * Never returns raw hex or a stack trace.
 */
export function describeError(error: unknown): FriendlyError {
  if (!error || typeof error !== "object") {
    return { kind: "unknown", title: "Something went wrong", message: String(error ?? "Unknown error") };
  }

  if (error instanceof UserRejectedRequestError) {
    return {
      kind: "rejected",
      title: "Transaction rejected",
      message: "You rejected the request in your wallet, so nothing was sent.",
    };
  }

  if (error instanceof InsufficientFundsError) {
    return {
      kind: "insufficient_funds",
      title: "Insufficient ETH",
      message: "Your wallet does not have enough ETH to cover the amount plus gas.",
    };
  }

  if (error instanceof BaseError) {
    // A user closing the MetaMask prompt surfaces as code 4001, sometimes
    // wrapped, so check the walk before the generic revert branch.
    const shortMessage = error.shortMessage ?? "";
    const details = error.details ?? "";
    if (shortMessage.toLowerCase().includes("user rejected") || details.toLowerCase().includes("user rejected")) {
      return {
        kind: "rejected",
        title: "Transaction rejected",
        message: "You rejected the request in your wallet, so nothing was sent.",
      };
    }

    const reverted = error.walk((e) => e instanceof ContractFunctionRevertedError) as
      | ContractFunctionRevertedError
      | null;
    if (reverted) {
      const name = reverted.data?.errorName;
      const reason = reverted.reason ?? reverted.data?.args?.[0];
      const text = typeof reason === "string" ? reason : undefined;
      // `data.errorName` is only set when the ABI actually decoded the revert
      // payload. Without it viem still builds a `ContractFunctionRevertedError`
      // — for a data-less node failure such as MetaMask's `-32603`, `reason` is
      // then the node's own text ("Internal JSON-RPC error.") and there is no
      // contract revert to translate. Never dress that up as a contract error.
      if ((!name || name === "Error") && text && PROVIDER_INTERNAL_ERROR.test(text)) {
        return walletNodeFailed();
      }
      if (name && name !== "Error") return fromName(name);
      return fromName(name ?? "Error", text);
    }

    // wagmi sometimes only carries the decoded name in the message text
    // (for example when the revert came back from `eth_estimateGas`).
    const haystack = `${shortMessage} ${details} ${error.message}`;
    const name = nameFromMessage(haystack);
    if (name) return fromName(name);

    if (PROVIDER_INTERNAL_ERROR.test(haystack)) return walletNodeFailed();

    if (error.name === "ChainMismatchError") {
      return {
        kind: "rpc",
        title: "Wrong network",
        message: "Your wallet is on a different network. Switch to Robinhood Chain Testnet and retry.",
      };
    }

    return {
      kind: "rpc",
      title: "Transaction failed",
      message: shortMessage || details || "The request could not be completed. Please retry.",
    };
  }

  if (error instanceof Error) {
    const name = nameFromMessage(error.message);
    if (name) return fromName(name);
    if (error.message.toLowerCase().includes("user rejected")) {
      return {
        kind: "rejected",
        title: "Transaction rejected",
        message: "You rejected the request in your wallet, so nothing was sent.",
      };
    }
    return {
      kind: "unknown",
      title: "Something went wrong",
      message: error.message || "The wallet failed without a message. Reload the page and try again.",
    };
  }

  // An injected wallet can reject with a plain object rather than an `Error`:
  // MetaMask's EIP-1193 rejections cross the extension boundary that way and
  // wagmi passes them straight through. Read the structured fields out of it —
  // `String(object)` would render the useless "[object Object]" the brief
  // forbids.
  if (error && typeof error === "object") {
    const { code, message } = error as { code?: unknown; message?: unknown };
    const text = typeof message === "string" ? message : "";
    if (code === 4001 || /user (rejected|denied)/i.test(text)) {
      return {
        kind: "rejected",
        title: "Transaction rejected",
        message: "You rejected the request in your wallet, so nothing was sent.",
      };
    }
    if (code === -32002 || /already (processing|pending)/i.test(text)) {
      return {
        kind: "rpc",
        title: "Wallet is busy",
        message:
          "Your wallet is already handling a request. Open MetaMask, finish or dismiss that prompt, then try again.",
      };
    }
    if (code === 4902) {
      return {
        kind: "rpc",
        title: "Network not added",
        message: "Your wallet does not know Robinhood Chain Testnet yet. Use the switch button to add it.",
      };
    }
    if (code === -32603 || PROVIDER_INTERNAL_ERROR.test(text)) return walletNodeFailed();
    if (text) return { kind: "rpc", title: "Wallet request failed", message: text };
    if (typeof code === "number") {
      return {
        kind: "unknown",
        title: "Wallet request failed",
        message: `Your wallet rejected the request (code ${code}).`,
      };
    }
  }

  return {
    kind: "unknown",
    title: "Something went wrong",
    message: "The wallet did not return a readable error. Reload the page and try again.",
  };
}
