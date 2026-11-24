# Native `libmpv`, Loopback Relay & GLSL Shaders

## Dynamic `libmpv` Loading (`src-tauri/src/native_video/`)

- Desktop Windows/Linux/Android dynamically load `libmpv` (`libmpv-2.dll` / `libmpv.so.2`) via `libloading`.
- If `libmpv` is unavailable at runtime, `desktop_info()` reports `nativeMpv: false` and the frontend automatically selects Shaka Player 5 without error.
- On Windows, `scripts/prepare-windows-libmpv.mjs` validates SHA-256 checksums for bundled LGPL `libmpv-2.dll` in `src-tauri/native-libs/windows/`.

## Authenticated Loopback Relay (`src-tauri/src/native_video/relay.rs`)

- `libmpv` cannot open custom Tauri WebView schemes directly on Windows/Linux.
- When playing a `wachcha-media://` relayed stream in `libmpv`, Rust lazily binds an HTTP/1.1 `hyper` listener strictly on `127.0.0.1:0` with a random 128-bit hex path prefix (`http://127.0.0.1:<port>/<key>/<provider>/<session>/<resource>.<ext>`).
- Enforces: `Semaphore(16)` max concurrent connections, `5s` header read timeout, `keep_alive(false)`, exact key prefix verification, and reuses `media.rs` allowlists & size bounds.

## GLSL Upscaling Shader Presets

Supported presets stored in `src-tauri/src/native_video/shaders/`:

- `off`: native scaling.
- `anime4k-fast`: lightweight Anime4K CNN x2 upscaler (ideal for 720p/1080p anime).
- `fsr`: AMD FidelityFX Super Resolution GLSL pass (ideal for live-action movies & Turkish dizis).
- `fsrcnnx`: FSRCNNX x2 neural upscaler for high-end GPUs.
