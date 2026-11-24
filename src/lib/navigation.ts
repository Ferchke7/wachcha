import { signal } from '@preact/signals';

const SESSION_KEY = 'wachcha:nav-session';

interface NavMarker {
  session: string;
  index: number;
  from?: string;
}

export interface NavigationState {
  path: string;
  canBack: boolean;
  canForward: boolean;
}

const sessionId = (() => {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return 'mem';
  }
})();

let currentIndex = 0;
let maxIndex = 0;
const scrollPositions = new Map<string, number>();

export function currentHashPath(): string {
  if (typeof location === 'undefined') return '/';
  const raw = location.hash.replace(/^#/, '');
  return raw.startsWith('/') ? raw : '/';
}

export const navState = signal<NavigationState>({
  path: currentHashPath(),
  canBack: false,
  canForward: false,
});

function readMarker(): NavMarker | null {
  try {
    const st = history.state as NavMarker | null;
    if (st && st.session === sessionId && typeof st.index === 'number') return st;
  } catch {
    // Ignore history access restrictions.
  }
  return null;
}

function writeMarker(from?: string) {
  try {
    const marker: NavMarker = { session: sessionId, index: currentIndex, from };
    history.replaceState(marker, '', location.hash || '#/');
  } catch {
    // Ignore history errors in restricted frames.
  }
}

function publish() {
  navState.value = {
    path: currentHashPath(),
    canBack: currentIndex > 0,
    canForward: currentIndex < maxIndex,
  };
}

export function saveScrollPosition(routeKey: string, top: number) {
  scrollPositions.set(routeKey, Math.max(0, top));
}

export function getScrollPosition(routeKey: string): number {
  return scrollPositions.get(routeKey) ?? 0;
}

export function initNavigation() {
  const existing = readMarker();
  if (existing) {
    currentIndex = existing.index;
    maxIndex = Math.max(maxIndex, existing.index);
  } else {
    writeMarker();
  }
  publish();

  const onHash = () => {
    const prevPath = navState.value.path;
    const m = readMarker();
    if (m) {
      currentIndex = m.index;
    } else {
      currentIndex++;
      maxIndex = currentIndex;
      writeMarker(prevPath);
    }
    const update = () => publish();
    const reduced =
      typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const doc = document as Document & { startViewTransition?: (cb: () => void) => void };
    if (!reduced && typeof doc.startViewTransition === 'function') {
      doc.startViewTransition(update);
    } else {
      update();
    }
  };

  window.addEventListener('hashchange', onHash);
  return () => window.removeEventListener('hashchange', onHash);
}

export function navigateTo(target: string) {
  const clean = target.startsWith('#') ? target.slice(1) : target;
  const normalized = clean.startsWith('/') ? clean : `/${clean}`;
  if (currentHashPath() === normalized) return;
  location.hash = `#${normalized}`;
}

export function navigateBack(fallback = '/') {
  if (navState.value.canBack) history.back();
  else navigateTo(fallback);
}

export function navigateForward() {
  if (navState.value.canForward) history.forward();
}
