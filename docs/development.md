# Developing Wachcha

## Prerequisites

- **Node.js** 20+ (`npm`)
- **Rust** 1.85+ (`cargo`, `rustfmt`)
- Optional on Windows: `libmpv-2.dll` via `npm run prepare:windows-libmpv` (automatic fallback to Shaka Player if absent)

## Commands

| Command                | Purpose                                                              |
| ---------------------- | -------------------------------------------------------------------- |
| `npm run dev:web`      | Fast browser UI preview on `http://127.0.0.1:4179`                   |
| `npm run dev`          | Full Tauri v2 desktop window + Rust backend                          |
| `npm run build:web`    | Strict TypeScript check (`tsc -b`) + Vite production bundle + PWA SW |
| `npm test`             | Vitest unit & Preact Testing Library suite                           |
| `npm run test:rust`    | Offline Rust unit, provider, HLS rewriter, and security tests        |
| `npm run probe:build`  | Compile zero-port stdio `media_probe` harness                        |
| `npm run check:probe`  | Run stdio smoke check against real Rust `media_probe`                |
| `npm run format`       | Format TS/CSS/JSON (Prettier) and Rust (`cargo fmt`)                 |
| `npm run format:check` | Verify formatting in CI                                              |

## Opt-In Live Provider Verification

Offline tests never access external networks. To probe live public providers manually:

```sh
cargo test --manifest-path src-tauri/Cargo.toml --no-default-features --lib live_provider_transport -- --ignored --nocapture
```
