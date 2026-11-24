# Playback Event Contract, Progress Sync & Auto-Skip

## Unified `wachcha:playback` Event (`src/lib/playback-session.ts`)

Every playback state change emits a consistent versioned payload to `<UniversalPlayer onPlayback />` and `window.dispatchEvent(new CustomEvent('wachcha:playback', { detail }))`:

```ts
export interface PlaybackEvent {
  version: 1;
  reason:
    | 'sourcechange'
    | 'playing'
    | 'pause'
    | 'timeupdate'
    | 'seeking'
    | 'seeked'
    | 'buffering'
    | 'ended'
    | 'skip'
    | 'dispose'
    | 'saved'
    | 'saveerror';
  timestamp: number;
  playback: {
    mediaId: string;
    provider: string;
    episodeId: string;
    voice: string;
    sourceHost: string;
    quality: string;
    format: 'hls' | 'dash' | 'mp4';
    relayed: boolean;
    engine: 'shaka' | 'native-video' | 'libmpv';
    position: number;
    duration: number;
    watchedSeconds: number;
    playing: boolean;
  };
  skip?: { kind: 'opening' | 'ending' | 'recap'; from: number; to: number; automatic: boolean };
}
```

- `timeupdate` throttles to at most 1 event/second; seeks and skips never inflate `watchedSeconds`.
- Progress persists locally every 10 seconds, on pause, seeked, episode/voice change, and unmount.

## Skip Markers & `AutoActionCountdown`

- Sources: AniLiberty API `opening`/`ending`, HLS `EXT-X-DATERANGE`, or provider-supplied `SkipInterval[]`. Never fabricate heuristic intervals.
- Manual Skip button triggers immediately when `position` enters `[from, to)`.
- Auto-Skip (opt-in per user setting) triggers a **5-second `AutoActionCountdown`** with **Skip Now** and **Cancel** buttons, firing at most once per interval so rewinding back into an opening does not loop.
- Auto-Next Episode runs the same 5-second countdown upon `ended` (or skipping an ending to clip end).
