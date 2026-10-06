<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Launchpad Token List + Buy — agent guidelines

Frontend for the Robinhood Chain Testnet token launchpad coding test. It lists tokens
discovered from on-chain events and lets a user buy/sell against each token's bonding
curve. Everything below is verified against the deployed contracts (Sourcify source +
live `eth_call` reads), not against assumptions.

## Source of truth, in order

1. Deployed contract source/behaviour on Robinhood Chain Testnet (verified via Sourcify and
   direct RPC reads). This wins over everything else.
2. `technical-brief/TASK-BRIEF.en.md` (and the Indonesian `.md` original).
3. `technical-brief/abi/*.json`.
4. This file.

Discrepancies between these are documented in `README.md` under
"Findings / discrepancies". Do not silently "fix" the brief — verify on-chain and record it.

## Architecture

Frontend only. No backend, no database, no server actions, no API routes.

```
app/                     Next.js App Router
  layout.tsx             root layout, fonts, metadata (server component)
  providers.tsx          'use client' — WagmiProvider + TanStack QueryClientProvider
  page.tsx               'use client' — composition of the whole screen
  globals.css            Tailwind v4 entry + design tokens
components/              presentational + interaction components (flat, one file per component)
  TradePanel.tsx         buy/sell/details container (inline on desktop, sheet on mobile)
  BuyForm.tsx            buy form: estimate, slippage, validation, tx states
  SellForm.tsx           approve + sell form
  TokenList.tsx          search/sort toolbar + loading/empty/error/list states
  TokenCard.tsx          one token row-card
  TokenLogo.tsx          logo with placeholder + onError fallback
  TokenDetailsCard.tsx   description, socials, creator, addresses
  LaunchTokenForm.tsx    bonus: launch a token
  WalletBar.tsx          connect/disconnect, address, ETH balance
  NetworkBanner.tsx      wrong-network warning + add/switch button
  SlippageSelector.tsx   0.5/1/2/5/10 % presets
  ui.tsx                 Card/Button/Badge/ProgressBar/Alert/Stat primitives
hooks/                   React hooks: all on-chain data + transaction state
  useWallet.ts           connection, chain, switch/add network
  useTokenLaunches.ts    chunked event discovery + polling
  useTokenDetails.ts     Multicall3 batch → TokenSummary[]
  useContractWrite.ts    wallet → broadcast → receipt → decoded result
  useBuyToken.ts         buy + CurveBuy parsing + cache invalidation
  useSellToken.ts        approve + sell
  useLaunchToken.ts      bonus: launchToken(TokenParams,uint256,address)
  useGraduateToken.ts    bonus: createGraduatedPool
  useQueryParam.ts       ?token=0x… deep links without hydration mismatch
  useIsMounted.ts        SSR-safe mount flag (useSyncExternalStore)
lib/                     framework-free logic and configuration
  abi/                   generated `as const` ABIs (see below)
  chain.ts               viem chain definition (chain id, RPC, explorer, Multicall3)
  contracts.ts           every contract address + the 50 000-block chunk size
  wagmi.ts               wagmi createConfig
  bondingCurve.ts        pure bigint bonding-curve math (quoteBuy/quoteSell/slippage/price/progress)
  launchpad.ts           TokenLaunched log discovery (chunked eth_getLogs)
  format.ts              display formatting helpers (tiny prices, compact token amounts)
  tokenInput.ts          parse/validate user input without floats
  phase.ts               GraduationPhase → label/badge/behaviour
  errors.ts              wallet/RPC/contract error → human message
  tokens.ts              TokenSummary type
  cn.ts                  className joiner
scripts/                 dev-only Node helpers
  generate-abis.mjs      technical-brief/abi/*.json → lib/abi/*.ts
  verify-onchain.mjs     dump live launches + factory config
  verify-buy-quote.mjs   UI vs node vs contract eth_call, buy and sell
  screenshots.mjs        headless-Chrome screenshots + console capture into demo/
demo/                    screenshots + how to regenerate them
technical-brief/         the brief and the provided ABIs (unmodified)
```

Rules:

- Chains/addresses live only in `lib/chain.ts` and `lib/contracts.ts`. No address literals
  anywhere else. No token addresses in code at all (sample tokens are discovery-only).
- No blockchain math in components. Components consume already-derived values.
- No `fetch` to any third-party API; all data comes from the RPC via viem/wagmi.
- Components never import from `wagmi/connectors` or build a client themselves; all chain
  access goes through `hooks/`.

## Technology stack

Next.js 16 (App Router, Turbopack), React 19, TypeScript (strict), wagmi v3, viem v2,
TanStack Query v5, Tailwind CSS v4, lucide-react for icons.

Do not add: ethers.js, RainbowKit, web3modal, Redux, Zustand, additional Web3
libraries, `@tanstack/react-query-devtools`, backend services, or databases. If a new
dependency seems necessary, prefer implementing it in `lib/` first.

`scripts/verify-onchain.mjs` and `scripts/generate-abis.mjs` run on plain Node and use the
already-installed `viem`.

## Robinhood Chain Testnet

| | |
| --- | --- |
| Chain ID | `46630` |
| Native currency | ETH, 18 decimals |
| RPC | `https://robinhood-sepolia-rpc.publicnode.com` |
| Explorer | `https://explorer.testnet.chain.robinhood.com` |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |
| LaunchFactory | `0x533cE670f1372cb402D49866608b92e7bc2b4493` |
| Factory deploy block | `129157568` |

`eth_getLogs` rejects ranges **larger than 50 000 blocks**, so all log queries must be
chunked (`lib/launchpad.ts`). Re-read `lib/chain.ts` before touching chain config.

## Contract interaction rules

- ABIs are generated from `technical-brief/abi/*.json` by `scripts/generate-abis.mjs` into
  `lib/abi/*.ts` as `as const` arrays. Regenerate rather than hand-editing; never invent an
  ABI entry.
- Discover tokens **only** from the `TokenLaunched` event, starting at the factory deploy
  block, chunked at 50 000 blocks. Never hardcode the sample tokens (FRESH/EARLY/HALF/
  TAXED/GRAD) — they exist purely to check the result.
- Batch all per-token reads through Multicall3 (`useReadContracts` with `allowFailure: true`
  + an explicit `batchSize`). Only log fetching bypasses Multicall3.
- `buy(quoteIn, minTokensOut, recipient)` is `payable`; `msg.value` must equal `quoteIn`
  exactly (`NativeValueMismatch` otherwise). The UI passes `value: quoteIn`.
- `recipient` is always the connected wallet address.
- The authoritative token amount is `tokensOut` from the `CurveBuy` event in the receipt
  (parsed with `parseEventLogs`), never the client-side estimate.
- Phase enum from `getLaunchedToken(token).phase`: `0` NotGraduated (buyable),
  `1` Swept (curve exhausted, pool not created), `2` PoolCreated (graduated),
  `3` Rescued (graduation cancelled). Only phase `0` may be bought.
- Custom errors that must be translated: `SlippageExceeded`, `CurveGraduated`. Also handle
  `NativeValueMismatch`, `InsufficientLiquidity`, `LaunchFeeNotPaid`, `NotWhitelisted`,
  `LaunchEconomicsMismatch`, `UserRejectedRequestError`. Never surface raw hex.

### Bonding-curve math (verified against `BondingCurve.sol`)

```
fee        = quoteIn * feeBps / 10000
creatorTax = quoteIn * creatorTaxBps / 10000
net        = quoteIn - fee - creatorTax
tokensOut  = net * tokenReserve / (quoteReserve + net)      // floor division
minTokensOut = tokensOut * (10000 - slippageBps) / 10000
```

- `getReserves()` returns `(quoteReserve, tokenReserve)` where
  `quoteReserve = phantomQuote + trackedQuote - quoteFeeBalance - creatorTaxBalance`.
- `realQuoteReserve() = trackedQuote - quoteFeeBalance - creatorTaxBalance` (excludes the
  virtual reserves).
- Spot price = `quoteReserve / tokenReserve` (ETH per token, still wei-scaled).
- Graduation progress = `realQuoteReserve / graduationThreshold` in basis points, capped at
  10000. Never render `0.00` for a price.
- A graduated/closed curve has `tokenReserve == 0`; guard every division against zero.
- Live `snipeTaxBps` also reduces the net input during a launch window (9900 bps decaying to
  zero over 15 s), so the estimate is an upper bound for the first seconds after a launch. The
  brief's formula omits it; the receipts are still authoritative. Do not model it without also
  handling the contract's 1 %-floor clamp.

## Bigint / precision rules

- `bigint` for every wei, token amount, reserve, fee, tax, slippage and progress value.
- Never convert a wei value to `number` for arithmetic. `Number()` is allowed only for
  values already reduced to a display unit (percentage text, `phase`, list indices).
- Parse user input with `parseEther`; reject anything with more than 18 decimals before
  parsing. Format only at the final UI layer (`lib/format.ts`).
- Prices are tiny (1e7–1e9 wei per token). Use `formatTinyPrice`, which renders
  `0.0₅1234`-style subscripts; never `toFixed(2)`.

## Token discovery rules

- Query `TokenLaunched(address indexed token, address indexed curve, address indexed deployer,
  address pairToken, uint256 launchConfigId, uint256 graduationThreshold)` from
  block `129157568` to `latest`, in 50 000-block chunks.
- Deduplicate by token address; keep the newest block per token.
- Reflect tokens launched after page load: polling refetch (default interval) plus a manual
  refresh control.
- `pairToken == address(0)` means the token is paired with native ETH. Non-ETH pairs are
  still listed and flagged as unsupported for buying (the buy form is disabled and says so)
  rather than hidden.

## Transaction handling

Every buy/sell surfaces these states explicitly: wallet-confirmation pending
("Confirm in wallet"), submitted/pending with an explorer link, success (with the actual
`tokensOut`/`quoteOut` and an explorer link), user rejection (form re-enabled), and
revert/failure (human-readable message). After a successful receipt, invalidate the
TanStack Query cache so the list, the buy form and the wallet balances all update without a
page reload.

Sell: `approve(curve, tokensIn)` on the token, then `sell(tokensIn, minQuoteOut, recipient)`.

## UI requirements

- Clean, responsive (works at 375 px and up), dark-first theme with Tailwind v4 tokens.
- Token row/card shows: logo (placeholder fallback on empty string *and* on image error),
  name, symbol, price, graduation progress bar, phase label, ETH raised / threshold.
- Three distinct states for the list: loading (skeletons), empty, error (with retry button).
- Buy form disables the submit button unless: wallet connected, correct chain, amount parses
  to > 0 with ≤ 18 decimals, balance covers the amount, `tokensOut > 0`, phase is `0`, and the
  pair asset is native ETH. When the blocker is a wallet action (not connected / wrong chain) a
  separate "Connect wallet" / "Switch network" button is rendered above the disabled buy button
  — the buy button itself is never enabled for a transaction that cannot be sent.
- Estimate updates as the user types. Slippage selector defaults to 1%.
- Show the user's ETH balance, and their balance of the selected token even before the first
  buy.
- Tailwind utility classes; no CSS-in-JS; no component library.

## Error handling

- Wrap the RPC/log queries with TanStack Query retries and render a retry affordance.
- Translate errors in `lib/errors.ts`; the UI never prints a raw error object or hex.
- Guard every `0n` divisor and every missing struct field (a token whose curve failed to
  load degrades to a partial card instead of crashing the page).

## Testing / verification

- `npm run lint`, `npm run typecheck`, `npm run build` must all pass. Always use
  `npm run typecheck` (it runs `next typegen` first) — a bare `npx tsc --noEmit` fails on a fresh
  clone because Next's global `LayoutProps`/`PageProps` types live in the gitignored `.next/`.
- Re-verify the fresh-clone path after any config change: clone the pushed branch into an empty
  directory, `npm ci`, then lint → typecheck → build, in that order.
- `node scripts/verify-onchain.mjs` re-reads live contract data (use it to sanity-check
  numbers the UI shows).
- `node scripts/verify-buy-quote.mjs <token> <eth> <url>` drives the buy and sell forms in
  headless Chrome and compares the UI estimate, the Node formula and a contract `eth_call`
  (with `stateOverride` for the sell path). All three must be equal to the wei.
- `node scripts/screenshots.mjs <url> demo` regenerates the screenshots and reports any browser
  console errors/warnings. The production build must report none.
- Manual acceptance pass against `technical-brief/TASK-BRIEF.en.md` steps 1–9 before
  finishing. Verify with MetaMask on chain 46630, including a real buy and a real sell.

## Security

Never commit private keys, seed phrases, wallet credentials, API keys, RPC secrets or
`.env` files. `.env*` is gitignored. There is no server-side secret in this project — the
app talks to a public RPC with a public wallet connection. Never push to GitHub from an
agent session.

## Implementation priorities

1. Chain + contract config, wallet connect/switch, `launchFee()` display.
2. Chunked `TokenLaunched` discovery.
3. Multicall per-token data.
4. List UI with all three states + responsive layout.
5. Buy estimation (bigint), slippage, validation.
6. Buy transaction + all five states + receipt parsing.
7. Post-transaction refresh.
8. README + demo assets.
9. Bonuses only after 1–8 are correct: launch token, sell, search/sort, `createGraduatedPool`.

## Open-source references

May be consulted for patterns (chunked `eth_getLogs`, Multicall3 batching, bonding-curve
front-ends): wagmi/viem docs, Uniswap v4 periphery, ponsfamily launchpad (visual/flow
reference only). Do **not** copy code, contract addresses, ABIs, curve formulas or assets.
Adapt patterns to this project's verified contracts.

## Known dev-only caveat

With `next dev` (Turbopack) React logs a hydration mismatch on the `<html>` element's
`next/font` variable classes. It is a Next.js dev-server artifact; the production build loads
with no console errors or warnings (verified by `scripts/screenshots.mjs`). Do not "fix" it by
restructuring the font setup without re-checking the production console.

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues on `aesencodes/launchpad-token-list-buy`, driven by the
`gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`,
`ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` plus `docs/adr/`. See `docs/agents/domain.md`.
