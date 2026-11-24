/**
 * Unified Tauri v2 IPC + Web preview bridge.
 * Inside Tauri desktop/TV builds, all provider calls execute in-process in Rust.
 * In browser preview (`npm run dev:web`), keyless CORS-friendly endpoints remain usable.
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  CatalogShelf,
  DesktopInfo,
  Locale,
  MediaDetail,
  MediaItem,
  ProviderHealth,
  ProviderInfo,
  SearchQuery,
  SearchResponse,
  StreamCandidate,
  StreamResolution,
} from './types';

const WEB_ADDONS_KEY = 'wachcha:web-addons';
const WEB_PROVIDERS_KEY = 'wachcha:web-provider-state';

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function translateMediaUrl(uri: string): string {
  if (!uri.startsWith('wachcha-media://localhost/')) return uri;
  const isWindows =
    typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('windows');
  if (isWindows) {
    return uri.replace('wachcha-media://localhost/', 'http://wachcha-media.localhost/');
  }
  return uri;
}

const DEFAULT_WEB_PROVIDERS: ProviderInfo[] = [
  {
    id: 'aniliberty',
    name: 'AniLiberty API v1',
    description: 'Keyless Russian-dubbed anime catalog + direct HLS (480p/720p/1080p) & skips.',
    categories: ['anime'],
    enabled: true,
    requiresKey: false,
    keyConfigured: true,
    keyless: true,
    streamCapable: true,
    kind: 'native',
  },
  {
    id: 'shikimori',
    name: 'Shikimori Public API',
    description: 'Keyless RU/EN anime metadata, ratings, genres & MAL ID reconciliation.',
    categories: ['anime'],
    enabled: true,
    requiresKey: false,
    keyConfigured: true,
    keyless: true,
    streamCapable: false,
    kind: 'native',
  },
  {
    id: 'yummy_public',
    name: 'YummyAnime Public API',
    description: 'Anime catalog & schedules with automatic 5s mirror failover.',
    categories: ['anime'],
    enabled: true,
    requiresKey: false,
    keyConfigured: true,
    keyless: true,
    streamCapable: false,
    kind: 'native',
  },
  {
    id: 'tmdb',
    name: 'TMDB v3 Multilingual',
    description: 'Movies, Russian Cinema (RU), and Turkish Dizis (TR) localized in EN/RU/TR.',
    categories: ['movie', 'series', 'turkish-dizi'],
    enabled: true,
    requiresKey: true,
    keyConfigured: Boolean(import.meta.env?.VITE_TMDB_API_KEY),
    keyless: false,
    streamCapable: false,
    kind: 'native',
  },
  {
    id: 'tvmaze',
    name: 'TVMaze Open Catalog',
    description: 'Keyless global TV & Turkish broadcast networks (TRT 1, ATV, Kanal D, Star TV).',
    categories: ['series', 'turkish-dizi'],
    enabled: true,
    requiresKey: false,
    keyConfigured: true,
    keyless: true,
    streamCapable: false,
    kind: 'native',
  },
  {
    id: 'rutube',
    name: 'Rutube Public Catalog',
    description: 'Free Russian movies, classic Mosfilm channels & public HLS streams.',
    categories: ['movie', 'series'],
    enabled: true,
    requiresKey: false,
    keyConfigured: true,
    keyless: true,
    streamCapable: true,
    kind: 'native',
  },
  {
    id: 'turkish_channels',
    name: 'Turkish Official Broadcasters',
    description: 'Curated Turkish dizi hub (TRT 1, ATV, Star TV, Show TV) with IMDb/TMDB IDs.',
    categories: ['turkish-dizi'],
    enabled: true,
    requiresKey: false,
    keyConfigured: true,
    keyless: true,
    streamCapable: false,
    kind: 'native',
  },
];

const CURATED_DIZIS: MediaItem[] = [
  {
    id: 'tr-kurulus-osman',
    provider: 'turkish_channels',
    category: 'turkish-dizi',
    title: 'Kuruluş: Osman',
    originalTitle: 'Kuruluş: Osman',
    year: 2019,
    rating: 8.6,
    genres: ['History', 'Action', 'Drama'],
    badges: ['ATV TR', 'Dizi'],
    audioLanguages: ['TR', 'RU'],
    externalIds: { imdb: 'tt11093750', tmdb: 95594 },
    streamReady: false,
    sources: [{ provider: 'turkish_channels', id: 'tr-kurulus-osman', label: 'ATV Official' }],
  },
  {
    id: 'tr-yali-capkini',
    provider: 'turkish_channels',
    category: 'turkish-dizi',
    title: 'Yalı Çapkını',
    originalTitle: 'Yalı Çapkını',
    year: 2022,
    rating: 8.3,
    genres: ['Drama', 'Romance'],
    badges: ['Star TV', 'Dizi'],
    audioLanguages: ['TR', 'RU'],
    externalIds: { imdb: 'tt21431986', tmdb: 211089 },
    streamReady: false,
    sources: [{ provider: 'turkish_channels', id: 'tr-yali-capkini', label: 'Star TV Official' }],
  },
  {
    id: 'tr-kizilcik-serbeti',
    provider: 'turkish_channels',
    category: 'turkish-dizi',
    title: 'Kızılcık Şerbeti',
    originalTitle: 'Kızılcık Şerbeti',
    year: 2022,
    rating: 8.4,
    genres: ['Drama', 'Family'],
    badges: ['Show TV', 'Dizi'],
    audioLanguages: ['TR', 'RU'],
    externalIds: { imdb: 'tt22297608', tmdb: 213173 },
    streamReady: false,
    sources: [
      { provider: 'turkish_channels', id: 'tr-kizilcik-serbeti', label: 'Show TV Official' },
    ],
  },
  {
    id: 'tr-muhtesem-yuzyil',
    provider: 'turkish_channels',
    category: 'turkish-dizi',
    title: 'Muhteşem Yüzyıl',
    originalTitle: 'Muhteşem Yüzyıl',
    year: 2011,
    rating: 8.8,
    genres: ['History', 'Drama'],
    badges: ['Star TV Classic', 'Dizi'],
    audioLanguages: ['TR', 'RU'],
    externalIds: { imdb: 'tt1848620', tmdb: 46061 },
    streamReady: false,
    sources: [{ provider: 'turkish_channels', id: 'tr-muhtesem-yuzyil', label: 'Classic TR' }],
  },
  {
    id: 'tr-teskilat',
    provider: 'turkish_channels',
    category: 'turkish-dizi',
    title: 'Teşkilat',
    originalTitle: 'Teşkilat',
    year: 2021,
    rating: 8.2,
    genres: ['Action', 'Thriller'],
    badges: ['TRT 1', 'Dizi'],
    audioLanguages: ['TR', 'RU'],
    externalIds: { imdb: 'tt13711618', tmdb: 119316 },
    streamReady: false,
    sources: [{ provider: 'turkish_channels', id: 'tr-teskilat', label: 'TRT 1 Official' }],
  },
];

export async function getDesktopInfo(): Promise<DesktopInfo> {
  if (isTauriRuntime()) {
    return invoke<DesktopInfo>('desktop_info');
  }
  return {
    platform: 'web',
    version: '0.1.0',
    nativeVideo: { available: false, shaders: ['off'] },
  };
}

export async function listProviders(): Promise<ProviderInfo[]> {
  if (isTauriRuntime()) {
    return invoke<ProviderInfo[]>('list_providers');
  }
  let overrides: Record<string, { enabled?: boolean; keyConfigured?: boolean }> = {};
  let addons: ProviderInfo[] = [];
  try {
    overrides = JSON.parse(localStorage.getItem(WEB_PROVIDERS_KEY) || '{}');
    addons = JSON.parse(localStorage.getItem(WEB_ADDONS_KEY) || '[]');
  } catch {
    // Ignore storage errors.
  }
  return [
    ...DEFAULT_WEB_PROVIDERS.map(p => ({
      ...p,
      enabled: overrides[p.id]?.enabled ?? p.enabled,
      keyConfigured: overrides[p.id]?.keyConfigured ?? p.keyConfigured,
    })),
    ...addons,
  ];
}

export async function configureProvider(patch: {
  id: string;
  enabled?: boolean;
  apiKey?: string;
}): Promise<ProviderInfo> {
  if (isTauriRuntime()) {
    return invoke<ProviderInfo>('configure_provider', { patch });
  }
  const overrides = JSON.parse(localStorage.getItem(WEB_PROVIDERS_KEY) || '{}');
  overrides[patch.id] = {
    ...(overrides[patch.id] || {}),
    ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
    ...(patch.apiKey !== undefined ? { keyConfigured: patch.apiKey.trim().length > 0 } : {}),
  };
  localStorage.setItem(WEB_PROVIDERS_KEY, JSON.stringify(overrides));
  const list = await listProviders();
  return list.find(p => p.id === patch.id) || DEFAULT_WEB_PROVIDERS[0];
}

export async function installStremioAddon(manifestUrl: string): Promise<ProviderInfo> {
  if (isTauriRuntime()) {
    const entry = await invoke<{ id: string; name: string; version: string; resources: string[] }>(
      'install_stremio_addon',
      { manifestUrl }
    );
    return {
      id: `addon:${entry.id}`,
      name: entry.name,
      description: `Stremio Addon v${entry.version} (${entry.resources.join(', ')})`,
      categories: ['movie', 'series'],
      enabled: true,
      requiresKey: false,
      keyConfigured: true,
      keyless: true,
      streamCapable: entry.resources.includes('stream'),
      kind: 'stremio',
    };
  }
  const clean = manifestUrl.trim();
  if (!clean.startsWith('https://') || !clean.endsWith('manifest.json')) {
    throw new Error('Addon URL must be HTTPS and end with /manifest.json');
  }
  const id = clean.replace(/[^a-z0-9]/gi, '').slice(-10);
  const entry: ProviderInfo = {
    id: `addon:${id}`,
    name: new URL(clean).hostname,
    description: `Stremio Addon (${clean})`,
    categories: ['movie', 'series', 'turkish-dizi', 'anime'],
    enabled: true,
    requiresKey: false,
    keyConfigured: true,
    keyless: true,
    streamCapable: true,
    kind: 'stremio',
  };
  const existing: ProviderInfo[] = JSON.parse(localStorage.getItem(WEB_ADDONS_KEY) || '[]');
  localStorage.setItem(
    WEB_ADDONS_KEY,
    JSON.stringify([...existing.filter(a => a.id !== entry.id), entry])
  );
  return entry;
}

export async function removeStremioAddon(addonId: string): Promise<void> {
  if (isTauriRuntime()) {
    return invoke('remove_stremio_addon', { addonId });
  }
  const existing: ProviderInfo[] = JSON.parse(localStorage.getItem(WEB_ADDONS_KEY) || '[]');
  localStorage.setItem(WEB_ADDONS_KEY, JSON.stringify(existing.filter(a => a.id !== addonId)));
}

export async function addM3uPlaylist(name: string, url: string): Promise<void> {
  if (isTauriRuntime()) {
    await invoke('add_m3u_playlist', { name, url });
    return;
  }
  if (!url.trim().startsWith('https://')) {
    throw new Error('M3U8 playlist URL must use HTTPS.');
  }
}

export async function checkProviderHealth(): Promise<ProviderHealth[]> {
  if (isTauriRuntime()) {
    return invoke<ProviderHealth[]>('check_provider_health');
  }
  return [
    {
      provider: 'aniliberty',
      activeMirror: 'https://aniliberty.top/api/v1',
      healthy: true,
      latencyMs: 42,
      detail: 'Web preview ready',
    },
    {
      provider: 'tvmaze',
      activeMirror: 'https://api.tvmaze.com',
      healthy: true,
      latencyMs: 55,
      detail: 'Web preview ready',
    },
    {
      provider: 'turkish_channels',
      activeMirror: 'local://registry',
      healthy: true,
      latencyMs: 1,
      detail: 'Curated directory',
    },
  ];
}

export async function getHomeShelves(locale: Locale): Promise<CatalogShelf[]> {
  if (isTauriRuntime()) {
    return invoke<CatalogShelf[]>('get_home_shelves', { locale });
  }
  const shelves: CatalogShelf[] = [];
  try {
    const resp = await fetch('https://aniliberty.top/api/v1/anime/releases/latest?limit=10');
    if (resp.ok) {
      const rows = (await resp.json()) as Array<{
        id: number;
        alias?: string;
        name?: { main?: string; english?: string };
        year?: number;
        poster?: { optimized?: { src?: string }; src?: string };
      }>;
      const items: MediaItem[] = (Array.isArray(rows) ? rows : []).map(r => {
        const poster = r.poster?.optimized?.src || r.poster?.src;
        return {
          id: r.alias || String(r.id),
          provider: 'aniliberty',
          category: 'anime',
          title: r.name?.main || r.name?.english || 'Anime',
          originalTitle: r.name?.english,
          year: r.year,
          posterUrl: poster
            ? poster.startsWith('http')
              ? poster
              : `https://aniliberty.top${poster}`
            : undefined,
          genres: [],
          badges: ['AniLiberty', 'HLS', 'RU Dub'],
          audioLanguages: ['RU'],
          externalIds: { aniliberty: r.id },
          streamReady: true,
          sources: [{ provider: 'aniliberty', id: r.alias || String(r.id), label: 'AniLiberty' }],
        };
      });
      if (items.length) {
        shelves.push({
          id: 'trending-anime',
          titleKey: 'shelf.trendingAnime',
          providerBadge: 'AniLiberty v1 · Direct HLS',
          category: 'anime',
          items,
        });
      }
    }
  } catch {
    // Graceful offline fallback.
  }

  shelves.push({
    id: 'turkish-dizis',
    titleKey: 'shelf.turkishDizis',
    providerBadge: 'TMDB TR · Official Broadcasters',
    category: 'turkish-dizi',
    items: CURATED_DIZIS,
  });

  return shelves;
}

export async function searchCatalog(query: SearchQuery): Promise<SearchResponse> {
  if (isTauriRuntime()) {
    return invoke<SearchResponse>('search_catalog', { query });
  }
  const q = query.text.trim();
  if (!q) return { query: q, items: [], providerErrors: [] };

  const items: MediaItem[] = [];
  const errors: string[] = [];

  // Match curated Turkish dizis locally
  const lower = q.toLowerCase();
  for (const d of CURATED_DIZIS) {
    if (
      d.title.toLowerCase().includes(lower) ||
      d.badges.some(b => b.toLowerCase().includes(lower)) ||
      lower.includes('dizi') ||
      lower.includes('turk')
    ) {
      items.push(d);
    }
  }

  // Live keyless AniLiberty + TVMaze in browser preview
  await Promise.all([
    fetch(`https://aniliberty.top/api/v1/app/search/releases?query=${encodeURIComponent(q)}`)
      .then(r => (r.ok ? r.json() : []))
      .then((rows: Array<Record<string, unknown>>) => {
        for (const r of Array.isArray(rows) ? rows : []) {
          const name = r.name as { main?: string; english?: string } | undefined;
          const posterObj = r.poster as { optimized?: { src?: string }; src?: string } | undefined;
          const p = posterObj?.optimized?.src || posterObj?.src;
          const alias = String(r.alias || r.id);
          items.push({
            id: alias,
            provider: 'aniliberty',
            category: 'anime',
            title: name?.main || name?.english || 'Anime',
            originalTitle: name?.english,
            year: typeof r.year === 'number' ? r.year : undefined,
            posterUrl: p ? (p.startsWith('http') ? p : `https://aniliberty.top${p}`) : undefined,
            genres: [],
            badges: ['AniLiberty', 'HLS', 'RU Dub'],
            audioLanguages: ['RU'],
            externalIds: { aniliberty: Number(r.id) || undefined },
            streamReady: true,
            sources: [{ provider: 'aniliberty', id: alias, label: 'AniLiberty HLS' }],
          });
        }
      })
      .catch(e => errors.push(`aniliberty: ${String(e)}`)),
    fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`)
      .then(r => (r.ok ? r.json() : []))
      .then((rows: Array<{ show?: Record<string, unknown> }>) => {
        for (const row of Array.isArray(rows) ? rows : []) {
          const s = row.show;
          if (!s || !s.id || !s.name) continue;
          const lang = String(s.language || '');
          const isTr = lang.toLowerCase() === 'turkish';
          const img = s.image as { medium?: string } | undefined;
          const rating = (s.rating as { average?: number } | undefined)?.average;
          items.push({
            id: String(s.id),
            provider: 'tvmaze',
            category: isTr ? 'turkish-dizi' : 'series',
            title: String(s.name),
            year: typeof s.premiered === 'string' ? Number(s.premiered.slice(0, 4)) : undefined,
            rating: typeof rating === 'number' ? rating : undefined,
            posterUrl: img?.medium?.replace('http://', 'https://'),
            genres: Array.isArray(s.genres) ? s.genres.map(String) : [],
            badges: ['TVMaze'],
            audioLanguages: isTr ? ['TR'] : [],
            externalIds: { tvmaze: Number(s.id) },
            streamReady: false,
            sources: [{ provider: 'tvmaze', id: String(s.id), label: 'TVMaze' }],
          });
        }
      })
      .catch(e => errors.push(`tvmaze: ${String(e)}`)),
  ]);

  const filtered = query.category ? items.filter(i => i.category === query.category) : items;
  return { query: q, items: filtered, providerErrors: errors };
}

export async function getMediaDetail(
  provider: string,
  id: string,
  locale: Locale
): Promise<MediaDetail> {
  if (isTauriRuntime()) {
    return invoke<MediaDetail>('get_media_detail', { provider, id, locale });
  }
  if (provider === 'aniliberty') {
    const resp = await fetch(
      `https://aniliberty.top/api/v1/anime/releases/${encodeURIComponent(id)}`
    );
    if (!resp.ok) throw new Error(`AniLiberty HTTP ${resp.status}`);
    const data = await resp.json();
    const p = data.poster?.optimized?.src || data.poster?.src;
    const item: MediaItem = {
      id: data.alias || String(data.id),
      provider: 'aniliberty',
      category: 'anime',
      title: data.name?.main || data.name?.english || id,
      originalTitle: data.name?.english,
      year: data.year,
      posterUrl: p ? (p.startsWith('http') ? p : `https://aniliberty.top${p}`) : undefined,
      genres: Array.isArray(data.genres) ? data.genres.map((g: { name: string }) => g.name) : [],
      badges: ['AniLiberty', 'HLS', 'RU Dub'],
      audioLanguages: ['RU'],
      externalIds: { aniliberty: data.id },
      streamReady: true,
      sources: [{ provider: 'aniliberty', id, label: 'AniLiberty HLS' }],
    };
    const episodes = (data.episodes || []).map(
      (ep: {
        id?: string;
        ordinal: number;
        name?: string;
        duration?: number;
        opening?: { start?: number; stop?: number };
        ending?: { start?: number; stop?: number };
        hls_1080?: string;
        hls_720?: string;
        hls_480?: string;
      }) => {
        const epId = ep.id || `ep-${ep.ordinal}`;
        const skips = [];
        if (ep.opening?.start != null && ep.opening?.stop != null) {
          skips.push({ kind: 'opening' as const, from: ep.opening.start, to: ep.opening.stop });
        }
        if (ep.ending?.start != null && ep.ending?.stop != null) {
          skips.push({ kind: 'ending' as const, from: ep.ending.start, to: ep.ending.stop });
        }
        const candidates: StreamCandidate[] = [];
        for (const [url, quality, preferred] of [
          [ep.hls_1080, '1080p', true],
          [ep.hls_720, '720p', false],
          [ep.hls_480, '480p', false],
        ] as const) {
          if (url && url.startsWith('https://')) {
            candidates.push({
              provider: 'aniliberty',
              mediaId: item.id,
              episodeId: epId,
              voiceLabel: 'AniLibria (RU)',
              quality,
              format: 'hls',
              url,
              preferred,
              skips,
              subtitles: [],
            });
          }
        }
        return {
          id: epId,
          season: 1,
          number: ep.ordinal,
          title: ep.name || `Episode ${ep.ordinal}`,
          durationSeconds: ep.duration,
          skips,
          candidates,
        };
      }
    );
    return {
      item,
      synopsis: data.description || '',
      status: data.is_ongoing ? 'Ongoing' : 'Completed',
      voices: ['AniLibria (RU)'],
      episodes,
    };
  }

  const foundDizi = CURATED_DIZIS.find(d => d.id === id);
  if (foundDizi) {
    return {
      item: foundDizi,
      synopsis: `${foundDizi.title} — Turkish television drama indexed with IMDb (${foundDizi.externalIds.imdb}) and TMDB (${foundDizi.externalIds.tmdb}). Install a Stremio stream addon in Sources to play localized streams.`,
      status: 'Broadcast Catalog',
      voices: ['Original (TR)', 'Russian Dub (Addon)'],
      episodes: [
        {
          id: `${id}-s1e1`,
          season: 1,
          number: 1,
          title: `${foundDizi.title} · Episode 1`,
          durationSeconds: 7200,
          skips: [],
          candidates: [],
        },
      ],
    };
  }

  throw new Error('Detail unavailable in web preview mode.');
}

export async function resolveStreams(candidates: StreamCandidate[]): Promise<StreamResolution> {
  if (isTauriRuntime()) {
    return invoke<StreamResolution>('resolve_streams', { candidates });
  }
  return {
    provider: candidates[0]?.provider || 'web',
    episodeId: candidates[0]?.episodeId || '',
    streams: candidates.map(c => ({
      provider: c.provider,
      quality: c.quality,
      format: c.format,
      url: c.url,
      relayed: false,
      sourceHost: new URL(c.url).hostname,
      voiceLabel: c.voiceLabel,
      skips: c.skips || [],
      subtitles: c.subtitles || [],
    })),
  };
}

export async function fetchImageNative(
  url: string
): Promise<{ mime: string; base64: string; bytes: number } | null> {
  if (!isTauriRuntime()) return null;
  try {
    return await invoke('fetch_image', { url });
  } catch {
    return null;
  }
}

export async function setKeepAwake(active: boolean): Promise<void> {
  if (isTauriRuntime()) {
    await invoke('set_keep_awake', { active }).catch(() => {});
  }
}
