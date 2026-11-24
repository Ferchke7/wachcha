//! TVMaze keyless public TV & Turkish network show/episode catalog (`api.tvmaze.com`).

use crate::providers::{Episode, ExternalIds, MediaCategory, MediaDetail, MediaItem, SourceLink};
use regex::Regex;
use reqwest::Client;
use serde_json::Value;
use std::sync::OnceLock;

pub const BASE_URL: &str = "https://api.tvmaze.com";

const TURKISH_NETWORKS: &[&str] = &[
    "trt 1",
    "atv",
    "kanal d",
    "star tv",
    "show tv",
    "now",
    "fox",
    "tv8",
    "trt tabii",
    "blutv",
];

fn strip_html(raw: &str) -> String {
    static TAGS: OnceLock<Regex> = OnceLock::new();
    let re = TAGS.get_or_init(|| Regex::new(r"<[^>]+>").expect("valid html tag regex"));
    re.replace_all(raw, "").trim().to_string()
}

pub fn parse_show(val: &Value) -> Option<MediaItem> {
    let id = val.get("id")?.as_u64()?;
    let name = val.get("name")?.as_str()?.to_string();
    let language = val.get("language").and_then(|v| v.as_str()).unwrap_or("");
    let network_country = val
        .get("network")
        .and_then(|n| n.get("country"))
        .and_then(|c| c.get("code"))
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let network_name = val
        .get("network")
        .and_then(|n| n.get("name"))
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let genres: Vec<String> = val
        .get("genres")
        .and_then(|g| g.as_array())
        .map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(str::to_string))
                .collect()
        })
        .unwrap_or_default();

    let is_turkish = language.eq_ignore_ascii_case("turkish")
        || network_country.eq_ignore_ascii_case("TR")
        || TURKISH_NETWORKS
            .iter()
            .any(|n| network_name.eq_ignore_ascii_case(n));

    let category = if is_turkish {
        MediaCategory::TurkishDizi
    } else if genres.iter().any(|g| g.eq_ignore_ascii_case("anime")) {
        MediaCategory::Anime
    } else {
        MediaCategory::Series
    };

    let year = val
        .get("premiered")
        .and_then(|v| v.as_str())
        .and_then(|s| s.get(0..4))
        .and_then(|y| y.parse::<u16>().ok());
    let rating = val
        .get("rating")
        .and_then(|r| r.get("average"))
        .and_then(|v| v.as_f64())
        .map(|f| f as f32);
    let poster = val
        .get("image")
        .and_then(|img| img.get("medium").or_else(|| img.get("original")))
        .and_then(|v| v.as_str())
        .map(|u| u.replace("http://", "https://"));
    let imdb = val
        .get("externals")
        .and_then(|e| e.get("imdb"))
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(str::to_string);

    let mut badges = vec!["TVMaze".into()];
    if !network_name.is_empty() {
        badges.push(network_name.to_string());
    }

    Some(MediaItem {
        id: id.to_string(),
        provider: "tvmaze".into(),
        category,
        title: name,
        original_title: None,
        year,
        rating,
        poster_url: poster,
        backdrop_url: None,
        genres,
        badges,
        audio_languages: if is_turkish {
            vec!["TR".into()]
        } else if !language.is_empty() {
            vec![language
                .chars()
                .take(2)
                .collect::<String>()
                .to_ascii_uppercase()]
        } else {
            vec![]
        },
        external_ids: ExternalIds {
            imdb,
            tvmaze: Some(id),
            ..Default::default()
        },
        stream_ready: false,
        sources: vec![SourceLink {
            provider: "tvmaze".into(),
            id: id.to_string(),
            label: "TVMaze".into(),
        }],
    })
}

pub async fn search(client: &Client, query: &str) -> Result<Vec<MediaItem>, String> {
    let resp = client
        .get(format!("{BASE_URL}/search/shows"))
        .query(&[("q", query)])
        .send()
        .await
        .map_err(|e| format!("TVMaze search failed: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("TVMaze HTTP {}", resp.status().as_u16()));
    }
    let rows = resp.json::<Vec<Value>>().await.map_err(|e| e.to_string())?;
    Ok(rows
        .iter()
        .filter_map(|r| r.get("show").and_then(parse_show))
        .collect())
}

pub async fn detail(client: &Client, id: &str) -> Result<MediaDetail, String> {
    let resp = client
        .get(format!("{BASE_URL}/shows/{id}"))
        .query(&[("embed", "episodes")])
        .send()
        .await
        .map_err(|e| format!("TVMaze detail failed: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("TVMaze detail HTTP {}", resp.status().as_u16()));
    }
    let val = resp.json::<Value>().await.map_err(|e| e.to_string())?;
    let item = parse_show(&val).ok_or_else(|| "Invalid TVMaze show payload.".to_string())?;
    let synopsis = val
        .get("summary")
        .and_then(|v| v.as_str())
        .map(strip_html)
        .unwrap_or_default();

    let episodes = val
        .get("_embedded")
        .and_then(|e| e.get("episodes"))
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|ep| {
                    let ep_id = ep.get("id")?.as_u64()?;
                    let season = ep.get("season").and_then(|v| v.as_u64()).unwrap_or(1) as u32;
                    let number = ep.get("number").and_then(|v| v.as_f64()).unwrap_or(1.0) as f32;
                    let title = ep
                        .get("name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("Episode")
                        .to_string();
                    let duration = ep
                        .get("runtime")
                        .and_then(|v| v.as_u64())
                        .map(|m| (m * 60) as u32);
                    let thumb = ep
                        .get("image")
                        .and_then(|i| i.get("medium"))
                        .and_then(|v| v.as_str())
                        .map(|u| u.replace("http://", "https://"));
                    Some(Episode {
                        id: ep_id.to_string(),
                        season,
                        number,
                        title,
                        duration_seconds: duration,
                        thumbnail_url: thumb,
                        skips: vec![],
                        candidates: vec![],
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(MediaDetail {
        item,
        synopsis,
        status: val
            .get("status")
            .and_then(|v| v.as_str())
            .map(str::to_string),
        voices: vec![],
        episodes,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn classifies_turkish_network_show_and_strips_html() {
        let fixture = json!({
            "id": 45012,
            "name": "Kuruluş: Osman",
            "language": "Turkish",
            "genres": ["Drama", "History"],
            "premiered": "2019-11-20",
            "rating": { "average": 8.6 },
            "network": { "name": "ATV", "country": { "code": "TR" } },
            "externals": { "imdb": "tt11093750" },
            "image": { "medium": "https://static.tvmaze.com/uploads/images/medium_portrait/osman.jpg" }
        });
        let item = parse_show(&fixture).unwrap();
        assert_eq!(item.category, MediaCategory::TurkishDizi);
        assert_eq!(item.external_ids.imdb.as_deref(), Some("tt11093750"));
        assert_eq!(strip_html("<p>Hello <b>world</b></p>"), "Hello world");
    }
}
