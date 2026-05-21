# Nox — Privacy-themed token launch on Base (Uniswap v4)

Hybrid launch model inspired by `Nonce`: a fixed-price genesis sale, then automatic
migration to a Uniswap v4 pool with a 1% swap fee hook routed to the treasury.

## Contracts

| File | Role |
|---|---|
| [`src/NoxToken.sol`](src/NoxToken.sol) | ERC-20. Mint locked behind the Genesis contract. Transfers locked until pool seed. |
| [`src/NoxGenesis.sol`](src/NoxGenesis.sol) | Genesis sale, anti-bot, refund fallback, v4 pool seed. |
| [`src/NoxHook.sol`](src/NoxHook.sol) | Uniswap v4 hook. Takes 1% of every swap output, withdrawable to treasury. |
| [`src/utils/BaseHook.sol`](src/utils/BaseHook.sol) | Minimal IHooks base with reverting default stubs. |
| [`src/utils/HookMiner.sol`](src/utils/HookMiner.sol) | CREATE2 salt brute-forcer for the hook address. |
| [`src/stealth/StealthRegistry.sol`](src/stealth/StealthRegistry.sol) | ERC-6538 registry: users publish a stealth meta-address. |
| [`src/stealth/StealthAnnouncer.sol`](src/stealth/StealthAnnouncer.sol) | ERC-5564 announcer: emits the discovery event for stealth payments. |
| [`src/stealth/NoxStealthSender.sol`](src/stealth/NoxStealthSender.sol) | One-call helper: pull NOX, send to stealth address, announce, claim mining reward. |
| [`src/stealth/StealthMining.sol`](src/stealth/StealthMining.sol) | Holds 500M mining supply, pays flat per-tx reward with Bitcoin-style halving every 250k stealth tx. |

## Parameters

| Constant | Value | Notes |
|---|---|---|
| `MAX_SUPPLY` | 1,000,000,000 NOX | 18 decimals |
| `GENESIS_SUPPLY` | 300,000,000 NOX | 30% sold in the genesis |
| `LP_SUPPLY` | 200,000,000 NOX | 20% seeded into v4 LP |
| `MINING_SUPPLY` | 500,000,000 NOX | 50% reserved for stealth-mining rewards |
| `TOKENS_PER_LOT` | 300,000 NOX | tokens per lot (the indivisible buy unit) |
| `LOT_PRICE` | 0.01 ETH / lot | min buy = 1 lot; 10 ETH to fill cap |
| `GENESIS_CAP_LOTS` | 1,000 | 300M NOX cap |
| `MAX_LOTS_PER_TX` | 50 | 0.5 ETH / 15M NOX per tx |
| `MAX_MINTS_PER_BLOCK` | 5 | anti-block-stuffing |
| `REFUND_GRACE` | 48 h | refund window if seed fails |
| `LP_FEE` | 0 | LP fee disabled — hook charges instead |
| `SWAP_FEE_BPS` | 100 (1%) | charged on output side, sent to a single immutable `treasury` |
| `TICK_SPACING` | 60 | full-range LP |
| `INITIAL_REWARD` | 1,000 NOX | per stealth tx in era 0 |
| `ERA_TX_COUNT` | 250,000 | halving every 250k stealth tx |

## Build & test

```sh
forge build
forge test -vv
```

26 tests cover: anti-bot limits, refund flow, transfer lock, pool seed,
swap fee accrual, treasury withdrawal, stealth registry / announcer /
sender, stealth-mining halving and supply cap.

## Web dApp

The `web/` directory contains the Next.js 15 frontend.

```sh
cd web
cp .env.example .env.local      # then fill in deployed addresses
npm install
npm run dev                     # http://localhost:3000
```

Pages:
- `/` — landing with brand, tokenomics, lifecycle
- `/genesis` — live progress bar, mint form, seed trigger
- `/stealth/register` — generate keypair, publish meta-address
- `/stealth/send` — derive one-time stealth address, send NOX, earn mining reward
- `/stealth/receive` — scan announcements, decrypt incoming, reveal stealth private keys

The stealth math lives in [`web/lib/stealth.ts`](web/lib/stealth.ts) (ERC-5564 scheme 0,
SECP256k1) and runs entirely in the browser. Viewing/spending keys are stored in
`localStorage` for the demo — production wallets should integrate via WalletConnect
or a dedicated stealth-aware wallet (Fluidkey, Squid, etc).

## Deployment

Set environment variables:

```sh
export POOL_MANAGER=0x...        # Uniswap v4 PoolManager on the target chain
export TREASURY=0x...             # receives the 1% swap fees (can be EOA, Safe, or Splitter)
export CONTROLLER=0x...           # can force seedPool after window; also wires StealthMining
export GENESIS_WINDOW=604800      # 7 days
export DEPLOYER_PK=0x...
export BASE_RPC_URL=https://...
export BASESCAN_API_KEY=...
```

Deploy:

```sh
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $BASE_RPC_URL \
  --broadcast \
  --verify
```

Look up the PoolManager address for the target chain in the
[Uniswap v4 deployments page](https://docs.uniswap.org/contracts/v4/deployments)
before broadcasting.

**Post-deploy wiring (required):** after the script logs the contract addresses, the
`controller` EOA must call:

```sh
cast send $STEALTH_MINING "setStealthSender(address)" $NOX_STEALTH_SENDER \
  --rpc-url $BASE_RPC_URL --private-key $CONTROLLER_PK
```

Without this, `sendStealthNox` will revert because the mining contract refuses unknown
callers. The call is one-shot — once set, it can never be changed.

## Lifecycle

1. **Genesis** — `mintGenesis(lots)` with `lots * LOT_PRICE` wei (min 1 lot = 0.01 ETH).
   Subject to per-tx and per-block caps. NOX is minted to the buyer but
   non-transferable.
2. **Seed** — when `lotsSold == GENESIS_CAP_LOTS`, anyone can call
   `seedPool()`. The contract initializes the v4 pool, deposits all
   raised ETH and mints exactly the required NOX into a full-range LP
   position owned by itself, then permanently seals NOX minting and
   unlocks transfers.
   * If the window expires before cap, only `controller` can call
     `seedPool()`.
3. **Refund fallback** — if `seedPool()` is never called, after
   `closeAt + REFUND_GRACE` any buyer can call `refund()` and recover
   their ETH 1:1.
4. **Trading** — post-seed, NOX trades freely on the v4 pool. Every
   swap pays 1% of output to the hook; `NoxHook.withdrawFees(currency)`
   sweeps to `treasury`.

## Locked-LP invariant

The Genesis contract owns the LP position and exposes no
`removeLiquidity` function. The position cannot be migrated, withdrawn,
or charged a manager fee. The 1% hook fee is the only economic outflow
from swaps.

## Privacy

Two opt-in layers. The base ERC-20 is fully transparent; users who want
privacy choose how much they want.

### Stealth-mining incentive

Every successful `sendStealthNox` call pays the sender a flat NOX reward from the
500M `MINING_SUPPLY`. The reward halves every `ERA_TX_COUNT = 250,000` stealth
transactions (Bitcoin-style geometric emission), so total payout asymptotes to
`MINING_SUPPLY` and never exceeds it. There's no cliff — once the supply is fully
distributed `recordAndReward` silently returns 0 and stealth sends keep working.

Era 0 reward: 1,000 NOX per tx. Era 1: 500 NOX. Era 2: 250 NOX. And so on.

Only `NoxStealthSender` can trigger payouts — the mining contract whitelists exactly
one caller, set once by the `controller` post-deploy. No way to mint or upgrade.

### Layer 1 — Stealth addresses (ERC-5564 / ERC-6538)

Recipient publishes a stealth meta-address once. Senders derive a fresh
one-time `stealthAddress` per payment off-chain, then call
`NoxStealthSender.sendStealthNox`. The on-chain transfer goes from the
sender directly to the one-time address; there is no on-chain link from
that address back to the recipient.

Flow:

1. **Recipient**:
   ```sol
   registry.registerKeys(0, metaAddress); // scheme 0 = SECP256k1
   ```
2. **Sender** (wallet/SDK does this off-chain):
   - Reads `registry.stealthMetaAddressOf(recipient, 0)`
   - Generates ephemeral keypair, computes `stealthAddress`, `viewTag`, `ephemeralPubKey`
3. **Sender** on-chain:
   ```sol
   nox.approve(noxStealthSender, amount);
   noxStealthSender.sendStealthNox(0, stealthAddress, amount, ephemeralPubKey, viewTag);
   ```
4. **Recipient** scans `Announcement(schemeId, stealthAddress, caller, ephemeralPubKey, metadata)`
   logs from `StealthAnnouncer`. View tag pruning makes scanning fast. For each match
   they derive the stealth private key from `ephemeralPubKey + recipientSpendingKey`.

What's hidden: link between sender's known address and recipient's known address.
What's still public: sender address, stealth (one-time) address, amount, NOX token address.

Wallets that natively support ERC-5564 (Fluidkey, Umbra-style integrations) can plug
into this registry directly.

### Layer 2 — Railgun shielded transfers

NOX is a vanilla ERC-20 post-seed, so any holder can deposit it into Railgun's
shielded pool on Base (`shield` → private transfers → `unshield`). Inside
Railgun, sender, recipient, and amount are all hidden by zk-SNARKs over a
poseidon-hashed commitment tree.

To enable a one-click experience in a frontend you'd integrate the
[Railgun SDK](https://docs.railgun.org/wallet/) and call its shield/unshield
flows against the deployed NOX address. No additional smart contracts are
required on our side — Railgun already supports arbitrary ERC-20s on its
supported chains.

What's hidden: sender, recipient, and amount.
What's still public: that *someone* deposited NOX into Railgun at some point.

### Trade-offs

| | Sender hidden | Recipient hidden | Amount hidden | New crypto risk | UX |
|---|:---:|:---:|:---:|:---:|---|
| Standard transfer | ❌ | ❌ | ❌ | — | trivial |
| Stealth (Layer 1) | ❌ | ✅ | ❌ | none (standard schemes) | one extra tx + scan |
| Railgun (Layer 2) | ✅ | ✅ | ✅ | mature zk-SNARKs (audited) | shield/unshield gas |
