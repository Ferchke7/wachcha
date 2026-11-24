import { useEffect, useState } from 'preact/hooks';
import { getWeeklySchedule } from '~/lib/desktop';
import { t, type TranslationKey } from '~/lib/i18n';
import type { MediaItem } from '~/lib/types';
import { CardRowSkeleton, ChoiceTabs, EmptyState } from '~/ui';
import { MediaCard } from './MediaCard';

function getTodayIndex(): number {
  const jsDay = new Date().getDay(); // 0=Sun..6=Sat
  return jsDay === 0 ? 6 : jsDay - 1; // 0=Mon..6=Sun
}

export function Schedule() {
  const todayIdx = getTodayIndex();
  const [selectedDay, setSelectedDay] = useState<number>(todayIdx);
  const [days, setDays] = useState<MediaItem[][]>([[], [], [], [], [], [], []]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getWeeklySchedule()
      .then(data => {
        if (alive) {
          setDays(data.days);
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const dayItems = days[selectedDay] || [];

  return (
    <section class="shelf-section">
      <div class="shelf-header">
        <div>
          <h1 class="shelf-title" style={{ fontSize: '26px' }}>
            📅 {t('schedule.title')}
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: '13px' }}>
            {t('schedule.subtitle')}
          </p>
        </div>
        <span class="mono-badge">{dayItems.length}</span>
      </div>

      <ChoiceTabs<string>
        ariaLabel="Schedule weekday"
        value={String(selectedDay)}
        onChange={v => setSelectedDay(Number(v))}
        options={[0, 1, 2, 3, 4, 5, 6].map(idx => ({
          value: String(idx),
          label: `${t(`schedule.day.${idx}` as TranslationKey)}${idx === todayIdx ? ` · ${t('schedule.today')}` : ''} (${days[idx]?.length || 0})`,
        }))}
      />

      {loading ? (
        <CardRowSkeleton count={8} />
      ) : dayItems.length === 0 ? (
        <EmptyState title={t('schedule.empty')} />
      ) : (
        <div class="poster-grid">
          {dayItems.map(item => (
            <MediaCard key={`${item.provider}:${item.id}`} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
