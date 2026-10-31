---
name: zimanyar-ui
description: Build or change Zimanyar interface code (packages/ui, packages/editor, apps/web, apps/extension, apps/desktop) with the shadcn and ui-ux-pro-max skills, the design tokens, RTL and accessibility rules, and the screenshot rule. Use before any UI work.
---

# Zimanyar UI

## Before building

1. Use the **shadcn** skill. Every UI workspace has its own `components.json` (Tailwind v4,
   CSS variables, radix base, lucide icons), which is where the skill activates. Add components
   with the shadcn CLI; do not hand-copy them.
2. Use the **ui-ux-pro-max** skill to choose patterns before building a new screen, and record
   design decisions in `assets/brand/design.md`.

## Design direction

- Calm, literate, trustworthy: a tool for writing and learning. Generous whitespace, 60 to 75
  character lines, large Kurdish type.
- Palette: sun gold `#FEBD11` for primary accents and focus, deep green `#1F7A3E` for success,
  red `#D7263D` only for errors, neutral ink and paper otherwise. Dark theme, same semantics.
  Every pair meets WCAG 2.2 AA (4.5:1 text, 3:1 UI).
- Underlines: error red wavy, warning amber dotted, hint blue dashed, spelling red straight.
  Never colour alone.
- Fonts are bundled: Vazirmatn (Arabic script), IBM Plex Sans (Latin and UI), a monospace with
  IPA glyphs. No web font requests.
- Motion under 200 ms; respect `prefers-reduced-motion`.

## Rules

- Every string goes through `t()` with entries in `en`, `ckb` and `kmr`.
- Logical CSS only (`ms-`, `me-`, `start`, `end`); set `dir` on the root and on Kurdish spans.
- No `innerHTML` or `dangerouslySetInnerHTML`; text nodes only.
- Keyboard: every action reachable; finding card `Enter` apply, `Esc` close, `Tab` cycle.
- Responsive from 320 px; popup 380 x 600; side panel 360 to 480 px.
- axe: zero serious or critical violations in both themes and in RTL.

## Screenshot rule

Verify with Playwright (`make screenshots`), never in the user's own browser profile. When a
change alters anything a screenshot shows, regenerate, look at every changed image and commit
the images with the change.
