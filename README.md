<div align="center">

<img src="public/icons/icon.svg" alt="Wachcha Logo" width="96" height="96" />

# Wachcha

**Open-source, cross-platform cinematic media center & multi-catalog streaming aggregator** for **Movies**, **Russian & World TV Series**, **Turkish TV Shows (Diziler)**, **Anime**, **Live M3U8 TV**, and **Stremio Addons**.

[![Release v0.0.1](https://img.shields.io/github/v/release/Ferchke7/wachcha?include_prereleases&style=flat-square&color=7C3AED&label=Release)](https://github.com/Ferchke7/wachcha/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/Ferchke7/wachcha/ci.yml?style=flat-square&label=CI)](https://github.com/Ferchke7/wachcha/actions/workflows/ci.yml)
[![GitHub Pages](https://img.shields.io/github/actions/workflow/status/Ferchke7/wachcha/pages.yml?style=flat-square&color=D946EF&label=Download%20Portal)](https://ferchke7.github.io/wachcha/)
[![License: MIT](https://img.shields.io/badge/License-MIT-34D399?style=flat-square)](LICENSE)
[![Platforms](https://img.shields.io/badge/Platforms-Windows%20%C2%B7%20Android%20%2F%20TV%20%C2%B7%20macOS%20%C2%B7%20Linux%20%C2%B7%20PWA-18112D?style=flat-square)](#downloads-v001)
[![i18n](https://img.shields.io/badge/Languages-EN%20%C2%B7%20RU%20%C2%B7%20TR-FBBF24?style=flat-square)](#highlights)

[**Download Portal**](https://ferchke7.github.io/wachcha/) · [**Launch Web App (PWA)**](https://ferchke7.github.io/wachcha/app/) · [**Releases (`v0.0.1`)**](https://github.com/Ferchke7/wachcha/releases/tag/v0.0.1) · [**Figma Design System**](https://www.figma.com/design/tE1dNJZTKeqsAfyIXDKtH6)

</div>

---

## Downloads (`v0.0.1`)

Get the latest prebuilt installers and packages from the [**Wachcha Download Portal**](https://ferchke7.github.io/wachcha/) or directly from [**GitHub Releases (`v0.0.1`)**](https://github.com/Ferchke7/wachcha/releases/tag/v0.0.1):

| Platform                 | Package                   | Architecture                           | Direct Download (`v0.0.1`)                                                                                                                    |
| ------------------------ | ------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Windows**              | NSIS Installer (`.exe`)   | `x86_64`                               | [Wachcha-0.0.1-windows-x64-setup.exe](https://github.com/Ferchke7/wachcha/releases/download/v0.0.1/Wachcha-0.0.1-windows-x64-setup.exe)       |
| **Windows**              | WiX Installer (`.msi`)    | `x86_64`                               | [Wachcha-0.0.1-windows-x64.msi](https://github.com/Ferchke7/wachcha/releases/download/v0.0.1/Wachcha-0.0.1-windows-x64.msi)                   |
| **Windows**              | Portable Archive (`.zip`) | `x86_64`                               | [Wachcha-0.0.1-windows-x64-portable.zip](https://github.com/Ferchke7/wachcha/releases/download/v0.0.1/Wachcha-0.0.1-windows-x64-portable.zip) |
| **Android & Android TV** | Universal Signed `.apk`   | `arm64-v8a` + `armeabi-v7a` + `x86_64` | [Wachcha-0.0.1-android-universal.apk](https://github.com/Ferchke7/wachcha/releases/download/v0.0.1/Wachcha-0.0.1-android-universal.apk)       |
| **Android & Android TV** | ARM64 Signed `.apk`       | `arm64-v8a`                            | [Wachcha-0.0.1-android-arm64.apk](https://github.com/Ferchke7/wachcha/releases/download/v0.0.1/Wachcha-0.0.1-android-arm64.apk)               |
| **macOS**                | Disk Image (`.dmg`)       | Apple Silicon (`arm64`)                | [Wachcha-0.0.1-macos-arm64.dmg](https://github.com/Ferchke7/wachcha/releases/download/v0.0.1/Wachcha-0.0.1-macos-arm64.dmg)                   |
| **Linux**                | Portable `.AppImage`      | `x86_64`                               | [Wachcha-0.0.1-linux-x64.AppImage](https://github.com/Ferchke7/wachcha/releases/download/v0.0.1/Wachcha-0.0.1-linux-x64.AppImage)             |
| **Linux**                | Debian / Ubuntu (`.deb`)  | `x86_64`                               | [Wachcha-0.0.1-linux-x64.deb](https://github.com/Ferchke7/wachcha/releases/download/v0.0.1/Wachcha-0.0.1-linux-x64.deb)                       |
| **Linux**                | Fedora / RHEL (`.rpm`)    | `x86_64`                               | [Wachcha-0.0.1-linux-x64.rpm](https://github.com/Ferchke7/wachcha/releases/download/v0.0.1/Wachcha-0.0.1-linux-x64.rpm)                       |
| **Web / PWA**            | Browser App               | Any OS                                 | [Launch Live Web App](https://ferchke7.github.io/wachcha/app/)                                                                                |
| **Integrity**            | Checksums                 | All                                    | [SHA256SUMS.txt](https://github.com/Ferchke7/wachcha/releases/download/v0.0.1/SHA256SUMS.txt)                                                 |

### Platform Install Notes

- **Windows (`.exe` / `.msi` / `.zip`)**: Open-source builds are unsigned; if Windows SmartScreen prompts, select **More info → Run anyway**. Optional native `libmpv` GLSL upscaling activates automatically if `libmpv-2.dll` is placed beside `wachcha.exe` (otherwise Wachcha uses its built-in Shaka Player engine).
- **Android & Android TV (`.apk`)**: Both APKs include Leanback TV launcher metadata and D-pad 10-foot navigation. Enable **Install unknown apps** on your phone, Google TV, or Fire TV, then install `Wachcha-0.0.1-android-arm64.apk` (most modern phones/TVs) or `Wachcha-0.0.1-android-universal.apk`.
- **macOS (`.dmg`)**: Drag `Wachcha.app` to Applications. Because open-source builds use ad-hoc signing (`-`), clear quarantine once if Gatekeeper prompts:
  ```sh
  xattr -cr /Applications/Wachcha.app
  ```
- **Linux (`.AppImage` / `.deb` / `.rpm`)**:
  ```sh
  # AppImage
  chmod +x Wachcha-0.0.1-linux-x64.AppImage && ./Wachcha-0.0.1-linux-x64.AppImage

  # Debian / Ubuntu
  sudo apt install ./Wachcha-0.0.1-linux-x64.deb
  ```

---

## Highlights

- **Unified Multi-Vertical Search & Deduplication**: Search once in **English**, **Russian**, or **Turkish** across **AniLiberty**, **Shikimori**, **YummyAnime Public API**, **TMDB (RU/TR/EN)**, **TVMaze**, **Rutube Public Catalog**, **Official Turkish Broadcaster Feeds**, **M3U8 Playlists**, and installed **Stremio Addons**. Results deduplicate automatically using canonical external IDs (`IMDb`, `TMDB`, `MAL`, `Shikimori`, `TVMaze`, `Rutube`).
- **Zero-Server Native Architecture**: Installed binaries bundle **no Node.js, Vite, or open public HTTP server**. Header-authenticated HLS/DASH/MP4 streams flow through Tauri v2's in-process async `wachcha-media://` custom URI scheme with strict per-provider HTTPS host allowlists, opaque hex session IDs, disabled CDN redirects, and bounded size/concurrency limits.
- **Hybrid Video Player**: Prefers native dynamic **`libmpv`** with optional GLSL upscalers (`Anime4K`, `FSR`, `FSRCNNX`) fed over a loopback-only `127.0.0.1:0` random-key relay, seamlessly falling back to lazy-loaded **Shaka Player** (MSE HLS/DASH with dual-layer flicker-free quality switching, intro/outro skip markers, and 5-second `AutoActionCountdown`).
- **Kodi-Style Cinema UX**: Obsidian-violet design system synced with the [Wachcha Figma File](https://www.figma.com/design/tE1dNJZTKeqsAfyIXDKtH6), persistent desktop sidebar rail, frameless window chrome, `VirtualGrid` with focus pinning, IndexedDB stale-while-revalidate LRU caching, spatial keyboard/D-pad TV navigation, and responsive mobile sheets.
- **Open-Source Legal & Community Extensibility**: Built-in providers exclusively use documented, open, public, or user-authorized APIs and free official feeds — **zero DRM bypass, paywall circumvention, or CAPTCHA solvers**. Community catalogs and stream providers attach cleanly via **Stremio Addon Protocol v3 (`manifest.json`)** or **M3U/M3U8 playlists**.

### Built-In Sources & Extensions

| Vertical                       | Providers / Bridges                                                                                | Auth                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------ |
| **Anime**                      | AniLiberty API v1 (keyless HLS + skip markers), Shikimori, YummyAnime Public API (mirror failover) | Keyless (optional token) |
| **Movies & Russian/World TV**  | TMDB v3 (RU/TR/EN metadata), Rutube Public Catalog (public HLS)                                    | Optional `TMDB_API_KEY`  |
| **Turkish TV Shows (Diziler)** | TVMaze + Official Turkish Free-to-Air Broadcasters (TRT, ATV, Kanal D, Star TV, Show TV, NOW)      | Keyless                  |
| **Live TV & Community Addons** | **Stremio Addon Protocol v3** (`manifest.json` + `proxyHeaders`) & **M3U/M3U8** playlists          | User-added URLs          |

---

## Build from Source

### Prerequisites

- **Node.js 22+** (`npm`)
- **Rust stable** (`cargo`, `rustfmt`) via [rustup](https://rustup.rs/)
- **Platform toolchains**:
  - **Windows**: Visual Studio Build Tools (MSVC) + WebView2 (preinstalled on Windows 10/11)
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Linux (Ubuntu/Debian)**:
    ```sh
    sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libmpv-dev rpm
    ```
  - **Android / Android TV**: JDK 17, Android SDK & NDK (`ANDROID_HOME`, `NDK_HOME`), and Rust Android targets:
    ```sh
    rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android
    ```

### 1. Local Development & Web Preview

```sh
git clone https://github.com/Ferchke7/wachcha.git
cd wachcha
npm install

# Fast browser/PWA preview at http://127.0.0.1:4179
npm run dev:web

# Full Tauri v2 desktop window with Rust backend
npm run dev

# Build GitHub Pages download portal + live PWA bundle into pages-dist/
npm run build:pages
```

### 2. Build Desktop Installers (`.exe`, `.msi`, `.dmg`, `.AppImage`, `.deb`, `.rpm`)

```sh
# Windows (.exe NSIS installer + .msi WiX installer)
npx tauri build --config src-tauri/tauri.windows.conf.json

# macOS (.dmg + .app)
npx tauri build --config src-tauri/tauri.macos.conf.json

# Linux (.AppImage, .deb, .rpm)
NO_STRIP=true npx tauri build --config src-tauri/tauri.linux.conf.json
```

Artifacts are emitted under `src-tauri/target/release/bundle/`.

### 3. Build Android & Android TV `.apk`

```sh
# Initialize Tauri Android Gradle project (once)
npx tauri android init --ci

# Sync app icons & inject Android TV Leanback launcher metadata
npx tauri icon src-tauri/icons/app-icon.png
node scripts/patch-android-tv.mjs

# Build release APKs (ARM64 or universal)
npx tauri android build --apk --target aarch64
npx tauri android build --apk
```

Unsigned release APKs are output to `src-tauri/gen/android/app/build/outputs/apk/` and can be signed with `zipalign` + `apksigner` (automated in [`.github/workflows/build.yml`](.github/workflows/build.yml)).

### 4. Verification & Test Suite

```sh
npm run format:check                                # Prettier + cargo fmt --check
npm test                                            # Vitest + Preact UI tests
npm run build:web                                   # Strict tsc -b + Vite bundle + PWA SW
npm run test:rust                                   # Offline Rust provider, HLS & security tests
npm run probe:build && npm run check:probe          # Zero-port stdio media_probe smoke test
cargo check --manifest-path src-tauri/Cargo.toml    # Full Tauri v2 desktop compile check
```

---

## Release Automation (`v0.0.1` & Future Tags)

Pushing any semantic version tag (`v*`) automatically triggers [`.github/workflows/release.yml`](.github/workflows/release.yml), which fans out parallel cloud runners via [`.github/workflows/build.yml`](.github/workflows/build.yml) to compile, package, sign, checksum (`SHA256SUMS.txt`), and publish:

- Windows x64 `.exe`, `.msi`, and portable `.zip`
- Android & Android TV signed universal `.apk` and `arm64` `.apk`
- macOS Apple Silicon `.dmg`
- Linux x64 `.AppImage`, `.deb`, and `.rpm`

Meanwhile, [`.github/workflows/pages.yml`](.github/workflows/pages.yml) deploys the Download Portal and live Wachcha Web App to **GitHub Pages** at [ferchke7.github.io/wachcha](https://ferchke7.github.io/wachcha/).

Optional repository secrets for signing official Android releases with your own keystore:
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASS`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASS` (if unset, CI generates a valid self-signed open-source APK signing key so downloads remain directly installable).

---

## Documentation & Engineering Kit

- [Figma Design System & Multi-Platform Screens](https://www.figma.com/design/tE1dNJZTKeqsAfyIXDKtH6)
- [Architecture Overview](docs/architecture.md)
- [Providers & Addon SDK](docs/providers.md)
- [Development & Testing Guide](docs/development.md)
- [Project Engineering Rules (`AGENTS.md`)](AGENTS.md)

## License

MIT — see [LICENSE](LICENSE).
