//! GitHub Releases ETag conditional update checker without auth tokens.

use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

const RELEASES_URL: &str = "https://api.github.com/repos/Ferchke7/wachcha/releases/latest";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseInfo {
    pub tag_name: String,
    pub html_url: String,
    pub published_at: Option<String>,
}

#[derive(Default)]
struct UpdateCache {
    etag: Option<String>,
    latest: Option<ReleaseInfo>,
    backoff_until: Option<Instant>,
}

#[derive(Clone, Default)]
pub struct UpdateChecker {
    cache: Arc<Mutex<UpdateCache>>,
}

impl UpdateChecker {
    pub async fn check(&self, client: &Client) -> Result<Option<ReleaseInfo>, String> {
        let (etag, cached, blocked) = {
            let guard = self.cache.lock().await;
            let blocked = guard
                .backoff_until
                .map(|until| Instant::now() < until)
                .unwrap_or(false);
            (guard.etag.clone(), guard.latest.clone(), blocked)
        };
        if blocked {
            return Ok(cached);
        }

        let mut req = client.get(RELEASES_URL);
        if let Some(tag) = etag {
            req = req.header(reqwest::header::IF_NONE_MATCH, tag);
        }

        let resp = req
            .send()
            .await
            .map_err(|e| format!("Release check failed: {e}"))?;

        let status = resp.status().as_u16();
        if status == 304 {
            return Ok(cached);
        }
        if status == 404 || status == 403 || status == 429 {
            let mut guard = self.cache.lock().await;
            guard.backoff_until = Some(Instant::now() + Duration::from_secs(3600));
            return Ok(cached);
        }
        if !resp.status().is_success() {
            return Ok(cached);
        }

        let next_etag = resp
            .headers()
            .get(reqwest::header::ETAG)
            .and_then(|v| v.to_str().ok())
            .map(str::to_string);
        let parsed = resp
            .json::<serde_json::Value>()
            .await
            .map_err(|e| format!("Invalid release JSON: {e}"))?;

        let info = parsed
            .get("tag_name")
            .and_then(|v| v.as_str())
            .and_then(|tag| {
                let html_url = parsed.get("html_url")?.as_str()?;
                if !html_url.starts_with("https://github.com/") {
                    return None;
                }
                Some(ReleaseInfo {
                    tag_name: tag.to_string(),
                    html_url: html_url.to_string(),
                    published_at: parsed
                        .get("published_at")
                        .and_then(|v| v.as_str())
                        .map(str::to_string),
                })
            });

        let mut guard = self.cache.lock().await;
        guard.etag = next_etag;
        if info.is_some() {
            guard.latest = info.clone();
        }
        Ok(guard.latest.clone())
    }
}
