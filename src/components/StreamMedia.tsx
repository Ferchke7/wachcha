import { useEffect, useRef } from 'preact/hooks';
import { translateMediaUrl } from '~/lib/desktop';
import type { ResolvedStream } from '~/lib/types';

export interface StreamMediaProps {
  stream: ResolvedStream;
  startPosition: number;
  playbackRate: number;
  volume: number;
  muted: boolean;
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
            await player.load(targetUrl, startPosition > 0 ? startPosition : undefined);
            if (!disposed) {
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

  return (
    <>
      <video
        ref={videoRef}
        class="player-video"
        playsInline
        onTimeUpdate={e => {
          const v = e.currentTarget;
          onTimeUpdate(v.currentTime || 0, v.duration || 0);
        }}
        onPlay={() => onPlayingChange(true)}
        onPause={() => onPlayingChange(false)}
        onEnded={onEnded}
        onError={() => onError('HTMLMediaElement error')}
      />
      {/* Secondary muted preload layer reserved for flicker-free quality swaps */}
      <video ref={preloadRef} class="player-video preload-hidden" muted playsInline />
    </>
  );
}
