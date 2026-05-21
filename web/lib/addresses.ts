import type { Address } from "viem";

const ZERO: Address = "0x0000000000000000000000000000000000000000";

function norm(v: string | undefined): Address {
  if (!v || !/^0x[a-fA-F0-9]{40}$/.test(v)) return ZERO;
  return v as Address;
}

// NOTE: each var MUST be accessed via a static literal `process.env.NEXT_PUBLIC_*`
// expression — Next.js only inlines NEXT_PUBLIC vars for literal member access,
// never for dynamic `process.env[key]` lookups.
export const ADDRESSES = {
  noxToken: norm(process.env.NEXT_PUBLIC_NOX_TOKEN),
  noxGenesis: norm(process.env.NEXT_PUBLIC_NOX_GENESIS),
  noxHook: norm(process.env.NEXT_PUBLIC_NOX_HOOK),
  stealthRegistry: norm(process.env.NEXT_PUBLIC_STEALTH_REGISTRY),
  stealthAnnouncer: norm(process.env.NEXT_PUBLIC_STEALTH_ANNOUNCER),
  noxStealthSender: norm(process.env.NEXT_PUBLIC_NOX_STEALTH_SENDER),
  stealthMining: norm(process.env.NEXT_PUBLIC_STEALTH_MINING),
} as const;

export function hasContracts(): boolean {
  return ADDRESSES.noxGenesis !== ZERO;
}
