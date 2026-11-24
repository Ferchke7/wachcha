//! Bounded offline download queue model for HLS & MP4 episode caching.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DownloadStatus {
    Queued,
    Downloading,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadTask {
    pub id: String,
    pub media_id: String,
    pub title: String,
    pub episode_label: String,
    pub quality: String,
    pub format: String,
    pub status: DownloadStatus,
    pub progress: f32,
}

#[derive(Clone, Default)]
pub struct DownloadManager {
    tasks: Arc<Mutex<HashMap<String, DownloadTask>>>,
}

impl DownloadManager {
    pub async fn list(&self) -> Vec<DownloadTask> {
        let guard = self.tasks.lock().await;
        guard.values().cloned().collect()
    }

    pub async fn enqueue(&self, task: DownloadTask) -> DownloadTask {
        let mut guard = self.tasks.lock().await;
        guard.insert(task.id.clone(), task.clone());
        task
    }

    pub async fn cancel(&self, id: &str) -> bool {
        let mut guard = self.tasks.lock().await;
        if let Some(task) = guard.get_mut(id) {
            task.status = DownloadStatus::Cancelled;
            return true;
        }
        false
    }
}
