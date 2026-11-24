import { signal } from '@preact/signals';
import { en, type TranslationKey } from '~/locales/en';
import { ru } from '~/locales/ru';
import { tr } from '~/locales/tr';
import type { Locale } from './types';

const STORAGE_KEY = 'wachcha:locale';
const DICTIONARIES: Record<Locale, Record<TranslationKey, string>> = { en, ru, tr };

export function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'ru' || saved === 'tr') return saved;
  } catch {
    // Ignore restricted storage.
  }
  const envDefault = (import.meta.env?.VITE_DEFAULT_LOCALE as string | undefined)?.toLowerCase();
  if (envDefault === 'en' || envDefault === 'ru' || envDefault === 'tr') return envDefault;

  const langs = typeof navigator !== 'undefined' ? navigator.languages || [navigator.language] : [];
  for (const lang of langs) {
    const lower = (lang || '').toLowerCase();
    if (lower.startsWith('ru') || lower.startsWith('be') || lower.startsWith('kk')) return 'ru';
    if (lower.startsWith('tr') || lower.startsWith('az')) return 'tr';
  }
  return 'en';
}

export const locale = signal<Locale>(detectLocale());

export function setLocale(next: Locale) {
  locale.value = next;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next;
  }
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Ignore storage quota errors.
  }
}

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const dict = DICTIONARIES[locale.value] || en;
  let value = dict[key] ?? en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replaceAll(`{${k}}`, String(v));
    }
  }
  return value;
}

export type { TranslationKey };
