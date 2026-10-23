import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MaterialIcon } from './MaterialIcon';

describe('MaterialIcon', () => {
  it('renders outlined glyph (FILL 0) and inactive color when inactive', () => {
    const html = renderToStaticMarkup(
      React.createElement(MaterialIcon, { name: 'dashboard', active: false, size: 22 })
    );

    expect(html).toContain('dashboard');
    expect(html).toContain("font-variation-settings:&#x27;FILL&#x27; 0, &#x27;wght&#x27; 400, &#x27;GRAD&#x27; 0, &#x27;opsz&#x27; 24");
    expect(html).toContain('font-size:22px');
    expect(html).toContain('width:22px');
    expect(html).toContain('height:22px');
    expect(html).toContain('var(--color-icon-inactive, #929A94)');
    expect(html).toContain('icon-inactive');
    expect(html).toContain('aria-hidden="true"');
  });

  it('renders solid filled glyph (FILL 1) and pastel mint color when active', () => {
    const html = renderToStaticMarkup(
      React.createElement(MaterialIcon, { name: 'dashboard', active: true, size: 24 })
    );

    expect(html).toContain('dashboard');
    expect(html).toContain("font-variation-settings:&#x27;FILL&#x27; 1, &#x27;wght&#x27; 400, &#x27;GRAD&#x27; 0, &#x27;opsz&#x27; 24");
    expect(html).toContain('var(--color-mint-accent, #B9E4D0)');
    expect(html).toContain('icon-active');
  });

  it('supports explicit fill override (fill=1 when active=false)', () => {
    const html = renderToStaticMarkup(
      React.createElement(MaterialIcon, { name: 'folder', fill: 1, active: false })
    );

    expect(html).toContain("font-variation-settings:&#x27;FILL&#x27; 1");
  });

  it('sets opticalSize correctly according to icon size', () => {
    const small = renderToStaticMarkup(
      React.createElement(MaterialIcon, { name: 'search', size: 16 })
    );
    expect(small).toContain("&#x27;opsz&#x27; 20");

    const medium = renderToStaticMarkup(
      React.createElement(MaterialIcon, { name: 'search', size: 22 })
    );
    expect(medium).toContain("&#x27;opsz&#x27; 24");

    const large = renderToStaticMarkup(
      React.createElement(MaterialIcon, { name: 'search', size: 36 })
    );
    expect(large).toContain("&#x27;opsz&#x27; 40");
  });

  it('supports accessible labels and img role', () => {
    const html = renderToStaticMarkup(
      React.createElement(MaterialIcon, { name: 'refresh', 'aria-label': 'Refresh feed' })
    );

    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Refresh feed"');
    expect(html).not.toContain('aria-hidden');
  });

  it('supports spinning animation for processing states', () => {
    const html = renderToStaticMarkup(
      React.createElement(MaterialIcon, { name: 'sync', spin: true })
    );

    expect(html).toContain('animate-spin');
  });
});
