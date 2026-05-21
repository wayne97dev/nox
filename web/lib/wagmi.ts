import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base, baseSepolia, foundry } from "wagmi/chains";
import { http } from "wagmi";
import type { Chain } from "viem";

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "84532");

const chainMap: Record<number, Chain> = {
  [base.id]: base,
  [baseSepolia.id]: baseSepolia,
  [foundry.id]: foundry,
};

const activeChain = chainMap[chainId] ?? baseSepolia;

// Dedicated RPC (Alchemy/Infura/etc) for reads and the stealth log scan.
// If unset, http(undefined) falls back to the chain's rate-limited public RPC.
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || undefined;

export const config = getDefaultConfig({
  appName: "Nox",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "00000000000000000000000000000000",
  chains: [activeChain] as unknown as readonly [Chain, ...Chain[]],
  transports: {
    [activeChain.id]: http(rpcUrl),
  },
  ssr: true,
});

export const ACTIVE_CHAIN = activeChain;
