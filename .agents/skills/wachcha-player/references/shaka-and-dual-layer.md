# Shaka Player 5 Configuration & Dual-Layer Quality Switching

## Shaka Player 5 Hardened Defaults (`src/components/StreamMedia.tsx`)

```ts
player.configure({
  manifest: {
    availabilityWindowOverride: Infinity,
    hls: {
      sequenceMode: false,
      ignoreManifestTimestampsInSegmentsMode: true,
    },
  },
  streaming: {
    inaccurateManifestTolerance: 2,
    bufferingGoal: 30,
    rebufferingGoal: 2,
    retryParameters: { maxAttempts: 3, baseDelay: 500, backoffFactor: 2 },
  },
});
```

- `availabilityWindowOverride: Infinity`: prevents HLS VOD playlists missing `#EXT-X-ENDLIST` from shifting seekable start forward.
- `sequenceMode: false` + `ignoreManifestTimestampsInSegmentsMode: true`: eliminates buffer gap jumps caused by rounded `#EXTINF` durations in TS segments.
- `inaccurateManifestTolerance: 2`: ensures WebKit seeks load the preceding segment when manifest timestamps round slightly late.

## Dual-Layer Flicker-Free Quality Switch

When switching to a stream variant that has a **separate URL** (rather than an ABR variant inside the same manifest):

1. Keep Layer A playing visibly.
2. Mount a hidden, muted Layer B `<video>` and load the target quality seeking to Layer A's live `currentTime`.
3. Wait for `loadeddata` / first decoded frame on Layer B (20s timeout; abort cleanly if user switches again).
4. Synchronize `currentTime`, `playbackRate`, `volume`, `muted`, and `paused`, swap visibility to Layer B, and dispose Layer A cleanly.
5. On preparation error or timeout, discard Layer B and keep Layer A uninterrupted with a non-blocking toast notice.
