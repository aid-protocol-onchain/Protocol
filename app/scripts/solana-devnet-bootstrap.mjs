// Devnet bootstrap for the hardened aid_escrow program: create the admin Config,
// register the test stablecoin mints, and create the demo campaign with a distinct
// approver (AD-3 separation of duties). Idempotent: already-done steps are skipped.
// Run from the app dir so @solana/web3.js resolves: `node scripts/solana-devnet-bootstrap.mjs`
import {
  Connection, Keypair, PublicKey, Transaction, TransactionInstruction,
  SystemProgram, sendAndConfirmTransaction,
} from "@solana/web3.js";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const RPC = "https://api.devnet.solana.com";
const PROGRAM = new PublicKey("AVayPFmfGivPALcE93L8gfULQwQ6GPoVGGpEu9VSRSVT");
const USDC = new PublicKey("4Hpm8L2sUFUWPUbqZjYC6mbVRSV7W32WBMUeY9ndA1Fr");
const USDT = new PublicKey("FH573FJpQi2UdE9Z1hXjWp3D4NJr3euq9LE9NV4GBgTp");
const CAMPAIGN_ID = 2n; // fresh id: the old id 1 PDA uses the pre-upgrade layout
const TIER = 1;

const disc = (name) => createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
const loadKp = (p) => Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(p, "utf8"))));
const le64 = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };

const conn = new Connection(RPC, "confirmed");
const authority = loadKp("../chain/solana/.devnet-deployer.json");

const approverPath = "../chain/solana/.devnet-approver-keypair.json";
let approver;
if (existsSync(approverPath)) approver = loadKp(approverPath);
else { approver = Keypair.generate(); writeFileSync(approverPath, JSON.stringify([...approver.secretKey])); }

const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM);
const [campaignPda] = PublicKey.findProgramAddressSync([Buffer.from("campaign"), le64(CAMPAIGN_ID)], PROGRAM);
const mintPda = (m) => PublicKey.findProgramAddressSync([Buffer.from("mint"), m.toBuffer()], PROGRAM)[0];

console.log("authority/admin:", authority.publicKey.toBase58());
console.log("approver:       ", approver.publicKey.toBase58());
console.log("config PDA:     ", configPda.toBase58());
console.log("campaign PDA:   ", campaignPda.toBase58(), `(id ${CAMPAIGN_ID})`);

async function send(ix, label) {
  try {
    const tx = new Transaction().add(ix);
    tx.feePayer = authority.publicKey;
    tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
    const sig = await sendAndConfirmTransaction(conn, tx, [authority], { commitment: "confirmed" });
    console.log(`  ${label}: OK  ${sig}`);
  } catch (e) {
    console.log(`  ${label}: skip/err  ${String(e.message || e).split("\n")[0].slice(0, 160)}`);
    const logs = e.logs || (e.getLogs && (await e.getLogs(conn).catch(() => null)));
    if (logs) console.log("    logs:", logs.slice(-6).join(" | "));
  }
}

// 1) initialize_config(admin = authority)
await send(new TransactionInstruction({
  programId: PROGRAM,
  keys: [
    { pubkey: configPda, isSigner: false, isWritable: true },
    { pubkey: authority.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  data: Buffer.concat([disc("initialize_config"), authority.publicKey.toBuffer()]),
}), "initialize_config");

// 2) register_token(is_stable = true) for USDC and USDT
for (const [name, mint] of [["USDC", USDC], ["USDT", USDT]]) {
  await send(new TransactionInstruction({
    programId: PROGRAM,
    keys: [
      { pubkey: configPda, isSigner: false, isWritable: false },
      { pubkey: mintPda(mint), isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([disc("register_token"), Buffer.from([1])]),
  }), `register_token ${name}`);
}

// 3) initialize_campaign(id, tier, approver) with approver != authority
await send(new TransactionInstruction({
  programId: PROGRAM,
  keys: [
    { pubkey: campaignPda, isSigner: false, isWritable: true },
    { pubkey: authority.publicKey, isSigner: false, isWritable: false }, // requester (reference only)
    { pubkey: authority.publicKey, isSigner: true, isWritable: true },   // authority + payer
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  data: Buffer.concat([disc("initialize_campaign"), le64(CAMPAIGN_ID), Buffer.from([TIER]), approver.publicKey.toBuffer()]),
}), "initialize_campaign");

console.log("\nDONE. campaignPda =", campaignPda.toBase58(), "| approver =", approver.publicKey.toBase58());
