"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { bytesToHex, formatEther, type Hex } from "viem";
import { toast } from "sonner";
import { Card } from "@/components/Card";
import { Reveal } from "@/components/Reveal";
import { StealthFlow } from "@/components/StealthFlow";
import { ADDRESSES, hasContracts } from "@/lib/addresses";
import { stealthAnnouncerAbi } from "@/lib/abis";
import {
  loadKeys,
  scanAnnouncements,
  type AnnouncementLog,
  type DiscoveredPayment,
  type StealthKeys,
} from "@/lib/stealth";
import { Eye, RefreshCw, Inbox, Copy, KeyRound } from "lucide-react";

const SCAN_BLOCK_RANGE = 50_000n; // window per getLogs call

export default function ReceiveStealthPage() {
  const { isConnected } = useAccount();
  const client = usePublicClient();

  const [keys, setKeys] = useState<StealthKeys | null>(null);
  const [payments, setPayments] = useState<DiscoveredPayment[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ from: 0n, to: 0n });

  useEffect(() => {
    setKeys(loadKeys());
  }, []);

  const scan = async () => {
    if (!client || !keys) return;
    setScanning(true);
    setPayments([]);
    try {
      const latest = await client.getBlockNumber();
      // Pragmatic: scan last ~7 days of blocks on Base (~2s/block → ~300k blocks/week)
      // but cap to chain history to avoid going negative.
      const lookback = 300_000n;
      const earliest = latest > lookback ? latest - lookback : 0n;

      const announcements: AnnouncementLog[] = [];
      let from = earliest;
      while (from <= latest) {
        const to = from + SCAN_BLOCK_RANGE - 1n > latest ? latest : from + SCAN_BLOCK_RANGE - 1n;
        setProgress({ from, to });
        const logs = await client.getLogs({
          address: ADDRESSES.stealthAnnouncer,
          event: stealthAnnouncerAbi.find((x) => x.type === "event" && x.name === "Announcement")!,
          args: { schemeId: 0n },
          fromBlock: from,
          toBlock: to,
        });
        for (const log of logs) {
          announcements.push({
            stealthAddress: log.args.stealthAddress as Hex,
            ephemeralPubKey: log.args.ephemeralPubKey as Hex,
            metadata: log.args.metadata as Hex,
          });
        }
        from = to + 1n;
      }

      const found = scanAnnouncements(keys, announcements);
      // Filter to NOX payments only
      const filtered = found.filter(
        (p) => p.token.toLowerCase() === ADDRESSES.noxToken.toLowerCase(),
      );
      setPayments(filtered);
      toast.success(
        filtered.length > 0
          ? `Found ${filtered.length} stealth payment${filtered.length === 1 ? "" : "s"} 🎉`
          : "No stealth payments found",
      );
    } catch (e) {
      toast.error(`Scan failed: ${(e as Error).message}`);
    } finally {
      setScanning(false);
    }
  };

  if (!hasContracts()) {
    return <div className="px-6 py-24 text-center text-mist">Deploy contracts to enable stealth receive.</div>;
  }

  return (
    <div className="px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <Reveal>
          <header className="mb-8 text-center">
            <div className="text-xs font-mono uppercase tracking-[0.25em] text-iris/80 mb-3">stealth · receive</div>
            <h1 className="text-4xl md:text-5xl font-light gradient-text mb-3">Receive</h1>
            <p className="text-mist max-w-xl mx-auto font-light">
              Scan the chain for payments sent to your stealth meta-address. Your viewing key
              never leaves this browser.
            </p>
          </header>
        </Reveal>

        <Reveal>
          <StealthFlow
            steps={["Scan Announcement logs", "Match with viewing key", "Derive spending key"]}
            className="mb-8"
          />
        </Reveal>

        {!isConnected ? (
          <Card className="text-center py-10">
            <Eye className="h-7 w-7 text-iris mx-auto mb-3" />
            <p className="text-mist">Connect your wallet first.</p>
          </Card>
        ) : !keys ? (
          <Card className="text-center py-10">
            <KeyRound className="h-7 w-7 text-iris mx-auto mb-3" />
            <p className="text-mist mb-4">No stealth keys found in this browser.</p>
            <a href="/stealth/register" className="nox-btn-primary inline-flex">
              Go to Register
            </a>
          </Card>
        ) : (
          <>
            <Card className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-normal text-fog">Inbox</h2>
                  <p className="text-xs text-mist mt-0.5">
                    Scans the last ~300k blocks of <code>Announcement</code> events
                  </p>
                </div>
                <button
                  onClick={scan}
                  disabled={scanning}
                  className="nox-btn-primary"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${scanning ? "animate-spin" : ""}`} />
                  {scanning ? "Scanning…" : "Scan inbox"}
                </button>
              </div>

              {scanning && (
                <div className="text-xs text-mist font-mono">
                  Scanning blocks {progress.from.toString()} → {progress.to.toString()}…
                </div>
              )}
            </Card>

            {payments.length === 0 && !scanning ? (
              <Card className="text-center py-10">
                <Inbox className="h-7 w-7 text-mist mx-auto mb-3" />
                <p className="text-mist">
                  No stealth payments yet. Click <em>Scan inbox</em> after someone has paid you.
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {payments.map((p, i) => (
                  <PaymentRow key={i} payment={p} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PaymentRow({ payment }: { payment: DiscoveredPayment }) {
  return (
    <Card hover>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-mist mb-1">Stealth address</div>
          <code className="block break-all font-mono text-sm text-fog">
            {payment.stealthAddress}
          </code>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-mist">Amount</div>
          <div className="font-mono text-lg font-normal gradient-text">
            +{Number(formatEther(payment.amount)).toLocaleString()} NOX
          </div>
        </div>
      </div>

      <details className="mt-4 group">
        <summary className="cursor-pointer text-xs text-iris hover:text-glow flex items-center gap-1">
          <span className="group-open:hidden">Reveal stealth private key</span>
          <span className="hidden group-open:inline">Hide key</span>
        </summary>
        <div className="mt-3 rounded-lg border border-violet/30 bg-violet/5 p-3 text-xs">
          <div className="text-violet mb-1">
            Import this into a fresh wallet to spend the NOX above.
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all font-mono text-fog">
              {bytesToHex(payment.stealthPrivKey)}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(bytesToHex(payment.stealthPrivKey));
                toast.success("Private key copied");
              }}
              className="text-mist hover:text-iris shrink-0"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </details>
    </Card>
  );
}
