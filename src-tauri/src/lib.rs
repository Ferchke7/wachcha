//! Wachcha Tauri v2 application library — registers IPC commands and the
//! async `wachcha-media://` in-process media protocol.

pub mod backend;
pub mod discord;
pub mod downloads;
pub mod images;
pub mod keep_awake;
pub mod media;
pub mod native_video;
pub mod providers;
pub mod proxy_pool;
pub mod session;
pub mod skips;
pub mod updates;

#[cfg(feature = "tauri-ui")]
mod tauri_app {
    use crate::backend::{Backend, ProviderConfigPatch};
    use crate::discord::{DiscordActivity, DiscordState};
    use crate::downloads::DownloadTask;
    use crate::images::FetchedImage;
    use crate::keep_awake;
    use crate::native_video::{detect_libmpv, NativeVideoCapabilities};
    use crate::providers::{
        CatalogShelf, MediaDetail, ProviderHealth, ProviderInfo, QualityOption, SearchQuery,
        SearchResponse, StreamCandidate, StreamResolution,
    };
    use crate::proxy_pool::{ProxyConfig, ProxyReport};
    use crate::session::{M3uPlaylistEntry, SavedSession, SessionVault, StremioAddonEntry};
    use crate::updates::ReleaseInfo;
    use serde::Serialize;
    use tauri::http::{header::HeaderName, HeaderValue, Response, StatusCode};
    use tauri::Manager;

    #[derive(Serialize)]
    #[serde(rename_all = "camelCase")]
    struct DesktopInfo {
        platform: &'static str,
        version: &'static str,
        native_video: NativeVideoCapabilities,
    }

    #[tauri::command]
    fn desktop_info() -> DesktopInfo {
        DesktopInfo {
            platform: std::env::consts::OS,
            version: env!("CARGO_PKG_VERSION"),
            native_video: detect_libmpv(),
        }
    }

    #[tauri::command]
    async fn search_catalog(
        state: tauri::State<'_, Backend>,
        query: SearchQuery,
    ) -> Result<SearchResponse, String> {
        Ok(state.search_catalog(query).await)
    }

    #[tauri::command]
    async fn get_home_shelves(
        state: tauri::State<'_, Backend>,
        locale: String,
    ) -> Result<Vec<CatalogShelf>, String> {
        Ok(state.get_home_shelves(&locale).await)
    }

    #[tauri::command]
    async fn get_media_detail(
        state: tauri::State<'_, Backend>,
        provider: String,
        id: String,
        locale: String,
    ) -> Result<MediaDetail, String> {
        state.get_media_detail(&provider, &id, &locale).await
    }

    #[tauri::command]
    async fn resolve_streams(
        state: tauri::State<'_, Backend>,
        candidates: Vec<StreamCandidate>,
    ) -> Result<StreamResolution, String> {
        state.resolve_streams(candidates).await
    }

    #[tauri::command]
    async fn inspect_qualities(
        state: tauri::State<'_, Backend>,
        candidates: Vec<StreamCandidate>,
    ) -> Result<Vec<QualityOption>, String> {
        Ok(state.inspect_qualities(candidates).await)
    }

    #[tauri::command]
    async fn list_providers(state: tauri::State<'_, Backend>) -> Result<Vec<ProviderInfo>, String> {
        Ok(state.list_providers().await)
    }

    #[tauri::command]
    async fn configure_provider(
        state: tauri::State<'_, Backend>,
        vault: tauri::State<'_, SessionVault>,
        patch: ProviderConfigPatch,
    ) -> Result<ProviderInfo, String> {
        let info = state.configure_provider(patch).await?;
        let snapshot = state.export_session().await;
        let v = vault.inner().clone();
        let _ = tauri::async_runtime::spawn_blocking(move || v.save(Some(snapshot))).await;
        Ok(info)
    }

    #[tauri::command]
    async fn install_stremio_addon(
        state: tauri::State<'_, Backend>,
        vault: tauri::State<'_, SessionVault>,
        manifest_url: String,
    ) -> Result<StremioAddonEntry, String> {
        let entry = state.install_stremio_addon(&manifest_url).await?;
        let snapshot = state.export_session().await;
        let v = vault.inner().clone();
        let _ = tauri::async_runtime::spawn_blocking(move || v.save(Some(snapshot))).await;
        Ok(entry)
    }

    #[tauri::command]
    async fn remove_stremio_addon(
        state: tauri::State<'_, Backend>,
        vault: tauri::State<'_, SessionVault>,
        addon_id: String,
    ) -> Result<(), String> {
        state.remove_stremio_addon(&addon_id).await?;
        let snapshot = state.export_session().await;
        let v = vault.inner().clone();
        let _ = tauri::async_runtime::spawn_blocking(move || v.save(Some(snapshot))).await;
        Ok(())
    }

    #[tauri::command]
    async fn add_m3u_playlist(
        state: tauri::State<'_, Backend>,
        vault: tauri::State<'_, SessionVault>,
        name: String,
        url: String,
    ) -> Result<M3uPlaylistEntry, String> {
        let entry = state.add_m3u_playlist(&name, &url).await?;
        let snapshot = state.export_session().await;
        let v = vault.inner().clone();
        let _ = tauri::async_runtime::spawn_blocking(move || v.save(Some(snapshot))).await;
        Ok(entry)
    }

    #[tauri::command]
    async fn check_provider_health(
        state: tauri::State<'_, Backend>,
    ) -> Result<Vec<ProviderHealth>, String> {
        Ok(state.check_provider_health().await)
    }

    #[tauri::command]
    async fn fetch_image(
        state: tauri::State<'_, Backend>,
        url: String,
    ) -> Result<FetchedImage, String> {
        state.fetch_image(&url).await
    }

    #[tauri::command]
    async fn load_session(
        window: tauri::WebviewWindow,
        vault: tauri::State<'_, SessionVault>,
    ) -> Result<Option<SavedSession>, String> {
        if window.label() != "main" {
            return Err("Unauthorized window.".into());
        }
        let v = vault.inner().clone();
        tauri::async_runtime::spawn_blocking(move || v.load())
            .await
            .map_err(|_| "Failed reading session vault.".to_string())?
    }

    #[tauri::command]
    async fn save_session(
        window: tauri::WebviewWindow,
        state: tauri::State<'_, Backend>,
        vault: tauri::State<'_, SessionVault>,
        session: Option<SavedSession>,
    ) -> Result<(), String> {
        if window.label() != "main" {
            return Err("Unauthorized window.".into());
        }
        if let Some(ref s) = session {
            state.hydrate_session(s.clone()).await?;
        }
        let v = vault.inner().clone();
        tauri::async_runtime::spawn_blocking(move || v.save(session))
            .await
            .map_err(|_| "Failed writing session vault.".to_string())?
    }

    #[tauri::command]
    async fn set_proxy_config(
        state: tauri::State<'_, Backend>,
        vault: tauri::State<'_, SessionVault>,
        config: ProxyConfig,
    ) -> Result<ProxyReport, String> {
        let report = state.apply_proxy(config).await?;
        let snapshot = state.export_session().await;
        let v = vault.inner().clone();
        let _ = tauri::async_runtime::spawn_blocking(move || v.save(Some(snapshot))).await;
        Ok(report)
    }

    #[tauri::command]
    async fn set_discord_presence(
        state: tauri::State<'_, DiscordState>,
        activity: Option<DiscordActivity>,
    ) -> Result<(), String> {
        state.update(activity).await
    }

    #[tauri::command]
    fn set_keep_awake(active: bool) -> Result<(), String> {
        keep_awake::set_keep_awake(active)
    }

    #[tauri::command]
    async fn list_downloads(state: tauri::State<'_, Backend>) -> Result<Vec<DownloadTask>, String> {
        Ok(state.downloads.list().await)
    }

    #[tauri::command]
    async fn check_release_update(
        state: tauri::State<'_, Backend>,
    ) -> Result<Option<ReleaseInfo>, String> {
        state.check_release_update().await
    }

    #[cfg_attr(mobile, tauri::mobile_entry_point)]
    pub fn run() {
        let backend = Backend::new().expect("failed to initialize Wachcha backend");
        let media_transport = backend.media.clone();

        tauri::Builder::default()
            .plugin(tauri_plugin_opener::init())
            .plugin(tauri_plugin_notification::init())
            .manage(backend)
            .manage(DiscordState::default())
            .setup(|app| {
                let app_data = app
                    .path()
                    .app_data_dir()
                    .unwrap_or_else(|_| std::env::temp_dir().join("wachcha"));
                let vault = SessionVault::new(app_data);
                if let Ok(Some(saved)) = vault.load() {
                    let b = app.state::<Backend>().inner().clone();
                    tauri::async_runtime::spawn(async move {
                        let _ = b.hydrate_session(saved).await;
                    });
                }
                app.manage(vault);
                Ok(())
            })
            .register_asynchronous_uri_scheme_protocol(
                "wachcha-media",
                move |_ctx, req, responder| {
                    let transport = media_transport.clone();
                    let method = req.method().as_str().to_string();
                    let uri = req.uri().to_string();
                    let origin = req
                        .headers()
                        .get("origin")
                        .and_then(|v| v.to_str().ok())
                        .map(str::to_string);
                    let range = req
                        .headers()
                        .get("range")
                        .and_then(|v| v.to_str().ok())
                        .map(str::to_string);

                    tauri::async_runtime::spawn(async move {
                        let res = transport
                            .serve_request(&method, &uri, origin.as_deref(), range.as_deref())
                            .await;
                        let mut builder = Response::builder().status(
                            StatusCode::from_u16(res.status)
                                .unwrap_or(StatusCode::INTERNAL_SERVER_ERROR),
                        );
                        for (k, v) in res.headers {
                            if let (Ok(name), Ok(val)) = (
                                HeaderName::from_bytes(k.as_bytes()),
                                HeaderValue::from_str(&v),
                            ) {
                                builder = builder.header(name, val);
                            }
                        }
                        let http_resp = builder
                            .body(res.body)
                            .unwrap_or_else(|_| Response::new(Vec::new()));
                        responder.respond(http_resp);
                    });
                },
            )
            .invoke_handler(tauri::generate_handler![
                desktop_info,
                search_catalog,
                get_home_shelves,
                get_media_detail,
                resolve_streams,
                inspect_qualities,
                list_providers,
                configure_provider,
                install_stremio_addon,
                remove_stremio_addon,
                add_m3u_playlist,
                check_provider_health,
                fetch_image,
                load_session,
                save_session,
                set_proxy_config,
                set_discord_presence,
                set_keep_awake,
                list_downloads,
                check_release_update,
            ])
            .run(tauri::generate_context!())
            .expect("error while running Wachcha");
    }
}

#[cfg(feature = "tauri-ui")]
pub use tauri_app::run;
