#!/usr/bin/env node
// Writes every logo variant into assets/brand/ from one geometry definition.
//
// Concept: the Kurdish sun under the crown. The crown (taj) is a deq sign, the
// traditional Kurdish tattoo, standing for leadership and truthfulness; under it
// shines Roj, the 21-ray sun of the flag of Kurdistan, in place of the crown's
// dot. The crown's left foot is a check mark: correct, truthful Kurdish.
// The story and sources are in docs/STORY.md.
//
//   node scripts/brand/make-logo.mjs        (or: make logo)

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "assets", "brand");

export const COLOURS = {
  paper: "#F8F8F8",
  rim: "#1E1E1E",
  deq: "#1D4A2E", // deep green of deq ink
  sun: "#FEBD11", // gold of the Roj emblem
};

// Roj emblem, Wikimedia Commons File:Roj_emblem.svg (public domain): 21 rays in 1000 x 1000.
const ROJ =
  "M500 0l36.76 258.27L647.78 22.34 607 280 782.46 87.37 667.73 321.53 892.01 189.3 713.57 379.16l253.17-60.05-226.32 128.67L1000 465.23 745.92 521.3l242.91 93.4-259.27-21.53L934.23 754.2 692.8 657l148.24 214.4-202.12-164.26 78.63 248.7-144.86-216.71 2.04 260.88L500 750.1 425.27 1000l2.04-260.88-144.86 216.7 78.63-248.69L158.96 871.4 307.2 657 65.77 754.21l204.67-161.05-259.27 21.53 242.91-93.4L0 465.23l259.58-17.45L33.26 319.1l253.17 60.05L108 189.3l224.28 132.22L217.55 87.37 393 280 352.2 22.34l111.05 235.93z";

// The crown, traced from the deq sign and made symmetric. Glyph units, centre x = 225.
const CROWN = {
  left: [[30, 262], [100, 300], [260, 40]], // foot and long stroke: the check
  right: [[420, 262], [350, 300], [190, 40]],
  tickL: [[95, 138], [170, 186]],
  tickR: [[355, 138], [280, 186]],
  dot: [225, 255], // where the sun sits
};

/**
 * The artwork in a 1024 x 1024 coordinate system.
 * detail: "full" or "small" (heavier strokes and a larger sun for 16 to 64 px).
 * mono: one colour for everything (symbolic icons).
 */
function art({ detail = "full", mono = null } = {}) {
  const small = detail === "small";
  const c = (name) => mono ?? COLOURS[name];
  const s = 1.6;
  const top = 220;
  const sw = small ? 52 : 38;
  const P = ([x, y]) => `${(512 + (x - 225) * s).toFixed(1)},${(top + y * s).toFixed(1)}`;
  const line = (pts) => `M${pts.map(P).join(" L")}`;
  // The small sun sits a little lower, where the crown is wider, to clear the heavier strokes.
  const [sx, sy] = P(small ? [225, 266] : CROWN.dot).split(",").map(Number);
  const r = small ? 106 : 112;
  return `
  <g fill="none" stroke="${c("deq")}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">
    <path d="${line(CROWN.right)}"/>
    <path d="${line(CROWN.left)}"/>
    <path d="${line(CROWN.tickL)}"/>
    <path d="${line(CROWN.tickR)}"/>
  </g>
  <path fill="${c("sun")}" transform="translate(${sx - r} ${sy - r}) scale(${(2 * r) / 1000})" d="${ROJ}"/>`;
}

const svg = (body, { viewBox = "0 0 1024 1024", title = "Zimanyar" } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="${viewBox}">
  <title>${title}</title>${body}
</svg>
`;

const disc = (rimWidth) =>
  `
  <circle cx="512" cy="512" r="490" fill="${COLOURS.paper}" stroke="${COLOURS.rim}" stroke-width="${rimWidth}"/>`;

// The artwork without the disc spans x 171..853, y 255..729; this square crops it tightly.
const ART_SQUARE = "152 132 720 720";

const variants = {
  // Master: app icon, store icon, README, website.
  "logo.svg": svg(disc(4) + art()),
  // 32 to 64 px: heavier strokes, larger sun.
  "logo-small.svg": svg(disc(8) + art({ detail: "small" })),
  // 16 to 32 px and favicons: no disc, the artwork fills the square.
  "logo-favicon.svg": svg(art({ detail: "small" }), { viewBox: ART_SQUARE }),
  // Monochrome for symbolic contexts (toolbar in dark themes, Safari pinned tab, GNOME symbolic).
  "logo-symbolic.svg": svg(art({ detail: "small", mono: COLOURS.rim }), { viewBox: ART_SQUARE }),
  // Android/PWA maskable: full-bleed paper, artwork inside the 80 % safe zone.
  "logo-maskable.svg": svg(
    `
  <rect width="1024" height="1024" fill="${COLOURS.paper}"/>
  <g transform="translate(51 51) scale(0.9)">${art()}
  </g>`,
  ),
};

/** Horizontal lockup: logo, Latin name, Sorani name. Text is turned into paths by render-icons.sh. */
function wordmark(theme) {
  const fg = theme === "dark" ? "#F7F3E8" : "#141414";
  const sub = theme === "dark" ? "#C9C4B6" : "#5A5A5A";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1640" height="512" viewBox="0 0 1640 512">
  <title>Zimanyar</title>
  <g transform="translate(16 16) scale(0.46875)">${disc(4)}${art()}
  </g>
  <text x="548" y="232" font-family="IBM Plex Sans" font-weight="600" font-size="190" fill="${fg}">Zimanyar</text>
  <text x="556" y="358" font-family="Vazirmatn" font-weight="600" font-size="104" fill="${fg}" direction="rtl" text-anchor="end">زمانیار</text>
  <text x="556" y="452" font-family="IBM Plex Sans" font-size="54" fill="${sub}">Kurdish writing assistant · Sorani · Kurmanji</text>
</svg>
`;
}

/** The crown deq sign alone, as drawn in the logo, for docs/STORY.md. */
function crownSign() {
  const P = ([x, y]) => `${x},${y}`;
  const line = (pts) => `M${pts.map(P).join(" L")}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="450" height="340" viewBox="0 0 450 340">
  <title>Taj, the crown deq sign</title>
  <g fill="none" stroke="${COLOURS.deq}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round">
    <path d="${line(CROWN.right)}"/><path d="${line(CROWN.left)}"/><path d="${line(CROWN.tickL)}"/><path d="${line(CROWN.tickR)}"/>
  </g>
  <circle cx="${CROWN.dot[0]}" cy="${CROWN.dot[1]}" r="13" fill="${COLOURS.deq}"/>
</svg>
`;
}

mkdirSync(join(OUT, "src"), { recursive: true });
for (const [name, content] of Object.entries(variants)) writeFileSync(join(OUT, name), content);
for (const theme of ["light", "dark"]) writeFileSync(join(OUT, "src", `wordmark-${theme}.svg`), wordmark(theme));
mkdirSync(join(ROOT, "docs", "images", "story"), { recursive: true });
writeFileSync(join(ROOT, "docs", "images", "story", "deq-crown.svg"), crownSign());
console.log(`wrote ${Object.keys(variants).length} logo variants, 2 wordmark sources and the crown sign`);
