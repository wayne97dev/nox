/**
 * Client-side ERC-5564 (scheme 0, SECP256k1) implementation.
 *
 * Receiver side:
 *   1. `generateStealthKeys()` once, save the (spendingPriv, viewingPriv) pair somewhere safe.
 *   2. `metaAddressFromKeys(keys)` -> publish to the StealthRegistry via `registerKeys(0, meta)`.
 *   3. Periodically `scanAnnouncements(keys, events)` to find incoming payments and derive
 *      their stealth private keys for spending.
 *
 * Sender side:
 *   1. Read `metaAddress` from registry for the receiver.
 *   2. `computeStealthAddress(metaAddress)` -> get { stealthAddress, ephemeralPubKey, viewTag }.
 *   3. Call `NoxStealthSender.sendStealthNox(...)` on-chain.
 */

import { CURVE, getPublicKey, ProjectivePoint, utils } from "@noble/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex, hexToBytes } from "viem";
import type { Hex } from "viem";

const POINT = ProjectivePoint;
const ORDER = CURVE.n;

export interface StealthKeys {
  spendingPrivKey: Uint8Array; // 32 bytes
  viewingPrivKey: Uint8Array; // 32 bytes
  spendingPubKey: Uint8Array; // 33 bytes compressed
  viewingPubKey: Uint8Array; // 33 bytes compressed
}

export interface SenderOutput {
  stealthAddress: Hex;
  ephemeralPubKey: Hex; // 33-byte compressed
  viewTag: number; // 0-255
}

export interface AnnouncementLog {
  stealthAddress: Hex;
  ephemeralPubKey: Hex;
  metadata: Hex;
}

export interface DiscoveredPayment {
  stealthAddress: Hex;
  amount: bigint;
  token: Hex;
  ephemeralPubKey: Hex;
  stealthPrivKey: Uint8Array;
}

// ---------------------------------------------------------------------------
// Key generation
// ---------------------------------------------------------------------------

export function generateStealthKeys(): StealthKeys {
  const spendingPrivKey = utils.randomPrivateKey();
  const viewingPrivKey = utils.randomPrivateKey();
  return {
    spendingPrivKey,
    viewingPrivKey,
    spendingPubKey: getPublicKey(spendingPrivKey, true),
    viewingPubKey: getPublicKey(viewingPrivKey, true),
  };
}

export function keysFromPrivates(spendingPriv: Uint8Array, viewingPriv: Uint8Array): StealthKeys {
  return {
    spendingPrivKey: spendingPriv,
    viewingPrivKey: viewingPriv,
    spendingPubKey: getPublicKey(spendingPriv, true),
    viewingPubKey: getPublicKey(viewingPriv, true),
  };
}

export function metaAddressFromKeys(keys: StealthKeys): Hex {
  const concat = new Uint8Array(66);
  concat.set(keys.spendingPubKey, 0);
  concat.set(keys.viewingPubKey, 33);
  return bytesToHex(concat);
}

export function parseMetaAddress(metaAddress: Hex): {
  spendingPubKey: Uint8Array;
  viewingPubKey: Uint8Array;
} {
  const bytes = hexToBytes(metaAddress);
  if (bytes.length !== 66) {
    throw new Error(`expected 66-byte meta-address, got ${bytes.length}`);
  }
  return {
    spendingPubKey: bytes.slice(0, 33),
    viewingPubKey: bytes.slice(33, 66),
  };
}

// ---------------------------------------------------------------------------
// Sender flow
// ---------------------------------------------------------------------------

export function computeStealthAddress(metaAddress: Hex): SenderOutput {
  const { spendingPubKey, viewingPubKey } = parseMetaAddress(metaAddress);

  const ephemeralPrivKey = utils.randomPrivateKey();
  const ephemeralPubKey = getPublicKey(ephemeralPrivKey, true);

  // Shared point S = ephemeralPriv * viewingPub
  const viewingPoint = POINT.fromHex(bytesToHex(viewingPubKey).slice(2));
  const sharedPoint = viewingPoint.multiply(bytesToBigInt(ephemeralPrivKey));
  const sharedX = sharedPoint.toRawBytes(true).slice(1); // strip prefix byte → 32-byte X

  const hashedSecret = keccak_256(sharedX); // 32 bytes
  const viewTag = hashedSecret[0];
  const hashedSecretScalar = bytesToBigInt(hashedSecret) % ORDER;

  // Stealth public key = spendingPub + h_s * G
  const spendingPoint = POINT.fromHex(bytesToHex(spendingPubKey).slice(2));
  const stealthPoint = spendingPoint.add(POINT.BASE.multiply(hashedSecretScalar));
  const stealthPubCompressed = stealthPoint.toRawBytes(true);
  const stealthAddress = pubKeyToAddress(stealthPubCompressed);

  return {
    stealthAddress,
    ephemeralPubKey: bytesToHex(ephemeralPubKey),
    viewTag,
  };
}

// ---------------------------------------------------------------------------
// Receiver flow
// ---------------------------------------------------------------------------

export function scanAnnouncements(keys: StealthKeys, announcements: AnnouncementLog[]): DiscoveredPayment[] {
  const found: DiscoveredPayment[] = [];
  const viewingScalar = bytesToBigInt(keys.viewingPrivKey);
  const spendingScalar = bytesToBigInt(keys.spendingPrivKey);
  const spendingPoint = POINT.fromHex(bytesToHex(keys.spendingPubKey).slice(2));

  for (const ann of announcements) {
    const ephPub = hexToBytes(ann.ephemeralPubKey);
    if (ephPub.length !== 33) continue;

    let ephPoint;
    try {
      ephPoint = POINT.fromHex(bytesToHex(ephPub).slice(2));
    } catch {
      continue;
    }

    // Shared point = viewingPriv * ephemeralPub
    const sharedPoint = ephPoint.multiply(viewingScalar);
    const sharedX = sharedPoint.toRawBytes(true).slice(1);
    const hashedSecret = keccak_256(sharedX);
    const viewTagComputed = hashedSecret[0];

    // Fast filter via view tag in metadata[0]
    const meta = hexToBytes(ann.metadata);
    if (meta.length === 0 || meta[0] !== viewTagComputed) continue;

    // Confirm by recomputing stealth address
    const hashedSecretScalar = bytesToBigInt(hashedSecret) % ORDER;
    const stealthPoint = spendingPoint.add(POINT.BASE.multiply(hashedSecretScalar));
    const stealthPubCompressed = stealthPoint.toRawBytes(true);
    const expectedAddr = pubKeyToAddress(stealthPubCompressed).toLowerCase();
    if (expectedAddr !== ann.stealthAddress.toLowerCase()) continue;

    // Decode Umbra-style metadata: [0]=tag, [1..21)=token, [21..53]=amount
    if (meta.length < 53) continue;
    const token = bytesToHex(meta.slice(1, 21));
    const amount = bytesToBigInt(meta.slice(21, 53));

    // Derive stealth private key = (spendingPriv + h_s) mod n
    const stealthPrivScalar = (spendingScalar + hashedSecretScalar) % ORDER;
    const stealthPrivKey = bigIntTo32Bytes(stealthPrivScalar);

    found.push({
      stealthAddress: ann.stealthAddress,
      amount,
      token,
      ephemeralPubKey: ann.ephemeralPubKey,
      stealthPrivKey,
    });
  }

  return found;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function pubKeyToAddress(pubKeyCompressed: Uint8Array): Hex {
  const point = POINT.fromHex(bytesToHex(pubKeyCompressed).slice(2));
  const uncompressed = point.toRawBytes(false); // 65 bytes: 0x04 || X || Y
  const xy = uncompressed.slice(1); // 64 bytes
  const hash = keccak_256(xy);
  return bytesToHex(hash.slice(-20));
}

export function bytesToBigInt(b: Uint8Array): bigint {
  let result = 0n;
  for (const byte of b) {
    result = (result << 8n) | BigInt(byte);
  }
  return result;
}

export function bigIntTo32Bytes(n: bigint): Uint8Array {
  const result = new Uint8Array(32);
  for (let i = 31; i >= 0; i--) {
    result[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return result;
}

// ---------------------------------------------------------------------------
// LocalStorage persistence (the bare minimum — production wallets should NOT
// store stealth keys in localStorage. Use this for demo / power users only).
// ---------------------------------------------------------------------------

const STORAGE_KEY = "nox:stealth:keys";

export function saveKeys(keys: StealthKeys) {
  if (typeof window === "undefined") return;
  const payload = {
    s: bytesToHex(keys.spendingPrivKey),
    v: bytesToHex(keys.viewingPrivKey),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function loadKeys(): StealthKeys | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const { s, v } = JSON.parse(raw) as { s: Hex; v: Hex };
    return keysFromPrivates(hexToBytes(s), hexToBytes(v));
  } catch {
    return null;
  }
}

export function clearKeys() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
