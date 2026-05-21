import { keccak256, encodeAbiParameters, type Address, type Hex } from "viem";

export interface PoolKeyStruct {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

const POOL_KEY_ABI = [
  {
    type: "tuple",
    components: [
      { name: "currency0", type: "address" },
      { name: "currency1", type: "address" },
      { name: "fee", type: "uint24" },
      { name: "tickSpacing", type: "int24" },
      { name: "hooks", type: "address" },
    ],
  },
] as const;

/** v4 pool id = keccak256(abi.encode(PoolKey)) */
export function computePoolId(key: PoolKeyStruct): Hex {
  return keccak256(encodeAbiParameters(POOL_KEY_ABI, [key]));
}

const Q96 = 2 ** 96;

/**
 * Given sqrtPriceX96 for a pool whose currency0 = ETH and currency1 = NOX
 * (both 18 decimals), returns:
 *   - noxPerEth: how many NOX one ETH buys
 *   - ethPerNox: price of one NOX in ETH
 */
export function pricesFromSqrtX96(sqrtPriceX96: bigint): { noxPerEth: number; ethPerNox: number } {
  const sqrtP = Number(sqrtPriceX96) / Q96; // real sqrt(price), price = NOX/ETH (raw, same decimals)
  const noxPerEth = sqrtP * sqrtP;
  const ethPerNox = noxPerEth > 0 ? 1 / noxPerEth : 0;
  return { noxPerEth, ethPerNox };
}

// Full-range tick bounds used by NoxGenesis (tickSpacing 60).
const TICK_LOWER = -887220;
const TICK_UPPER = 887220;
const sqrtAtTick = (t: number) => Math.pow(1.0001, t / 2);

/**
 * Approximate pool reserves (in whole tokens) from liquidity + current price,
 * assuming the canonical full-range position. Float math — for display only.
 */
export function reservesFromLiquidity(
  sqrtPriceX96: bigint,
  liquidity: bigint,
): { ethReserve: number; noxReserve: number } {
  const sqrtP = Number(sqrtPriceX96) / Q96;
  const sqrtA = sqrtAtTick(TICK_LOWER);
  const sqrtB = sqrtAtTick(TICK_UPPER);
  const L = Number(liquidity);

  // token1 (NOX) = L * (sqrtP - sqrtA); token0 (ETH) = L * (sqrtB - sqrtP) / (sqrtP * sqrtB)
  const noxWei = L * (sqrtP - sqrtA);
  const ethWei = (L * (sqrtB - sqrtP)) / (sqrtP * sqrtB);

  return { ethReserve: ethWei / 1e18, noxReserve: noxWei / 1e18 };
}

/** ERC-6909 id for a currency is uint256(uint160(address)); native ETH (0x0) → 0 */
export function currencyId(currency: Address): bigint {
  return BigInt(currency);
}
