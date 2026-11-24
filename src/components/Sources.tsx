import { useEffect, useState } from 'preact/hooks';
import {
  addM3uPlaylist,
  checkProviderHealth,
  configureProvider,
  installStremioAddon,
  listProviders,
  removeStremioAddon,
} from '~/lib/desktop';
import { t } from '~/lib/i18n';
import type { ProviderHealth, ProviderInfo } from '~/lib/types';
import { Button, showToast } from '~/ui';

const PRESET_ADDONS = [
  {
    name: 'OpenSubtitles v3 (RU / TR / EN)',
    desc: 'Automatic Russian, Turkish & English subtitles for Movies & Series',
    url: 'https://opensubtitles-v3.strem.io/manifest.json',
  },
  {
    name: 'WatchHub (Official Sources)',
    desc: 'Official broadcaster & streaming catalog links',
    url: 'https://watchhub.strem.io/manifest.json',
  },
  {
    name: 'Cinemeta IMDb v3',
    desc: 'Official IMDb Top-250 movies, series, trailers & episodes',
    url: 'https://v3-cinemeta.strem.io/manifest.json',
  },
];

const PRESET_PLAYLISTS = [
  {
    name: 'IPTV-Org Turkey (Free-to-Air)',
    url: 'https://iptv-org.github.io/iptv/languages/tur.m3u',
  },
  {
    name: 'IPTV-Org Russia (Free-to-Air)',
    url: 'https://iptv-org.github.io/iptv/languages/rus.m3u',
  },
];

export function Sources({ onChanged }: { onChanged?: () => void }) {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [health, setHealth] = useState<Record<string, ProviderHealth>>({});
  const [checking, setChecking] = useState(false);
  const [addonUrl, setAddonUrl] = useState('');
  const [m3uName, setM3uName] = useState('');
  const [m3uUrl, setM3uUrl] = useState('');
  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({});

  const reload = async () => {
    const list = await listProviders();
    setProviders(list);
    onChanged?.();
  };

  useEffect(() => {
    void reload();
  }, []);

  const runHealth = async () => {
    setChecking(true);
    try {
      const results = await checkProviderHealth();
      const map: Record<string, ProviderHealth> = {};
      for (const r of results) map[r.provider] = r;
      setHealth(map);
    } finally {
      setChecking(false);
    }
  };

  const handleToggle = async (p: ProviderInfo) => {
    await configureProvider({ id: p.id, enabled: !p.enabled });
    await reload();
  };

  const handleSaveKey = async (id: string) => {
    await configureProvider({ id, apiKey: keyDrafts[id] || '' });
    showToast(`${id}: ${t('player.saved')}`);
    await reload();
  };

  const handleInstallAddon = async (e: Event) => {
    e.preventDefault();
    try {
      const added = await installStremioAddon(addonUrl);
      setAddonUrl('');
      showToast(`Installed ${added.name}`);
      await reload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err));
    }
  };

  const handleAddM3u = async (e: Event) => {
    e.preventDefault();
    try {
      await addM3uPlaylist(m3uName || 'Free-to-Air M3U8', m3uUrl);
      setM3uName('');
      setM3uUrl('');
      showToast('M3U8 playlist loaded');
      await reload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err));
    }
  };

  const nativeProviders = providers.filter(p => p.kind === 'native');
  const addonProviders = providers.filter(p => p.kind !== 'native');

  return (
    <section class="shelf-section">
      <div class="shelf-header">
        <div>
          <h1 class="shelf-title" style={{ fontSize: '26px' }}>
            {t('sources.title')}
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--color-text-muted)' }}>
            {t('sources.subtitle')}
          </p>
        </div>
        <Button variant="primary" disabled={checking} onClick={runHealth}>
          ↻ {checking ? t('sources.checking') : t('sources.checkHealth')}
        </Button>
      </div>

      <div class="two-col-grid">
        <div class="panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h2 class="shelf-title">{t('sources.builtin')}</h2>
          {nativeProviders.map(p => {
            const h = health[p.id];
            return (
              <div
                key={p.id}
                class="provider-row"
                style={{ flexDirection: 'column', alignItems: 'stretch' }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{p.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      {p.description}
                    </div>
                  </div>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}
                  >
                    {h && (
                      <span
                        class="mono-badge"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <span class={`status-dot${h.healthy ? '' : ' offline'}`} />
                        {h.healthy
                          ? `${t('sources.online')} ${h.latencyMs ?? 0}ms`
                          : t('sources.offline')}
                      </span>
                    )}
                    <button
                      type="button"
                      class={`choice-pill${p.enabled ? ' active' : ''}`}
                      onClick={() => handleToggle(p)}
                    >
                      {p.enabled ? t('sources.on') : t('sources.off')}
                    </button>
                  </div>
                </div>
                {p.requiresKey && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <input
                      type="password"
                      class="input-field"
                      placeholder={t('sources.apiKeyPlaceholder')}
                      value={keyDrafts[p.id] || ''}
                      onInput={e =>
                        setKeyDrafts({ ...keyDrafts, [p.id]: (e.target as HTMLInputElement).value })
                      }
                    />
                    <Button variant="glass" onClick={() => handleSaveKey(p.id)}>
                      {t('sources.saveKey')}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <form
            class="panel"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              borderColor: 'var(--color-border-accent)',
            }}
            onSubmit={handleInstallAddon}
          >
            <h2 class="shelf-title">{t('sources.addonsTitle')}</h2>
            <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
              {t('sources.addonsHint')}
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="url"
                class="input-field"
                placeholder="https://addon.example.org/manifest.json"
                value={addonUrl}
                onInput={e => setAddonUrl((e.target as HTMLInputElement).value)}
              />
              <Button type="submit" variant="primary">
                {t('sources.install')}
              </Button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {PRESET_ADDONS.map(preset => (
                <button
                  key={preset.url}
                  type="button"
                  class="choice-pill"
                  title={preset.desc}
                  onClick={async () => {
                    try {
                      const added = await installStremioAddon(preset.url);
                      showToast(`Installed ${added.name}`);
                      await reload();
                    } catch (err) {
                      showToast(err instanceof Error ? err.message : String(err));
                    }
                  }}
                >
                  + {preset.name}
                </button>
              ))}
            </div>
            {addonProviders.map(a => (
              <div key={a.id} class="provider-row">
                <div>
                  <div style={{ fontWeight: 600 }}>{a.name}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--color-accent-soft)' }}>
                    {a.description}
                  </div>
                </div>
                {a.id === 'addon:opensubtitles-v3' ? (
                  <span class="choice-pill active">{t('sources.on')}</span>
                ) : (
                  <Button
                    variant="danger"
                    onClick={async () => {
                      await removeStremioAddon(a.id);
                      await reload();
                    }}
                  >
                    {t('sources.remove')}
                  </Button>
                )}
              </div>
            ))}
          </form>

          <form
            class="panel"
            style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
            onSubmit={handleAddM3u}
          >
            <h2 class="shelf-title">{t('sources.m3uTitle')}</h2>
            <input
              type="text"
              class="input-field"
              placeholder="Turkish & Russian Free-to-Air"
              value={m3uName}
              onInput={e => setM3uName((e.target as HTMLInputElement).value)}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="url"
                class="input-field"
                placeholder="https://iptv-org.github.io/iptv/languages/tur.m3u"
                value={m3uUrl}
                onInput={e => setM3uUrl((e.target as HTMLInputElement).value)}
              />
              <Button type="submit" variant="glass">
                {t('sources.m3uAdd')}
              </Button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {PRESET_PLAYLISTS.map(pl => (
                <button
                  key={pl.url}
                  type="button"
                  class="choice-pill"
                  onClick={async () => {
                    try {
                      await addM3uPlaylist(pl.name, pl.url);
                      showToast(`Loaded ${pl.name}`);
                      await reload();
                    } catch (err) {
                      showToast(err instanceof Error ? err.message : String(err));
                    }
                  }}
                >
                  + {pl.name}
                </button>
              ))}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
