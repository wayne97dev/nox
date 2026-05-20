"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const NAV = [
  { href: "/genesis", label: "Genesis" },
  { href: "/stealth/register", label: "Register" },
  { href: "/stealth/send", label: "Send" },
  { href: "/stealth/receive", label: "Receive" },
];

export function Header() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-veil/40 bg-noir/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-iris/30 blur-md group-hover:bg-iris/50 transition-colors" />
            <svg width="28" height="28" viewBox="0 0 32 32" className="relative">
              <defs>
                <linearGradient id="hdrGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#A78BFA" />
                  <stop offset="0.5" stopColor="#7C3AED" />
                  <stop offset="1" stopColor="#3B82F6" />
                </linearGradient>
              </defs>
              <circle cx="16" cy="16" r="11" fill="none" stroke="url(#hdrGrad)" strokeWidth="1.5" />
              <path d="M22.5 11 A 7 7 0 1 0 22.5 21 A 5.5 5.5 0 1 1 22.5 11 Z" fill="url(#hdrGrad)" />
            </svg>
          </div>
          <span className="font-mono text-lg font-semibold tracking-wide text-fog">
            NOX
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((item) => {
            const active = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-sm transition-colors",
                  active
                    ? "text-fog bg-veil/60 border border-iris/30"
                    : "text-mist hover:text-fog hover:bg-veil/40"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <ConnectButton
          showBalance={false}
          accountStatus={{ smallScreen: "avatar", largeScreen: "full" }}
          chainStatus="icon"
        />
      </div>
    </header>
  );
}
