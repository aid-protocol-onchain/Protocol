# Aid Protocol — Design System

> Derived from the brand sheet (`app/src/assets/brand-sheet.png`). Source of truth for the product's visual identity. Applied live in `app/src/styles.css`.

## Brand essence

- **Mark:** a *lifeline / heartbeat* pulse that rises into an **"A"**, with connection **nodes** (dots) at the endpoints — heartbeat (saving lives) + connection (people/resources) + the letter A.
- **Tagline:** *Lifeline for humanity. Powered by crypto.*
- **Value pillars:** Transparent · Secure · Global · Human · Decentralized.
- **Feel:** clean, modern, optimistic, technical-but-human. Light surfaces with a dark "signal" hero; the gradient is the signature.

## Logo

- Vector mark: `app/src/assets/logo.svg` (also a React `<Mark>` in `app/src/components/Layout.tsx`).
- Pulse stroke uses the brand gradient; nodes are solid blue / teal / green.
- Wordmark: **AID** bold + **PROTOCOL** light, letter-spaced, sentence/caps per sheet.
- Clear space ≥ the mark's node diameter; min mark height 20px. Never recolor the gradient or add effects.

## Color tokens

| Token | Hex | Use |
| --- | --- | --- |
| `--brand` | `#1f8bf0` | Primary blue — actions, links, focus |
| `--brand-deep` | `#1268c9` | Hover/pressed |
| `--brand-bg` | `#e8f3fe` | Light blue tint (selected, avatars) |
| `--teal` | `#15bfb4` | Mid brand — pillars, accents |
| `--green` | `#2fcf86` | Brand tail / energy |
| `--grad` | `linear-gradient(90deg,#1f8bf0,#15bfb4,#2fcf86)` | **Signature** — progress, hero underline, key text |
| `--trust` | `#129e6e` | Verified / success |
| `--danger` | `#c2410c` | Emergency / alerts |
| `--ink` / `--ink-soft` / `--ink-faint` | `#0e1726` / `#5b6675` / `#97a1b0` | Text scale (cool navy) |
| `--page` / `--card` | `#f6f9fc` / `#ffffff` | Surfaces |
| `--line` / `--line-strong` | `#e7edf3` / `#d5dee7` | Hairlines |
| Hero dark | `#0b1320` | Hero + card bands (the "signal" surface) |

**Chain accents:** Solana `#5b3fd6` / Base·Ethereum `#1268c9` (on light tints).

## Gradient usage

The blue→teal→green gradient is the brand's signature — reserve it for meaning, not decoration: progress bars (funds flowing), the hero accent line + headline highlight (`.grad-text`), and card band underlines. Don't gradient-fill large areas or body text.

## Typography

- System sans stack (swap to a geometric sans like *Inter/Sora* when we add a font).
- Weights: 400 / 500 / 600 (700 for the wordmark only).
- Headlines tight (`-0.01em`); sentence case in UI copy.

## Components (live)

Nav (logo + wordmark) · dark hero with gradient accent · campaign cards (dark band + gradient progress) · metric cards · proof-of-spend rows (AI-verified green pill) · on-chain ledger rows (chain pills, anon/public) · donate panel (chain segmented control, amount, anonymity toggle, primary CTA) · value-pillar strip.

## Applied

Live at `https://dev.aidprotocol.org`. Tokens in `app/src/styles.css`; logo in `app/src/components/Layout.tsx` + `app/src/assets/logo.svg`.
