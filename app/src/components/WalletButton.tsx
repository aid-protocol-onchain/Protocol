import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, type Connector } from "wagmi";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState, type WalletName } from "@solana/wallet-adapter-base";

function short(addr: string) {
  return addr.slice(0, 4) + "…" + addr.slice(-4);
}

const COINBASE_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%230052FF'/%3E%3Ccircle cx='16' cy='16' r='9' fill='white'/%3E%3Crect x='12.5' y='12.5' width='7' height='7' rx='1.4' fill='%230052FF'/%3E%3C/svg%3E";

// Standard "Connect a wallet" modal, grouped by ecosystem. EVM wallets (wagmi, EIP-6963
// auto-discovery + Coinbase Smart Wallet) connect to Base/Ethereum. Solana wallets
// (wallet-adapter, auto-detected via the Wallet Standard) connect to Solana.
export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, error } = useConnect();
  const { disconnect } = useDisconnect();
  const sol = useWallet();
  const [open, setOpen] = useState(false);
  const [pendingSol, setPendingSol] = useState(false);

  // Once a Solana wallet is selected, connect to it.
  useEffect(() => {
    if (pendingSol && sol.wallet && !sol.connected) {
      sol.connect().catch(() => {});
      setPendingSol(false);
      setOpen(false);
    }
  }, [pendingSol, sol]);

  if (isConnected && address) {
    return (
      <button className="btn btn-wallet" onClick={() => disconnect()} title={address}>
        <i className="ti ti-wallet" aria-hidden="true" /> <span className="btn-label">{short(address)}</span>
      </button>
    );
  }
  if (sol.connected && sol.publicKey) {
    const a = sol.publicKey.toBase58();
    return (
      <button className="btn btn-wallet" onClick={() => sol.disconnect()} title={a}>
        <i className="ti ti-wallet" aria-hidden="true" /> <span className="btn-label">{short(a)}</span>
      </button>
    );
  }

  const coinbase = connectors.find((c) => c.id === "coinbaseWalletSDK" || c.name.toLowerCase().includes("coinbase"));
  const discovered = connectors.filter((c) => c.id !== "injected" && c !== coinbase);
  const genericInjected = connectors.find((c) => c.id === "injected");
  const hasEth = typeof window !== "undefined" && !!(window as unknown as { ethereum?: unknown }).ethereum;
  const evmExtensions = discovered.length ? discovered : genericInjected && hasEth ? [genericInjected] : [];

  const solWallets = sol.wallets.filter(
    (w) => w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable
  );

  function pickEvm(connector: Connector) {
    connect({ connector });
    setOpen(false);
  }
  function pickSol(name: WalletName) {
    sol.select(name);
    setPendingSol(true);
  }

  return (
    <>
      <button className="btn btn-wallet" onClick={() => setOpen(true)} aria-label="Connect wallet">
        <i className="ti ti-wallet" aria-hidden="true" /> <span className="btn-label">Connect wallet</span>
      </button>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Connect a wallet">
            <div className="modal-head">
              <h3>Connect a wallet</h3>
              <button className="modal-x" onClick={() => setOpen(false)} aria-label="Close"><i className="ti ti-x" aria-hidden="true" /></button>
            </div>

            <div className="wallet-group-label">Ethereum &amp; Base</div>
            <div className="wallet-list">
              {coinbase && (
                <button className="wallet-row" onClick={() => pickEvm(coinbase)}>
                  <img className="wallet-ic" src={COINBASE_ICON} alt="" />
                  <span className="wallet-name">Coinbase<span className="wallet-sub">Email or passkey, no extension</span></span>
                </button>
              )}
              {evmExtensions.map((c) => (
                <button className="wallet-row" key={c.uid} onClick={() => pickEvm(c)}>
                  {c.icon ? (
                    <img className="wallet-ic" src={c.icon} alt="" />
                  ) : (
                    <span className="wallet-ic wallet-ic-fallback"><i className="ti ti-wallet" aria-hidden="true" /></span>
                  )}
                  <span className="wallet-name">{c.name === "Injected" ? "Browser wallet" : c.name}</span>
                </button>
              ))}
              {!coinbase && evmExtensions.length === 0 && <div className="wallet-empty">No EVM wallet detected.</div>}
            </div>

            <div className="wallet-group-label" style={{ marginTop: 14 }}>Solana</div>
            <div className="wallet-list">
              {solWallets.map((w) => (
                <button className="wallet-row" key={w.adapter.name} onClick={() => pickSol(w.adapter.name)}>
                  {w.adapter.icon ? (
                    <img className="wallet-ic" src={w.adapter.icon} alt="" />
                  ) : (
                    <span className="wallet-ic wallet-ic-fallback"><i className="ti ti-wallet" aria-hidden="true" /></span>
                  )}
                  <span className="wallet-name">{w.adapter.name}</span>
                </button>
              ))}
              {solWallets.length === 0 && (
                <div className="wallet-empty">No Solana wallet detected. Install Phantom or Solflare.</div>
              )}
            </div>

            {error && <div className="wopt-err">{(error as { shortMessage?: string }).shortMessage || error.message}</div>}
          </div>
        </div>
      )}
    </>
  );
}
