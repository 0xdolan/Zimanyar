# Design decisions

The interface's tokens live in [`packages/config/tokens.ts`](../../packages/config/tokens.ts). `make tokens` writes `packages/config/tokens.css` from them (Tailwind v4 `@theme` and the shadcn variable names), and `make check-contrast` holds every colour pair to WCAG 2.2 AA in both themes.

## Direction

Calm, literate, trustworthy: a tool for writing and learning, not a dashboard. Minimalism in the Swiss tradition: spacious, grid-based, clear type hierarchy, almost no decoration. This is the ui-ux-pro-max recommendation for a writing and education tool (variance 2, motion 2, density 3).

The same search also recommended a navy and green palette and Lora with Raleway from Google Fonts. Both were rejected: the palette comes from the flag of Kurdistan and the logo, Lora and Raleway have no Arabic script, and fonts are bundled so that no request ever leaves the device.

## Colour

| role | light | dark | use |
| --- | --- | --- | --- |
| primary | `#FEBD11` | `#FEBD11` | the sun's gold: primary buttons, with ink text |
| ring | `#8A6100` | `#FEBD11` | keyboard focus |
| success | `#1F7A3E` | `#4CC27A` | "applied", correct forms |
| destructive | `#D7263D` | `#FF7A85` | errors only |
| warning | `#8F5B00` | `#F0B429` | warning findings |
| hint | `#1D5FBF` | `#7DB0FF` | hint findings |
| foreground | `#1A1D1B` | `#F3F3EF` | ink |
| background | `#FAFAF7` | `#141816` | paper |

Decisions the contrast check forced:

- **Gold is never text on paper, and never a boundary.** `#FEBD11` on paper is about 1.6:1. Gold fills carry ink text (about 10:1). The focus ring is a darker gold in the light theme, because gold on paper fails the 3:1 that a focus ring needs.
- **Red and green are lighter in dark.** `#D7263D` and `#1F7A3E` fail 4.5:1 as text on a dark ground, so the dark theme has its own values with the same meaning, and fills there carry ink text instead of white.
- **Amber is brown in light.** Readable amber on paper is `#8F5B00`; a brighter amber fails.
- **The soft error tint is very pale** (`#FEF4F5`), because `#D7263D` reaches only 4.96:1 even on white.
- **`border` is decorative** and does not have to reach 3:1. Anything that must be seen to be used, such as a text field's edge, uses `input`, which does.

A pair that is not in `contrastPairs` is not to be used. To use a new one, add it there first.

## Underlines

The shape differs as well as the colour, so colour never carries the meaning alone, and the finding card names the category in words.

| severity | colour | shape |
| --- | --- | --- |
| error | destructive | wavy |
| spelling | destructive | straight |
| warning | warning | dotted |
| hint | hint | dashed |

## Type

| use | font | why |
| --- | --- | --- |
| Arabic-script Kurdish | Vazirmatn | has ڕ ڵ ێ ۆ ڤ |
| Latin and interface | IBM Plex Sans | has ê î û ş ç; same family as the wordmark |
| code and IPA | DejaVu Sans Mono | wide IPA coverage |

Arabic script reads smaller than Latin at the same size and needs room for its marks, so Kurdish in Arabic script is set 1.125 times larger with line height 1.9 against 1.6 for Latin. Running text is limited to 68 characters a line.

## Motion

120 ms and 180 ms, under the 200 ms limit, with a standard easing. Both durations become 0 under `prefers-reduced-motion`, so anything built on the tokens obeys it without extra code.

## Direction of text

The tokens use no physical properties. Interface code uses logical ones only (`ms-`, `me-`, `start`, `end`).

## The marketing images

`scripts/marketing/style.css` has its own colours: the images are posters on a dark ground in the Roj marketing style, not interface. When the store screenshots become real screenshots of the apps, they show these tokens.
