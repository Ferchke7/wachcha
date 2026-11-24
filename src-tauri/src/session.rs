//! Atomic local session and provider-config vault stored in app_data_dir().
//! Uses temp-file + sync_all + atomic rename, with 0600 permissions on Unix.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StremioAddonEntry {
    pub id: String,
    pub name: String,
    pub version: String,
    pub manifest_url: String,
    pub base_url: String,
    pub resources: Vec<String>,
    pub types: Vec<String>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct M3uPlaylistEntry {
    pub id: String,
    pub name: String,
    pub url: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SavedSession {
    #[serde(default)]
    pub provider_enabled: HashMap<String, bool>,
    #[serde(default)]
    pub provider_keys: HashMap<String, String>,
    #[serde(default)]
    pub stremio_addons: Vec<StremioAddonEntry>,
    #[serde(default)]
    pub m3u_playlists: Vec<M3uPlaylistEntry>,
    #[serde(default)]
    pub proxy_enabled: bool,
    #[serde(default)]
    pub proxy_url: Option<String>,
}

#[derive(Clone)]
pub struct SessionVault {
    path: PathBuf,
}

impl SessionVault {
    pub fn new(app_data_dir: PathBuf) -> Self {
        Self {
            path: app_data_dir.join("vault").join("session-v1.json"),
        }
    }

    pub fn load(&self) -> Result<Option<SavedSession>, String> {
        if !self.path.exists() {
            return Ok(None);
        }
        let raw = fs::read_to_string(&self.path)
            .map_err(|e| format!("Could not read session vault: {e}"))?;
        let parsed = serde_json::from_str::<SavedSession>(&raw)
            .map_err(|e| format!("Corrupted session vault JSON: {e}"))?;
        Ok(Some(parsed))
    }

    pub fn save(&self, session: Option<SavedSession>) -> Result<(), String> {
        let Some(data) = session else {
            if self.path.exists() {
                fs::remove_file(&self.path)
                    .map_err(|e| format!("Could not remove session vault: {e}"))?;
            }
            return Ok(());
        };

        let parent = self
            .path
            .parent()
            .ok_or_else(|| "Invalid vault path.".to_string())?;
        fs::create_dir_all(parent).map_err(|e| format!("Could not create vault dir: {e}"))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = fs::set_permissions(parent, fs::Permissions::from_mode(0o700));
        }

        let payload = serde_json::to_vec_pretty(&data)
            .map_err(|e| format!("Could not serialize session vault: {e}"))?;
        let tmp = parent.join("session-v1.json.tmp");

        let mut file = {
            let mut opts = OpenOptions::new();
            opts.write(true).create(true).truncate(true);
            #[cfg(unix)]
            {
                use std::os::unix::fs::OpenOptionsExt;
                opts.mode(0o600);
            }
            opts.open(&tmp)
                .map_err(|e| format!("Could not open temporary vault file: {e}"))?
        };
        file.write_all(&payload)
            .map_err(|e| format!("Could not write temporary vault file: {e}"))?;
        file.sync_all()
            .map_err(|e| format!("Could not sync temporary vault file: {e}"))?;
        drop(file);

        fs::rename(&tmp, &self.path)
            .map_err(|e| format!("Could not atomically replace session vault: {e}"))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrips_and_deletes_atomic_vault() {
        let dir =
            std::env::temp_dir().join(format!("wachcha-vault-test-{}", rand::random::<u64>()));
        let vault = SessionVault::new(dir.clone());
        assert!(vault.load().unwrap().is_none());

        let mut session = SavedSession::default();
        session.provider_enabled.insert("aniliberty".into(), true);
        session
            .provider_keys
            .insert("tmdb".into(), "demo-key".into());
        vault.save(Some(session.clone())).unwrap();

        let loaded = vault.load().unwrap().expect("vault present");
        assert_eq!(loaded, session);

        vault.save(None).unwrap();
        assert!(vault.load().unwrap().is_none());
        let _ = fs::remove_dir_all(dir);
    }
}
