import { describe, expect, it, vi } from 'vitest';
import { emitPlaybackEvent, formatTime, updateSettings, appSettings } from '~/lib/playback-session';
import { getScrollPosition, saveScrollPosition } from '~/lib/navigation';
import type { PlaybackEvent } from '~/lib/types';

describe('playback-session & navigation helpers', () => {
  it('formats media timestamps accurately for mm:ss and h:mm:ss', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(125)).toBe('02:05');
    expect(formatTime(3723)).toBe('1:02:03');
  });

  it('emits versioned wachcha:playback window event and updates settings', () => {
    const spy = vi.fn();
    window.addEventListener('wachcha:playback', spy);
    const ev: PlaybackEvent = {
      version: 1,
      reason: 'skip',
      timestamp: Date.now(),
      playback: {
        mediaId: 'frieren',
        provider: 'aniliberty',
        episodeId: 'ep1',
        voice: 'AniLibria',
        sourceHost: 'aniliberty.top',
        quality: '1080p',
        format: 'hls',
        relayed: false,
        engine: 'shaka',
        position: 175,
        duration: 1440,
        watchedSeconds: 60,
        playing: true,
      },
      skip: { kind: 'opening', from: 85, to: 175, automatic: true },
    };
    emitPlaybackEvent(ev);
    expect(spy).toHaveBeenCalledTimes(1);
    window.removeEventListener('wachcha:playback', spy);

    updateSettings({ tvMode: true, shader: 'fsr' });
    expect(appSettings.value.tvMode).toBe(true);
    expect(appSettings.value.shader).toBe('fsr');
    updateSettings({ tvMode: false });
  });

  it('restores saved scroll offsets per route', () => {
    saveScrollPosition('/catalog', 480);
    expect(getScrollPosition('/catalog')).toBe(480);
    expect(getScrollPosition('/unknown')).toBe(0);
  });
});
