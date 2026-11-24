---
name: wachcha-providers
description: >-
  Owns Wachcha's multi-vertical provider engine: Anime (AniLiberty, Shikimori, Yummy Public),
  Russian Movies & TV (TMDB, Rutube), Turkish Dizis (TMDB TR, TVMaze, Official Channels),
  Stremio Addon Protocol v3, M3U8 playlists, canonical ID deduplication, mirror failover, and
  staggered stream resolution.
---

# Wachcha Multi-Vertical Provider Engine

## Architecture Summary

Wachcha separates **Catalog Discovery & Metadata** (`CatalogProvider`) from **Stream Resolution** (`StreamProvider`) so a single title can combine rich multilingual metadata (RU/TR/EN posters, seasons, ratings) with playable streams from multiple native providers and community addons.

## Rules Every Provider Must Follow

1. **Unique Stable ID**: Lowercase slug (`aniliberty`, `shikimori`, `yummy_public`, `tmdb`, `tvmaze`, `rutube`, `turkish_channels`, `stremio`, `m3u_playlist`).
2. **Canonical External IDs**: Always populate `ExternalIds` (`imdb`, `tmdb`, `kinopoisk`, `shikimori`, `mal`, `aniliberty`, `tvmaze`, `rutube`) when known so the deduplication engine merges cross-provider duplicates cleanly.
3. **5-Second Mirror Failover**: Providers with mirrors retry on network error, timeout, HTTP 408, or HTTP 5xx (GET/PUT/DELETE only — never auto-retry ambiguous POST). Never failover on 401/403/404. Probe primary health in the background every 60s when on a backup mirror.
4. **Honest Stream Metadata**: Never invent lower resolutions when a stream exposes only 1080p; never substitute a different episode or studio voiceover when the requested pair is missing.
5. **Offline Fixture Tests**: Every provider MUST have `#[cfg(test)]` unit tests verifying deserialization, edge cases, and error handling without network access, plus an optional `#[ignore]` live transport test.

## References

- [Provider Traits, Resolution & Deduplication](./references/provider-contract.md)
- [Vertical Mapping (Anime / Russian / Turkish)](./references/vertical-mapping.md)
- [Stremio Addon Protocol v3 & M3U8 Guide](./references/stremio-and-m3u8.md)
