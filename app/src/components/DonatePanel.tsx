import { useState } from "react";
import { parseEther } from "viem";
import { useAccount, useChainId, useSwitchChain, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ESCROW_ABI, EXPLORER_TX, CHAIN_NAME, escrowFor, campaignChainIds } from "../contracts";

// Donate to a campaign's on-chain escrow. The wallet is connected from the nav,
// and the chain is whatever the connected wallet is on: there is no chain picker.
// If the wallet is on a network the campaign is not deployed on, we offer a switch.
export function DonatePanel({ campaignId }: { campaignId: string }) {
  const [anon, setAnon] = useState(false);
  const [amount, setAmount] = useState("0.001");

  const { isConnected } = useAccount();
  const activeChainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const chains = campaignChainIds(campaignId);
  const escrow = escrowFor(campaignId, activeChainId);
  const target = chains[0]; // preferred network to switch to
  const acceptsList = chains.map((c) => CHAIN_NAME[c] ?? `chain ${c}`).join(", ");

  function donate() {
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

  return (
    <div className="panel donate">
      <h2 style={{ fontSize: 17, margin: "0 0 4px" }}>Donate</h2>

      {chains.length === 0 ? (
        <div className="note" style={{ marginTop: 10 }}>
          <i className="ti ti-info-circle" aria-hidden="true" /> This campaign is not yet deployed on-chain.
        </div>
      ) : !isConnected ? (
        <div className="note" style={{ marginTop: 10 }}>
          <i className="ti ti-wallet" aria-hidden="true" /> Connect your wallet (top right) to donate. This campaign accepts {acceptsList}.
        </div>
      ) : !escrow ? (
        <>
          <div className="note" style={{ marginTop: 10 }}>
            <i className="ti ti-switch-horizontal" aria-hidden="true" /> Your wallet is on {CHAIN_NAME[activeChainId] ?? "an unsupported network"}. This campaign accepts {acceptsList}.
          </div>
          <button className="btn btn-primary btn-block" onClick={() => switchChain({ chainId: target })}>
            <i className="ti ti-switch-horizontal" aria-hidden="true" /> Switch to {CHAIN_NAME[target] ?? "the right network"}
          </button>
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

          <div className="toggle">
            <span><i className="ti ti-eye-off" style={{ verticalAlign: -2 }} aria-hidden="true" /> Give anonymously</span>
            <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} />
          </div>

          <button className="btn btn-primary btn-block" onClick={donate} disabled={isPending || confirming}>
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
      )}

      <div className="note">
        <i className="ti ti-lock" aria-hidden="true" /> Recorded on-chain · escrow released against proof
      </div>
    </div>
  );
}
