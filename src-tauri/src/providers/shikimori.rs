//! Shikimori Public REST API provider — keyless Russian/English anime catalog,
//! ratings, genres, and MAL/Shikimori ID linking.

use crate::providers::{ExternalIds, MediaCategory, MediaDetail, MediaItem, SourceLink};
use reqwest::Client;
use serde_json::Value;

pub const BASE_URL: &str = "https://shikimori.io/api";
const ORIGIN: &str = "https://shikimori.io";

pub fn parse_anime_item(val: &Value, locale: &str) -> Option<MediaItem> {
    let id = val.get("id")?.as_u64()?;
    let en = val.get("name").and_then(|v| v.as_str()).unwrap_or("");
    let ru = val.get("russian").and_then(|v| v.as_str()).unwrap_or("");
    let title = if locale == "ru" && !ru.is_empty() {
        ru.to_string()
    } else if !en.is_empty() {
        en.to_string()
    } else {
        ru.to_string()
    };
    if title.is_empty() {
        return None;
    }
    let year = val
        .get("aired_on")
        .and_then(|v| v.as_str())
        .and_then(|s| s.get(0..4))
        .and_then(|y| y.parse::<u16>().ok());
    let rating = val
        .get("score")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<f32>().ok())
        .filter(|r| *r > 0.0);
    let poster = val
        .get("image")
        .and_then(|img| img.get("original").or_else(|| img.get("preview")))
        .and_then(|v| v.as_str())
        .map(|p| {
            if p.starts_with("https://") {
                p.to_string()
            } else {
                format!("{ORIGIN}{p}")
            }
        });

    Some(MediaItem {
        id: id.to_string(),
        provider: "shikimori".into(),
        category: MediaCategory::Anime,
        title,
        original_title: (!en.is_empty()).then(|| en.to_string()),
        year,
        rating,
        poster_url: poster,
        backdrop_url: None,
        genres: vec![],
        badges: vec!["Shikimori".into(), "MAL".into()],
        audio_languages: vec!["JP".into(), "RU".into()],
        external_ids: ExternalIds {
            shikimori: Some(id),
            mal: Some(id),
            ..Default::default()
        },
        stream_ready: false,
        sources: vec![SourceLink {
            provider: "shikimori".into(),
            id: id.to_string(),
            label: "Shikimori".into(),
        }],
    })
}

pub async fn search(client: &Client, query: &str, locale: &str) -> Result<Vec<MediaItem>, String> {
    let resp = client
        .get(format!("{BASE_URL}/animes"))
        .query(&[("search", query), ("limit", "15"), ("order", "popularity")])
        .send()
        .await
        .map_err(|e| format!("Shikimori search failed: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("Shikimori HTTP {}", resp.status().as_u16()));
    }
    let list = resp.json::<Vec<Value>>().await.map_err(|e| e.to_string())?;
    Ok(list
        .iter()
        .filter_map(|v| parse_anime_item(v, locale))
        .collect())
}

pub async fn detail(client: &Client, id: &str, locale: &str) -> Result<MediaDetail, String> {
    let resp = client
        .get(format!("{BASE_URL}/animes/{id}"))
        .send()
        .await
        .map_err(|e| format!("Shikimori detail failed: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("Shikimori detail HTTP {}", resp.status().as_u16()));
    }
    let val = resp.json::<Value>().await.map_err(|e| e.to_string())?;
    let mut item = parse_anime_item(&val, locale)
        .ok_or_else(|| "Invalid Shikimori detail payload.".to_string())?;
    if let Some(genres) = val.get("genres").and_then(|g| g.as_array()) {
        item.genres = genres
            .iter()
            .filter_map(|g| {
                let key = if locale == "ru" { "russian" } else { "name" };
                g.get(key)
                    .or_else(|| g.get("name"))
                    .and_then(|s| s.as_str())
                    .map(str::to_string)
            })
            .collect();
    }
    let synopsis = val
        .get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    Ok(MediaDetail {
        item,
        synopsis,
        status: val
            .get("status")
            .and_then(|v| v.as_str())
            .map(str::to_string),
        voices: vec![],
        episodes: vec![],
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_shikimori_locale_titles_and_mal_id() {
        let fixture = json!({
            "id": 52991,
            "name": "Sousou no Frieren",
            "russian": "Провожающая в последний путь Фрирен",
            "score": "9.12",
            "aired_on": "2023-09-29",
            "image": { "original": "/system/animes/original/52991.jpg" }
        });
        let ru_item = parse_anime_item(&fixture, "ru").unwrap();
        assert_eq!(ru_item.title, "Провожающая в последний путь Фрирен");
        assert_eq!(ru_item.external_ids.mal, Some(52991));
        assert_eq!(ru_item.year, Some(2023));
        let en_item = parse_anime_item(&fixture, "en").unwrap();
        assert_eq!(en_item.title, "Sousou no Frieren");
    }
}
