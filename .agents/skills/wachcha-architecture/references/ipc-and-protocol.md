# IPC Commands & `wachcha-media://` Custom URI Protocol

## Tauri IPC Command Surface (`src-tauri/src/lib.rs`)

- `desktop_info() -> DesktopInfo`: returns `{ platform, nativeMpv, version }`.
- `search_catalog(query: SearchQuery) -> SearchResponse`: parallel fan-out across enabled catalog providers, canonical ID deduplication, per-provider 5s timeout.
- `get_home_shelves(locale: String) -> Vec<CatalogShelf>`: builds localized Home shelves (Trending Anime, Popular Turkish Dizis, Free Russian Cinema, Featured Series).
- `get_media_detail(provider: String, id: String, locale: String) -> MediaDetail`: full synopsis, ratings, seasons/episodes, audio/dub options, and cross-provider links.
- `resolve_streams(candidates: Vec<StreamCandidate>) -> StreamResolution`: staggered parallel resolution (300 ms step, 2s priority window), returns direct HTTPS or `wachcha-media://` opaque resource URIs.
- `inspect_qualities(candidates: Vec<StreamCandidate>) -> Vec<QualityOption>`: metadata-only quality enumeration using the shared 30s resolver cache without starting video download.
- `list_providers`, `configure_provider`, `install_stremio_addon`, `remove_stremio_addon`, `add_m3u_playlist`, `check_provider_health`: runtime source/addon management.
- `fetch_image(url: String)`: allowlisted HTTPS image proxy avoiding WebView CORS issues.
- `load_session` / `save_session`: atomic `0600` temp+sync+rename session & preference vault in `app_data_dir()`.
- `set_discord_presence`, `set_keep_awake`, `set_proxy_config`, `check_release_update`.

## Custom Async Media Protocol (`src-tauri/src/media.rs`)

- Registered via `.register_asynchronous_uri_scheme_protocol("wachcha-media", ...)`.
- URI pattern: `wachcha-media://localhost/<provider>/<session_hex>/<resource_hex>` (Windows WebView2 translates this to `http://wachcha-media.localhost/...` in-process without TCP).
- Session registration creates 128-bit random lowercase hex IDs. Every playlist variant, `#EXT-X-KEY`, `#EXT-X-MAP`, `#EXT-X-MEDIA`, and media segment in `.m3u8` is rewritten into registered resource IDs under the same session.
- **Bounds**:
  - Max 8 active sessions; evict after 3m idle or 45m total age.
  - Max 512 KB for manifests/playlists, 32 MB for segments, 8 MB Range slice cap.
  - Max 4 concurrent upstream fetches via `tokio::sync::Semaphore`.
  - Origin header on incoming protocol request must be Tauri WebView (`tauri://localhost`, `http://tauri.localhost`, `https://tauri.localhost`, or dev `http://127.0.0.1:4179`).
