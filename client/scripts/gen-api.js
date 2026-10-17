import { execSync } from 'child_process';
import { existsSync, writeFileSync, unlinkSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDir = resolve(__dirname, '..');
const outputFile = resolve(clientDir, 'src/lib/api-types.ts');
const tempJson = resolve(clientDir, 'temp-openapi.json');

async function main() {
  console.log('Generating API types from backend OpenAPI schema...');

  // 1. Try live server
  try {
    const res = await fetch('http://localhost:8000/openapi.json');
    if (res.ok) {
      const data = await res.json();
      writeFileSync(tempJson, JSON.stringify(data));
      execSync(`npx openapi-typescript "${tempJson}" -o "${outputFile}"`, { stdio: 'inherit' });
      unlinkSync(tempJson);
      console.log('✓ Successfully generated types from live backend server.');
      return;
    }
  } catch {
    // Live server not running
  }

  // 2. Try python script in server .venv
  const serverDir = resolve(clientDir, '../server');
  const pythonBinWindows = resolve(serverDir, '.venv/Scripts/python.exe');
  const pythonBinUnix = resolve(serverDir, '.venv/bin/python');
  const pythonBin = existsSync(pythonBinWindows) ? pythonBinWindows : (existsSync(pythonBinUnix) ? pythonBinUnix : 'python');

  try {
    const cmd = `"${pythonBin}" -c "import json; from app.main import app; print(json.dumps(app.openapi()))"`;
    const openapiStr = execSync(cmd, { cwd: serverDir, maxBuffer: 10 * 1024 * 1024 }).toString();
    writeFileSync(tempJson, openapiStr);
    execSync(`npx openapi-typescript "${tempJson}" -o "${outputFile}"`, { stdio: 'inherit' });
    unlinkSync(tempJson);
    console.log('✓ Successfully generated types from FastAPI app directly.');
    return;
  } catch (err) {
    console.warn('Could not run Python export directly:', err.message);
  }

  // 3. Fallback: check if outputFile already exists
  if (existsSync(outputFile)) {
    console.log('✓ Backend not running; kept existing generated types in src/lib/api-types.ts.');
    return;
  }

  console.error('Failed to generate OpenAPI types and no fallback found.');
  process.exit(1);
}

main();
