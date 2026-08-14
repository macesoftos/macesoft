import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiProxy = process.env.VITE_API_PROXY || "http://127.0.0.1:3001";
const devPort = Number(process.env.VITE_PORT || 5173);

export default defineConfig({
  plugins: [react()],
  build: { chunkSizeWarningLimit: 700 },
  server: {
    host: "127.0.0.1",
    port: devPort,
    strictPort: true,
    proxy: {
      "/api": {
        target: apiProxy,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "127.0.0.1",
    proxy: {
      "/api": {
        target: apiProxy,
        changeOrigin: true,
      },
    },
  },
});
