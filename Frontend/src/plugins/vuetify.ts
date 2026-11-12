import "vuetify/styles";
import "@mdi/font/css/materialdesignicons.css";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";

// ─── Tema krm — Steel Blue Classic Desktop ──────────────────────────
const bsmTheme = {
  dark: false,
  colors: {
    primary:         "#D97706",
    "primary-darken-1": "#B45309",
    "primary-lighten-1": "#F59E0B",

    secondary:       "#78350F",
    "secondary-darken-1": "#0F1A2E",

    success:         "#059669",
    info:            "#D97706",
    warning:         "#D97706",
    error:           "#DC2626",

    background:      "#E8ECF1",
    surface:         "#F0F3F8",
    "surface-variant": "#E0E4EA",
    "on-surface":    "#78350F",
    "on-primary":    "#ffffff",
  },
};

const bsmDarkTheme = {
  dark: true,
  colors: {
    primary:         "#F59E0B",
    "primary-darken-1": "#D97706",
    secondary:       "#8494A7",
    success:         "#34D399",
    info:            "#60A5FA",
    warning:         "#FBBF24",
    error:           "#F87171",
    background:      "#0F1A2E",
    surface:         "#78350F",
    "surface-variant": "#243656",
    "on-surface":    "#E2E8F0",
    "on-primary":    "#78350F",
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
