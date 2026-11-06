import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { ThemeProvider } from './ThemeContext';

describe('Theme System', () => {
  it('renders ThemeToggle in dark mode with switch to light theme aria-label', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(ThemeToggle, { variant: 'landing' })
      )
    );

    expect(html).toContain('button');
    expect(html).toContain('aria-label="Switch to light theme"');
    expect(html).toContain('<svg');
  });

  it('renders ThemeToggle in app variant with control dimensions', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(ThemeToggle, { variant: 'app', size: 'default' })
      )
    );

    expect(html).toContain('h-8 w-8');
    expect(html).toContain('rounded-[var(--radius-control)]');
  });

  it('renders ThemeToggle in small size', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(ThemeToggle, { variant: 'landing', size: 'sm' })
      )
    );

    expect(html).toContain('h-7 w-7');
  });
});
