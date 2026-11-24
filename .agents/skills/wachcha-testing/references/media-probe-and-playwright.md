# Stdio `media_probe` & Playwright Verification

## How `media_probe` Works (`src-tauri/examples/media_probe.rs`)

- Compiled with `cargo build --manifest-path src-tauri/Cargo.toml --example media_probe`.
- Speaks line-delimited JSON over `stdin`/`stdout` — zero open sockets, zero firewall prompts, CI-safe.
- Supported actions:
  - `{"id": 1, "action": "providers"}` → lists all registered native & addon providers.
  - `{"id": 2, "action": "search", "query": {"text": "Frieren", "locale": "ru"}}` → runs real aggregated search.
  - `{"id": 3, "action": "shelves", "locale": "en"}` → builds Home shelves.
  - `{"id": 4, "action": "detail", "provider": "aniliberty", "mediaId": "..."}` → fetches detail & episodes.
  - `{"id": 5, "action": "resolve", "candidates": [...]}` → runs staggered parallel resolver.
  - `{"id": 6, "action": "media", "uri": "wachcha-media://localhost/..."}` → exercises custom protocol handler with synthetic `Origin: tauri://localhost`.
  - `{"id": 7, "action": "health"}` → returns mirror & provider latency/health report.

## Playwright Probes (`scripts/`)

- `scripts/check-virtual.mjs`: validates rendering 10,000 cards in `VirtualGrid` with bounded DOM count and preserved keyboard focus.
- `scripts/check-app.mjs`: boots built `dist/` with stdio `media_probe` bridge to inspect desktop & mobile layouts, navigation transitions, and cache hydration.
