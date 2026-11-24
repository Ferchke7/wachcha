//! YummyAnime Public API catalog adapter with resilient 5s mirror failover
//! (`api.yani.tv` -> `old.yummyani.me/api` -> `ru.yummyani.me/api`) and 60s primary recovery.

use crate::providers::{ExternalIds, MediaCategory, MediaDetail, MediaItem, SourceLink};
use reqwest::Client;
use serde_json::Value;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

pub const MIRRORS: &[&str] = &[
    "https://api.yani.tv",
    "https://old.yummyani.me/api",
    "https://ru.yummyani.me/api",
];
const ATTEMPT_TIMEOUT: Duration = Duration::from_secs(5);
const PRIMARY_PROBE_INTERVAL: Duration = Duration::from_secs(60);

#[derive(Debug, Clone)]
pub struct MirrorState {
    active_index: usize,
    last_primary_probe: Option<Instant>,
}

impl Default for MirrorState {
    fn default() -> Self {
        Self {
            active_index: 0,
            last_primary_probe: None,
        }
    }
}

#[derive(Clone, Default)]
pub struct YummyPublicClient {
    state: Arc<Mutex<MirrorState>>,
}

impl YummyPublicClient {
    pub async fn active_mirror(&self) -> &'static str {
        let idx = self.state.lock().await.active_index;
        MIRRORS[idx.min(MIRRORS.len() - 1)]
    }

    pub fn should_failover_status(status: u16) -> bool {
        status == 408 || status >= 500
    }

    /// Performs a GET request with automatic 5s mirror failover on network/408/5xx errors.
    /// Never fails over on 401/403/404.
    pub async fn get_json(
        &self,
        client: &Client,
        path: &str,
        query: &[(&str, &str)],
        app_token: Option<&str>,
    ) -> Result<Value, String> {
        let start_idx = {
            let mut st = self.state.lock().await;
            // Periodically test primary restoration when on a backup mirror.
            if st.active_index > 0 {
                let due = st
                    .last_primary_probe
                    .map(|t| t.elapsed() >= PRIMARY_PROBE_INTERVAL)
                    .unwrap_or(true);
                if due {
                    st.last_primary_probe = Some(Instant::now());
                    0
                } else {
                    st.active_index
                }
            } else {
                0
            }
        };

        let mut last_err = String::from("Yummy Public API unavailable");
        for offset in 0..MIRRORS.len() {
            let idx = (start_idx + offset) % MIRRORS.len();
            let base = MIRRORS[idx];
            let url = format!("{base}{path}");
            let mut req = client
                .get(&url)
                .header("Lang", "ru")
                .timeout(ATTEMPT_TIMEOUT)
                .query(query);
            if let Some(tok) = app_token.filter(|t| !t.trim().is_empty()) {
                req = req.header("X-Application", tok.trim());
            }

            match req.send().await {
                Ok(resp) => {
                    let status = resp.status().as_u16();
                    if resp.status().is_success() {
                        match resp.json::<Value>().await {
                            Ok(val) => {
                                self.state.lock().await.active_index = idx;
                                return Ok(val);
                            }
                            Err(e) => {
                                last_err = format!("Malformed JSON from {base}: {e}");
                            }
                        }
                    } else if Self::should_failover_status(status) {
                        last_err = format!("{base} returned HTTP {status}");
                    } else {
                        return Err(format!("Yummy Public API returned HTTP {status}"));
                    }
                }
                Err(e) => {
                    last_err = format!("Network error on {base}: {e}");
                }
            }
        }
        Err(last_err)
    }

    pub async fn search(
        &self,
        client: &Client,
        query: &str,
        app_token: Option<&str>,
    ) -> Result<Vec<MediaItem>, String> {
        let val = self
            .get_json(
                client,
                "/anime",
                &[("q", query), ("limit", "15")],
                app_token,
            )
            .await?;
        let arr = val
            .get("response")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();
        Ok(arr.iter().filter_map(parse_yummy_item).collect())
    }

    pub async fn detail(
        &self,
        client: &Client,
        id: &str,
        app_token: Option<&str>,
    ) -> Result<MediaDetail, String> {
        let val = self
            .get_json(client, &format!("/anime/{id}"), &[], app_token)
            .await?;
        let resp = val
            .get("response")
            .ok_or_else(|| "Missing response field from Yummy API.".to_string())?;
        let item =
            parse_yummy_item(resp).ok_or_else(|| "Invalid Yummy detail payload.".to_string())?;
        let synopsis = resp
            .get("description")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        Ok(MediaDetail {
            item,
            synopsis,
            status: resp
                .get("anime_status")
                .and_then(|s| s.get("title"))
                .and_then(|v| v.as_str())
                .map(str::to_string),
            voices: vec![],
            episodes: vec![],
        })
    }
}

pub fn parse_yummy_item(val: &Value) -> Option<MediaItem> {
    let id = val.get("anime_id")?.as_u64()?;
    let title = val.get("title")?.as_str()?.to_string();
    let year = val.get("year").and_then(|v| v.as_u64()).map(|y| y as u16);
    let rating = val
        .get("rating")
        .and_then(|r| r.get("average"))
        .and_then(|v| v.as_f64())
        .map(|f| f as f32)
        .filter(|r| *r > 0.0);
    let poster = val
        .get("poster")
        .and_then(|p| p.get("big").or_else(|| p.get("medium")))
        .and_then(|v| v.as_str())
        .map(|u| {
            if u.starts_with("//") {
                format!("https:{u}")
            } else {
                u.to_string()
            }
        });
    let shikimori_id = val
        .get("remote_ids")
        .and_then(|r| r.get("shikimori_id"))
        .and_then(|v| v.as_u64());
    let mal_id = val
        .get("remote_ids")
        .and_then(|r| r.get("myanimelist_id"))
        .and_then(|v| v.as_u64());

    Some(MediaItem {
        id: id.to_string(),
        provider: "yummy_public".into(),
        category: MediaCategory::Anime,
        title,
        original_title: None,
        year,
        rating,
        poster_url: poster,
        backdrop_url: None,
        genres: vec![],
        badges: vec!["Yummy API".into()],
        audio_languages: vec!["RU".into()],
        external_ids: ExternalIds {
            shikimori: shikimori_id,
            mal: mal_id,
            ..Default::default()
        },
        stream_ready: false,
        sources: vec![SourceLink {
            provider: "yummy_public".into(),
            id: id.to_string(),
            label: "Yummy Public".into(),
        }],
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn failover_rules_ignore_client_4xx_except_408() {
        assert!(YummyPublicClient::should_failover_status(408));
        assert!(YummyPublicClient::should_failover_status(502));
        assert!(YummyPublicClient::should_failover_status(530));
        assert!(!YummyPublicClient::should_failover_status(401));
        assert!(!YummyPublicClient::should_failover_status(404));
        assert!(!YummyPublicClient::should_failover_status(420));
    }

    #[test]
    fn parses_yummy_item_and_protocol_relative_poster() {
        let fixture = json!({
            "anime_id": 1234,
            "title": "Магическая битва",
            "year": 2023,
            "rating": { "average": 8.8 },
            "poster": { "big": "//static.yummyani.me/posters/1234.jpg" },
            "remote_ids": { "shikimori_id": 40748, "myanimelist_id": 40748 }
        });
        let item = parse_yummy_item(&fixture).unwrap();
        assert_eq!(
            item.poster_url.as_deref(),
            Some("https://static.yummyani.me/posters/1234.jpg")
        );
        assert_eq!(item.external_ids.shikimori, Some(40748));
    }
}
