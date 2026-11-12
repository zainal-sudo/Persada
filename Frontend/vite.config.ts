// vite.config.ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";
import { fileURLToPath, URL } from "node:url";
import inject from "@rollup/plugin-inject";
import pkg from "./package.json";

export default defineConfig({
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
    inject({
      $: "jquery",
      jQuery: "jquery",
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Shim: semua impor ikon Tabler dialihkan ke Material Symbols
      "@tabler/icons-vue": fileURLToPath(
        new URL("./src/components/tabler-material.ts", import.meta.url),
      ),
    },
  },
  server: {
    host: true,
    port: 8090,
    proxy: {
      "/api": {
        target: "http://localhost:3099",
        changeOrigin: true,
        // chat AI = rantai panggilan LLM (bisa > 1 menit) — jangan diputus proxy
        timeout: 300_000,
        proxyTimeout: 300_000,
      },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  optimizeDeps: {
    include: ["jquery", "pivottable"],
  },
});
