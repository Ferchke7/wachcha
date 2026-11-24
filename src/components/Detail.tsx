import { useEffect, useState } from 'preact/hooks';
import { getMediaDetail } from '~/lib/desktop';
import { locale, t } from '~/lib/i18n';
import { getContinueEntry, getLibraryEntry, setWatchStatus, toggleFavorite } from '~/lib/library';
import { navigateBack, navigateTo } from '~/lib/navigation';
import { formatTime } from '~/lib/playback-session';
import type { MediaDetail, WatchStatus } from '~/lib/types';
import { Button, CachedImage, ChoiceTabs, EmptyState, Skeleton } from '~/ui';

export function Detail({ provider, id }: { provider: string; id: string }) {
  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<string>('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    getMediaDetail(provider, id, locale.value)
      .then(data => {
        if (!alive) return;
        setDetail(data);
        setSelectedVoice(data.voices[0] || '');
        setLoading(false);
      })
      .catch(err => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [provider, id, locale.value]);

  if (loading) return <Skeleton height={340} />;
  if (error || !detail) {
    return (
      <EmptyState
        title={error || t('common.error')}
        action={<Button onClick={() => navigateBack('/')}>← {t('detail.back')}</Button>}
      />
    );
  }

  const { item, episodes } = detail;
  const lib = getLibraryEntry(item.provider, item.id);
  const resume = getContinueEntry(item.provider, item.id);
  const firstPlayable = episodes.find(e => e.candidates.length > 0) || episodes[0];

  const openWatch = (epId: string) => {
    navigateTo(
      `/watch/${encodeURIComponent(item.provider)}/${encodeURIComponent(item.id)}?ep=${encodeURIComponent(epId)}&voice=${encodeURIComponent(selectedVoice)}`
    );
  };

  return (
    <div class="shelf-section">
      <div>
        <Button variant="ghost" onClick={() => navigateBack('/')}>
          ← {t('detail.back')}
        </Button>
      </div>

      <section class="detail-hero">
        <div class="media-card-art">
          <CachedImage src={item.posterUrl} alt={item.title} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {item.badges.map(b => (
              <span key={b} class="mono-badge">
                {b}
              </span>
            ))}
            {item.rating != null && (
              <span style={{ color: 'var(--color-status-rating)', fontFamily: 'var(--font-mono)' }}>
                ★ {item.rating.toFixed(1)}
              </span>
            )}
            {item.year && <span style={{ color: 'var(--color-text-muted)' }}>{item.year}</span>}
          </div>

          <h1 style={{ margin: 0, fontSize: '30px', fontWeight: 800 }}>{item.title}</h1>
          {item.originalTitle && item.originalTitle !== item.title && (
            <div style={{ color: 'var(--color-accent-soft)', fontSize: '14px' }}>
              {item.originalTitle}
            </div>
          )}

          <p style={{ margin: 0, color: 'var(--color-text-secondary)', maxWidth: '72ch' }}>
            {detail.synopsis}
          </p>

          <div class="hero-actions">
            {firstPlayable && firstPlayable.candidates.length > 0 && (
              <Button
                variant="primary"
                onClick={() => openWatch(resume?.episodeId || firstPlayable.id)}
              >
                ▶{' '}
                {resume ? `${t('detail.resume')} ${formatTime(resume.position)}` : t('detail.play')}
              </Button>
            )}
            <Button variant="glass" onClick={() => toggleFavorite(item)}>
              {lib?.favorite ? `★ ${t('detail.favorited')}` : `☆ ${t('detail.favorite')}`}
            </Button>
          </div>

          <ChoiceTabs<WatchStatus>
            ariaLabel="Watchlist status"
            value={lib?.status || 'planned'}
            onChange={next => setWatchStatus(item, next)}
            options={[
              { value: 'watching', label: t('detail.status.watching') },
              { value: 'planned', label: t('detail.status.planned') },
              { value: 'completed', label: t('detail.status.completed') },
              { value: 'on_hold', label: t('detail.status.on_hold') },
              { value: 'dropped', label: t('detail.status.dropped') },
            ]}
          />

          {detail.voices.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span class="mono-badge">{t('detail.voices')}</span>
              <ChoiceTabs
                value={selectedVoice}
                onChange={setSelectedVoice}
                options={detail.voices.map(v => ({ value: v, label: v }))}
              />
            </div>
          )}
        </div>
      </section>

      <section class="shelf-section">
        <div class="shelf-header">
          <h2 class="shelf-title">
            {t('detail.episodes')} ({episodes.length})
          </h2>
        </div>

        {episodes.length === 0 || !episodes.some(e => e.candidates.length > 0) ? (
          <EmptyState
            title={t('detail.noStreams')}
            action={
              <Button variant="primary" onClick={() => navigateTo('/sources')}>
                ⚡ {t('nav.sources')}
              </Button>
            }
          />
        ) : (
          <div class="episode-list">
            {episodes.map(ep => {
              const isCurrent = resume?.episodeId === ep.id;
              return (
                <div key={ep.id} class={`episode-row${isCurrent ? ' active' : ''}`}>
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      S{ep.season} · E{ep.number} — {ep.title}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      {ep.durationSeconds ? formatTime(ep.durationSeconds) : 'HLS'} ·{' '}
                      {ep.candidates.map(c => c.quality).join(' / ')}
                      {ep.skips.length > 0 ? ' · Skip Intro' : ''}
                    </div>
                  </div>
                  <Button
                    variant={isCurrent ? 'primary' : 'glass'}
                    disabled={ep.candidates.length === 0}
                    onClick={() => openWatch(ep.id)}
                  >
                    ▶ {isCurrent ? t('detail.resume') : t('detail.play')}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
