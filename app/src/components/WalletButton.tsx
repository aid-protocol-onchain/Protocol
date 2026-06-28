import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";

function short(addr: string) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

// EVM wallet connect (Story 5.1). Solana connect is added in a follow-up.
export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <button className="btn btn-wallet" onClick={() => disconnect()} title={address} aria-label="Disconnect wallet">
        <i className="ti ti-wallet" aria-hidden="true" /> <span className="btn-label">{short(address)}</span>
      </button>
    );
  }

  return (
    <button
      className="btn btn-wallet"
      onClick={() => connect({ connector: injected() })}
      aria-label="Connect wallet"
    >
      <i className="ti ti-wallet" aria-hidden="true" />{" "}
      <span className="btn-label">{isPending ? "Connecting" : "Connect wallet"}</span>
    </button>
  );
}
