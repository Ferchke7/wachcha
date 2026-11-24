import { useState } from 'preact/hooks';
import { cacheStats, clearAllCache } from '~/lib/cache-store';
import { locale, setLocale, t } from '~/lib/i18n';
import { appSettings, updateSettings } from '~/lib/playback-session';
import type { Locale, PlaybackEngine, ShaderPreset } from '~/lib/types';
import { Button, ChoiceTabs, Toggle, showToast } from '~/ui';

export function Settings() {
  const [stats, setStats] = useState(cacheStats);
  const s = appSettings.value;

  return (
    <section class="shelf-section">
      <h1 class="shelf-title" style={{ fontSize: '26px' }}>
        {t('settings.title')}
      </h1>

      <div class="two-col-grid">
        <div class="panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 class="shelf-title">{t('settings.playback')}</h2>

          <div>
            <div
              style={{ marginBottom: '8px', color: 'var(--color-text-muted)', fontSize: '12.5px' }}
            >
              {t('settings.engine')}
            </div>
            <ChoiceTabs<PlaybackEngine>
              value={s.engine}
              onChange={engine => updateSettings({ engine })}
              options={[
                { value: 'auto', label: 'Auto (libmpv → Shaka)' },
                { value: 'shaka', label: 'Shaka MSE' },
                { value: 'libmpv', label: 'Native libmpv' },
              ]}
            />
          </div>

          <div>
            <div
              style={{ marginBottom: '8px', color: 'var(--color-text-muted)', fontSize: '12.5px' }}
            >
              {t('settings.shader')}
            </div>
            <ChoiceTabs<ShaderPreset>
              value={s.shader}
              onChange={shader => updateSettings({ shader })}
              options={[
                { value: 'off', label: 'Off' },
                { value: 'anime4k-fast', label: 'Anime4K x2' },
                { value: 'fsr', label: 'AMD FSR' },
                { value: 'fsrcnnx', label: 'FSRCNNX' },
              ]}
            />
          </div>

          <Toggle
            label={t('settings.autoSkipIntro')}
            checked={s.autoSkipIntro}
            onChange={autoSkipIntro => updateSettings({ autoSkipIntro })}
          />
          <Toggle
            label={t('settings.autoSkipOutro')}
            checked={s.autoSkipOutro}
            onChange={autoSkipOutro => updateSettings({ autoSkipOutro })}
          />
          <Toggle
            label={t('settings.autoNext')}
            checked={s.autoNextEpisode}
            onChange={autoNextEpisode => updateSettings({ autoNextEpisode })}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div class="panel" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h2 class="shelf-title">{t('settings.language')}</h2>
            <ChoiceTabs<Locale>
              value={locale.value}
              onChange={next => setLocale(next)}
              options={[
                { value: 'en', label: 'English' },
                { value: 'ru', label: 'Русский' },
                { value: 'tr', label: 'Türkçe' },
              ]}
            />
          </div>

          <div class="panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h2 class="shelf-title">{t('settings.experience')}</h2>
            <Toggle
              label={t('settings.animations')}
              checked={s.animations}
              onChange={animations => updateSettings({ animations })}
            />
            <Toggle
              label={t('settings.tvMode')}
              checked={s.tvMode}
              onChange={tvMode => updateSettings({ tvMode })}
            />
            <Toggle
              label={t('settings.discord')}
              checked={s.discordPresence}
              onChange={discordPresence => updateSettings({ discordPresence })}
            />
          </div>

          <div class="panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h2 class="shelf-title">{t('settings.cache')}</h2>
            <div class="mono-badge" style={{ alignSelf: 'flex-start' }}>
              {t('settings.cacheSummary', { entries: stats.entries, images: stats.images })}
            </div>
            <div>
              <Button
                variant="glass"
                onClick={async () => {
                  await clearAllCache();
                  setStats(cacheStats());
                  showToast(t('settings.clearCache'));
                }}
              >
                {t('settings.clearCache')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
