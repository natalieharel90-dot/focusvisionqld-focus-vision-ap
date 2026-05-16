// Patient app theme engine. Five visible themes + dark mode, plus a
// hidden "Bonus theme pack" of twelve extra themes unlocked via an
// Easter egg. All palettes are lifted verbatim from the prototype's
// <style> block. The bonus themes plug into the identical [data-theme]
// machinery — no special-case code paths. No DB / React imports, so the
// theme data, resolution, and CSS generation are all unit-testable.

export type ThemeId =
  // Visible themes.
  | "calm"
  | "premium"
  | "bright"
  | "terracotta"
  | "minimal"
  // Hidden bonus theme pack (twelve themes).
  | "roots"
  | "gilded"
  | "twilight"
  | "scarlet"
  | "skyline"
  | "eclipse"
  | "bloom"
  | "mist"
  | "ember"
  | "midnight"
  | "inkwell"
  | "limelight";

// The five themes shown in Settings → Appearance by default.
export const THEME_IDS: ReadonlyArray<ThemeId> = [
  "calm",
  "premium",
  "bright",
  "terracotta",
  "minimal",
];

// The hidden bonus pack — revealed in Settings only after unlock.
export const BONUS_THEME_IDS: ReadonlyArray<ThemeId> = [
  "roots",
  "gilded",
  "twilight",
  "scarlet",
  "skyline",
  "eclipse",
  "bloom",
  "mist",
  "ember",
  "midnight",
  "inkwell",
  "limelight",
];

export const ALL_THEME_IDS: ReadonlyArray<ThemeId> = [
  ...THEME_IDS,
  ...BONUS_THEME_IDS,
];

export const DEFAULT_THEME: ThemeId = "calm";

// A stored theme preference: any concrete theme, or the 'random'
// meta-option that re-rolls a bonus theme on each render.
export type ThemePreference = ThemeId | "random";

// Easter-egg unlock: 13 clicks on the patient-app logo within 5 seconds.
export const BONUS_UNLOCK_CLICKS = 13;
export const BONUS_UNLOCK_WINDOW_MS = 5000;
export const BONUS_UNLOCK_TOAST = "Bonus theme pack unlocked!";
export const BONUS_TOAST_DURATION_MS = 4000;

type TokenMap = Record<string, string>;

export type Theme = {
  id: ThemeId;
  label: string;
  light: TokenMap; // full palette (15 tokens)
  dark: TokenMap; // dark overrides (subset — the rest cascade from light)
};

// Full light palette + dark overrides per the prototype. Dark blocks
// override surfaces, text, and the accent pair; accent-2 / accent-warm /
// danger / success cascade from light. Bonus themes carry hand-tuned
// dark variants too, so the pack stays legible in dark mode.
export const THEMES: Record<ThemeId, Theme> = {
  calm: {
    id: "calm",
    label: "Calm medical",
    light: {
      "--fv-bg-app": "#F0F6F8",
      "--fv-bg-card": "#FFFFFF",
      "--fv-bg-tile": "#FFFFFF",
      "--fv-bg-soft": "#E0EBEE",
      "--fv-bg-accent-soft": "#D3E7EC",
      "--fv-text-primary": "#1F3540",
      "--fv-text-secondary": "#5C7178",
      "--fv-text-muted": "#8FA0A6",
      "--fv-accent": "#4F9DAA",
      "--fv-accent-strong": "#2C7585",
      "--fv-accent-2": "#6FA8C7",
      "--fv-accent-warm": "#E5C07B",
      "--fv-danger": "#D97757",
      "--fv-success": "#4F9DAA",
      "--fv-border": "#D2E1E5",
    },
    dark: {
      "--fv-bg-app": "#142026",
      "--fv-bg-card": "#1B2A33",
      "--fv-bg-tile": "#1B2A33",
      "--fv-bg-soft": "#21353D",
      "--fv-bg-accent-soft": "#1F3940",
      "--fv-text-primary": "#E8F0F4",
      "--fv-text-secondary": "#B0C2C7",
      "--fv-text-muted": "#7C9298",
      "--fv-accent": "#7DC7D2",
      "--fv-accent-strong": "#4F9DAA",
      "--fv-border": "#2D3F45",
    },
  },
  premium: {
    id: "premium",
    label: "Premium clinical",
    light: {
      "--fv-bg-app": "#F7F4EE",
      "--fv-bg-card": "#FFFDF8",
      "--fv-bg-tile": "#FFFDF8",
      "--fv-bg-soft": "#ECE5D7",
      "--fv-bg-accent-soft": "#E8DFC6",
      "--fv-text-primary": "#1A2541",
      "--fv-text-secondary": "#4E5A78",
      "--fv-text-muted": "#8B93A8",
      "--fv-accent": "#B8964F",
      "--fv-accent-strong": "#8A6E2C",
      "--fv-accent-2": "#2C3E63",
      "--fv-accent-warm": "#D4AF6A",
      "--fv-danger": "#B85450",
      "--fv-success": "#6A8E5C",
      "--fv-border": "#DCD3BD",
    },
    dark: {
      "--fv-bg-app": "#161B2C",
      "--fv-bg-card": "#1F2540",
      "--fv-bg-tile": "#1F2540",
      "--fv-bg-soft": "#2A3155",
      "--fv-bg-accent-soft": "#2E3458",
      "--fv-text-primary": "#F7F2E4",
      "--fv-text-secondary": "#C5BFAF",
      "--fv-text-muted": "#8B93A8",
      "--fv-accent": "#D4AF6A",
      "--fv-accent-strong": "#B8964F",
      "--fv-border": "#3A4366",
    },
  },
  bright: {
    id: "bright",
    label: "Bright & friendly",
    light: {
      "--fv-bg-app": "#FFF8F2",
      "--fv-bg-card": "#FFFFFF",
      "--fv-bg-tile": "#FFFFFF",
      "--fv-bg-soft": "#FFEDE0",
      "--fv-bg-accent-soft": "#FFE0CC",
      "--fv-text-primary": "#3D2A18",
      "--fv-text-secondary": "#6B4F33",
      "--fv-text-muted": "#A88E74",
      "--fv-accent": "#F8A185",
      "--fv-accent-strong": "#DE7C5A",
      "--fv-accent-2": "#8BB89C",
      "--fv-accent-warm": "#F5C76E",
      "--fv-danger": "#C13434",
      "--fv-success": "#8BB89C",
      "--fv-border": "#F5D4BC",
    },
    dark: {
      "--fv-bg-app": "#221A14",
      "--fv-bg-card": "#2E241C",
      "--fv-bg-tile": "#2E241C",
      "--fv-bg-soft": "#3E2F24",
      "--fv-bg-accent-soft": "#4A3A2A",
      "--fv-text-primary": "#FCE8D8",
      "--fv-text-secondary": "#DABBA0",
      "--fv-text-muted": "#A88E74",
      "--fv-accent": "#FFB59A",
      "--fv-accent-strong": "#F8A185",
      "--fv-border": "#4A3A2E",
    },
  },
  terracotta: {
    id: "terracotta",
    label: "Sand & terracotta",
    light: {
      "--fv-bg-app": "#FAF3E8",
      "--fv-bg-card": "#FFFCF5",
      "--fv-bg-tile": "#FFFCF5",
      "--fv-bg-soft": "#EFDFC8",
      "--fv-bg-accent-soft": "#E8C9B4",
      "--fv-text-primary": "#3D2818",
      "--fv-text-secondary": "#6B4F38",
      "--fv-text-muted": "#A88D72",
      "--fv-accent": "#C0654D",
      "--fv-accent-strong": "#9B4D38",
      "--fv-accent-2": "#94885E",
      "--fv-accent-warm": "#D9A875",
      "--fv-danger": "#B85B47",
      "--fv-success": "#94A87A",
      "--fv-border": "#E0CDB0",
    },
    dark: {
      "--fv-bg-app": "#1F1612",
      "--fv-bg-card": "#2A201A",
      "--fv-bg-tile": "#2A201A",
      "--fv-bg-soft": "#3A2D24",
      "--fv-bg-accent-soft": "#4A382D",
      "--fv-text-primary": "#F2E0CC",
      "--fv-text-secondary": "#D4B594",
      "--fv-text-muted": "#A88D72",
      "--fv-accent": "#D9836A",
      "--fv-accent-strong": "#C0654D",
      "--fv-border": "#4A382E",
    },
  },
  minimal: {
    id: "minimal",
    label: "Minimal modern",
    light: {
      "--fv-bg-app": "#FAFAFA",
      "--fv-bg-card": "#FFFFFF",
      "--fv-bg-tile": "#FFFFFF",
      "--fv-bg-soft": "#F0F0F0",
      "--fv-bg-accent-soft": "#E9EEF4",
      "--fv-text-primary": "#0F0F12",
      "--fv-text-secondary": "#555560",
      "--fv-text-muted": "#9A9AA0",
      "--fv-accent": "#2563EB",
      "--fv-accent-strong": "#1D4ED8",
      "--fv-accent-2": "#6B7280",
      "--fv-accent-warm": "#F59E0B",
      "--fv-danger": "#DC2626",
      "--fv-success": "#16A34A",
      "--fv-border": "#E5E5EA",
    },
    dark: {
      "--fv-bg-app": "#0B0B0F",
      "--fv-bg-card": "#16161B",
      "--fv-bg-tile": "#16161B",
      "--fv-bg-soft": "#1F1F26",
      "--fv-bg-accent-soft": "#1A2333",
      "--fv-text-primary": "#F5F5F7",
      "--fv-text-secondary": "#B8B8C2",
      "--fv-text-muted": "#6C6C76",
      "--fv-accent": "#60A5FA",
      "--fv-accent-strong": "#3B82F6",
      "--fv-border": "#2A2A30",
    },
  },

  // ── Bonus theme pack (twelve themes). Light palettes are verbatim
  //    from the prototype; dark variants are hand-tuned here so each
  //    theme keeps its character and stays easy on the eyes in dark
  //    mode (the prototype shipped no dark blocks for these). ──
  roots: {
    id: "roots",
    label: "Roots",
    light: {
      "--fv-bg-app": "#FAF6E8",
      "--fv-bg-card": "#FFFFFF",
      "--fv-bg-tile": "#FFFFFF",
      "--fv-bg-soft": "#F1ECDB",
      "--fv-bg-accent-soft": "#DCEEEF",
      "--fv-text-primary": "#243B3C",
      "--fv-text-secondary": "#4F6566",
      "--fv-text-muted": "#8E9F9F",
      "--fv-accent": "#4FB0BB",
      "--fv-accent-strong": "#2A8E9B",
      "--fv-accent-2": "#C6A14C",
      "--fv-accent-warm": "#E5C07B",
      "--fv-danger": "#C7553F",
      "--fv-success": "#4FB0BB",
      "--fv-border": "#DDD3B8",
    },
    dark: {
      "--fv-bg-app": "#131F1E",
      "--fv-bg-card": "#1B2928",
      "--fv-bg-tile": "#1B2928",
      "--fv-bg-soft": "#24332F",
      "--fv-bg-accent-soft": "#1D3837",
      "--fv-text-primary": "#ECF0E6",
      "--fv-text-secondary": "#B2C0BA",
      "--fv-text-muted": "#7F8E89",
      "--fv-accent": "#6FC8D1",
      "--fv-accent-strong": "#4FB0BB",
      "--fv-border": "#2E3C39",
    },
  },
  gilded: {
    id: "gilded",
    label: "Gilded",
    light: {
      "--fv-bg-app": "#FFF8E8",
      "--fv-bg-card": "#FFFDF3",
      "--fv-bg-tile": "#FFFDF3",
      "--fv-bg-soft": "#F5EAC8",
      "--fv-bg-accent-soft": "#FAE6B0",
      "--fv-text-primary": "#4A3A12",
      "--fv-text-secondary": "#786339",
      "--fv-text-muted": "#A89968",
      "--fv-accent": "#D4A437",
      "--fv-accent-strong": "#A67C1F",
      "--fv-accent-2": "#E0C97A",
      "--fv-accent-warm": "#E5C07B",
      "--fv-danger": "#B85450",
      "--fv-success": "#6A8E5C",
      "--fv-border": "#E8D7A8",
    },
    dark: {
      "--fv-bg-app": "#201A0F",
      "--fv-bg-card": "#2A2316",
      "--fv-bg-tile": "#2A2316",
      "--fv-bg-soft": "#393020",
      "--fv-bg-accent-soft": "#3D3215",
      "--fv-text-primary": "#F6EFDA",
      "--fv-text-secondary": "#CABD97",
      "--fv-text-muted": "#968969",
      "--fv-accent": "#E6BD58",
      "--fv-accent-strong": "#D4A437",
      "--fv-border": "#3C3322",
    },
  },
  twilight: {
    id: "twilight",
    label: "Twilight",
    light: {
      "--fv-bg-app": "#F8F2FB",
      "--fv-bg-card": "#FFFFFF",
      "--fv-bg-tile": "#FFFFFF",
      "--fv-bg-soft": "#EDE2F4",
      "--fv-bg-accent-soft": "#DECCF0",
      "--fv-text-primary": "#3B1F58",
      "--fv-text-secondary": "#5E3E80",
      "--fv-text-muted": "#9A7CB0",
      "--fv-accent": "#7E4DAB",
      "--fv-accent-strong": "#5A2D87",
      "--fv-accent-2": "#B58AD3",
      "--fv-accent-warm": "#E5C07B",
      "--fv-danger": "#C13434",
      "--fv-success": "#6A8E5C",
      "--fv-border": "#DDC9EB",
    },
    dark: {
      "--fv-bg-app": "#1B1327",
      "--fv-bg-card": "#251B33",
      "--fv-bg-tile": "#251B33",
      "--fv-bg-soft": "#312444",
      "--fv-bg-accent-soft": "#2E2146",
      "--fv-text-primary": "#EEE5F4",
      "--fv-text-secondary": "#C2B2D1",
      "--fv-text-muted": "#8D7B9F",
      "--fv-accent": "#A87FD0",
      "--fv-accent-strong": "#7E4DAB",
      "--fv-border": "#372A49",
    },
  },
  scarlet: {
    id: "scarlet",
    label: "Scarlet",
    light: {
      "--fv-bg-app": "#FBF1F1",
      "--fv-bg-card": "#FFFFFF",
      "--fv-bg-tile": "#FFFFFF",
      "--fv-bg-soft": "#F4DDDD",
      "--fv-bg-accent-soft": "#F6CECE",
      "--fv-text-primary": "#4A1414",
      "--fv-text-secondary": "#7D3838",
      "--fv-text-muted": "#B07878",
      "--fv-accent": "#C13434",
      "--fv-accent-strong": "#951C1C",
      "--fv-accent-2": "#E89898",
      "--fv-accent-warm": "#E5C07B",
      "--fv-danger": "#C13434",
      "--fv-success": "#6A8E5C",
      "--fv-border": "#ECCFCF",
    },
    dark: {
      "--fv-bg-app": "#251314",
      "--fv-bg-card": "#311A1B",
      "--fv-bg-tile": "#311A1B",
      "--fv-bg-soft": "#422626",
      "--fv-bg-accent-soft": "#44211F",
      "--fv-text-primary": "#F4E3E3",
      "--fv-text-secondary": "#CFAAAA",
      "--fv-text-muted": "#A27878",
      "--fv-accent": "#DE6060",
      "--fv-accent-strong": "#C13434",
      "--fv-border": "#492D2D",
    },
  },
  skyline: {
    id: "skyline",
    label: "Skyline",
    light: {
      "--fv-bg-app": "#FFFBF0",
      "--fv-bg-card": "#FFFFFF",
      "--fv-bg-tile": "#FFFFFF",
      "--fv-bg-soft": "#F4ECD6",
      "--fv-bg-accent-soft": "#DCEDF6",
      "--fv-text-primary": "#2B4555",
      "--fv-text-secondary": "#587486",
      "--fv-text-muted": "#8DA8B7",
      "--fv-accent": "#5BAAD5",
      "--fv-accent-strong": "#3B82B5",
      "--fv-accent-2": "#E8D8A8",
      "--fv-accent-warm": "#E5C07B",
      "--fv-danger": "#E07A8E",
      "--fv-success": "#5BAAD5",
      "--fv-border": "#E8DDB8",
    },
    dark: {
      "--fv-bg-app": "#111D25",
      "--fv-bg-card": "#192932",
      "--fv-bg-tile": "#192932",
      "--fv-bg-soft": "#233642",
      "--fv-bg-accent-soft": "#1D3544",
      "--fv-text-primary": "#E6EFF4",
      "--fv-text-secondary": "#ADC2CE",
      "--fv-text-muted": "#7D96A5",
      "--fv-accent": "#7CC4E8",
      "--fv-accent-strong": "#5BAAD5",
      "--fv-border": "#2B3E49",
    },
  },
  eclipse: {
    id: "eclipse",
    label: "Eclipse",
    light: {
      "--fv-bg-app": "#F0F0F0",
      "--fv-bg-card": "#FFFFFF",
      "--fv-bg-tile": "#FFFFFF",
      "--fv-bg-soft": "#DCDCDC",
      "--fv-bg-accent-soft": "#E8C9C9",
      "--fv-text-primary": "#1F1F1F",
      "--fv-text-secondary": "#4A4A4A",
      "--fv-text-muted": "#888888",
      "--fv-accent": "#C8202E",
      "--fv-accent-strong": "#8E0F1B",
      "--fv-accent-2": "#2E2E2E",
      "--fv-accent-warm": "#E5C07B",
      "--fv-danger": "#C8202E",
      "--fv-success": "#5C7A4E",
      "--fv-border": "#CACACA",
    },
    dark: {
      "--fv-bg-app": "#151515",
      "--fv-bg-card": "#1E1E1E",
      "--fv-bg-tile": "#1E1E1E",
      "--fv-bg-soft": "#2B2B2B",
      "--fv-bg-accent-soft": "#382121",
      "--fv-text-primary": "#ECECEC",
      "--fv-text-secondary": "#AFAFAF",
      "--fv-text-muted": "#7D7D7D",
      "--fv-accent": "#E2454F",
      "--fv-accent-strong": "#C8202E",
      "--fv-border": "#343434",
    },
  },
  bloom: {
    id: "bloom",
    label: "Bloom",
    light: {
      "--fv-bg-app": "#FFEEF6",
      "--fv-bg-card": "#FFFFFF",
      "--fv-bg-tile": "#FFFFFF",
      "--fv-bg-soft": "#FAD6E7",
      "--fv-bg-accent-soft": "#E8D8F4",
      "--fv-text-primary": "#5A1F44",
      "--fv-text-secondary": "#8E486C",
      "--fv-text-muted": "#C28FA8",
      "--fv-accent": "#E682B0",
      "--fv-accent-strong": "#C84F8B",
      "--fv-accent-2": "#B198E0",
      "--fv-accent-warm": "#FFE08A",
      "--fv-danger": "#C13434",
      "--fv-success": "#94D5B8",
      "--fv-border": "#F4D3E2",
    },
    dark: {
      "--fv-bg-app": "#251420",
      "--fv-bg-card": "#311D2A",
      "--fv-bg-tile": "#311D2A",
      "--fv-bg-soft": "#422938",
      "--fv-bg-accent-soft": "#39243F",
      "--fv-text-primary": "#F6E4EE",
      "--fv-text-secondary": "#D2AFC2",
      "--fv-text-muted": "#9F7D91",
      "--fv-accent": "#F09FC4",
      "--fv-accent-strong": "#E682B0",
      "--fv-border": "#492E3D",
    },
  },
  mist: {
    id: "mist",
    label: "Mist",
    light: {
      "--fv-bg-app": "#F5F4F0",
      "--fv-bg-card": "#FFFFFF",
      "--fv-bg-tile": "#FFFFFF",
      "--fv-bg-soft": "#E3E1DA",
      "--fv-bg-accent-soft": "#DCDAD2",
      "--fv-text-primary": "#2A2A2A",
      "--fv-text-secondary": "#545454",
      "--fv-text-muted": "#8E8E8E",
      "--fv-accent": "#6E6E6E",
      "--fv-accent-strong": "#3F3F3F",
      "--fv-accent-2": "#BCBAB0",
      "--fv-accent-warm": "#C9A876",
      "--fv-danger": "#8E5A50",
      "--fv-success": "#7A7A7A",
      "--fv-border": "#D8D6CE",
    },
    dark: {
      "--fv-bg-app": "#1A1A18",
      "--fv-bg-card": "#242421",
      "--fv-bg-tile": "#242421",
      "--fv-bg-soft": "#32312D",
      "--fv-bg-accent-soft": "#33322E",
      "--fv-text-primary": "#ECEBE6",
      "--fv-text-secondary": "#B5B4AD",
      "--fv-text-muted": "#83827B",
      "--fv-accent": "#C9C7BD",
      "--fv-accent-strong": "#9E9C92",
      "--fv-border": "#37362F",
    },
  },
  ember: {
    id: "ember",
    label: "Ember",
    light: {
      "--fv-bg-app": "#FAF3E8",
      "--fv-bg-card": "#FFFCF6",
      "--fv-bg-tile": "#FFFCF6",
      "--fv-bg-soft": "#EDDFC4",
      "--fv-bg-accent-soft": "#F1D9B0",
      "--fv-text-primary": "#3D2811",
      "--fv-text-secondary": "#6B4B2C",
      "--fv-text-muted": "#A28966",
      "--fv-accent": "#B8723C",
      "--fv-accent-strong": "#8A4F1F",
      "--fv-accent-2": "#6A8E5C",
      "--fv-accent-warm": "#C9A876",
      "--fv-danger": "#B85450",
      "--fv-success": "#6A8E5C",
      "--fv-border": "#DBC6A6",
    },
    dark: {
      "--fv-bg-app": "#1E150B",
      "--fv-bg-card": "#291F12",
      "--fv-bg-tile": "#291F12",
      "--fv-bg-soft": "#382A1A",
      "--fv-bg-accent-soft": "#3C2B17",
      "--fv-text-primary": "#F4E6D4",
      "--fv-text-secondary": "#CAB495",
      "--fv-text-muted": "#968269",
      "--fv-accent": "#D2925C",
      "--fv-accent-strong": "#B8723C",
      "--fv-border": "#3C2E1E",
    },
  },
  midnight: {
    id: "midnight",
    label: "Midnight",
    light: {
      "--fv-bg-app": "#E8EBF5",
      "--fv-bg-card": "#FFFFFF",
      "--fv-bg-tile": "#FFFFFF",
      "--fv-bg-soft": "#CFD5EA",
      "--fv-bg-accent-soft": "#BCC4DE",
      "--fv-text-primary": "#0F1430",
      "--fv-text-secondary": "#2F3B65",
      "--fv-text-muted": "#6A739A",
      "--fv-accent": "#3142A8",
      "--fv-accent-strong": "#1A267A",
      "--fv-accent-2": "#8B7BC8",
      "--fv-accent-warm": "#E0C97A",
      "--fv-danger": "#C13434",
      "--fv-success": "#6A8E5C",
      "--fv-border": "#C2C9DE",
    },
    dark: {
      "--fv-bg-app": "#0D1126",
      "--fv-bg-card": "#151A36",
      "--fv-bg-tile": "#151A36",
      "--fv-bg-soft": "#1E254A",
      "--fv-bg-accent-soft": "#1F264D",
      "--fv-text-primary": "#E4E7F4",
      "--fv-text-secondary": "#AFB6D1",
      "--fv-text-muted": "#7D839F",
      "--fv-accent": "#7180DC",
      "--fv-accent-strong": "#4A5AC4",
      "--fv-border": "#29314F",
    },
  },
  inkwell: {
    id: "inkwell",
    label: "Inkwell",
    light: {
      "--fv-bg-app": "#EFEAE0",
      "--fv-bg-card": "#F8F2E6",
      "--fv-bg-tile": "#F8F2E6",
      "--fv-bg-soft": "#D6CDB8",
      "--fv-bg-accent-soft": "#CCC2A8",
      "--fv-text-primary": "#1F1B16",
      "--fv-text-secondary": "#3D362C",
      "--fv-text-muted": "#6B604D",
      "--fv-accent": "#2E2A24",
      "--fv-accent-strong": "#14110D",
      "--fv-accent-2": "#8C7F66",
      "--fv-accent-warm": "#B89A6E",
      "--fv-danger": "#7A4830",
      "--fv-success": "#5C5848",
      "--fv-border": "#BFB59A",
    },
    dark: {
      "--fv-bg-app": "#16140F",
      "--fv-bg-card": "#1F1D16",
      "--fv-bg-tile": "#1F1D16",
      "--fv-bg-soft": "#2C2920",
      "--fv-bg-accent-soft": "#2F2B21",
      "--fv-text-primary": "#EDE7D6",
      "--fv-text-secondary": "#BFB69D",
      "--fv-text-muted": "#8B8268",
      "--fv-accent": "#C9BD9C",
      "--fv-accent-strong": "#B89A6E",
      "--fv-border": "#343022",
    },
  },
  limelight: {
    id: "limelight",
    label: "Limelight",
    light: {
      "--fv-bg-app": "#FCF6EE",
      "--fv-bg-card": "#FFFFFF",
      "--fv-bg-tile": "#FFFFFF",
      "--fv-bg-soft": "#FDE3CA",
      "--fv-bg-accent-soft": "#D5F2E5",
      "--fv-text-primary": "#4A2818",
      "--fv-text-secondary": "#8C4F2E",
      "--fv-text-muted": "#C28E72",
      "--fv-accent": "#F08A3C",
      "--fv-accent-strong": "#D66818",
      "--fv-accent-2": "#7FCFB3",
      "--fv-accent-warm": "#FFD86E",
      "--fv-danger": "#D44A2E",
      "--fv-success": "#5FAE92",
      "--fv-border": "#F5D2B0",
    },
    dark: {
      "--fv-bg-app": "#201610",
      "--fv-bg-card": "#2B2015",
      "--fv-bg-tile": "#2B2015",
      "--fv-bg-soft": "#3B2B1D",
      "--fv-bg-accent-soft": "#283A33",
      "--fv-text-primary": "#F5E6D6",
      "--fv-text-secondary": "#CFB39B",
      "--fv-text-muted": "#9B836F",
      "--fv-accent": "#F5A468",
      "--fv-accent-strong": "#F08A3C",
      "--fv-border": "#3E2E21",
    },
  },
};

export type TextSize = "small" | "normal" | "large";
export const TEXT_SIZES: ReadonlyArray<{ id: TextSize; label: string }> = [
  { id: "small", label: "Small" },
  { id: "normal", label: "Normal" },
  { id: "large", label: "Large" },
];

export type LanguageId = "en" | "zh" | "vi" | "ar";
export const LANGUAGES: ReadonlyArray<{ id: LanguageId; label: string }> = [
  { id: "en", label: "English" },
  { id: "zh", label: "Mandarin" },
  { id: "vi", label: "Vietnamese" },
  { id: "ar", label: "Arabic" },
];

// A visible theme — one of the five shown without unlocking.
export function isValidTheme(id: unknown): id is ThemeId {
  return typeof id === "string" && THEME_IDS.includes(id as ThemeId);
}

// A bonus-pack theme.
export function isBonusTheme(id: unknown): id is ThemeId {
  return typeof id === "string" && BONUS_THEME_IDS.includes(id as ThemeId);
}

// Any renderable theme — visible or bonus. ('random' is a meta-option,
// not a renderable [data-theme] value, so it is deliberately excluded.)
export function isAnyTheme(id: unknown): id is ThemeId {
  return typeof id === "string" && ALL_THEME_IDS.includes(id as ThemeId);
}

// Picks a random bonus theme. rng is injectable for deterministic tests.
export function pickRandomBonusTheme(
  rng: () => number = Math.random
): ThemeId {
  const index = Math.floor(rng() * BONUS_THEME_IDS.length);
  return BONUS_THEME_IDS[Math.min(index, BONUS_THEME_IDS.length - 1)]!;
}

export type ResolvedTheme = { theme: ThemeId; dark: boolean };

// Resolves a (possibly missing/invalid) preference row to a concrete
// renderable theme. No preferences ⇒ Calm medical, light mode. The
// 'random' meta-option resolves to a random bonus theme (rng injectable).
export function resolveThemePreference(
  prefs: { theme?: unknown; dark_mode?: unknown } | null | undefined,
  rng: () => number = Math.random
): ResolvedTheme {
  if (!prefs) return { theme: DEFAULT_THEME, dark: false };
  let theme = prefs.theme;
  if (theme === "random") theme = pickRandomBonusTheme(rng);
  return {
    theme: isAnyTheme(theme) ? theme : DEFAULT_THEME,
    dark: prefs.dark_mode === true,
  };
}

// Click-counter logic for the Easter-egg unlock: keeps only clicks
// within the rolling window, and reports unlock at the threshold.
export function evaluateUnlockClicks(
  priorClicks: ReadonlyArray<number>,
  now: number
): { clicks: number[]; unlocked: boolean } {
  const recent = [...priorClicks, now].filter(
    (t) => now - t < BONUS_UNLOCK_WINDOW_MS
  );
  return { clicks: recent, unlocked: recent.length >= BONUS_UNLOCK_CLICKS };
}

// The sparkle overlay shows only when the patient enabled it AND has
// not turned on reduce-motion (accessibility wins over decoration).
export function shouldShowSparkle(
  sparkleEnabled: boolean,
  reduceMotion: boolean
): boolean {
  return sparkleEnabled && !reduceMotion;
}

// A small set of preview colours for the theme picker swatches.
export function themeSwatch(id: ThemeId): {
  bg: string;
  accent: string;
  text: string;
} {
  const t = THEMES[id];
  return {
    bg: t.light["--fv-bg-app"]!,
    accent: t.light["--fv-accent"]!,
    text: t.light["--fv-text-primary"]!,
  };
}

// Generates the CSS for every theme (visible + bonus): a [data-theme="X"]
// rule with the full light palette, plus a [data-theme="X"][data-dark]
// rule when the theme has dark overrides. Bonus themes are light-only, so
// they emit no dark rule. Injected as a <style> tag by the layouts.
export function buildThemeCss(): string {
  const blocks: string[] = [];
  for (const id of ALL_THEME_IDS) {
    const theme = THEMES[id];
    const light = Object.entries(theme.light)
      .map(([k, v]) => `${k}:${v};`)
      .join("");
    blocks.push(`[data-theme="${id}"]{${light}}`);
    const darkEntries = Object.entries(theme.dark);
    if (darkEntries.length > 0) {
      const dark = darkEntries.map(([k, v]) => `${k}:${v};`).join("");
      blocks.push(`[data-theme="${id}"][data-dark]{${dark}}`);
    }
  }
  return blocks.join("\n");
}
