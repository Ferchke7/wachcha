# Multi-Vertical Source Mapping

## 1. Anime Vertical

- **AniLiberty API v1** (`https://aniliberty.top/api/v1`) — **Keyless, Stream-Ready**:
  - Catalog / latest: `GET /anime/releases/latest?limit=15`
  - Search: `GET /app/search/releases?query=<q>`
  - Detail + Episodes + HLS + Skip markers: `GET /anime/releases/<alias_or_id>`
  - Returns adaptive `.m3u8` URLs (`hls_1080`, `hls_720`, `hls_480`) and exact `opening` / `ending` skip intervals (`start`, `stop`).
- **Shikimori Public API** (`https://shikimori.one/api`) — **Keyless Metadata**:
  - Search & popular catalog (`GET /animes?search=<q>&order=popularity&limit=20`), Russian + English titles, MAL ID (`id`), ratings, episodes count.
- **YummyAnime Public API** (`https://api.yani.tv`, mirrors `https://old.yummyani.me/api`, `https://ru.yummyani.me/api`):
  - Catalog, schedules, voiceover studio listings, and ratings with automatic 5s mirror failover & 60s primary recovery.

## 2. Russian & World Movies / TV Series Vertical

- **TMDB v3** (`https://api.themoviedb.org/3`, optional free user key):
  - Multilingual localization (`ru-RU`, `tr-TR`, `en-US`).
  - Russian cinema discovery: `/discover/movie?with_original_language=ru&sort_by=popularity.desc`.
  - Full seasons, episodes, backdrops, and IMDb external IDs (`/external_ids`) for seamless matching with Stremio addons.
- **Rutube Public Catalog** (`https://rutube.ru/api/`):
  - Keyless public search (`GET /search/video/?query=<q>&format=json`) and public play options (`GET /play/options/<id>/?format=json`) for free Russian films, official Mosfilm/Lenfilm/StarMedia uploads, and documentaries. CDN allowlist: `*.rutube.ru`, `*.rtbcdn.ru`.
- **TVMaze** (`https://api.tvmaze.com`) — **Keyless**:
  - Global TV search (`/search/shows?q=<q>`), full episode guides (`/shows/{id}/episodes`), IMDb linking, and air schedules.

## 3. Turkish TV Shows (Diziler) Vertical

- **TMDB Turkish Dizi Hub**: `/discover/tv?with_original_language=tr&sort_by=popularity.desc` with Russian, Turkish, and English localized metadata.
- **TVMaze Turkish Broadcast Networks**: Indexes shows airing on `TRT 1`, `ATV`, `Kanal D`, `Star TV`, `Show TV`, `NOW`, `TV8`.
- **Official Turkish Broadcaster Registry (`turkish_channels.rs`)**: Curated metadata + free official channel links & public HLS feeds (e.g., TRT / ATV / Kanal D / Show TV public channels & M3U8 feeds), cleanly bridgeable with Russian-dub/subtitled Stremio community addons via `imdb_id` / `tmdb_id`.
