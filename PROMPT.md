Read and implement the technical brief in this project end-to-end.

1. Technical Brief Is the Primary Source of Truth

Before making any code changes:

Inspect the entire technical brief/ folder recursively.

Read every relevant file in that folder completely.

Do not assume that the current AGENTS.md, existing project structure, previous instructions, or your own assumptions are correct.

Extract and verify:

requirements

constraints

acceptance criteria

contract addresses

chain configuration

ABI requirements

events

formulas

transaction behavior

UI requirements

error handling

security requirements

bonus features

submission requirements

Create a clear internal implementation checklist from the technical brief before coding.

If information in AGENTS.md conflicts with the technical brief, the technical brief wins.

If information in the technical brief conflicts with the actual deployed contract source/ABI, verify the deployed contract and use the actual contract behavior as the final source of truth, while documenting the discrepancy.

2. Re-audit AGENTS.md

Inspect the existing AGENTS.md.

Then update or rewrite it so that it accurately reflects the verified technical brief and actual project requirements.

Do not preserve incorrect instructions merely because they already exist in AGENTS.md.

The updated AGENTS.md should cover:

project architecture

technology stack

folder structure

Web3 conventions

contract interaction rules

bigint/precision rules

token discovery rules

Multicall requirements

transaction handling

UI requirements

error handling

testing/verification

security rules

implementation priorities

restrictions on dependencies

rules for using open-source references

After updating AGENTS.md, use the updated version as the implementation guideline.

3. Verify the Existing Project

Inspect:

package.json

source code

configuration files

existing hooks

components

contracts/ABIs

environment configuration

Git configuration

Determine what already exists and what needs to be implemented.

Do not unnecessarily rewrite working code.

4. Research Open Source

Search GitHub for open-source projects with functionality similar to this technical brief, especially:

token launchpads

bonding curves

token discovery from blockchain events

eth_getLogs chunking

Multicall3

wagmi

viem

React/Next.js Web3 applications

buy/sell bonding curve flows

slippage calculations

transaction receipt/event parsing

Study multiple relevant projects rather than relying on a single repository.

Use open-source projects only as technical references and inspiration.

Do NOT:

blindly copy code

fork an existing implementation

copy contract addresses

copy unrelated ABIs

assume another project's bonding-curve formula is correct

assume another project's chain configuration is correct

introduce dependencies just because another project uses them

Adapt useful patterns to this project's exact technical brief and deployed contracts.

5. Contract Verification

Before implementing contract interactions, verify the actual deployed contracts and ABI/source referenced by the technical brief.

Pay special attention to:

function signatures

overloaded functions

event signatures

struct definitions

return values

custom errors

contract phases

bonding curve formulas

fee calculations

creator tax

buy behavior

graduation behavior

If the brief, ABI files, Sourcify/source code, and open-source examples disagree, investigate the discrepancy instead of guessing.

Document important discrepancies in the README.

6. Implementation

Implement the technical brief incrementally.

Prioritize:

Core functionality

Correct blockchain data

Correct bigint calculations

Wallet/network handling

Token discovery

Multicall/data loading

Buy flow

Transaction/error handling

Post-transaction updates

UI polish

README/demo

Bonus features only after the core requirements are complete

Do not sacrifice correctness of core requirements for bonus features.

7. Technology Rules

Use the technology stack specified by the verified technical brief.

Unless the technical brief explicitly requires otherwise, prefer:

Next.js

React

TypeScript

wagmi

viem

TanStack Query

Tailwind CSS

Do not add:

ethers.js

RainbowKit

Redux

Zustand

backend services

databases

unnecessary Web3 libraries

unless the technical brief or existing architecture genuinely requires them.

8. Blockchain Precision

Use bigint for all blockchain amounts and calculations.

Never use JavaScript Number for:

wei

token amounts

reserves

fees

taxes

slippage

bonding curve calculations

graduation progress calculations

Do not convert blockchain values to floating-point numbers before calculations.

Only format values for display at the final UI layer.

9. Dynamic On-chain Data

Do not hardcode example token addresses or assume the provided example tokens are the complete token list.

Follow the technical brief's required token discovery mechanism.

Newly launched tokens must be discoverable without changing the source code.

10. Architecture

Keep responsibilities separated.

For example:

blockchain configuration → lib/

contract ABIs → dedicated ABI directory

contract addresses → centralized configuration

blockchain queries → hooks/lib

bonding curve calculations → dedicated utility

formatting → dedicated utility

UI → components

transaction state → hooks/components

Do not put complex blockchain logic directly inside presentational components.

11. Verification

After each major implementation step:

Run lint.

Run typecheck if available.

Run build when appropriate.

Fix errors before moving to the next major step.

Verify that the implementation still matches the technical brief.

Before considering the implementation complete, perform a final audit against the technical brief line-by-line.

Create a checklist and verify every acceptance criterion.

12. Security

Never commit or expose:

private keys

seed phrases

wallet credentials

API secrets

RPC secrets

.env secrets

test wallet private keys

Use .env.example for non-secret configuration where appropriate.

13. Documentation

Update the README with:

setup instructions

development commands

architecture

important technical decisions

contract/network configuration

known limitations

discrepancies discovered during implementation

AI assistance used

testing/verification instructions

demo instructions

Follow the exact documentation requirements from the technical brief.

14. Final Audit

Before finishing:

Re-read the entire technical brief/ folder.

Re-read AGENTS.md.

Compare the implementation against every requirement.

Identify anything missing or potentially incorrect.

Fix all issues that can be fixed.

Clearly document anything that cannot be completed.

Run the final lint/typecheck/build.

Do not claim completion unless the repository actually implements the requirements.

Do not stop at analysis or provide only a plan.

Actually implement the requirements in the repository.

15. Git and GitHub Safety

You must NOT push anything to GitHub.

You must NOT:

run git push

run git push --force

create pull requests

merge pull requests

create releases

modify GitHub repository settings

modify GitHub Actions/workflows unless explicitly required by the technical brief

publish or deploy the application

I will manually review and push the changes to GitHub myself.

You may inspect Git status, history, branches, and remotes when necessary.

Do NOT change or remove the existing Git remote.

Do NOT create commits automatically unless I explicitly ask you to commit.

Before finishing, show me:

git status
git diff --stat

and summarize the files that were created or modified.

Leave all changes in the local working tree for my review and manual commit/push.

Never push code, secrets, credentials, .env files, private keys, or any other sensitive information to GitHub.
