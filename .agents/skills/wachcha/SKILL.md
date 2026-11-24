---
name: wachcha
description: >-
  Entry-point skill for all Wachcha development tasks: adding providers, building or updating
  screens, editing the Rust Tauri media engine or player, fixing bugs, auditing code, or running
  verification. Routes directly to the exact topic skills and reference files needed.
---

# Wachcha Engineering Router

## Every Task

- Read only the skills and reference files routed below; open additional references only if a check fails or a file explicitly points there.
- Respect all security & open-source compliance invariants in `AGENTS.md` (zero public server, strict HTTPS CDN allowlists, no DRM/CAPTCHA bypass, EN/RU/TR i18n parity).
- Never claim completion until every verification check for the touched areas passes with exit code 0.

## Step 1: Identify Task Kind

- **Add a new catalog or stream provider** → load `../wachcha-add-provider/SKILL.md` + `../wachcha-providers/SKILL.md`.
- **Add or redesign a screen / UI view** → load `../wachcha-add-screen/SKILL.md` + `../wachcha-ui/SKILL.md`.
- **Modify video playback, Shaka, libmpv, shaders, or skip markers** → load `../wachcha-player/SKILL.md` + `../wachcha-architecture/SKILL.md`.
- **Modify Tauri IPC, `wachcha-media://` protocol, caching, proxy pool, or packaging** → load `../wachcha-architecture/SKILL.md`.
- **Write tests, stdio probes, CI workflows, or audit release readiness** → load `../wachcha-testing/SKILL.md` + `../wachcha-verify/SKILL.md`.
- **Bug fix** → reproduce with a failing Vitest or `cargo test` test first, load the owning area skill below, make the minimal fix, and re-run the full gate.

## Step 2: Area Routing Map

| Area                                | Primary Skill                      | Focused Reference                                             |
| ----------------------------------- | ---------------------------------- | ------------------------------------------------------------- |
| Tauri IPC & `wachcha-media://`      | `../wachcha-architecture/SKILL.md` | `../wachcha-architecture/references/ipc-and-protocol.md`      |
| IndexedDB SWR & Image Cache         | `../wachcha-architecture/SKILL.md` | `../wachcha-architecture/references/caching-and-swr.md`       |
| Security & Allowlists               | `../wachcha-architecture/SKILL.md` | `../wachcha-architecture/references/security-invariants.md`   |
| Provider Traits & Deduplication     | `../wachcha-providers/SKILL.md`    | `../wachcha-providers/references/provider-contract.md`        |
| Anime / Russian / Turkish Verticals | `../wachcha-providers/SKILL.md`    | `../wachcha-providers/references/vertical-mapping.md`         |
| Stremio Addon v3 & M3U8             | `../wachcha-providers/SKILL.md`    | `../wachcha-providers/references/stremio-and-m3u8.md`         |
| Shaka Player 5 & Dual-Layer Switch  | `../wachcha-player/SKILL.md`       | `../wachcha-player/references/shaka-and-dual-layer.md`        |
| Native `libmpv`, Relay & Shaders    | `../wachcha-player/SKILL.md`       | `../wachcha-player/references/libmpv-and-shaders.md`          |
| Playback Events & Auto-Skip         | `../wachcha-player/SKILL.md`       | `../wachcha-player/references/playback-events-and-skips.md`   |
| Design Tokens & Layered CSS         | `../wachcha-ui/SKILL.md`           | `../wachcha-ui/references/design-tokens.md`                   |
| Routing, View Transitions & TV Nav  | `../wachcha-ui/SKILL.md`           | `../wachcha-ui/references/navigation-and-tv.md`               |
| `VirtualGrid` & `CachedImage`       | `../wachcha-ui/SKILL.md`           | `../wachcha-ui/references/virtualization-and-images.md`       |
| Multilingual i18n (EN/RU/TR)        | `../wachcha-ui/SKILL.md`           | `../wachcha-ui/references/i18n.md`                            |
| Stdio `media_probe` & Playwright    | `../wachcha-testing/SKILL.md`      | `../wachcha-testing/references/media-probe-and-playwright.md` |
| Multi-Platform Packaging & CI       | `../wachcha-testing/SKILL.md`      | `../wachcha-testing/references/release-and-packaging.md`      |
