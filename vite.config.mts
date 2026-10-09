import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  base: "./",
  plugins: [vue()],
  server: { host: "127.0.0.1", port: 5178, strictPort: true },
  build: { target: "es2022", chunkSizeWarningLimit: 2200 },
});
