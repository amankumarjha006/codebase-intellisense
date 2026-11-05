import { describe, it, expect } from 'vitest';
import { classifyPath, isSourceHotspot } from './classifyPath';

describe('classifyPath', () => {
  describe('generated bucket (lockfiles, vendor, dist, minified)', () => {
    it('classifies standard lockfiles as generated', () => {
      expect(classifyPath('package-lock.json')).toBe('generated');
      expect(classifyPath('uv.lock')).toBe('generated');
      expect(classifyPath('poetry.lock')).toBe('generated');
      expect(classifyPath('yarn.lock')).toBe('generated');
      expect(classifyPath('pnpm-lock.yaml')).toBe('generated');
      expect(classifyPath('Cargo.lock')).toBe('generated');
    });

    it('classifies vendor, dist, build, node_modules paths as generated', () => {
      expect(classifyPath('vendor/bundle/ruby/2.7.0/gems.rb')).toBe('generated');
      expect(classifyPath('dist/assets/index.js')).toBe('generated');
      expect(classifyPath('build/static/bundle.js')).toBe('generated');
      expect(classifyPath('node_modules/@radix-ui/react-slot/index.js')).toBe('generated');
      expect(classifyPath('.next/server/pages/index.js')).toBe('generated');
    });

    it('classifies minified bundles as generated', () => {
      expect(classifyPath('static/js/vendor.min.js')).toBe('generated');
      expect(classifyPath('assets/main.min.css')).toBe('generated');
      expect(classifyPath('dist/bundle.js.map')).toBe('generated');
    });
  });

  describe('test bucket', () => {
    it('classifies test directories and __tests__ as test', () => {
      expect(classifyPath('tests/test_main.py')).toBe('test');
      expect(classifyPath('test/api_test.go')).toBe('test');
      expect(classifyPath('src/__tests__/Component.test.tsx')).toBe('test');
    });

    it('classifies conftest.py and test_*.py outside test dirs as test', () => {
      expect(classifyPath('conftest.py')).toBe('test');
      expect(classifyPath('server/app/conftest.py')).toBe('test');
      expect(classifyPath('app/test_handlers.py')).toBe('test');
      expect(classifyPath('service/router_test.py')).toBe('test');
    });

    it('classifies test and spec files as test', () => {
      expect(classifyPath('client/src/lib/api.test.ts')).toBe('test');
      expect(classifyPath('client/src/components/Button.spec.tsx')).toBe('test');
    });

    it('classifies benchmarks as test', () => {
      expect(classifyPath('benchmarks/fastapi_bench.py')).toBe('test');
      expect(classifyPath('perf/load_test.js')).toBe('test');
    });
  });

  describe('docs bucket', () => {
    it('classifies docs directories as docs', () => {
      expect(classifyPath('docs/index.md')).toBe('docs');
      expect(classifyPath('documentation/guide.rst')).toBe('docs');
    });

    it('classifies markdown, license, contributing as docs', () => {
      expect(classifyPath('README.md')).toBe('docs');
      expect(classifyPath('LICENSE')).toBe('docs');
      expect(classifyPath('CONTRIBUTING.md')).toBe('docs');
      expect(classifyPath('CHANGELOG.md')).toBe('docs');
    });
  });

  describe('example bucket', () => {
    it('classifies examples and tutorials as example', () => {
      expect(classifyPath('examples/tutorial_001.py')).toBe('example');
      expect(classifyPath('samples/oauth_demo.py')).toBe('example');
      expect(classifyPath('tutorials/quickstart.ts')).toBe('example');
    });
  });

  describe('config bucket', () => {
    it('classifies config files correctly', () => {
      expect(classifyPath('vite.config.ts')).toBe('config');
      expect(classifyPath('tailwind.config.js')).toBe('config');
      expect(classifyPath('tsconfig.json')).toBe('config');
      expect(classifyPath('package.json')).toBe('config');
      expect(classifyPath('pyproject.toml')).toBe('config');
      expect(classifyPath('Dockerfile')).toBe('config');
      expect(classifyPath('docker-compose.yml')).toBe('config');
      expect(classifyPath('.eslintrc.cjs')).toBe('config');
      expect(classifyPath('.env.example')).toBe('config');
    });
  });

  describe('source bucket & isSourceHotspot', () => {
    it('classifies core application code as source', () => {
      expect(classifyPath('server/app/main.py')).toBe('source');
      expect(classifyPath('client/src/App.tsx')).toBe('source');
      expect(classifyPath('internal/router/router.go')).toBe('source');
      expect(classifyPath('src/core/engine.rs')).toBe('source');
    });

    it('filters hotspots: returns true for source and false for non-source', () => {
      expect(isSourceHotspot('server/app/main.py')).toBe(true);
      expect(isSourceHotspot('client/src/App.tsx')).toBe(true);
      expect(isSourceHotspot('package-lock.json')).toBe(false);
      expect(isSourceHotspot('tests/test_api.py')).toBe(false);
      expect(isSourceHotspot('docs/readme.md')).toBe(false);
      expect(isSourceHotspot('vendor/dep.py')).toBe(false);
    });
  });
});
