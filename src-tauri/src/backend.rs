//! Central Wachcha backend orchestrating multi-vertical catalog search,
//! staggered parallel stream resolution (300ms stagger, 2s priority window),
//! bounded 30s resolution cache, provider configuration, and `wachcha-media://` transport.

use crate::downloads::DownloadManager;
use crate::images::{self, FetchedImage};
use crate::media::MediaTransport;
use crate::providers::{
    aniliberty, deduplicate_items, m3u_playlist, rutube, shikimori, stremio_addon, tmdb,
    turkish_channels, tvmaze, yummy_public::YummyPublicClient, CatalogShelf, MediaCategory,
    MediaDetail, MediaItem, ProviderHealth, ProviderInfo, QualityOption, ResolvedStream,
    SearchQuery, SearchResponse, StreamCandidate, StreamResolution,
};
use crate::proxy_pool::{build_http_client, validate_proxy_url, ProxyConfig, ProxyReport};
use crate::session::{M3uPlaylistEntry, SavedSession, StremioAddonEntry};
use crate::updates::{ReleaseInfo, UpdateChecker};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;
use url::Url;

const RESOLUTION_CACHE_MAX: usize = 64;
const RESOLUTION_CACHE_TTL: Duration = Duration::from_secs(30);
const STAGGER_STEP: Duration = Duration::from_millis(300);
const PRIORITY_WINDOW: Duration = Duration::from_secs(2);
const PROVIDER_TIMEOUT: Duration = Duration::from_secs(8);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfigPatch {
    pub id: String,
    pub enabled: Option<bool>,
    pub api_key: Option<String>,
}

#[derive(Default)]
struct ConfigState {
    provider_enabled: HashMap<String, bool>,
    provider_keys: HashMap<String, String>,
    addons: Vec<StremioAddonEntry>,
    playlists: Vec<M3uPlaylistEntry>,
    m3u_entries: Vec<m3u_playlist::M3uEntry>,
    proxy: ProxyConfig,
}

impl ConfigState {
    fn is_enabled(&self, id: &str) -> bool {
        *self.provider_enabled.get(id).unwrap_or(&true)
    }

    fn key(&self, id: &str) -> Option<String> {
        self.provider_keys
            .get(id)
            .filter(|k| !k.trim().is_empty())
            .cloned()
    }

    fn extra_image_hosts(&self) -> Vec<String> {
        self.addons
            .iter()
            .filter_map(|a| Url::parse(&a.base_url).ok())
            .filter_map(|u| u.host_str().map(str::to_string))
            .collect()
    }
}

#[derive(Clone)]
pub struct Backend {
    client: Arc<Mutex<Client>>,
    pub media: MediaTransport,
    pub downloads: DownloadManager,
    yummy: YummyPublicClient,
    config: Arc<Mutex<ConfigState>>,
    resolution_cache: Arc<Mutex<HashMap<String, (Instant, StreamResolution)>>>,
    updater: UpdateChecker,
}

impl Backend {
    pub fn new() -> Result<Self, String> {
        let cfg = ProxyConfig::default();
        let api_client = build_http_client(&cfg, true, PROVIDER_TIMEOUT)?;
        let media_client = build_http_client(&cfg, false, Duration::from_secs(15))?;
        Ok(Self {
            client: Arc::new(Mutex::new(api_client)),
            media: MediaTransport::new(media_client),
            downloads: DownloadManager::default(),
            yummy: YummyPublicClient::default(),
            config: Arc::new(Mutex::new(ConfigState::default())),
            resolution_cache: Arc::new(Mutex::new(HashMap::new())),
            updater: UpdateChecker::default(),
        })
    }

    pub async fn hydrate_session(&self, session: SavedSession) -> Result<(), String> {
        {
            let mut cfg = self.config.lock().await;
            cfg.provider_enabled = session.provider_enabled;
            cfg.provider_keys = session.provider_keys;
            cfg.addons = session.stremio_addons;
            cfg.playlists = session.m3u_playlists;
            cfg.proxy = ProxyConfig {
                enabled: session.proxy_enabled,
                url: session.proxy_url,
            };
        }
        let proxy_cfg = self.config.lock().await.proxy.clone();
        if proxy_cfg.enabled {
            let _ = self.apply_proxy(proxy_cfg).await;
        }
        Ok(())
    }

    pub async fn export_session(&self) -> SavedSession {
        let cfg = self.config.lock().await;
        SavedSession {
            provider_enabled: cfg.provider_enabled.clone(),
            provider_keys: cfg.provider_keys.clone(),
            stremio_addons: cfg.addons.clone(),
            m3u_playlists: cfg.playlists.clone(),
            proxy_enabled: cfg.proxy.enabled,
            proxy_url: cfg.proxy.url.clone(),
        }
    }

    pub async fn apply_proxy(&self, config: ProxyConfig) -> Result<ProxyReport, String> {
        let report = if config.enabled {
            let raw = config
                .url
                .as_deref()
                .ok_or_else(|| "Proxy URL is required when proxy is enabled.".to_string())?;
            let (_, rep) = validate_proxy_url(raw)?;
            rep
        } else {
            ProxyReport {
                enabled: false,
                scheme: None,
                host: None,
            }
        };
        let api_client = build_http_client(&config, true, PROVIDER_TIMEOUT)?;
        let media_client = build_http_client(&config, false, Duration::from_secs(15))?;
        *self.client.lock().await = api_client;
        self.media.replace_client(media_client).await;
        self.config.lock().await.proxy = config;
        Ok(report)
    }

    pub async fn list_providers(&self) -> Vec<ProviderInfo> {
        let cfg = self.config.lock().await;
        let mut list = vec![
            ProviderInfo {
                id: "aniliberty".into(),
                name: "AniLiberty API v1".into(),
                description: "Keyless Russian-dubbed anime catalog + direct HLS (480p/720p/1080p) & skip markers.".into(),
                categories: vec![MediaCategory::Anime],
                enabled: cfg.is_enabled("aniliberty"),
                requires_key: false,
                key_configured: true,
                keyless: true,
                stream_capable: true,
                kind: "native".into(),
            },
            ProviderInfo {
                id: "shikimori".into(),
                name: "Shikimori Public API".into(),
                description: "Keyless Russian/English anime metadata, ratings, genres & MAL ID reconciliation.".into(),
                categories: vec![MediaCategory::Anime],
                enabled: cfg.is_enabled("shikimori"),
                requires_key: false,
                key_configured: true,
                keyless: true,
                stream_capable: false,
                kind: "native".into(),
            },
            ProviderInfo {
                id: "yummy_public".into(),
                name: "YummyAnime Public API".into(),
                description: "Anime catalog & schedules with automatic 5s mirror failover and primary recovery.".into(),
                categories: vec![MediaCategory::Anime],
                enabled: cfg.is_enabled("yummy_public"),
                requires_key: false,
                key_configured: cfg.key("yummy_public").is_some(),
                keyless: true,
                stream_capable: false,
                kind: "native".into(),
            },
            ProviderInfo {
                id: "tmdb".into(),
                name: "TMDB v3 Multilingual".into(),
                description: "Movies, Russian Cinema (RU), and Turkish Dizis (TR) localized in EN/RU/TR.".into(),
                categories: vec![MediaCategory::Movie, MediaCategory::Series, MediaCategory::TurkishDizi],
                enabled: cfg.is_enabled("tmdb"),
                requires_key: true,
                key_configured: cfg.key("tmdb").is_some(),
                keyless: false,
                stream_capable: false,
                kind: "native".into(),
            },
            ProviderInfo {
                id: "tvmaze".into(),
                name: "TVMaze Open Catalog".into(),
                description: "Keyless global TV & Turkish broadcast networks (TRT 1, ATV, Kanal D, Star TV, Show TV).".into(),
                categories: vec![MediaCategory::Series, MediaCategory::TurkishDizi],
                enabled: cfg.is_enabled("tvmaze"),
                requires_key: false,
                key_configured: true,
                keyless: true,
                stream_capable: false,
                kind: "native".into(),
            },
            ProviderInfo {
                id: "rutube".into(),
                name: "Rutube Public Catalog".into(),
                description: "Free Russian movies, classic Mosfilm channels, documentaries & public HLS streams.".into(),
                categories: vec![MediaCategory::Movie, MediaCategory::Series],
                enabled: cfg.is_enabled("rutube"),
                requires_key: false,
                key_configured: true,
                keyless: true,
                stream_capable: true,
                kind: "native".into(),
            },
            ProviderInfo {
                id: "turkish_channels".into(),
                name: "Turkish Official Broadcasters".into(),
                description: "Curated Turkish dizi directory (TRT, ATV, Star TV, Show TV) with IMDb/TMDB linking.".into(),
                categories: vec![MediaCategory::TurkishDizi],
                enabled: cfg.is_enabled("turkish_channels"),
                requires_key: false,
                key_configured: true,
                keyless: true,
                stream_capable: false,
                kind: "native".into(),
            },
        ];

        for addon in &cfg.addons {
            list.push(ProviderInfo {
                id: format!("addon:{}", addon.id),
                name: addon.name.clone(),
                description: format!(
                    "Stremio Addon v{} ({})",
                    addon.version,
                    addon.resources.join(", ")
                ),
                categories: addon
                    .types
                    .iter()
                    .map(|t| stremio_addon::map_stremio_type(t))
                    .collect(),
                enabled: addon.enabled,
                requires_key: false,
                key_configured: true,
                keyless: true,
                stream_capable: addon.resources.iter().any(|r| r == "stream"),
                kind: "stremio".into(),
            });
        }
        list
    }

    pub async fn configure_provider(
        &self,
        patch: ProviderConfigPatch,
    ) -> Result<ProviderInfo, String> {
        {
            let mut cfg = self.config.lock().await;
            if let Some(addon_id) = patch.id.strip_prefix("addon:") {
                if let Some(addon) = cfg.addons.iter_mut().find(|a| a.id == addon_id) {
                    if let Some(en) = patch.enabled {
                        addon.enabled = en;
                    }
                }
            } else {
                if let Some(en) = patch.enabled {
                    cfg.provider_enabled.insert(patch.id.clone(), en);
                }
                if let Some(key) = patch.api_key {
                    let trimmed = key.trim().to_string();
                    if trimmed.is_empty() {
                        cfg.provider_keys.remove(&patch.id);
                    } else {
                        cfg.provider_keys.insert(patch.id.clone(), trimmed);
                    }
                }
            }
        }
        self.list_providers()
            .await
            .into_iter()
            .find(|p| p.id == patch.id)
            .ok_or_else(|| format!("Unknown provider '{}'.", patch.id))
    }

    pub async fn install_stremio_addon(
        &self,
        manifest_url: &str,
    ) -> Result<StremioAddonEntry, String> {
        let client = self.client.lock().await.clone();
        let entry = stremio_addon::fetch_manifest(&client, manifest_url).await?;
        let mut cfg = self.config.lock().await;
        cfg.addons.retain(|a| a.id != entry.id);
        cfg.addons.push(entry.clone());
        Ok(entry)
    }

    pub async fn remove_stremio_addon(&self, addon_id: &str) -> Result<(), String> {
        let clean = addon_id.strip_prefix("addon:").unwrap_or(addon_id);
        let mut cfg = self.config.lock().await;
        cfg.addons.retain(|a| a.id != clean);
        Ok(())
    }

    pub async fn add_m3u_playlist(
        &self,
        name: &str,
        url: &str,
    ) -> Result<M3uPlaylistEntry, String> {
        let client = self.client.lock().await.clone();
        let id = format!("pl-{}", &crate::media::random_hex_token()[..8]);
        let entries = m3u_playlist::fetch_playlist(&client, &id, url).await?;
        let pl = M3uPlaylistEntry {
            id: id.clone(),
            name: name.trim().to_string(),
            url: url.trim().to_string(),
            enabled: true,
        };
        let mut cfg = self.config.lock().await;
        cfg.playlists.push(pl.clone());
        cfg.m3u_entries.extend(entries);
        Ok(pl)
    }

    pub async fn search_catalog(&self, query: SearchQuery) -> SearchResponse {
        let q = query.text.trim().to_string();
        let locale = query.locale.unwrap_or_else(|| "en".into());
        if q.is_empty() {
            return SearchResponse {
                query: q,
                items: vec![],
                provider_errors: vec![],
            };
        }

        let client = self.client.lock().await.clone();
        let (
            en_ali,
            en_shiki,
            en_yummy,
            en_tmdb,
            tmdb_key,
            yummy_tok,
            en_tvmaze,
            en_rutube,
            en_tr,
            addons,
            m3u,
        ) = {
            let cfg = self.config.lock().await;
            (
                cfg.is_enabled("aniliberty"),
                cfg.is_enabled("shikimori"),
                cfg.is_enabled("yummy_public"),
                cfg.is_enabled("tmdb"),
                cfg.key("tmdb"),
                cfg.key("yummy_public"),
                cfg.is_enabled("tvmaze"),
                cfg.is_enabled("rutube"),
                cfg.is_enabled("turkish_channels"),
                cfg.addons
                    .iter()
                    .filter(|a| a.enabled)
                    .cloned()
                    .collect::<Vec<_>>(),
                cfg.m3u_entries.clone(),
            )
        };

        let want = |cat: MediaCategory, prov: &str| {
            let cat_ok = query.category.map(|c| c == cat).unwrap_or(true);
            let prov_ok = query.provider.as_deref().map(|p| p == prov).unwrap_or(true);
            cat_ok && prov_ok
        };

        let mut tasks: Vec<tokio::task::JoinHandle<(String, Result<Vec<MediaItem>, String>)>> =
            Vec::new();

        if en_ali && want(MediaCategory::Anime, "aniliberty") {
            let c = client.clone();
            let q2 = q.clone();
            tasks.push(tokio::spawn(async move {
                ("aniliberty".into(), aniliberty::search(&c, &q2).await)
            }));
        }
        if en_shiki && want(MediaCategory::Anime, "shikimori") {
            let c = client.clone();
            let q2 = q.clone();
            let loc = locale.clone();
            tasks.push(tokio::spawn(async move {
                ("shikimori".into(), shikimori::search(&c, &q2, &loc).await)
            }));
        }
        if en_yummy && want(MediaCategory::Anime, "yummy_public") {
            let c = client.clone();
            let q2 = q.clone();
            let y = self.yummy.clone();
            tasks.push(tokio::spawn(async move {
                (
                    "yummy_public".into(),
                    y.search(&c, &q2, yummy_tok.as_deref()).await,
                )
            }));
        }
        if en_tmdb {
            if let Some(key) = tmdb_key {
                let c = client.clone();
                let q2 = q.clone();
                let loc = locale.clone();
                tasks.push(tokio::spawn(async move {
                    ("tmdb".into(), tmdb::search(&c, &key, &q2, &loc).await)
                }));
            }
        }
        if en_tvmaze
            && (want(MediaCategory::Series, "tvmaze") || want(MediaCategory::TurkishDizi, "tvmaze"))
        {
            let c = client.clone();
            let q2 = q.clone();
            tasks.push(tokio::spawn(async move {
                ("tvmaze".into(), tvmaze::search(&c, &q2).await)
            }));
        }
        if en_rutube
            && (want(MediaCategory::Movie, "rutube") || want(MediaCategory::Series, "rutube"))
        {
            let c = client.clone();
            let q2 = q.clone();
            tasks.push(tokio::spawn(async move {
                ("rutube".into(), rutube::search(&c, &q2).await)
            }));
        }
        for addon in addons {
            let c = client.clone();
            let q2 = q.clone();
            tasks.push(tokio::spawn(async move {
                let id = format!("addon:{}", addon.id);
                (id, stremio_addon::search_addon(&c, &addon, &q2).await)
            }));
        }

        let mut all_items = Vec::new();
        let mut errors = Vec::new();

        if en_tr && want(MediaCategory::TurkishDizi, "turkish_channels") {
            all_items.extend(turkish_channels::search(&q));
        }
        let q_lower = q.to_lowercase();
        for entry in m3u {
            if entry.name.to_lowercase().contains(&q_lower)
                || entry.group.to_lowercase().contains(&q_lower)
            {
                all_items.push(m3u_playlist::entry_to_media_item(&entry));
            }
        }

        for handle in tasks {
            if let Ok((prov, res)) = handle.await {
                match res {
                    Ok(items) => all_items.extend(items),
                    Err(e) => errors.push(format!("{prov}: {e}")),
                }
            }
        }

        if let Some(cat) = query.category {
            all_items.retain(|i| i.category == cat);
        }
        if let Some(prov) = query.provider.as_deref() {
            all_items.retain(|i| i.provider == prov);
        }

        SearchResponse {
            query: q,
            items: deduplicate_items(all_items),
            provider_errors: errors,
        }
    }

    pub async fn get_home_shelves(&self, locale: &str) -> Vec<CatalogShelf> {
        let client = self.client.lock().await.clone();
        let (tmdb_key, en_ali, en_tr, en_rutube) = {
            let cfg = self.config.lock().await;
            (
                cfg.key("tmdb"),
                cfg.is_enabled("aniliberty"),
                cfg.is_enabled("turkish_channels"),
                cfg.is_enabled("rutube"),
            )
        };

        let mut shelves = Vec::new();

        if en_ali {
            if let Ok(items) = aniliberty::latest(&client, 12).await {
                if !items.is_empty() {
                    shelves.push(CatalogShelf {
                        id: "trending-anime".into(),
                        title_key: "shelf.trendingAnime".into(),
                        provider_badge: "AniLiberty v1 · Direct HLS".into(),
                        category: MediaCategory::Anime,
                        items,
                    });
                }
            }
        }

        let mut dizi_items = Vec::new();
        if let Some(ref key) = tmdb_key {
            if let Ok(items) = tmdb::discover_by_language(&client, key, "tv", "tr", locale).await {
                dizi_items.extend(items);
            }
        }
        if en_tr {
            dizi_items.extend(turkish_channels::curated_turkish_catalog());
        }
        if !dizi_items.is_empty() {
            shelves.push(CatalogShelf {
                id: "turkish-dizis".into(),
                title_key: "shelf.turkishDizis".into(),
                provider_badge: "TMDB TR · Official Broadcasters".into(),
                category: MediaCategory::TurkishDizi,
                items: deduplicate_items(dizi_items),
            });
        }

        let mut ru_items = Vec::new();
        if let Some(ref key) = tmdb_key {
            if let Ok(items) = tmdb::discover_by_language(&client, key, "movie", "ru", locale).await
            {
                ru_items.extend(items);
            }
        }
        if en_rutube && ru_items.is_empty() {
            if let Ok(items) = rutube::search(&client, "Мосфильм кино").await {
                ru_items.extend(items);
            }
        }
        if !ru_items.is_empty() {
            shelves.push(CatalogShelf {
                id: "russian-cinema".into(),
                title_key: "shelf.russianCinema".into(),
                provider_badge: "Rutube Public · TMDB RU".into(),
                category: MediaCategory::Movie,
                items: deduplicate_items(ru_items),
            });
        }

        shelves
    }

    pub async fn get_media_detail(
        &self,
        provider: &str,
        id: &str,
        locale: &str,
    ) -> Result<MediaDetail, String> {
        let client = self.client.lock().await.clone();
        match provider {
            "aniliberty" => aniliberty::detail(&client, id).await,
            "shikimori" => shikimori::detail(&client, id, locale).await,
            "yummy_public" => {
                let tok = self.config.lock().await.key("yummy_public");
                self.yummy.detail(&client, id, tok.as_deref()).await
            }
            "tmdb" => {
                let key = self
                    .config
                    .lock()
                    .await
                    .key("tmdb")
                    .ok_or_else(|| "TMDB API key is not configured.".to_string())?;
                tmdb::detail(&client, &key, id, locale).await
            }
            "tvmaze" => tvmaze::detail(&client, id).await,
            "rutube" => rutube::detail(&client, id).await,
            "turkish_channels" => {
                turkish_channels::detail(id).ok_or_else(|| "Turkish title not found.".into())
            }
            "m3u_playlist" => {
                let cfg = self.config.lock().await;
                cfg.m3u_entries
                    .iter()
                    .find(|e| e.id == id)
                    .map(m3u_playlist::entry_to_detail)
                    .ok_or_else(|| "M3U8 channel not found.".into())
            }
            other if other.starts_with("addon:") => {
                let addon_id = other.strip_prefix("addon:").unwrap_or("");
                let addon = self
                    .config
                    .lock()
                    .await
                    .addons
                    .iter()
                    .find(|a| a.id == addon_id)
                    .cloned()
                    .ok_or_else(|| format!("Addon '{addon_id}' not installed."))?;
                let mut parts = id.splitn(3, '|');
                let _ = parts.next();
                let st_type = parts.next().unwrap_or("movie");
                let raw_id = parts.next().unwrap_or(id);
                stremio_addon::detail_addon(&client, &addon, st_type, raw_id).await
            }
            _ => Err(format!("Unsupported provider '{provider}'.")),
        }
    }

    /// Resolves stream candidates in parallel with 300ms stagger and 2s preferred priority window,
    /// registering header-gated streams on `wachcha-media://` only for winning resolved streams.
    pub async fn resolve_streams(
        &self,
        candidates: Vec<StreamCandidate>,
    ) -> Result<StreamResolution, String> {
        if candidates.is_empty() {
            return Err("No stream candidates provided.".into());
        }
        let cache_key = format!(
            "{}:{}:{}",
            candidates[0].provider,
            candidates[0].episode_id,
            candidates.len()
        );
        {
            let mut cache = self.resolution_cache.lock().await;
            let now = Instant::now();
            cache.retain(|_, (ts, _)| now.duration_since(*ts) < RESOLUTION_CACHE_TTL);
            if let Some((_, hit)) = cache.get(&cache_key) {
                return Ok(hit.clone());
            }
        }

        let media = self.media.clone();
        let preferred_idx = candidates.iter().position(|c| c.preferred).unwrap_or(0);
        let mut handles = Vec::with_capacity(candidates.len());
        for (idx, cand) in candidates.iter().cloned().enumerate() {
            let m = media.clone();
            handles.push(tokio::spawn(async move {
                if idx > 0 {
                    tokio::time::sleep(STAGGER_STEP * (idx as u32)).await;
                }
                let res = resolve_single_candidate(&m, cand).await;
                (idx, res)
            }));
        }

        let mut resolved_map: Vec<(usize, ResolvedStream)> = Vec::new();
        let deadline = Instant::now() + PRIORITY_WINDOW;
        for handle in handles {
            let wait = if resolved_map.is_empty() {
                Duration::from_secs(10)
            } else {
                deadline.saturating_duration_since(Instant::now())
            };
            if let Ok(Ok((idx, Ok(stream)))) = tokio::time::timeout(wait, handle).await {
                resolved_map.push((idx, stream));
            }
        }

        if resolved_map.is_empty() {
            return Err("All stream candidates failed resolution.".into());
        }
        resolved_map.sort_by_key(|(idx, _)| if *idx == preferred_idx { 0 } else { *idx + 1 });
        let streams: Vec<ResolvedStream> = resolved_map.into_iter().map(|(_, s)| s).collect();
        let resolution = StreamResolution {
            provider: streams[0].provider.clone(),
            episode_id: candidates[0].episode_id.clone(),
            streams,
        };

        let mut cache = self.resolution_cache.lock().await;
        if cache.len() >= RESOLUTION_CACHE_MAX {
            if let Some(oldest) = cache
                .iter()
                .min_by_key(|(_, (ts, _))| *ts)
                .map(|(k, _)| k.clone())
            {
                cache.remove(&oldest);
            }
        }
        cache.insert(cache_key, (Instant::now(), resolution.clone()));
        Ok(resolution)
    }

    pub async fn inspect_qualities(&self, candidates: Vec<StreamCandidate>) -> Vec<QualityOption> {
        candidates
            .into_iter()
            .map(|c| QualityOption {
                provider: c.provider,
                quality: c.quality,
                format: c.format,
                voice_label: c.voice_label,
            })
            .collect()
    }

    pub async fn check_provider_health(&self) -> Vec<ProviderHealth> {
        let client = self.client.lock().await.clone();
        let yummy_mirror = self.yummy.active_mirror().await.to_string();
        let probes = [
            (
                "aniliberty",
                format!("{}/anime/releases/latest?limit=1", aniliberty::BASE_URL),
            ),
            (
                "shikimori",
                format!("{}/animes?limit=1", shikimori::BASE_URL),
            ),
            ("yummy_public", format!("{yummy_mirror}/anime?limit=1")),
            ("tvmaze", format!("{}/shows/1", tvmaze::BASE_URL)),
            (
                "rutube",
                format!(
                    "{}/search/video/?query=cinema&format=json",
                    rutube::BASE_URL
                ),
            ),
        ];

        let mut handles = Vec::new();
        for (name, url) in probes {
            let c = client.clone();
            handles.push(tokio::spawn(async move {
                let started = Instant::now();
                match c.get(&url).timeout(Duration::from_secs(5)).send().await {
                    Ok(resp) => ProviderHealth {
                        provider: name.into(),
                        active_mirror: url,
                        healthy: resp.status().is_success(),
                        latency_ms: Some(started.elapsed().as_millis() as u64),
                        detail: format!("HTTP {}", resp.status().as_u16()),
                    },
                    Err(e) => ProviderHealth {
                        provider: name.into(),
                        active_mirror: url,
                        healthy: false,
                        latency_ms: None,
                        detail: e.to_string(),
                    },
                }
            }));
        }

        let mut out = Vec::new();
        for h in handles {
            if let Ok(item) = h.await {
                out.push(item);
            }
        }
        out
    }

    pub async fn fetch_image(&self, raw_url: &str) -> Result<FetchedImage, String> {
        let client = self.client.lock().await.clone();
        let extra = self.config.lock().await.extra_image_hosts();
        images::fetch_image(&client, raw_url, &extra).await
    }

    pub async fn check_release_update(&self) -> Result<Option<ReleaseInfo>, String> {
        let client = self.client.lock().await.clone();
        self.updater.check(&client).await
    }
}

async fn resolve_single_candidate(
    media: &MediaTransport,
    cand: StreamCandidate,
) -> Result<ResolvedStream, String> {
    let parsed = Url::parse(&cand.url).map_err(|_| "Invalid candidate stream URL.".to_string())?;
    let host = parsed.host_str().unwrap_or_default().to_string();
    if parsed.scheme() != "https" && !(parsed.scheme() == "http" && host == "127.0.0.1") {
        return Err("Candidate stream must use HTTPS.".into());
    }

    let needs_relay = !cand.headers.is_empty();
    let final_url = if needs_relay {
        let hosts = if cand.allowed_hosts.is_empty() {
            vec![host.clone()]
        } else {
            cand.allowed_hosts.clone()
        };
        media
            .register_stream(&cand.provider, &cand.url, hosts, cand.headers.clone())
            .await?
    } else {
        cand.url.clone()
    };

    Ok(ResolvedStream {
        provider: cand.provider,
        quality: cand.quality,
        format: cand.format,
        url: final_url,
        relayed: needs_relay,
        source_host: host,
        voice_label: cand.voice_label,
        skips: cand.skips,
        subtitles: cand.subtitles,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn resolves_direct_and_header_relayed_candidates_in_priority_order() {
        let backend = Backend::new().unwrap();
        let res = backend
            .resolve_streams(vec![
                StreamCandidate {
                    provider: "aniliberty".into(),
                    media_id: "frieren".into(),
                    episode_id: "ep1".into(),
                    voice_label: "AniLibria".into(),
                    quality: "1080p".into(),
                    format: "hls".into(),
                    url: "https://cache.aniliberty.top/1080.m3u8".into(),
                    preferred: true,
                    headers: vec![],
                    allowed_hosts: vec![],
                    skips: vec![],
                    subtitles: vec![],
                },
                StreamCandidate {
                    provider: "rutube".into(),
                    media_id: "frieren".into(),
                    episode_id: "ep1".into(),
                    voice_label: "Rutube".into(),
                    quality: "720p".into(),
                    format: "hls".into(),
                    url: "https://edge.rtbcdn.ru/720.m3u8".into(),
                    preferred: false,
                    headers: vec![("Referer".into(), "https://rutube.ru/".into())],
                    allowed_hosts: vec!["*.rtbcdn.ru".into()],
                    skips: vec![],
                    subtitles: vec![],
                },
            ])
            .await
            .unwrap();

        assert_eq!(res.streams.len(), 2);
        assert!(!res.streams[0].relayed);
        assert_eq!(res.streams[0].quality, "1080p");
        assert!(res.streams[1].relayed);
        assert!(res.streams[1]
            .url
            .starts_with("wachcha-media://localhost/rutube/"));
    }

    #[tokio::test]
    async fn lists_all_seven_builtin_providers() {
        let backend = Backend::new().unwrap();
        let list = backend.list_providers().await;
        assert_eq!(list.len(), 7);
        assert!(list
            .iter()
            .any(|p| p.id == "aniliberty" && p.stream_capable));
        assert!(list.iter().any(|p| p.id == "turkish_channels"));
    }
}
