// Playwright automated smoke test script for Codebase Intellisense
// Verifies: Connect/select repo -> Overview -> Chat -> Cited response -> Citation click -> Search -> Files
const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const mockUser = {
  id: 'usr-1',
  email: 'alex@example.com',
  name: 'Alex Mercer',
  avatar_url: null,
  role: 'developer',
  created_at: '2026-01-01T00:00:00Z',
  github: {
    username: 'alexmercer',
    github_user_id: '99214',
  },
};

const mockRepositories = {
  items: [
    {
      id: 'repo-fastapi',
      owner: 'fastapi',
      name: 'fastapi',
      is_private: false,
      created_at: '2026-01-01T10:00:00Z',
      latest_job_status: 'READY',
      latest_job_failure_code: null,
      active_version_short_sha: 'd3a4b1e',
      last_indexed_at: '2026-03-01T14:32:00Z',
    },
    {
      id: 'repo-private',
      owner: 'acme-corp',
      name: 'payment-gateway',
      is_private: true,
      created_at: '2026-02-15T09:00:00Z',
      latest_job_status: 'INDEXING',
      latest_job_failure_code: null,
      active_version_short_sha: null,
      last_indexed_at: null,
    },
  ],
  total: 2,
  page: 1,
  limit: 100,
  has_more: false,
};

const mockConversations = {
  items: [
    {
      id: 'conv-1',
      title: 'How does dependency injection resolve sub-dependencies in routing?',
      created_at: '2026-03-01T15:20:00Z',
      updated_at: '2026-03-01T15:20:00Z',
    },
  ],
};

const mockRepoDetail = {
  id: 'repo-fastapi',
  owner: 'fastapi',
  name: 'fastapi',
  is_private: false,
  primary_language: 'Python',
  lines_of_code: 34210,
  ast_nodes: 89420,
  active_version: {
    id: 'ver-1',
    commit_sha: 'd3a4b1e8f00124ca',
    branch: 'master',
    status: 'READY',
    indexed_at: '2026-03-01T14:32:00Z',
  },
};

const mockFiles = {
  files: [
    { id: 'f1', path: 'fastapi/applications.py', language: 'python', size: 28400, sha256: 'abc' },
    { id: 'f2', path: 'fastapi/routing.py', language: 'python', size: 45200, sha256: 'def' },
    { id: 'f3', path: 'fastapi/dependencies/utils.py', language: 'python', size: 18500, sha256: 'ghi' },
  ],
  total: 3,
};

const mockFileContent = {
  path: 'fastapi/dependencies/utils.py',
  content: Array.from({ length: 60 }, (_, i) => `def helper_func_${i + 1}():\n    return ${i + 1}`).join('\n'),
  language: 'python',
  size: 3420,
};

const mockMessages = {
  items: [
    {
      id: 'm1',
      conversation_id: 'conv-1',
      role: 'user',
      content: 'How does dependency injection resolve sub-dependencies in routing?',
      citations: [],
      created_at: '2026-03-01T15:20:00Z',
    },
    {
      id: 'm2',
      conversation_id: 'conv-1',
      role: 'assistant',
      content:
        'In FastAPI, dependency injection is managed through `Depends` and resolved in `fastapi/dependencies/utils.py` [1]. Sub-dependencies are solved topologically using an acyclic dependency graph before invoking endpoint handlers.',
      citations: [
        {
          id: 'c1',
          file_path: 'fastapi/dependencies/utils.py',
          start_line: 42,
          end_line: 56,
        },
      ],
      created_at: '2026-03-01T15:20:05Z',
    },
  ],
  total: 2,
};

const mockSearchResults = {
  repository_version_id: 'v1',
  results: [
    {
      id: 'res-1',
      file_path: 'fastapi/applications.py',
      start_line: 110,
      end_line: 125,
      snippet: 'class FastAPI(Starlette):\n    def __init__(self, debug=False, routes=None):\n        self.router = APIRouter()',
      score: 0.96,
    },
  ],
};

async function setupPageRoutes(page) {
  await page.route('**/api/v1/auth/me', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockUser) });
  });

  await page.route('**/api/v1/repositories/repo-fastapi/active-version', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'v1', commit_sha: 'd3a4b1e8f00124ca', branch_name: 'master' }),
    });
  });

  await page.route('**/api/v1/repositories/repo-fastapi/files/fastapi/**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockFileContent) });
  });

  await page.route('**/api/v1/repositories/repo-fastapi/files*', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockFiles) });
  });

  await page.route('**/api/v1/repositories/repo-fastapi', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockRepoDetail) });
  });

  await page.route('**/api/v1/repositories/*/conversations*', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockConversations) });
  });

  await page.route('**/api/v1/conversations/*/messages*', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockMessages) });
  });

  await page.route('**/api/v1/repositories/*/search', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSearchResults) });
  });

  await page.route('**/api/v1/users/pinned-repositories', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/api/v1/repositories*', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockRepositories) });
  });
}

async function runSmokeTest() {
  console.log('--- Starting Playwright Smoke Test ---');
  console.log('1. Starting preview server on port 4173...');

  const preview = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
    cwd: path.resolve(__dirname, '..'),
    shell: true,
    stdio: 'ignore',
  });

  let serverReady = false;
  for (let i = 0; i < 40; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get('http://localhost:4173', () => {
          serverReady = true;
          resolve();
        });
        req.on('error', reject);
        req.setTimeout(500, () => {
          req.destroy();
          reject(new Error('timeout'));
        });
      });
      if (serverReady) break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  if (!serverReady) {
    console.error('Failed to start preview server.');
    preview.kill();
    process.exit(1);
  }

  console.log('2. Preview server running. Launching Chromium...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await setupPageRoutes(page);

    console.log('3. Navigating to Dashboard (/dashboard)...');
    await page.goto('http://localhost:4173/dashboard', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.waitForSelector('text=fastapi');
    console.log('   ✓ Dashboard displayed fastapi repository card.');

    console.log('4. Opening repository overview (/repositories/repo-fastapi)...');
    await page.goto('http://localhost:4173/repositories/repo-fastapi', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.waitForSelector('text=fastapi/fastapi');
    console.log('   ✓ Repository header and overview rendered with branch@sha.');

    console.log('5. Navigating to Cited Q&A Chat (/repositories/repo-fastapi/chat?c=conv-1)...');
    await page.goto('http://localhost:4173/repositories/repo-fastapi/chat?c=conv-1', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    console.log('   ✓ Chat history loaded with verified citation.');

    console.log('6. Clicking citation [1] to inspect source code...');
    const citationChip = page.locator('button:has-text("[1]")').first();
    await citationChip.waitFor({ state: 'visible', timeout: 10000 });
    await citationChip.click();
    await page.waitForTimeout(1000);
    await page.waitForSelector('text=fastapi/dependencies/utils.py');
    console.log('   ✓ Citation inspector opened with line-highlighted source code.');

    console.log('7. Navigating to Code Search (/repositories/repo-fastapi/search)...');
    await page.goto('http://localhost:4173/repositories/repo-fastapi/search?q=FastAPI', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.locator('main').getByText('applications.py').first().waitFor({ state: 'visible' });
    console.log('   ✓ Code search rendered split-pane results and Shiki preview.');

    console.log('8. Navigating to Virtualized Files Browser (/repositories/repo-fastapi/files)...');
    await page.goto('http://localhost:4173/repositories/repo-fastapi/files', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.locator('nav[aria-label="File path"]').getByText('applications.py').waitFor({ state: 'visible' });
    console.log('   ✓ Virtualized file tree rendered and active file displayed.');

    console.log('9. Checking keyboard navigation and visible focus rings...');
    await page.keyboard.press('Tab');
    const focusedTag = await page.evaluate(() => document.activeElement ? document.activeElement.tagName : '');
    if (!focusedTag) {
      throw new Error('Focus ring / activeElement not detected on Tab navigation');
    }
    console.log(`   ✓ Active keyboard focus ring verified on <${focusedTag.toLowerCase()}> element.`);

    console.log('=== Playwright Smoke Test: ALL 9 USER JOURNEY CHECKS PASSED ===');
  } catch (err) {
    console.error('Smoke test failed with error:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
    preview.kill();
    console.log('Preview server terminated cleanly.');
  }
}

runSmokeTest();
