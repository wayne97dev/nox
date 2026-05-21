"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatEther, isAddress, parseEther, type Hex } from "viem";
import { toast } from "sonner";
import { Eye, Send, Sparkles } from "lucide-react";

import { Card, StatCard } from "@/components/Card";
import { Reveal } from "@/components/Reveal";
import { StealthFlow } from "@/components/StealthFlow";
import { ADDRESSES, hasContracts } from "@/lib/addresses";
import { noxStealthSenderAbi, noxTokenAbi, stealthMiningAbi, stealthRegistryAbi } from "@/lib/abis";
import { computeStealthAddress, type SenderOutput } from "@/lib/stealth";

export default function SendStealthPage() {
  const { address, isConnected } = useAccount();
  const [recipient, setRecipient] = useState("");
  const [amountStr, setAmountStr] = useState("100");
  const [stealth, setStealth] = useState<SenderOutput | null>(null);

  const validRecipient = useMemo(() => isAddress(recipient) ? (recipient as Hex) : undefined, [recipient]);

  const metaQuery = useReadContract({
    address: ADDRESSES.stealthRegistry,
    abi: stealthRegistryAbi,
    functionName: "stealthMetaAddressOf",
    args: validRecipient ? [validRecipient, 0n] : undefined,
    query: { enabled: hasContracts() && !!validRecipient },
  });

  const aux = useReadContracts({
    contracts: [
      {
        address: ADDRESSES.noxToken,
        abi: noxTokenAbi,
        functionName: "balanceOf",
        args: address ? [address] : undefined,
      },
      {
        address: ADDRESSES.noxToken,
        abi: noxTokenAbi,
        functionName: "allowance",
        args: address ? [address, ADDRESSES.noxStealthSender] : undefined,
      },
      { address: ADDRESSES.stealthMining, abi: stealthMiningAbi, functionName: "currentReward" },
      { address: ADDRESSES.stealthMining, abi: stealthMiningAbi, functionName: "txCount" },
      { address: ADDRESSES.stealthMining, abi: stealthMiningAbi, functionName: "totalMined" },
      { address: ADDRESSES.stealthMining, abi: stealthMiningAbi, functionName: "MINING_SUPPLY" },
    ],
    allowFailure: true,
    query: { enabled: hasContracts(), refetchInterval: 8000 },
  });

  const [bal, allowance, reward, txCount, mined, supply] = (aux.data ?? []).map(
    (r) => (r?.status === "success" ? r.result : undefined),
  ) as [bigint?, bigint?, bigint?, bigint?, bigint?, bigint?];

  const amountWei = useMemo(() => {
    try {
      return parseEther(amountStr || "0");
    } catch {
      return 0n;
    }
  }, [amountStr]);

  const hasMeta = metaQuery.data && metaQuery.data.length > 2;
  const needsApproval = allowance !== undefined && allowance < amountWei;

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const [step, setStep] = useState<"approve" | "send" | null>(null);

  // Guard on txHash so each confirmation (approve, then send) fires once — `aux`
  // changes reference on every poll and must not gate this effect.
  const toastedHash = useRef<string | undefined>(undefined);
  const refetchAux = aux.refetch;
  useEffect(() => {
    if (!isSuccess || !txHash || toastedHash.current === txHash) return;
    toastedHash.current = txHash;
    if (step === "approve") toast.success("Approval confirmed");
    if (step === "send") {
      toast.success("Stealth payment sent");
      setStealth(null);
    }
    refetchAux();
    setStep(null);
  }, [isSuccess, txHash, step, refetchAux]);

  const derive = () => {
    if (!metaQuery.data) return;
    try {
      const out = computeStealthAddress(metaQuery.data as Hex);
      setStealth(out);
    } catch (e) {
      toast.error(`Failed to derive stealth address: ${(e as Error).message}`);
    }
  };

  const approve = () => {
    setStep("approve");
    writeContract({
      address: ADDRESSES.noxToken,
      abi: noxTokenAbi,
      functionName: "approve",
      args: [ADDRESSES.noxStealthSender, amountWei],
    });
  };

  const send = () => {
    if (!stealth) return;
    setStep("send");
    writeContract({
      address: ADDRESSES.noxStealthSender,
      abi: noxStealthSenderAbi,
      functionName: "sendStealthNox",
      args: [
        0n,
        stealth.stealthAddress,
        amountWei,
        stealth.ephemeralPubKey,
        ("0x" + stealth.viewTag.toString(16).padStart(2, "0")) as Hex,
      ],
    });
  };

  const canSend = isConnected && validRecipient && hasMeta && amountWei > 0n && bal !== undefined && bal >= amountWei && stealth;

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
              Pay any address that has registered a stealth meta-address. The on-chain
              recipient is a one-time address that no one can link back to your target wallet.
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
            <StatCard
              label="Reward / tx"
              value={`${reward ? Number(formatEther(reward)).toLocaleString() : "—"}`}
              sub="NOX"
            />
            <StatCard
              label="Total stealth tx"
              value={txCount?.toString() ?? "—"}
              sub="all-time"
            />
            <StatCard
              label="Mined so far"
              value={`${mined ? Number(formatEther(mined)).toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}`}
              sub={`/ ${supply ? Number(formatEther(supply)).toLocaleString() : "—"} NOX`}
            />
            <StatCard
              label="Your balance"
              value={bal ? Number(formatEther(bal)).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
              sub="NOX"
            />
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
          {recipient.length > 0 && !validRecipient && (
            <p className="text-xs text-violet mb-3">Invalid address</p>
          )}
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

          <label className="nox-label mt-2">Amount (NOX)</label>
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
                <code className="block break-all text-xs text-fog font-mono mt-0.5">
                  {stealth.stealthAddress}
                </code>
              </div>
              <div>
                <div className="text-xs text-mist">Ephemeral pubkey</div>
                <code className="block break-all text-xs text-mist font-mono mt-0.5">
                  {stealth.ephemeralPubKey}
                </code>
              </div>
              <div className="text-xs text-mist">
                View tag <span className="font-mono text-fog">0x{stealth.viewTag.toString(16).padStart(2, "0")}</span>
              </div>
              <button
                onClick={derive}
                className="text-xs text-iris hover:text-glow mt-2"
              >
                Generate a different one
              </button>
            </div>
          )}

          {needsApproval ? (
            <button
              onClick={approve}
              disabled={!canSend || isPending || isMining}
              className="nox-btn-primary w-full"
            >
              {step === "approve" && (isPending || isMining)
                ? "Approving…"
                : `Approve ${Number(formatEther(amountWei)).toLocaleString()} NOX`}
            </button>
          ) : (
            <button
              onClick={send}
              disabled={!canSend || isPending || isMining}
              className="nox-btn-primary w-full"
            >
              <Send className="mr-2 h-4 w-4" />
              {step === "send" && (isPending || isMining)
                ? "Sending…"
                : "Send privately"}
            </button>
          )}

          {reward !== undefined && reward > 0n && canSend && (
            <div className="mt-3 text-center text-xs text-mist">
              You'll earn{" "}
              <span className="text-iris font-mono">
                +{Number(formatEther(reward)).toLocaleString()} NOX
              </span>{" "}
              as mining reward on this send.
            </div>
          )}
        </Card>

        <div className="mt-6 text-xs text-mist text-center max-w-xl mx-auto">
          The recipient discovers this payment by scanning <code>Announcement</code> events
          off-chain. Nothing on-chain links the stealth address to their main wallet.
        </div>
      </div>
    </div>
  );
}
