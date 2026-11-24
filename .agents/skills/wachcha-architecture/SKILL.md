---
name: wachcha-architecture
description: >-
  Owns Wachcha's Tauri v2 + Rust + Preact architecture: IPC contracts, custom async
  wachcha-media:// URI scheme, security allowlists, mirror failover, IndexedDB SWR LRU cache,
  atomic session vault, proxy pool, and platform overlay configs.
---

# Wachcha Architecture

## Core Principles

1. **In-Process Rust Backend**: No sidecar Node server, no public HTTP listener. Desktop, mobile, and TV packages bundle static frontend assets (`dist/`) served directly by Tauri with Rust handling all network I/O, media rewriting, and persistence.
2. **Opaque Media Transport**: Header-gated HLS/DASH/MP4 resources are registered in Rust (`src-tauri/src/media.rs`) and returned to the frontend strictly as opaque tokens (`<provider>/<session_hex>/<resource_hex>`). The frontend maps these to `wachcha-media://localhost/...` (or `http://wachcha-media.localhost/...` on Windows WebView2).
3. **Graceful Browser Fallback**: `src/lib/desktop.ts` detects `window.__TAURI_INTERNALS__`. Inside Tauri, calls invoke Rust IPC; in `npm run dev:web` browser mode, CORS-open providers (AniLiberty, TVMaze, TMDB, Shikimori, Stremio addons) remain directly testable.
4. **SWR Cache Everywhere**: Catalog shelves, search results, details, and posters render immediately from synchronous RAM/IndexedDB `peek()` while revalidating silently in the background.

## References

- [IPC & Custom Media Protocol](./references/ipc-and-protocol.md)
- [IndexedDB SWR & Image Cache](./references/caching-and-swr.md)
- [Security & Compliance Invariants](./references/security-invariants.md)
