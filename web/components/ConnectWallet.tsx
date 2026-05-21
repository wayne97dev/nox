"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Wallet, ChevronDown, AlertTriangle } from "lucide-react";

/**
 * Custom-styled wallet button built on RainbowKit's ConnectButton.Custom render-prop.
 * Keeps RainbowKit's wallet-selection modal but gives us a refined pill trigger that
 * matches the Nox aesthetic (gradient when disconnected, glass when connected).
 */
export function ConnectWallet() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, authenticationStatus, mounted }) => {
        const ready = mounted && authenticationStatus !== "loading";
        const connected =
          ready && account && chain && (!authenticationStatus || authenticationStatus === "authenticated");

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: { opacity: 0, pointerEvents: "none", userSelect: "none" },
            })}
          >
            {(() => {
              // --- Disconnected ---
              if (!connected) {
                return (
                  <button onClick={openConnectModal} type="button" className="nox-btn-primary group !px-5 !py-2.5">
                    <Wallet className="mr-2 h-4 w-4" />
                    Connect Wallet
                  </button>
                );
              }

              // --- Wrong network ---
              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/20"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    Wrong network
                  </button>
                );
              }

              // --- Connected ---
              return (
                <div className="flex items-center gap-2">
                  <button
                    onClick={openChainModal}
                    type="button"
                    className="hidden sm:flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm font-medium text-mist transition-all hover:border-white/15 hover:text-fog"
                  >
                    {chain.hasIcon && chain.iconUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt={chain.name ?? "chain"}
                        src={chain.iconUrl}
                        className="h-4 w-4 rounded-full"
                        style={{ background: chain.iconBackground }}
                      />
                    )}
                    <span className="max-w-[90px] truncate">{chain.name}</span>
                  </button>

                  <button
                    onClick={openAccountModal}
                    type="button"
                    className="group inline-flex items-center gap-2 rounded-full border border-iris/25 bg-iris/[0.06] px-4 py-2.5 text-sm font-semibold text-fog transition-all hover:border-iris/45 hover:bg-iris/[0.12]"
                  >
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-iris opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-iris" />
                    </span>
                    <span className="font-mono">{account.displayName}</span>
                    {account.displayBalance && (
                      <span className="hidden md:inline text-mist font-normal">· {account.displayBalance}</span>
                    )}
                    <ChevronDown className="h-3.5 w-3.5 text-mist transition-transform group-hover:translate-y-0.5" />
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
