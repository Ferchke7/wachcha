import { useEffect, useRef, useState } from 'preact/hooks';
import { isTauriRuntime } from '~/lib/desktop';
import { requestCachedImage } from '~/lib/image-cache';

export interface TCachedImageProps {
  src?: string;
  alt: string;
  className?: string;
}

export function CachedImage({ src, alt, className = '' }: TCachedImageProps) {
  const isNative = isTauriRuntime();
  const holderRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!isNative || typeof IntersectionObserver === 'undefined');
  const [resolved, setResolved] = useState<string | null>(() => (!isNative && src ? src : null));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (!isNative) {
      setResolved(src || null);
      setVisible(true);
      return;
    }
    if (!src || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const el = holderRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: '240px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [src, isNative]);

  useEffect(() => {
    if (!isNative || !src || !visible) return;
    const ctrl = new AbortController();
    const { immediate, promise } = requestCachedImage(src, ctrl.signal);
    if (immediate) setResolved(immediate);
    promise.then(next => {
      if (!ctrl.signal.aborted && next) setResolved(next);
    });
    return () => ctrl.abort();
  }, [src, visible, isNative]);

  if (!src || failed) {
    return (
      <div
        ref={holderRef}
        class={className}
        style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          placeItems: 'center',
          padding: '12px',
          textAlign: 'center',
          color: 'rgba(226, 232, 240, 0.72)',
          fontSize: '12px',
          fontWeight: 600,
        }}
      >
        {alt}
      </div>
    );
  }

  return (
    <div ref={holderRef} style={{ width: '100%', height: '100%' }}>
      {resolved ? (
        <img
          src={resolved}
          alt={alt}
          class={className}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <div class="skeleton" style={{ width: '100%', height: '100%' }} />
      )}
    </div>
  );
}
