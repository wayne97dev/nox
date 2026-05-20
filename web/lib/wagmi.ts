import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base, baseSepolia, foundry } from "wagmi/chains";
import type { Chain } from "viem";

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "84532");

const chainMap: Record<number, Chain> = {
  [base.id]: base,
  [baseSepolia.id]: baseSepolia,
  [foundry.id]: foundry,
};

const activeChain = chainMap[chainId] ?? baseSepolia;

export const config = getDefaultConfig({
  appName: "Nox",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "00000000000000000000000000000000",
  chains: [activeChain] as unknown as readonly [Chain, ...Chain[]],
  ssr: true,
});

export const ACTIVE_CHAIN = activeChain;
