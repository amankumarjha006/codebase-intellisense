import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MaterialIcon } from './MaterialIcon';

describe('MaterialIcon', () => {
  it('renders SVG icon with specified dimensions and fill-current class', () => {
    const html = renderToStaticMarkup(
      React.createElement(MaterialIcon, { name: 'dashboard', active: false, size: 22 })
    );

    expect(html).toContain('<svg');
    expect(html).toContain('viewBox="0 -960 960 960"');
    expect(html).toContain('width="22"');
    expect(html).toContain('height="22"');
    expect(html).toContain('fill-current');
    expect(html).toContain('aria-hidden="true"');
  });

  it('supports custom color and styles', () => {
    const html = renderToStaticMarkup(
      React.createElement(MaterialIcon, { name: 'dashboard', color: '#8AB4F8', size: 24 })
    );

    expect(html).toContain('color:#8AB4F8');
    expect(html).toContain('width:24px');
    expect(html).toContain('height:24px');
  });

  it('supports filled glyph variant for icons with fill counterpart', () => {
    const outlinedHtml = renderToStaticMarkup(
      React.createElement(MaterialIcon, { name: 'keep', fill: 0 })
    );
    const filledHtml = renderToStaticMarkup(
      React.createElement(MaterialIcon, { name: 'keep', fill: 1 })
    );

    expect(outlinedHtml).toContain('<svg');
    expect(filledHtml).toContain('<svg');
    // Outlined and filled paths should differ
    expect(outlinedHtml).not.toEqual(filledHtml);
  });

  it('sets width and height attributes according to size prop', () => {
    const small = renderToStaticMarkup(
      React.createElement(MaterialIcon, { name: 'search', size: 16 })
    );
    expect(small).toContain('width="16"');
    expect(small).toContain('height="16"');

    const large = renderToStaticMarkup(
      React.createElement(MaterialIcon, { name: 'search', size: 36 })
    );
    expect(large).toContain('width="36"');
    expect(large).toContain('height="36"');
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
