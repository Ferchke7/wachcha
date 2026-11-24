# Wachcha Architecture

## Zero-Server Native Design

Wachcha runs as a self-contained **Tauri v2** application on Windows, macOS, Linux, Android, and Android TV, while preserving a fast Vite browser preview (`npm run dev:web`) for UI development.

- **No bundled Node.js / Vite / open HTTP port**: All upstream catalog requests, stream resolution, HLS manifest rewriting, image fetching, and local session persistence happen in-process inside Rust (`src-tauri/`).
- **Custom Async Media Protocol (`wachcha-media://`)**: Streams that require specific upstream `Referer`, `Origin`, or provider session headers are registered inside Rust memory with random 128-bit hex session and resource IDs (`wachcha-media://localhost/<provider>/<session>/<resource>`). Upstream headers and CDN links never touch the WebView.
- **Strict Security Bounds**:
  - HTTPS CDN host allowlists per provider.
  - Redirects disabled (`Policy::none()`) on CDN/media fetches.
  - Response size caps: 512 KB playlists, 32 MB segments, 8 MB Range slice cap.
  - Concurrency cap: max 4 concurrent media fetches (`tokio::sync::Semaphore`).
  - Session lifecycle: max 8 active sessions, 3-minute idle timeout, 45-minute hard TTL.
- **Hybrid Video Playback**:
  - Native **`libmpv`** via dynamic loading (`libloading`) + GLSL upscalers (`Anime4K`, `FSR`, `FSRCNNX`) + loopback-only random-key `hyper` relay bound strictly to `127.0.0.1:0` (`Semaphore(16)`, 5s header timeout).
  - Lazy-loaded **Shaka Player** (dynamic `import()`) with `inaccurateManifestTolerance: 2`, `availabilityWindowOverride: Infinity`, and dual-layer muted preloading for flicker-free quality switching.
- **Stale-While-Revalidate Caching**:
  - RAM + IndexedDB LRU (`512` metadata entries / `16 MiB`; `512` images / `128 MiB` stored as `ArrayBuffer + MIME` for WebKit compatibility).
  - FIFO 6-slot image fetch queue (`IntersectionObserver`, 160px preload margin, max 2 background revalidations).
