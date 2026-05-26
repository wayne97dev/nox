import type { Address } from "viem";
import { ADDRESSES } from "./addresses";

// Native ETH sentinel used in stealth metadata (matches NoxStealthSender.NATIVE).
export const NATIVE_SENTINEL: Address = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

// Base mainnet USDC (native, Circle).
export const USDC_BASE: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export type AssetKind = "nox" | "eth" | "usdc";

export interface Asset {
  kind: AssetKind;
  symbol: string;
  address: Address; // token address; NATIVE_SENTINEL for ETH
  decimals: number;
  isNative: boolean;
  mines: boolean; // earns the NOX mining reward when sent via stealth
}

// Order matters: NOX first (default selection).
export const ASSETS: Asset[] = [
  { kind: "nox", symbol: "NOX", address: ADDRESSES.noxToken, decimals: 18, isNative: false, mines: true },
  { kind: "eth", symbol: "ETH", address: NATIVE_SENTINEL, decimals: 18, isNative: true, mines: false },
  { kind: "usdc", symbol: "USDC", address: USDC_BASE, decimals: 6, isNative: false, mines: false },
];

// Resolve a metadata token address (any case) to a known asset, if recognized.
export function assetByAddress(addr: string): Asset | undefined {
  const a = addr.toLowerCase();
  return ASSETS.find((x) => x.address.toLowerCase() === a);
}
