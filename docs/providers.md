# Wachcha Multi-Vertical Providers & Extension SDK

Wachcha separates **Catalog Metadata** from **Stream Resolution** so a single search in English, Russian, or Turkish merges results across every vertical without duplicates.

## Built-In Native Rust Providers

| Provider                                            | Verticals                                               | Key Required              | Streaming Method                                                                              |
| --------------------------------------------------- | ------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------- |
| **AniLiberty API v1** (`aniliberty.top/api/v1`)     | Anime (RU Dub)                                          | None                      | Direct multi-quality HLS `.m3u8` (480p/720p/1080p) + opening/ending skip timestamps           |
| **Shikimori Public API** (`shikimori.one/api`)      | Anime (RU/EN)                                           | None                      | Catalog, ratings, MAL ID reconciliation, watch order                                          |
| **YummyAnime Public API** (`api.yani.tv` + mirrors) | Anime (RU)                                              | Optional public app token | Catalog, schedules, voiceover metadata with 5s mirror failover & 60s primary recovery         |
| **TMDB v3** (`api.themoviedb.org/3`)                | Movies, Russian Cinema (`ru`), Turkish Dizis (`tr`), TV | Optional free TMDB key    | Multilingual EN/RU/TR metadata, posters, seasons, episodes, IMDb IDs                          |
| **TVMaze** (`api.tvmaze.com`)                       | TV Series & Turkish Networks                            | None                      | Keyless global & Turkish network catalogs (`TRT 1`, `ATV`, `Kanal D`, `Star TV`, `Show TV`)   |
| **Rutube Public Catalog** (`rutube.ru/api`)         | Russian Movies, Classic Cinema, Shows                   | None                      | Free public search & HLS stream options from official channels (`*.rutube.ru`, `*.rtbcdn.ru`) |
| **Turkish Official Channels**                       | Turkish Dizis & Broadcasters                            | None                      | Curated TRT, ATV, Kanal D, Star TV, Show TV, NOW official channel registry & public streams   |

## Open Extension Bridges

### 1. Stremio Addon Protocol v3

Paste any `manifest.json` URL in **Sources & Addons**. Wachcha automatically queries:

- `/catalog/{type}/{id}/search={query}.json`
- `/meta/{type}/{id}.json`
- `/stream/{type}/{id}.json` (including `behaviorHints.proxyHeaders` safely routed through `wachcha-media://`)
- `/subtitles/{type}/{id}.json`

### 2. M3U / M3U8 Playlists

Attach any free-to-air Russian, Turkish, or international `.m3u` / `.m3u8` playlist URL to index live channels and VOD streams into unified search and native HLS playback.
