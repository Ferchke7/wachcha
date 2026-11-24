import { describe, expect, it } from 'vitest';
import { locale, setLocale, t } from '~/lib/i18n';
import { en } from '~/locales/en';
import { ru } from '~/locales/ru';
import { tr } from '~/locales/tr';

describe('i18n EN / RU / TR', () => {
  it('maintains 100% key parity across English, Russian, and Turkish locales', () => {
    const enKeys = Object.keys(en).sort();
    expect(Object.keys(ru).sort()).toEqual(enKeys);
    expect(Object.keys(tr).sort()).toEqual(enKeys);
  });

  it('switches locales reactively and interpolates parameters', () => {
    setLocale('en');
    expect(locale.value).toBe('en');
    expect(t('nav.providersOnline', { count: 7 })).toBe('7 Providers Ready');

    setLocale('ru');
    expect(t('nav.dizis')).toBe('Турецкие сериалы');
    expect(t('player.skipIn', { seconds: 5 })).toBe('Пропуск через 5с...');

    setLocale('tr');
    expect(t('nav.dizis')).toBe('Türk Dizileri');
    expect(t('common.minutesLeft', { min: 14 })).toBe('14dk kaldı');

    setLocale('en');
  });
});
