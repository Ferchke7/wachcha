import { useEffect, useState } from 'preact/hooks';

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
}

export interface TChoiceTabsProps<T extends string> {
  options: readonly ChoiceOption<T>[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel?: string;
}

/**
 * Confirms tab highlight immediately on click before parent async state updates.
 * Never triggers actions on pointerdown; ignores re-selecting the active value.
 */
export function ChoiceTabs<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: TChoiceTabsProps<T>) {
  const [selected, setSelected] = useState<T>(value);

  useEffect(() => {
    setSelected(value);
  }, [value]);

  const handleClick = (next: T) => {
    if (next === selected) return;
    setSelected(next);
    onChange(next);
  };

  return (
    <div class="choice-tabs" role="tablist" aria-label={ariaLabel}>
      {options.map(opt => {
        const active = opt.value === selected;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            data-nav-item=""
            aria-selected={active}
            class={`choice-pill${active ? ' active' : ''}`}
            onClick={() => handleClick(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
