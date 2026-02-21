import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // Listen on all network interfaces
    port: 5173, // Ensure this matches your Docker EXPOSE and ports
    watch: {
      usePolling: true, // Vital for hot-reload to work in Docker
    },
  },
});
