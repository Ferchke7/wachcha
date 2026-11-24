import type { ComponentChildren } from 'preact';

export function EmptyState({ title, action }: { title: string; action?: ComponentChildren }) {
  return (
    <div class="empty-box">
      <p style={{ margin: '0 0 12px', fontSize: '14px' }}>{title}</p>
      {action}
    </div>
  );
}
