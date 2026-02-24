#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const packageDir = process.cwd();
const packageJsonPath = path.join(packageDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const tarballName = `mdplane-cli-${packageJson.version}.tgz`;
const tarballPath = path.join(packageDir, tarballName);

const run = (command, args, cwd) => {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`);
  }
};

let tempDir = '';

try {
  if (fs.existsSync(tarballPath)) {
    fs.rmSync(tarballPath, { force: true });
  }

  run('npm', ['pack'], packageDir);

  if (!fs.existsSync(tarballPath)) {
    throw new Error(`Expected tarball not found: ${tarballPath}`);
  }

  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdplane-cli-pack-'));
  const tempPackageJsonPath = path.join(tempDir, 'package.json');
  fs.writeFileSync(
    tempPackageJsonPath,
    JSON.stringify(
      {
        name: 'mdplane-cli-pack-smoke',
        private: true,
        version: '0.0.0',
      },
      null,
      2
    )
  );

  run('npm', ['install', tarballPath], tempDir);
  run('npx', ['mdplane', '--help'], tempDir);

  console.log('pack smoke passed');
} finally {
  if (tempDir !== '') {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  if (fs.existsSync(tarballPath)) {
    fs.rmSync(tarballPath, { force: true });
  }
}
