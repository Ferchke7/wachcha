import type { ComponentChildren, JSX } from 'preact';

export type TButtonVariant = 'primary' | 'glass' | 'ghost' | 'danger';

export interface TButtonProps extends Omit<JSX.HTMLAttributes<HTMLButtonElement>, 'type'> {
  variant?: TButtonVariant;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  children?: ComponentChildren;
}

export function Button({
  variant = 'glass',
  type = 'button',
  className = '',
  children,
  ...rest
}: TButtonProps) {
  return (
    <button type={type} data-nav-item="" class={`btn btn-${variant} ${className}`.trim()} {...rest}>
      {children}
    </button>
  );
}
