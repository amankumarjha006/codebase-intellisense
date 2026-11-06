const fs = require('fs');
const path = require('path');

const demoPath = path.resolve(__dirname, '../src/features/landing/data/demo.json');

function verifyDemo() {
  if (!fs.existsSync(demoPath)) {
    console.error(`Verification error: demo.json not found at ${demoPath}`);
    process.exit(1);
  }

  const entries = JSON.parse(fs.readFileSync(demoPath, 'utf-8'));
  const unverified = entries.filter((e) => e.verified !== true);

  if (unverified.length > 0) {
    console.error('======================================================================');
    console.error('HUMAN-VERIFICATION GATE FAILED:');
    console.error(`Found ${unverified.length} unverified demo entries in demo.json:`);
    unverified.forEach((e) => {
      console.error(` - [${e.id}] "${e.title}": verified is ${e.verified}`);
    });
    console.error('Each cited line range must be confirmed by human reviewer before building.');
    console.error('Set "verified": true on reviewed entries to pass.');
    console.error('======================================================================');
    process.exit(1);
  }

  console.log(`Demo human-verification gate passed: all ${entries.length} entries verified.`);
}

if (process.env.ENFORCE_DEMO_VERIFICATION === 'true') {
  verifyDemo();
} else {
  // Warn during development, enforce in strict gate
  const entries = JSON.parse(fs.readFileSync(demoPath, 'utf-8'));
  const unverified = entries.filter((e) => e.verified !== true);
  if (unverified.length > 0) {
    console.warn(`[Verification Note] ${unverified.length} demo entries pending human verification.`);
  }
}

