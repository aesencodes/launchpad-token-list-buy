# Audit: does this repo satisfy every acceptance criterion in `TASK-BRIEF.en.md` steps 1–9 and the hand-in list?

**Ticket:** #3 — "Audit the repo against brief steps 1-9 and evidence every criterion".
**Date of audit:** measured at block `129 742 791` on Robinhood Chain Testnet (chain id `46630`).
**Audited revision:** branch `development`, working tree **clean** when this audit started, app code at
the pushed commit `4875d6a` (`origin/development`); local `development` was one docs-only commit
ahead (`573a6c5`).

> **Line-number note (read this before checking citations).** Every `file:line` citation below is
> anchored to that clean tree (`573a6c5`; application code identical to the pushed `4875d6a`, and
> `README.md`/`AGENTS.md` as committed). Part-way through the audit a **concurrent ticket** started
> an uncommitted change that touches eight tracked files: `README.md`, `AGENTS.md`,
> `components/BuyForm.tsx`, `components/SellForm.tsx`, `components/TradePanel.tsx`,
> `hooks/useTokenDetails.ts`, `lib/tokens.ts`, `scripts/verify-onchain.mjs`. It adds a
> `readyToGraduate()` read as a 13th multicall field and a `token.readyToGraduate` blocker to both
> trade forms — i.e. it implements the README §7 item "Sell does not warn when the curve is
> `readyToGraduate` but the phase flag is still 0" (now a new README finding 11, and that §7 bullet
> deleted).
> Effect on this audit: **no verdict changes** — the guard only *tightens* the disabled state,
> which the brief already requires. Effect on citations: in the current working tree those files
> have shifted by a few lines (`BuyForm.tsx` +11 from ~line 75, `useTokenDetails.ts` +3,
> `TradePanel.tsx` +14, `lib/tokens.ts` +6, `README.md` +15 from ~line 286, `AGENTS.md` +7 from
> ~line 136), the flat multicall is now 13 calls per token rather than 12 (row 4.9), README §5 has
> 11 findings rather than 10, and README §7 has six bullets rather than seven. All §3 claims below
> are about the committed README; none of them is the item this concurrent change is fixing.
> Re-check those specific numbers against the tree you are reading.

## Question

Does this repository, as it stands, satisfy every acceptance criterion in
`technical-brief/TASK-BRIEF.en.md` steps 1–9 and the "What to hand in at the end of the session"
list — and what is the evidence for each?

**Short answer: everything except proof of a mined transaction.** Every repo-verifiable criterion
for steps 1–9 is met and evidenced below. Step 7's "Done when: you have bought one of the sample
tokens" and step 8's "Done when: the numbers change on their own after a successful buy" are
**unverified**: no mined buy exists in the repository, in the README, or in the demo assets, and
the only transaction-shaped harness (`scripts/verify-buy-quote.mjs`) performs `eth_call`
simulations, never a broadcast. Hand-in item 4 (app left running from a fresh clone) is likewise
unverified. The README also contains eight claims that the repository does not support; the two
material ones are a snipe-tax window of "15 s" (the live value is 3 s) and a screenshot that is
advertised as showing a live estimate but shows an empty input.

## Primary sources used

| Source | What it owns | How it was read |
| --- | --- | --- |
| `technical-brief/TASK-BRIEF.en.md` | the criteria themselves | read in full (452 lines) |
| repository source | the implementation | read directly, `file:line` cited below |
| `technical-brief/abi/*.json` | the ABIs actually shipped to the candidate | parsed with Node |
| Sourcify verified source of the deployed factory | contract behaviour, and therefore the correct formula | `https://sourcify.dev/server/v2/contract/46630/0x533cE670f1372cb402D49866608b92e7bc2b4493?fields=sources` (the `repo.sourcify.dev` link in the brief is the UI for that same record); 87 sources, incl. `src/v2/BondingCurve.sol`, `src/v2/LaunchFactory.sol`, `src/v2/LauncherToken.sol`, `src/v2/libraries/BondingCurveMath.sol`, `src/v2/interfaces/ILaunchpadV2.sol` |
| live Robinhood Chain Testnet (public RPC) | current on-chain state | `node scripts/verify-onchain.mjs` and ad-hoc read-only `eth_call`s |
| `README.md`, `AGENTS.md` | **claims only**, never evidence about the contracts | checked against the sources above |

Deliberately **not** used as evidence: `AGENTS.md`, `README.md`, `PROMPT.md`. They are treated in
§3 as claims to be falsified.

---

## 1. Verdict table

Verdicts are exactly **met / partially met / unverified**.

| # | Criterion (brief wording, shortened) | Where it is met | Evidence | Verdict |
| --- | --- | --- | --- | --- |
| **1.1** | Create a frontend project | `package.json`, `app/`, `components/`, `hooks/`, `lib/` | Next.js 16.3.8 + React 19 + wagmi 3.7.7 + viem 2.57.3 + `@tanstack/react-query` 5.104.1 (note: git shows `development` was forked from `585c83d feat: initialize project` on `main`) | met |
| **1.2** | Register Robinhood Chain Testnet as a chain from the brief's table | `lib/chain.ts:13-34` (`id: 46630`, name, ETH/18, RPC `https://robinhood-sepolia-rpc.publicnode.com`, explorer, `contracts.multicall3`); `lib/contracts.ts:8-12, 19, 25` (factory `0x533cE670…b4493`, multicall3 `0xcA11bde05977b3631167028862bE2a173976CA11`, deploy block `129_157_568n`, chunk `50_000n`) | values match the brief's "What you need" table one-to-one; only `lib/chain.ts` and `lib/contracts.ts` hold addresses (`git grep` for address literals shows none in `app/ components/ hooks/ lib/`) | met |
| **1.3** | **Done when:** the app reads `launchFee()` from LaunchFactory and shows the result | `app/page.tsx:40-45` (`useReadContract … functionName: "launchFee"`), rendered at `app/page.tsx:100` as a header badge | live `launchFee()` = `500000000000000` wei = 0.0005 ETH (`node scripts/verify-onchain.mjs`, line 3 of its output); `demo/01-desktop-list.png` shows the badge `launchFee 0.0005 ETH` in the header | met |
| **2.1** | Add connect and disconnect buttons | `components/WalletBar.tsx:54-64` (Connect wallet), `:84-92` (disconnect icon button) | rendered from `useWallet()` (`hooks/useWallet.ts:34-46, 88-113`) | met |
| **2.2** | Show the wallet address and its ETH balance once connected | `components/WalletBar.tsx:69-83` (`shortenAddress`, copy button, balance badge); balance read at `:42-47` via `useBalance({ address, chainId: robinhoodTestnet.id })` | the explicit `chainId` is what makes the number correct on the wrong network; `app/page.tsx:49-53` reads the same balance for the buy form | met |
| **2.3** | Wrong network → warning + switch button | `components/NetworkBanner.tsx:27-51` (`Wrong network — your wallet is on chain …` + `Switch to Robinhood Chain Testnet`) | `hooks/useWallet.ts:79-86` calls `switchChainAsync({ chainId: 46630 })`; `canSwitchChain` gate at `NetworkBanner.tsx:40` | met |
| **2.4** | The button must also add the network when MetaMask does not know it | `hooks/useWallet.ts:48, 79-86` → wagmi's injected connector | `node_modules/wagmi/node_modules/@wagmi/core/dist/esm/connectors/injected.js:323-327` catches `error.code === 4902` and then calls `wallet_addEthereumChain` with `chainName`/`nativeCurrency`/`rpcUrls`/`blockExplorerUrls` derived from the chain object — which `lib/chain.ts:13-34` fully defines (RPC + explorer + currency). Claim in `README.md:60-62` holds | met |
| **2.5** | **Done when:** a user can connect, see their balance, and be guided to switch when on the wrong network | controls + wiring as above | implementation is complete and standard, but **no recorded run exists**: all six `demo/*.png` are captured in the disconnected state (`demo/README.md:20-23`), so connect → balance → wrong-network banner was never demonstrated with a wallet | partially met |
| **3.1** | Read `TokenLaunched` from the deploy block, chunked at ≤50 000 blocks | `lib/launchpad.ts:6-9, 49-93`; `lib/contracts.ts:19, 25`; `hooks/useTokenLaunches.ts:30-58` | brief's signature matches the provided ABI exactly (`technical-brief/abi/LaunchFactory.json` → `TokenLaunched(token,curve,deployer indexed, pairToken, launchConfigId, graduationThreshold)`), and `lib/launchpad.ts:6-9` takes the event from that ABI rather than re-declaring it; the live scan produced 12 chunk requests for 585 224 blocks and 10 launches, and the 5 sample tokens are in the *first* chunk (`129157568-129207567: 5 logs`) | met |
| **3.2** | Tokens paired with another asset: show them correctly or filter them out and say so in the README | `components/TokenCard.tsx:116-130` (`Non-ETH pair` badge, Buy button suppressed), `components/BuyForm.tsx:73` (blocker "This token is paired with a non-ETH asset…"), `README.md:278-282` | `pairToken == address(0)` is expressed once as `NATIVE_PAIR_TOKEN` in `lib/contracts.ts:31` and compared in `BuyForm.tsx:51`, `TokenList.tsx:210-212`, `TokenDetailsCard.tsx:68`; live launch dump: `pairToken=0x0000000000000000000000000000000000000000` for all 10 launches, so nothing is hidden today | met |
| **3.3** | Pick up tokens launched after the page was opened (poll, watch, or refresh) | polling: `hooks/useTokenLaunches.ts:43` (`refetchInterval`, default 20 s from `:30`); manual refresh: `components/TokenList.tsx:126-138` refresh button → `app/page.tsx:68-73` | both mechanisms are present (the brief asks for one) | met |
| **3.4** | **Done when:** the app finds the five sample tokens | same discovery path | live: all five addresses appear in the scanned logs — FRESH `0xFaeA3Da0…8090`, EARLY `0xB1A6865b…85d7`, HALF `0xC3e22b78…6926`, TAXED `0x505181e3…a97C`, GRAD `0xD3226672…dDE0` (`node scripts/verify-onchain.mjs`, 10 launches total); `demo/01-desktop-list.png` shows the five sample cards (FRESH, EARLY, HALF, TAXED, GRAD) among 8 discovered tokens | met |
| **4.1** | `name()`, `symbol()`, `logo()` on the token | `hooks/useTokenDetails.ts:64-68` (fields 1–3 of the flat multicall), `:20-33` (`FIELDS` stride), consumed at `lib/tokens.ts:8-17` | live: FRESH `name=Fresh Launch`, `symbol=FRESH`, `logo=""`; TAXED `name=Creator Tax` | met |
| **4.2** | `getReserves()` on the curve → `(quoteReserve, tokenReserve)` | `hooks/useTokenDetails.ts:69` (field `reserves`), destructured at `:124-126` | live FRESH: `quoteReserve=16998000000000000 tokenReserve=988351570773032121426050125`; the contract confirms the meaning: `getReserves()` returns `phantomQuote + trackedQuote − quoteFeeBalance − creatorTaxBalance` and `trackedTokens` (`src/v2/BondingCurve.sol:368-371`, Sourcify) | met |
| **4.3** | `realQuoteReserve()` | `hooks/useTokenDetails.ts:70`; surfaced as "Raised" (`TokenCard.tsx:69-76`) and "Real ETH collected" (`TradePanel.tsx:140`) | contract: `realQuoteReserve() = trackedQuote − quoteFeeBalance − creatorTaxBalance` (`BondingCurve.sol:384-386`) | met |
| **4.4** | `graduationThreshold()` on the curve | `hooks/useTokenDetails.ts:71`, with the event value as fallback (`:132-133`) | live FRESH/EARLY/HALF/TAXED = `42000000000000000` (0.042 ETH), matching config 1 | met |
| **4.5** | `getLaunchedToken(token).phase` from the factory | `hooks/useTokenDetails.ts:74-79`, `:134-138` | struct field order in the call matches `technical-brief/abi/LaunchFactory.json` and the Sourcify struct (`ILaunchpadV2.sol:113-140`); live phases: FRESH/EARLY/HALF/TAXED = 0 `NotGraduated`, GRAD = 2 `PoolCreated` — identical to the brief's own "State" column | met |
| **4.6** | Current price = `quoteReserve / tokenReserve`, readable, never `0.00` | `lib/bondingCurve.ts:95-101` (`spotPriceWeiPerToken`, returns `null` when `tokenReserve == 0n`), formatted by `lib/format.ts:24-53, 94-97` | live FRESH price `17198333` wei/token renders as `0.0₁₀1719` (screenshot `demo/01-desktop-list.png`, FRESH card "SPOT PRICE 0.0₁₀1719 ETH"); GRAD (`tokenReserve == 0`) renders `—`, never `0.00` (`demo/03-desktop-graduated-token.png`) | met |
| **4.7** | Graduation progress = `realQuoteReserve / graduationThreshold`, capped at 100 %, computed with `bigint` | `lib/bondingCurve.ts:105-109` (`graduationProgressBps`, `MAX_PROGRESS_BPS = 10_000n` at `:12`) | live: FRESH `47` bps (0.47 %), HALF `4923` (49.2 %), TAXED `890` (8.9 %); the contract defines graduation as the token allocation reaching zero, equivalent to the real quote reserve hitting the threshold (`BondingCurve.sol:396-403`, `initialize()` at `:269-295`) | met |
| **4.8** | `phase` semantics 0–3, each with a meaning | `lib/phase.ts:6-18` (enum) and `:29-72` (`PHASE_META`: label, short label, description, buyable flag at `:32-59`; `UNKNOWN_PHASE` guard at `:62`) | labels verified against `src/v2/interfaces/ILaunchpadV2.sol:101-106` (`NotGraduated, Swept, PoolCreated, Rescued` — same order); only phase 0 is `buyable: true`, matching the brief | met |
| **4.9** | Use Multicall3 (`aggregate3`, `allowFailure`) | `hooks/useTokenDetails.ts:90-101` (`useReadContracts({ contracts, allowFailure: true, batchSize: 64 })`), `lib/contracts.ts:28` | viem routes `allowFailure: true` through `aggregate3` (`node_modules/viem/_esm/actions/public/multicall.js:154, 236`); `lib/chain.ts:28-31` registers Multicall3 on the chain so wagmi batches; 12 calls per token (`FIELDS` at `:20-33`) in one request group — 13 in the uncommitted working tree, which adds `readyToGraduate` | met |
| **4.10** | **Done when:** all of the above is available for the five tokens | `hooks/useTokenDetails.ts:103-176` builds a `TokenSummary` per launch and degrades to `complete: false` + `failedReads` when a read fails | live values exist for all five (see 4.1–4.7); the screenshots render name, symbol, price, progress and phase for each of the five | met |
| **5.1** | Card/row with logo, name, symbol, price, progress bar, status label; every phase 0–3 has a label | `components/TokenCard.tsx` (logo `:44`, name/symbol `:46-53`, phase badge `:54`, price `:59-64`, raised `:69-76`, progress bar `:79-95`, phase fallback label `:82`) | `demo/01-desktop-list.png` shows all six elements per card; the progress bar for non-phase-0 tokens is replaced by the curve status and its label | met |
| **5.2** | Placeholder for an empty logo, and a fallback when the logo fails to load | `components/TokenLogo.tsx:18-27` (`LogoFallback`), `:69` (`Boolean(src) && isLoadableUrl(src)`), `:51` (`onError={() => setFailed(true)}`), `:37` (failed → fallback) | all five sample tokens return `logo=""` (live), so the placeholder path is the one exercised in every screenshot (initials "FRE", "EAR", "HAL", "TAX", "GRA"); the error path is a `useState` flip on `<img onError>` | met |
| **5.3** | Three views: loading, empty, failed-to-load with a retry button | `components/TokenList.tsx:80-82` (state selection), `:141-157` (error + "Try again" → `onRetry`), `:158-176` (skeletons), `:177-193` (empty + "Re-scan") | the error view's retry is wired to `app/page.tsx:68-73`, which refetches launches, details and `launchFee` | met |
| **5.4** | **Done when:** the list looks good on desktop and phone, and each of the three states has its own view | layout: `app/page.tsx:141-152` (`lg:grid-cols-[minmax(0,1fr)_400px]`), `components/TokenList.tsx:203` (`sm:grid-cols-2 xl:grid-cols-3`), `components/TradePanel.tsx:103` (full-screen sheet below `lg`), `app/layout.tsx` viewport defaults | `demo/01-desktop-list.png` (1440×1000) and `demo/04-mobile-list.png` (390×844) exist and were inspected: search/sort/refresh toolbar, 3-up card grid, readable cards, first paint not overflowing; the three state views are code-verified (their visual rendering is not screenshotted) | met |
| **6.1** | An input for the amount of ETH to spend | `components/BuyForm.tsx:114-141` (numeric input at `:134`, ETH suffix, MAX prefill at `:122-131`) | — | met |
| **6.2** | Estimated tokens from the brief's formula; `feeBps()`/`creatorTaxBps()` read from the curve; division rounds down | `lib/bondingCurve.ts:35-56` (`quoteBuy`), read at `hooks/useTokenDetails.ts:72-73`, used at `components/BuyForm.tsx:56-60` | **(the strongest evidence in this audit)** the UI formula reproduced against the contract by `eth_call` on live state, 3 tokens: FRESH 0.001 ETH → UI `54395600125934056049132178` = contract `54395600125934056049132178`; TAXED 0.001 ETH → both `33975002796257252613307588`; EARLY 0.005 ETH → both `172990154026523315102150610`. The contract's own arithmetic is `getAmountOut(spent − fee − tax − snipeTax, quoteReserve, tokenReserve, 0)` with `fee = spent·feeBps/10000`, `tax = spent·creatorTaxBps/10000` (`BondingCurve.sol:438-500`, `BondingCurveMath.sol:29-56`) — identical to the brief's formula when the snipe window is closed (all sample tokens: window inactive, measured) | met |
| **6.3** | Slippage tolerance setting, default 1 %, `minTokensOut = tokensOut·(10000−slippageBps)/10000` | `lib/tokenInput.ts:66-67` (`SLIPPAGE_OPTIONS_BPS = 50/100/200/500/1000`, `DEFAULT_SLIPPAGE_BPS = 100n`), `lib/bondingCurve.ts:84-88` (`applySlippage`), applied at `components/BuyForm.tsx:61-64`, UI at `components/SlippageSelector.tsx` | TAXED 0.001 ETH: UI `minTokensOut = 33635252768294680087174512` = `33975002796257252613307588 · 9900/10000` floor; the contract accepts it (the `eth_call` above used exactly that value as `minTokensOut`) | met |
| **6.4** | Disable the buy button when: no wallet / wrong network / empty / zero / invalid amount / balance too low / not phase 0 | `components/BuyForm.tsx:70-81` (blockers + `canSubmit`), `:302-311` (`disabled={!canSubmit}` at `:309`), separate wallet-action button `:289-300` | each of the seven conditions appears in `blockers`/`canSubmit`; `demo/05-mobile-buy-form.png` shows the disabled Buy button with "Connect wallet" rendered above it and the blocker line "• Connect your wallet to buy" | met |
| **6.5** | `bigint` arithmetic, `parseEther`, reject >18 decimals, no `Number` on wei | `lib/tokenInput.ts:35-63` (`DECIMAL_RE`, `fraction.length > decimals`, `parseEther`, `too-large` ceiling), `lib/bondingCurve.ts` (pure bigint) | `Number()` appears only on display quantities: `bpsToPercentNumber` (`bondingCurve.ts:112-114`), `Number(token.progressBps)/100` for a bar width (`TokenCard.tsx:25`, `TradePanel.tsx:99`), `Number(launched?.phase)` (`useTokenDetails.ts:136`), `Number(bps)/100` in `slippageLabel` (`tokenInput.ts:69-72`) — all permitted by the brief/AGENTS rule | met |
| **6.6** | **Done when:** the estimate updates as the user types, and the button is enabled only when the transaction can actually be sent | recompute is render-driven: `components/BuyForm.tsx:55-64` (`useMemo` keyed on `input` → `parsed` → `quote` → `minTokensOut`), `:70-81` (`canSubmit`) | updating on typing is a plain React render fact (no submit/debounce gate); "only when it can be sent" is enforced by the single `canSubmit` expression gating `disabled`; the numbers themselves are contract-verified (6.2/6.3) | met |
| **7.1** | `buy(quoteIn, minTokensOut, recipient)` payable, `value == quoteIn` | `hooks/useBuyToken.ts:95-104` (`args: [quoteIn, minTokensOut, recipient]` at `:100`, `value: quoteIn` at `:102`) | contract requires exactly this: `NativeValueMismatch(uint256 supplied, uint256 expected)` (`BondingCurve.sol:52`) and `_receiveQuote`/`msg.value` check; the `eth_call` in 6.2 passed a non-zero `value` and did not revert | met |
| **7.2** | `recipient` is the user's wallet address | `components/BuyForm.tsx:90-98` passes `recipient: address`; `app/page.tsx:144-155` → `components/TradePanel.tsx:184-193` | `address` comes from `hooks/useWallet.ts:97` (`connection.address`) | met |
| **7.3** | Tokens received = `tokensOut` from the `CurveBuy` event, not the estimate | `hooks/useBuyToken.ts:33-52` (`curveBuyFromReceipt` → `parseEventLogs({ eventName: "CurveBuy" })` at `:37`, matched on curve + recipient at `:41-46`), fallback to balance delta `:104-114` | the event exists with that shape and order: `event CurveBuy(address indexed buyer, address indexed recipient, uint256 quoteIn, uint256 tokensOut, uint256 fee, uint256 tax)` (`BondingCurve.sol:58-60`) and the matching entry is in the shipped ABI (`technical-brief/abi/BondingCurve.json`; generated `lib/abi/bondingCurve.ts:407`) | met |
| **7.4** | Five transaction states, each with a view | `hooks/useContractWrite.ts:20-31` (the states as `TxPhase`), rendered in `components/BuyForm.tsx`: awaiting-wallet (`:210-215`, "Confirm in wallet", button disabled because `loading={buy.isBusy}` at `:308`), pending + explorer link (`:216-235`), success + `tokensOut` + explorer link (`:236-261`), rejected (`:204-209`), reverted/failed (`:262-280`) | all five branches exist and are mutually exclusive on `buy.phase`; `lib/chain.ts:38-40` builds `…/tx/<hash>` exactly as the brief asks | met |
| **7.5** | Translate `SlippageExceeded` and `CurveGraduated`; complete error messages | `lib/errors.ts:19-28`, plus `NativeValueMismatch`, `InsufficientLiquidity`, `LaunchFeeNotPaid`, `NotWhitelisted`, `LaunchEconomicsMismatch` and wallet rejection (`:154-176`) | custom error names verified against the deployed source (`BondingCurve.sol` `SlippageExceeded`, `CurveGraduated`; `LaunchFactory.sol` `LaunchFeeNotPaid`, `NotWhitelisted`, `LaunchEconomicsMismatch`); the ABI used for decoding is the shipped one, and every custom error is retained by the generator (`scripts/generate-abis.mjs:92`) | met |
| **7.6** | **Done when (a):** each of the five states has a view | as 7.4 | code-verified only: no mined transaction means four of the five states have never been rendered on screen; the views exist and are reachable | met |
| **7.7** | **Done when (b):** you have bought one of the sample tokens | nowhere | **no evidence exists.** `README.md:343-347` states plainly: "the actual broadcast of a buy/sell/launch transaction" was never executed; `demo/README.md:20-33` repeats it; `git grep -E "0x[0-9a-f]{64}"` across `README.md` and `demo/` yields only the `previewLaunchEconomics` digest, i.e. no transaction hash anywhere; `scripts/verify-buy-quote.mjs` contains no `writeContract`/`sendTransaction`/`broadcast` call (`grep` over `scripts/*.mjs` returns nothing) — it only makes `eth_call` reads, with `stateOverride` for the sell leg (`verify-buy-quote.mjs:286`) | **unverified** |
| **8.1** | After success, update the bought token's price and progress | `hooks/useBuyToken.ts:118` (`await queryClient.invalidateQueries()`), query keys from `hooks/useTokenDetails.ts:39-41`, plus 15 s polling (`:94-101`) and 20 s launch polling | invalidation is unconditional and untargeted, so `["token-details", …]` is refetched; the same `TokenSummary` values feed the card and the panel | met |
| **8.2** | Update the user's ETH balance | same invalidation; the balance is a TanStack Query of wagmi (`components/WalletBar.tsx:42-47`, `app/page.tsx:49-53`) | wagmi v2+/3 exposes its reads as TanStack Query entries, which `invalidateQueries()` (no filters) marks stale → refetch on the next render of both consumers | met |
| **8.3** | Update the user's token balance, and show it in the buy form before the first buy | `hooks/useTokenDetails.ts:80-85` (`balanceOf` always part of the batch, `owner ?? ZERO`), surfaced at `components/BuyForm.tsx:193-201` ("Your token balance": `Connect to view` / formatted balance) | the row is rendered before any buy, from the same multicall as price/progress; `demo/05-mobile-buy-form.png` shows the row ("Connect to view") | met |
| **8.4** | The token list itself shows new numbers, not only the buy form | `app/page.tsx:144-155` passes the same `details.tokens` array to `TokenList`; invalidation + polling as 8.1 | card and panel read one array from one query — a refetch necessarily updates both | met |
| **8.5** | **Done when:** the numbers on screen change on their own after a successful buy | nowhere | depends on a mined buy, which does not exist (see 7.7). The refresh mechanism is present and correct by construction, but "the numbers changed on their own" was never observed | **unverified** |
| **9.1** | README: how to run the project | `README.md:22-47` (`git clone`, `npm install`, `npm run dev`; `npm run build && npm start`), plus the `npm run typecheck` caveat | the scripts exist and match (`package.json`: `dev`, `build`, `start`, `lint`, `typecheck`); `npm run lint` was re-run during this audit and is clean | met |
| **9.2** | README: key technical decisions and reasons | `README.md:117-203` (13 numbered decisions, each with a rationale) | spot-checked against code: ABI generation (`scripts/generate-abis.mjs`), bigint-only math (`lib/bondingCurve.ts`), generated ABIs reproducing byte-identically (see §4), no hardcoded discovery (`lib/launchpad.ts`) | met |
| **9.3** | README: what is unfinished | `README.md:351-369` (7 items) | each item was checked in §3; the section is candid and, with the exception of one overstated row in the step table, accurate | met |
| **9.4** | README: which parts AI helped with | `README.md:370-389` | present, specific, and consistent with the AGENTS.md guidelines | met |
| **9.5** | README: problems found in the brief or the contracts | `README.md:233-289` (10 findings) | four of the ten were re-verified against Sourcify/live state and hold (virtual liquidity, `SlippageExceeded` as a price bound, graduated token has no price, `getLaunchedToken` returns a zeroed struct); the snipe-tax finding states the right mechanism but the wrong window (§3) | met |
| **9.6** | Screenshots or demo video inside the repo | `demo/01…06*.png` + `demo/README.md`, all tracked (`git ls-files demo`) | 6 PNGs, 470 kB–531 kB, inspected: desktop list, desktop buy panel, graduated token, mobile list, mobile buy panel, launch form | met |
| **9.7** | **Done when:** someone else can run your project by following the README alone, and visual proof is included | `README.md:22-47`, `demo/` | visual proof is in the repo (met); the "someone else can run it" half rests on the README's own claim (`README.md:329-333`) and was **not** re-executed in this audit — `npm run build`/`next dev` are owned by another ticket and were out of scope here. `npm run lint` + a live `node scripts/verify-onchain.mjs` do pass on this checkout | partially met |
| **H1** | Push the code to a repository and give the link; no secrets, no `node_modules` | remote `origin https://github.com/aesencodes/launchpad-token-list-buy.git`; `origin/development = 4875d6a`, `origin/main = 585c83d` | `git ls-remote --heads origin` lists both branches; `node_modules/` and `.env*` are gitignored (`.gitignore:4, 33`); no `.env` file exists in the working tree; a secret-pattern grep of tracked files finds only documentation text | met (one docs-only commit, `573a6c5`, is local-only) |
| **H2** | Make sure the step-9 README is in that repository | `README.md` at the repo root, tracked | `git ls-files README.md` → present | met |
| **H3** | Screenshots or a short demo video inside the repo (e.g. `/demo`) | `demo/` | see 9.6 | met |
| **H4** | Leave the app running on your laptop for the demo, started with the README steps from a fresh clone | nothing in the repository can evidence this | operational act outside the repo; also outside this audit's constraints (no `npm run build`/`next dev`). The README claims a fresh-clone verification run (`README.md:329-333`) but no captured log is committed | **unverified** |

---

## 2. Every criterion that is not "met", and the smallest change that would meet it

Ordered by how much a supervisor would notice (see the ranking in the final report).

### 2.1 Step 7 "Done when: you have bought one of the sample tokens" — **unverified**

Not satisfiable by any script in this repository. The simulation harness is not a substitute: a
`eth_call` proves the call is well-formed and prices correctly, but it does not mine a
transaction, does not emit a `CurveBuy` log for the app to parse, and does not exercise
`waitForTransactionReceipt`.

Smallest change: from a throwaway funded MetaMask, buy a small amount of FRESH, EARLY or TAXED
through the form; then add the mined transaction hash (with its
`https://explorer.testnet.chain.robinhood.com/tx/<hash>` link) to `README.md` §6 and drop the
before/after screenshots into `demo/`. That single transaction also closes 2.2 and 2.3.

### 2.2 Step 8 "Done when: the numbers on screen change on their own after a successful buy" — **unverified**

Same root cause. The mechanism (`hooks/useBuyToken.ts:118`) is present and correct, and the two
polling intervals (15 s details, 20 s launches) mean numbers change without a reload even for
other people's buys — but the criterion is about *after a successful buy of your own*, and no such
buy exists.

Smallest change: perform the buy from 2.1 and capture one screenshot pair (before / after, no
reload) showing the card's price + progress and both balances. Or, if the demo is only video,
record the sequence.

### 2.3 Step 2 "Done when: a user can connect, see their balance, and be guided to switch when on the wrong network" — **partially met**

The controls, the balance read and the switch/add fallback are all in code and the wagmi fallback
is verified in the dependency's source. What is missing is any recorded run: all six screenshots
are disconnected (`demo/README.md:20-23`).

Smallest change: connect a throwaway wallet on chain 46630, screenshot the address + ETH balance
badge, then switch the wallet to another chain and screenshot the wrong-network banner with the
switch button. Two PNGs in `demo/`.

### 2.4 Step 9 "Done when: someone else can run your project by following the README alone" — **partially met**

The README's run steps (`README.md:22-47`) are complete and match `package.json`, and `npm run lint` passes on this
checkout. But the end state ("someone else can run it") was not re-executed here: build/dev are
owned by another ticket, and the README's fresh-clone claim has no committed artifact.

Smallest change: on a fresh clone, run `npm ci && npm run lint && npm run typecheck && npm run build`
and paste the tail of that output into `README.md` §6 (or add a `demo/fresh-clone.txt`). No code
change.

### 2.5 Hand-in item 4 "Leave the app running on your laptop for the demo, started with the README steps from a fresh clone" — **unverified**

Cannot be evidenced by a repository artifact at all; it is an operational act at demo time.

Smallest change: none in code — state the condition explicitly (which is the same fresh-clone run
as 2.4) and keep the shell history / the served `next start` process alive for the demo.

### 2.6 Hand-in item 1 — **met, with one caveat**

The repository exists and the app code is pushed (`origin/development = 4875d6a`). Local
`development` is one commit ahead with `AGENTS.md` + `docs/agents/*` only — no application code.
Smallest change if a supervisor wants the exact checkout pushed: `git push origin development`.

---

## 3. README claims that the repository does not support

Checked against code, live state and Sourcify. Claim first, then what the repo actually shows.

### 3.1 §5 finding 1: the anti-snipe window is "15 s" (`README.md:242`) — **does not hold**

> "…`snipeTaxBps` starts at **9900 (99 %)** in the launch second and decays exponentially to zero
> over **15 s** (`snipeTaxStartBps`, `snipeTaxSeconds`)."

The 9900 figure is right; the 15 s is not. Measured live:
`launchFee() = 500000000000000`, `snipeTaxStartBps() = 9900`, **`snipeTaxSeconds() = 3`** on the
factory, and every one of the five sample curves reports `snipeTaxSeconds = 3` (snapshotted at
`initialize()`, `BondingCurve.sol:269-295`, so the per-curve value is authoritative for the
sample tokens). `AGENTS.md` repeats the 15 s figure, so the error is duplicated in the repo's own
guidance. The decay shape is a 14-step right shift (`BondingCurve.sol:315-323`), i.e. halving per
`window/14`, which reaches zero at the end of the window — "exponentially" is a fair description,
"15 s" is not. Fix: read `snipeTaxSeconds` live (as `scripts/verify-onchain.mjs` already does for
`snipeTaxStartBps`) and state the measured value, or drop the number.

### 3.2 §3 decision 1: "No address of any sample token appears anywhere in the source" (`README.md:144`) — **overstated**

> "**Discovery is the only source of tokens.** No address of any sample token appears anywhere
> in the source."

True for the application (`git grep` finds no sample address under `app/ components/ hooks/ lib/`),
false for the repository: `scripts/screenshots.mjs:32,39,55` hardcodes TAXED and GRAD as deep-link
screenshot targets, and `scripts/verify-buy-quote.mjs:35` defaults to TAXED. These are dev-only
harnesses, which is why discovery still works without them, but the sentence as written ("anywhere
in the source") is wrong. Fix: qualify it — "no sample address appears in the app code; the dev
scripts default to TAXED/GRAD as example targets".

### 3.3 §3 decision 8: "The buttons stay *enabled* when the fix is a wallet action" (`README.md:176-177`) — **contradicts the code**

> "…and disable the button. The buttons stay *enabled* when the fix is a wallet action, so clicking
> *is* the fix (connect / switch network)."

The buy/sell button is disabled whenever a wallet action is outstanding:
`components/BuyForm.tsx:81` (`canSubmit` requires `isConnected && isSupportedChain`) feeding
`:309` (`disabled={!canSubmit}`), and the same in `SellForm.tsx:74-82`. Instead, a *separate*
enabled button is rendered above it (`BuyForm.tsx:289-300`, `SellForm.tsx` equivalent) — which is
exactly what `AGENTS.md` describes and what `demo/05-mobile-buy-form.png` shows (disabled "Buy
TAXED" under an enabled "Connect wallet"). Fix: reword to "a separate Connect wallet / Switch
network button is rendered above the disabled buy button".

### 3.4 §2 screenshot table: `demo/02-desktop-buy-form.png` "with the live estimate" (`README.md:106`) — **the screenshot does not show it**

The PNG was inspected: the amount input is empty (`0.0`), and every estimate row renders `—`
("You receive (estimate) — TAXED", "Minimum after 1 % slippage —", "Curve fee (1.0 %) —", …).
No checked-in artifact shows a populated estimate; the only estimate-vs-contract evidence in the
repo is the transcribed console output at `README.md:301-321`. (That transcript is credible: the
BUY line for TAXED at 0.001 ETH, `tokensOut=33975002796257252613307588`, reproduces exactly
against live state in this audit — see §4.) Fix: type an amount before capturing shot 02, or drop
"with the live estimate" from the caption.

### 3.5 §2 step table rows 7, 8 and the bonus launch row marked ✅ (`README.md:92-95`) — **overstated**

Rows 7 and 8 are ✅, but the brief's done-when for both is a mined buy, and the README itself says
in §6/§7 that no broadcast was ever executed. The bonus launch row is ✅ while §7 (`README.md:353-354`)
admits no launch transaction was produced, and the bonus's done-when requires a live token with the
ticker `TEST` that appears in the list and can be bought. Fix: use a third state for those rows
(e.g. "code ✅ / end-to-end not executed") instead of a bare ✅.

### 3.6 §3 architecture tree: `components/ … (wallet/, token/, launch/)` (`README.md:125`) — **wrong**

`components/` is flat — 12 `.tsx` files directly under it (`ls components/`), with no
subdirectories. `AGENTS.md` describes it correctly as flat. Fix: correct the tree.

### 3.7 Chunk-count claims "~11 requests today" / "~540 000 blocks, i.e. 11 requests" (`README.md:148, 270-272, 360`) — **stale**

Measured today: the deploy block → head span is `129 742 791 − 129 157 568 + 1 = 585 224` blocks,
which is **12** chunks at 50 000 (`node scripts/verify-onchain.mjs` prints all 12 ranges). The
code is correct (it derives the count from `latest`), only the prose number is stale. Fix: say
"the script's own output shows the current count" rather than a fixed number.

### 3.8 §6 evidence that is not reproducible from the repository (`README.md:290-347`) — **claim, not artifact**

- "`npm run lint`, `npm run typecheck`, `npm run build` — all clean": **`npm run lint` re-run in
  this audit and clean**; typecheck/build are owned by another ticket and were not re-run.
- "Fresh-clone run … all clean": no log committed.
- "Headless-Chrome console capture … — no errors or warnings in the production build": the harness
  exists and does capture console errors (`scripts/screenshots.mjs:160-168`), and `demo/README.md:45`
  records "Last run: no console errors or warnings", but the build/run is not reproducible in this
  audit (and `next dev`'s known hydration warning, `README.md:296-301`, is unverifiable here too).
- Everything in §4 ("Contract configuration") **was** re-verified live and holds exactly:
  `launchFee 0.0005 ETH`, `launchConfigCount 2`, config 0 `threshold 4.2 ETH / phantomQuote 1.68e18`,
  config 1 `threshold 0.042 ETH / phantomQuote 1.68e16`, `maxCreatorTaxBps 1000`,
  `previewLaunchEconomics(1, 0x0) = 0x416423331ca6d9743485ce8245e1e90c61c04176b119bc0224ad64d76cd7537e`.

### 3.9 §5 findings 4, 7, 8 — **verified, with drift in the snapshot numbers**

- Finding 4 (a graduated token has no price): live GRAD reports `tokenReserve = 0`,
  `realQuoteReserve = 0`, `phase = 2`; the UI renders `—` and "Graduated"
  (`demo/03-desktop-graduated-token.png`). Holds.
- Finding 7 ("8 launches at the last capture"): the count is now **10** launches (the chain is
  shared; this is drift, not error).
- Finding 8 (non-ETH pairs allowed but none exist): all 10 live launches report
  `pairToken = 0x0000000000000000000000000000000000000000`. Holds.
- Finding 5 (`getLaunchedToken` returns a zeroed struct for unknown tokens): confirmed by
  `LaunchFactory.sol:388-390` (a plain mapping read). Holds.
- Finding 3 (`SlippageExceeded` is a price bound + `CurveBuyRefunded` on a clamped fill):
  confirmed in `BondingCurve.sol:438-520`. Holds.
- Finding 2 (reserves include virtual liquidity): `getReserves()` at `BondingCurve.sol:368-371`
  is exactly `phantomQuote + trackedQuote − quoteFeeBalance − creatorTaxBalance`. Holds.

---

## 4. Primary-source evidence captured during this audit

All read-only. No transaction was broadcast; no tracked file was modified.

| Command | Result |
| --- | --- |
| `git status --porcelain` (start of audit) | empty — clean tree at `573a6c5` |
| `git status --porcelain` (end of audit) | eight modified files from a concurrent ticket: `README.md`, `AGENTS.md`, `components/BuyForm.tsx`, `components/SellForm.tsx`, `components/TradePanel.tsx`, `hooks/useTokenDetails.ts`, `lib/tokens.ts`, `scripts/verify-onchain.mjs` (`git diff --stat`: 75 insertions, 5 deletions — the `readyToGraduate` guard plus its README/AGENTS documentation); nothing staged; `docs/research/` is this new document |
| `node scripts/verify-onchain.mjs` | `latest block 129742791`, `launchFee 500000000000000 wei (0.0005 ETH)`, `launchConfigs 2`, `previewLaunchEconomics(1, 0x0) = 0x4164…537e`, 12 chunk requests, `total launches: 10`; FRESH/EARLY/HALF/TAXED `phase=0`, GRAD `phase=2`, all five `pairToken=0x0`, TAXED `creatorTaxBps=1000`, HALF `progressBps=4923` |
| ad-hoc `eth_call` comparison of `lib/bondingCurve.quoteBuy` vs the contract's `buy()` (3 tokens, current block) | FRESH 0.001 ETH `54395600125934056049132178` == contract; TAXED 0.001 ETH `33975002796257252613307588` == contract and == the number quoted in `README.md:302-307`; EARLY 0.005 ETH `172990154026523315102150610` == contract; `minTokensOut` (1 %) accepted by the contract in every case |
| live `snipeTaxStartBps()` / `snipeTaxSeconds()` on the factory and on all five sample curves | `9900` / **`3`** everywhere — the README's "15 s" is wrong |
| re-run of `scripts/generate-abis.mjs` into a temporary directory | `lib/abi/bondingCurve.ts`, `launchFactory.ts`, `launcherToken.ts` are **byte-identical** to a fresh generation from `technical-brief/abi/*.json` (54/62/25 entries, every custom error kept) — README decision 13 holds |
| `npm run lint` | clean, no output |
| `git ls-files demo`, `git ls-remote --heads origin`, `git status --porcelain` | 6 PNGs + `demo/README.md` tracked; `origin` has `main 585c83d` and `development 4875d6a`; working tree clean, nothing staged |
| Sourcify `GET /server/v2/contract/46630/0x533c…?fields=sources` | 87 sources, incl. `BondingCurve.sol` (`buy` at :438, `sell` at :541, `getReserves` at :368, `realQuoteReserve` at :384, `initialize` at :269, `currentSnipeTaxBps` at :315, `CurveBuy` at :58, errors at :44-56), `BondingCurveMath.sol:29-56, 75-84`, `LaunchFactory.sol` (`TokenLaunched` at :250, `launchFee` at :322, `getLaunchedToken` at :388, `launchToken` overloads at :696 and :713, `createGraduatedPool` at :1193), `ILaunchpadV2.sol` (`GraduationPhase` at :101) |

**What this audit deliberately did not do** (per the ticket's constraints): no `npm run build`,
no `npm run dev`, no browser scripts, no branch/commit/stage operations, no file modified other
than creating this document. Consequently the production-console claim, the fresh-clone claim and
the `typecheck`/`build` results could not be re-derived here.

## 5. Files read for this audit

`technical-brief/TASK-BRIEF.en.md` (full), `technical-brief/abi/{LaunchFactory,BondingCurve,LauncherToken}.json`,
`README.md`, `AGENTS.md`, `PROMPT.md` (context only), `package.json`, `app/{page,layout,providers}.tsx`,
`components/{TokenList,TokenCard,TokenLogo,BuyForm,SellForm,TradePanel,TokenDetailsCard,LaunchTokenForm,WalletBar,NetworkBanner,SlippageSelector,ui}.tsx`,
`hooks/{useWallet,useTokenLaunches,useTokenDetails,useContractWrite,useBuyToken,useSellToken,useLaunchToken,useGraduateToken,useQueryParam,useIsMounted}.ts`,
`lib/{chain,contracts,wagmi,launchpad,bondingCurve,format,tokenInput,phase,errors,tokens,cn}.ts`,
`lib/abi/*.ts`, `scripts/{verify-onchain,verify-buy-quote,screenshots,generate-abis}.mjs`,
`demo/README.md`, `demo/*.png`, `.gitignore`, `docs/agents/*`.
