import * as React from 'react';
import { cn } from '../../lib/utils';

export interface MaterialIconProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * The official Google Material Symbols glyph name (e.g. 'dashboard', 'folder', 'chat', 'search').
   */
  name: string;
  /**
   * Icon size in pixels. Standard sizes: 16 (chips), 18-20 (controls), 20-22 (dock/actions), 22-24 (sidebar).
   * @default 20
   */
  size?: number;
  /**
   * Explicit fill state (0 = outline, 1 = filled).
   * Overrides `active` if set.
   */
  fill?: 0 | 1 | boolean;
  /**
   * Whether this icon represents an active navigation tab or state.
   * When true, defaults FILL = 1 and color = #B9E4D0 (pastel mint).
   * When false, defaults FILL = 0 and color = #929A94 (inactive gray).
   */
  active?: boolean;
  /**
   * Font weight axis (100..700).
   * @default 400
   */
  weight?: number;
  /**
   * Grade axis (-50..200).
   * @default 0
   */
  grade?: number;
  /**
   * Optical size axis (20..48). If omitted, automatically derived from `size`.
   */
  opticalSize?: number;
  /**
   * Whether the icon should spin continuously (e.g. for loading / refresh indicators).
   */
  spin?: boolean;
  /**
   * Custom CSS class name.
   */
  className?: string;
  /**
   * Explicit color override (takes precedence over active/inactive defaults).
   */
  color?: string;
  /**
   * Accessible label for non-decorative icons.
   */
  'aria-label'?: string;
}

export const MaterialIcon = React.forwardRef<HTMLSpanElement, MaterialIconProps>(
  (
    {
      name,
      size = 20,
      fill,
      active,
      weight = 400,
      grade = 0,
      opticalSize,
      spin = false,
      className,
      color,
      style,
      'aria-label': ariaLabel,
      'aria-hidden': ariaHidden,
      ...props
    },
    ref
  ) => {
    // Determine effective fill: explicit fill prop wins; otherwise active ? 1 : 0
    let fillValue = 0;
    if (fill !== undefined) {
      fillValue = typeof fill === 'boolean' ? (fill ? 1 : 0) : fill;
    } else if (active !== undefined) {
      fillValue = active ? 1 : 0;
    }

    // Determine optical size (20, 24, 40, or 48)
    const opsz = opticalSize ?? (size <= 20 ? 20 : size <= 28 ? 24 : size <= 44 ? 40 : 48);

    // Color derivation: explicit color > active mint (#B9E4D0) > inactive (#929A94 if active===false) > currentColor
    let resolvedColor = color;
    if (!resolvedColor) {
      if (active === true) {
        resolvedColor = 'var(--color-mint-accent, #B9E4D0)';
      } else if (active === false) {
        resolvedColor = 'var(--color-icon-inactive, #929A94)';
      }
    }

    const isDecorative = ariaHidden !== undefined ? ariaHidden : !ariaLabel;

    return (
      <span
        ref={ref}
        role={isDecorative ? undefined : 'img'}
        aria-label={ariaLabel}
        aria-hidden={isDecorative ? true : undefined}
        className={cn(
          'material-symbols-rounded select-none shrink-0',
          active === true && 'icon-active',
          active === false && 'icon-inactive',
          spin && 'animate-spin',
          className
        )}
        style={{
          fontSize: `${size}px`,
          width: `${size}px`,
          height: `${size}px`,
          fontVariationSettings: `'FILL' ${fillValue}, 'wght' ${weight}, 'GRAD' ${grade}, 'opsz' ${opsz}`,
          ...(resolvedColor ? { color: resolvedColor } : {}),
          ...style,
        }}
        {...props}
      >
        {name}
      </span>
    );
  }
);

MaterialIcon.displayName = 'MaterialIcon';
