//! Allowlisted HTTPS image proxy bypassing WebView CORS restrictions safely inside Rust.

use base64::{engine::general_purpose::STANDARD, Engine};
use reqwest::Client;
use serde::Serialize;
use url::Url;

const MAX_IMAGE_BYTES: usize = 8 * 1024 * 1024;

const ALLOWED_IMAGE_SUFFIXES: &[&str] = &[
    "aniliberty.top",
    "anilibria.tv",
    "anilibria.top",
    "shikimori.io",
    "shikimori.one",
    "nyaa.shikimori.one",
    "image.tmdb.org",
    "static.tvmaze.com",
    "pic.rutubelist.ru",
    "pic.rtbcdn.ru",
    "rutube.ru",
    "m.media-amazon.com",
    "avatars.mds.yandex.net",
    "st.kp.yandex.net",
    "kinopoiskapiunofficial.tech",
    "yummyani.me",
    "yani.tv",
    "images.metahub.space",
];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchedImage {
    pub mime: String,
    pub base64: String,
    pub bytes: usize,
}

pub fn is_allowed_image_host(host: &str, extra_hosts: &[String]) -> bool {
    let lower = host.to_ascii_lowercase();
    ALLOWED_IMAGE_SUFFIXES
        .iter()
        .any(|suffix| lower == *suffix || lower.ends_with(&format!(".{suffix}")))
        || extra_hosts.iter().any(|h| lower == h.to_ascii_lowercase())
}

pub fn validate_image_url(raw: &str, extra_hosts: &[String]) -> Result<Url, String> {
    let parsed = Url::parse(raw).map_err(|_| "Invalid image URL.".to_string())?;
    if parsed.scheme() != "https" {
        return Err("Only HTTPS image URLs are allowed.".into());
    }
    if !parsed.username().is_empty() || parsed.password().is_some() || parsed.port().is_some() {
        return Err("Image URL must not include credentials or custom ports.".into());
    }
    let host = parsed
        .host_str()
        .ok_or_else(|| "Image URL is missing a host.".to_string())?;
    if !is_allowed_image_host(host, extra_hosts) {
        return Err(format!("Image host '{host}' is not in the allowlist."));
    }
    Ok(parsed)
}

pub async fn fetch_image(
    client: &Client,
    raw_url: &str,
    extra_hosts: &[String],
) -> Result<FetchedImage, String> {
    let url = validate_image_url(raw_url, extra_hosts)?;
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Image request failed: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "Image CDN returned HTTP {}",
            response.status().as_u16()
        ));
    }

    let mime = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(|s| {
            s.split(';')
                .next()
                .unwrap_or("image/jpeg")
                .trim()
                .to_string()
        })
        .unwrap_or_else(|| "image/jpeg".to_string());

    if !mime.starts_with("image/") {
        return Err(format!("Rejected non-image MIME type: {mime}"));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed reading image payload: {e}"))?;
    if bytes.len() > MAX_IMAGE_BYTES {
        return Err("Image exceeds 8 MiB safety cap.".into());
    }

    Ok(FetchedImage {
        mime,
        bytes: bytes.len(),
        base64: STANDARD.encode(&bytes),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_known_image_cdns_and_blocks_arbitrary_hosts() {
        assert!(validate_image_url("https://image.tmdb.org/t/p/w500/abc.jpg", &[]).is_ok());
        assert!(validate_image_url("https://aniliberty.top/storage/poster.webp", &[]).is_ok());
        assert!(validate_image_url("http://image.tmdb.org/t/p/w500/abc.jpg", &[]).is_err());
        assert!(validate_image_url("https://evil.example.com/x.png", &[]).is_err());
        assert!(
            validate_image_url("https://cdn.myaddon.org/p.jpg", &["cdn.myaddon.org".into()])
                .is_ok()
        );
    }
}
