---
name: wachcha-add-screen
description: >-
  Step-by-step workflow to add a new media-center screen to Wachcha with Hash routing, View
  Transitions, scroll restoration, Kodi sidebar entry, D-pad/TV focus, EN/RU/TR i18n, and Vitest
  UI tests. Invoke via /wachcha-add-screen.
---

# Add a New Wachcha Screen

Follow these steps in order:

1. **Load Context**: Read `.agents/skills/wachcha-ui/SKILL.md`, `references/design-tokens.md`, and `references/navigation-and-tv.md`.
2. **Design Parity**: Use Wachcha CSS variables (`--color-bg-*`, `--color-accent-*`, `--radius-*`) and reusable `src/ui/` primitives (`Button`, `ChoiceTabs`, `VirtualGrid`, `CachedImage`, `SettingsCard`, `EmptyState`).
3. **Localization First**: Add all screen headings, labels, empty states, and ARIA labels to `src/locales/en.ts`, `src/locales/ru.ts`, and `src/locales/tr.ts`.
4. **Create Screen & Route**:
   - Create `src/components/<ScreenName>.tsx` using Preact functional component + `@preact/signals` / hooks.
   - Wire route and document title in `src/App.tsx` and add navigation entry in `src/components/MediaNavigation.tsx` if top-level.
   - Mark focusable cards/controls with `data-nav-item` for keyboard & TV D-pad spatial navigation.
5. **Write Vitest UI Test**:
   - Add `tests/<ScreenName>.ui.test.tsx` verifying render, interactive state, empty/error states, and EN/RU/TR rendering.
6. **Verify**: Run `npm run format:check`, `npm test`, and `npm run build:web`.
