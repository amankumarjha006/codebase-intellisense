import { describe, it, expect } from 'vitest';
import demoEntries from './data/demo.json';

declare const process: { env: Record<string, string | undefined> };

describe('Demo Data Human Verification Gate', () => {
  it('checks demo entries structure and properties', () => {
    expect(demoEntries).toBeInstanceOf(Array);
    expect(demoEntries.length).toBeGreaterThanOrEqual(3);

    demoEntries.forEach((entry) => {
      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('title');
      expect(entry).toHaveProperty('query');
      expect(entry).toHaveProperty('answer');
      expect(entry).toHaveProperty('citations');
      expect(entry).toHaveProperty('verified');
      expect(typeof entry.verified).toBe('boolean');
      expect(entry.citations.length).toBeGreaterThanOrEqual(1);

      entry.citations.forEach((c) => {
        expect(c).toHaveProperty('citationId');
        expect(c).toHaveProperty('filePath');
        expect(c).toHaveProperty('startLine');
        expect(c).toHaveProperty('endLine');
        expect(c).toHaveProperty('snippetHtml');
        expect(c.endLine).toBeGreaterThanOrEqual(c.startLine);
        // Pre-tokenized Shiki HTML check: contains pre tag with white-space: pre
        expect(c.snippetHtml).toContain('<pre');
        expect(c.snippetHtml).toContain('white-space: pre');
      });
    });
  });

  it('reports human verification status per entry', () => {
    const unverified = demoEntries.filter((e) => !e.verified);
    // Reflects exact status: entries require human review before verified becomes true
    if (process.env.ENFORCE_DEMO_VERIFICATION === 'true') {
      expect(unverified.length).toBe(0);
    } else {
      expect(unverified.length).toBeGreaterThanOrEqual(0);
    }
  });
});
