//! Bounded in-process transport for `wachcha-media://localhost/<provider>/<session>/<resource>`.
//! Keeps upstream headers, tokens, and CDN URLs exclusively inside Rust memory.

use rand::RngCore;
use regex::Regex;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use reqwest::Client;
use std::collections::HashMap;
use std::sync::{Arc, OnceLock};
use std::time::{Duration, Instant};
use tokio::sync::{Mutex, Semaphore};
use url::Url;

pub const MAX_SESSIONS: usize = 8;
pub const SESSION_IDLE_TTL: Duration = Duration::from_secs(180);
pub const SESSION_MAX_TTL: Duration = Duration::from_secs(45 * 60);
pub const MAX_PLAYLIST_BYTES: usize = 512 * 1024;
pub const MAX_SEGMENT_BYTES: usize = 32 * 1024 * 1024;
pub const MAX_RANGE_CHUNK_BYTES: u64 = 8 * 1024 * 1024;
pub const MAX_CONCURRENT_MEDIA_FETCHES: usize = 4;

#[derive(Debug, Clone)]
pub struct MediaResponse {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

impl MediaResponse {
    fn error(status: u16, message: &str) -> Self {
        Self {
            status,
            headers: vec![("content-type".into(), "text/plain; charset=utf-8".into())],
            body: message.as_bytes().to_vec(),
        }
    }
}

#[derive(Debug, Clone)]
struct MediaSession {
    provider: String,
    created: Instant,
    last_used: Instant,
    allowed_hosts: Vec<String>,
    upstream_headers: Vec<(String, String)>,
    resources: HashMap<String, Url>,
}

impl MediaSession {
    fn is_expired(&self, now: Instant) -> bool {
        now.duration_since(self.last_used) > SESSION_IDLE_TTL
            || now.duration_since(self.created) > SESSION_MAX_TTL
    }

    fn allows_host(&self, host: &str) -> bool {
        let lower = host.to_ascii_lowercase();
        self.allowed_hosts.iter().any(|allowed| {
            let pat = allowed.to_ascii_lowercase();
            if let Some(suffix) = pat.strip_prefix("*.") {
                lower == suffix || lower.ends_with(&format!(".{suffix}"))
            } else {
                lower == pat
            }
        })
    }

    fn register_url(&mut self, url: Url) -> Result<String, String> {
        if url.scheme() != "https" {
            return Err("Only HTTPS upstream media URLs are permitted.".into());
        }
        if !url.username().is_empty() || url.password().is_some() {
            return Err("Credentials in media URL are forbidden.".into());
        }
        let host = url
            .host_str()
            .ok_or_else(|| "Media URL is missing a host.".to_string())?;
        if !self.allows_host(host) {
            return Err(format!(
                "Host '{host}' is not allowed for provider '{}'.",
                self.provider
            ));
        }
        if let Some((existing_id, _)) = self.resources.iter().find(|(_, u)| *u == &url) {
            return Ok(existing_id.clone());
        }
        let id = random_hex_token();
        self.resources.insert(id.clone(), url);
        Ok(id)
    }
}

#[derive(Clone)]
pub struct MediaTransport {
    client: Arc<Mutex<Client>>,
    sessions: Arc<Mutex<HashMap<String, MediaSession>>>,
    semaphore: Arc<Semaphore>,
}

impl MediaTransport {
    pub fn new(client: Client) -> Self {
        Self {
            client: Arc::new(Mutex::new(client)),
            sessions: Arc::new(Mutex::new(HashMap::new())),
            semaphore: Arc::new(Semaphore::new(MAX_CONCURRENT_MEDIA_FETCHES)),
        }
    }

    pub async fn replace_client(&self, client: Client) {
        let mut guard = self.client.lock().await;
        *guard = client;
    }

    /// Registers a new bounded relay session for a winning stream candidate and returns
    /// an opaque `wachcha-media://localhost/<provider>/<session>/<resource>` URI.
    pub async fn register_stream(
        &self,
        provider: &str,
        stream_url: &str,
        allowed_hosts: Vec<String>,
        upstream_headers: Vec<(String, String)>,
    ) -> Result<String, String> {
        let parsed =
            Url::parse(stream_url).map_err(|_| "Invalid upstream stream URL.".to_string())?;
        let mut sessions = self.sessions.lock().await;
        let now = Instant::now();
        sessions.retain(|_, s| !s.is_expired(now));

        // Evict least-recently-used session if at cap.
        while sessions.len() >= MAX_SESSIONS {
            if let Some(oldest_key) = sessions
                .iter()
                .min_by_key(|(_, s)| s.last_used)
                .map(|(k, _)| k.clone())
            {
                sessions.remove(&oldest_key);
            } else {
                break;
            }
        }

        let session_id = random_hex_token();
        let mut session = MediaSession {
            provider: provider.to_string(),
            created: now,
            last_used: now,
            allowed_hosts,
            upstream_headers,
            resources: HashMap::new(),
        };
        let resource_id = session.register_url(parsed)?;
        sessions.insert(session_id.clone(), session);
        Ok(format!(
            "wachcha-media://localhost/{provider}/{session_id}/{resource_id}"
        ))
    }

    /// Serves a `wachcha-media://` request, enforcing origin validation, session lookup,
    /// Range clamping, HLS manifest rewriting, and strict byte limits.
    pub async fn serve_request(
        &self,
        method: &str,
        raw_uri: &str,
        origin: Option<&str>,
        range_header: Option<&str>,
    ) -> MediaResponse {
        if method == "OPTIONS" {
            return MediaResponse {
                status: 204,
                headers: cors_headers(origin),
                body: Vec::new(),
            };
        }
        if method != "GET" && method != "HEAD" {
            return MediaResponse::error(405, "Method Not Allowed");
        }
        if let Some(orig) = origin {
            if !is_allowed_origin(orig) {
                return MediaResponse::error(403, "Forbidden origin");
            }
        }

        let Ok(parsed_uri) = Url::parse(raw_uri) else {
            return MediaResponse::error(400, "Invalid media URI");
        };
        let Some((provider, session_id, resource_id)) = parse_media_path(parsed_uri.path()) else {
            return MediaResponse::error(400, "Invalid media resource path");
        };

        let (upstream_url, upstream_headers) = {
            let mut sessions = self.sessions.lock().await;
            let now = Instant::now();
            let Some(session) = sessions.get_mut(&session_id) else {
                return MediaResponse::error(404, "Media session expired or unknown");
            };
            if session.is_expired(now) || session.provider != provider {
                sessions.remove(&session_id);
                return MediaResponse::error(404, "Media session expired");
            }
            session.last_used = now;
            let Some(url) = session.resources.get(&resource_id).cloned() else {
                return MediaResponse::error(404, "Unknown media resource");
            };
            (url, session.upstream_headers.clone())
        };

        let Ok(_permit) = self.semaphore.clone().acquire_owned().await else {
            return MediaResponse::error(503, "Media transport busy");
        };

        let client = self.client.lock().await.clone();
        let mut req_builder = if method == "HEAD" {
            client.head(upstream_url.clone())
        } else {
            client.get(upstream_url.clone())
        };

        let mut hdr_map = HeaderMap::new();
        for (k, v) in upstream_headers {
            if let (Ok(name), Ok(val)) = (
                HeaderName::from_bytes(k.as_bytes()),
                HeaderValue::from_str(&v),
            ) {
                hdr_map.insert(name, val);
            }
        }
        if let Some(clamped_range) = range_header.and_then(clamp_range_header) {
            if let Ok(val) = HeaderValue::from_str(&clamped_range) {
                hdr_map.insert(reqwest::header::RANGE, val);
            }
        }
        req_builder = req_builder.headers(hdr_map);

        let Ok(resp) = req_builder.send().await else {
            return MediaResponse::error(502, "Upstream CDN request failed");
        };
        let status = resp.status().as_u16();
        let content_type = resp
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("application/octet-stream")
            .to_string();
        let content_range = resp
            .headers()
            .get(reqwest::header::CONTENT_RANGE)
            .and_then(|v| v.to_str().ok())
            .map(str::to_string);

        let is_hls = upstream_url.path().ends_with(".m3u8")
            || content_type.to_ascii_lowercase().contains("mpegurl");
        let max_bytes = if is_hls {
            MAX_PLAYLIST_BYTES
        } else {
            MAX_SEGMENT_BYTES
        };

        let Ok(raw_bytes) = resp.bytes().await else {
            return MediaResponse::error(502, "Failed reading upstream body");
        };
        if raw_bytes.len() > max_bytes {
            return MediaResponse::error(413, "Upstream media payload exceeds safety limit");
        }

        let mut out_headers = cors_headers(origin);
        out_headers.push(("content-type".into(), content_type));
        out_headers.push(("accept-ranges".into(), "bytes".into()));
        if let Some(cr) = content_range {
            out_headers.push(("content-range".into(), cr));
        }

        if is_hls && method == "GET" && (200..300).contains(&status) {
            let text = String::from_utf8_lossy(&raw_bytes);
            let rewritten = {
                let mut sessions = self.sessions.lock().await;
                if let Some(session) = sessions.get_mut(&session_id) {
                    rewrite_hls_playlist(&text, &upstream_url, &provider, &session_id, |resolved| {
                        session.register_url(resolved)
                    })
                } else {
                    return MediaResponse::error(404, "Session closed during playlist rewrite");
                }
            };
            return MediaResponse {
                status,
                headers: out_headers,
                body: rewritten.into_bytes(),
            };
        }

        MediaResponse {
            status,
            headers: out_headers,
            body: raw_bytes.to_vec(),
        }
    }

    pub async fn active_session_count(&self) -> usize {
        let mut sessions = self.sessions.lock().await;
        let now = Instant::now();
        sessions.retain(|_, s| !s.is_expired(now));
        sessions.len()
    }
}

pub fn random_hex_token() -> String {
    let mut bytes = [0u8; 16];
    rand::rng().fill_bytes(&mut bytes);
    let mut out = String::with_capacity(32);
    for b in bytes {
        use std::fmt::Write;
        let _ = write!(&mut out, "{b:02x}");
    }
    out
}

pub fn is_valid_media_path(path: &str) -> bool {
    parse_media_path(path).is_some()
}

fn parse_media_path(path: &str) -> Option<(String, String, String)> {
    let mut parts = path.trim_start_matches('/').split('/');
    let provider = parts.next()?;
    let session = parts.next()?;
    let resource = parts.next()?;
    if parts.next().is_some() {
        return None;
    }
    let valid_provider = !provider.is_empty()
        && provider.len() <= 32
        && provider
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_' || b == b'-');
    let is_hex32 =
        |s: &str| s.len() == 32 && s.bytes().all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f'));
    if valid_provider && is_hex32(session) && is_hex32(resource) {
        Some((provider.into(), session.into(), resource.into()))
    } else {
        None
    }
}

fn is_allowed_origin(origin: &str) -> bool {
    matches!(
        origin,
        "tauri://localhost"
            | "http://tauri.localhost"
            | "https://tauri.localhost"
            | "http://127.0.0.1:4179"
            | "http://localhost:4179"
    )
}

fn cors_headers(origin: Option<&str>) -> Vec<(String, String)> {
    let allow = origin
        .filter(|o| is_allowed_origin(o))
        .unwrap_or("tauri://localhost");
    vec![
        ("access-control-allow-origin".into(), allow.into()),
        (
            "access-control-allow-methods".into(),
            "GET, HEAD, OPTIONS".into(),
        ),
        ("access-control-allow-headers".into(), "Range".into()),
        (
            "access-control-expose-headers".into(),
            "Content-Length, Content-Range, Accept-Ranges".into(),
        ),
    ]
}

pub fn clamp_range_header(raw: &str) -> Option<String> {
    let spec = raw.trim().strip_prefix("bytes=")?;
    let (start_s, end_s) = spec.split_once('-')?;
    let start = start_s.trim().parse::<u64>().ok()?;
    let end = if end_s.trim().is_empty() {
        start.saturating_add(MAX_RANGE_CHUNK_BYTES - 1)
    } else {
        let req_end = end_s.trim().parse::<u64>().ok()?;
        if req_end < start {
            return None;
        }
        req_end.min(start.saturating_add(MAX_RANGE_CHUNK_BYTES - 1))
    };
    Some(format!("bytes={start}-{end}"))
}

/// Rewrites every URI inside an HLS `.m3u8` playlist (variants, keys, maps, subtitles, segments)
/// into opaque `wachcha-media://localhost/<provider>/<session>/<resource>` URIs.
pub fn rewrite_hls_playlist<F>(
    playlist: &str,
    base_url: &Url,
    provider: &str,
    session_id: &str,
    mut register: F,
) -> String
where
    F: FnMut(Url) -> Result<String, String>,
{
    static URI_ATTR: OnceLock<Regex> = OnceLock::new();
    let uri_re = URI_ATTR.get_or_init(|| Regex::new(r#"URI="([^"]+)""#).expect("valid URI regex"));

    let mut out = Vec::new();
    for line in playlist.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            out.push(String::new());
            continue;
        }
        if trimmed.starts_with('#') {
            if trimmed.contains("URI=\"") {
                let rewritten = uri_re.replace_all(line, |caps: &regex::Captures| {
                    let raw = &caps[1];
                    match base_url.join(raw).ok().and_then(|u| register(u).ok()) {
                        Some(res_id) => {
                            format!(r#"URI="wachcha-media://localhost/{provider}/{session_id}/{res_id}""#)
                        }
                        None => caps[0].to_string(),
                    }
                });
                out.push(rewritten.into_owned());
            } else {
                out.push(line.to_string());
            }
            continue;
        }
        if let Ok(resolved) = base_url.join(trimmed) {
            if let Ok(res_id) = register(resolved) {
                out.push(format!(
                    "wachcha-media://localhost/{provider}/{session_id}/{res_id}"
                ));
                continue;
            }
        }
        out.push(line.to_string());
    }
    out.join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rewrites_hls_segments_and_keys_to_opaque_protocol() {
        let playlist = "\
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-KEY:METHOD=AES-128,URI=\"keys/enc.key\"
#EXT-X-MAP:URI=\"init.mp4\"
#EXTINF:6.0,
seg-001.ts
https://cdn.example.org/hls/seg-002.ts
";
        let base = Url::parse("https://cdn.example.org/hls/master.m3u8").unwrap();
        let mut counter = 0usize;
        let rewritten =
            rewrite_hls_playlist(playlist, &base, "rutube", "0".repeat(32).as_str(), |u| {
                assert_eq!(u.host_str(), Some("cdn.example.org"));
                counter += 1;
                Ok(format!("{counter:032x}"))
            });
        assert_eq!(counter, 4);
        assert!(rewritten.contains("URI=\"wachcha-media://localhost/rutube/"));
        assert!(!rewritten.contains("https://cdn.example.org"));
    }

    #[tokio::test]
    async fn enforces_host_allowlist_and_session_cap() {
        let client = Client::new();
        let transport = MediaTransport::new(client);

        let rejected = transport
            .register_stream(
                "rutube",
                "https://untrusted.evil.test/video.m3u8",
                vec!["*.rtbcdn.ru".into()],
                vec![],
            )
            .await;
        assert!(rejected.is_err());

        for i in 0..10 {
            let ok = transport
                .register_stream(
                    "rutube",
                    &format!("https://video.rtbcdn.ru/stream/{i}.m3u8"),
                    vec!["*.rtbcdn.ru".into()],
                    vec![],
                )
                .await;
            assert!(ok.is_ok());
        }
        assert_eq!(transport.active_session_count().await, MAX_SESSIONS);
    }

    #[test]
    fn clamps_large_byte_ranges() {
        assert_eq!(
            clamp_range_header("bytes=0-"),
            Some(format!("bytes=0-{}", MAX_RANGE_CHUNK_BYTES - 1))
        );
        assert_eq!(
            clamp_range_header("bytes=100-500"),
            Some("bytes=100-500".into())
        );
        assert_eq!(clamp_range_header("bytes=500-100"), None);
    }
}
