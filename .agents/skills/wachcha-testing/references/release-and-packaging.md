# Multi-Platform Packaging & CI/CD

## GitHub Actions Workflows (`.github/workflows/`)

- **`ci.yml`** (PRs & pushes): Prettier check → `cargo fmt --check` → Vitest → `tsc -b && vite build` → `cargo test` → `media_probe` compile & stdio smoke check → Python workflow syntax check.
- **`build.yml`** (Reusable matrix):
  - Windows x64 (`NSIS`, `MSI`) with `scripts/prepare-windows-libmpv.mjs` checksum verification.
  - macOS ARM64 & x64 (`DMG`, `minimumSystemVersion: 12.0`).
  - Linux x64 (`AppImage`, `DEB`, `RPM`).
  - Android TV (`arm64-v8a`, `armeabi-v7a`, `x86_64` APK with `tauri.tv.conf.json` & `capabilities/android-tv.json`).
- **`release.yml`** (Tag `v*`): invokes `build.yml`, collects artifacts, computes `SHA256SUMS.txt`, and publishes GitHub Release notes.
