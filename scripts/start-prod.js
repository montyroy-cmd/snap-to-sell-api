'use strict';

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

function hasNestCommon() {
  return fs.existsSync(
    path.join(process.cwd(), 'node_modules', '@nestjs', 'common', 'package.json'),
  );
}

function installProductionDeps() {
  const lockfile = path.join(process.cwd(), 'package-lock.json');
  const cmd = fs.existsSync(lockfile)
    ? 'npm ci --omit=dev'
    : 'npm install --omit=dev';
  console.log(`Running ${cmd} (production dependencies missing or incomplete)...`);
  execSync(cmd, { stdio: 'inherit', env: process.env });
}

// Azure often uses `node dist/main.js` as the startup command; that skips npm `prestart`.
// Always bootstrap through this script (via `npm start` or `node scripts/start-prod.js`) so deps are present.
if (!hasNestCommon()) {
  try {
    installProductionDeps();
  } catch {
    console.error(
      'Failed to install production dependencies. Deploy package.json and package-lock.json, ' +
        'or use a build step that runs npm ci. If WEBSITE_RUN_FROM_PACKAGE=1, node_modules must be in the deployment package.',
    );
    process.exit(1);
  }
}

if (!hasNestCommon()) {
  console.error('@nestjs/common is still missing after install.');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['dist/main.js'], {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: process.env,
});

process.exit(result.status === null ? 1 : result.status);
