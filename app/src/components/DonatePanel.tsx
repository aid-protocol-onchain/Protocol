import { useState } from "react";
import { parseEther } from "viem";
import { useAccount, useConnect, useSwitchChain, useChainId, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { injected } from "wagmi/connectors";
import { ESCROW_ABI, EVM_CHAIN_ID, EXPLORER_TX, escrowFor } from "../contracts";

const CHAIN_LABEL: Record<string, string> = { base: "Base Sepolia", ethereum: "Sepolia", solana: "Solana devnet" };

export function DonatePanel({ campaignId }: { campaignId: string }) {
  const [chain, setChain] = useState<"base" | "ethereum" | "solana">("base");
  const [anon, setAnon] = useState(false);
  const [amount, setAmount] = useState("0.001");

  const { isConnected } = useAccount();
  const { connect } = useConnect();
  const { switchChain } = useSwitchChain();
  const activeChainId = useChainId();
  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const targetId = EVM_CHAIN_ID[chain];
  const escrow = chain === "solana" ? undefined : escrowFor(campaignId, targetId ?? 0);
  const wrongChain = isConnected && targetId !== undefined && activeChainId !== targetId;

  function donate() {
    if (!escrow) return;
    writeContract({
      address: escrow,
      abi: ESCROW_ABI,
      functionName: "donateNative",
      args: [anon],
      value: parseEther(amount || "0"),
      chainId: targetId,
    });
  }

  return (
    <div className="panel donate">
      <h2 style={{ fontSize: 17, margin: "0 0 4px" }}>Donate</h2>

      <div className="field-label">Chain</div>
      <div className="seg">
        {(["base", "ethereum", "solana"] as const).map((ch) => (
          <div key={ch} className={chain === ch ? "on" : ""} onClick={() => { setChain(ch); reset(); }}>
            {ch === "ethereum" ? "ETH" : ch[0].toUpperCase() + ch.slice(1)}
          </div>
        ))}
      </div>

      {chain === "solana" ? (
        <div className="note" style={{ marginTop: 12 }}>
          <i className="ti ti-clock" aria-hidden="true" /> Solana devnet program goes live once the deployer is funded. SOL and SPL donations land here then.
        </div>
      ) : !escrow ? (
        <div className="note" style={{ marginTop: 12 }}>
          <i className="ti ti-info-circle" aria-hidden="true" /> This campaign is not yet deployed on {CHAIN_LABEL[chain]}.
        </div>
      ) : (
        <>
          <div className="field-label">Amount ({chain === "ethereum" ? "SepoliaETH" : "ETH"})</div>
          <input className="inp" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
          <div className="seg" style={{ marginTop: 8 }}>
            {["0.001", "0.005", "0.01"].map((a) => (
              <div key={a} className={amount === a ? "on" : ""} onClick={() => setAmount(a)}>{a}</div>
            ))}
          </div>

          <div className="toggle">
            <span><i className="ti ti-eye-off" style={{ verticalAlign: -2 }} aria-hidden="true" /> Give anonymously</span>
            <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} />
          </div>

          {!isConnected ? (
            <button className="btn btn-primary btn-block" onClick={() => connect({ connector: injected() })}>
              <i className="ti ti-wallet" aria-hidden="true" /> Connect wallet
            </button>
          ) : wrongChain ? (
            <button className="btn btn-primary btn-block" onClick={() => switchChain({ chainId: targetId! })}>
              <i className="ti ti-switch-horizontal" aria-hidden="true" /> Switch to {CHAIN_LABEL[chain]}
            </button>
          ) : (
            <button className="btn btn-primary btn-block" onClick={donate} disabled={isPending || confirming}>
              <i className="ti ti-heart" aria-hidden="true" />{" "}
              {isPending ? "Confirm in wallet…" : confirming ? "Recording on-chain…" : `Donate ${amount} ETH`}
            </button>
          )}

          {isSuccess && txHash && (
            <div className="note" style={{ color: "var(--trust)" }}>
              <i className="ti ti-circle-check" aria-hidden="true" /> Recorded.{" "}
              <a href={`${EXPLORER_TX[targetId!]}${txHash}`} target="_blank" rel="noreferrer">View transaction</a>
            </div>
          )}
          {error && (
            <div className="note" style={{ color: "var(--danger)" }}>
              <i className="ti ti-alert-triangle" aria-hidden="true" /> {error.message.split("\n")[0].slice(0, 120)}
            </div>
          )}
        </>
      )}

      <div className="note">
        <i className="ti ti-lock" aria-hidden="true" /> Recorded on-chain · escrow released against proof
      </div>
    </div>
  );
}
