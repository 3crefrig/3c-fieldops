# DESIGN.md — 3C FieldOps Pro visual system (v2, "dispatch ledger")

<!-- impeccable:design-schema 1 -->

Proposed 2026-09-09 on branch `feature/redesign-v2`; craft bar: Linear. Operate mode. Navigation, tab locations and control placement are unchanged from v1 by contract (PRODUCT.md, principle 5).

## World

A service log, not a card wall. Work is read as rows inside one panel; state is a small tag with a dot; one accent (brand cyan) marks what is active or a link. Depth is a hairline, never a shadow. Nothing glows.

## Tokens (`src/shared.js`)

| Role | Dark | Light |
|---|---|---|
| page `bg` | #0C0E10 | #F7F8F9 |
| panel `surface` | #141719 | #FFFFFF |
| hover/inset `surfaceActive` | #1C2024 | #EEF1F3 |
| hairline `border` | #23282D | #E1E5E9 |
| text | #EDEFF2 | #15181B |
| textMuted (labels, meta; ≥4.5:1) | #A3ABB4 | #5D6771 |
| textDim (tertiary) | #7A838D | #7E8892 |
| accent `cyan` | #4DD6F0 | #0B7F9E |
| done/approved `green` · pending `orange` · overdue/alert `red` | unchanged, semantic only |
| primary button | #EDEFF2 on #0C0E10 | #15181B on #FFFFFF |

Radii: 5 tags · 6 inputs/buttons · 8 panels/cards · 10 modals · 999 counters only. Shadows: none on cards; modals/toasts only.

## Type

- `F` = Archivo 400/500/600/700 (loaded in `public/index.html`), Inter → Barlow fallback. UI floor 13px; phone inputs 16px (iOS zoom rule).
- `M` = JetBrains Mono for IDs (WO-1541, #2422260), hours, money. Tabular numerals everywhere (`font-variant-numeric`).
- Roles: page/section title 15–18/600 · row title 14.5/600 · body 13 · meta 12 muted · label 11 uppercase 0.3 tracking muted.

## Components (`src/components/ui.jsx`)

- **Badge** = tag: 5px dot + word, 11/600, 5px radius, `color+"16"` fill. Never a pill, never an outline.
- **Card** = panel: surface, hairline, 8px, padding 16, no shadow; clickable cards change border color on hover.
- **StatCard** and any tile with `className="stat-card"` fuse into a **stat strip**: the parent paints the hairline color with a 1px gap (works for flex rows and grids). Label 11 uppercase, value 22/600 tabular.
- **List rows** use `className="list-row"` inside a bordered 8px panel: `borderBottom` hairline, hover `surfaceActive`, last row borderless. Work orders (`WOList`), Week Plan overdue/day rows follow this.
- **Icons**: inline SVG `Icon` set (1.5–2px strokes); `IconText` for meta lines; `IconButton` 34px squares in the header. No emoji as icons.
- **Navigation**: text tabs; the active tab is `text` with a 2px cyan underline; no tinted backgrounds. Phone bottom bar unchanged.
- **Inputs/buttons**: 6px radius, 42px min height, hairline; primary is near-black/white.
- **Toast**: neutral (text-on-bg inverted) with a green check.

## Rules

1. Color means state. Cyan is for links, the active tab and the brand mark; never fills, never rails.
2. One panel per list; rows, not cards. Cards are for singular things (a form, a summary).
3. Every zone is labeled with its literal name; no icon-only affordances.
4. Phones: nothing smaller or lower-contrast than these tokens; 44px targets; 7-column grids use `minmax(0,1fr)`.
5. Verify with `npx impeccable@latest detect src` (expected: only the Arial email templates and the swipe-card width transition).
