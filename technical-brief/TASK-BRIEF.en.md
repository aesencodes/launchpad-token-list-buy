# On-site test: Launchpad token list + buy

**Role:** Web3 Developer (Fullstack)
**Location:** done on-site at our office
**Time limit:** 6 hours maximum, counted from when you receive this brief. Setup, faucet and reading time all count. The demo and Q&A afterwards are not part of the 6 hours.

We run a token launchpad on Robinhood Chain testnet. Every token first trades on a **bonding curve**; once the curve is bought out, the token "graduates" into a Uniswap v4 pool.

The contracts are already deployed and hold five sample tokens. Your task: build a frontend that **lists the tokens** and lets a user **buy a token** from its bonding curve.

You may use AI. The stack is your choice; if you have no preference, use React or Next.js with wagmi and viem.

## What we assess

1. **UI:** clean, clear, pleasant to use, and still good on a phone screen.
2. **Functionality:** every step below works correctly, the numbers are right, and errors are handled.

## Reference

`https://ponsfamily.com/launchpad`

Use it as a guide for look and flow: the shape of the token list, what is shown per token, and the buy flow. You do not have to copy it, and your own design may differ. Do not copy its code or assets.

That site runs on mainnet with different contract addresses. For this test, use only the addresses and network below.

Internet access is allowed during the test (documentation, Sourcify, the reference site, AI tools).

## What you need

| | |
| --- | --- |
| Network | Robinhood Chain Testnet |
| Chain ID | `46630` |
| Currency | ETH (18 decimals) |
| RPC | `https://robinhood-sepolia-rpc.publicnode.com` |
| Explorer | `https://explorer.testnet.chain.robinhood.com` |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |
| LaunchFactory | `0x533cE670f1372cb402D49866608b92e7bc2b4493` |
| Factory deploy block | `129157568` |

- **ABIs:** attached (`LaunchFactory.json`, `BondingCurve.json`, `LauncherToken.json`). The full source is at `https://repo.sourcify.dev/46630/0x533cE670f1372cb402D49866608b92e7bc2b4493`. Where this brief and the contract source disagree, the contract source wins; tell the supervisor.
- **Wallet:** MetaMask in Chrome (or a Chromium browser). We test your result with MetaMask. Create a new wallet just for this test; do not use your main wallet. Never commit a private key or seed phrase.
- **Testnet ETH:** get it from the faucet at `https://faucet.testnet.chain.robinhood.com/`. Aim for at least 0.05 ETH. If the faucet does not open or does not pay out, give your wallet address to the supervisor and we will send it on the spot.
- **RPC limits:** the public RPC rejects `eth_getLogs` ranges larger than **50,000 blocks** (see step 3). Plan for it.

## Sample tokens

These five tokens already exist on testnet. Use them as a reference: the list your app produces must contain all five at the same addresses.

| Symbol | Token address | Bonding curve address | State |
| --- | --- | --- | --- |
| FRESH | `0xFaeA3Da0c58233d0f0193168Bc9B9383E5C08090` | `0x168EA1234652A5dA6bf84D2C1fD243326412B5b2` | Just launched, no buys yet |
| EARLY | `0xB1A6865b584A15F94ca078ca453553C3107A85d7` | `0x50Beb0E43cABb019B3c77caE3302Eb94002Bf55e` | A few early buys |
| HALF | `0xC3e22b78fb924fF3728837Fef7107103D58F6926` | `0x5c3D2616E2c9b35228b5C979eA106Fe7764e8122` | About halfway to graduation |
| TAXED | `0x505181e3114a6d147839Cb809C84d4e83575a97C` | `0x2B65bBBf650211E68fCACBdAfD9Dc39A47Eaa249` | 10% creator tax |
| GRAD | `0xD32266729F628f14c44962FF359aa5d1Cce3dDE0` | `0xF77b46d2ad1f97D175A88A522258c8d5a029adFF` | Graduated into its v4 pool |

These addresses are only for checking your result. Do not hardcode them; the token list must still come from the event in step 3, so that new tokens appear too.

The tokens are shared with other candidates and with the interviewers, so their reserves and progress change when anyone buys. Do not expect fixed numbers. HALF may graduate during the session; if a token becomes unbuyable, buy another one (FRESH, EARLY and TAXED are the safest), or launch your own token (bonus). GRAD is in phase `2`, so use it to check that the buy button is disabled. No sample token is in phase `1`.

## Steps

### Step 1 — Set up the project and network

- Create a frontend project.
- Register Robinhood Chain Testnet as a chain using the table above.

**Done when:** the app reads `launchFee()` from LaunchFactory and shows the result.

### Step 2 — Connect wallet

- Add connect and disconnect buttons.
- Show the wallet address and its ETH balance once connected.
- If the wallet is on another network, show a warning and a button to switch to Robinhood Chain Testnet.
- MetaMask does not ship with this network. The button must also add it when it is missing.

**Done when:** a user can connect, see their balance, and is guided to switch when on the wrong network.

### Step 3 — Fetch the token list

The factory has no function that returns the list of tokens. Read it from this event, starting at the factory's deploy block. The RPC accepts at most 50,000 blocks per `eth_getLogs` request and the chain is already several hundred thousand blocks past the deploy block, so you must fetch the logs in chunks (about 7 requests today, more later):

```solidity
event TokenLaunched(
    address indexed token,
    address indexed curve,
    address indexed deployer,
    address pairToken,
    uint256 launchConfigId,
    uint256 graduationThreshold
);
```

`pairToken` is `address(0)` for a token paired with ETH. All sample tokens are paired with ETH. Tokens paired with another asset may appear in the list; either show them correctly or filter them out and say so in the README.

The list must also pick up tokens launched after the page was opened (poll, watch, or a refresh button).

**Done when:** the app finds the five sample tokens: FRESH, EARLY, HALF, TAXED, GRAD.

### Step 4 — Load each token's data

For every token, read:

| Data | Where |
| --- | --- |
| Name, symbol, logo | `name()`, `symbol()`, `logo()` on the token contract |
| Curve reserves | `getReserves()` on the curve contract, returns `(quoteReserve, tokenReserve)` |
| ETH collected | `realQuoteReserve()` on the curve contract |
| Graduation target | `graduationThreshold()` on the curve contract |
| Status | `getLaunchedToken(token).phase` on the factory (the function returns a struct; `phase` is one field of it) |

Then compute:

- **Current price** = `quoteReserve / tokenReserve` (ETH per token). This is the spot price; a real buy gets a worse price because of fees and price impact. Prices are tiny, so choose a readable format (for example significant digits or `0.0₅1234`) and never show `0.00`.
- **Graduation progress** = `realQuoteReserve / graduationThreshold`, capped at 100%. Compute it with `bigint` (for example in basis points) before formatting.

Meaning of `phase`:

| Phase | Meaning |
| --- | --- |
| `0` | Still trading on the bonding curve |
| `1` | Curve bought out, pool not created yet |
| `2` | Graduated into a Uniswap v4 pool |
| `3` | Graduation cancelled |

Use Multicall3 (`aggregate3`, with `allowFailure`) so the data for all tokens arrives in a small number of RPC requests. The log fetching in step 3 does not need to go through Multicall3.

**Done when:** all of the data above is available for the five tokens.

### Step 5 — Display the token list

- Show each token as a card or row: logo, name, symbol, price, graduation progress bar, and a status label. Give every phase (`0` to `3`) a readable label.
- The sample tokens have no logo (empty string). Show a placeholder. A logo that fails to load must also fall back to the placeholder.
- Provide a view for three states: loading, empty list, and failed to load. The failed view needs a retry button.

**Done when:** the list looks good on desktop and phone, and each of the three states has its own view.

### Step 6 — Buy form

When a user picks a token, show a buy form:

- An input for the amount of ETH to spend.
- The **estimated tokens received**, computed with the curve formula:

  ```
  fee        = quoteIn * feeBps / 10000
  creatorTax = quoteIn * creatorTaxBps / 10000
  net        = quoteIn - fee - creatorTax
  tokensOut  = net * tokenReserve / (quoteReserve + net)
  ```

  `feeBps()` and `creatorTaxBps()` are read from the curve contract. All divisions round down.
- A slippage tolerance setting (for example 1%, default 1%), used to derive `minTokensOut = tokensOut * (10000 - slippageBps) / 10000` from the estimate above.
- Disable the buy button when: no wallet is connected, the network is wrong, the amount is empty, zero or not a valid number, the balance is too low, or the token is not in phase `0`.

Do all arithmetic with `bigint` (parse the input with `parseEther`, and reject more than 18 decimals). Do not convert wei values to `Number` before calculating.

**Done when:** the estimate updates as the user types, and the buy button is enabled only when the transaction can actually be sent.

### Step 7 — Send the buy transaction

Call this function on the curve contract:

```solidity
function buy(uint256 quoteIn, uint256 minTokensOut, address recipient)
    external payable returns (uint256 tokensOut);
```

- Send `value` equal to `quoteIn`.
- `recipient` is the user's wallet address.
- The tokens received are the `tokensOut` value in the `CurveBuy` event of the receipt (or the user's balance change), not your estimate.

Show the user every transaction state:

| State | What to show |
| --- | --- |
| Waiting for wallet confirmation | Button disabled, "Confirm in wallet" |
| Sent, waiting for a block | Pending indicator and a link to the explorer |
| Succeeded | Success message, tokens received, link to the explorer |
| Rejected by the user in the wallet | Short message, form usable again |
| Failed or reverted | An error message the user can understand |

Explorer links look like `https://explorer.testnet.chain.robinhood.com/tx/<hash>`.

Contract errors to translate into a clear message: `SlippageExceeded` (the price moved past the tolerance) and `CurveGraduated` (the token is no longer sold on the curve). For any other error, show a clear readable message instead of raw error dumps.

**Done when:** you have bought one of the sample tokens, and each of the five states above has a view.

### Step 8 — Refresh data after the transaction

After a successful transaction, update without reloading the page:

- the price and progress of the token bought,
- the user's ETH balance,
- the user's token balance (it must also be visible in the buy form before the first buy).

Also make sure the token list itself shows the new numbers, not only the buy form.

**Done when:** the numbers on screen change on their own after a successful buy.

### Step 9 — Tidy up and write the README

The README covers:

- how to run the project,
- your key technical decisions and the reasons for them,
- what is unfinished,
- which parts AI helped with,
- the problems you found in this brief or the contracts, if any.

Also include screenshots or a short demo video of your working app inside the project repository (for example in a `/demo` or `/screenshots` folder).

**Done when:** someone else can run your project by following the README alone, and visual proof (screenshots or video) is included.

## Bonus (optional)

Only if steps 1–9 are finished and you still have time.

### Main bonus — Launch your own token

Build a form that launches a new token, then launch one token with:

- **Token name:** your own full name, for example `Your Full Name`
- **Ticker (symbol):** `TEST`

Call this function on LaunchFactory. The ABI contains two `launchToken` overloads; use the 3-argument version (`launchToken(TokenParams,uint256,address)`). Launching may be restricted by the factory's `canLaunch(address)` check; if it returns false for your wallet, tell the supervisor and we will allow your address.

```solidity
function launchToken(TokenParams params, uint256 launchConfigId, address pairToken)
    external payable returns (address token, address curve);

struct TokenParams {
    string name;
    string symbol;
    string logo;
    string description;
    Socials socials;              // twitter, telegram, discord, website, farcaster
    address creatorFeeRecipient;  // address(0) = the sending wallet
    uint16 creatorTaxBps;         // 0 to 1000
    bool buybackEnabled;
    bytes32 expectedEconomics;    // from previewLaunchEconomics(launchConfigId, pairToken)
    bytes32 salt;                 // 32 random bytes you have not used before
}
```

Values to use:

| Parameter | Value |
| --- | --- |
| `launchConfigId` | `1` (graduates at 0.042 ETH, so it is cheap to try) |
| `pairToken` | `address(0)` (paired with ETH) |
| Transaction `value` | the result of `launchFee()` on the factory, exactly |
| Length limits | name up to 64 characters, symbol up to 16 characters |
| `expectedEconomics` | the `bytes32` returned by `previewLaunchEconomics(1, address(0))`, read just before sending |
| `salt` | 32 random bytes (for example `crypto.getRandomValues`), new on every attempt |

The new token and curve addresses are in the `TokenLaunched` event on the transaction receipt.

**Done when:** a token with your name and the ticker `TEST` is launched, appears in your app's token list with no code change, and can be bought through your buy form.

### Other bonuses

- **Sell:** call `approve(curve, tokensIn)` on the token contract, then `sell(tokensIn, minQuoteOut, recipient)` on the curve.
- **Token detail page:** description (`description()`), creator, and trade history from the `CurveBuy` and `CurveSell` events.
- **Sort or search** on the token list.
- **Finish a graduation:** for a token in phase `1`, provide a button that calls `createGraduatedPool(token)` on the factory.

## What to hand in at the end of the session

Before the 6 hours are up:

1. Push your code to a repository (any host; if private, invite [kodomo-toothpaste](https://github.com/kodomo-toothpaste)) and give the link to the supervisor. Do not commit secrets, keys, or `node_modules`.
2. Make sure the README described in step 9 is in that repository.
3. Include screenshots or a short demo video of the working app inside the project repository (e.g. in a `/demo` or `/screenshots` folder).
4. Leave the app running on your laptop for the demo, started with the README steps from a fresh clone.

Code pushed after time is up is not assessed.

## Demo and Q&A

When time is up, you will:

- demo your app live,
- walk through your code and technical decisions, and
- make one small change in your own code, chosen by the interviewer (about 10 minutes; AI may be used).

Make sure you understand every part of what you wrote, including the parts made with AI.

## How we score

UI and functionality each count for half. Steps 1–9 are the core; a candidate who finishes steps 1–7 correctly beats one who finishes more steps with wrong numbers. Bonus items only count after the core works. The README and the demo/Q&A are scored too.

## Questions

If anything is unclear, ask the supervisor at any time. Asking questions does not count against you.
