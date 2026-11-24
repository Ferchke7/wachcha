# Provider Traits, Canonical Deduplication & Staggered Resolution

## Canonical Data Model (`src-tauri/src/providers/mod.rs`)

- `MediaCategory`: `Movie | Series | TurkishDizi | Anime | LiveTv`
- `ExternalIds`: `{ imdb, tmdb, kinopoisk, shikimori, mal, aniliberty, tvmaze, rutube }`
- `MediaItem`: `{ id, provider, category, title, original_title, year, rating, poster_url, backdrop_url, genres, badges, audio_languages, external_ids, stream_ready }`
- `StreamCandidate`: `{ provider, media_id, episode_id, voice_label, preferred, raw_url, headers }`
- `ResolvedStream`: `{ provider, quality, format ("hls"|"dash"|"mp4"), url, relayed, fallback, subtitles, skips, source_host }`

## Canonical Deduplication Algorithm

When `search_catalog` merges `Vec<MediaItem>` across providers:

1. Build a canonical key priority order:
   - `imdb:<id>` → `tmdb:<cat>:<id>` → `mal:<id>` → `shikimori:<id>` → `norm(original_title || title) + ":" + year.unwrap_or(0)`.
2. When two items share a key:
   - Prefer the higher-richness poster/backdrop and non-empty rating.
   - Union `badges`, `audio_languages`, `genres`, and `sources` (tracking every provider that offers this title).
   - Merge all non-null fields of `ExternalIds`.
   - Set `stream_ready = a.stream_ready || b.stream_ready`.

## Staggered Parallel Stream Resolution (`src-tauri/src/backend.rs`)

- Launch candidate resolvers concurrently with `index * 300ms` stagger.
- If candidate `0` (preferred) is still resolving, hold faster backup results for up to a **2-second priority window** (`SOURCE_PRIORITY_WINDOW`).
- If the preferred candidate fails early, immediately promote the fastest valid backup.
- Only register `wachcha-media://` relay sessions for the **winning** resolved stream so losing or cancelled tasks never consume session slots.
- Cache resolved metadata in memory for **30 seconds** (max **64 entries**).
