"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  useAccount,
  useBalance,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits, isAddress, parseUnits, type Hex } from "viem";
import { toast } from "sonner";
import { Eye, Send, Sparkles } from "lucide-react";

import { Card, StatCard } from "@/components/Card";
import { Reveal } from "@/components/Reveal";
import { StealthFlow } from "@/components/StealthFlow";
import { ADDRESSES, hasContracts } from "@/lib/addresses";
import { ASSETS, type Asset } from "@/lib/assets";
import { noxStealthSenderAbi, noxTokenAbi, stealthMiningAbi, stealthRegistryAbi } from "@/lib/abis";
import { computeStealthAddress, type SenderOutput } from "@/lib/stealth";

const fmt = (v: bigint | undefined, decimals: number, max = 4) =>
  v === undefined
    ? "—"
    : Number(formatUnits(v, decimals)).toLocaleString(undefined, { maximumFractionDigits: max });

export default function SendStealthPage() {
  const { address, isConnected } = useAccount();
  const [asset, setAsset] = useState<Asset>(ASSETS[0]);
  const [recipient, setRecipient] = useState("");
  const [amountStr, setAmountStr] = useState("100");
  const [stealth, setStealth] = useState<SenderOutput | null>(null);

  const validRecipient = useMemo(() => (isAddress(recipient) ? (recipient as Hex) : undefined), [recipient]);

  const metaQuery = useReadContract({
    address: ADDRESSES.stealthRegistry,
    abi: stealthRegistryAbi,
    functionName: "stealthMetaAddressOf",
    args: validRecipient ? [validRecipient, 0n] : undefined,
    query: { enabled: hasContracts() && !!validRecipient },
  });

  // Mining stats (always NOX — only NOX sends mine) -------------------------
  const miningStats = useReadContracts({
    contracts: [
      { address: ADDRESSES.stealthMining, abi: stealthMiningAbi, functionName: "currentReward" },
      { address: ADDRESSES.stealthMining, abi: stealthMiningAbi, functionName: "txCount" },
      { address: ADDRESSES.stealthMining, abi: stealthMiningAbi, functionName: "totalMined" },
      { address: ADDRESSES.stealthMining, abi: stealthMiningAbi, functionName: "MINING_SUPPLY" },
      { address: ADDRESSES.stealthMining, abi: stealthMiningAbi, functionName: "MIN_REWARDED_AMOUNT" },
    ],
    allowFailure: true,
    query: { enabled: hasContracts(), refetchInterval: 8000 },
  });
  const [reward, txCount, mined, supply, minReward] = (miningStats.data ?? []).map(
    (r) => (r?.status === "success" ? r.result : undefined),
  ) as [bigint?, bigint?, bigint?, bigint?, bigint?];

  // Selected-asset balance + allowance --------------------------------------
  const erc20 = useReadContracts({
    contracts: [
      { address: asset.address, abi: noxTokenAbi, functionName: "balanceOf", args: address ? [address] : undefined },
      {
        address: asset.address,
        abi: noxTokenAbi,
        functionName: "allowance",
        args: address ? [address, ADDRESSES.noxStealthSender] : undefined,
      },
    ],
    allowFailure: true,
    query: { enabled: hasContracts() && !!address && !asset.isNative, refetchInterval: 8000 },
  });
  const ethBal = useBalance({ address, query: { enabled: !!address && asset.isNative, refetchInterval: 8000 } });

  const bal = asset.isNative
    ? ethBal.data?.value
    : erc20.data?.[0]?.status === "success"
      ? (erc20.data[0].result as bigint)
      : undefined;
  const allowance =
    !asset.isNative && erc20.data?.[1]?.status === "success" ? (erc20.data[1].result as bigint) : undefined;

  const amountWei = useMemo(() => {
    try {
      return parseUnits(amountStr || "0", asset.decimals);
    } catch {
      return 0n;
    }
  }, [amountStr, asset.decimals]);

  const hasMeta = metaQuery.data && metaQuery.data.length > 2;
  const needsApproval = !asset.isNative && allowance !== undefined && allowance < amountWei;
  const willEarn =
    asset.mines && minReward !== undefined && amountWei >= minReward && reward !== undefined && reward > 0n;

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isMiningTx, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const [step, setStep] = useState<"approve" | "send" | null>(null);

  // Guard on txHash so each confirmation (approve, then send) fires once — the
  // poll-driven reads change reference every interval and must not gate this.
  const toastedHash = useRef<string | undefined>(undefined);
  const refetchErc20 = erc20.refetch;
  const refetchMining = miningStats.refetch;
  useEffect(() => {
    if (!isSuccess || !txHash || toastedHash.current === txHash) return;
    toastedHash.current = txHash;
    if (step === "approve") toast.success("Approval confirmed");
    if (step === "send") {
      toast.success("Stealth payment sent");
      setStealth(null);
    }
    refetchErc20();
    refetchMining();
    setStep(null);
  }, [isSuccess, txHash, step, refetchErc20, refetchMining]);

  const derive = () => {
    if (!metaQuery.data) return;
    try {
      setStealth(computeStealthAddress(metaQuery.data as Hex));
    } catch (e) {
      toast.error(`Failed to derive stealth address: ${(e as Error).message}`);
    }
  };

  const approve = () => {
    setStep("approve");
    writeContract({
      address: asset.address,
      abi: noxTokenAbi,
      functionName: "approve",
      args: [ADDRESSES.noxStealthSender, amountWei],
    });
  };

  const send = () => {
    if (!stealth) return;
    setStep("send");
    const tag = ("0x" + stealth.viewTag.toString(16).padStart(2, "0")) as Hex;
    if (asset.kind === "eth") {
      writeContract({
        address: ADDRESSES.noxStealthSender,
        abi: noxStealthSenderAbi,
        functionName: "sendStealthETH",
        args: [0n, stealth.stealthAddress, stealth.ephemeralPubKey, tag],
        value: amountWei,
      });
    } else if (asset.kind === "nox") {
      writeContract({
        address: ADDRESSES.noxStealthSender,
        abi: noxStealthSenderAbi,
        functionName: "sendStealthNox",
        args: [0n, stealth.stealthAddress, amountWei, stealth.ephemeralPubKey, tag],
      });
    } else {
      writeContract({
        address: ADDRESSES.noxStealthSender,
        abi: noxStealthSenderAbi,
        functionName: "sendStealthToken",
        args: [asset.address, 0n, stealth.stealthAddress, amountWei, stealth.ephemeralPubKey, tag],
      });
    }
  };

  const canSend =
    isConnected && !!validRecipient && !!hasMeta && amountWei > 0n && bal !== undefined && bal >= amountWei && !!stealth;
  const busy = isPending || isMiningTx;

  if (!hasContracts()) {
    return <div className="px-6 py-24 text-center text-mist">Deploy contracts to enable stealth send.</div>;
  }

  return (
    <div className="px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <header className="mb-8 text-center">
            <div className="text-xs font-mono uppercase tracking-[0.25em] text-iris/80 mb-3">stealth · send</div>
            <h1 className="text-4xl md:text-5xl font-light gradient-text mb-3">Send Privately</h1>
            <p className="text-mist max-w-xl mx-auto font-light">
              Pay any address that has registered a stealth meta-address — in NOX, ETH or USDC. The
              on-chain recipient is a one-time address no one can link back to your target wallet.
            </p>
          </header>
        </Reveal>

        <Reveal>
          <StealthFlow
            steps={["Look up recipient", "Derive one-time address", "Approve & send"]}
            className="mb-8"
          />
        </Reveal>

        {/* Mining stats */}
        {reward !== undefined && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatCard label="Reward / tx" value={fmt(reward, 18, 0)} sub="NOX" />
            <StatCard label="Total stealth tx" value={txCount?.toString() ?? "—"} sub="all-time" />
            <StatCard label="Mined so far" value={fmt(mined, 18, 0)} sub={`/ ${fmt(supply, 18, 0)} NOX`} />
            <StatCard label={`Your ${asset.symbol}`} value={fmt(bal, asset.decimals, 2)} sub="balance" />
          </div>
        )}

        <Card>
          <label className="nox-label">Recipient wallet (the address that registered a meta-address)</label>
          <input
            type="text"
            placeholder="0x…"
            value={recipient}
            onChange={(e) => {
              setRecipient(e.target.value.trim());
              setStealth(null);
            }}
            className="nox-input font-mono text-sm mb-1"
          />
          {recipient.length > 0 && !validRecipient && <p className="text-xs text-violet mb-3">Invalid address</p>}
          {validRecipient && (
            <p className="text-xs mb-4">
              {metaQuery.isLoading ? (
                <span className="text-mist">Looking up meta-address…</span>
              ) : hasMeta ? (
                <span className="text-iris flex items-center gap-1">
                  <Eye className="h-3 w-3" /> Recipient has a published meta-address
                </span>
              ) : (
                <span className="text-violet">
                  No meta-address registered for this wallet. Ask them to register first.
                </span>
              )}
            </p>
          )}

          <label className="nox-label mt-2">Asset</label>
          <div className="flex gap-2 mb-4">
            {ASSETS.map((a) => (
              <button
                key={a.kind}
                onClick={() => setAsset(a)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-mono border transition-colors ${
                  asset.kind === a.kind
                    ? "border-iris/50 bg-iris/10 text-glow"
                    : "border-white/[0.08] text-mist hover:text-fog"
                }`}
              >
                {a.symbol}
                {a.mines && <span className="ml-1 text-[10px] text-iris/70">⛏</span>}
              </button>
            ))}
          </div>

          <label className="nox-label">Amount ({asset.symbol})</label>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            className="nox-input font-mono mb-5"
          />

          {hasMeta && !stealth && (
            <button onClick={derive} className="nox-btn-ghost w-full mb-3">
              <Sparkles className="mr-2 h-4 w-4" /> Derive one-time stealth address
            </button>
          )}

          {stealth && (
            <div className="rounded-xl border border-iris/30 bg-iris/5 p-4 mb-5 space-y-2">
              <div>
                <div className="text-xs text-mist">One-time stealth address</div>
                <code className="block break-all text-xs text-fog font-mono mt-0.5">{stealth.stealthAddress}</code>
              </div>
              <div>
                <div className="text-xs text-mist">Ephemeral pubkey</div>
                <code className="block break-all text-xs text-mist font-mono mt-0.5">{stealth.ephemeralPubKey}</code>
              </div>
              <div className="text-xs text-mist">
                View tag <span className="font-mono text-fog">0x{stealth.viewTag.toString(16).padStart(2, "0")}</span>
              </div>
              <button onClick={derive} className="text-xs text-iris hover:text-glow mt-2">
                Generate a different one
              </button>
            </div>
          )}

          {needsApproval ? (
            <button onClick={approve} disabled={!canSend || busy} className="nox-btn-primary w-full">
              {step === "approve" && busy ? "Approving…" : `Approve ${fmt(amountWei, asset.decimals)} ${asset.symbol}`}
            </button>
          ) : (
            <button onClick={send} disabled={!canSend || busy} className="nox-btn-primary w-full">
              <Send className="mr-2 h-4 w-4" />
              {step === "send" && busy ? "Sending…" : `Send ${asset.symbol} privately`}
            </button>
          )}

          {/* Reward / no-reward hint */}
          {canSend && willEarn && (
            <div className="mt-3 text-center text-xs text-mist">
              You&apos;ll earn <span className="text-iris font-mono">+{fmt(reward, 18, 0)} NOX</span> as mining reward on
              this send.
            </div>
          )}
          {canSend && !willEarn && asset.mines && (
            <div className="mt-3 text-center text-xs text-mist/70">
              Sends under {fmt(minReward, 18, 0)} NOX are private but earn no mining reward.
            </div>
          )}
          {canSend && !asset.mines && (
            <div className="mt-3 text-center text-xs text-mist/70">
              {asset.symbol} stealth sends are private — mining rewards apply to NOX only.
            </div>
          )}
        </Card>

        <div className="mt-6 text-xs text-mist text-center max-w-xl mx-auto">
          The recipient discovers this payment by scanning <code>Announcement</code> events off-chain. Nothing on-chain
          links the stealth address to their main wallet.
        </div>
      </div>
    </div>
  );
}
