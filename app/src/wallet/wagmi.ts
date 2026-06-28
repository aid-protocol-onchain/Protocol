import { http, createConfig } from "wagmi";
import { mainnet, base, sepolia, baseSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

// EVM wallet config (NFR6). Mainnet + Base for production, plus the Sepolia and
// Base Sepolia testnets where the escrow factory is currently deployed. Injected
// connector (MetaMask and compatible). Solana wallet support is added separately.
export const wagmiConfig = createConfig({
  chains: [baseSepolia, sepolia, base, mainnet],
  connectors: [injected()],
  transports: {
    [baseSepolia.id]: http(),
    [sepolia.id]: http(),
    [base.id]: http(),
    [mainnet.id]: http(),
  },
});
