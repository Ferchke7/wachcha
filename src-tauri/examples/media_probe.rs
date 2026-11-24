//! Zero-port stdio test harness exercising Wachcha's real Rust backend
//! (`providers`, `search`, `shelves`, `detail`, `resolve`, `media`, `health`) over stdin/stdout.

use base64::{engine::general_purpose::STANDARD, Engine};
use serde_json::{json, Value};
use std::io::{self, BufRead, Write};
use wachcha_lib::backend::Backend;
use wachcha_lib::providers::{SearchQuery, StreamCandidate};

#[tokio::main]
async fn main() {
    let backend = Backend::new().expect("failed to initialize Backend");
    let stdin = io::stdin();
    let stdout = io::stdout();

    for line in stdin.lock().lines().map_while(Result::ok) {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let Ok(input) = serde_json::from_str::<Value>(trimmed) else {
            continue;
        };
        let id = input.get("id").cloned().unwrap_or(json!(0));
        let action = input.get("action").and_then(|v| v.as_str()).unwrap_or("");

        let result: Result<Value, String> = async {
            match action {
                "providers" => {
                    serde_json::to_value(backend.list_providers().await).map_err(|e| e.to_string())
                }
                "search" => {
                    let query: SearchQuery = serde_json::from_value(
                        input.get("query").cloned().unwrap_or_else(|| json!({})),
                    )
                    .map_err(|e| e.to_string())?;
                    serde_json::to_value(backend.search_catalog(query).await)
                        .map_err(|e| e.to_string())
                }
                "shelves" => {
                    let locale = input.get("locale").and_then(|v| v.as_str()).unwrap_or("en");
                    serde_json::to_value(backend.get_home_shelves(locale).await)
                        .map_err(|e| e.to_string())
                }
                "detail" => {
                    let provider = input.get("provider").and_then(|v| v.as_str()).unwrap_or("");
                    let media_id = input.get("mediaId").and_then(|v| v.as_str()).unwrap_or("");
                    let locale = input.get("locale").and_then(|v| v.as_str()).unwrap_or("en");
                    backend
                        .get_media_detail(provider, media_id, locale)
                        .await
                        .and_then(|d| serde_json::to_value(d).map_err(|e| e.to_string()))
                }
                "resolve" => {
                    let candidates: Vec<StreamCandidate> = serde_json::from_value(
                        input
                            .get("candidates")
                            .cloned()
                            .unwrap_or_else(|| json!([])),
                    )
                    .map_err(|e| e.to_string())?;
                    backend
                        .resolve_streams(candidates)
                        .await
                        .and_then(|r| serde_json::to_value(r).map_err(|e| e.to_string()))
                }
                "media" => {
                    let uri = input.get("uri").and_then(|v| v.as_str()).unwrap_or("");
                    let method = input
                        .get("method")
                        .and_then(|v| v.as_str())
                        .unwrap_or("GET");
                    let range = input.get("range").and_then(|v| v.as_str());
                    let resp = backend
                        .media
                        .serve_request(method, uri, Some("tauri://localhost"), range)
                        .await;
                    Ok(json!({
                        "status": resp.status,
                        "headers": resp.headers,
                        "bodyBase64": STANDARD.encode(&resp.body),
                    }))
                }
                "health" => serde_json::to_value(backend.check_provider_health().await)
                    .map_err(|e| e.to_string()),
                _ => Err(format!("Unknown media_probe action: {action}")),
            }
        }
        .await;

        let out = match result {
            Ok(val) => json!({ "id": id, "result": val }),
            Err(err) => json!({ "id": id, "error": err }),
        };
        let mut lock = stdout.lock();
        let _ = writeln!(lock, "{out}");
        let _ = lock.flush();
    }
}
