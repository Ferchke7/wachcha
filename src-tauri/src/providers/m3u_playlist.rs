//! Standards-compliant M3U / M3U8 playlist parser for free-to-air Russian, Turkish,
//! and international live TV & VOD HLS streams.

use crate::providers::{
    Episode, ExternalIds, MediaCategory, MediaDetail, MediaItem, SourceLink, StreamCandidate,
};
use regex::Regex;
use reqwest::Client;
use std::sync::OnceLock;
use url::Url;

#[derive(Debug, Clone)]
pub struct M3uEntry {
    pub id: String,
    pub name: String,
    pub group: String,
    pub language: Option<String>,
    pub logo: Option<String>,
    pub url: String,
}

fn extract_attr(line: &str, name: &str) -> Option<String> {
    let needle = format!(r#"{name}="([^"]+)""#);
    Regex::new(&needle)
        .ok()?
        .captures(line)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().trim().to_string())
        .filter(|s| !s.is_empty())
}

pub fn parse_m3u(playlist_id: &str, content: &str) -> Vec<M3uEntry> {
    static EXTINF_TITLE: OnceLock<Regex> = OnceLock::new();
    let title_re = EXTINF_TITLE.get_or_init(|| Regex::new(r",([^,\r\n]+)$").expect("valid regex"));

    let mut out = Vec::new();
    let mut pending_meta: Option<(String, String, Option<String>, Option<String>)> = None;

    for raw_line in content.lines() {
        let line = raw_line.trim();
        if line.is_empty() {
            continue;
        }
        if line.starts_with("#EXTINF:") {
            let title = title_re
                .captures(line)
                .and_then(|c| c.get(1))
                .map(|m| m.as_str().trim().to_string())
                .unwrap_or_else(|| "Channel".into());
            let group = extract_attr(line, "group-title").unwrap_or_else(|| "Live TV".into());
            let lang = extract_attr(line, "tvg-language");
            let logo = extract_attr(line, "tvg-logo").filter(|u| u.starts_with("https://"));
            pending_meta = Some((title, group, lang, logo));
            continue;
        }
        if line.starts_with('#') {
            continue;
        }
        if let Ok(parsed) = Url::parse(line) {
            if matches!(parsed.scheme(), "https" | "http") {
                if let Some((name, group, language, logo)) = pending_meta.take() {
                    let idx = out.len();
                    out.push(M3uEntry {
                        id: format!("{playlist_id}:{idx}"),
                        name,
                        group,
                        language,
                        logo,
                        url: parsed.to_string(),
                    });
                }
            }
        }
    }
    out
}

pub fn entry_to_media_item(entry: &M3uEntry) -> MediaItem {
    MediaItem {
        id: entry.id.clone(),
        provider: "m3u_playlist".into(),
        category: MediaCategory::LiveTv,
        title: entry.name.clone(),
        original_title: None,
        year: None,
        rating: None,
        poster_url: entry.logo.clone(),
        backdrop_url: None,
        genres: vec![entry.group.clone()],
        badges: vec!["M3U8".into(), "LIVE".into(), entry.group.clone()],
        audio_languages: entry.language.clone().into_iter().collect(),
        external_ids: ExternalIds::default(),
        stream_ready: true,
        sources: vec![SourceLink {
            provider: "m3u_playlist".into(),
            id: entry.id.clone(),
            label: "M3U8 Live".into(),
        }],
    }
}

pub fn entry_to_detail(entry: &M3uEntry) -> MediaDetail {
    let item = entry_to_media_item(entry);
    let candidate = StreamCandidate {
        provider: "m3u_playlist".into(),
        media_id: entry.id.clone(),
        episode_id: entry.id.clone(),
        voice_label: entry.group.clone(),
        quality: "Live HLS".into(),
        format: if entry.url.contains(".mpd") {
            "dash".into()
        } else {
            "hls".into()
        },
        url: entry.url.clone(),
        preferred: true,
        headers: vec![],
        allowed_hosts: vec![],
        skips: vec![],
        subtitles: vec![],
    };
    MediaDetail {
        item,
        synopsis: format!("Live/VOD M3U8 channel from group '{}'.", entry.group),
        status: Some("LIVE".into()),
        voices: vec![entry.group.clone()],
        episodes: vec![Episode {
            id: entry.id.clone(),
            season: 1,
            number: 1.0,
            title: entry.name.clone(),
            duration_seconds: None,
            thumbnail_url: entry.logo.clone(),
            skips: vec![],
            candidates: vec![candidate],
        }],
    }
}

pub async fn fetch_playlist(
    client: &Client,
    playlist_id: &str,
    raw_url: &str,
) -> Result<Vec<M3uEntry>, String> {
    let parsed = Url::parse(raw_url.trim()).map_err(|_| "Invalid playlist URL.".to_string())?;
    if parsed.scheme() != "https" {
        return Err("M3U8 playlist URL must use HTTPS.".into());
    }
    let resp = client
        .get(parsed)
        .send()
        .await
        .map_err(|e| format!("Failed fetching M3U8 playlist: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!(
            "M3U8 playlist returned HTTP {}",
            resp.status().as_u16()
        ));
    }
    let text = resp.text().await.map_err(|e| e.to_string())?;
    Ok(parse_m3u(playlist_id, &text))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_extinf_attributes_and_skips_unsafe_schemes() {
        let sample = "\
#EXTM3U
#EXTINF:-1 tvg-logo=\"https://logo.example.org/trt.png\" group-title=\"Turkish TV\" tvg-language=\"TR\",TRT 1 HD
https://tv.trt.net.tr/live/trt1.m3u8
#EXTINF:-1 group-title=\"Unsafe\",Local File
file:///etc/passwd
";
        let entries = parse_m3u("fta", sample);
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "TRT 1 HD");
        assert_eq!(entries[0].group, "Turkish TV");
        assert_eq!(entries[0].language.as_deref(), Some("TR"));
    }
}
