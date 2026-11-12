import { createApp } from "vue";
import { createPinia } from "pinia";
import Toast, { POSITION } from "vue-toastification";
import "vue-toastification/dist/index.css";

import App from "./App.vue";
import router from "./router";
import vuetify from "./plugins/vuetify";
import { installReloadGuard } from "@/composables/useAppReload";

// Side-effect: pasang listener hotkey global (F-key/Ctrl+W/Alt+1..9).
// Harus di-import dari entry agar modul pasti ter-bundle (tidak ter-orphan).
import "@/composables/useHotkeys";

import "./assets/main.css";
import "./assets/design-system.css";
import "vue-toastification/dist/index.css";

import "jquery-ui-dist/jquery-ui.css";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.use(vuetify);
app.use(Toast, {
  position: POSITION.TOP_RIGHT,
  timeout: 3500,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  hideProgressBar: false,
  toastClassName: "finance-toast",
});

// Potongan halaman yang gagal dimuat (aset lama sudah hilang di server setelah
// deploy) memicu muat ulang sendiri, kecuali ada form dengan isian belum tersimpan.
installReloadGuard(router);

app.mount("#app");

// PWA: register service worker hanya di production (dev server tidak ikut).
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
