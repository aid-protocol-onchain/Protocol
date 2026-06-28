import { useState } from "react";
import { parseEther } from "viem";
import { useAccount, useChainId, useSwitchChain, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ESCROW_ABI, EXPLORER_TX, CHAIN_NAME, escrowFor, campaignChainIds, solanaCampaign, SOLANA_EXPLORER_TX } from "../contracts";
import { useSolana, donateSolana } from "../wallet/solana";

// Donate to a campaign's on-chain escrow on whichever chain the connected wallet is on.
// Wallets are connected from the nav; there is no chain picker. EVM and Solana are
// separate wallet ecosystems, so the panel follows whichever one is connected.
export function DonatePanel({ campaignId }: { campaignId: string }) {
  const [anon, setAnon] = useState(false);

  // EVM
  const { isConnected: evmConnected } = useAccount();
  const activeChainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const [amount, setAmount] = useState("0.001");

  // Solana
  const sol = useSolana();
  const [solAmount, setSolAmount] = useState("0.05");
  const [solState, setSolState] = useState<"idle" | "pending" | "done" | "err">("idle");
  const [solSig, setSolSig] = useState("");
  const [solErr, setSolErr] = useState("");

  const evmChains = campaignChainIds(campaignId);
  const solCampaign = solanaCampaign(campaignId);
  const escrow = escrowFor(campaignId, activeChainId);
  const target = evmChains[0];
  const accepts = [...evmChains.map((c) => CHAIN_NAME[c] ?? `chain ${c}`), ...(solCampaign ? ["Solana devnet"] : [])].join(", ");

  function donateEvm() {
    if (!escrow) return;
    writeContract({
      address: escrow,
      abi: ESCROW_ABI,
      functionName: "donateNative",
      args: [anon],
      value: parseEther(amount || "0"),
      chainId: activeChainId,
    });
  }

  async function donateSol() {
    if (!sol.address) return;
    setSolState("pending");
    setSolErr("");
    try {
      const lamports = Math.round(parseFloat(solAmount || "0") * 1e9);
      const sig = await donateSolana(sol.address, campaignId, lamports, anon);
      setSolSig(sig);
      setSolState("done");
    } catch (e) {
      setSolErr(e instanceof Error ? e.message : String(e));
      setSolState("err");
    }
  }

  const anonToggle = (
    <div className="toggle">
      <span><i className="ti ti-eye-off" style={{ verticalAlign: -2 }} aria-hidden="true" /> Give anonymously</span>
      <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} />
    </div>
  );

  return (
    <div className="panel donate">
      <h2 style={{ fontSize: 17, margin: "0 0 4px" }}>Donate</h2>

      {evmChains.length === 0 && !solCampaign ? (
        <div className="note" style={{ marginTop: 10 }}>
          <i className="ti ti-info-circle" aria-hidden="true" /> This campaign is not yet deployed on-chain.
        </div>
      ) : sol.connected ? (
        // Solana wallet connected
        !solCampaign ? (
          <div className="note" style={{ marginTop: 10 }}>
            <i className="ti ti-info-circle" aria-hidden="true" /> This campaign is not on Solana. Connect an EVM wallet to give on {accepts}.
          </div>
        ) : (
          <>
            <div className="faint" style={{ margin: "6px 0 2px" }}>
              <i className="ti ti-currency-solana" style={{ verticalAlign: -2 }} aria-hidden="true" /> Donating on Solana devnet
            </div>
            <div className="field-label">Amount (SOL)</div>
            <input className="inp" value={solAmount} onChange={(e) => setSolAmount(e.target.value)} inputMode="decimal" />
            <div className="seg" style={{ marginTop: 8 }}>
              {["0.05", "0.1", "0.5"].map((a) => (
                <div key={a} className={solAmount === a ? "on" : ""} onClick={() => setSolAmount(a)}>{a}</div>
              ))}
            </div>
            {anonToggle}
            <button className="btn btn-primary btn-block" onClick={donateSol} disabled={solState === "pending"}>
              <i className="ti ti-heart" aria-hidden="true" /> {solState === "pending" ? "Confirm in Phantom…" : `Donate ${solAmount} SOL`}
            </button>
            {solState === "done" && (
              <div className="note" style={{ color: "var(--trust)" }}>
                <i className="ti ti-circle-check" aria-hidden="true" /> Recorded.{" "}
                <a href={`${SOLANA_EXPLORER_TX}${solSig}?cluster=devnet`} target="_blank" rel="noreferrer">View transaction</a>
              </div>
            )}
            {solState === "err" && (
              <div className="note" style={{ color: "var(--danger)" }}>
                <i className="ti ti-alert-triangle" aria-hidden="true" /> {solErr.slice(0, 140)}
              </div>
            )}
          </>
        )
      ) : evmConnected ? (
        // EVM wallet connected
        !escrow ? (
          <>
            <div className="note" style={{ marginTop: 10 }}>
              <i className="ti ti-switch-horizontal" aria-hidden="true" /> Your wallet is on {CHAIN_NAME[activeChainId] ?? "an unsupported network"}. This campaign accepts {accepts}.
            </div>
            {evmChains.length > 0 && (
              <button className="btn btn-primary btn-block" onClick={() => switchChain({ chainId: target })}>
                <i className="ti ti-switch-horizontal" aria-hidden="true" /> Switch to {CHAIN_NAME[target] ?? "the right network"}
              </button>
            )}
          </>
        ) : (
          <>
            <div className="faint" style={{ margin: "6px 0 2px" }}>
              <i className="ti ti-link" style={{ verticalAlign: -2 }} aria-hidden="true" /> Donating on {CHAIN_NAME[activeChainId]}
            </div>
            <div className="field-label">Amount (ETH)</div>
            <input className="inp" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
            <div className="seg" style={{ marginTop: 8 }}>
              {["0.001", "0.005", "0.01"].map((a) => (
                <div key={a} className={amount === a ? "on" : ""} onClick={() => setAmount(a)}>{a}</div>
              ))}
            </div>
            {anonToggle}
            <button className="btn btn-primary btn-block" onClick={donateEvm} disabled={isPending || confirming}>
              <i className="ti ti-heart" aria-hidden="true" />{" "}
              {isPending ? "Confirm in wallet…" : confirming ? "Recording on-chain…" : `Donate ${amount} ETH`}
            </button>
            {isSuccess && txHash && (
              <div className="note" style={{ color: "var(--trust)" }}>
                <i className="ti ti-circle-check" aria-hidden="true" /> Recorded.{" "}
                <a href={`${EXPLORER_TX[activeChainId]}${txHash}`} target="_blank" rel="noreferrer">View transaction</a>
              </div>
            )}
            {error && (
              <div className="note" style={{ color: "var(--danger)" }}>
                <i className="ti ti-alert-triangle" aria-hidden="true" /> {error.message.split("\n")[0].slice(0, 120)}
              </div>
            )}
          </>
        )
      ) : (
        // nothing connected
        <div className="note" style={{ marginTop: 10 }}>
          <i className="ti ti-wallet" aria-hidden="true" /> Connect your wallet (top right) to donate. This campaign accepts {accepts}.
        </div>
      )}

      <div className="note">
        <i className="ti ti-lock" aria-hidden="true" /> Recorded on-chain · escrow released against proof
      </div>
    </div>
  );
}
