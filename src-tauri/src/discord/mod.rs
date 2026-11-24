//! Discord Rich Presence state coordinator (non-blocking local IPC, zero OAuth tokens).

pub mod ipc;

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscordActivity {
    pub title: String,
    pub subtitle: String,
    pub start_timestamp: Option<i64>,
    pub end_timestamp: Option<i64>,
}

#[derive(Clone, Default)]
pub struct DiscordState {
    current: Arc<Mutex<Option<DiscordActivity>>>,
}

impl DiscordState {
    pub async fn update(&self, activity: Option<DiscordActivity>) -> Result<(), String> {
        let mut guard = self.current.lock().await;
        *guard = activity;
        Ok(())
    }

    pub async fn snapshot(&self) -> Option<DiscordActivity> {
        self.current.lock().await.clone()
    }
}
