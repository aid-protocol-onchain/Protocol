import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @solana/web3.js expects Node globals (Buffer, global) in the browser.
export default defineConfig({
  plugins: [react()],
  define: {
    global: "globalThis",
  },
  resolve: {
    alias: {
      buffer: "buffer",
    },
  },
  optimizeDeps: {
    include: ["buffer", "@solana/web3.js"],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
