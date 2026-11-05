import * as React from 'react';
import { cn } from '../../lib/utils';
import { ICON_MAP } from './icons';

export interface MaterialIconProps extends Omit<React.SVGProps<SVGSVGElement>, 'fill'> {
  name: string;
  size?: number;
  fill?: 0 | 1 | boolean | string;
  active?: boolean;
  spin?: boolean;
  className?: string;
  color?: string;
  'aria-label'?: string;
}

export const MaterialIcon = React.forwardRef<SVGSVGElement, MaterialIconProps>(
  (
    {
      name,
      size = 20,
      fill,
      active,
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
    // Choose filled variant if requested (e.g. keep-fill for pinned)
    let glyphKey = name;
    const isFilled = fill === 1 || fill === true || (active === true && fill === undefined);
    if (isFilled && `${name}-fill` in ICON_MAP) {
      glyphKey = `${name}-fill`;
    }

    const SvgComponent = ICON_MAP[glyphKey] || ICON_MAP[name] || ICON_MAP.description;
    const isDecorative = ariaHidden !== undefined ? ariaHidden : !ariaLabel;

    return (
      <SvgComponent
        ref={ref}
        width={size}
        height={size}
        role={isDecorative ? undefined : 'img'}
        aria-label={ariaLabel}
        aria-hidden={isDecorative ? true : undefined}
        className={cn(
          'inline-block shrink-0 select-none fill-current transition-colors',
          spin && 'animate-spin',
          className
        )}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          ...(color ? { color } : {}),
          ...style,
        }}
        {...props}
      />
    );
  }
);

MaterialIcon.displayName = 'MaterialIcon';
