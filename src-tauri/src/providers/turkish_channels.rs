//! Curated open Turkish TV broadcasters & popular Turkish Dizi directory
//! (TRT 1, ATV, Kanal D, Star TV, Show TV, NOW) with canonical IMDb/TMDB IDs
//! for seamless enrichment and Stremio community addon bridging.

use crate::providers::{Episode, ExternalIds, MediaCategory, MediaDetail, MediaItem, SourceLink};

pub fn curated_turkish_catalog() -> Vec<MediaItem> {
    vec![
        MediaItem {
            id: "tr-kurulus-osman".into(),
            provider: "turkish_channels".into(),
            category: MediaCategory::TurkishDizi,
            title: "Kuruluş: Osman".into(),
            original_title: Some("Kuruluş: Osman".into()),
            year: Some(2019),
            rating: Some(8.6),
            poster_url: None,
            backdrop_url: None,
            genres: vec!["History".into(), "Action".into(), "Drama".into()],
            badges: vec!["ATV TR".into(), "Dizi".into()],
            audio_languages: vec!["TR".into(), "RU".into()],
            external_ids: ExternalIds {
                imdb: Some("tt11093750".into()),
                tmdb: Some(95594),
                ..Default::default()
            },
            stream_ready: false,
            sources: vec![SourceLink {
                provider: "turkish_channels".into(),
                id: "tr-kurulus-osman".into(),
                label: "ATV Official".into(),
            }],
        },
        MediaItem {
            id: "tr-yali-capkini".into(),
            provider: "turkish_channels".into(),
            category: MediaCategory::TurkishDizi,
            title: "Yalı Çapkını".into(),
            original_title: Some("Yalı Çapkını".into()),
            year: Some(2022),
            rating: Some(8.3),
            poster_url: None,
            backdrop_url: None,
            genres: vec!["Drama".into(), "Romance".into()],
            badges: vec!["Star TV".into(), "Dizi".into()],
            audio_languages: vec!["TR".into(), "RU".into()],
            external_ids: ExternalIds {
                imdb: Some("tt21431986".into()),
                tmdb: Some(211089),
                ..Default::default()
            },
            stream_ready: false,
            sources: vec![SourceLink {
                provider: "turkish_channels".into(),
                id: "tr-yali-capkini".into(),
                label: "Star TV Official".into(),
            }],
        },
        MediaItem {
            id: "tr-kizilcik-serbeti".into(),
            provider: "turkish_channels".into(),
            category: MediaCategory::TurkishDizi,
            title: "Kızılcık Şerbeti".into(),
            original_title: Some("Kızılcık Şerbeti".into()),
            year: Some(2022),
            rating: Some(8.4),
            poster_url: None,
            backdrop_url: None,
            genres: vec!["Drama".into(), "Family".into()],
            badges: vec!["Show TV".into(), "Dizi".into()],
            audio_languages: vec!["TR".into(), "RU".into()],
            external_ids: ExternalIds {
                imdb: Some("tt22297608".into()),
                tmdb: Some(213173),
                ..Default::default()
            },
            stream_ready: false,
            sources: vec![SourceLink {
                provider: "turkish_channels".into(),
                id: "tr-kizilcik-serbeti".into(),
                label: "Show TV Official".into(),
            }],
        },
        MediaItem {
            id: "tr-muhtesem-yuzyil".into(),
            provider: "turkish_channels".into(),
            category: MediaCategory::TurkishDizi,
            title: "Muhteşem Yüzyıl".into(),
            original_title: Some("Muhteşem Yüzyıl".into()),
            year: Some(2011),
            rating: Some(8.8),
            poster_url: None,
            backdrop_url: None,
            genres: vec!["History".into(), "Drama".into()],
            badges: vec!["Star TV Classic".into(), "Dizi".into()],
            audio_languages: vec!["TR".into(), "RU".into()],
            external_ids: ExternalIds {
                imdb: Some("tt1848620".into()),
                tmdb: Some(46061),
                ..Default::default()
            },
            stream_ready: false,
            sources: vec![SourceLink {
                provider: "turkish_channels".into(),
                id: "tr-muhtesem-yuzyil".into(),
                label: "Turkish Classic".into(),
            }],
        },
        MediaItem {
            id: "tr-teskilat".into(),
            provider: "turkish_channels".into(),
            category: MediaCategory::TurkishDizi,
            title: "Teşkilat".into(),
            original_title: Some("Teşkilat".into()),
            year: Some(2021),
            rating: Some(8.2),
            poster_url: None,
            backdrop_url: None,
            genres: vec!["Action".into(), "Thriller".into()],
            badges: vec!["TRT 1".into(), "Dizi".into()],
            audio_languages: vec!["TR".into(), "RU".into()],
            external_ids: ExternalIds {
                imdb: Some("tt13711618".into()),
                tmdb: Some(119316),
                ..Default::default()
            },
            stream_ready: false,
            sources: vec![SourceLink {
                provider: "turkish_channels".into(),
                id: "tr-teskilat".into(),
                label: "TRT 1 Official".into(),
            }],
        },
    ]
}

pub fn search(query: &str) -> Vec<MediaItem> {
    let q = query.trim().to_lowercase();
    if q.is_empty() {
        return curated_turkish_catalog();
    }
    curated_turkish_catalog()
        .into_iter()
        .filter(|item| {
            item.title.to_lowercase().contains(&q)
                || item
                    .original_title
                    .as_deref()
                    .map(|t| t.to_lowercase().contains(&q))
                    .unwrap_or(false)
                || item.badges.iter().any(|b| b.to_lowercase().contains(&q))
                || item.genres.iter().any(|g| g.to_lowercase().contains(&q))
                || q.contains("turk")
                || q.contains("dizi")
                || q.contains("турец")
        })
        .collect()
}

pub fn detail(id: &str) -> Option<MediaDetail> {
    let item = curated_turkish_catalog().into_iter().find(|i| i.id == id)?;
    let synopsis = format!(
        "{} — Featured Turkish television drama with canonical IMDb/TMDB linking. Connect a TMDB key for full episode synopses or install a Stremio / M3U8 addon in Sources to play localized Turkish or Russian-dubbed streams directly in Wachcha.",
        item.title
    );
    let ep = Episode {
        id: format!("{}-s1e1", item.id),
        season: 1,
        number: 1.0,
        title: format!("{} · Episode 1", item.title),
        duration_seconds: Some(7200),
        thumbnail_url: None,
        skips: vec![],
        candidates: vec![],
    };
    Some(MediaDetail {
        item,
        synopsis,
        status: Some("Broadcast Catalog".into()),
        voices: vec!["Original (TR)".into(), "Russian Dub (via Addon)".into()],
        episodes: vec![ep],
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn searches_turkish_dizis_by_title_network_and_vertical_keyword() {
        assert!(!search("osman").is_empty());
        assert!(!search("TRT").is_empty());
        assert_eq!(search("dizi").len(), curated_turkish_catalog().len());
        assert!(detail("tr-kurulus-osman").is_some());
    }
}
