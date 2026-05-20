import Link from "next/link";
import { Card } from "@/components/Card";
import { ArrowRight, Coins, Eye, Sparkles, Lock } from "lucide-react";

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative px-6 pt-24 pb-32">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-iris/30 bg-veil/40 px-4 py-1.5 mb-8 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-iris opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-iris" />
            </span>
            <span className="text-xs font-medium text-glow tracking-wide">
              Genesis live on Base
            </span>
          </div>

          <h1 className="text-6xl md:text-7xl font-bold text-balance mb-6 leading-tight">
            <span className="gradient-text">Pay in the dark.</span>
          </h1>

          <p className="text-lg md:text-xl text-mist max-w-2xl mx-auto mb-10 text-balance">
            A privacy-themed token on Base. Fair-launch via genesis sale, Uniswap v4
            pool with 1% hook, and ERC-5564 stealth payments rewarded by halving emission.
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
        </div>
      </section>

      {/* Pillars */}
      <section className="px-6">
        <div className="mx-auto max-w-6xl grid md:grid-cols-3 gap-6">
          <Card hover>
            <Coins className="h-6 w-6 text-iris mb-4" />
            <h3 className="text-lg font-semibold text-fog mb-2">Genesis Sale</h3>
            <p className="text-sm text-mist mb-4">
              Fixed 0.00001 ETH per 1,000 NOX. 600M cap. Anti-bot per-block limits.
              Refund fallback if seed never happens.
            </p>
            <Link
              href="/genesis"
              className="inline-flex items-center text-sm text-iris hover:text-glow transition-colors"
            >
              Open Genesis <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Card>

          <Card hover>
            <Eye className="h-6 w-6 text-iris mb-4" />
            <h3 className="text-lg font-semibold text-fog mb-2">Stealth Addresses</h3>
            <p className="text-sm text-mist mb-4">
              ERC-5564 receiver privacy. Publish once, receive forever to one-time
              addresses unlinkable to your wallet. No mixer, no zk circuits.
            </p>
            <Link
              href="/stealth/register"
              className="inline-flex items-center text-sm text-iris hover:text-glow transition-colors"
            >
              Register meta-address <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Card>

          <Card hover>
            <Sparkles className="h-6 w-6 text-iris mb-4" />
            <h3 className="text-lg font-semibold text-fog mb-2">Stealth Mining</h3>
            <p className="text-sm text-mist mb-4">
              Earn NOX on every stealth send. 1,000 NOX per tx in era 0, halves every
              100k tx. Capped at 200M MINING_SUPPLY.
            </p>
            <Link
              href="/stealth/send"
              className="inline-flex items-center text-sm text-iris hover:text-glow transition-colors"
            >
              Send & earn <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Card>
        </div>
      </section>

      {/* Tokenomics */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-fog mb-3">Tokenomics</h2>
            <p className="text-mist">1,000,000,000 NOX — 18 decimals, immutable supply post-seed</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <Card className="text-center">
              <div className="text-5xl font-mono font-bold gradient-text mb-2">60%</div>
              <div className="text-fog font-medium mb-1">Genesis</div>
              <div className="text-xs text-mist">600M · 6 ETH target</div>
            </Card>
            <Card className="text-center">
              <div className="text-5xl font-mono font-bold gradient-text mb-2">20%</div>
              <div className="text-fog font-medium mb-1">Liquidity</div>
              <div className="text-xs text-mist">200M · locked in v4 pool</div>
            </Card>
            <Card className="text-center">
              <div className="text-5xl font-mono font-bold gradient-text mb-2">20%</div>
              <div className="text-fog font-medium mb-1">Mining</div>
              <div className="text-xs text-mist">200M · stealth rewards</div>
            </Card>
          </div>
        </div>
      </section>

      {/* Lifecycle */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-fog mb-3">How it works</h2>
            <p className="text-mist">Four phases. No upgrades, no admin keys after seed.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card hover>
              <div className="flex items-start gap-3">
                <div className="nox-chip shrink-0">01</div>
                <div>
                  <h4 className="font-semibold text-fog mb-1">Genesis</h4>
                  <p className="text-sm text-mist">
                    Mint NOX at fixed 0.00001 ETH per 1,000 tokens. Transfers locked.
                    Cap = 6 ETH raise.
                  </p>
                </div>
              </div>
            </Card>

            <Card hover>
              <div className="flex items-start gap-3">
                <div className="nox-chip shrink-0">02</div>
                <div>
                  <h4 className="font-semibold text-fog mb-1">Seed</h4>
                  <p className="text-sm text-mist">
                    Cap reached → anyone calls seedPool(). Uniswap v4 pool opens
                    full-range, LP locked forever, mint sealed.
                  </p>
                </div>
              </div>
            </Card>

            <Card hover>
              <div className="flex items-start gap-3">
                <div className="nox-chip shrink-0">03</div>
                <div>
                  <h4 className="font-semibold text-fog mb-1">Trade</h4>
                  <p className="text-sm text-mist">
                    NOX/ETH on Base via Uniswap v4. Every swap pays a 1% fee through
                    the NoxHook directly to treasury.
                  </p>
                </div>
              </div>
            </Card>

            <Card hover>
              <div className="flex items-start gap-3">
                <div className="nox-chip shrink-0">04</div>
                <div>
                  <h4 className="font-semibold text-fog mb-1">Stealth & mine</h4>
                  <p className="text-sm text-mist">
                    Receivers publish a meta-address; senders generate one-time stealth
                    addresses. Each send pays the sender a mining reward.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-4xl">
          <Card className="text-center py-12">
            <Lock className="h-8 w-8 text-iris mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-fog mb-2">No admin keys. No upgrades.</h3>
            <p className="text-mist mb-6 max-w-xl mx-auto">
              Post-seed the LP is permanently locked, NOX mint is sealed, and the
              StealthMining contract has exactly one whitelisted caller.
            </p>
            <Link href="/genesis" className="nox-btn-primary">
              Join Genesis
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Card>
        </div>
      </section>
    </div>
  );
}
