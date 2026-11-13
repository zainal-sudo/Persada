import "vuetify/styles";
import "@mdi/font/css/materialdesignicons.css";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";

// ─── Tema krm — Steel Blue Classic Desktop ──────────────────────────
const bsmTheme = {
  dark: false,
  colors: {
    primary:         "#0284c7",
    "primary-darken-1": "#0369a1",
    "primary-lighten-1": "#0ea5e9",

    secondary:       "#0c4a6e",
    "secondary-darken-1": "#0F1A2E",

    success:         "#059669",
    info:            "#0284c7",
    warning:         "#0284c7",
    error:           "#DC2626",

    background:      "#E8ECF1",
    surface:         "#F0F3F8",
    "surface-variant": "#E0E4EA",
    "on-surface":    "#0c4a6e",
    "on-primary":    "#ffffff",
  },
};

const bsmDarkTheme = {
  dark: true,
  colors: {
    primary:         "#0ea5e9",
    "primary-darken-1": "#0284c7",
    secondary:       "#8494A7",
    success:         "#34D399",
    info:            "#60A5FA",
    warning:         "#38bdf8",
    error:           "#F87171",
    background:      "#0F1A2E",
    surface:         "#0c4a6e",
    "surface-variant": "#243656",
    "on-surface":    "#E2E8F0",
    "on-primary":    "#0c4a6e",
  },
};

export default createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: "bsmTheme",
    themes: {
      bsmTheme,
      bsmDarkTheme,
    },
  },
  defaults: {
    VBtn: {
      style: "font-size: 11px; letter-spacing: 0.02em; font-weight: 600; border-radius: 0;",
    },
    VTextField: {
      density: "compact",
      variant: "outlined",
      hideDetails: "auto",
      style: "font-size: 11px; border-radius: 0;",
    },
    VSelect: {
      density: "compact",
      variant: "outlined",
      hideDetails: "auto",
      style: "font-size: 11px; border-radius: 0;",
    },
    VAutocomplete: {
      density: "compact",
      variant: "outlined",
      hideDetails: "auto",
      style: "font-size: 11px; border-radius: 0;",
    },
    VTextarea: {
      density: "compact",
      variant: "outlined",
      hideDetails: "auto",
      style: "font-size: 11px; border-radius: 0;",
    },
    VCheckbox: {
      density: "compact",
      hideDetails: "auto",
    },
    VCard: {
      rounded: false,
      elevation: 0,
    },
    VDataTable: {
      density: "compact",
    },
  },
});
