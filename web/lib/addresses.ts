import type { Address } from "viem";

const ZERO: Address = "0x0000000000000000000000000000000000000000";

function envAddr(name: string): Address {
  const v = process.env[name];
  if (!v || !/^0x[a-fA-F0-9]{40}$/.test(v)) return ZERO;
  return v as Address;
}

export const ADDRESSES = {
  noxToken: envAddr("NEXT_PUBLIC_NOX_TOKEN"),
  noxGenesis: envAddr("NEXT_PUBLIC_NOX_GENESIS"),
  noxHook: envAddr("NEXT_PUBLIC_NOX_HOOK"),
  stealthRegistry: envAddr("NEXT_PUBLIC_STEALTH_REGISTRY"),
  stealthAnnouncer: envAddr("NEXT_PUBLIC_STEALTH_ANNOUNCER"),
  noxStealthSender: envAddr("NEXT_PUBLIC_NOX_STEALTH_SENDER"),
  stealthMining: envAddr("NEXT_PUBLIC_STEALTH_MINING"),
} as const;

export function hasContracts(): boolean {
  return ADDRESSES.noxGenesis !== ZERO;
}
