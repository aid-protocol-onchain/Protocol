import { Buffer } from "buffer";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SOLANA_CAMPAIGNS, SOLANA_PROGRAM_ID, SOLANA_RPC } from "../contracts";

// Phantom injects window.solana (or window.phantom.solana).
interface PhantomProvider {
  isPhantom?: boolean;
  publicKey?: { toString(): string } | null;
  connect(): Promise<{ publicKey: { toString(): string } }>;
  disconnect(): Promise<void>;
  signAndSendTransaction(tx: Transaction): Promise<{ signature: string }>;
  on(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

function getProvider(): PhantomProvider | undefined {
  const w = window as unknown as { solana?: PhantomProvider; phantom?: { solana?: PhantomProvider } };
  if (w.solana?.isPhantom) return w.solana;
  return w.phantom?.solana;
}

interface SolanaCtx {
  address: string | null;
  connected: boolean;
  available: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const Ctx = createContext<SolanaCtx>({
  address: null,
  connected: false,
  available: false,
  connect: async () => {},
  disconnect: async () => {},
});

export function SolanaProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const p = getProvider();
    setAvailable(!!p);
    if (!p) return;
    const onConnect = () => p.publicKey && setAddress(p.publicKey.toString());
    const onDisconnect = () => setAddress(null);
    const onAccountChanged = (...args: unknown[]) => {
      const pk = args[0] as { toString(): string } | null;
      setAddress(pk ? pk.toString() : null);
    };
    p.on("connect", onConnect);
    p.on("disconnect", onDisconnect);
    p.on("accountChanged", onAccountChanged);
    if (p.publicKey) setAddress(p.publicKey.toString());
    return () => {
      p.removeListener?.("connect", onConnect);
      p.removeListener?.("disconnect", onDisconnect);
      p.removeListener?.("accountChanged", onAccountChanged);
    };
  }, []);

  const connect = useCallback(async () => {
    const p = getProvider();
    if (!p) {
      window.open("https://phantom.app/", "_blank");
      return;
    }
    const res = await p.connect();
    setAddress(res.publicKey.toString());
  }, []);

  const disconnect = useCallback(async () => {
    await getProvider()?.disconnect();
    setAddress(null);
  }, []);

  return (
    <Ctx.Provider value={{ address, connected: !!address, available, connect, disconnect }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSolana() {
  return useContext(Ctx);
}

const DONATE_DISC = Buffer.from([121, 186, 218, 211, 73, 70, 196, 180]);

// Build, sign (via Phantom), and send a native SOL donation to a campaign escrow.
export async function donateSolana(
  donorAddress: string,
  campaignId: string,
  lamports: number,
  anonymous: boolean
): Promise<string> {
  const provider = getProvider();
  if (!provider) throw new Error("Phantom wallet not found");
  const sc = SOLANA_CAMPAIGNS[campaignId];
  if (!sc) throw new Error("Campaign is not deployed on Solana");

  const programId = new PublicKey(SOLANA_PROGRAM_ID);
  const donor = new PublicKey(donorAddress);
  const campaign = new PublicKey(sc.campaignPda);
  const enc = new TextEncoder();
  const [donorProfile] = PublicKey.findProgramAddressSync([enc.encode("donor"), donor.toBytes()], programId);
  const [contribSol] = PublicKey.findProgramAddressSync(
    [enc.encode("csol"), campaign.toBytes(), donor.toBytes()],
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
      { pubkey: donor, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  const conn = new Connection(SOLANA_RPC, "confirmed");
  const tx = new Transaction().add(ix);
  tx.feePayer = donor;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  const { signature } = await provider.signAndSendTransaction(tx);
  await conn.confirmTransaction(signature, "confirmed");
  return signature;
}

const DONATE_TOKEN_DISC = Buffer.from([25, 216, 125, 238, 108, 3, 44, 126]);

// Donate an SPL token (USDC/USDT) to a campaign escrow via the program donate_token.
export async function donateSolanaToken(
  donorAddress: string,
  campaignId: string,
  mintStr: string,
  amountBaseUnits: number,
  anonymous: boolean
): Promise<string> {
  const provider = getProvider();
  if (!provider) throw new Error("Phantom wallet not found");
  const sc = SOLANA_CAMPAIGNS[campaignId];
  if (!sc) throw new Error("Campaign is not deployed on Solana");

  const programId = new PublicKey(SOLANA_PROGRAM_ID);
  const donor = new PublicKey(donorAddress);
  const campaign = new PublicKey(sc.campaignPda);
  const mint = new PublicKey(mintStr);
  const enc = new TextEncoder();
  const seed = (s: string) => enc.encode(s);

  const [allowedMint] = PublicKey.findProgramAddressSync([seed("mint"), mint.toBytes()], programId);
  const [campaignAsset] = PublicKey.findProgramAddressSync(
    [seed("casset"), campaign.toBytes(), mint.toBytes()],
    programId
  );
  const [donorStat] = PublicKey.findProgramAddressSync(
    [seed("donor_token"), donor.toBytes(), mint.toBytes()],
    programId
  );
  const [contribTok] = PublicKey.findProgramAddressSync(
    [seed("ctok"), campaign.toBytes(), donor.toBytes(), mint.toBytes()],
    programId
  );
  const donorAta = getAssociatedTokenAddressSync(mint, donor);
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
      { pubkey: donor, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  const conn = new Connection(SOLANA_RPC, "confirmed");
  const tx = new Transaction().add(ix);
  tx.feePayer = donor;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  const { signature } = await provider.signAndSendTransaction(tx);
  await conn.confirmTransaction(signature, "confirmed");
  return signature;
}
