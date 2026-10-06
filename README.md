# Robinhood Chain launchpad — token list & buy

A frontend for the launchpad on **Robinhood Chain Testnet** (chain id `46630`). It discovers
every token the factory has ever launched from on-chain events, reads each token's bonding
curve live, and lets you buy (and sell) with ETH.

Built for the on-site brief in [`technical-brief/TASK-BRIEF.en.md`](technical-brief/TASK-BRIEF.en.md)
(Indonesian original: [`technical-brief/TASK-BRIEF.md`](technical-brief/TASK-BRIEF.md)).

![Token list](demo/01-desktop-list.png)

| | |
| --- | --- |
| Network | Robinhood Chain Testnet (`46630`) |
| LaunchFactory | [`0x533cE670f1372cb402D49866608b92e7bc2b4493`](https://explorer.testnet.chain.robinhood.com/address/0x533cE670f1372cb402D49866608b92e7bc2b4493) |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |
| Explorer | <https://explorer.testnet.chain.robinhood.com> |
| RPC | <https://robinhood-sepolia-rpc.publicnode.com> |

---

## 1. Running it

Requirements: **Node.js 20.9+** (developed on Node 26) and **MetaMask** in a Chromium browser.

```bash
git clone <this-repo>
cd launchpad-token-list-buy
npm install
npm run dev          # http://localhost:3000
```

Production build:

```bash
npm run build && npm start     # http://localhost:3000
```

There is **no `.env` file and no secret**. Every value is public: the chain id, the public RPC
and the factory address live in [`lib/chain.ts`](lib/chain.ts) and
[`lib/contracts.ts`](lib/contracts.ts).

Checks:

```bash
npm run lint         # eslint
npm run typecheck    # next typegen + tsc --noEmit
npm run build        # production build (also typechecks)
```

> Run `npm run typecheck`, not a bare `npx tsc --noEmit`: Next.js generates the global
> `LayoutProps` / `PageProps` helpers into the gitignored `.next/` directory, so on a fresh clone
> `tsc` alone fails with `Cannot find name 'LayoutProps'` until some Next command has run.
> `npm run typecheck` runs `next typegen` first, which is why it works from a clean checkout.

### Using the app

1. Open the app — the token list loads without any wallet.
2. Click **Connect wallet** and approve MetaMask.
3. MetaMask does not know chain `46630`. If your wallet is on another network a banner appears
   with **Switch to Robinhood Chain Testnet**; that same button also *adds* the network
   (`wallet_switchEthereumChain`, falling back to `wallet_addEthereumChain` on error 4902).
4. Get testnet ETH from <https://faucet.testnet.chain.robinhood.com/> (0.05 ETH is plenty).
5. Pick a token (or open a deep link `/?token=0x…`), type an ETH amount, and press **Buy**.

### Developer / verification scripts

```bash
node scripts/verify-onchain.mjs                    # dump live launch data + all TokenLaunched events
node scripts/verify-buy-quote.mjs <token> <eth>    # UI estimate vs node estimate vs contract eth_call
node scripts/screenshots.mjs http://localhost:3000 demo   # regenerate the demo/*.png
node scripts/generate-abis.mjs                     # regenerate lib/abi/*.ts from technical-brief/abi
```

`verify-buy-quote.mjs` drives the running app in headless Chrome, types an amount into the buy
form, then compares three numbers: what the UI derived, what the same formula gives in Node, and
what the contract itself returns from an `eth_call` to `buy(...)`. All three match to the wei —
see [section 6](#6-verification-performed).

---

## 2. What it does (steps 1–9)

| Step | Status | Where |
| --- | --- | --- |
| 1 — project + network, show `launchFee()` | ✅ | `lib/chain.ts`, `lib/wagmi.ts`, header + stats on `app/page.tsx` |
| 2 — connect / disconnect, address, ETH balance, switch **and add** network | ✅ | `hooks/useWallet.ts`, `components/WalletBar.tsx`, `components/NetworkBanner.tsx` |
| 3 — token list from `TokenLaunched`, chunked `eth_getLogs`, live polling | ✅ | `lib/launchpad.ts`, `hooks/useTokenLaunches.ts` |
| 4 — per-token data through Multicall3 `aggregate3` + `allowFailure` | ✅ | `hooks/useTokenDetails.ts` |
| 5 — list UI, phase labels, logo placeholders, loading/empty/error states | ✅ | `components/TokenList.tsx`, `components/TokenCard.tsx`, `components/TokenLogo.tsx` |
| 6 — buy form, bigint curve estimate, slippage, disabled-state rules | ✅ | `components/BuyForm.tsx`, `lib/bondingCurve.ts`, `lib/tokenInput.ts` |
| 7 — `buy(quoteIn, minTokensOut, recipient)`, all five transaction states, explorer links, error translation | ✅ | `hooks/useContractWrite.ts`, `hooks/useBuyToken.ts`, `lib/errors.ts` |
| 8 — refresh price/progress/ETH balance/token balance without reload | ✅ | `hooks/useBuyToken.ts` (invalidate cache), `hooks/useTokenDetails.ts` (polling) |
| 9 — README + visual proof | ✅ | this file + `demo/` |
| Bonus — launch your own token | ✅ | `components/LaunchTokenForm.tsx`, `hooks/useLaunchToken.ts` |
| Bonus — sell | ✅ | `components/SellForm.tsx`, `hooks/useSellToken.ts` |
| Bonus — sort + search | ✅ | `components/TokenList.tsx` |
| Bonus — finish graduation (`createGraduatedPool`) | ✅ | `components/TradePanel.tsx`, `hooks/useGraduateToken.ts` |
| Bonus — token detail page with trade history | ❌ | not implemented; description/socials/creator are shown in the Details tab instead |

### Screenshots

| File | What it shows |
| --- | --- |
| `demo/01-desktop-list.png` | Token list, tokens discovered from events (more than the 5 samples), prices and progress |
| `demo/02-desktop-buy-form.png` | Buy panel for TAXED (10 % creator tax) with the live estimate |
| `demo/03-desktop-graduated-token.png` | GRAD in phase 2 — no price, buy disabled |
| `demo/04-mobile-list.png` | 390 px layout |
| `demo/05-mobile-buy-form.png` | Buy panel as a full-screen sheet on mobile |
| `demo/06-desktop-launch-token-form.png` | Bonus launch form |

`demo/README.md` explains how they were produced (headless Chrome over the DevTools Protocol,
so they can be regenerated by anyone).

---

## 3. Architecture and key technical decisions

```
app/
  layout.tsx           root layout, fonts, metadata (server component)
  providers.tsx        'use client' — WagmiProvider + QueryClientProvider
  page.tsx             'use client' — composition, polling, selection, deep links
  globals.css          Tailwind v4 entry + design tokens
components/            presentational + interaction components (wallet/, token/, launch/)
hooks/                 all on-chain data and transaction state
lib/
  chain.ts             viem chain definition (RPC, explorer, Multicall3)
  contracts.ts         every address + the 50 000-block chunk size
  wagmi.ts             createConfig (single chain, injected connector, ssr)
  abi/                 generated `as const` ABIs
  bondingCurve.ts      pure bigint curve math (quoteBuy / quoteSell / slippage / price / progress)
  launchpad.ts         chunked TokenLaunched discovery
  errors.ts            wallet/RPC/custom-error → human message
  format.ts            display-only formatting (tiny prices, compact token amounts)
  tokenInput.ts        parse/validate user input without floats
  phase.ts             GraduationPhase → label/badge/behaviour
scripts/               dev-only helpers (verification, screenshots, ABI generation)
technical-brief/       the brief and the provided ABIs (unmodified)
```

Key decisions and why:

1. **Discovery is the only source of tokens.** No address of any sample token appears anywhere
   in the source. `lib/launchpad.ts` scans `TokenLaunched` from the factory deploy block
   (`129157568`) to `latest` in 50 000-block chunks — the public RPC rejects larger ranges — with
   4 requests in flight, and deduplicates by token address. The scan is repeated by the polling
   interval rather than cached behind a cursor: it costs ~11 requests today and it stays correct
   if a launch lands while the page is open or the node reorgs.
2. **Per-token reads are one flat Multicall3 batch.** `hooks/useTokenDetails.ts` builds a
   fixed-stride contract array (13 calls per token: name, symbol, logo, decimals, description,
   `getReserves`, `realQuoteReserve`, `graduationThreshold`, `readyToGraduate`, `feeBps`,
   `creatorTaxBps`, `getLaunchedToken`, `balanceOf`) and sends it through `aggregate3` with
   `allowFailure: true` and `batchSize: 64`. One broken token degrades to a partial card instead
   of blanking the list.
   `balanceOf` is always included (with `0x0` when disconnected) so the array shape — and
   therefore the index arithmetic — never changes.
3. **All arithmetic is `bigint`.** `lib/bondingCurve.ts` is pure and framework-free. Wei values
   are never converted to `Number`; the only `Number()` calls are on values that are already
   display quantities (a basis-point percentage, a list index, `phase`).
4. **Prices are formatted for real magnitudes.** Prices here are ~1e7–1e8 wei per token, so
   `formatUnitsSignificant` renders significant digits and falls back to subscript notation
   (`0.0₁₀2092`). `0.00` is never shown; when a curve has no tokens left the price is `—`.
5. **Progress is computed in the contract's own terms.** `realQuoteReserve / graduationThreshold`
   in basis points, capped at 10 000. That is exactly the contract's trigger: `initialize()`
   reserves `supply · phantomQuote / (phantomQuote + threshold)` tokens, and the constant-product
   invariant means the sellable allocation hits zero exactly when the real quote reserve reaches
   the threshold.
6. **The estimate is a client-side prediction, the receipt is the truth.** The UI shows the
   formula result, but on success it parses `CurveBuy` out of the receipt (`parseEventLogs`) and
   reports *that* `tokensOut`; if the event were missing it falls back to the recipient's balance
   delta.
7. **Slippage is applied to the estimate, not to the reserves.** `minTokensOut =
   tokensOut · (10000 − slippageBps) / 10000`, default 1 %, with 0.5/1/2/5/10 % presets.
8. **One place decides "can this transaction be sent".** `BuyForm`/`SellForm` collect blockers
   (not connected, wrong chain, unparseable/zero/over-precise amount, insufficient balance, zero
   output, phase ≠ 0, curve already `readyToGraduate`, non-ETH pair) and disable the button. The
   buttons stay *enabled* when the fix is a wallet action, so clicking *is* the fix (connect /
   switch network). The shared curve predicates live in `lib/phase.ts` (`isGraduationPending`).
9. **Errors are translated, never dumped.** `lib/errors.ts` maps the contract's custom errors
   (`SlippageExceeded`, `CurveGraduated`, …) plus wallet rejection, insufficient funds and chain
   mismatch to short readable messages. Raw hex is never rendered.
10. **`msg.value` equals `quoteIn` exactly** (`NativeValueMismatch` otherwise), and `recipient`
    is always the connected account.
11. **The query cache is the refresh mechanism.** A successful buy/sell invalidates the TanStack
    Query cache, so the list, the panel and both wallet balances re-read chain state with no page
    reload. The list also polls (20 s) and the details poll (15 s), so other people's buys show up
    on their own.
12. **Minimal dependency surface.** Next.js 16 + React 19 + wagmi v3 + viem v2 + TanStack Query v5
    + Tailwind v4 + `lucide-react` (icons). No ethers.js, no RainbowKit, no Redux/Zustand, no
    backend, no API routes, no databases. `multiInjectedProviderDiscovery` is off so there is one
    connect button instead of one per EIP-6963 announcement, and `ssr: true` keeps the server and
    first client render identical.
13. **ABIs are generated, not hand-written.** `scripts/generate-abis.mjs` filters
    `technical-brief/abi/*.json` into typed `as const` modules under `lib/abi/` (all custom errors
    kept so viem can decode reverts). Re-run it rather than editing those files.

### Deep links

`/?token=0x…` preselects a token and opens its trade panel — implemented with
`useSyncExternalStore` (`hooks/useQueryParam.ts`) so the server render stays deterministic and
there is no hydration mismatch.

---

## 4. Contract configuration

Everything comes from the brief's table and was re-verified against the live chain and the
Sourcify source (`https://repo.sourcify.dev/46630/0x533cE670f1372cb402D49866608b92e7bc2b4493`).

| | |
| --- | --- |
| Chain id | `46630` |
| Native currency | ETH, 18 decimals |
| Factory deploy block | `129157568` |
| `eth_getLogs` limit | 50 000 blocks per request (chunk size used) |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |

At the time of writing (block ~129.7M):

| Read | Value |
| --- | --- |
| `launchFee()` | `500000000000000` wei = 0.0005 ETH |
| `launchConfigCount()` | 2 |
| `getLaunchConfig(0)` | supply 1e27, curveFeeBps 100, phantomQuote 1.68e18, threshold 4.2 ETH |
| `getLaunchConfig(1)` | supply 1e27, curveFeeBps 100, phantomQuote 1.68e16, threshold **0.042 ETH** |
| `maxCreatorTaxBps()` | 1000 (10 %) |
| `previewLaunchEconomics(1, 0x0)` | `0x416423331ca6d9743485ce8245e1e90c61c04176b119bc0224ad64d76cd7537e` (moves with fee policy) |

Phases (`enum GraduationPhase`): `0 NotGraduated` (buyable), `1 Swept`, `2 PoolCreated`,
`3 Rescued`.

---

## 5. Findings — where the brief and the contracts disagree

The brief says the contract source wins. Everything below was checked against the verified
Sourcify source of the deployed factory/curve and against live reads. Nothing in the brief turned
out to be *wrong*; these are the places where it is incomplete or could mislead.

1. **The brief omits the anti-snipe tax from the buy formula.** The deployed
   `BondingCurve.buy()` charges `snipeTax = spent · snipeTaxBps / 10000` on top of the fee and
   creator tax, where `snipeTaxBps` starts at **9900 (99 %)** in the launch second and decays
   exponentially to zero over **15 s** (`snipeTaxStartBps`, `snipeTaxSeconds`). The brief's
   formula therefore *over-estimates* the tokens received for a buy placed in the first seconds of
   a brand-new launch. Note that the contract also clamps the total take so a buyer keeps at least
   1 % of their spend. This does not affect the sample tokens (all long past their window) and does
   not affect the receipt, which is authoritative. It *is* worth knowing if you launch a token
   yourself and buy it immediately — which is exactly why the launch form does not auto-buy.
2. **"Curve reserve" includes virtual liquidity.** `getReserves()` returns
   `quoteReserve = phantomQuote + trackedQuote − quoteFeeBalance − creatorTaxBalance`. For config 1
   the phantom reserve is `0.0168 ETH`, so for a fresh token the reported `quoteReserve` is
   `0.0168 ETH` while `realQuoteReserve()` (the "ETH collected" figure) is `0`. The brief is
   correct to list both, but price (`quoteReserve / tokenReserve`) and progress
   (`realQuoteReserve / graduationThreshold`) deliberately come from different quantities — the
   price is not `raised / supply`.
3. **`SlippageExceeded` is a price bound, not a quantity bound.** The contract checks
   `spent · minTokensOut > received · tokensOut`. That is identical to `tokensOut >= minTokensOut`
   when the full amount is spent, but a buy that would cross the curve's reserved allocation is
   **clipped and refunded** (`CurveBuyRefunded`) rather than rejected. So the last buy before
   graduation can succeed with fewer tokens (and less spent) than requested. Our
   `minTokensOut` derivation is still correct; the receipt event's `quoteIn` is what was actually
   spent, and the success message reports the event's `tokensOut`.
4. **A graduated token has no price at all.** After graduation the curve hands its reserves to
   the factory, so `tokenReserve == 0` and `realQuoteReserve == 0` for GRAD (phase 2). Dividing
   would be a division by zero, and `0.00` would violate the brief's formatting rule. The UI shows
   `—` for the price, `Graduated` instead of a progress percentage, and disables the forms.
5. **`getLaunchedToken()` does not revert for unknown tokens.** It returns a zeroed struct, so
   `phase == 0` with `exists == false` means "not a factory launch" rather than "on the curve".
   The app never relies on this (the event log is the source of truth) but it is a trap if you use
   the struct as a membership test.
6. **Chunk count.** The brief says "about 7 requests today". At the time of writing the
   deploy-block → head span is ~540 000 blocks, i.e. **11** requests. The code derives the count
   from `latest`, so it stays correct as the chain grows.
7. **The testnet is shared.** Extra `TEST` tokens launched by other candidates are already
   present (8 launches at the last capture, versus the 5 sample tokens), so the list shows more
   than five. That is the intended behaviour and doubles as proof that discovery is dynamic — no
   code change was needed for them to appear. All five sample tokens are present at the expected
   addresses.
8. **Non-ETH pairs are allowed by the factory but none exist yet.** `pairToken` is
   `address(0)` for every launch observed so far. The UI keeps such tokens in the list (flagged
   `Non-ETH pair`) and disables buy/sell for them, with the reason shown, rather than hiding them.
9. **`Phase 1` has no sample token.** The brief mentions this; the code handles phase 1 anyway,
   including the optional `createGraduatedPool(token)` button.
10. **Dev-only hydration warning.** With `next dev` (Turbopack) React logs a hydration mismatch on
    the `<html>` element's `next/font` variable classes. It is a Next.js dev-server artifact: the
    production build loads with **no console errors or warnings** (checked by driving the built app
    in headless Chrome and capturing the console — see `scripts/screenshots.mjs`).
11. **A curve can be closed while the factory phase still says `NotGraduated`.** `buy()` refunds
    past the reserved allocation instead of rejecting, so the last buy can leave
    `sellableTokens() == 0`. At the end of that same buy the curve calls
    `factory.graduate(token)` inside `_tryAutoGraduate`, which swallows a failed graduation
    preflight and only emits `AutoGraduationFailed`. The curve is then closed on **both** sides —
    `sell` reverts `if (graduated || readyToGraduate())`, and `buy` reverts on its own
    `sellable == 0` check — while `phase` is still `0`. So `phase == 0` is not sufficient to mean
    "tradeable": the authoritative flag is the curve's `readyToGraduate()`
    (`sellableTokens() == 0`, `false` once `graduated`), which the app reads through Multicall3 and
    blocks both forms on. There is deliberately **no button** for this state: `createGraduatedPool`
    requires phase `1` (`Swept`), `graduate` re-runs the preflight that just failed, and `sell`/`buy`
    are closed by design so the pool still seeds at the deterministic graduation price. The panel
    explains that instead of offering an action that cannot work. No sample token is in this state
    (all five read `readyToGraduate == false`), so the guard is verified against the source and the
    live selector rather than by demoing it; `scripts/verify-onchain.mjs` prints the flag per token.

---

## 6. Verification performed

Automated:

- `npm run lint`, `npm run typecheck`, `npm run build` — all clean.
- `node scripts/verify-onchain.mjs` — dumps the live launch records. Used to confirm the five
  sample tokens, the phase values, `launchFee()`, the launch configs and the economics digest.
- `node scripts/verify-buy-quote.mjs 0x505181e3114a6d147839Cb809C84d4e83575a97C 0.001` — the
  headline check. It drives the real buy **and sell** forms in a real browser and compares the UI
  value, the Node formula and the contract:

  ```
  BUY  0.001 ETH
    UI                 tokensOut=33975002796257252613307588
    node               tokensOut=33975002796257252613307588
    contract eth_call  tokensOut=33975002796257252613307588
    UI                 minTokensOut=33635252768294680087174512
    UI                 fee=10000000000000  creatorTax=100000000000000
  SELL 1 TAXED
    UI                 quoteOut=22345857
    node               quoteOut=22345857
    contract eth_call  quoteOut=22345857

  PASS  buy: UI tokensOut == node estimate
  PASS  buy: UI fee == node fee
  PASS  buy: UI creatorTax == node creatorTax
  PASS  sell: UI quoteOut == node estimate
  PASS  buy: node estimate == contract tokensOut
  PASS  buy: UI estimate == contract tokensOut
  PASS  sell: node estimate == contract quoteOut
  PASS  sell: UI estimate == contract quoteOut
  ```

  The `eth_call` also proves both calls are well-formed: correct selector, correct argument order,
  `msg.value == quoteIn` for the buy, and a curve state that accepts them. The sell simulation
  overrides only the caller's ERC-20 balance/allowance storage slots (slot 0 and slot 1 of the
  token), so the curve's own pricing logic runs against real reserves.
- Headless-Chrome console capture over all six screenshots — no errors or warnings in the
  production build.
- **Fresh-clone run:** the pushed branch was cloned into an empty directory, installed with
  `npm ci`, then `npm run lint`, `npm run typecheck` and `npm run build` were run in that order — all
  clean. This is what caught the `next typegen` requirement documented above.

Manual (what you should do, and what I could not):

- Connect MetaMask, check the balance and the network banner, then **buy a token** (FRESH, EARLY
  and TAXED are the safest) and confirm: pending state, explorer link, success message with the
  received amount, and that the card's price/progress plus your balances update without a reload.
- Sell a small amount back (FRESH/EARLY have the most headroom) to exercise the approve → sell
  flow. Sell uses the same verified formula and the same receipt parsing (`CurveSell`).
- Launch your own token from the bonus form (name + ticker `TEST`, launch config `1`). The form
  is implemented and its inputs are verified; the broadcast still has to be signed by you.

**Not executed in this session:** the actual broadcast of a buy/sell/launch transaction. The
environment this was built in had no funded MetaMask account to sign with, and testnet keys/seed
phrases must never be committed. The transaction code path is therefore verified by contract
simulation and by construction, not by a mined hash — that is the main thing to confirm in the
live demo.

---

## 7. What is unfinished

- **No mined buy/sell/launch transaction was produced** (see above). Everything up to signing is
  verified against the live contract, including the exact `tokensOut`/`quoteOut` the curve returns.
- **Token detail page with trade history** (a listed bonus) is not implemented. The Details tab
  shows description, creator, deployer, socials, launch config, thresholds and the contract
  addresses; there is no `CurveBuy`/`CurveSell` history table.
- **The anti-snipe tax is not modelled in the estimate** (see finding 1). The UI shows the brief's
  formula and the receipt corrects it.
- **Full log rescan on every poll.** Fine at this chain size (~11 requests / 20 s); a real
  deployment would move discovery to an indexed backend or keep a persisted cursor.
- **No automated test suite.** Verification is via the scripts above plus the browser run; adding
  unit tests for `lib/bondingCurve.ts` and `lib/format.ts` would be the first next step.
- **Non-ETH pair tokens cannot be traded** in this UI even though the factory supports them.

---

## 8. AI assistance

This project was written with an AI coding agent (Pi, driving Claude) working from the brief, the
provided ABIs and the verified Sourcify source. Concretely:

- **AI-written:** essentially all of the code — `lib/*`, `hooks/*`, `components/*`, `app/*`, the
  three `scripts/*.mjs` helpers, this README, and the AGENTS.md guidelines.
- **AI-run verification:** reading the Sourcify source to confirm the curve formula, the
  `GraduationPhase` enum and the custom errors; `effect`-free rewrites to satisfy the React
  Compiler lint rules; the `eth_call` simulation harness; the headless-Chrome console and
  screenshot harness.
- **Human responsibilities:** the stack choice, the design direction, the decision to include the
  sell/launch/graduation bonuses, and reviewing/demoing the result. The brief is explicit that you
  must understand every part of what you hand in, including the AI-assisted parts.

The AI was deliberately *not* allowed to: add dependencies, copy code or addresses from other
projects, hardcode the sample tokens, use `Number` for chain values, or push anything to GitHub.

---

## 9. Demo notes

- Leave the app running with `npm run dev` and demo from a fresh clone using the steps in
  [section 1](#1-running-it).
- Suggested demo path: show the list populating from events (well over five tokens, including
  ones launched by other candidates) → connect wallet and switch/add the network → open TAXED and
  type an amount so the estimate and the fee/creator-tax split update as you type → buy → point at
  the price/progress and balance changing on their own → open GRAD to show the disabled state →
  show `Details` → show the bonus launch form → show `scripts/verify-buy-quote.mjs` proving the
  numbers match the contract.
- The screenshots in `demo/` were captured from the production build and can be regenerated with
  `node scripts/screenshots.mjs http://localhost:3000 demo`.
