"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatEther, parseEther } from "viem";
import { toast } from "sonner";
import { Card, StatCard } from "@/components/Card";
import { ProgressBar } from "@/components/ProgressBar";
import { ADDRESSES, hasContracts } from "@/lib/addresses";
import { noxGenesisAbi } from "@/lib/abis";
import { AlertTriangle, Flame, Clock } from "lucide-react";

export default function GenesisPage() {
  const { address, isConnected } = useAccount();
  const [units, setUnits] = useState<string>("100");
  const [now, setNow] = useState<number>(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const reads = useReadContracts({
    contracts: [
      { address: ADDRESSES.noxGenesis, abi: noxGenesisAbi, functionName: "GENESIS_PRICE" },
      { address: ADDRESSES.noxGenesis, abi: noxGenesisAbi, functionName: "GENESIS_UNIT" },
      { address: ADDRESSES.noxGenesis, abi: noxGenesisAbi, functionName: "GENESIS_CAP_UNITS" },
      { address: ADDRESSES.noxGenesis, abi: noxGenesisAbi, functionName: "MAX_UNITS_PER_TX" },
      { address: ADDRESSES.noxGenesis, abi: noxGenesisAbi, functionName: "unitsSold" },
      { address: ADDRESSES.noxGenesis, abi: noxGenesisAbi, functionName: "closeAt" },
      { address: ADDRESSES.noxGenesis, abi: noxGenesisAbi, functionName: "seeded" },
      {
        address: ADDRESSES.noxGenesis,
        abi: noxGenesisAbi,
        functionName: "ethPaid",
        args: address ? [address] : undefined,
      },
    ],
    allowFailure: true,
    query: { enabled: hasContracts(), refetchInterval: 5000 },
  });

  const [price, unit, cap, maxPerTx, sold, closeAt, seeded, myEth] = (reads.data ?? []).map(
    (r) => (r?.status === "success" ? r.result : undefined),
  ) as [bigint?, bigint?, bigint?, bigint?, bigint?, bigint?, boolean?, bigint?];

  const unitsBig = useMemo(() => {
    try {
      return BigInt(units || "0");
    } catch {
      return 0n;
    }
  }, [units]);

  const cost = price ? unitsBig * price : 0n;
  const tokensReceived = unit ? unitsBig * unit : 0n;
  const progressPct = cap && sold ? Number((sold * 10_000n) / cap) / 100 : 0;
  const remaining = cap && sold ? cap - sold : 0n;
  const ethRaised = price && sold ? sold * price : 0n;
  const ethTarget = price && cap ? cap * price : 0n;
  const windowLeft = closeAt ? Number(closeAt) - now : 0;

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isSuccess) {
      toast.success("Transaction confirmed");
      reads.refetch();
    }
  }, [isSuccess, reads]);

  const txLimitExceeded = maxPerTx ? unitsBig > maxPerTx : false;
  const capExceeded = cap && sold ? sold + unitsBig > cap : false;
  const canMint = isConnected && unitsBig > 0n && !txLimitExceeded && !capExceeded && !seeded;

  const onMint = () => {
    writeContract({
      address: ADDRESSES.noxGenesis,
      abi: noxGenesisAbi,
      functionName: "mintGenesis",
      args: [unitsBig],
      value: cost,
    });
  };

  const onSeed = () => {
    writeContract({
      address: ADDRESSES.noxGenesis,
      abi: noxGenesisAbi,
      functionName: "seedPool",
    });
  };

  const capReached = cap && sold ? sold >= cap : false;
  const windowExpired = closeAt ? Number(closeAt) <= now : false;

  if (!hasContracts()) {
    return <DeployNotice />;
  }

  return (
    <div className="px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 text-center">
          <h1 className="text-4xl md:text-5xl font-bold gradient-text mb-3">Genesis Sale</h1>
          <p className="text-mist">
            Fixed-price mint. Buy at floor, wait for the pool to seed, then trade on Uniswap v4.
          </p>
        </header>

        {/* Progress */}
        <Card className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm text-mist">Progress</div>
              <div className="text-2xl font-mono font-semibold text-fog">
                {sold !== undefined ? sold.toString() : "—"}
                <span className="text-mist text-base"> / {cap?.toString() ?? "—"}</span>
                <span className="text-iris text-base ml-2">({progressPct.toFixed(2)}%)</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-mist">ETH raised</div>
              <div className="text-2xl font-mono font-semibold text-fog">
                {ethRaised ? Number(formatEther(ethRaised)).toFixed(4) : "0"}
                <span className="text-mist text-base"> / {ethTarget ? formatEther(ethTarget) : "—"}</span>
              </div>
            </div>
          </div>
          <ProgressBar value={progressPct} />
        </Card>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <StatCard
            label="Price"
            value={price ? formatEther(price) + " ETH" : "—"}
            sub={`per ${unit ? Number(formatEther(unit)).toLocaleString() : "—"} NOX`}
          />
          <StatCard
            label="Remaining"
            value={remaining.toString()}
            sub="units left in the cap"
          />
          <StatCard
            label={windowExpired ? "Window status" : "Window left"}
            value={
              windowExpired ? (
                <span className="text-iris">Closed</span>
              ) : (
                <FormatDuration seconds={windowLeft} />
              )
            }
            sub={
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> until controller can force seed
              </span>
            }
          />
        </div>

        {/* Mint form / seed UI */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <h2 className="text-lg font-semibold text-fog mb-4">Mint NOX</h2>

            {seeded ? (
              <div className="rounded-xl border border-iris/30 bg-iris/10 p-4 text-sm text-glow">
                Genesis sealed. The Uniswap v4 pool is live — trade NOX directly there.
              </div>
            ) : (
              <>
                <label className="nox-label">Units (1 unit = {unit ? Number(formatEther(unit)).toLocaleString() : "1,000"} NOX)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={maxPerTx ? Number(maxPerTx) : 10_000}
                  value={units}
                  onChange={(e) => setUnits(e.target.value)}
                  className="nox-input mb-4 font-mono"
                />

                <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
                  <div className="rounded-lg border border-veil bg-night/40 p-3">
                    <div className="text-mist text-xs">You pay</div>
                    <div className="font-mono text-fog">
                      {cost ? formatEther(cost) : "0"} ETH
                    </div>
                  </div>
                  <div className="rounded-lg border border-veil bg-night/40 p-3">
                    <div className="text-mist text-xs">You receive</div>
                    <div className="font-mono text-fog">
                      {tokensReceived ? Number(formatEther(tokensReceived)).toLocaleString() : "0"} NOX
                    </div>
                  </div>
                </div>

                {txLimitExceeded && (
                  <ValidationBanner>
                    Max {maxPerTx?.toString()} units per tx.
                  </ValidationBanner>
                )}
                {capExceeded && (
                  <ValidationBanner>
                    Exceeds remaining cap. Try {remaining.toString()} or fewer.
                  </ValidationBanner>
                )}

                <button
                  onClick={onMint}
                  disabled={!canMint || isPending || isMining}
                  className="nox-btn-primary w-full"
                >
                  {!isConnected
                    ? "Connect wallet first"
                    : isPending
                      ? "Confirm in wallet…"
                      : isMining
                        ? "Mining…"
                        : "Mint Genesis"}
                </button>
              </>
            )}

            {address && myEth !== undefined && myEth > 0n && (
              <div className="mt-4 pt-4 border-t border-veil/60 text-sm">
                <div className="text-mist">Your contribution</div>
                <div className="font-mono text-fog">{formatEther(myEth)} ETH</div>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-fog mb-4">Pool seed</h2>

            {seeded ? (
              <div className="text-sm text-mist">
                Seeded. NOX is live on Uniswap v4 on Base.
              </div>
            ) : capReached ? (
              <>
                <div className="rounded-xl border border-iris/30 bg-iris/10 p-4 text-sm text-glow mb-4 flex items-start gap-2">
                  <Flame className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    Cap reached. Anyone can call <code>seedPool()</code> now — first
                    caller pays the gas to open the Uniswap v4 pool.
                  </span>
                </div>
                <button
                  onClick={onSeed}
                  disabled={!isConnected || isPending || isMining}
                  className="nox-btn-primary w-full"
                >
                  {isPending ? "Confirm…" : isMining ? "Seeding…" : "Seed pool"}
                </button>
              </>
            ) : (
              <div className="text-sm text-mist space-y-2">
                <p>
                  Once the cap fills, the pool seeds automatically (anyone can trigger it).
                  If the window expires before the cap fills, only the project controller
                  can force-seed with the partial raise.
                </p>
                <p className="text-xs">
                  Worst case: no seed within 48h after the window closes → buyers can call{" "}
                  <code>refund()</code> for ETH 1:1.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function ValidationBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-lg border border-violet/40 bg-violet/10 p-3 text-sm text-glow flex items-start gap-2">
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function FormatDuration({ seconds }: { seconds: number }) {
  if (seconds <= 0) return <span>Closed</span>;
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return (
    <span>
      {days}d {hours}h {mins}m
    </span>
  );
}

function DeployNotice() {
  return (
    <div className="px-6 py-24">
      <div className="mx-auto max-w-xl">
        <Card>
          <AlertTriangle className="h-6 w-6 text-iris mb-3" />
          <h2 className="text-xl font-semibold text-fog mb-2">Contracts not deployed yet</h2>
          <p className="text-sm text-mist mb-4">
            Set <code className="text-glow">NEXT_PUBLIC_NOX_GENESIS</code> and the other
            contract addresses in <code>web/.env.local</code> after running{" "}
            <code className="text-glow">forge script script/Deploy.s.sol --broadcast</code>.
          </p>
          <pre className="text-xs bg-noir/60 border border-veil rounded-lg p-3 overflow-x-auto font-mono text-mist">
{`NEXT_PUBLIC_NOX_TOKEN=0x...
NEXT_PUBLIC_NOX_GENESIS=0x...
NEXT_PUBLIC_NOX_HOOK=0x...
NEXT_PUBLIC_STEALTH_REGISTRY=0x...
NEXT_PUBLIC_STEALTH_ANNOUNCER=0x...
NEXT_PUBLIC_NOX_STEALTH_SENDER=0x...
NEXT_PUBLIC_STEALTH_MINING=0x...`}
          </pre>
        </Card>
      </div>
    </div>
  );
}
