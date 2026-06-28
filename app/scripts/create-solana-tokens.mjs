// One-off: create test USDC + USDT SPL mints on devnet and register them on the
// aid_escrow program allowlist. Run from app/: node scripts/create-solana-tokens.mjs
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { createMint } from "@solana/spl-token";
import { readFileSync } from "node:fs";

const PROGRAM_ID = new PublicKey("AVayPFmfGivPALcE93L8gfULQwQ6GPoVGGpEu9VSRSVT");
const RPC = "https://api.devnet.solana.com";
const DISC_REGISTER = Buffer.from([32, 146, 36, 240, 80, 183, 36, 84]);

const secret = JSON.parse(readFileSync("../chain/solana/.devnet-deployer.json", "utf8"));
const authority = Keypair.fromSecretKey(Uint8Array.from(secret));
const conn = new Connection(RPC, "confirmed");

async function registerToken(mint) {
  const [allowedMint] = PublicKey.findProgramAddressSync(
    [Buffer.from("mint"), mint.toBytes()],
    PROGRAM_ID
  );
  const data = Buffer.concat([DISC_REGISTER, Buffer.from([1])]); // is_stable = true
  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: allowedMint, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
  const sig = await sendAndConfirmTransaction(conn, new Transaction().add(ix), [authority], {
    commitment: "confirmed",
  });
  return sig;
}

for (const sym of ["USDC", "USDT"]) {
  const mint = await createMint(conn, authority, authority.publicKey, null, 6);
  const sig = await registerToken(mint);
  console.log(`${sym}_MINT=${mint.toBase58()}  registered (${sig.slice(0, 8)}…)`);
}
console.log("done");
