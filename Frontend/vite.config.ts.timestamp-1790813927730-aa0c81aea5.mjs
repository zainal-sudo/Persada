// vite.config.ts
import { defineConfig } from "file:///D:/Projects/Work/2025/krm/Krm/FE-Krm/node_modules/vite/dist/node/index.js";
import vue from "file:///D:/Projects/Work/2025/krm/Krm/FE-Krm/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import vuetify from "file:///D:/Projects/Work/2025/krm/Krm/FE-Krm/node_modules/vite-plugin-vuetify/dist/index.mjs";
import { fileURLToPath, URL } from "node:url";
import inject from "file:///D:/Projects/Work/2025/krm/Krm/FE-Krm/node_modules/@rollup/plugin-inject/dist/es/index.js";

// package.json
var package_default = {
  name: "finance-frontend",
  version: "1.0.7",
  private: true,
  type: "module",
  scripts: {
    dev: "vite",
    build: "vue-tsc && vite build",
    preview: "vite preview",
    "type-check": "vue-tsc --noEmit"
  },
  dependencies: {
    "@mdi/font": "^7.4.47",
    "@smallwebco/tinypivot-vue": "^1.2.1",
    axios: "^1.6.0",
    "chart.js": "^4.5.1",
    exceljs: "^4.4.0",
    "file-saver": "^2.0.5",
    jquery: "^4.0.0",
    "jquery-ui-dist": "^1.13.3",
    pinia: "^2.1.7",
    pivottable: "^2.23.0",
    "qz-tray": "^2.2.6",
    vue: "^3.4.0",
    "vue-pivottable": "^1.4.1",
    "vue-router": "^4.2.5",
    "vue-toastification": "^2.0.0-rc.5",
    vuetify: "^3.4.0",
    xlsx: "^0.18.5"
  },
  devDependencies: {
    "@rollup/plugin-commonjs": "^29.0.3",
    "@rollup/plugin-inject": "^5.0.5",
    "@types/file-saver": "^2.0.7",
    "@types/jquery": "^4.0.1",
    "@types/node": "^25.9.1",
    "@vitejs/plugin-vue": "^5.0.0",
    sass: "^1.69.5",
    typescript: "^5.3.2",
    vite: "^5.0.0",
    "vite-plugin-vuetify": "^2.0.1",
    "vue-tsc": "^2.0.0"
  }
};

// vite.config.ts
var __vite_injected_original_import_meta_url = "file:///D:/Projects/Work/2025/krm/Krm/FE-Krm/vite.config.ts";
var vite_config_default = defineConfig({
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
    inject({
      $: "jquery",
      jQuery: "jquery"
    })
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", __vite_injected_original_import_meta_url)),
      // Shim: semua impor ikon Tabler dialihkan ke Material Symbols
      "@tabler/icons-vue": fileURLToPath(
        new URL("./src/components/tabler-material.ts", __vite_injected_original_import_meta_url)
      )
    }
  },
  server: {
    host: true,
    port: 8090,
    proxy: {
      "/api": {
        target: "http://localhost:3099",
        changeOrigin: true,
        // chat AI = rantai panggilan LLM (bisa > 1 menit) — jangan diputus proxy
        timeout: 3e5,
        proxyTimeout: 3e5
      }
    }
  },
  define: {
    __APP_VERSION__: JSON.stringify(package_default.version)
  },
  optimizeDeps: {
    include: ["jquery", "pivottable"]
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAicGFja2FnZS5qc29uIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiRDpcXFxcUHJvamVjdHNcXFxcV29ya1xcXFwyMDI1XFxcXEJTTVxcXFxCU01DYWJhbmdcXFxcRkUtQlNNQ2FiYW5nXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJEOlxcXFxQcm9qZWN0c1xcXFxXb3JrXFxcXDIwMjVcXFxcQlNNXFxcXEJTTUNhYmFuZ1xcXFxGRS1CU01DYWJhbmdcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0Q6L1Byb2plY3RzL1dvcmsvMjAyNS9CU00vQlNNQ2FiYW5nL0ZFLUJTTUNhYmFuZy92aXRlLmNvbmZpZy50c1wiOy8vIHZpdGUuY29uZmlnLnRzXHJcbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlXCI7XHJcbmltcG9ydCB2dWUgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXZ1ZVwiO1xyXG5pbXBvcnQgdnVldGlmeSBmcm9tIFwidml0ZS1wbHVnaW4tdnVldGlmeVwiO1xyXG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoLCBVUkwgfSBmcm9tIFwibm9kZTp1cmxcIjtcclxuaW1wb3J0IGluamVjdCBmcm9tIFwiQHJvbGx1cC9wbHVnaW4taW5qZWN0XCI7XHJcbmltcG9ydCBwa2cgZnJvbSBcIi4vcGFja2FnZS5qc29uXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xyXG4gIHBsdWdpbnM6IFtcclxuICAgIHZ1ZSgpLFxyXG4gICAgdnVldGlmeSh7IGF1dG9JbXBvcnQ6IHRydWUgfSksXHJcbiAgICBpbmplY3Qoe1xyXG4gICAgICAkOiBcImpxdWVyeVwiLFxyXG4gICAgICBqUXVlcnk6IFwianF1ZXJ5XCIsXHJcbiAgICB9KSxcclxuICBdLFxyXG4gIHJlc29sdmU6IHtcclxuICAgIGFsaWFzOiB7XHJcbiAgICAgIFwiQFwiOiBmaWxlVVJMVG9QYXRoKG5ldyBVUkwoXCIuL3NyY1wiLCBpbXBvcnQubWV0YS51cmwpKSxcclxuICAgICAgLy8gU2hpbTogc2VtdWEgaW1wb3IgaWtvbiBUYWJsZXIgZGlhbGloa2FuIGtlIE1hdGVyaWFsIFN5bWJvbHNcclxuICAgICAgXCJAdGFibGVyL2ljb25zLXZ1ZVwiOiBmaWxlVVJMVG9QYXRoKFxyXG4gICAgICAgIG5ldyBVUkwoXCIuL3NyYy9jb21wb25lbnRzL3RhYmxlci1tYXRlcmlhbC50c1wiLCBpbXBvcnQubWV0YS51cmwpLFxyXG4gICAgICApLFxyXG4gICAgfSxcclxuICB9LFxyXG4gIHNlcnZlcjoge1xyXG4gICAgaG9zdDogdHJ1ZSxcclxuICAgIHBvcnQ6IDgwOTAsXHJcbiAgICBwcm94eToge1xyXG4gICAgICBcIi9hcGlcIjoge1xyXG4gICAgICAgIHRhcmdldDogXCJodHRwOi8vbG9jYWxob3N0OjMwOTlcIixcclxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgLy8gY2hhdCBBSSA9IHJhbnRhaSBwYW5nZ2lsYW4gTExNIChiaXNhID4gMSBtZW5pdCkgXHUyMDE0IGphbmdhbiBkaXB1dHVzIHByb3h5XHJcbiAgICAgICAgdGltZW91dDogMzAwXzAwMCxcclxuICAgICAgICBwcm94eVRpbWVvdXQ6IDMwMF8wMDAsXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gIH0sXHJcbiAgZGVmaW5lOiB7XHJcbiAgICBfX0FQUF9WRVJTSU9OX186IEpTT04uc3RyaW5naWZ5KHBrZy52ZXJzaW9uKSxcclxuICB9LFxyXG4gIG9wdGltaXplRGVwczoge1xyXG4gICAgaW5jbHVkZTogW1wianF1ZXJ5XCIsIFwicGl2b3R0YWJsZVwiXSxcclxuICB9LFxyXG59KTtcclxuIiwgIntcclxuICBcIm5hbWVcIjogXCJmaW5hbmNlLWZyb250ZW5kXCIsXHJcbiAgXCJ2ZXJzaW9uXCI6IFwiMS4wLjdcIixcclxuICBcInByaXZhdGVcIjogdHJ1ZSxcclxuICBcInR5cGVcIjogXCJtb2R1bGVcIixcclxuICBcInNjcmlwdHNcIjoge1xyXG4gICAgXCJkZXZcIjogXCJ2aXRlXCIsXHJcbiAgICBcImJ1aWxkXCI6IFwidnVlLXRzYyAmJiB2aXRlIGJ1aWxkXCIsXHJcbiAgICBcInByZXZpZXdcIjogXCJ2aXRlIHByZXZpZXdcIixcclxuICAgIFwidHlwZS1jaGVja1wiOiBcInZ1ZS10c2MgLS1ub0VtaXRcIlxyXG4gIH0sXHJcbiAgXCJkZXBlbmRlbmNpZXNcIjoge1xyXG4gICAgXCJAbWRpL2ZvbnRcIjogXCJeNy40LjQ3XCIsXHJcbiAgICBcIkBzbWFsbHdlYmNvL3RpbnlwaXZvdC12dWVcIjogXCJeMS4yLjFcIixcclxuICAgIFwiYXhpb3NcIjogXCJeMS42LjBcIixcclxuICAgIFwiY2hhcnQuanNcIjogXCJeNC41LjFcIixcclxuICAgIFwiZXhjZWxqc1wiOiBcIl40LjQuMFwiLFxyXG4gICAgXCJmaWxlLXNhdmVyXCI6IFwiXjIuMC41XCIsXHJcbiAgICBcImpxdWVyeVwiOiBcIl40LjAuMFwiLFxyXG4gICAgXCJqcXVlcnktdWktZGlzdFwiOiBcIl4xLjEzLjNcIixcclxuICAgIFwicGluaWFcIjogXCJeMi4xLjdcIixcclxuICAgIFwicGl2b3R0YWJsZVwiOiBcIl4yLjIzLjBcIixcclxuICAgIFwicXotdHJheVwiOiBcIl4yLjIuNlwiLFxyXG4gICAgXCJ2dWVcIjogXCJeMy40LjBcIixcclxuICAgIFwidnVlLXBpdm90dGFibGVcIjogXCJeMS40LjFcIixcclxuICAgIFwidnVlLXJvdXRlclwiOiBcIl40LjIuNVwiLFxyXG4gICAgXCJ2dWUtdG9hc3RpZmljYXRpb25cIjogXCJeMi4wLjAtcmMuNVwiLFxyXG4gICAgXCJ2dWV0aWZ5XCI6IFwiXjMuNC4wXCIsXHJcbiAgICBcInhsc3hcIjogXCJeMC4xOC41XCJcclxuICB9LFxyXG4gIFwiZGV2RGVwZW5kZW5jaWVzXCI6IHtcclxuICAgIFwiQHJvbGx1cC9wbHVnaW4tY29tbW9uanNcIjogXCJeMjkuMC4zXCIsXHJcbiAgICBcIkByb2xsdXAvcGx1Z2luLWluamVjdFwiOiBcIl41LjAuNVwiLFxyXG4gICAgXCJAdHlwZXMvZmlsZS1zYXZlclwiOiBcIl4yLjAuN1wiLFxyXG4gICAgXCJAdHlwZXMvanF1ZXJ5XCI6IFwiXjQuMC4xXCIsXHJcbiAgICBcIkB0eXBlcy9ub2RlXCI6IFwiXjI1LjkuMVwiLFxyXG4gICAgXCJAdml0ZWpzL3BsdWdpbi12dWVcIjogXCJeNS4wLjBcIixcclxuICAgIFwic2Fzc1wiOiBcIl4xLjY5LjVcIixcclxuICAgIFwidHlwZXNjcmlwdFwiOiBcIl41LjMuMlwiLFxyXG4gICAgXCJ2aXRlXCI6IFwiXjUuMC4wXCIsXHJcbiAgICBcInZpdGUtcGx1Z2luLXZ1ZXRpZnlcIjogXCJeMi4wLjFcIixcclxuICAgIFwidnVlLXRzY1wiOiBcIl4yLjAuMFwiXHJcbiAgfVxyXG59XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFDQSxTQUFTLG9CQUFvQjtBQUM3QixPQUFPLFNBQVM7QUFDaEIsT0FBTyxhQUFhO0FBQ3BCLFNBQVMsZUFBZSxXQUFXO0FBQ25DLE9BQU8sWUFBWTs7O0FDTG5CO0FBQUEsRUFDRSxNQUFRO0FBQUEsRUFDUixTQUFXO0FBQUEsRUFDWCxTQUFXO0FBQUEsRUFDWCxNQUFRO0FBQUEsRUFDUixTQUFXO0FBQUEsSUFDVCxLQUFPO0FBQUEsSUFDUCxPQUFTO0FBQUEsSUFDVCxTQUFXO0FBQUEsSUFDWCxjQUFjO0FBQUEsRUFDaEI7QUFBQSxFQUNBLGNBQWdCO0FBQUEsSUFDZCxhQUFhO0FBQUEsSUFDYiw2QkFBNkI7QUFBQSxJQUM3QixPQUFTO0FBQUEsSUFDVCxZQUFZO0FBQUEsSUFDWixTQUFXO0FBQUEsSUFDWCxjQUFjO0FBQUEsSUFDZCxRQUFVO0FBQUEsSUFDVixrQkFBa0I7QUFBQSxJQUNsQixPQUFTO0FBQUEsSUFDVCxZQUFjO0FBQUEsSUFDZCxXQUFXO0FBQUEsSUFDWCxLQUFPO0FBQUEsSUFDUCxrQkFBa0I7QUFBQSxJQUNsQixjQUFjO0FBQUEsSUFDZCxzQkFBc0I7QUFBQSxJQUN0QixTQUFXO0FBQUEsSUFDWCxNQUFRO0FBQUEsRUFDVjtBQUFBLEVBQ0EsaUJBQW1CO0FBQUEsSUFDakIsMkJBQTJCO0FBQUEsSUFDM0IseUJBQXlCO0FBQUEsSUFDekIscUJBQXFCO0FBQUEsSUFDckIsaUJBQWlCO0FBQUEsSUFDakIsZUFBZTtBQUFBLElBQ2Ysc0JBQXNCO0FBQUEsSUFDdEIsTUFBUTtBQUFBLElBQ1IsWUFBYztBQUFBLElBQ2QsTUFBUTtBQUFBLElBQ1IsdUJBQXVCO0FBQUEsSUFDdkIsV0FBVztBQUFBLEVBQ2I7QUFDRjs7O0FEM0NxTixJQUFNLDJDQUEyQztBQVF0USxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTO0FBQUEsSUFDUCxJQUFJO0FBQUEsSUFDSixRQUFRLEVBQUUsWUFBWSxLQUFLLENBQUM7QUFBQSxJQUM1QixPQUFPO0FBQUEsTUFDTCxHQUFHO0FBQUEsTUFDSCxRQUFRO0FBQUEsSUFDVixDQUFDO0FBQUEsRUFDSDtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSyxjQUFjLElBQUksSUFBSSxTQUFTLHdDQUFlLENBQUM7QUFBQTtBQUFBLE1BRXBELHFCQUFxQjtBQUFBLFFBQ25CLElBQUksSUFBSSx1Q0FBdUMsd0NBQWU7QUFBQSxNQUNoRTtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsTUFDTCxRQUFRO0FBQUEsUUFDTixRQUFRO0FBQUEsUUFDUixjQUFjO0FBQUE7QUFBQSxRQUVkLFNBQVM7QUFBQSxRQUNULGNBQWM7QUFBQSxNQUNoQjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixpQkFBaUIsS0FBSyxVQUFVLGdCQUFJLE9BQU87QUFBQSxFQUM3QztBQUFBLEVBQ0EsY0FBYztBQUFBLElBQ1osU0FBUyxDQUFDLFVBQVUsWUFBWTtBQUFBLEVBQ2xDO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
