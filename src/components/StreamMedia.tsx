import { useEffect, useRef } from 'preact/hooks';
import { translateMediaUrl } from '~/lib/desktop';
import type { ResolvedStream } from '~/lib/types';

export interface StreamMediaProps {
  stream: ResolvedStream;
  startPosition: number;
  playbackRate: number;
  volume: number;
  muted: boolean;
  activeSubtitleLang?: string;
  onTimeUpdate: (time: number, duration: number) => void;
  onPlayingChange: (playing: boolean) => void;
  onEnded: () => void;
  onError: (msg: string) => void;
  videoRef: { current: HTMLVideoElement | null };
}

/**
 * Lazy-loads Shaka Player only when needed for HLS/DASH MSE playback,
 * preserving imperfect TS timestamp tolerance and VOD seekable windows.
 */
export function StreamMedia({
  stream,
  startPosition,
  playbackRate,
  volume,
  muted,
  activeSubtitleLang,
  onTimeUpdate,
  onPlayingChange,
  onEnded,
  onError,
  videoRef,
}: StreamMediaProps) {
  const preloadRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let disposed = false;
    let shakaPlayer: { destroy: () => Promise<void> } | null = null;
    const targetUrl = translateMediaUrl(stream.url);
    const isAdaptive =
      stream.format === 'hls' ||
      stream.format === 'dash' ||
      targetUrl.includes('.m3u8') ||
      targetUrl.includes('.mpd');

    video.playbackRate = playbackRate;
    video.volume = volume;
    video.muted = muted;

    const attach = async () => {
      try {
        if (isAdaptive) {
          const shakaMod = await import('shaka-player');
          if (disposed) return;
          const shaka = shakaMod.default || shakaMod;
          shaka.polyfill?.installAll?.();
          if (shaka.Player?.isBrowserSupported?.()) {
            const player = new shaka.Player();
            await player.attach(video);
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
              },
            });
            player.addEventListener('error', (ev: unknown) => {
              if (!disposed) onError(`Shaka playback error: ${String(ev)}`);
            });
            shakaPlayer = player;
            const mimeType =
              stream.format === 'dash' || targetUrl.includes('.mpd')
                ? 'application/dash+xml'
                : 'application/x-mpegURL';
            await player.load(targetUrl, startPosition > 0 ? startPosition : undefined, mimeType);
            if (!disposed) {
              if (video.duration && Number.isFinite(video.duration)) {
                onTimeUpdate(video.currentTime || 0, video.duration);
              }
              await video.play().catch(() => {});
            }
            return;
          }
        }
        video.src = targetUrl;
        if (startPosition > 0) {
          video.currentTime = startPosition;
        }
        await video.play().catch(() => {});
      } catch (err) {
        if (!disposed) {
          onError(err instanceof Error ? err.message : String(err));
        }
      }
    };

    attach();

    return () => {
      disposed = true;
      if (shakaPlayer) {
        void shakaPlayer.destroy();
      }
      video.pause();
      video.removeAttribute('src');
    };
  }, [stream.url, stream.format]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = muted;
    }
  }, [volume, muted]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !v.textTracks) return;
    for (let i = 0; i < v.textTracks.length; i += 1) {
      const track = v.textTracks[i];
      track.mode =
        activeSubtitleLang && track.language === activeSubtitleLang ? 'showing' : 'disabled';
    }
  }, [activeSubtitleLang, stream.subtitles]);

  return (
    <>
      <video
        ref={videoRef}
        class="player-video"
        playsInline
        preload="auto"
        crossOrigin="anonymous"
        onLoadedMetadata={e => {
          const v = e.currentTarget;
          if (Number.isFinite(v.duration)) onTimeUpdate(v.currentTime || 0, v.duration);
        }}
        onDurationChange={e => {
          const v = e.currentTarget;
          if (Number.isFinite(v.duration)) onTimeUpdate(v.currentTime || 0, v.duration);
        }}
        onTimeUpdate={e => {
          const v = e.currentTarget;
          onTimeUpdate(v.currentTime || 0, v.duration || 0);
        }}
        onPlay={() => onPlayingChange(true)}
        onPause={() => onPlayingChange(false)}
        onEnded={onEnded}
        onError={() => onError('HTMLMediaElement error')}
      >
        {(stream.subtitles || []).map(sub => (
          <track
            key={`${sub.lang}:${sub.url}`}
            kind="subtitles"
            srcLang={sub.lang}
            label={sub.label}
            src={sub.url}
            default={activeSubtitleLang === sub.lang}
          />
        ))}
      </video>
      {/* Secondary muted preload layer reserved for flicker-free quality swaps */}
      <video ref={preloadRef} class="player-video preload-hidden" muted playsInline />
    </>
  );
}
