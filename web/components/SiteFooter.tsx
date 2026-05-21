import Link from "next/link";
import { FileText } from "lucide-react";

const WHITEPAPER_URL = "/Nox-Whitepaper.pdf";
const X_URL = "https://x.com";
const TELEGRAM_URL = "https://t.me";

export function SiteFooter() {
  return (
    <footer className="relative mt-24 border-t border-white/[0.06]">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-12">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-10">
          {/* Brand */}
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5 mb-3">
              <svg width="22" height="22" viewBox="0 0 32 32">
                <defs>
                  <linearGradient id="ftGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#A78BFA" />
                    <stop offset="0.5" stopColor="#7C3AED" />
                    <stop offset="1" stopColor="#3B82F6" />
                  </linearGradient>
                </defs>
                <circle cx="16" cy="16" r="11" fill="none" stroke="url(#ftGrad)" strokeWidth="1.5" />
                <path d="M22.5 11 A 7 7 0 1 0 22.5 21 A 5.5 5.5 0 1 1 22.5 11 Z" fill="url(#ftGrad)" />
              </svg>
              <span className="font-mono text-base font-normal tracking-[0.2em] text-fog">NOX</span>
            </div>
            <p className="text-sm text-mist leading-relaxed">
              Privacy-themed token on Base. Genesis sale, Uniswap v4 hook, stealth payments with
              mining rewards.
            </p>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
            <FooterCol title="Protocol">
              <FooterLink href="/genesis">Genesis</FooterLink>
              <FooterLink href="/stealth/send">Send</FooterLink>
              <FooterLink href="/stealth/receive">Receive</FooterLink>
              <FooterLink href="/stats">Stats</FooterLink>
            </FooterCol>
            <FooterCol title="Resources">
              <FooterLinkExt href={WHITEPAPER_URL}>Whitepaper</FooterLinkExt>
            </FooterCol>
            <FooterCol title="Community">
              <FooterLinkExt href={X_URL}>X / Twitter</FooterLinkExt>
              <FooterLinkExt href={TELEGRAM_URL}>Telegram</FooterLinkExt>
            </FooterCol>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs text-mist/70">
            © {new Date().getFullYear()} Nox. No admin keys. No upgrades.
          </span>
          <div className="flex items-center gap-1">
            <FooterIcon href={WHITEPAPER_URL} label="Whitepaper">
              <FileText className="h-4 w-4" />
            </FooterIcon>
            <FooterIcon href={X_URL} label="X">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </FooterIcon>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-normal uppercase tracking-wider text-mist/60 mb-3">{title}</h4>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-sm text-mist hover:text-fog transition-colors">
        {children}
      </Link>
    </li>
  );
}

function FooterLinkExt({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-mist hover:text-fog transition-colors"
      >
        {children}
      </a>
    </li>
  );
}

function FooterIcon({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
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
