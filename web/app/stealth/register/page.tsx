"use client";

import { useEffect, useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { toast } from "sonner";
import { bytesToHex } from "viem";

import { Card } from "@/components/Card";
import { ADDRESSES, hasContracts } from "@/lib/addresses";
import { stealthRegistryAbi } from "@/lib/abis";
import {
  generateStealthKeys,
  metaAddressFromKeys,
  saveKeys,
  loadKeys,
  clearKeys,
  type StealthKeys,
} from "@/lib/stealth";
import { ShieldCheck, KeyRound, Copy, RefreshCw, Trash2, Download } from "lucide-react";

export default function RegisterStealthPage() {
  const { address, isConnected } = useAccount();
  const [keys, setKeys] = useState<StealthKeys | null>(null);
  const [showSecrets, setShowSecrets] = useState(false);

  useEffect(() => {
    setKeys(loadKeys());
  }, []);

  const meta = keys ? metaAddressFromKeys(keys) : undefined;

  const onChainMeta = useReadContract({
    address: ADDRESSES.stealthRegistry,
    abi: stealthRegistryAbi,
    functionName: "stealthMetaAddressOf",
    args: address ? [address, 0n] : undefined,
    query: { enabled: hasContracts() && !!address },
  });

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isSuccess) {
      toast.success("Meta-address registered on-chain");
      onChainMeta.refetch();
    }
  }, [isSuccess, onChainMeta]);

  const isOnChain = onChainMeta.data && onChainMeta.data.length > 2; // more than just "0x"

  const generate = () => {
    const k = generateStealthKeys();
    setKeys(k);
    saveKeys(k);
    toast.success("New stealth keypair generated and saved locally");
  };

  const wipe = () => {
    if (!confirm("Wipe local keys? Make sure you backed them up — without them you lose access to incoming stealth payments forever.")) return;
    clearKeys();
    setKeys(null);
    toast.success("Local keys wiped");
  };

  const publish = () => {
    if (!keys) return;
    writeContract({
      address: ADDRESSES.stealthRegistry,
      abi: stealthRegistryAbi,
      functionName: "registerKeys",
      args: [0n, meta!],
    });
  };

  const downloadBackup = () => {
    if (!keys) return;
    const payload = {
      spendingPrivKey: bytesToHex(keys.spendingPrivKey),
      viewingPrivKey: bytesToHex(keys.viewingPrivKey),
      spendingPubKey: bytesToHex(keys.spendingPubKey),
      viewingPubKey: bytesToHex(keys.viewingPubKey),
      metaAddress: meta,
      address,
      created: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nox-stealth-keys-${address?.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!hasContracts()) return <DeployPlaceholder />;

  return (
    <div className="px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10 text-center">
          <h1 className="text-4xl md:text-5xl font-bold gradient-text mb-3">Register</h1>
          <p className="text-mist max-w-xl mx-auto">
            Generate a stealth keypair (locally, never sent to a server), then publish your
            meta-address on-chain so anyone can pay you privately.
          </p>
        </header>

        {!isConnected ? (
          <Card className="text-center py-10">
            <KeyRound className="h-7 w-7 text-iris mx-auto mb-3" />
            <p className="text-mist">Connect your wallet to start.</p>
          </Card>
        ) : !keys ? (
          <Card>
            <KeyRound className="h-6 w-6 text-iris mb-3" />
            <h2 className="text-lg font-semibold text-fog mb-2">Generate your stealth keypair</h2>
            <p className="text-sm text-mist mb-5">
              Two random secp256k1 keys: a <strong>spending</strong> key (controls the funds)
              and a <strong>viewing</strong> key (lets you scan for incoming payments). Stored
              only in your browser localStorage.
            </p>
            <button onClick={generate} className="nox-btn-primary w-full">
              <RefreshCw className="mr-2 h-4 w-4" /> Generate keypair
            </button>
          </Card>
        ) : (
          <>
            <Card className="mb-4">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-fog">Your meta-address</h2>
                  <p className="text-xs text-mist mt-1">66-byte concat of spendingPubKey || viewingPubKey</p>
                </div>
                {isOnChain ? (
                  <span className="nox-chip">
                    <ShieldCheck className="h-3 w-3" /> Published
                  </span>
                ) : (
                  <span className="nox-chip" style={{ color: "#9CA3AF", borderColor: "#161329" }}>
                    Not on-chain yet
                  </span>
                )}
              </div>

              <CopyableHex value={meta!} />

              {!isOnChain && (
                <button
                  onClick={publish}
                  disabled={isPending || isMining}
                  className="nox-btn-primary mt-4 w-full"
                >
                  {isPending ? "Confirm…" : isMining ? "Publishing…" : "Publish on-chain"}
                </button>
              )}
            </Card>

            <Card className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-fog">Private keys</h3>
                <button
                  onClick={() => setShowSecrets((s) => !s)}
                  className="text-xs text-iris hover:text-glow"
                >
                  {showSecrets ? "Hide" : "Reveal"}
                </button>
              </div>

              <div className="space-y-3">
                <SecretField label="Spending key" value={showSecrets ? bytesToHex(keys.spendingPrivKey) : maskHex(bytesToHex(keys.spendingPrivKey))} />
                <SecretField label="Viewing key" value={showSecrets ? bytesToHex(keys.viewingPrivKey) : maskHex(bytesToHex(keys.viewingPrivKey))} />
              </div>

              <div className="mt-5 flex gap-2">
                <button onClick={downloadBackup} className="nox-btn-ghost flex-1">
                  <Download className="mr-2 h-4 w-4" /> Backup JSON
                </button>
                <button onClick={wipe} className="nox-btn-ghost flex-1 hover:!border-violet/60 hover:!text-violet">
                  <Trash2 className="mr-2 h-4 w-4" /> Wipe locally
                </button>
              </div>

              <div className="mt-5 rounded-lg border border-violet/30 bg-violet/5 p-3 text-xs text-glow/90">
                <strong>Backup is critical.</strong> Lose the spending key → lose every payment
                ever sent to your stealth meta-address. There is no recovery. Treat this like
                a seed phrase.
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function CopyableHex({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-veil bg-noir/60 p-3">
      <code className="flex-1 break-all text-xs text-fog font-mono">{value}</code>
      <button
        onClick={() => {
          navigator.clipboard.writeText(value);
          toast.success("Copied");
        }}
        className="text-mist hover:text-iris shrink-0"
        aria-label="copy"
      >
        <Copy className="h-4 w-4" />
      </button>
    </div>
  );
}

function SecretField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-mist mb-1">{label}</div>
      <CopyableHex value={value} />
    </div>
  );
}

function maskHex(hex: string) {
  return hex.slice(0, 6) + "•".repeat(54) + hex.slice(-4);
}

function DeployPlaceholder() {
  return (
    <div className="px-6 py-24 text-center text-mist">
      Deploy contracts and set env vars to enable stealth registration.
    </div>
  );
}
