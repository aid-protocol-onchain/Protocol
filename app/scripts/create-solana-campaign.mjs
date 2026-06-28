// One-off: create the ve-quake-2026 campaign on the Solana devnet program.
// Run from app/: node scripts/create-solana-campaign.mjs
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { readFileSync } from "node:fs";

const PROGRAM_ID = new PublicKey("AVayPFmfGivPALcE93L8gfULQwQ6GPoVGGpEu9VSRSVT");
const RPC = "https://api.devnet.solana.com";
const ID = 1n; // u64 campaign id for ve-quake-2026
const TIER = 2;
const DISC_INIT = Buffer.from([169, 88, 7, 6, 9, 165, 65, 132]);

const secret = JSON.parse(readFileSync("../chain/solana/.devnet-deployer.json", "utf8"));
const authority = Keypair.fromSecretKey(Uint8Array.from(secret));

const idLe = Buffer.alloc(8);
idLe.writeBigUInt64LE(ID);
const [campaign] = PublicKey.findProgramAddressSync([Buffer.from("campaign"), idLe], PROGRAM_ID);

console.log("authority:", authority.publicKey.toBase58());
console.log("campaign PDA:", campaign.toBase58());

const conn = new Connection(RPC, "confirmed");

// already created?
const existing = await conn.getAccountInfo(campaign);
if (existing) {
  console.log("campaign already exists, skipping create");
  process.exit(0);
}

const tier = Buffer.from([TIER]);
const data = Buffer.concat([DISC_INIT, idLe, tier]);

const ix = new TransactionInstruction({
  programId: PROGRAM_ID,
  keys: [
    { pubkey: campaign, isSigner: false, isWritable: true },
    { pubkey: authority.publicKey, isSigner: false, isWritable: false }, // requester (public identity)
    { pubkey: authority.publicKey, isSigner: true, isWritable: true }, // authority + payer
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  data,
});

const sig = await sendAndConfirmTransaction(conn, new Transaction().add(ix), [authority], {
  commitment: "confirmed",
});
console.log("created. signature:", sig);
console.log("CAMPAIGN_PDA=" + campaign.toBase58());
