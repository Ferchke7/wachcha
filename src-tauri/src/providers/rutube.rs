//! Rutube public catalog search & public HLS options adapter for free Russian movies,
//! classic cinema channels (e.g. Mosfilm), documentaries, and series.

use crate::providers::{
    Episode, ExternalIds, MediaCategory, MediaDetail, MediaItem, SourceLink, StreamCandidate,
};
use reqwest::Client;
use serde_json::Value;

pub const BASE_URL: &str = "https://rutube.ru/api";
pub const ALLOWED_CDN_HOSTS: &[&str] = &["*.rutube.ru", "*.rtbcdn.ru"];

pub fn parse_video_item(val: &Value) -> Option<MediaItem> {
    let id = val.get("id")?.as_str()?.to_string();
    let title = val.get("title")?.as_str()?.trim().to_string();
    if title.is_empty() {
        return None;
    }
    let duration = val.get("duration").and_then(|v| v.as_u64()).unwrap_or(0);
    let category = if duration >= 3600 {
        MediaCategory::Movie
    } else {
        MediaCategory::Series
    };
    let year = val
        .get("publication_ts")
        .or_else(|| val.get("created_ts"))
        .and_then(|v| v.as_str())
        .and_then(|s| s.get(0..4))
        .and_then(|y| y.parse::<u16>().ok());
    let poster = val
        .get("thumbnail_url")
        .and_then(|v| v.as_str())
        .filter(|u| u.starts_with("https://"))
        .map(str::to_string);
    let author = val
        .get("author")
        .and_then(|a| a.get("name"))
        .and_then(|v| v.as_str())
        .unwrap_or("Rutube");

    Some(MediaItem {
        id: id.clone(),
        provider: "rutube".into(),
        category,
        title,
        original_title: None,
        year,
        rating: None,
        poster_url: poster,
        backdrop_url: None,
        genres: vec![author.to_string()],
        badges: vec!["Rutube".into(), "HLS".into(), "Free RU".into()],
        audio_languages: vec!["RU".into()],
        external_ids: ExternalIds {
            rutube: Some(id.clone()),
            ..Default::default()
        },
        stream_ready: true,
        sources: vec![SourceLink {
            provider: "rutube".into(),
            id,
            label: "Rutube Public".into(),
        }],
    })
}

pub fn extract_hls_url(play_options: &Value) -> Option<String> {
    play_options
        .get("video_balancer")
        .and_then(|b| b.get("m3u8"))
        .and_then(|v| v.as_str())
        .filter(|u| u.starts_with("https://"))
        .map(str::to_string)
}

pub async fn search(client: &Client, query: &str) -> Result<Vec<MediaItem>, String> {
    let resp = client
        .get(format!("{BASE_URL}/search/video/"))
        .query(&[("query", query), ("format", "json"), ("page", "1")])
        .send()
        .await
        .map_err(|e| format!("Rutube search failed: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("Rutube HTTP {}", resp.status().as_u16()));
    }
    let val = resp.json::<Value>().await.map_err(|e| e.to_string())?;
    let results = val
        .get("results")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    Ok(results
        .iter()
        .take(15)
        .filter_map(parse_video_item)
        .collect())
}

pub async fn detail(client: &Client, video_id: &str) -> Result<MediaDetail, String> {
    let resp = client
        .get(format!("{BASE_URL}/play/options/{video_id}/"))
        .query(&[("format", "json"), ("no_404", "true")])
        .send()
        .await
        .map_err(|e| format!("Rutube play options failed: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("Rutube options HTTP {}", resp.status().as_u16()));
    }
    let val = resp.json::<Value>().await.map_err(|e| e.to_string())?;
    let title = val
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("Rutube Video")
        .to_string();
    let synopsis = val
        .get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let duration = val
        .get("duration")
        .and_then(|v| v.as_u64())
        .map(|d| d as u32);
    let poster = val
        .get("thumbnail_url")
        .and_then(|v| v.as_str())
        .filter(|u| u.starts_with("https://"))
        .map(str::to_string);

    let mut candidates = Vec::new();
    if let Some(m3u8) = extract_hls_url(&val) {
        candidates.push(StreamCandidate {
            provider: "rutube".into(),
            media_id: video_id.to_string(),
            episode_id: video_id.to_string(),
            voice_label: "Original (RU)".into(),
            quality: "Auto HLS".into(),
            format: "hls".into(),
            url: m3u8,
            preferred: true,
            headers: vec![("Referer".into(), "https://rutube.ru/".into())],
            allowed_hosts: ALLOWED_CDN_HOSTS.iter().map(|s| (*s).to_string()).collect(),
            skips: vec![],
            subtitles: vec![],
        });
    }

    let item = MediaItem {
        id: video_id.to_string(),
        provider: "rutube".into(),
        category: if duration.unwrap_or(0) >= 3600 {
            MediaCategory::Movie
        } else {
            MediaCategory::Series
        },
        title: title.clone(),
        original_title: None,
        year: None,
        rating: None,
        poster_url: poster.clone(),
        backdrop_url: poster.clone(),
        genres: vec!["Russian Cinema".into()],
        badges: vec!["Rutube".into(), "HLS".into()],
        audio_languages: vec!["RU".into()],
        external_ids: ExternalIds {
            rutube: Some(video_id.to_string()),
            ..Default::default()
        },
        stream_ready: !candidates.is_empty(),
        sources: vec![SourceLink {
            provider: "rutube".into(),
            id: video_id.to_string(),
            label: "Rutube Public".into(),
        }],
    };

    let episode = Episode {
        id: video_id.to_string(),
        season: 1,
        number: 1.0,
        title,
        duration_seconds: duration,
        thumbnail_url: poster,
        skips: vec![],
        candidates,
    };

    Ok(MediaDetail {
        item,
        synopsis,
        status: Some("Available".into()),
        voices: vec!["Original (RU)".into()],
        episodes: vec![episode],
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_rutube_video_and_extracts_hls_balancer_url() {
        let search_item = json!({
            "id": "abc123def456",
            "title": "Сталкер (Мосфильм, 1979)",
            "duration": 9700,
            "publication_ts": "2023-04-12T10:00:00",
            "thumbnail_url": "https://pic.rutubelist.ru/video/stalker.jpg",
            "author": { "name": "Киноконцерн Мосфильм" }
        });
        let item = parse_video_item(&search_item).unwrap();
        assert_eq!(item.category, MediaCategory::Movie);
        assert!(item.stream_ready);

        let play_opts = json!({
            "video_balancer": {
                "m3u8": "https://video-edge.rtbcdn.ru/hls/abc123/master.m3u8"
            }
        });
        assert_eq!(
            extract_hls_url(&play_opts).as_deref(),
            Some("https://video-edge.rtbcdn.ru/hls/abc123/master.m3u8")
        );
    }
}
