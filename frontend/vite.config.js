import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    allowedHosts: process.env.ALLOWED_HOST ? [process.env.ALLOWED_HOST] : [],
    proxy: {
      "/api": {
        target: "http://backend:8000",
        changeOrigin: true,
      },
      "/static": {
        target: "http://backend:8000",
        changeOrigin: true,
      },
    },
  },
});
