export interface TToggleProps {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}

export function Toggle({ label, checked, onChange }: TToggleProps) {
  return (
    <div class="toggle-row">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        data-nav-item=""
        aria-checked={checked}
        aria-label={label}
        class="toggle-btn"
        onClick={() => onChange(!checked)}
      >
        <span class="toggle-thumb" />
      </button>
    </div>
  );
}
