import { signal } from '@preact/signals';

const toastMessage = signal<string | null>(null);
let timer: ReturnType<typeof setTimeout> | null = null;

export function showToast(message: string, durationMs = 2800) {
  toastMessage.value = message;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    toastMessage.value = null;
  }, durationMs);
}

export function Toast() {
  if (!toastMessage.value) return null;
  return (
    <div class="toast-banner" role="status" aria-live="polite">
      {toastMessage.value}
    </div>
  );
}
