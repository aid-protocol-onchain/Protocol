import { http, createConfig } from "wagmi";
import { mainnet, base, sepolia, baseSepolia } from "wagmi/chains";
import { injected, coinbaseWallet } from "wagmi/connectors";

// EVM wallet config (NFR6). Mainnet + Base for production, plus the Sepolia and
// Base Sepolia testnets where the escrow factory is currently deployed.
// - injected: MetaMask and compatible browser wallets.
// - coinbaseWallet (smartWalletOnly): email / passkey embedded smart wallet, no
//   extension and no seed phrase (the walletless + future fiat on-ramp path).
export const wagmiConfig = createConfig({
  chains: [baseSepolia, sepolia, base, mainnet],
  connectors: [
    injected(),
    coinbaseWallet({ appName: "Aid Protocol", preference: "smartWalletOnly" }),
  ],
  transports: {
    [baseSepolia.id]: http(),
    [sepolia.id]: http(),
    [base.id]: http(),
    [mainnet.id]: http(),
  },
});
