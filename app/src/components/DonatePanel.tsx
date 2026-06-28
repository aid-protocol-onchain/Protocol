import { useState } from "react";
import { parseEther, parseUnits } from "viem";
import { useAccount, useChainId, useSwitchChain, useWriteContract, usePublicClient } from "wagmi";
import {
  ESCROW_ABI,
  ERC20_ABI,
  EXPLORER_TX,
  CHAIN_NAME,
  TOKENS,
  TOKEN_DECIMALS,
  SOLANA_TOKENS,
  SOLANA_EXPLORER_TX,
  escrowFor,
  campaignChainIds,
  solanaCampaign,
} from "../contracts";
import { useSolana, donateSolana, donateSolanaToken } from "../wallet/solana";

type Asset = "native" | "USDC" | "USDT";
const ASSETS: Asset[] = ["native", "USDC", "USDT"];

// Donate to a campaign escrow in native coin or a whitelisted stablecoin, on whichever
// chain the connected wallet is on. Wallet + chain come from the nav; this only picks the asset.
export function DonatePanel({ campaignId }: { campaignId: string }) {
  const [anon, setAnon] = useState(false);
  const [asset, setAsset] = useState<Asset>("native");
  const [amount, setAmount] = useState("0.001");

  // EVM
  const { isConnected: evmConnected } = useAccount();
  const activeChainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: activeChainId });

  // Solana
  const sol = useSolana();

  // shared tx state
  const [state, setState] = useState<"idle" | "approving" | "pending" | "done" | "err">("idle");
  const [txUrl, setTxUrl] = useState("");
  const [errMsg, setErrMsg] = useState("");

  const evmChains = campaignChainIds(campaignId);
  const solCampaign = solanaCampaign(campaignId);
  const escrow = escrowFor(campaignId, activeChainId);
  const target = evmChains[0];
  const accepts = [...evmChains.map((c) => CHAIN_NAME[c] ?? `chain ${c}`), ...(solCampaign ? ["Solana devnet"] : [])].join(", ");

  const onSolana = sol.connected;
  const nativeLabel = onSolana ? "SOL" : "ETH";
  const defaults: Record<Asset, string[]> = {
    native: onSolana ? ["0.05", "0.1", "0.5"] : ["0.001", "0.005", "0.01"],
    USDC: ["5", "10", "25"],
    USDT: ["5", "10", "25"],
  };

  function pickAsset(a: Asset) {
    setAsset(a);
    setState("idle");
    setAmount(defaults[a][0]);
  }

  async function donate() {
    setErrMsg("");
    try {
      if (onSolana) {
        if (!sol.address) return;
        setState("pending");
        let sig: string;
        if (asset === "native") {
          sig = await donateSolana(sol.address, campaignId, Math.round(parseFloat(amount || "0") * 1e9), anon);
        } else {
          const mint = SOLANA_TOKENS[asset];
          sig = await donateSolanaToken(sol.address, campaignId, mint, Math.round(parseFloat(amount || "0") * 1e6), anon);
        }
        setTxUrl(`${SOLANA_EXPLORER_TX}${sig}?cluster=devnet`);
      } else {
        if (!escrow || !publicClient) return;
        if (asset === "native") {
          setState("pending");
          const h = await writeContractAsync({
            chainId: activeChainId,
            address: escrow,
            abi: ESCROW_ABI,
            functionName: "donateNative",
            args: [anon],
            value: parseEther(amount || "0"),
          });
          await publicClient.waitForTransactionReceipt({ hash: h });
          setTxUrl(`${EXPLORER_TX[activeChainId]}${h}`);
        } else {
          const token = TOKENS[activeChainId]?.[asset];
          if (!token) throw new Error("Token not available on this network");
          const amt = parseUnits(amount || "0", TOKEN_DECIMALS);
          setState("approving");
          const ah = await writeContractAsync({
            chainId: activeChainId,
            address: token,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [escrow, amt],
          });
          await publicClient.waitForTransactionReceipt({ hash: ah });
          setState("pending");
          const h = await writeContractAsync({
            chainId: activeChainId,
            address: escrow,
            abi: ESCROW_ABI,
            functionName: "donateToken",
            args: [token, amt, anon],
          });
          await publicClient.waitForTransactionReceipt({ hash: h });
          setTxUrl(`${EXPLORER_TX[activeChainId]}${h}`);
        }
      }
      setState("done");
    } catch (e) {
      const m = e as { shortMessage?: string; message?: string };
      setErrMsg((m.shortMessage || m.message || String(e)).slice(0, 140));
      setState("err");
    }
  }

  const busy = state === "approving" || state === "pending";
  const unit = asset === "native" ? nativeLabel : asset;

  // ---- render gating ----
  const ready = onSolana ? !!solCampaign : evmConnected && !!escrow;
  const showConnectPrompt = !onSolana && !evmConnected;
  const wrongChain = !onSolana && evmConnected && !escrow;

  const controls = (
    <>
      <div className="field-label">Currency</div>
      <div className="seg">
        {ASSETS.map((a) => (
          <div key={a} className={asset === a ? "on" : ""} onClick={() => pickAsset(a)}>
            {a === "native" ? nativeLabel : a}
          </div>
        ))}
      </div>
      <div className="field-label">Amount ({unit})</div>
      <input className="inp" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
      <div className="seg" style={{ marginTop: 8 }}>
        {defaults[asset].map((a) => (
          <div key={a} className={amount === a ? "on" : ""} onClick={() => setAmount(a)}>{a}</div>
        ))}
      </div>
      <div className="toggle">
        <span><i className="ti ti-eye-off" style={{ verticalAlign: -2 }} aria-hidden="true" /> Give anonymously</span>
        <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} />
      </div>
      <button className="btn btn-primary btn-block" onClick={donate} disabled={busy}>
        <i className="ti ti-heart" aria-hidden="true" />{" "}
        {state === "approving" ? "Approve in wallet…" : busy ? "Confirm in wallet…" : `Donate ${amount} ${unit}`}
      </button>
      {state === "done" && (
        <div className="note" style={{ color: "var(--trust)" }}>
          <i className="ti ti-circle-check" aria-hidden="true" /> Recorded.{" "}
          <a href={txUrl} target="_blank" rel="noreferrer">View transaction</a>
        </div>
      )}
      {state === "err" && (
        <div className="note" style={{ color: "var(--danger)" }}>
          <i className="ti ti-alert-triangle" aria-hidden="true" /> {errMsg}
        </div>
      )}
    </>
  );

  return (
    <div className="panel donate">
      <h2 style={{ fontSize: 17, margin: "0 0 4px" }}>Donate</h2>

      {evmChains.length === 0 && !solCampaign ? (
        <div className="note" style={{ marginTop: 10 }}>
          <i className="ti ti-info-circle" aria-hidden="true" /> This campaign is not yet deployed on-chain.
        </div>
      ) : showConnectPrompt ? (
        <div className="note" style={{ marginTop: 10 }}>
          <i className="ti ti-wallet" aria-hidden="true" /> Connect your wallet (top right) to donate. This campaign accepts {accepts}.
        </div>
      ) : onSolana && !solCampaign ? (
        <div className="note" style={{ marginTop: 10 }}>
          <i className="ti ti-info-circle" aria-hidden="true" /> This campaign is not on Solana. Connect an EVM wallet to give on {accepts}.
        </div>
      ) : wrongChain ? (
        <>
          <div className="note" style={{ marginTop: 10 }}>
            <i className="ti ti-switch-horizontal" aria-hidden="true" /> Your wallet is on {CHAIN_NAME[activeChainId] ?? "an unsupported network"}. This campaign accepts {accepts}.
          </div>
          {evmChains.length > 0 && (
            <button className="btn btn-primary btn-block" onClick={() => switchChain({ chainId: target })}>
              <i className="ti ti-switch-horizontal" aria-hidden="true" /> Switch to {CHAIN_NAME[target]}
            </button>
          )}
        </>
      ) : ready ? (
        <>
          <div className="faint" style={{ margin: "6px 0 2px" }}>
            <i className="ti ti-link" style={{ verticalAlign: -2 }} aria-hidden="true" /> Donating on {onSolana ? "Solana devnet" : CHAIN_NAME[activeChainId]}
          </div>
          {controls}
        </>
      ) : null}

      <div className="note">
        <i className="ti ti-lock" aria-hidden="true" /> Recorded on-chain · escrow released against proof
      </div>
    </div>
  );
}
