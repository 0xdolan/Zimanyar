/**
 * Design tokens: the single source of the interface's colours, type, shape and motion.
 * scripts/brand/make-tokens.ts writes tokens.css from this file for Tailwind v4 and shadcn,
 * and scripts/checks/check-contrast.ts holds every pair below to WCAG 2.2 AA.
 * The reasoning is in assets/brand/design.md.
 */

/** The colours of the logo; never themed. */
export const brand = {
  paper: "#F8F8F8",
  rim: "#1E1E1E",
  deq: "#1D4A2E",
  sun: "#FEBD11",
} as const;

const ink = "#1A1D1B";
const white = "#FFFFFF";

const light = {
  background: "#FAFAF7",
  foreground: ink,
  card: white,
  "card-foreground": ink,
  popover: white,
  "popover-foreground": ink,
  primary: brand.sun,
  "primary-foreground": ink,
  secondary: "#EFF0EB",
  "secondary-foreground": ink,
  muted: "#EFF0EB",
  "muted-foreground": "#575E59",
  accent: "#FFF3CC",
  "accent-foreground": ink,
  destructive: "#D7263D",
  "destructive-foreground": white,
  success: "#1F7A3E",
  "success-foreground": white,
  warning: "#8F5B00",
  "warning-foreground": white,
  hint: "#1D5FBF",
  "hint-foreground": white,
  "destructive-soft": "#FEF4F5",
  "success-soft": "#E7F4EC",
  "warning-soft": "#FBF1DD",
  "hint-soft": "#E8F0FB",
  border: "#DDDFD8",
  input: "#7A817C",
  ring: "#8A6100",
};

export type ColorToken = keyof typeof light;

const dark: Record<ColorToken, string> = {
  background: "#141816",
  foreground: "#F3F3EF",
  card: "#1C211E",
  "card-foreground": "#F3F3EF",
  popover: "#1C211E",
  "popover-foreground": "#F3F3EF",
  primary: brand.sun,
  "primary-foreground": ink,
  secondary: "#262C28",
  "secondary-foreground": "#F3F3EF",
  muted: "#262C28",
  "muted-foreground": "#A9B0AB",
  accent: "#3A3118",
  "accent-foreground": "#FDF3D3",
  destructive: "#FF7A85",
  "destructive-foreground": ink,
  success: "#4CC27A",
  "success-foreground": ink,
  warning: "#F0B429",
  "warning-foreground": ink,
  hint: "#7DB0FF",
  "hint-foreground": ink,
  "destructive-soft": "#3A1C20",
  "success-soft": "#18301F",
  "warning-soft": "#33290F",
  "hint-soft": "#1A2A42",
  border: "#2F3632",
  input: "#7B837D",
  ring: brand.sun,
};

export const themes = { light, dark } as const;

/** Finding underlines: shape differs as well as colour, so colour never carries it alone. */
export const underlines = {
  error: { color: "destructive", style: "wavy" },
  warning: { color: "warning", style: "dotted" },
  hint: { color: "hint", style: "dashed" },
  spelling: { color: "destructive", style: "solid" },
} as const satisfies Record<string, { color: ColorToken; style: string }>;

export const fonts = {
  latin: '"IBM Plex Sans", system-ui, sans-serif',
  arabic: '"Vazirmatn", "IBM Plex Sans Arabic", system-ui, sans-serif',
  mono: '"DejaVu Sans Mono", "Noto Sans Mono", monospace',
} as const;

export const shape = {
  radius: "0.5rem",
  /** Line length of running text: 60 to 75 characters. */
  measure: "68ch",
  /** Arabic script needs more air for its marks than Latin. */
  leadingLatin: "1.6",
  leadingArabic: "1.9",
  /** Arabic script reads smaller than Latin at the same size. */
  scaleArabic: "1.125",
} as const;

export const motion = {
  fast: "120ms",
  normal: "180ms",
  easing: "cubic-bezier(0.2, 0, 0, 1)",
} as const;

export const AA_TEXT = 4.5;
export const AA_UI = 3;

export interface ContrastPair {
  foreground: ColorToken;
  background: ColorToken;
  minimum: number;
}

const surfaces = ["background", "card", "popover"] as const;
const text = (foreground: ColorToken, background: ColorToken): ContrastPair => ({
  foreground,
  background,
  minimum: AA_TEXT,
});
const ui = (foreground: ColorToken, background: ColorToken): ContrastPair => ({
  foreground,
  background,
  minimum: AA_UI,
});

/** Every pair the interface may use; a pair not listed here is not to be used. */
export const contrastPairs: readonly ContrastPair[] = [
  ...surfaces.flatMap((surface) => [
    text("foreground", surface),
    text("muted-foreground", surface),
    text("destructive", surface),
    text("success", surface),
    text("warning", surface),
    text("hint", surface),
    ui("input", surface),
    ui("ring", surface),
  ]),
  text("card-foreground", "card"),
  text("popover-foreground", "popover"),
  text("primary-foreground", "primary"),
  text("secondary-foreground", "secondary"),
  text("muted-foreground", "muted"),
  text("foreground", "muted"),
  text("accent-foreground", "accent"),
  text("destructive-foreground", "destructive"),
  text("success-foreground", "success"),
  text("warning-foreground", "warning"),
  text("hint-foreground", "hint"),
  text("foreground", "destructive-soft"),
  text("foreground", "success-soft"),
  text("foreground", "warning-soft"),
  text("foreground", "hint-soft"),
  text("destructive", "destructive-soft"),
  text("success", "success-soft"),
  text("warning", "warning-soft"),
  text("hint", "hint-soft"),
];
