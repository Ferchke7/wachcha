//! Stremio Addon Protocol v3 client (`/manifest.json`, `/catalog`, `/meta`, `/stream`, `/subtitles`).
//! Allows attaching any community Russian, Turkish, Anime, or Subtitle addon safely.

use crate::providers::{
    Episode, ExternalIds, MediaCategory, MediaDetail, MediaItem, SourceLink, StreamCandidate,
    SubtitleTrack,
};
use crate::session::StremioAddonEntry;
use reqwest::Client;
use serde_json::Value;
use url::Url;

pub fn validate_manifest_url(raw: &str) -> Result<(Url, String), String> {
    let parsed = Url::parse(raw.trim()).map_err(|_| "Invalid addon manifest URL.".to_string())?;
    let host = parsed.host_str().unwrap_or_default();
    let is_local = matches!(host, "127.0.0.1" | "localhost");
    if parsed.scheme() != "https" && !(parsed.scheme() == "http" && is_local) {
        return Err("Addon URL must use HTTPS (or http://127.0.0.1 for local bridges).".into());
    }
    if !parsed.path().ends_with("manifest.json") {
        return Err("Addon URL must end with /manifest.json.".into());
    }
    let base = raw
        .trim()
        .strip_suffix("/manifest.json")
        .unwrap_or(raw.trim())
        .to_string();
    Ok((parsed, base))
}

pub fn parse_manifest(
    manifest_url: &str,
    base_url: &str,
    val: &Value,
) -> Result<StremioAddonEntry, String> {
    let id = val
        .get("id")
        .and_then(|v| v.as_str())
        .filter(|s| !s.trim().is_empty())
        .ok_or_else(|| "Addon manifest is missing 'id'.".to_string())?
        .to_string();
    let name = val
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or(&id)
        .to_string();
    let version = val
        .get("version")
        .and_then(|v| v.as_str())
        .unwrap_or("1.0.0")
        .to_string();

    let resources = val
        .get("resources")
        .and_then(|r| r.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|item| {
                    item.as_str()
                        .or_else(|| item.get("name").and_then(|n| n.as_str()))
                        .map(str::to_string)
                })
                .collect()
        })
        .unwrap_or_default();

    let types = val
        .get("types")
        .and_then(|t| t.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(str::to_string))
                .collect()
        })
        .unwrap_or_default();

    Ok(StremioAddonEntry {
        id,
        name,
        version,
        manifest_url: manifest_url.to_string(),
        base_url: base_url.to_string(),
        resources,
        types,
        enabled: true,
    })
}

pub async fn fetch_manifest(
    client: &Client,
    manifest_url: &str,
) -> Result<StremioAddonEntry, String> {
    let (url, base_url) = validate_manifest_url(manifest_url)?;
    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch addon manifest: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!(
            "Addon manifest returned HTTP {}",
            resp.status().as_u16()
        ));
    }
    let val = resp.json::<Value>().await.map_err(|e| e.to_string())?;
    parse_manifest(manifest_url, &base_url, &val)
}

pub fn map_stremio_type(stremio_type: &str) -> MediaCategory {
    match stremio_type {
        "movie" => MediaCategory::Movie,
        "anime" => MediaCategory::Anime,
        "tv" | "channel" => MediaCategory::LiveTv,
        _ => MediaCategory::Series,
    }
}

pub fn parse_catalog_metas(addon: &StremioAddonEntry, val: &Value) -> Vec<MediaItem> {
    let metas = val
        .get("metas")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    metas
        .iter()
        .filter_map(|m| {
            let id = m.get("id")?.as_str()?.to_string();
            let title = m.get("name")?.as_str()?.to_string();
            let st_type = m.get("type").and_then(|v| v.as_str()).unwrap_or("movie");
            let poster = m
                .get("poster")
                .and_then(|v| v.as_str())
                .filter(|u| u.starts_with("https://"))
                .map(str::to_string);
            let imdb = id.starts_with("tt").then(|| id.clone());
            let composite = format!("{}|{}|{}", addon.id, st_type, id);
            Some(MediaItem {
                id: composite.clone(),
                provider: format!("addon:{}", addon.id),
                category: map_stremio_type(st_type),
                title,
                original_title: None,
                year: m
                    .get("releaseInfo")
                    .and_then(|v| v.as_str())
                    .and_then(|s| s.get(0..4))
                    .and_then(|y| y.parse::<u16>().ok()),
                rating: m
                    .get("imdbRating")
                    .and_then(|v| v.as_str())
                    .and_then(|s| s.parse::<f32>().ok()),
                poster_url: poster,
                backdrop_url: m
                    .get("background")
                    .and_then(|v| v.as_str())
                    .filter(|u| u.starts_with("https://"))
                    .map(str::to_string),
                genres: m
                    .get("genres")
                    .and_then(|g| g.as_array())
                    .map(|a| {
                        a.iter()
                            .filter_map(|v| v.as_str().map(str::to_string))
                            .collect()
                    })
                    .unwrap_or_default(),
                badges: vec![addon.name.clone(), "Addon".into()],
                audio_languages: vec![],
                external_ids: ExternalIds {
                    imdb,
                    ..Default::default()
                },
                stream_ready: addon.resources.iter().any(|r| r == "stream"),
                sources: vec![SourceLink {
                    provider: format!("addon:{}", addon.id),
                    id: composite,
                    label: addon.name.clone(),
                }],
            })
        })
        .collect()
}

pub fn parse_streams(
    addon: &StremioAddonEntry,
    media_id: &str,
    episode_id: &str,
    val: &Value,
) -> Vec<StreamCandidate> {
    let streams = val
        .get("streams")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    streams
        .iter()
        .enumerate()
        .filter_map(|(idx, s)| {
            let url = s
                .get("url")
                .and_then(|v| v.as_str())
                .filter(|u| u.starts_with("https://") || u.starts_with("http://127.0.0.1"))?
                .to_string();
            let parsed = Url::parse(&url).ok()?;
            let host = parsed.host_str().unwrap_or_default().to_string();
            let format = if url.contains(".m3u8") {
                "hls"
            } else if url.contains(".mpd") {
                "dash"
            } else {
                "mp4"
            };
            let title = s
                .get("title")
                .or_else(|| s.get("name"))
                .and_then(|v| v.as_str())
                .unwrap_or(&addon.name)
                .to_string();
            let mut headers = Vec::new();
            if let Some(req_hdrs) = s
                .get("behaviorHints")
                .and_then(|h| h.get("proxyHeaders"))
                .and_then(|p| p.get("request"))
                .and_then(|r| r.as_object())
            {
                for (k, v) in req_hdrs {
                    if let Some(vs) = v.as_str() {
                        headers.push((k.clone(), vs.to_string()));
                    }
                }
            }
            let subtitles = s
                .get("subtitles")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|sub| {
                            Some(SubtitleTrack {
                                lang: sub.get("lang")?.as_str()?.to_string(),
                                label: sub
                                    .get("lang")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("Subtitle")
                                    .to_string(),
                                url: sub.get("url")?.as_str()?.to_string(),
                                format: "vtt".into(),
                            })
                        })
                        .collect()
                })
                .unwrap_or_default();

            Some(StreamCandidate {
                provider: format!("addon:{}", addon.id),
                media_id: media_id.to_string(),
                episode_id: episode_id.to_string(),
                voice_label: title,
                quality: "Auto".into(),
                format: format.into(),
                url,
                preferred: idx == 0,
                headers,
                allowed_hosts: vec![host],
                skips: vec![],
                subtitles,
            })
        })
        .collect()
}

pub async fn fetch_streams(
    client: &Client,
    addon: &StremioAddonEntry,
    stremio_type: &str,
    content_id: &str,
) -> Result<Vec<StreamCandidate>, String> {
    let url = format!("{}/stream/{stremio_type}/{content_id}.json", addon.base_url);
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Addon stream fetch failed: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("Addon stream HTTP {}", resp.status().as_u16()));
    }
    let val = resp.json::<Value>().await.map_err(|e| e.to_string())?;
    Ok(parse_streams(addon, content_id, content_id, &val))
}

pub async fn search_addon(
    client: &Client,
    addon: &StremioAddonEntry,
    query: &str,
) -> Result<Vec<MediaItem>, String> {
    let st_type = addon.types.first().map(String::as_str).unwrap_or("movie");
    let encoded: String = url::form_urlencoded::byte_serialize(query.as_bytes()).collect();
    let url = format!(
        "{}/catalog/{st_type}/top/search={encoded}.json",
        addon.base_url
    );
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Addon search failed: {e}"))?;
    if !resp.status().is_success() {
        return Ok(vec![]);
    }
    let val = resp.json::<Value>().await.map_err(|e| e.to_string())?;
    Ok(parse_catalog_metas(addon, &val))
}

pub async fn detail_addon(
    client: &Client,
    addon: &StremioAddonEntry,
    stremio_type: &str,
    raw_id: &str,
) -> Result<MediaDetail, String> {
    let streams = fetch_streams(client, addon, stremio_type, raw_id)
        .await
        .unwrap_or_default();
    let item = MediaItem {
        id: format!("{}|{}|{}", addon.id, stremio_type, raw_id),
        provider: format!("addon:{}", addon.id),
        category: map_stremio_type(stremio_type),
        title: raw_id.to_string(),
        original_title: None,
        year: None,
        rating: None,
        poster_url: None,
        backdrop_url: None,
        genres: vec![],
        badges: vec![addon.name.clone(), "Addon".into()],
        audio_languages: vec![],
        external_ids: ExternalIds {
            imdb: raw_id.starts_with("tt").then(|| raw_id.to_string()),
            ..Default::default()
        },
        stream_ready: !streams.is_empty(),
        sources: vec![],
    };
    let episode = Episode {
        id: raw_id.to_string(),
        season: 1,
        number: 1.0,
        title: addon.name.clone(),
        duration_seconds: None,
        thumbnail_url: None,
        skips: vec![],
        candidates: streams,
    };
    Ok(MediaDetail {
        item,
        synopsis: format!("Provided by Stremio addon '{}'.", addon.name),
        status: Some("Addon".into()),
        voices: vec![addon.name.clone()],
        episodes: vec![episode],
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn validates_stremio_manifest_and_parses_proxy_header_streams() {
        assert!(validate_manifest_url("https://addon.example.org/manifest.json").is_ok());
        assert!(validate_manifest_url("http://evil.example.org/manifest.json").is_err());
        assert!(validate_manifest_url("http://127.0.0.1:7000/manifest.json").is_ok());

        let manifest = json!({
            "id": "org.wachcha.community",
            "name": "Community RU/TR Streams",
            "version": "1.2.0",
            "resources": ["catalog", "stream"],
            "types": ["movie", "series"]
        });
        let addon = parse_manifest(
            "https://addon.example.org/manifest.json",
            "https://addon.example.org",
            &manifest,
        )
        .unwrap();
        assert_eq!(addon.id, "org.wachcha.community");

        let stream_payload = json!({
            "streams": [{
                "title": "1080p RU Dub",
                "url": "https://cdn.streams.example.org/ep1.m3u8",
                "behaviorHints": {
                    "proxyHeaders": { "request": { "Referer": "https://origin.example.org/" } }
                }
            }]
        });
        let parsed = parse_streams(&addon, "tt1234", "tt1234:1:1", &stream_payload);
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].format, "hls");
        assert_eq!(parsed[0].headers.len(), 1);
        assert_eq!(parsed[0].allowed_hosts, vec!["cdn.streams.example.org"]);
    }
}
