const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const stepName = process.argv[2] || 'step1-shell';
const route = process.argv[3] || '/';

const screenshotsDir = path.resolve(__dirname, '../../docs/redesign/screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Sample typed responses matching FastAPI schemas
const mockUser = {
  id: 'usr_dev1',
  email: 'alex@example.com',
  full_name: 'Alex Mercer',
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
    {
      id: 'repo-broken',
      owner: 'acme-corp',
      name: 'infra-terraform',
      is_private: false,
      created_at: '2026-02-20T11:00:00Z',
      latest_job_status: 'FAILED',
      latest_job_failure_code: 'CLONE_FAILED',
      active_version_short_sha: null,
      last_indexed_at: null,
    },
  ],
  total: 3,
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
    {
      id: 'conv-2',
      title: 'Analyze security model of OAuth2 password bearer token validation',
      created_at: '2026-02-28T18:45:00Z',
      updated_at: '2026-02-28T18:45:00Z',
    },
  ],
};

async function setupPageRoutes(page) {
  await page.route('**/api/v1/auth/me', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockUser),
    });
  });

  await page.route('**/api/v1/repositories', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockRepositories),
    });
  });

  await page.route('**/api/v1/repositories/*/conversations*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockConversations),
    });
  });

  await page.route('**/api/v1/users/pinned-repositories', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

async function run() {
  console.log(`Starting preview server for ${stepName}...`);
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
    console.error('Failed to connect to preview server');
    if (preview.pid) {
      process.kill(preview.pid);
    }
    process.exit(1);
  }

  console.log('Preview server ready. Launching Playwright browser...');
  const browser = await chromium.launch({ headless: true });

  try {
    // 1440px desktop
    const pageDesktop = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    await setupPageRoutes(pageDesktop);
    await pageDesktop.goto(`http://localhost:4173${route}`, { waitUntil: 'networkidle' });
    await pageDesktop.waitForTimeout(1000);
    const dest1440 = path.join(screenshotsDir, `${stepName}-1440.png`);
    await pageDesktop.screenshot({ path: dest1440, fullPage: false });
    console.log(`Saved desktop screenshot: ${dest1440}`);
    await pageDesktop.close();

    // 390px mobile
    const pageMobile = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    await setupPageRoutes(pageMobile);
    await pageMobile.goto(`http://localhost:4173${route}`, { waitUntil: 'networkidle' });
    await pageMobile.waitForTimeout(1000);
    const dest390 = path.join(screenshotsDir, `${stepName}-390.png`);
    await pageMobile.screenshot({ path: dest390, fullPage: false });
    console.log(`Saved mobile screenshot: ${dest390}`);
    await pageMobile.close();
  } finally {
    await browser.close();
    try {
      spawn('taskkill', ['/pid', String(preview.pid), '/f', '/t'], { shell: true });
    } catch (_) {}
  }
  console.log('Capture finished successfully.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
