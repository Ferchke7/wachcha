import { navigateBack, navigateForward, navigateTo } from './navigation';

type Direction = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

function isEditable(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    (el as HTMLElement).isContentEditable
  );
}

function findSpatialNext(current: HTMLElement, dir: Direction): HTMLElement | null {
  const candidates = [
    ...document.querySelectorAll<HTMLElement>('[data-nav-item]:not([disabled])'),
  ].filter(el => el !== current && el.offsetParent !== null);
  if (!candidates.length) return null;

  const r = current.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;

  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const el of candidates) {
    const b = el.getBoundingClientRect();
    const tx = b.left + b.width / 2;
    const ty = b.top + b.height / 2;
    const dx = tx - cx;
    const dy = ty - cy;

    const valid =
      (dir === 'ArrowRight' && dx > 12) ||
      (dir === 'ArrowLeft' && dx < -12) ||
      (dir === 'ArrowDown' && dy > 12) ||
      (dir === 'ArrowUp' && dy < -12);
    if (!valid) continue;

    const primary = dir === 'ArrowLeft' || dir === 'ArrowRight' ? Math.abs(dx) : Math.abs(dy);
    const secondary = dir === 'ArrowLeft' || dir === 'ArrowRight' ? Math.abs(dy) : Math.abs(dx);
    const score = primary + secondary * 2.2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

export function installKeyboardNavigation(): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    const active = document.activeElement;
    if (event.altKey && event.key === 'ArrowLeft') {
      event.preventDefault();
      navigateBack();
      return;
    }
    if (event.altKey && event.key === 'ArrowRight') {
      event.preventDefault();
      navigateForward();
      return;
    }
    if (isEditable(active)) return;

    if (event.key === '/' && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      navigateTo('/search');
      requestAnimationFrame(() => {
        const input = document.querySelector<HTMLInputElement>('[data-search-input]');
        input?.focus();
      });
      return;
    }

    if (
      event.key === 'ArrowUp' ||
      event.key === 'ArrowDown' ||
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowRight'
    ) {
      if (active instanceof HTMLElement && active.hasAttribute('data-nav-item')) {
        const next = findSpatialNext(active, event.key);
        if (next) {
          event.preventDefault();
          next.focus();
          next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      }
    }
  };

  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}
