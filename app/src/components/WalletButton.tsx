import { useAccount, useConnect, useDisconnect } from "wagmi";

function short(addr: string) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

// EVM wallet connect. Uses the connector instantiated in the wagmi config
// (passing a fresh injected() factory to connect() is a no-op in wagmi v3).
export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <button className="btn btn-wallet" onClick={() => disconnect()} title={address} aria-label="Disconnect wallet">
        <i className="ti ti-wallet" aria-hidden="true" /> <span className="btn-label">{short(address)}</span>
      </button>
    );
  }

  const connector = connectors.find((c) => c.id === "injected") ?? connectors[0];
  const noWallet = error?.name === "ConnectorNotFoundError";

  return (
    <button
      className="btn btn-wallet"
      disabled={!connector || isPending}
      onClick={() => connector && connect({ connector })}
      title={noWallet ? "No browser wallet detected (install MetaMask)" : undefined}
      aria-label="Connect wallet"
    >
      <i className="ti ti-wallet" aria-hidden="true" />{" "}
      <span className="btn-label">{isPending ? "Connecting" : noWallet ? "No wallet found" : "Connect wallet"}</span>
    </button>
  );
}
