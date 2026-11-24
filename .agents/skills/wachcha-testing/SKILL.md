---
name: wachcha-testing
description: >-
  Owns Wachcha's verification and release engineering: Vitest + @testing-library/preact suites,
  offline Rust cargo test fixtures, ignored live provider tests, zero-port stdio media_probe
  harness, Playwright probes, and multi-platform GitHub Actions CI/CD.
---

# Wachcha Testing, Probes & Release Engineering

## Verification Layers

1. **Static & Style Gate**: `npm run format:check` (Prettier + `cargo fmt --check`) and `tsc -b` (strict TS + i18n key completeness).
2. **Frontend Unit & UI Tests**: `npm test` (Vitest + `@testing-library/preact` + `jsdom`). Zero external network calls.
3. **Rust Offline Tests**: `npm run test:rust` (`cargo test --manifest-path src-tauri/Cargo.toml --no-default-features --lib`) covering every provider parser, canonical ID deduplicator, HLS rewriter, CDN allowlist rejection, session TTL eviction, skip normalization, Stremio/M3U8 parsers, and atomic session vault.
4. **Zero-Port Stdio `media_probe`**: `src-tauri/examples/media_probe.rs` (`npm run probe:build && npm run check:probe`) reads newline-delimited JSON requests from `stdin` and writes JSON responses to `stdout` against the real `Backend` without opening a TCP listener. Used by Node/Playwright probes (`scripts/check-app.mjs`, `scripts/check-virtual.mjs`).
5. **Opt-In Live Transport Tests**: Marked `#[ignore]` in Rust (`cargo test --manifest-path src-tauri/Cargo.toml --no-default-features --lib live_provider_transport -- --ignored --nocapture`) for manual live verification against AniLiberty / TVMaze / Shikimori.

## References

- [Stdio `media_probe` & Playwright Probes](./references/media-probe-and-playwright.md)
- [Multi-Platform Packaging & GitHub Actions](./references/release-and-packaging.md)
