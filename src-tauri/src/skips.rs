//! Skip marker normalization (opening, ending, recap) from provider metadata and HLS tags.

use regex::Regex;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SkipKind {
    Opening,
    Ending,
    Recap,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkipInterval {
    pub kind: SkipKind,
    pub from: f64,
    pub to: f64,
}

impl SkipInterval {
    pub fn validated(kind: SkipKind, from: f64, to: f64) -> Option<Self> {
        if !from.is_finite() || !to.is_finite() || from < 0.0 || to <= from + 2.0 {
            return None;
        }
        Some(Self { kind, from, to })
    }
}

/// Normalize and deduplicate skip markers without inventing approximate ranges.
pub fn normalize_skips(mut intervals: Vec<SkipInterval>) -> Vec<SkipInterval> {
    intervals
        .retain(|s| s.from.is_finite() && s.to.is_finite() && s.from >= 0.0 && s.to > s.from + 2.0);
    intervals.sort_by(|a, b| a.from.total_cmp(&b.from));
    let mut out: Vec<SkipInterval> = Vec::with_capacity(intervals.len());
    for item in intervals {
        let duplicate = out
            .iter()
            .any(|existing| existing.kind == item.kind && (existing.from - item.from).abs() < 2.0);
        if !duplicate {
            out.push(item);
        }
    }
    out
}

/// Parse HLS `#EXT-X-DATERANGE` tags carrying opening/ending duration metadata.
pub fn parse_hls_daterange_skips(playlist: &str) -> Vec<SkipInterval> {
    static RE: OnceLock<Regex> = OnceLock::new();
    let re = RE.get_or_init(|| {
        Regex::new(r#"(?m)^#EXT-X-DATERANGE:([^\r\n]+)$"#).expect("valid daterange regex")
    });
    let mut found = Vec::new();
    for cap in re.captures_iter(playlist) {
        let attrs = &cap[1];
        let lower = attrs.to_ascii_lowercase();
        let kind = if lower.contains("opening") || lower.contains("intro") {
            Some(SkipKind::Opening)
        } else if lower.contains("ending") || lower.contains("outro") || lower.contains("credits") {
            Some(SkipKind::Ending)
        } else if lower.contains("recap") {
            Some(SkipKind::Recap)
        } else {
            None
        };
        let Some(kind) = kind else { continue };
        let start = extract_num_attr(attrs, "X-WACHCHA-START")
            .or_else(|| extract_num_attr(attrs, "X-START"))
            .unwrap_or(0.0);
        let dur = extract_num_attr(attrs, "DURATION")
            .or_else(|| extract_num_attr(attrs, "PLANNED-DURATION"));
        if let Some(duration) = dur {
            if let Some(interval) = SkipInterval::validated(kind, start, start + duration) {
                found.push(interval);
            }
        }
    }
    normalize_skips(found)
}

fn extract_num_attr(attrs: &str, key: &str) -> Option<f64> {
    for part in attrs.split(',') {
        if let Some((k, v)) = part.split_once('=') {
            if k.trim().eq_ignore_ascii_case(key) {
                let cleaned = v.trim().trim_matches('"');
                if let Ok(parsed) = cleaned.parse::<f64>() {
                    return Some(parsed);
                }
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn filters_invalid_and_deduplicates_skips() {
        let skips = normalize_skips(vec![
            SkipInterval {
                kind: SkipKind::Opening,
                from: 15.0,
                to: 105.0,
            },
            SkipInterval {
                kind: SkipKind::Opening,
                from: 15.5,
                to: 104.5,
            },
            SkipInterval {
                kind: SkipKind::Ending,
                from: 1300.0,
                to: 1301.0,
            },
            SkipInterval {
                kind: SkipKind::Ending,
                from: 1320.0,
                to: 1410.0,
            },
        ]);
        assert_eq!(skips.len(), 2);
        assert_eq!(skips[0].kind, SkipKind::Opening);
        assert_eq!(skips[1].kind, SkipKind::Ending);
    }

    #[test]
    fn parses_hls_daterange_intro() {
        let m3u8 =
            "#EXTM3U\n#EXT-X-DATERANGE:ID=\"intro\",X-START=12.0,DURATION=90.0,CLASS=\"opening\"\n";
        let skips = parse_hls_daterange_skips(m3u8);
        assert_eq!(skips.len(), 1);
        assert_eq!(skips[0].from, 12.0);
        assert_eq!(skips[0].to, 102.0);
    }
}
