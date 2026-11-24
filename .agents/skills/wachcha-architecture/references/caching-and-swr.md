# IndexedDB SWR Cache & Image Queue (`src/lib/cache-store.ts`, `src/lib/image-cache.ts`)

## Stale-While-Revalidate Data Cache

- Dual-tier: synchronous RAM `Map` hydrated from IndexedDB (`wachcha-cache-v1`) before first Preact render, with graceful `localStorage` fallback in restricted environments.
- LRU caps: **512 entries / 16 MiB** for JSON metadata; **512 images / 128 MiB** for image bytes.
- Never cache sensitive tokens, passwords, or short-lived signed stream URLs in the persistent cache.
- Simultaneous identical fetches deduplicate on an in-flight `Promise` map; navigating away from one screen does not abort an update needed by another.
- Network failures keep stale cached data visible without jarring layout-shifting error banners; explicit HTTP 401/403/404 evicts the entry.

## Image Cache & FIFO Queue

- Store image blobs in IndexedDB as `{ buffer: ArrayBuffer, mime: string, size: number, ts: number }` (WebKit-safe: avoids IndexedDB `Blob` serialization issues).
- On revalidation, compare byte equality before swapping `URL.createObjectURL(...)` to avoid image flicker.
- Request images lazily via `IntersectionObserver` with `rootMargin: '160px'`; hidden retained screens never queue fetches.
- Concurrency limits: **max 6 active image requests**, of which **at most 2** may be background revalidations of already-cached images. Cancel unstarted queued tasks when components unmount.
- Inside Tauri, fetch posters via `fetch_image` IPC to avoid WebView CORS errors while keeping CDN allowlists enforced in Rust.
