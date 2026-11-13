import { execSync } from 'node:child_process';
import path from 'node:path';

const packages = [
  'packages/protocol',
  'packages/memory',
  'packages/core',
  'packages/providers',
  'apps/gateway',
  'apps/web',
];

for (const pkg of packages) {
  console.log(`\n📦 Building ${pkg}...`);
  execSync('npx tsc -p tsconfig.json', { cwd: path.resolve(pkg), stdio: 'inherit' });
  if (pkg === 'apps/web') {
    execSync('npx vite build', { cwd: path.resolve(pkg), stdio: 'inherit' });
  }
}

console.log('\n✅ All packages built successfully!\n');

