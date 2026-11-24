import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

const OVERSCAN = 3;
const SMALL_LIST_THRESHOLD = 60;

export interface TVirtualGridProps<T> {
  items: readonly T[];
  itemKey: (item: T) => string | number;
  renderItem: (item: T, index: number) => ComponentChildren;
  rowHeight?: number;
  minColumnWidth?: number;
  gap?: number;
}

/**
 * Windowed virtual grid with focus pinning:
 * - Renders directly without virtualization for <= 60 items.
 * - Overscans 3 rows above/below viewport for large lists.
 * - Pins the currently focused item index so keyboard/D-pad focus never drops on scroll.
 */
export function VirtualGrid<T>({
  items,
  itemKey,
  renderItem,
  rowHeight = 310,
  minColumnWidth = 176,
  gap = 18,
}: TVirtualGridProps<T>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [win, setWin] = useState({ columns: 5, startRow: 0, endRow: 12 });

  const virtual = items.length > SMALL_LIST_THRESHOLD;

  useEffect(() => {
    if (!virtual) return;
    const root = rootRef.current;
    if (!root) return;
    const scroller = root.closest<HTMLElement>('.media-scroll');

    const measure = () => {
      const width = root.clientWidth || 1000;
      const columns = Math.max(1, Math.floor((width + gap) / (minColumnWidth + gap)));
      const pitch = rowHeight + gap;
      const scrollTop = scroller?.scrollTop ?? 0;
      const viewport = scroller?.clientHeight ?? 800;
      const startRow = Math.max(0, Math.floor(scrollTop / pitch) - OVERSCAN);
      const endRow = Math.ceil((scrollTop + viewport) / pitch) + OVERSCAN;
      setWin(prev =>
        prev.columns === columns && prev.startRow === startRow && prev.endRow === endRow
          ? prev
          : { columns, startRow, endRow }
      );
    };

    measure();
    scroller?.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure, { passive: true });
    return () => {
      scroller?.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [virtual, gap, minColumnWidth, rowHeight]);

  if (!virtual) {
    return (
      <div class="poster-grid" ref={rootRef}>
        {items.map((item, idx) => (
          <div key={itemKey(item)} onFocusCapture={() => setFocusedIndex(idx)}>
            {renderItem(item, idx)}
          </div>
        ))}
      </div>
    );
  }

  const totalRows = Math.ceil(items.length / win.columns);
  const startRow = Math.min(win.startRow, Math.max(0, totalRows - 1));
  const endRow = Math.min(totalRows, Math.max(startRow + 1, win.endRow));
  const firstIdx = startRow * win.columns;
  const lastIdx = Math.min(items.length, endRow * win.columns);
  const pitch = rowHeight + gap;
  const totalHeight = totalRows * pitch;

  const visibleIndices: number[] = [];
  for (let i = firstIdx; i < lastIdx; i++) visibleIndices.push(i);
  if (
    focusedIndex !== null &&
    focusedIndex < items.length &&
    (focusedIndex < firstIdx || focusedIndex >= lastIdx)
  ) {
    visibleIndices.push(focusedIndex);
  }

  return (
    <div
      ref={rootRef}
      style={{ position: 'relative', height: `${totalHeight}px`, width: '100%' }}
      data-virtual-total={items.length}
      data-virtual-rendered={visibleIndices.length}
    >
      <div
        class="poster-grid"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: `${startRow * pitch}px`,
        }}
      >
        {visibleIndices.map(idx => {
          const item = items[idx];
          return (
            <div key={itemKey(item)} onFocusCapture={() => setFocusedIndex(idx)}>
              {renderItem(item, idx)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
