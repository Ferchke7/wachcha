import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { getMediaDetail, resolveStreams, setKeepAwake } from '~/lib/desktop';
import { locale, t } from '~/lib/i18n';
import { getContinueEntry, recordContinueProgress } from '~/lib/library';
import { navigateBack, navigateTo } from '~/lib/navigation';
import { appSettings, emitPlaybackEvent, formatTime, updateSettings } from '~/lib/playback-session';
import type { MediaDetail, PlaybackEvent, ResolvedStream, SkipInterval } from '~/lib/types';
import { Button, ChoiceTabs, EmptyState, Sidebar, showToast } from '~/ui';
import { AutoActionCountdown } from './AutoActionCountdown';
import { StreamMedia } from './StreamMedia';

export interface UniversalPlayerProps {
  provider: string;
  id: string;
  episodeId?: string;
  onPlayback?: (event: PlaybackEvent) => void;
}

export function UniversalPlayer({ provider, id, episodeId, onPlayback }: UniversalPlayerProps) {
  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [streams, setStreams] = useState<ResolvedStream[]>([]);
  const [streamIdx, setStreamIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dismissedSkips, setDismissedSkips] = useState<Set<string>>(() => new Set());
  const [nextCountdown, setNextCountdown] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastSaveRef = useRef(0);
  const watchedRef = useRef(0);

  const activeEpisode =
    detail?.episodes.find(e => e.id === episodeId) ||
    detail?.episodes.find(e => e.candidates.length > 0) ||
    detail?.episodes[0];
  const activeStream = streams[streamIdx];
  const nextEpisode = (() => {
    if (!detail || !activeEpisode) return undefined;
    const idx = detail.episodes.findIndex(e => e.id === activeEpisode.id);
    return idx >= 0 ? detail.episodes[idx + 1] : undefined;
  })();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    getMediaDetail(provider, id, locale.value)
      .then(async data => {
        if (!alive) return;
        setDetail(data);
        const ep =
          data.episodes.find(e => e.id === episodeId) ||
          data.episodes.find(e => e.candidates.length > 0) ||
          data.episodes[0];
        if (!ep || ep.candidates.length === 0) {
          setError(t('detail.noStreams'));
          setLoading(false);
          return;
        }
        const resolved = await resolveStreams(ep.candidates);
        if (!alive) return;
        setStreams(resolved.streams);
        setStreamIdx(0);
        const saved = getContinueEntry(provider, id);
        if (saved && saved.episodeId === ep.id) {
          setPosition(saved.position);
        } else {
          setPosition(0);
        }
        setLoading(false);
      })
      .catch(err => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
    return () => {
      alive = false;
      void setKeepAwake(false);
    };
  }, [provider, id, episodeId, locale.value]);

  const persistProgress = useCallback(
    (pos: number, dur: number, reason: PlaybackEvent['reason'] = 'timeupdate') => {
      if (!detail || !activeEpisode || !activeStream) return;
      recordContinueProgress({
        provider: detail.item.provider,
        id: detail.item.id,
        category: detail.item.category,
        title: detail.item.title,
        posterUrl: detail.item.posterUrl,
        episodeId: activeEpisode.id,
        episodeLabel: `S${activeEpisode.season} · E${activeEpisode.number}`,
        voiceLabel: activeStream.voiceLabel,
        position: pos,
        duration: dur || activeEpisode.durationSeconds || 0,
      });
      emitPlaybackEvent(
        {
          version: 1,
          reason,
          timestamp: Date.now(),
          playback: {
            mediaId: detail.item.id,
            provider: detail.item.provider,
            episodeId: activeEpisode.id,
            voice: activeStream.voiceLabel,
            sourceHost: activeStream.sourceHost,
            quality: activeStream.quality,
            format: activeStream.format,
            relayed: activeStream.relayed,
            engine: 'shaka',
            position: pos,
            duration: dur,
            watchedSeconds: watchedRef.current,
            playing,
          },
        },
        onPlayback
      );
    },
    [detail, activeEpisode, activeStream, playing, onPlayback]
  );

  const handleTimeUpdate = useCallback(
    (time: number, dur: number) => {
      setPosition(time);
      if (dur > 0) setDuration(dur);
      const now = Date.now();
      if (now - lastSaveRef.current >= 10_000 && time > 1) {
        watchedRef.current += 10;
        lastSaveRef.current = now;
        persistProgress(time, dur, 'saved');
      }
    },
    [persistProgress]
  );

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
    } else {
      v.pause();
      persistProgress(v.currentTime, v.duration, 'pause');
    }
  }, [persistProgress]);

  const seekBy = useCallback((delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    const next = Math.max(0, Math.min(v.duration || 0, (v.currentTime || 0) + delta));
    v.currentTime = next;
    setPosition(next);
  }, []);

  const activeSkip: SkipInterval | undefined = activeStream?.skips.find(
    s => position >= s.from && position < s.to - 1 && !dismissedSkips.has(`${s.kind}:${s.from}`)
  );

  const executeSkip = useCallback(
    (skip: SkipInterval, automatic: boolean) => {
      const v = videoRef.current;
      if (v) v.currentTime = skip.to;
      setPosition(skip.to);
      setDismissedSkips(prev => new Set(prev).add(`${skip.kind}:${skip.from}`));
      if (detail && activeEpisode && activeStream) {
        emitPlaybackEvent(
          {
            version: 1,
            reason: 'skip',
            timestamp: Date.now(),
            playback: {
              mediaId: detail.item.id,
              provider: detail.item.provider,
              episodeId: activeEpisode.id,
              voice: activeStream.voiceLabel,
              sourceHost: activeStream.sourceHost,
              quality: activeStream.quality,
              format: activeStream.format,
              relayed: activeStream.relayed,
              engine: 'shaka',
              position: skip.to,
              duration,
              watchedSeconds: watchedRef.current,
              playing,
            },
            skip: { kind: skip.kind, from: skip.from, to: skip.to, automatic },
          },
          onPlayback
        );
      }
    },
    [detail, activeEpisode, activeStream, duration, playing, onPlayback]
  );

  useEffect(() => {
    void setKeepAwake(playing);
  }, [playing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'j' || e.key === 'ArrowLeft') {
        seekBy(-10);
      } else if (e.key === 'l' || e.key === 'ArrowRight') {
        seekBy(10);
      } else if (e.key === 'm' || e.key === 'M') {
        setMuted(m => !m);
      } else if ((e.key === 's' || e.key === 'S') && activeSkip) {
        executeSkip(activeSkip, false);
      } else if (e.key === 'Escape' && !drawerOpen) {
        navigateBack(`/title/${encodeURIComponent(provider)}/${encodeURIComponent(id)}`);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, seekBy, activeSkip, executeSkip, drawerOpen, provider, id]);

  const handleStreamError = useCallback(
    (msg: string) => {
      if (streamIdx + 1 < streams.length) {
        showToast(`Switching fallback stream (${streams[streamIdx + 1].quality})...`);
        setStreamIdx(idx => idx + 1);
      } else {
        setError(`${t('player.error')} (${msg})`);
      }
    },
    [streamIdx, streams]
  );

  const openEpisode = (epId: string) => {
    setNextCountdown(false);
    setDrawerOpen(false);
    navigateTo(
      `/watch/${encodeURIComponent(provider)}/${encodeURIComponent(id)}?ep=${encodeURIComponent(epId)}`
    );
  };

  return (
    <div class="player-stage" role="region" aria-label="Universal Video Player">
      <div class="player-top-chrome">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Button
            variant="glass"
            onClick={() => {
              persistProgress(position, duration, 'dispose');
              navigateBack(`/title/${encodeURIComponent(provider)}/${encodeURIComponent(id)}`);
            }}
          >
            ← {t('player.back')}
          </Button>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px' }}>
              {detail?.item.title || id}{' '}
              {activeEpisode ? `· S${activeEpisode.season} E${activeEpisode.number}` : ''}
            </div>
            {activeStream && (
              <div style={{ fontSize: '12px', color: 'var(--color-accent-soft)' }}>
                {activeStream.provider} · {activeStream.voiceLabel} · {activeStream.sourceHost}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {activeStream && (
            <span class="mono-badge">
              {activeStream.quality} · {activeStream.format.toUpperCase()}
              {activeStream.relayed ? ' · RELAY' : ''}
            </span>
          )}
          <Button variant="glass" onClick={() => setDrawerOpen(true)}>
            ☰ {t('detail.episodes')}
          </Button>
        </div>
      </div>

      <div class="player-video-wrap">
        {loading ? (
          <div style={{ color: 'var(--color-accent-soft)', fontWeight: 600 }}>
            {t('player.resolving')}
          </div>
        ) : error || !activeStream ? (
          <EmptyState
            title={error || t('player.error')}
            action={
              <Button variant="primary" onClick={() => setStreamIdx(0)}>
                {t('player.retry')}
              </Button>
            }
          />
        ) : (
          <StreamMedia
            stream={activeStream}
            startPosition={position}
            playbackRate={appSettings.value.playbackRate}
            volume={appSettings.value.volume}
            muted={muted}
            videoRef={videoRef}
            onTimeUpdate={handleTimeUpdate}
            onPlayingChange={setPlaying}
            onEnded={() => {
              persistProgress(duration, duration, 'ended');
              if (appSettings.value.autoNextEpisode && nextEpisode) {
                setNextCountdown(true);
              }
            }}
            onError={handleStreamError}
          />
        )}

        {activeSkip &&
          ((activeSkip.kind === 'opening' && appSettings.value.autoSkipIntro) ||
          (activeSkip.kind === 'ending' && appSettings.value.autoSkipOutro) ? (
            <AutoActionCountdown
              label={activeSkip.kind === 'opening' ? t('player.skipIntro') : t('player.skipOutro')}
              seconds={5}
              onExecute={() => executeSkip(activeSkip, true)}
              onCancel={() =>
                setDismissedSkips(prev =>
                  new Set(prev).add(`${activeSkip.kind}:${activeSkip.from}`)
                )
              }
            />
          ) : (
            <div class="player-countdown">
              <Button variant="primary" onClick={() => executeSkip(activeSkip, false)}>
                {activeSkip.kind === 'opening' ? t('player.skipIntro') : t('player.skipOutro')}
              </Button>
            </div>
          ))}

        {nextCountdown && nextEpisode && (
          <AutoActionCountdown
            label={t('player.nextEp')}
            seconds={5}
            onExecute={() => openEpisode(nextEpisode.id)}
            onCancel={() => setNextCountdown(false)}
          />
        )}
      </div>

      <div class="player-bottom-chrome">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
            {formatTime(position)}
          </span>
          <input
            type="range"
            class="timeline-input"
            min={0}
            max={Math.max(1, duration)}
            value={Math.min(position, duration || 1)}
            aria-label="Seek timeline"
            onInput={e => {
              const next = Number((e.target as HTMLInputElement).value);
              if (videoRef.current) videoRef.current.currentTime = next;
              setPosition(next);
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--color-text-muted)',
            }}
          >
            {formatTime(duration)}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Button variant="primary" onClick={togglePlay}>
              {playing ? `❚❚ ${t('player.pause')}` : `▶ ${t('player.play')}`}
            </Button>
            <Button variant="glass" onClick={() => seekBy(-10)}>
              ↺ 10s
            </Button>
            <Button variant="glass" onClick={() => seekBy(10)}>
              10s ↻
            </Button>
            {nextEpisode && (
              <Button variant="glass" onClick={() => openEpisode(nextEpisode.id)}>
                {t('player.nextEp')} →
              </Button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {streams.length > 1 && (
              <ChoiceTabs
                ariaLabel={t('player.quality')}
                value={String(streamIdx)}
                onChange={v => {
                  const idx = Number(v);
                  setStreamIdx(idx);
                  showToast(`${t('player.quality')}: ${streams[idx]?.quality}`);
                }}
                options={streams.map((s, i) => ({ value: String(i), label: s.quality }))}
              />
            )}
            <ChoiceTabs
              ariaLabel={t('player.speed')}
              value={String(appSettings.value.playbackRate)}
              onChange={v => updateSettings({ playbackRate: Number(v) })}
              options={[
                { value: '1', label: '1.0x' },
                { value: '1.25', label: '1.25x' },
                { value: '1.5', label: '1.5x' },
                { value: '2', label: '2.0x' },
              ]}
            />
            <Button
              variant="glass"
              onClick={() => {
                if (!document.fullscreenElement) {
                  void document.documentElement.requestFullscreen?.();
                } else {
                  void document.exitFullscreen?.();
                }
              }}
            >
              ⛶ {t('player.fullscreen')}
            </Button>
          </div>
        </div>
      </div>

      <Sidebar open={drawerOpen} title={t('detail.episodes')} onClose={() => setDrawerOpen(false)}>
        {detail?.episodes.map(ep => (
          <button
            key={ep.id}
            type="button"
            class={`episode-row${ep.id === activeEpisode?.id ? ' active' : ''}`}
            style={{ width: '100%', cursor: 'pointer', textAlign: 'left' }}
            onClick={() => openEpisode(ep.id)}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '13.5px' }}>
                E{ep.number} · {ep.title}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--color-text-muted)' }}>
                {ep.candidates.map(c => c.quality).join(' / ')}
              </div>
            </div>
          </button>
        ))}
      </Sidebar>
    </div>
  );
}
