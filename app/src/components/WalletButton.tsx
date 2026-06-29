import { useState } from "react";
import { useAccount, useConnect, useDisconnect, type Connector } from "wagmi";

function short(addr: string) {
  return addr.slice(0, 4) + "…" + addr.slice(-4);
}

// Inline Coinbase mark for the Smart Wallet option (the SDK connector has no icon).
const COINBASE_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%230052FF'/%3E%3Ccircle cx='16' cy='16' r='9' fill='white'/%3E%3Crect x='12.5' y='12.5' width='7' height='7' rx='1.4' fill='%230052FF'/%3E%3C/svg%3E";

// Standard "Connect wallet" modal. wagmi auto-discovers installed wallets via EIP-6963,
// so each browser extension (MetaMask, Coinbase, Solflare, Rabby, ...) shows up here with
// its own name and icon, alongside the Coinbase Smart Wallet (email / passkey, no extension).
export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);

  if (isConnected && address) {
    return (
      <button className="btn btn-wallet" onClick={() => disconnect()} title={address}>
        <i className="ti ti-wallet" aria-hidden="true" /> <span className="btn-label">{short(address)}</span>
      </button>
    );
  }

  const coinbase = connectors.find((c) => c.id === "coinbaseWalletSDK" || c.name.toLowerCase().includes("coinbase"));
  // EIP-6963 discovered wallets (real extensions): everything except the generic "injected" fallback and the CSW connector.
  const discovered = connectors.filter((c) => c.id !== "injected" && c !== coinbase);
  const genericInjected = connectors.find((c) => c.id === "injected");
  const hasEth = typeof window !== "undefined" && !!(window as unknown as { ethereum?: unknown }).ethereum;
  // Prefer EIP-6963 discovered wallets (named, with icons). Only fall back to the
  // generic injected connector when a provider actually exists but did not announce.
  const extensions = discovered.length ? discovered : genericInjected && hasEth ? [genericInjected] : [];

  function pick(connector: Connector) {
    connect({ connector });
    setOpen(false);
  }

  return (
    <>
      <button className="btn btn-wallet" onClick={() => setOpen(true)} aria-label="Connect wallet">
        <i className="ti ti-wallet" aria-hidden="true" />{" "}
        <span className="btn-label">{isPending ? "Connecting" : "Connect wallet"}</span>
      </button>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Connect a wallet">
            <div className="modal-head">
              <h3>Connect a wallet</h3>
              <button className="modal-x" onClick={() => setOpen(false)} aria-label="Close"><i className="ti ti-x" aria-hidden="true" /></button>
            </div>

            <div className="wallet-list">
              {coinbase && (
                <button className="wallet-row" onClick={() => pick(coinbase)}>
                  <img className="wallet-ic" src={COINBASE_ICON} alt="" />
                  <span className="wallet-name">Coinbase<span className="wallet-sub">Email or passkey, no extension</span></span>
                </button>
              )}

              {extensions.map((c) => (
                <button className="wallet-row" key={c.uid} onClick={() => pick(c)}>
                  {c.icon ? (
                    <img className="wallet-ic" src={c.icon} alt="" />
                  ) : (
                    <span className="wallet-ic wallet-ic-fallback"><i className="ti ti-wallet" aria-hidden="true" /></span>
                  )}
                  <span className="wallet-name">{c.name === "Injected" ? "Browser wallet" : c.name}</span>
                </button>
              ))}

              {extensions.length === 0 && (
                <div className="wallet-empty">
                  No browser wallet detected. Use Coinbase above, or install a wallet extension.
                </div>
              )}
            </div>

            {error && <div className="wopt-err">{(error as { shortMessage?: string }).shortMessage || error.message}</div>}
          </div>
        </div>
      )}
    </>
  );
}
