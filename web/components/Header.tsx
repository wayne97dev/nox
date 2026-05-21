"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText } from "lucide-react";
import { ConnectWallet } from "./ConnectWallet";

const NAV = [
  { href: "/genesis", label: "Genesis" },
  { href: "/stealth/register", label: "Register" },
  { href: "/stealth/send", label: "Send" },
  { href: "/stealth/receive", label: "Receive" },
  { href: "/stats", label: "Stats" },
];

const WHITEPAPER_URL = "/Nox-Whitepaper.pdf";
const X_URL = "https://x.com";
const TELEGRAM_URL = "https://t.me";

export function Header() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-noir/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-iris/25 blur-lg group-hover:bg-iris/40 transition-colors" />
            <svg width="26" height="26" viewBox="0 0 32 32" className="relative">
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
          <span className="font-mono text-lg font-normal tracking-[0.2em] text-fog">NOX</span>
        </Link>

        {/* Nav */}
        <nav className="hidden lg:flex items-center gap-0.5 absolute left-1/2 -translate-x-1/2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              data-active={pathname?.startsWith(item.href) ? "true" : "false"}
              className="nox-nav-link"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right cluster */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          <div className="hidden md:flex items-center gap-0.5 pr-1.5 mr-1.5 border-r border-white/[0.08]">
            <IconLink href={WHITEPAPER_URL} label="Whitepaper">
              <FileText className="h-4 w-4" />
            </IconLink>
            <IconLink href={X_URL} label="X">
              <XIcon />
            </IconLink>
            <IconLink href={TELEGRAM_URL} label="Telegram">
              <TelegramIcon />
            </IconLink>
          </div>
          <ConnectWallet />
        </div>
      </div>
    </header>
  );
}

function IconLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-mist transition-colors hover:bg-white/[0.05] hover:text-fog"
    >
      {children}
    </a>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}
