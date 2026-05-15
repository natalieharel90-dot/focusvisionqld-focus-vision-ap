import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Theme tokens are backed by CSS custom properties. :root in
        // globals.css defines the Calm-medical defaults; the patient
        // layout overrides them per [data-theme] (see lib/theme.ts).
        "fv-bg-app": "var(--fv-bg-app)",
        "fv-bg-card": "var(--fv-bg-card)",
        "fv-bg-tile": "var(--fv-bg-tile)",
        "fv-bg-soft": "var(--fv-bg-soft)",
        "fv-bg-accent-soft": "var(--fv-bg-accent-soft)",
        "fv-text-primary": "var(--fv-text-primary)",
        "fv-text-secondary": "var(--fv-text-secondary)",
        "fv-text-muted": "var(--fv-text-muted)",
        "fv-accent": "var(--fv-accent)",
        "fv-accent-strong": "var(--fv-accent-strong)",
        "fv-accent-2": "var(--fv-accent-2)",
        "fv-accent-warm": "var(--fv-accent-warm)",
        "fv-danger": "var(--fv-danger)",
        "fv-success": "var(--fv-success)",
        "fv-border": "var(--fv-border)",
        // Logo brand colours are fixed — not themed.
        "fv-ring": "#5C8FA0",
        "fv-logo-text": "#1F3A48",
      },
      fontFamily: {
        sans: [
          "'Helvetica Neue'",
          "Helvetica",
          "Arial",
          "system-ui",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
