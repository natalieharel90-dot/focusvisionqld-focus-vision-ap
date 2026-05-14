import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Calm medical theme tokens lifted from focus_vision_prototype.html.
        // Other themes will be wired in via [data-theme="…"] CSS custom
        // properties in a later pass; these literals exist so the staff
        // dashboard has brand-aligned defaults today.
        "fv-bg-app": "#F0F6F8",
        "fv-bg-card": "#FFFFFF",
        "fv-bg-soft": "#E0EBEE",
        "fv-bg-accent-soft": "#D3E7EC",
        "fv-text-primary": "#1F3540",
        "fv-text-secondary": "#5C7672",
        "fv-accent": "#4F9DAA",
        "fv-accent-strong": "#2C7585",
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
