export type PathCategory =
  | 'source'
  | 'test'
  | 'docs'
  | 'example'
  | 'config'
  | 'generated';

const GENERATED_LOCKFILES = new Set([
  'package-lock.json',
  'uv.lock',
  'poetry.lock',
  'yarn.lock',
  'pnpm-lock.yaml',
  'cargo.lock',
  'composer.lock',
  'gemfile.lock',
]);

const GENERATED_DIRS = [
  'node_modules',
  'vendor',
  'dist',
  'build',
  'out',
  'target',
  '.next',
  '.git',
  '.venv',
  'venv',
  '__pycache__',
];

const TEST_DIRS = ['tests', 'test', '__tests__', 'spec', 'specs', 'benchmarks', 'benchmark', 'perf'];

const DOCS_DIRS = ['docs', 'doc', 'documentation'];

const EXAMPLE_DIRS = ['examples', 'example', 'samples', 'demo', 'demos', 'tutorials'];

/**
 * Classifies a file path into one of the designated categories:
 * - 'generated': Lockfiles, minified files, vendor/dist/build bundles
 * - 'test': Test suites, conftest.py, unit tests, benchmarks
 * - 'docs': Documentation markdown, readmes, text docs
 * - 'example': Sample code, demo apps, tutorials
 * - 'config': Configuration manifests, linters, tooling configs
 * - 'source': Primary code files
 */
export function classifyPath(rawPath: string): PathCategory {
  if (!rawPath) return 'source';

  // Normalize path separators to forward slash and convert to lowercase for comparison
  const normalized = rawPath.replace(/\\/g, '/').trim();
  const lower = normalized.toLowerCase();
  const segments = lower.split('/');
  const fileName = segments[segments.length - 1];

  // 1. Check Generated Lockfiles
  if (GENERATED_LOCKFILES.has(fileName)) {
    return 'generated';
  }

  // Check minified files or source maps
  if (
    fileName.endsWith('.min.js') ||
    fileName.endsWith('.min.css') ||
    fileName.endsWith('.map') ||
    fileName.endsWith('.bundle.js')
  ) {
    return 'generated';
  }

  // Check generated / vendor directories
  for (const dir of GENERATED_DIRS) {
    if (segments.includes(dir)) {
      return 'generated';
    }
  }

  // 2. Check Test directories & files
  for (const testDir of TEST_DIRS) {
    if (segments.includes(testDir)) {
      return 'test';
    }
  }

  if (
    fileName === 'conftest.py' ||
    fileName.startsWith('test_') ||
    fileName.endsWith('_test.py') ||
    fileName.endsWith('.test.ts') ||
    fileName.endsWith('.test.tsx') ||
    fileName.endsWith('.test.js') ||
    fileName.endsWith('.test.jsx') ||
    fileName.endsWith('.spec.ts') ||
    fileName.endsWith('.spec.tsx') ||
    fileName.endsWith('.spec.js')
  ) {
    return 'test';
  }

  // 3. Check Documentation
  for (const docDir of DOCS_DIRS) {
    if (segments.includes(docDir)) {
      return 'docs';
    }
  }

  if (
    fileName.endsWith('.md') ||
    fileName.endsWith('.rst') ||
    fileName === 'license' ||
    fileName === 'notice' ||
    fileName.startsWith('changelog') ||
    fileName.startsWith('contributing') ||
    fileName.startsWith('readme')
  ) {
    return 'docs';
  }

  // 4. Check Examples
  for (const exDir of EXAMPLE_DIRS) {
    if (segments.includes(exDir)) {
      return 'example';
    }
  }

  // 5. Check Config files
  if (
    fileName.includes('.config.') ||
    fileName.startsWith('tsconfig') ||
    fileName === 'package.json' ||
    fileName === 'pyproject.toml' ||
    fileName === 'setup.cfg' ||
    fileName === 'setup.py' ||
    fileName.startsWith('dockerfile') ||
    fileName.startsWith('docker-compose') ||
    fileName.startsWith('.env') ||
    fileName.startsWith('.eslint') ||
    fileName === '.gitignore' ||
    fileName === 'biome.json'
  ) {
    return 'config';
  }

  return 'source';
}

/**
 * Filter out non-source files (e.g. lockfiles, minified, vendor, tests)
 * when computing core application hotspots.
 */
export function isSourceHotspot(filePath: string): boolean {
  const category = classifyPath(filePath);
  return category === 'source';
}

