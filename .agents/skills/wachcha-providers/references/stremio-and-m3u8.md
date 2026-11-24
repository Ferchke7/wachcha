# Stremio Addon Protocol v3 & M3U8 Playlists

## Stremio Addon Protocol v3 (`src-tauri/src/providers/stremio_addon.rs`)

Every installed addon starts from an HTTPS `manifest.json` URL (or `http://127.0.0.1:...` for local self-hosted bridges):

1. `GET <base>/manifest.json` → validate `id`, `name`, `version`, `resources`, `types`, `catalogs`, `idPrefixes`.
2. Catalog search: `GET <base>/catalog/{type}/{catalogId}/search={encoded}.json` → maps `metas[]` into Wachcha `MediaItem`.
3. Metadata: `GET <base>/meta/{type}/{id}.json` → populates `MediaDetail` and `videos[]` episodes.
4. Streams: `GET <base>/stream/{type}/{id}.json` → maps `streams[]`:
   - Direct `url` (HLS `.m3u8`, DASH `.mpd`, or `.mp4`).
   - If `behaviorHints.proxyHeaders.request` is present, register the stream inside `wachcha-media://` with scoped host allowlisting so headers never touch the WebView.
5. Subtitles: `GET <base>/subtitles/{type}/{id}.json` → maps VTT/SRT tracks into `SubtitleTrack[]`.

## M3U / M3U8 Playlist Provider (`src-tauri/src/providers/m3u_playlist.rs`)

- Parses `#EXTM3U` playlists and extracts `#EXTINF:-1 tvg-id="..." tvg-logo="..." group-title="..." tvg-language="...",Channel Name` followed by stream URL.
- Validates stream URLs are `https://` (or `http://` only when explicitly enabled for legacy free-to-air IPTV), never `file://`.
- Indexes entries into `MediaCategory::LiveTv` for instant cross-vertical search (e.g., searching "TRT" or "Россия" or "Anime" surfaces matching live channels too).
