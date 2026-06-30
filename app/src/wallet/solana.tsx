import { Buffer } from "buffer";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SOLANA_CAMPAIGNS, SOLANA_PROGRAM_ID, SOLANA_RPC } from "../contracts";

// Solana wallet connection is handled by @solana/wallet-adapter-react (useWallet),
// which auto-detects installed Solana wallets (Phantom, Solflare, Backpack, ...) via
// the Wallet Standard. These helpers build the program instructions and send them
// through the connected wallet's sendTransaction.

export type SendTx = (tx: Transaction, connection: Connection) => Promise<string>;

const DONATE_DISC = Buffer.from([121, 186, 218, 211, 73, 70, 196, 180]);
const DONATE_TOKEN_DISC = Buffer.from([25, 216, 125, 238, 108, 3, 44, 126]);

async function sendIx(publicKey: PublicKey, sendTransaction: SendTx, ix: TransactionInstruction): Promise<string> {
  const conn = new Connection(SOLANA_RPC, "confirmed");
  const tx = new Transaction().add(ix);
  tx.feePayer = publicKey;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  const sig = await sendTransaction(tx, conn);
  await conn.confirmTransaction(sig, "confirmed");
  return sig;
}

// Native SOL donation.
export async function donateSolana(
  publicKey: PublicKey,
  sendTransaction: SendTx,
  campaignId: string,
  lamports: number,
  anonymous: boolean
): Promise<string> {
  const sc = SOLANA_CAMPAIGNS[campaignId];
  if (!sc) throw new Error("Campaign is not deployed on Solana");
  const programId = new PublicKey(SOLANA_PROGRAM_ID);
  const campaign = new PublicKey(sc.campaignPda);
  const enc = new TextEncoder();
  const [donorProfile] = PublicKey.findProgramAddressSync([enc.encode("donor"), publicKey.toBytes()], programId);
  const [contribSol] = PublicKey.findProgramAddressSync(
    [enc.encode("csol"), campaign.toBytes(), publicKey.toBytes()],
    programId
  );
  const amt = Buffer.alloc(8);
  amt.writeBigUInt64LE(BigInt(lamports));
  const data = Buffer.concat([DONATE_DISC, amt, Buffer.from([anonymous ? 1 : 0])]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: campaign, isSigner: false, isWritable: true },
      { pubkey: donorProfile, isSigner: false, isWritable: true },
      { pubkey: contribSol, isSigner: false, isWritable: true },
      { pubkey: publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
  return sendIx(publicKey, sendTransaction, ix);
}

// SPL token (USDC/USDT) donation.
export async function donateSolanaToken(
  publicKey: PublicKey,
  sendTransaction: SendTx,
  campaignId: string,
  mintStr: string,
  amountBaseUnits: number,
  anonymous: boolean
): Promise<string> {
  const sc = SOLANA_CAMPAIGNS[campaignId];
  if (!sc) throw new Error("Campaign is not deployed on Solana");
  const programId = new PublicKey(SOLANA_PROGRAM_ID);
  const campaign = new PublicKey(sc.campaignPda);
  const mint = new PublicKey(mintStr);
  const enc = new TextEncoder();
  const seed = (s: string) => enc.encode(s);
  const [allowedMint] = PublicKey.findProgramAddressSync([seed("mint"), mint.toBytes()], programId);
  const [campaignAsset] = PublicKey.findProgramAddressSync([seed("casset"), campaign.toBytes(), mint.toBytes()], programId);
  const [donorStat] = PublicKey.findProgramAddressSync([seed("donor_token"), publicKey.toBytes(), mint.toBytes()], programId);
  const [contribTok] = PublicKey.findProgramAddressSync(
    [seed("ctok"), campaign.toBytes(), publicKey.toBytes(), mint.toBytes()],
    programId
  );
  const donorAta = getAssociatedTokenAddressSync(mint, publicKey);
  const escrowAta = getAssociatedTokenAddressSync(mint, campaign, true);
  const amt = Buffer.alloc(8);
  amt.writeBigUInt64LE(BigInt(amountBaseUnits));
  const data = Buffer.concat([DONATE_TOKEN_DISC, amt, Buffer.from([anonymous ? 1 : 0])]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: campaign, isSigner: false, isWritable: true },
      { pubkey: allowedMint, isSigner: false, isWritable: false },
      { pubkey: campaignAsset, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: donorAta, isSigner: false, isWritable: true },
      { pubkey: escrowAta, isSigner: false, isWritable: true },
      { pubkey: donorStat, isSigner: false, isWritable: true },
      { pubkey: contribTok, isSigner: false, isWritable: true },
      { pubkey: publicKey, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
  return sendIx(publicKey, sendTransaction, ix);
}
