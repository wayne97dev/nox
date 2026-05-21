/**
 * End-to-end test of the stealth crypto SDK (lib/stealth.ts) — the actual
 * privacy primitive. No chain, no wallet: pure sender→receiver round-trip.
 *
 *   npx tsx scripts/stealth-roundtrip.ts
 */
import { webcrypto } from "node:crypto";
// Node 18 doesn't expose Web Crypto as a global; @noble needs it. (Browser has it natively.)
if (!(globalThis as { crypto?: Crypto }).crypto) {
  (globalThis as { crypto?: Crypto }).crypto = webcrypto as unknown as Crypto;
}

import { getPublicKey } from "@noble/secp256k1";
import { encodePacked, type Hex } from "viem";
import {
  generateStealthKeys,
  metaAddressFromKeys,
  computeStealthAddress,
  scanAnnouncements,
  pubKeyToAddress,
  type AnnouncementLog,
} from "../lib/stealth";

let pass = 0;
let fail = 0;
const check = (label: string, ok: boolean) => {
  console.log(`${ok ? "✅" : "❌"} ${label}`);
  ok ? pass++ : fail++;
};

// 1. RECEIVER generates stealth keys + publishes a meta-address
const recv = generateStealthKeys();
const meta = metaAddressFromKeys(recv);
check("meta-address is 66 bytes", meta.length === 2 + 66 * 2);

// 2. SENDER derives a one-time stealth address from the meta-address
const out = computeStealthAddress(meta);
check("sender derived a stealth address", /^0x[0-9a-fA-F]{40}$/.test(out.stealthAddress));
check("ephemeral pubkey is 33 bytes", out.ephemeralPubKey.length === 2 + 33 * 2);
check("view tag is a byte (0-255)", out.viewTag >= 0 && out.viewTag <= 255);

// 3. Build the on-chain Announcement metadata (Umbra layout: tag|token|amount)
const TOKEN = "0xfD8c8AdCf5C9Dc599B6D366D827a413881F57f8b" as Hex; // the live "test" token
const AMOUNT = 300_000n * 10n ** 18n; // 300k tokens (1 lot)
const metadata = encodePacked(["uint8", "address", "uint256"], [out.viewTag, TOKEN, AMOUNT]);
const ann: AnnouncementLog = {
  stealthAddress: out.stealthAddress,
  ephemeralPubKey: out.ephemeralPubKey,
  metadata,
};

// 4. RECEIVER scans announcements and discovers the payment
const found = scanAnnouncements(recv, [ann]);
check("receiver found exactly 1 payment", found.length === 1);
if (found[0]) {
  check("recovered amount matches", found[0].amount === AMOUNT);
  check("recovered token matches", found[0].token.toLowerCase() === TOKEN.toLowerCase());

  // 5. The recovered stealth PRIVATE KEY must control the stealth address
  const recoveredPub = getPublicKey(found[0].stealthPrivKey, true);
  const recoveredAddr = pubKeyToAddress(recoveredPub);
  check(
    "derived private key controls the stealth address (spendable)",
    recoveredAddr.toLowerCase() === out.stealthAddress.toLowerCase(),
  );
}

// 6. NEGATIVE: a different receiver must NOT be able to discover this payment
const stranger = generateStealthKeys();
const strangerFound = scanAnnouncements(stranger, [ann]);
check("a different receiver discovers nothing (unlinkable)", strangerFound.length === 0);

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
