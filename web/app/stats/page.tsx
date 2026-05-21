"use client";

import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import { formatEther, type Address } from "viem";
import { Card, StatCard } from "@/components/Card";
import { ProgressBar } from "@/components/ProgressBar";
import { Reveal } from "@/components/Reveal";
import { ADDRESSES, hasContracts } from "@/lib/addresses";
import { noxGenesisAbi, stateViewAbi, poolManagerAbi, stealthMiningAbi } from "@/lib/abis";
import { computePoolId, pricesFromSqrtX96, reservesFromLiquidity, currencyId } from "@/lib/pool";
import { Activity, Droplets, Coins, Pickaxe, ExternalLink } from "lucide-react";

const num = (n: number, max = 4) =>
  n.toLocaleString(undefined, { maximumFractionDigits: max });

export default function StatsPage() {
  // Stage 1: genesis state + mining (always)
  const base = useReadContracts({
    contracts: [
      { address: ADDRESSES.noxGenesis, abi: noxGenesisAbi, functionName: "seeded" },
      { address: ADDRESSES.noxGenesis, abi: noxGenesisAbi, functionName: "poolKey" },
      { address: ADDRESSES.stealthMining, abi: stealthMiningAbi, functionName: "totalMined" },
      { address: ADDRESSES.stealthMining, abi: stealthMiningAbi, functionName: "txCount" },
      { address: ADDRESSES.stealthMining, abi: stealthMiningAbi, functionName: "currentReward" },
      { address: ADDRESSES.stealthMining, abi: stealthMiningAbi, functionName: "MINING_SUPPLY" },
    ],
    allowFailure: true,
    query: { enabled: hasContracts(), refetchInterval: 12_000 },
  });

  const seeded = base.data?.[0]?.result as boolean | undefined;
  const poolKeyRaw = base.data?.[1]?.result as
    | readonly [Address, Address, number, number, Address]
    | undefined;
  const totalMined = base.data?.[2]?.result as bigint | undefined;
  const txCount = base.data?.[3]?.result as bigint | undefined;
  const currentReward = base.data?.[4]?.result as bigint | undefined;
  const miningSupply = base.data?.[5]?.result as bigint | undefined;

  const poolId = useMemo(() => {
    if (!poolKeyRaw) return undefined;
    const [currency0, currency1, fee, tickSpacing, hooks] = poolKeyRaw;
    if (currency1 === "0x0000000000000000000000000000000000000000") return undefined;
    return computePoolId({ currency0, currency1, fee, tickSpacing, hooks });
  }, [poolKeyRaw]);

  const noxCurrency = poolKeyRaw?.[1];

  // Stage 2: pool state + fees (once seeded + poolId known)
  const pool = useReadContracts({
    contracts: [
      { address: ADDRESSES.stateView, abi: stateViewAbi, functionName: "getSlot0", args: poolId ? [poolId] : undefined },
      { address: ADDRESSES.stateView, abi: stateViewAbi, functionName: "getLiquidity", args: poolId ? [poolId] : undefined },
      {
        address: ADDRESSES.poolManager,
        abi: poolManagerAbi,
        functionName: "balanceOf",
        args: [ADDRESSES.noxHook, 0n],
      },
      {
        address: ADDRESSES.poolManager,
        abi: poolManagerAbi,
        functionName: "balanceOf",
        args: noxCurrency ? [ADDRESSES.noxHook, currencyId(noxCurrency)] : undefined,
      },
    ],
    allowFailure: true,
    query: { enabled: hasContracts() && !!seeded && !!poolId, refetchInterval: 12_000 },
  });

  const slot0 = pool.data?.[0]?.result as readonly [bigint, number, number, number] | undefined;
  const liquidity = pool.data?.[1]?.result as bigint | undefined;
  const ethFees = pool.data?.[2]?.result as bigint | undefined;
  const noxFees = pool.data?.[3]?.result as bigint | undefined;

  const sqrtPriceX96 = slot0?.[0];
  const { ethPerNox } = sqrtPriceX96 ? pricesFromSqrtX96(sqrtPriceX96) : { ethPerNox: 0 };
  const { ethReserve, noxReserve } =
    sqrtPriceX96 && liquidity ? reservesFromLiquidity(sqrtPriceX96, liquidity) : { ethReserve: 0, noxReserve: 0 };
  const tvlEth = ethReserve + noxReserve * ethPerNox;

  const minedPct =
    miningSupply && totalMined ? Number((totalMined * 10_000n) / miningSupply) / 100 : 0;

  if (!hasContracts()) {
    return <Notice msg="Set the contract addresses in web/.env.local to view live stats." />;
  }

  return (
    <div className="px-5 sm:px-8 py-12">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <header className="mb-10 text-center">
            <div className="text-xs font-mono uppercase tracking-[0.25em] text-iris/80 mb-3">live</div>
            <h1 className="text-4xl md:text-5xl font-light gradient-text mb-3">Protocol stats</h1>
            <p className="text-mist font-light">Pool, fees, and mining — read straight from the chain.</p>
          </header>
        </Reveal>

        {!seeded ? (
          <Reveal>
            <Card className="text-center py-14">
              <Droplets className="h-7 w-7 text-iris mx-auto mb-3" />
              <h2 className="text-xl font-light text-fog mb-2">Pool not live yet</h2>
              <p className="text-mist font-light max-w-md mx-auto">
                Price, TVL and fees appear once the genesis cap fills and{" "}
                <code className="text-glow">seedPool()</code> opens the Uniswap v4 market. Mining
                stats are shown below regardless.
              </p>
            </Card>
          </Reveal>
        ) : (
          <Reveal>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <StatCard label="NOX price" value={ethPerNox ? num(ethPerNox, 9) : "—"} sub="ETH per NOX" />
              <StatCard label="Pool TVL" value={tvlEth ? `${num(tvlEth, 3)}` : "—"} sub="ETH (both sides)" />
              <StatCard label="ETH reserve" value={ethReserve ? num(ethReserve, 3) : "—"} sub="ETH in pool" />
              <StatCard label="NOX reserve" value={noxReserve ? num(noxReserve, 0) : "—"} sub="NOX in pool" />
            </div>
          </Reveal>
        )}

        {/* Fees */}
        {seeded && (
          <Reveal>
            <Card className="mb-4">
              <div className="flex items-center gap-2 mb-4">
                <Coins className="h-4 w-4 text-iris" />
                <h2 className="text-lg font-light text-fog">Hook fees (claimable by treasury)</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
                  <div className="text-xs text-mist font-mono uppercase tracking-wider mb-1">Pending ETH</div>
                  <div className="text-2xl font-mono font-light text-fog">
                    {ethFees !== undefined ? num(Number(formatEther(ethFees)), 5) : "—"}
                  </div>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
                  <div className="text-xs text-mist font-mono uppercase tracking-wider mb-1">Pending NOX</div>
                  <div className="text-2xl font-mono font-light text-fog">
                    {noxFees !== undefined ? num(Number(formatEther(noxFees)), 2) : "—"}
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs text-mist font-light">
                Accrued as ERC-6909 claims on the PoolManager. Anyone can call{" "}
                <code className="text-glow">withdrawFees()</code> to sweep them to the treasury.
              </p>
            </Card>
          </Reveal>
        )}

        {/* Mining */}
        <Reveal>
          <Card>
            <div className="flex items-center gap-2 mb-5">
              <Pickaxe className="h-4 w-4 text-iris" />
              <h2 className="text-lg font-light text-fog">Stealth mining</h2>
            </div>

            <div className="flex items-end justify-between mb-2">
              <div>
                <div className="text-xs text-mist font-mono uppercase tracking-wider">Mined</div>
                <div className="text-2xl font-mono font-light text-fog">
                  {totalMined !== undefined ? num(Number(formatEther(totalMined)), 0) : "—"}
                  <span className="text-mist text-base">
                    {" "}
                    / {miningSupply !== undefined ? num(Number(formatEther(miningSupply)), 0) : "—"} NOX
                  </span>
                </div>
              </div>
              <div className="text-iris font-mono">{minedPct.toFixed(2)}%</div>
            </div>
            <ProgressBar value={minedPct} className="mb-6" />

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Mini label="Reward / tx" value={currentReward !== undefined ? `${num(Number(formatEther(currentReward)), 0)} NOX` : "—"} />
              <Mini label="Stealth tx" value={txCount !== undefined ? txCount.toString() : "—"} />
              <Mini
                label="Current era"
                value={txCount !== undefined ? Math.floor(Number(txCount) / 100_000).toString() : "—"}
              />
            </div>
          </Card>
        </Reveal>

        {ADDRESSES.noxToken !== "0x0000000000000000000000000000000000000000" && (
          <div className="mt-6 text-center">
            <a
              href={`https://basescan.org/token/${ADDRESSES.noxToken}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-mono text-mist hover:text-fog transition-colors"
            >
              View NOX on Basescan <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
      <div className="text-xs text-mist font-mono uppercase tracking-wider mb-1">{label}</div>
      <div className="text-lg font-mono font-light text-fog">{value}</div>
    </div>
  );
}

function Notice({ msg }: { msg: string }) {
  return (
    <div className="px-5 sm:px-8 py-24">
      <div className="mx-auto max-w-xl">
        <Card className="text-center py-10">
          <Activity className="h-6 w-6 text-iris mx-auto mb-3" />
          <h2 className="text-xl font-light text-fog mb-2">Stats unavailable</h2>
          <p className="text-sm text-mist font-light">{msg}</p>
        </Card>
      </div>
    </div>
  );
}
