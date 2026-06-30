import { Buffer } from "buffer";
if (!(globalThis as unknown as { Buffer?: unknown }).Buffer) {
  (globalThis as unknown as { Buffer: unknown }).Buffer = Buffer;
}
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Feed } from "./pages/Feed";
import { Campaign } from "./pages/Campaign";
import { Leaderboard } from "./pages/Leaderboard";
import { News } from "./pages/News";
import { Profile } from "./pages/Profile";
import { Apply } from "./pages/Apply";
import { Admin } from "./pages/Admin";
import { Legal } from "./pages/Legal";
import { Past } from "./pages/Past";
import { PRIVACY, TERMS } from "./legal";
import { Layout } from "./components/Layout";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "./wallet/wagmi";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { SOLANA_RPC } from "./contracts";
import { XAuthProvider } from "./wallet/xauth";
import "./styles.css";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ConnectionProvider endpoint={SOLANA_RPC}>
        <WalletProvider wallets={[]} autoConnect>
          <XAuthProvider>
          <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Feed />} />
              <Route path="/c/:id" element={<Campaign />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/past" element={<Past />} />
              <Route path="/u/:handle" element={<Profile kind="u" />} />
              <Route path="/w/:wallet" element={<Profile kind="w" />} />
              <Route path="/news" element={<News />} />
              <Route path="/apply" element={<Apply />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/privacy" element={<Legal title="Privacy Policy" content={PRIVACY} />} />
              <Route path="/terms" element={<Legal title="Terms of Service" content={TERMS} />} />
            </Route>
            </Routes>
          </BrowserRouter>
          </XAuthProvider>
        </WalletProvider>
        </ConnectionProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);
