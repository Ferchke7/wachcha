---
name: wachcha-add-provider
description: >-
  Step-by-step workflow to add a new catalog or stream provider to Wachcha across Rust backend,
  media allowlists, TypeScript types, Sources UI, EN/RU/TR locales, and offline fixture tests.
  Invoke via /wachcha-add-provider.
---

# Add a New Wachcha Provider

Follow these steps in order:

1. **Compliance Check**: Confirm the source uses a public/documented API, official free channel, or user-authorized token — no DRM bypass, paywall circumvention, or CAPTCHA solving.
2. **Load Context**: Read `.agents/skills/wachcha-providers/SKILL.md` and `references/provider-contract.md`.
3. **Implement Rust Provider**:
   - Create `src-tauri/src/providers/<slug>.rs`.
   - Implement catalog search / detail / stream resolution mapping into canonical `MediaItem`, `ExternalIds`, `MediaDetail`, and `ResolvedStream`.
   - Declare explicit HTTPS host allowlists in `media.rs` / `images.rs` if the provider requires relayed media or poster fetching.
   - Register the provider in `src-tauri/src/providers/mod.rs` and `src-tauri/src/backend.rs`.
4. **Wire Frontend & Localization**:
   - Add provider metadata display strings in `src/locales/{en,ru,tr}.ts`.
   - Add optional browser preview fallback in `src/lib/desktop.ts` if CORS allows.
   - Ensure `Sources.tsx` surfaces enable/disable toggle, optional API key input (if needed), and health indicator.
5. **Write Offline Fixture Tests**:
   - Add deterministic `#[cfg(test)]` parsing, edge-case, and security allowlist tests in `<slug>.rs`.
   - Add an `#[ignore]` live smoke test if the API is keyless.
6. **Verify**: Run `/wachcha-verify` (`npm run format:check`, `npm test`, `npm run build:web`, `cargo test --manifest-path src-tauri/Cargo.toml`).
