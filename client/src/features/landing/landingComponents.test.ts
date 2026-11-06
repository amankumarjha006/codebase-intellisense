import { describe, it, expect } from 'vitest';
import proofData from './data/proof.json';
import refusalData from './data/refusal.json';
import archData from './data/architecture.json';
import { PRIVACY_FACTS } from './data/privacy';

describe('Landing Page Data Integrity Tests', () => {
  it('validates proofData numbers and invariants', () => {
    expect(proofData.repository).toBe('fastapi/fastapi');
    expect(proofData.sourceFilesAnalyzed).toBe(1221);
    expect(proofData.pythonFiles).toBe(1217);
    expect(proofData.javascriptFiles).toBe(4);
    expect(proofData.sourceFilesAnalyzed).toBe(proofData.pythonFiles + proofData.javascriptFiles);

    expect(proofData.skippedFilesDisclosed).toBe(244);
    const sumSkipped = Object.values(proofData.skippedBreakdown).reduce((a, b) => a + b, 0);
    expect(sumSkipped).toBe(proofData.skippedFilesDisclosed);

    expect(proofData.symbolsExtracted).toBe(12499);
    expect(proofData.internalImportsResolvedPercent).toBe(99.1);
    expect(proofData.totalInternalImports).toBe(2778);
    expect(proofData.resolvedInternalImports).toBe(2753);
  });

  it('validates refusalData structure and non-empty recorded answer', () => {
    expect(refusalData.status).toBe('declined_insufficient_context');
    expect(refusalData.query).toContain('SessionMiddleware');
    expect(refusalData.answer).toContain('insufficient');
    expect(refusalData.metadata.repo).toBe('fastapi/fastapi');
    expect(refusalData.metadata.model).toBeDefined();
  });

  it('validates architectureData structure and core components', () => {
    expect(archData.repo).toBe('fastapi/fastapi');
    expect(archData.components.length).toBeGreaterThanOrEqual(4);
    const compNames = archData.components.map((c) => c.name);
    expect(compNames).toContain('fastapi');
    expect(compNames).toContain('tests');
    expect(compNames).toContain('docs_src');
    expect(compNames).toContain('scripts');

    expect(archData.edges.length).toBeGreaterThanOrEqual(3);
    archData.edges.forEach((edge) => {
      expect(edge).toHaveProperty('source');
      expect(edge).toHaveProperty('target');
      expect(edge).toHaveProperty('weight');
      expect(edge.weight).toBeGreaterThan(0);
    });

    expect(archData.externalDependencies).toContain('pydantic');
    expect(archData.externalDependencies).toContain('starlette');
  });

  it('validates PRIVACY_FACTS entries and evidence pointers', () => {
    expect(PRIVACY_FACTS.length).toBe(4);
    PRIVACY_FACTS.forEach((fact) => {
      expect(fact.topic).toBeTruthy();
      expect(fact.detail).toBeTruthy();
      expect(fact.evidence).toBeTruthy();
      // Verifies no vague local claims
      expect(fact.detail.toLowerCase()).not.toContain('local laptop');
    });
  });
});

