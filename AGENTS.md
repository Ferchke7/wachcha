# Wachcha — Project Engineering Rules

Wachcha is an open-source (MIT) cross-platform media center and multi-catalog streaming aggregator for **Movies, Russian & International TV Series, Turkish Dizis, Anime, Live M3U8, and Stremio Addons**.

## Architecture & Stack Contract

- **Shell & Native Runtime**: Tauri v2 (`src-tauri/`) targeting Windows, macOS, Linux, Android, and Android TV. Installed binaries bundle **no Node.js, Vite, or open public HTTP server**.
- **Backend (`src-tauri/src/`)**: Rust (Edition 2021) with `tokio`, `reqwest` (`rustls-tls`, `gzip`, `socks`), `serde`, `url`, `regex`, `quick-xml`, and loopback-only `hyper` relay for native `libmpv`.
- **Frontend (`src/`)**: Preact 10 + `@preact/signals` + TypeScript (`strict: true`, `jsxImportSource: "preact"`, alias `~/* -> src/*`) + Vite 6. Keep initial gzip bundle lean (~100 KB target); lazy-load Shaka Player via dynamic `import()`.
- **Design System**: Dark obsidian-violet cinema aesthetic synced to the Wachcha Figma file (`#090612` canvas, `#110C20` surface, `#18112D` elevated, `#7C3AED` → `#D946EF` CTA gradient, `#FBBF24` ratings, `#34D399` live status). Use modular layered CSS (`src/*.css`) with CSS custom properties — **never** add heavy CSS frameworks.
- **Localization**: Full EN / RU / TR i18n from day one (`src/lib/i18n.ts`, `src/locales/{en,ru,tr}.ts`). Every user-facing string MUST have keys in all three locales.

## Non-Negotiable Security & Compliance Invariants

1. **Zero Public Server**: Never start a public HTTP server or bind `0.0.0.0`. Media transport to the WebView uses Tauri's async custom URI scheme `wachcha-media://localhost/<provider>/<session_hex>/<resource_hex>` (intercepted as `http://wachcha-media.localhost/...` on Windows WebView2). Loopback relay for `libmpv` binds strictly to `127.0.0.1:0` with a random 128-bit session path prefix and bounded semaphore.
2. **Secrets & Headers Stay in Rust**: Upstream `Referer`, `Origin`, API keys, proxy credentials, and signed CDN URLs must stay inside Rust memory and never be logged, written into public IndexedDB caches, or sent to unverified domains.
3. **Strict Host Allowlists & No Redirects**: Every provider and media transport session validates exact HTTPS hosts/suffixes and disables automatic redirects (`reqwest::redirect::Policy::none()`) on CDN/media requests.
4. **Bounded Everything**:
   - Resolution cache: max 64 entries, 30s TTL.
   - Media relay sessions: max 8 concurrent sessions, 3m idle / 45m max lifetime.
   - Media fetch caps: 512 KB playlists, 32 MB segments, 8 MB Range chunk cap, max 4 concurrent media fetches.
   - Frontend SWR cache (IndexedDB + RAM): max 512 data entries / 16 MiB; max 512 images / 128 MiB (`ArrayBuffer` + MIME for WebKit compatibility).
5. **Open-Source Legal Boundary**: Built-in providers strictly use open, documented, public, or user-authorized APIs and free official feeds. **Never** implement DRM bypass, paywall circumvention, or CAPTCHA / anti-bot solvers. Third-party community sources attach via **Stremio Addon Protocol v3** or **M3U8 playlists**.

## UI, Playback & Provider Contracts

- **Kodi-Style Ergonomics**: Persistent sidebar navigation on desktop, bottom nav + sheets on mobile, 10-foot D-pad focus rings on TV. Single scroll container (`main.media-scroll`) with `page-scroll.ts` restoration and View Transitions (respecting `prefers-reduced-motion`).
- **Instant Feedback**: `ChoiceTabs` confirms selection immediately via state update without blocking on network calls. `VirtualGrid` skips virtualization for <= 60 items, overscans 3 rows, and pins focused elements during scroll.
- **Hybrid Playback**: Prefer native `libmpv` (with optional GLSL upscalers) on desktop/TV when available, falling back seamlessly to lazy-loaded Shaka Player 5 (HLS/DASH MSE with `inaccurateManifestTolerance: 2` and `availabilityWindowOverride: Infinity`) and native `<video>` for MP4.
- **Staggered Parallel Resolution**: Resolve stream candidates in parallel with 300 ms stagger and a 2-second priority window for the preferred source. Never fabricate lower resolutions or approximate skip timestamps when absent.
- **Canonical Deduplication**: Aggregate search results across verticals and merge duplicates via canonical `ExternalIds` (`imdb`, `tmdb`, `kinopoisk`, `shikimori`, `mal`, `aniliberty`, `tvmaze`, `rutube`) or normalized title + year.

## Formatting & Verification Gate

Before finishing any code change, run and verify all applicable checks pass with exit code 0:

1. `npm run format:check` (`prettier --check .` + `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`)
2. `npm test` (Vitest unit & Preact UI tests)
3. `npm run build:web` (`tsc -b && vite build`)
4. `npm run test:rust` (`cargo test --manifest-path src-tauri/Cargo.toml --no-default-features --lib`)
5. `npm run probe:build && npm run check:probe` (zero-port stdio `media_probe` smoke test)
6. `cargo check --manifest-path src-tauri/Cargo.toml` (full Tauri v2 desktop compilation when Rust/Tauri files changed)

## Skills & Subagents

Load the entry skill `.agents/skills/wachcha/SKILL.md` first for task routing. Delegate deep subsystem work to specialized subagents in `.agents/agents/`:

- `wachcha-rust-media`: Rust runtime, `wachcha-media://`, `libmpv`, shaders, downloads, Discord IPC.
- `wachcha-provider-engineer`: Catalog/stream providers, ID reconciliation, Stremio/M3U8, mirror failover.
- `wachcha-frontend-ui`: Preact + Signals, CSS tokens, Kodi UX, Shaka Player, SWR cache, EN/RU/TR i18n.
- `wachcha-qa-verifier`: Vitest, Rust fixtures, `media_probe` stdio harness, Playwright checks, CI/release.
