//! Unified multi-vertical provider types, canonical ID deduplication, and provider registry.

pub mod aniliberty;
pub mod m3u_playlist;
pub mod rutube;
pub mod shikimori;
pub mod stremio_addon;
pub mod tmdb;
pub mod turkish_channels;
pub mod tvmaze;
pub mod yummy_public;

use crate::skips::SkipInterval;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum MediaCategory {
    Movie,
    Series,
    TurkishDizi,
    Anime,
    LiveTv,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalIds {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub imdb: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tmdb: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kinopoisk: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shikimori: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mal: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub aniliberty: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tvmaze: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rutube: Option<String>,
}

impl ExternalIds {
    pub fn merge_from(&mut self, other: &Self) {
        if self.imdb.is_none() {
            self.imdb = other.imdb.clone();
        }
        if self.tmdb.is_none() {
            self.tmdb = other.tmdb;
        }
        if self.kinopoisk.is_none() {
            self.kinopoisk = other.kinopoisk;
        }
        if self.shikimori.is_none() {
            self.shikimori = other.shikimori;
        }
        if self.mal.is_none() {
            self.mal = other.mal;
        }
        if self.aniliberty.is_none() {
            self.aniliberty = other.aniliberty;
        }
        if self.tvmaze.is_none() {
            self.tvmaze = other.tvmaze;
        }
        if self.rutube.is_none() {
            self.rutube = other.rutube.clone();
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceLink {
    pub provider: String,
    pub id: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaItem {
    pub id: String,
    pub provider: String,
    pub category: MediaCategory,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub original_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub year: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rating: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub poster_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub backdrop_url: Option<String>,
    #[serde(default)]
    pub genres: Vec<String>,
    #[serde(default)]
    pub badges: Vec<String>,
    #[serde(default)]
    pub audio_languages: Vec<String>,
    #[serde(default)]
    pub external_ids: ExternalIds,
    #[serde(default)]
    pub stream_ready: bool,
    #[serde(default)]
    pub sources: Vec<SourceLink>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleTrack {
    pub lang: String,
    pub label: String,
    pub url: String,
    pub format: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamCandidate {
    pub provider: String,
    pub media_id: String,
    pub episode_id: String,
    pub voice_label: String,
    pub quality: String,
    pub format: String,
    pub url: String,
    #[serde(default)]
    pub preferred: bool,
    #[serde(default)]
    pub headers: Vec<(String, String)>,
    #[serde(default)]
    pub allowed_hosts: Vec<String>,
    #[serde(default)]
    pub skips: Vec<SkipInterval>,
    #[serde(default)]
    pub subtitles: Vec<SubtitleTrack>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Episode {
    pub id: String,
    pub season: u32,
    pub number: f32,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_seconds: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thumbnail_url: Option<String>,
    #[serde(default)]
    pub skips: Vec<SkipInterval>,
    #[serde(default)]
    pub candidates: Vec<StreamCandidate>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaDetail {
    pub item: MediaItem,
    pub synopsis: String,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub voices: Vec<String>,
    #[serde(default)]
    pub episodes: Vec<Episode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogShelf {
    pub id: String,
    pub title_key: String,
    pub provider_badge: String,
    pub category: MediaCategory,
    pub items: Vec<MediaItem>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchQuery {
    pub text: String,
    #[serde(default)]
    pub category: Option<MediaCategory>,
    #[serde(default)]
    pub locale: Option<String>,
    #[serde(default)]
    pub provider: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResponse {
    pub query: String,
    pub items: Vec<MediaItem>,
    pub provider_errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedStream {
    pub provider: String,
    pub quality: String,
    pub format: String,
    pub url: String,
    pub relayed: bool,
    pub source_host: String,
    pub voice_label: String,
    #[serde(default)]
    pub skips: Vec<SkipInterval>,
    #[serde(default)]
    pub subtitles: Vec<SubtitleTrack>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamResolution {
    pub provider: String,
    pub episode_id: String,
    pub streams: Vec<ResolvedStream>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QualityOption {
    pub provider: String,
    pub quality: String,
    pub format: String,
    pub voice_label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub categories: Vec<MediaCategory>,
    pub enabled: bool,
    pub requires_key: bool,
    pub key_configured: bool,
    pub keyless: bool,
    pub stream_capable: bool,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderHealth {
    pub provider: String,
    pub active_mirror: String,
    pub healthy: bool,
    pub latency_ms: Option<u64>,
    pub detail: String,
}

pub fn normalize_title_key(raw: &str) -> String {
    raw.to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric())
        .collect()
}

fn canonical_key(item: &MediaItem) -> String {
    if let Some(imdb) = item.external_ids.imdb.as_deref().filter(|s| !s.is_empty()) {
        return format!("imdb:{}", imdb.to_ascii_lowercase());
    }
    if let Some(tmdb) = item.external_ids.tmdb {
        return format!("tmdb:{:?}:{tmdb}", item.category);
    }
    if let Some(mal) = item.external_ids.mal {
        return format!("mal:{mal}");
    }
    if let Some(shiki) = item.external_ids.shikimori {
        return format!("shikimori:{shiki}");
    }
    let base = item
        .original_title
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or(&item.title);
    format!(
        "title:{:?}:{}:{}",
        item.category,
        normalize_title_key(base),
        item.year.unwrap_or(0)
    )
}

/// Deduplicates multi-provider search items while preserving all source links,
/// merging ExternalIds, badges, audio tracks, and preferring stream-ready high-richness records.
pub fn deduplicate_items(items: Vec<MediaItem>) -> Vec<MediaItem> {
    let mut index: HashMap<String, usize> = HashMap::new();
    let mut merged: Vec<MediaItem> = Vec::with_capacity(items.len());

    for mut item in items {
        if item.sources.is_empty() {
            item.sources.push(SourceLink {
                provider: item.provider.clone(),
                id: item.id.clone(),
                label: item.provider.clone(),
            });
        }
        let key = canonical_key(&item);
        if let Some(&pos) = index.get(&key) {
            let target = &mut merged[pos];
            target.external_ids.merge_from(&item.external_ids);
            target.stream_ready |= item.stream_ready;
            if target.poster_url.is_none() {
                target.poster_url = item.poster_url;
            }
            if target.backdrop_url.is_none() {
                target.backdrop_url = item.backdrop_url;
            }
            if target.rating.is_none() {
                target.rating = item.rating;
            }
            for g in item.genres {
                if !target.genres.contains(&g) {
                    target.genres.push(g);
                }
            }
            for b in item.badges {
                if !target.badges.contains(&b) {
                    target.badges.push(b);
                }
            }
            for lang in item.audio_languages {
                if !target.audio_languages.contains(&lang) {
                    target.audio_languages.push(lang);
                }
            }
            for src in item.sources {
                if !target
                    .sources
                    .iter()
                    .any(|s| s.provider == src.provider && s.id == src.id)
                {
                    target.sources.push(src);
                }
            }
            // Prefer stream-ready provider as primary click target when merging metadata-only first.
            if !target.badges.iter().any(|b| b == "HLS") && item.stream_ready {
                target.provider = item.provider;
                target.id = item.id;
            }
        } else {
            index.insert(key, merged.len());
            merged.push(item);
        }
    }

    merged.sort_by(|a, b| {
        b.stream_ready
            .cmp(&a.stream_ready)
            .then_with(|| b.sources.len().cmp(&a.sources.len()))
            .then_with(|| b.rating.unwrap_or(0.0).total_cmp(&a.rating.unwrap_or(0.0)))
    });
    merged
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn merges_duplicate_titles_across_providers_by_imdb_and_preserves_sources() {
        let a = MediaItem {
            id: "123".into(),
            provider: "tmdb".into(),
            category: MediaCategory::TurkishDizi,
            title: "Kuruluş: Osman".into(),
            original_title: Some("Kuruluş: Osman".into()),
            year: Some(2019),
            rating: Some(8.6),
            poster_url: Some("https://image.tmdb.org/t/p/w500/osman.jpg".into()),
            backdrop_url: None,
            genres: vec!["Drama".into()],
            badges: vec!["TMDB".into()],
            audio_languages: vec!["TR".into()],
            external_ids: ExternalIds {
                imdb: Some("tt11093750".into()),
                tmdb: Some(95594),
                ..Default::default()
            },
            stream_ready: false,
            sources: vec![],
        };
        let b = MediaItem {
            id: "atv-osman".into(),
            provider: "turkish_channels".into(),
            category: MediaCategory::TurkishDizi,
            title: "Основание: Осман".into(),
            original_title: Some("Kuruluş: Osman".into()),
            year: Some(2019),
            rating: None,
            poster_url: None,
            backdrop_url: None,
            genres: vec!["History".into()],
            badges: vec!["ATV Free".into(), "HLS".into()],
            audio_languages: vec!["TR".into(), "RU".into()],
            external_ids: ExternalIds {
                imdb: Some("tt11093750".into()),
                ..Default::default()
            },
            stream_ready: true,
            sources: vec![],
        };

        let merged = deduplicate_items(vec![a, b]);
        assert_eq!(merged.len(), 1);
        assert!(merged[0].stream_ready);
        assert_eq!(merged[0].sources.len(), 2);
        assert_eq!(merged[0].rating, Some(8.6));
        assert!(merged[0].audio_languages.contains(&"RU".to_string()));
    }
}
