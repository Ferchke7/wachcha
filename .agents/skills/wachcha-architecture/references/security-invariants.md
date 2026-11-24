# Security & Open-Source Compliance Invariants

1. **Strict Origin & Host Allowlists**:
   - Every provider explicitly defines allowed HTTPS API and CDN host suffixes.
   - `reqwest` clients used for media/CDN transport MUST configure `.redirect(reqwest::redirect::Policy::none())` so an attacker cannot redirect a trusted CDN URL to an internal network or arbitrary host.
   - Reject URLs containing embedded usernames, passwords, non-standard ports (except explicit user-configured local Stremio addons over `http://127.0.0.1`), or `file://` / `javascript:` schemes.
2. **Data-Only Parsing**:
   - Remote API JSON, XML, M3U8, and HTML metadata must ONLY be parsed as inert data (`serde_json`, `quick-xml`, `regex`). Never execute remote JS, ad SDKs, or `vast` scripts.
3. **Secret Hygiene**:
   - API keys (TMDB, Kinopoisk) and user proxy credentials live in `SessionVault` (`0600` atomic write) and Rust memory only. Never include credentials in logs, crash diagnostics, `wachcha:playback` window events, or IndexedDB snapshots.
4. **Window & CSP Hardening**:
   - `tauri.conf.json` enforces `object-src 'none'`, `base-uri 'self'`, `script-src 'self'`.
   - Window-mutating IPC commands verify `window.label() == "main"`.
   - External URLs opened via `tauri-plugin-opener` allow `https://*` only.
5. **Open-Source Legal Integrity**:
   - No DRM circumvention, no paywall bypassing, no CAPTCHA/anti-bot solving.
   - First-party providers integrate documented open/public APIs and official broadcaster channels; third-party catalogs attach via the open Stremio Addon Protocol v3 or user M3U8 playlists.
