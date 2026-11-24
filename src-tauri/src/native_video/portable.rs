//! Portable dynamic libmpv loader and GLSL upscaling shader registry.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ShaderPreset {
    Off,
    Anime4kFast,
    Fsr,
    Fsrcnnx,
}

impl ShaderPreset {
    pub fn filename(self) -> Option<&'static str> {
        match self {
            Self::Off => None,
            Self::Anime4kFast => Some("Anime4K_Upscale_CNN_x2_S.glsl"),
            Self::Fsr => Some("FSR.glsl"),
            Self::Fsrcnnx => Some("FSRCNNX_x2_8-0-4-1.glsl"),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeVideoCapabilities {
    pub available: bool,
    pub library_path: Option<String>,
    pub shaders: Vec<ShaderPreset>,
}

/// Checks whether a compatible `libmpv` dynamic library is loadable on this host.
pub fn detect_libmpv() -> NativeVideoCapabilities {
    let candidates = candidate_library_paths();
    #[cfg(any(target_os = "windows", target_os = "linux", target_os = "android"))]
    {
        for path in candidates {
            // SAFETY: Probing whether libmpv dynamic library loads cleanly without executing symbols.
            let loaded = unsafe { libloading::Library::new(&path) };
            if loaded.is_ok() {
                return NativeVideoCapabilities {
                    available: true,
                    library_path: Some(path.to_string_lossy().into_owned()),
                    shaders: vec![
                        ShaderPreset::Off,
                        ShaderPreset::Anime4kFast,
                        ShaderPreset::Fsr,
                        ShaderPreset::Fsrcnnx,
                    ],
                };
            }
        }
    }
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "android")))]
    let _ = candidates;

    NativeVideoCapabilities {
        available: false,
        library_path: None,
        shaders: vec![ShaderPreset::Off],
    }
}

fn candidate_library_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Ok(custom) = std::env::var("WACHCHA_LIBMPV") {
        let trimmed = custom.trim();
        if !trimmed.is_empty() {
            paths.push(PathBuf::from(trimmed));
        }
    }
    #[cfg(target_os = "windows")]
    {
        paths.push(PathBuf::from("libmpv/libmpv-2.dll"));
        paths.push(PathBuf::from("native-libs/windows/libmpv-2.dll"));
        paths.push(PathBuf::from("libmpv-2.dll"));
    }
    #[cfg(any(target_os = "linux", target_os = "android"))]
    {
        paths.push(PathBuf::from("libmpv.so.2"));
        paths.push(PathBuf::from("libmpv.so"));
    }
    paths
}
