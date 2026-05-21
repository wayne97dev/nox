import Link from "next/link";
import { Card } from "@/components/Card";
import { ArrowRight, Coins, Eye, Sparkles, Lock, ShieldCheck } from "lucide-react";

export default function HomePage() {
  return (
    <div>
      {/* ---------------- Hero ---------------- */}
      <section className="relative px-5 sm:px-8 pt-28 pb-24">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 mb-8 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-iris opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-iris" />
            </span>
            <span className="text-xs font-medium tracking-wide text-glow">Genesis live on Base</span>
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold text-balance mb-6 leading-[1.05] tracking-tight">
            <span className="gradient-text">Private payments</span>
            <br />
            <span className="text-fog">on Base.</span>
          </h1>

          <p className="text-lg md:text-xl text-mist max-w-2xl mx-auto mb-10 text-balance leading-relaxed">
            A privacy-themed token on Base. Fair-launch genesis sale, Uniswap&nbsp;v4 pool with a
            1% hook, and ERC-5564 stealth payments rewarded by a halving emission.
          </p>

          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/genesis" className="nox-btn-primary group">
              Join Genesis
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/stealth/send" className="nox-btn-ghost">
              Send Privately
            </Link>
          </div>

          {/* Trust strip */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-mist/70">
            <span className="uppercase tracking-[0.18em]">Built on</span>
            <TrustItem>Base</TrustItem>
            <TrustItem>Uniswap v4</TrustItem>
            <TrustItem>ERC-5564</TrustItem>
            <TrustItem>No admin keys</TrustItem>
          </div>
        </div>
      </section>

      {/* ---------------- Pillars ---------------- */}
      <Section eyebrow="The system" title="Three primitives, one token">
        <div className="grid md:grid-cols-3 gap-5">
          <FeatureCard
            icon={<Coins className="h-5 w-5" />}
            title="Genesis Sale"
            body="Fixed 0.00001 ETH per 1,000 NOX. 600M cap, anti-bot per-block limits, refund fallback if the seed never happens."
            href="/genesis"
            cta="Open Genesis"
          />
          <FeatureCard
            icon={<Eye className="h-5 w-5" />}
            title="Stealth Addresses"
            body="ERC-5564 receiver privacy. Publish once, receive forever to one-time addresses unlinkable to your wallet. No mixer, no zk circuits."
            href="/stealth/register"
            cta="Register meta-address"
          />
          <FeatureCard
            icon={<Sparkles className="h-5 w-5" />}
            title="Stealth Mining"
            body="Earn NOX on every stealth send. 1,000 NOX per tx in era 0, halving every 100k tx, capped at 200M MINING_SUPPLY."
            href="/stealth/send"
            cta="Send & earn"
          />
        </div>
      </Section>

      {/* ---------------- Tokenomics ---------------- */}
      <Section eyebrow="Distribution" title="Tokenomics" subtitle="1,000,000,000 NOX · 18 decimals · immutable supply post-seed">
        <div className="grid sm:grid-cols-3 gap-5">
          <TokenCard pct="60%" label="Genesis" detail="600M · 6 ETH target" />
          <TokenCard pct="20%" label="Liquidity" detail="200M · locked in v4 pool" />
          <TokenCard pct="20%" label="Mining" detail="200M · stealth rewards" />
        </div>
        <p className="mt-6 text-center text-sm text-mist/70">
          No team allocation. No insider unlocks. The treasury forms only from the 1% swap fee.
        </p>
      </Section>

      {/* ---------------- Lifecycle ---------------- */}
      <Section eyebrow="Lifecycle" title="How it works" subtitle="Four phases. No upgrades, no admin keys after seed.">
        <div className="grid md:grid-cols-2 gap-5">
          <StepCard n="01" title="Genesis" body="Mint NOX at a fixed 0.00001 ETH per 1,000 tokens. Transfers locked. Cap = 6 ETH raise." />
          <StepCard n="02" title="Seed" body="Cap reached → anyone calls seedPool(). Uniswap v4 pool opens full-range, LP locked forever, mint sealed." />
          <StepCard n="03" title="Trade" body="NOX/ETH on Base via Uniswap v4. Every swap pays a 1% fee through the NoxHook directly to the treasury." />
          <StepCard n="04" title="Stealth & mine" body="Receivers publish a meta-address; senders generate one-time stealth addresses. Each send pays the sender a mining reward." />
        </div>
      </Section>

      {/* ---------------- Closing CTA ---------------- */}
      <section className="px-5 sm:px-8 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="nox-card ring-glow text-center py-16 px-6">
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
              <Lock className="h-5 w-5 text-iris" />
            </div>
            <h3 className="text-3xl font-bold text-fog mb-3 tracking-tight">No admin keys. No upgrades.</h3>
            <p className="text-mist mb-8 max-w-xl mx-auto leading-relaxed">
              Post-seed the LP is permanently locked, NOX mint is sealed, and the StealthMining
              contract has exactly one whitelisted caller.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link href="/genesis" className="nox-btn-primary group">
                Join Genesis
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href="https://github.com/wayne97dev/nox/blob/main/Nox-Whitepaper.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="nox-btn-ghost"
              >
                Read the whitepaper
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------------- Building blocks ---------------- */

function Section({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="px-5 sm:px-8 py-16">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-iris/80 mb-3">{eyebrow}</div>
          <h2 className="text-3xl md:text-4xl font-bold text-fog tracking-tight">{title}</h2>
          {subtitle && <p className="mt-3 text-mist">{subtitle}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

function TrustItem({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 font-medium text-mist">
      <ShieldCheck className="h-3.5 w-3.5 text-iris/60" />
      {children}
    </span>
  );
}

function FeatureCard({
  icon,
  title,
  body,
  href,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <Card hover className="flex flex-col">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-iris/[0.08] text-iris">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-fog mb-2 tracking-tight">{title}</h3>
      <p className="text-sm text-mist leading-relaxed mb-5 flex-1">{body}</p>
      <Link
        href={href}
        className="inline-flex items-center text-sm font-medium text-iris hover:text-glow transition-colors"
      >
        {cta} <ArrowRight className="ml-1 h-3.5 w-3.5" />
      </Link>
    </Card>
  );
}

function TokenCard({ pct, label, detail }: { pct: string; label: string; detail: string }) {
  return (
    <Card className="text-center py-8">
      <div className="text-5xl font-mono font-bold gradient-text mb-2">{pct}</div>
      <div className="text-fog font-semibold mb-1">{label}</div>
      <div className="text-xs text-mist font-mono">{detail}</div>
    </Card>
  );
}

function StepCard({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <Card hover>
      <div className="flex items-start gap-4">
        <div className="font-mono text-sm font-bold text-iris/70 shrink-0 mt-0.5">{n}</div>
        <div>
          <h4 className="font-semibold text-fog mb-1.5 tracking-tight">{title}</h4>
          <p className="text-sm text-mist leading-relaxed">{body}</p>
        </div>
      </div>
    </Card>
  );
}
