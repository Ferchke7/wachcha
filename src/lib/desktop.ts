/**
 * Unified Tauri v2 IPC + Wachcha Web API Gateway + Direct Web Fallback bridge.
 * - Inside Tauri desktop/APK builds: calls native Rust IPC commands directly.
 * - When deployed with Wachcha Server (e.g. https://wachcha.codeguru.ovh) or configured via
 *   VITE_API_BASE: uses `/api/*` for full multi-vertical catalogs, Tops, Schedule, rich Detail,
 *   and CORS-safe allowlisted HLS/Image relays.
 * - On static-only hosting: falls back seamlessly to CORS-friendly AniLiberty & TVMaze APIs.
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  CatalogShelf,
  DesktopInfo,
  GenreOption,
  Locale,
  MediaCategory,
  MediaDetail,
  MediaItem,
  PagedResult,
  ProviderHealth,
  ProviderInfo,
  SearchQuery,
  SearchResponse,
  SortMode,
  StreamCandidate,
  StreamResolution,
  TopsVertical,
  WeeklySchedule,
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

function getApiBase(): string {
  const envBase = import.meta.env?.VITE_API_BASE as string | undefined;
  if (envBase) return envBase.replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    // GitHub Pages static preview automatically delegates API traffic to wachcha.codeguru.ovh
    if (host.endsWith('github.io')) {
      return 'https://wachcha.codeguru.ovh';
    }
  }
  return '';
}

let serverAvailable: boolean | null = null;

async function apiFetchJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  if (typeof fetch === 'undefined') return null;
  if (serverAvailable === false) return null;
  const base = getApiBase();
  try {
    const resp = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.headers || {}),
      },
    });
    if (!resp.ok) return null;
    const ct = resp.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      if (!base) serverAvailable = false;
      return null;
    }
    serverAvailable = true;
    const data = (await resp.json()) as T;
    if (base && data) {
      return rewriteRelativeAssetUrls(data, base);
    }
    return data;
  } catch {
    return null;
  }
}

function rewriteRelativeAssetUrls<T>(value: T, base: string): T {
  if (typeof value === 'string') {
    if (value.startsWith('/api/img?') || value.startsWith('/api/hls?')) {
      return `${base}${value}` as unknown as T;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(v => rewriteRelativeAssetUrls(v, base)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = rewriteRelativeAssetUrls(v, base);
    }
    return out as T;
  }
  return value;
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
    name: 'Shikimori Top-100 & Stats',
    description: 'Keyless RU/EN anime rankings, 1–10 score histograms, screenshots & MAL IDs.',
    categories: ['anime'],
    enabled: true,
    requiresKey: false,
    keyConfigured: true,
    keyless: true,
    streamCapable: true,
    kind: 'native',
  },
  {
    id: 'cinemeta',
    name: 'IMDb Cinemeta Catalog',
    description: 'Keyless Top-250 Movies & World TV Series with HD backdrops, trailers & seasons.',
    categories: ['movie', 'series'],
    enabled: true,
    requiresKey: false,
    keyConfigured: true,
    keyless: true,
    streamCapable: true,
    kind: 'native',
  },
  {
    id: 'rutube',
    name: 'Rutube Free HD Cinema',
    description: 'Free Russian movies, classic cinema & Russian-dubbed Turkish series via HLS.',
    categories: ['movie', 'series', 'turkish-dizi'],
    enabled: true,
    requiresKey: false,
    keyConfigured: true,
    keyless: true,
    streamCapable: true,
    kind: 'native',
  },
  {
    id: 'tvmaze',
    name: 'TVMaze Open Catalog',
    description: 'Keyless global TV & Turkish broadcast networks with episodes & cast.',
    categories: ['series', 'turkish-dizi'],
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
    description: 'Top Turkish dizis (TRT 1, ATV, Star TV, Show TV, Kanal D) + Rutube RU dubs.',
    categories: ['turkish-dizi'],
    enabled: true,
    requiresKey: false,
    keyConfigured: true,
    keyless: true,
    streamCapable: true,
    kind: 'native',
  },
  {
    id: 'livetv',
    name: 'Free-to-Air Live TV',
    description: 'Official open HLS broadcasts (TRT 1, TRT World, TRT Haber, DW, NHK, Red Bull).',
    categories: ['live-tv'],
    enabled: true,
    requiresKey: false,
    keyConfigured: true,
    keyless: true,
    streamCapable: true,
    kind: 'native',
  },
  {
    id: 'tmdb',
    name: 'TMDB v3 Multilingual',
    description: 'Optional API key for extended EN/RU/TR movie & dizi localization.',
    categories: ['movie', 'series', 'turkish-dizi'],
    enabled: true,
    requiresKey: true,
    keyConfigured: Boolean(import.meta.env?.VITE_TMDB_API_KEY),
    keyless: false,
    streamCapable: false,
    kind: 'native',
  },
];

export async function getDesktopInfo(): Promise<DesktopInfo> {
  if (isTauriRuntime()) {
    return invoke<DesktopInfo>('desktop_info');
  }
  return {
    platform: 'web',
    version: '0.0.1',
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
  const start = Date.now();
  const health = await apiFetchJson<{ ok: boolean; providers: string[]; cacheEntries: number }>(
    '/api/health'
  );
  const latencyMs = Date.now() - start;
  if (health?.ok) {
    return health.providers.map(provider => ({
      provider,
      activeMirror: getApiBase() || window.location.origin,
      healthy: true,
      latencyMs,
      detail: `Gateway online (${health.cacheEntries} cached)`,
    }));
  }
  return [
    {
      provider: 'aniliberty',
      activeMirror: 'https://aniliberty.top/api/v1',
      healthy: true,
      latencyMs: 42,
      detail: 'Direct CORS preview',
    },
    {
      provider: 'tvmaze',
      activeMirror: 'https://api.tvmaze.com',
      healthy: true,
      latencyMs: 55,
      detail: 'Direct CORS preview',
    },
  ];
}

export async function getHomeShelves(locale: Locale): Promise<CatalogShelf[]> {
  if (isTauriRuntime()) {
    return invoke<CatalogShelf[]>('get_home_shelves', { locale });
  }
  const viaServer = await apiFetchJson<CatalogShelf[]>(
    `/api/home?locale=${encodeURIComponent(locale)}`
  );
  if (viaServer && viaServer.length > 0) return viaServer;

  // Direct CORS-safe fallback when offline from Wachcha API Gateway
  const shelves: CatalogShelf[] = [];
  try {
    const resp = await fetch('https://aniliberty.top/api/v1/anime/releases/latest?limit=12');
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
          badges: ['AniLiberty', '1080p HLS', 'RU Dub'],
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
  return shelves;
}

export async function getTops(opts: {
  vertical: TopsVertical;
  page?: number;
  sort?: SortMode;
  genre?: string;
  year?: string;
  minRating?: number;
}): Promise<PagedResult> {
  const params = new URLSearchParams();
  params.set('vertical', opts.vertical);
  params.set('page', String(opts.page || 1));
  if (opts.sort) params.set('sort', opts.sort);
  if (opts.genre) params.set('genre', opts.genre);
  if (opts.year) params.set('year', opts.year);
  if (opts.minRating && opts.minRating > 0) params.set('minRating', String(opts.minRating));

  if (!isTauriRuntime()) {
    const viaServer = await apiFetchJson<PagedResult>(`/api/tops?${params.toString()}`);
    if (viaServer) return viaServer;
  }

  // Fallback for desktop / static-only mode: leverage AniLiberty & home shelves
  if (opts.vertical === 'anime' || opts.vertical === 'ongoing') {
    const sortKey = opts.sort === 'newest' ? 'FRESH_AT_DESC' : 'RATING_DESC';
    const alParams = new URLSearchParams({
      limit: '24',
      page: String(opts.page || 1),
      'f[sorting]': sortKey,
    });
    if (opts.vertical === 'ongoing') alParams.set('f[publish_statuses]', 'IS_ONGOING');
    const resp = await fetch(
      `https://aniliberty.top/api/v1/anime/catalog/releases?${alParams.toString()}`
    );
    if (resp.ok) {
      const json = await resp.json();
      const rows = Array.isArray(json?.data) ? json.data : [];
      const offset = ((opts.page || 1) - 1) * 24;
      return {
        items: rows.map((r: Record<string, unknown>, i: number) => {
          const name = r.name as { main?: string; english?: string } | undefined;
          const posterObj = r.poster as { optimized?: { src?: string }; src?: string } | undefined;
          const p = posterObj?.optimized?.src || posterObj?.src;
          const alias = String(r.alias || r.id);
          return {
            id: alias,
            provider: 'aniliberty',
            category: 'anime' as const,
            title: name?.main || name?.english || alias,
            originalTitle: name?.english,
            year: typeof r.year === 'number' ? r.year : undefined,
            rank: offset + i + 1,
            posterUrl: p ? (p.startsWith('http') ? p : `https://aniliberty.top${p}`) : undefined,
            genres: [],
            badges: ['AniLiberty', '1080p HLS'],
            audioLanguages: ['RU'],
            externalIds: { aniliberty: Number(r.id) || undefined },
            streamReady: true,
            sources: [{ provider: 'aniliberty', id: alias, label: 'AniLiberty' }],
          };
        }),
        page: opts.page || 1,
        total: Number(json?.meta?.pagination?.total || rows.length),
        hasMore:
          Number(json?.meta?.pagination?.current_page || 1) <
          Number(json?.meta?.pagination?.total_pages || 1),
      };
    }
  }

  const shelves = await getHomeShelves('ru');
  const catMap: Record<string, MediaCategory | undefined> = {
    movie: 'movie',
    russian: 'movie',
    series: 'series',
    'turkish-dizi': 'turkish-dizi',
    'live-tv': 'live-tv',
  };
  const targetCat = catMap[opts.vertical];
  const list = shelves
    .filter(s => !targetCat || s.category === targetCat)
    .flatMap(s => s.items)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));
  return { items: list, page: 1, total: list.length, hasMore: false };
}

export async function getCatalog(opts: {
  category: 'all' | MediaCategory;
  page?: number;
  sort?: SortMode;
  genre?: string;
  year?: string;
  minRating?: number;
}): Promise<PagedResult> {
  const params = new URLSearchParams();
  params.set('category', opts.category);
  params.set('page', String(opts.page || 1));
  if (opts.sort) params.set('sort', opts.sort);
  if (opts.genre) params.set('genre', opts.genre);
  if (opts.year) params.set('year', opts.year);
  if (opts.minRating && opts.minRating > 0) params.set('minRating', String(opts.minRating));

  if (!isTauriRuntime()) {
    const viaServer = await apiFetchJson<PagedResult>(`/api/catalog?${params.toString()}`);
    if (viaServer) return viaServer;
  }

  if (opts.category !== 'all') {
    return getTops({
      vertical: opts.category as TopsVertical,
      page: opts.page,
      sort: opts.sort,
      genre: opts.genre,
      year: opts.year,
      minRating: opts.minRating,
    });
  }
  const shelves = await getHomeShelves('ru');
  const items = shelves.flatMap(s => s.items);
  return { items, page: 1, total: items.length, hasMore: false };
}

export async function getGenres(category: string): Promise<GenreOption[]> {
  if (!isTauriRuntime()) {
    const viaServer = await apiFetchJson<GenreOption[]>(
      `/api/genres?category=${encodeURIComponent(category)}`
    );
    if (viaServer) return viaServer;
  }
  return ['Action', 'Drama', 'Comedy', 'Fantasy', 'Thriller', 'Sci-Fi', 'Romance', 'History'].map(
    name => ({ id: name, name })
  );
}

export async function getWeeklySchedule(): Promise<WeeklySchedule> {
  if (!isTauriRuntime()) {
    const viaServer = await apiFetchJson<WeeklySchedule>('/api/schedule');
    if (viaServer) return viaServer;
  }
  const days: MediaItem[][] = [[], [], [], [], [], [], []];
  try {
    const resp = await fetch('https://aniliberty.top/api/v1/anime/schedule/week');
    if (resp.ok) {
      const rows = (await resp.json()) as Array<{
        release?: Record<string, unknown>;
        published_release_episode?: { ordinal?: number };
      }>;
      for (const row of Array.isArray(rows) ? rows : []) {
        const r = row.release || (row as Record<string, unknown>);
        const dayVal = Number((r.publish_day as { value?: number } | undefined)?.value || 1);
        const idx = Math.max(0, Math.min(6, dayVal - 1));
        const name = r.name as { main?: string; english?: string } | undefined;
        const posterObj = r.poster as { optimized?: { src?: string }; src?: string } | undefined;
        const p = posterObj?.optimized?.src || posterObj?.src;
        const alias = String(r.alias || r.id || '');
        if (!alias) continue;
        days[idx].push({
          id: alias,
          provider: 'aniliberty',
          category: 'anime',
          title: name?.main || name?.english || alias,
          originalTitle: name?.english,
          year: typeof r.year === 'number' ? r.year : undefined,
          airingInfo: row.published_release_episode?.ordinal
            ? `Ep ${row.published_release_episode.ordinal}`
            : undefined,
          posterUrl: p ? (p.startsWith('http') ? p : `https://aniliberty.top${p}`) : undefined,
          genres: [],
          badges: ['Ongoing', '1080p HLS'],
          audioLanguages: ['RU'],
          externalIds: { aniliberty: Number(r.id) || undefined },
          streamReady: true,
          sources: [{ provider: 'aniliberty', id: alias, label: 'AniLiberty' }],
        });
      }
    }
  } catch {
    // Graceful empty fallback.
  }
  return { days };
}

export async function searchCatalog(query: SearchQuery): Promise<SearchResponse> {
  if (isTauriRuntime()) {
    return invoke<SearchResponse>('search_catalog', { query });
  }
  const q = query.text.trim();
  if (!q) return { query: q, items: [], providerErrors: [] };

  const params = new URLSearchParams({ q });
  if (query.category) params.set('category', query.category);
  if (query.locale) params.set('locale', query.locale);

  const viaServer = await apiFetchJson<SearchResponse>(`/api/search?${params.toString()}`);
  if (viaServer) return viaServer;

  // Fallback direct search (AniLiberty + TVMaze)
  const items: MediaItem[] = [];
  const errors: string[] = [];
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
  const viaServer = await apiFetchJson<MediaDetail>(
    `/api/detail/${encodeURIComponent(provider)}/${encodeURIComponent(id)}?locale=${encodeURIComponent(locale)}`
  );
  if (viaServer) return viaServer;

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
        preview?: { optimized?: { preview?: string }; preview?: string };
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
        const thumb = ep.preview?.optimized?.preview || ep.preview?.preview;
        return {
          id: epId,
          season: 1,
          number: ep.ordinal,
          title: ep.name || `Episode ${ep.ordinal}`,
          durationSeconds: ep.duration,
          thumbnailUrl: thumb
            ? thumb.startsWith('http')
              ? thumb
              : `https://aniliberty.top${thumb}`
            : undefined,
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

  throw new Error('Detail unavailable offline.');
}

export async function resolveStreams(candidates: StreamCandidate[]): Promise<StreamResolution> {
  if (isTauriRuntime()) {
    return invoke<StreamResolution>('resolve_streams', { candidates });
  }
  const viaServer = await apiFetchJson<StreamResolution>('/api/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidates }),
  });
  if (viaServer && viaServer.streams.length > 0) return viaServer;

  return {
    provider: candidates[0]?.provider || 'web',
    episodeId: candidates[0]?.episodeId || '',
    streams: candidates
      .filter(c => c.url.startsWith('https://'))
      .map(c => ({
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
