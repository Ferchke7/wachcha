//! AniLiberty API v1 (AniLibria) provider — keyless Russian-dubbed anime catalog,
//! direct multi-quality HLS (.m3u8) streams, and opening/ending skip markers.

use crate::providers::{
    Episode, ExternalIds, MediaCategory, MediaDetail, MediaItem, SourceLink, StreamCandidate,
};
use crate::skips::{normalize_skips, SkipInterval, SkipKind};
use reqwest::Client;
use serde_json::Value;

pub const BASE_URL: &str = "https://aniliberty.top/api/v1";
const IMAGE_ORIGIN: &str = "https://aniliberty.top";

fn absolutize_poster(path: Option<&str>) -> Option<String> {
    let raw = path?.trim();
    if raw.is_empty() {
        return None;
    }
    if raw.starts_with("https://") {
        Some(raw.to_string())
    } else if raw.starts_with('/') {
        Some(format!("{IMAGE_ORIGIN}{raw}"))
    } else {
        None
    }
}

pub fn parse_release_item(val: &Value) -> Option<MediaItem> {
    let id_num = val.get("id")?.as_u64()?;
    let alias = val
        .get("alias")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .unwrap_or_else(|| id_num.to_string());
    let name_obj = val.get("name");
    let main_title = name_obj
        .and_then(|n| n.get("main"))
        .and_then(|v| v.as_str())
        .or_else(|| val.get("title").and_then(|v| v.as_str()))?
        .to_string();
    let original_title = name_obj
        .and_then(|n| n.get("english"))
        .and_then(|v| v.as_str())
        .map(str::to_string);
    let year = val.get("year").and_then(|v| v.as_u64()).map(|y| y as u16);
    let poster = val
        .get("poster")
        .and_then(|p| {
            p.get("optimized")
                .and_then(|o| o.get("src"))
                .or_else(|| p.get("src"))
        })
        .and_then(|v| v.as_str());
    let genres = val
        .get("genres")
        .and_then(|g| g.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|item| {
                    item.get("name")
                        .and_then(|n| n.as_str())
                        .map(str::to_string)
                })
                .collect()
        })
        .unwrap_or_default();

    Some(MediaItem {
        id: alias.clone(),
        provider: "aniliberty".into(),
        category: MediaCategory::Anime,
        title: main_title,
        original_title,
        year,
        rating: None,
        poster_url: absolutize_poster(poster),
        backdrop_url: None,
        genres,
        badges: vec!["AniLiberty".into(), "HLS".into(), "RU Dub".into()],
        audio_languages: vec!["RU".into()],
        external_ids: ExternalIds {
            aniliberty: Some(id_num),
            ..Default::default()
        },
        stream_ready: true,
        sources: vec![SourceLink {
            provider: "aniliberty".into(),
            id: alias,
            label: "AniLiberty HLS".into(),
        }],
    })
}

pub fn parse_release_detail(val: &Value) -> Option<MediaDetail> {
    let item = parse_release_item(val)?;
    let synopsis = val
        .get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let episodes = val
        .get("episodes")
        .and_then(|e| e.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|ep| parse_episode(&item.id, ep))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    Some(MediaDetail {
        item,
        synopsis,
        status: val
            .get("is_ongoing")
            .and_then(|v| v.as_bool())
            .map(|ongoing| {
                if ongoing {
                    "Ongoing".into()
                } else {
                    "Completed".into()
                }
            }),
        voices: vec!["AniLibria (RU)".into()],
        episodes,
    })
}

fn parse_episode(media_id: &str, ep: &Value) -> Option<Episode> {
    let ordinal = ep.get("ordinal")?.as_f64()? as f32;
    let ep_id = ep
        .get("id")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .unwrap_or_else(|| format!("ep-{ordinal}"));
    let title = ep
        .get("name")
        .and_then(|v| v.as_str())
        .filter(|s| !s.trim().is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| format!("Episode {ordinal}"));
    let duration = ep
        .get("duration")
        .and_then(|v| v.as_u64())
        .map(|d| d as u32);
    let thumb = ep
        .get("preview")
        .and_then(|p| p.get("src"))
        .and_then(|v| v.as_str());

    let mut skips = Vec::new();
    if let Some(op) = ep.get("opening") {
        if let (Some(start), Some(stop)) = (
            op.get("start").and_then(|v| v.as_f64()),
            op.get("stop").and_then(|v| v.as_f64()),
        ) {
            if let Some(i) = SkipInterval::validated(SkipKind::Opening, start, stop) {
                skips.push(i);
            }
        }
    }
    if let Some(ed) = ep.get("ending") {
        if let (Some(start), Some(stop)) = (
            ed.get("start").and_then(|v| v.as_f64()),
            ed.get("stop").and_then(|v| v.as_f64()),
        ) {
            if let Some(i) = SkipInterval::validated(SkipKind::Ending, start, stop) {
                skips.push(i);
            }
        }
    }
    let skips = normalize_skips(skips);

    let mut candidates = Vec::new();
    for (field, quality, preferred) in [
        ("hls_1080", "1080p", true),
        ("hls_720", "720p", false),
        ("hls_480", "480p", false),
    ] {
        if let Some(url) = ep
            .get(field)
            .and_then(|v| v.as_str())
            .filter(|s| s.starts_with("https://"))
        {
            candidates.push(StreamCandidate {
                provider: "aniliberty".into(),
                media_id: media_id.to_string(),
                episode_id: ep_id.clone(),
                voice_label: "AniLibria (RU)".into(),
                quality: quality.into(),
                format: "hls".into(),
                url: url.to_string(),
                preferred,
                headers: vec![],
                allowed_hosts: vec![],
                skips: skips.clone(),
                subtitles: vec![],
            });
        }
    }

    Some(Episode {
        id: ep_id,
        season: 1,
        number: ordinal,
        title,
        duration_seconds: duration,
        thumbnail_url: absolutize_poster(thumb),
        skips,
        candidates,
    })
}

pub async fn latest(client: &Client, limit: usize) -> Result<Vec<MediaItem>, String> {
    let url = format!("{BASE_URL}/anime/releases/latest?limit={limit}");
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("AniLiberty latest failed: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("AniLiberty HTTP {}", resp.status().as_u16()));
    }
    let json = resp.json::<Value>().await.map_err(|e| e.to_string())?;
    let list = json
        .as_array()
        .or_else(|| json.get("data").and_then(|v| v.as_array()))
        .cloned()
        .unwrap_or_default();
    Ok(list.iter().filter_map(parse_release_item).collect())
}

pub async fn search(client: &Client, query: &str) -> Result<Vec<MediaItem>, String> {
    let resp = client
        .get(format!("{BASE_URL}/app/search/releases"))
        .query(&[("query", query)])
        .send()
        .await
        .map_err(|e| format!("AniLiberty search failed: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("AniLiberty search HTTP {}", resp.status().as_u16()));
    }
    let json = resp.json::<Value>().await.map_err(|e| e.to_string())?;
    let list = json
        .as_array()
        .or_else(|| json.get("data").and_then(|v| v.as_array()))
        .cloned()
        .unwrap_or_default();
    Ok(list.iter().filter_map(parse_release_item).collect())
}

pub async fn detail(client: &Client, alias_or_id: &str) -> Result<MediaDetail, String> {
    let resp = client
        .get(format!("{BASE_URL}/anime/releases/{alias_or_id}"))
        .send()
        .await
        .map_err(|e| format!("AniLiberty detail failed: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("AniLiberty detail HTTP {}", resp.status().as_u16()));
    }
    let json = resp.json::<Value>().await.map_err(|e| e.to_string())?;
    parse_release_detail(&json).ok_or_else(|| "Unexpected AniLiberty detail payload.".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_aniliberty_release_with_hls_and_skips() {
        let fixture = json!({
            "id": 9901,
            "alias": "frieren-beyond-journey",
            "name": { "main": "Провожающая в последний путь Фрирен", "english": "Frieren: Beyond Journey's End" },
            "year": 2024,
            "description": "An elf mage reflects on mortality.",
            "is_ongoing": false,
            "poster": { "optimized": { "src": "/storage/posters/frieren.webp" } },
            "genres": [{ "name": "Fantasy" }, { "name": "Adventure" }],
            "episodes": [{
                "id": "ep-uuid-1",
                "ordinal": 1,
                "name": "The Journey's End",
                "duration": 1440,
                "opening": { "start": 85.0, "stop": 175.0 },
                "ending": { "start": 1320.0, "stop": 1410.0 },
                "hls_1080": "https://cache.aniliberty.top/hls/9901/1/1080.m3u8",
                "hls_720": "https://cache.aniliberty.top/hls/9901/1/720.m3u8",
                "hls_480": "https://cache.aniliberty.top/hls/9901/1/480.m3u8"
            }]
        });

        let detail = parse_release_detail(&fixture).expect("parsed detail");
        assert_eq!(detail.item.external_ids.aniliberty, Some(9901));
        assert_eq!(
            detail.item.poster_url.as_deref(),
            Some("https://aniliberty.top/storage/posters/frieren.webp")
        );
        assert_eq!(detail.episodes.len(), 1);
        assert_eq!(detail.episodes[0].candidates.len(), 3);
        assert_eq!(detail.episodes[0].skips.len(), 2);
        assert_eq!(detail.episodes[0].candidates[0].quality, "1080p");
    }

    #[tokio::test]
    #[ignore = "live network check"]
    async fn live_provider_transport_aniliberty() {
        let client = Client::new();
        let items = latest(&client, 3).await.expect("live aniliberty latest");
        assert!(!items.is_empty());
    }
}
