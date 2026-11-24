---
name: wachcha-ui
description: >-
  Owns Wachcha's Preact 10 + @preact/signals frontend UI: dark obsidian-violet design tokens
  synced with Figma, Kodi-style media-center navigation, VirtualGrid focus pinning, ChoiceTabs
  instant response, CachedImage FIFO queue, View Transitions, D-pad/TV navigation, and EN/RU/TR i18n.
---

# Wachcha Frontend & Media-Center UI

## Engineering Standards

- **Framework**: Preact 10 + `@preact/signals` + TypeScript (`strict: true`, `~/` path alias). Keep initial gzip JS lean (~100 KB); lazy-load Shaka Player and heavy overlays on demand.
- **CSS Architecture**: Pure modular CSS (`styles.css`, `media-center.css`, `desktop.css`, `mobile.css`, `tv.css`, `scrollbars.css`) using custom properties synced with Figma (`01 · Design System`). No Tailwind or runtime CSS-in-JS overhead.
- **Ergonomics**:
  - Desktop: Persistent 236px glass navigation rail + frameless 44px drag-bar window chrome + single `.media-scroll` container.
  - Mobile: Single scroll viewport, full-screen bottom `Sheet`, bottom tab bar.
  - 10-Foot TV (`data-tv="true"`): Scaled typography, glowing 3px violet focus rings, spatial arrow/D-pad navigation (`directional-navigation.ts`).
- **Accessibility & Localization**: Keyboard-navigable controls, Escape closes drawers/sheets and restores focus, `prefers-reduced-motion` disables transitions, and every visible string comes from `t(key)` with EN/RU/TR parity.

## References

- [Design Tokens & Obsidian-Violet Palette](./references/design-tokens.md)
- [Navigation, View Transitions & TV Ergonomics](./references/navigation-and-tv.md)
- [VirtualGrid & CachedImage Queue](./references/virtualization-and-images.md)
- [Multilingual i18n (EN / RU / TR)](./references/i18n.md)
