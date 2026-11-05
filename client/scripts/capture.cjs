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
        const req = http.get('http://localhost:4173', (res) => {
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
