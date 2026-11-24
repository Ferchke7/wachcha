---
name: wachcha-player
description: >-
  Owns Wachcha's hybrid playback architecture: lazy-loaded Shaka Player 5 (HLS/DASH MSE),
  dual-layer seamless quality switching, native libmpv integration with GLSL upscalers and
  loopback random-key relay, skip markers, AutoActionCountdown, and playback recovery.
---

# Wachcha Universal Hybrid Player

## Playback Engine Hierarchy

1. **Desktop / Android TV (`libmpv` when available & enabled)**: Hardware-decoded H.264/HEVC/AV1 with optional GLSL upscaling shaders (`Anime4K`, `FSR`, `FSRCNNX`). Receives relayed `wachcha-media://` streams through an authenticated `127.0.0.1:0` random-key `hyper` loopback relay.
2. **Web / WebView HLS & DASH (`shaka-player` v5)**: Dynamically imported (`await import('shaka-player')`) only when entering the player screen so the initial app bundle stays lean.
3. **Direct MP4 / Native Safari HLS**: HTML5 `<video>` element without `crossorigin` when unproxied.

## Hard Player Rules

- Never request stream resolution on Detail/Catalog pages — resolve streams only on the Watch screen.
- Never drop a playing source on a single transient network hiccup; allow up to 2 explicit retries and monitor actual decoded frame progression (20s stall threshold) before cycling to the next candidate.
- Preserve `position`, `paused`, `muted`, `volume`, and `playbackRate` across quality switches and source failovers.
- Never publish secrets, tokens, or signed CDN URLs in `wachcha:playback` window events.

## References

- [Shaka Player 5 & Dual-Layer Quality Switch](./references/shaka-and-dual-layer.md)
- [Native libmpv, Loopback Relay & GLSL Shaders](./references/libmpv-and-shaders.md)
- [Playback Event Contract & Auto-Skip](./references/playback-events-and-skips.md)
