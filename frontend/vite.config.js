import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
const proxyTarget = process.env.VITE_API_PROXY_TARGET || "http://localhost:8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    allowedHosts: [
      "poet-danny-isp-laptop.trycloudflare.com",
    ],
    host: true, // Listen on all network interfaces
    port: 5173, // Ensure this matches your Docker EXPOSE and ports
    proxy: {
      "/api": {
        target: proxyTarget,
        changeOrigin: true,
      },
    },
    watch: {
      usePolling: true, // Vital for hot-reload to work in Docker
    },
  },
});
