import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';

export interface TSidebarProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ComponentChildren;
}

export function Sidebar({ open, title, onClose, children }: TSidebarProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      class="drawer-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div class="drawer-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '18px' }}>{title}</h3>
          <button
            type="button"
            class="btn btn-ghost"
            aria-label="Close"
            onClick={onClose}
            style={{ padding: '6px 10px' }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
