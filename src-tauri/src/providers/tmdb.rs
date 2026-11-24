//! TMDB v3 multilingual provider (optional free user key) powering Movies,
//! Russian Cinema (original_language=ru), and Turkish Dizis (original_language=tr) in EN/RU/TR.

use crate::providers::{Episode, ExternalIds, MediaCategory, MediaDetail, MediaItem, SourceLink};
use reqwest::Client;
use serde_json::Value;

pub const BASE_URL: &str = "https://api.themoviedb.org/3";
const IMG_POSTER: &str = "https://image.tmdb.org/t/p/w500";
const IMG_BACKDROP: &str = "https://image.tmdb.org/t/p/w1280";

pub fn tmdb_lang(locale: &str) -> &'static str {
    match locale {
        "ru" => "ru-RU",
        "tr" => "tr-TR",
        _ => "en-US",
    }
}

pub fn parse_tmdb_item(val: &Value, forced_kind: Option<&str>) -> Option<MediaItem> {
    let id = val.get("id")?.as_u64()?;
    let media_type = forced_kind
        .or_else(|| val.get("media_type").and_then(|v| v.as_str()))
        .unwrap_or("movie");
    if media_type == "person" {
        return None;
    }

    let orig_lang = val
        .get("original_language")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let genre_ids: Vec<u64> = val
        .get("genre_ids")
        .and_then(|g| g.as_array())
        .map(|a| a.iter().filter_map(|v| v.as_u64()).collect())
        .unwrap_or_default();

    let category = if media_type == "tv" && orig_lang == "tr" {
        MediaCategory::TurkishDizi
    } else if orig_lang == "ja" && genre_ids.contains(&16) {
        MediaCategory::Anime
    } else if media_type == "tv" {
        MediaCategory::Series
    } else {
        MediaCategory::Movie
    };

    let title = val
        .get("title")
        .or_else(|| val.get("name"))
        .and_then(|v| v.as_str())?
        .to_string();
    let original_title = val
        .get("original_title")
        .or_else(|| val.get("original_name"))
        .and_then(|v| v.as_str())
        .map(str::to_string);
    let year = val
        .get("release_date")
        .or_else(|| val.get("first_air_date"))
        .and_then(|v| v.as_str())
        .and_then(|s| s.get(0..4))
        .and_then(|y| y.parse::<u16>().ok());
    let rating = val
        .get("vote_average")
        .and_then(|v| v.as_f64())
        .map(|f| (f * 10.0).round() as f32 / 10.0)
        .filter(|r| *r > 0.0);

    let poster_url = val
        .get("poster_path")
        .and_then(|v| v.as_str())
        .map(|p| format!("{IMG_POSTER}{p}"));
    let backdrop_url = val
        .get("backdrop_path")
        .and_then(|v| v.as_str())
        .map(|p| format!("{IMG_BACKDROP}{p}"));

    let compound_id = format!("{media_type}:{id}");
    let mut badges = vec!["TMDB".into()];
    if orig_lang == "tr" {
        badges.push("TR Dizi".into());
    } else if orig_lang == "ru" {
        badges.push("RU Cinema".into());
    }

    Some(MediaItem {
        id: compound_id.clone(),
        provider: "tmdb".into(),
        category,
        title,
        original_title,
        year,
        rating,
        poster_url,
        backdrop_url,
        genres: vec![],
        badges,
        audio_languages: if orig_lang.is_empty() {
            vec![]
        } else {
            vec![orig_lang.to_ascii_uppercase()]
        },
        external_ids: ExternalIds {
            tmdb: Some(id),
            ..Default::default()
        },
        stream_ready: false,
        sources: vec![SourceLink {
            provider: "tmdb".into(),
            id: compound_id,
            label: "TMDB".into(),
        }],
    })
}

pub async fn search(
    client: &Client,
    api_key: &str,
    query: &str,
    locale: &str,
) -> Result<Vec<MediaItem>, String> {
    let resp = client
        .get(format!("{BASE_URL}/search/multi"))
        .query(&[
            ("api_key", api_key),
            ("query", query),
            ("language", tmdb_lang(locale)),
            ("include_adult", "false"),
        ])
        .send()
        .await
        .map_err(|e| format!("TMDB search failed: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("TMDB HTTP {}", resp.status().as_u16()));
    }
    let json = resp.json::<Value>().await.map_err(|e| e.to_string())?;
    let results = json
        .get("results")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    Ok(results
        .iter()
        .filter_map(|v| parse_tmdb_item(v, None))
        .collect())
}

pub async fn discover_by_language(
    client: &Client,
    api_key: &str,
    kind: &str,
    orig_lang: &str,
    locale: &str,
) -> Result<Vec<MediaItem>, String> {
    let resp = client
        .get(format!("{BASE_URL}/discover/{kind}"))
        .query(&[
            ("api_key", api_key),
            ("with_original_language", orig_lang),
            ("sort_by", "popularity.desc"),
            ("language", tmdb_lang(locale)),
        ])
        .send()
        .await
        .map_err(|e| format!("TMDB discover failed: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("TMDB discover HTTP {}", resp.status().as_u16()));
    }
    let json = resp.json::<Value>().await.map_err(|e| e.to_string())?;
    let results = json
        .get("results")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    Ok(results
        .iter()
        .filter_map(|v| parse_tmdb_item(v, Some(kind)))
        .collect())
}

pub async fn detail(
    client: &Client,
    api_key: &str,
    compound_id: &str,
    locale: &str,
) -> Result<MediaDetail, String> {
    let (kind, num_id) = compound_id
        .split_once(':')
        .unwrap_or(("movie", compound_id));
    let resp = client
        .get(format!("{BASE_URL}/{kind}/{num_id}"))
        .query(&[
            ("api_key", api_key),
            ("language", tmdb_lang(locale)),
            ("append_to_response", "external_ids"),
        ])
        .send()
        .await
        .map_err(|e| format!("TMDB detail failed: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("TMDB detail HTTP {}", resp.status().as_u16()));
    }
    let val = resp.json::<Value>().await.map_err(|e| e.to_string())?;
    let mut item = parse_tmdb_item(&val, Some(kind))
        .ok_or_else(|| "Invalid TMDB detail payload.".to_string())?;
    if let Some(imdb) = val
        .get("external_ids")
        .and_then(|e| e.get("imdb_id"))
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
    {
        item.external_ids.imdb = Some(imdb.to_string());
    }
    if let Some(genres) = val.get("genres").and_then(|g| g.as_array()) {
        item.genres = genres
            .iter()
            .filter_map(|g| g.get("name").and_then(|n| n.as_str()).map(str::to_string))
            .collect();
    }

    let mut episodes = Vec::new();
    if kind == "tv" {
        if let Ok(season_resp) = client
            .get(format!("{BASE_URL}/tv/{num_id}/season/1"))
            .query(&[("api_key", api_key), ("language", tmdb_lang(locale))])
            .send()
            .await
        {
            if season_resp.status().is_success() {
                if let Ok(season_json) = season_resp.json::<Value>().await {
                    if let Some(arr) = season_json.get("episodes").and_then(|e| e.as_array()) {
                        for ep in arr {
                            let ep_num = ep
                                .get("episode_number")
                                .and_then(|v| v.as_u64())
                                .unwrap_or(1);
                            let ep_title = ep
                                .get("name")
                                .and_then(|v| v.as_str())
                                .unwrap_or("Episode")
                                .to_string();
                            let runtime = ep
                                .get("runtime")
                                .and_then(|v| v.as_u64())
                                .map(|m| (m * 60) as u32);
                            let still = ep
                                .get("still_path")
                                .and_then(|v| v.as_str())
                                .map(|p| format!("{IMG_POSTER}{p}"));
                            episodes.push(Episode {
                                id: format!("s1e{ep_num}"),
                                season: 1,
                                number: ep_num as f32,
                                title: ep_title,
                                duration_seconds: runtime,
                                thumbnail_url: still,
                                skips: vec![],
                                candidates: vec![],
                            });
                        }
                    }
                }
            }
        }
    }

    Ok(MediaDetail {
        item,
        synopsis: val
            .get("overview")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
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
    fn classifies_turkish_dizi_and_russian_cinema_from_original_language() {
        let dizi = json!({
            "id": 211089,
            "media_type": "tv",
            "name": "Зимородок",
            "original_name": "Yalı Çapkını",
            "original_language": "tr",
            "first_air_date": "2022-09-23",
            "vote_average": 8.42,
            "poster_path": "/yali.jpg"
        });
        let parsed = parse_tmdb_item(&dizi, None).unwrap();
        assert_eq!(parsed.category, MediaCategory::TurkishDizi);
        assert_eq!(parsed.rating, Some(8.4));
        assert!(parsed.badges.contains(&"TR Dizi".to_string()));

        let ru_movie = json!({
            "id": 999,
            "media_type": "movie",
            "title": "Брат",
            "original_title": "Брат",
            "original_language": "ru",
            "release_date": "1997-05-17",
            "vote_average": 8.1
        });
        let parsed_ru = parse_tmdb_item(&ru_movie, None).unwrap();
        assert_eq!(parsed_ru.category, MediaCategory::Movie);
        assert!(parsed_ru.badges.contains(&"RU Cinema".to_string()));
    }
}
