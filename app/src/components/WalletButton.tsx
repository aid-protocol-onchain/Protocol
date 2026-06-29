import { useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useSolana } from "../wallet/solana";

function short(addr: string) {
  return addr.slice(0, 4) + "…" + addr.slice(-4);
}

// Connect either an EVM wallet (MetaMask, injected) or a Solana wallet (Phantom).
// One connect entry point in the nav; the chain follows from whichever is connected.
export function WalletButton() {
  const { address: evm, isConnected: evmConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const sol = useSolana();
  const [open, setOpen] = useState(false);

  if (evmConnected && evm) {
    return (
      <button className="btn btn-wallet" onClick={() => disconnect()} title={evm}>
        <i className="ti ti-wallet" aria-hidden="true" /> <span className="btn-label">{short(evm)}</span>
      </button>
    );
  }
  if (sol.connected && sol.address) {
    return (
      <button className="btn btn-wallet" onClick={() => sol.disconnect()} title={sol.address}>
        <i className="ti ti-wallet" aria-hidden="true" /> <span className="btn-label">{short(sol.address)}</span>
      </button>
    );
  }

  const injected = connectors.find((c) => c.id === "injected") ?? connectors[0];
  const coinbase = connectors.find((c) => c.id === "coinbaseWalletSDK" || c.name.toLowerCase().includes("coinbase"));

  return (
    <div className="wallet-menu">
      <button className="btn btn-wallet" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Connect wallet">
        <i className="ti ti-wallet" aria-hidden="true" />{" "}
        <span className="btn-label">{isPending ? "Connecting" : "Connect wallet"}</span>
      </button>
      {open && (
        <>
          <div className="wallet-backdrop" onClick={() => setOpen(false)} />
          <div className="wallet-pop">
            {coinbase && (
              <button
                onClick={() => {
                  connect({ connector: coinbase });
                  setOpen(false);
                }}
              >
                <i className="ti ti-mail" aria-hidden="true" /> Email / passkey (no wallet)
              </button>
            )}
            <button
              onClick={() => {
                if (injected) connect({ connector: injected });
                setOpen(false);
              }}
            >
              <i className="ti ti-currency-ethereum" aria-hidden="true" /> MetaMask (EVM)
            </button>
            <button
              onClick={() => {
                sol.connect();
                setOpen(false);
              }}
            >
              <i className="ti ti-currency-solana" aria-hidden="true" /> Phantom (Solana)
            </button>
          </div>
        </>
      )}
    </div>
  );
}
