import { signal } from '@preact/signals';
import type { PlaybackEngine, PlaybackEvent, ShaderPreset } from './types';

const SETTINGS_KEY = 'wachcha:settings-v1';

export interface AppSettings {
  engine: PlaybackEngine;
  shader: ShaderPreset;
  autoSkipIntro: boolean;
  autoSkipOutro: boolean;
  autoNextEpisode: boolean;
  animations: boolean;
  tvMode: boolean;
  discordPresence: boolean;
  playbackRate: number;
  volume: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  engine: 'auto',
  shader: 'anime4k-fast',
  autoSkipIntro: true,
  autoSkipOutro: false,
  autoNextEpisode: true,
  animations: true,
  tvMode: false,
  discordPresence: true,
  playbackRate: 1,
  volume: 0.9,
};

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export const appSettings = signal<AppSettings>(loadSettings());

export function updateSettings(patch: Partial<AppSettings>) {
  const next = { ...appSettings.value, ...patch };
  appSettings.value = next;
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.tv = next.tvMode ? 'true' : 'false';
    document.documentElement.dataset.animations = next.animations ? 'on' : 'off';
  }
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    // Ignore restricted storage.
  }
}

export function emitPlaybackEvent(
  event: PlaybackEvent,
  onPlayback?: (event: PlaybackEvent) => void
) {
  onPlayback?.(event);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('wachcha:playback', { detail: event }));
  }
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
