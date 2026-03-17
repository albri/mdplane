import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STATIC_FILES = [
  'index.html',
  'styles.css',
  'favicon.ico',
  'apple-icon.png',
  'icon.svg',
  'site.webmanifest',
  'web-app-manifest-192x192.png',
  'web-app-manifest-512x512.png',
];

function run(cmd, args, cwd) {
  execFileSync(cmd, args, { cwd, stdio: 'inherit' });
}

function fingerprint(content) {
  return createHash('sha256').update(content).digest('hex').slice(0, 10);
}

function copyStaticFiles(appDir, distDir) {
  for (const file of STATIC_FILES) {
    copyFileSync(path.join(appDir, file), path.join(distDir, file));
  }
}

function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const appDir = path.resolve(scriptDir, '..');
  const distDir = path.join(appDir, 'dist');

  rmSync(distDir, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });

  run('pnpm', ['exec', 'tsc', '--project', 'tsconfig.json'], appDir);
  copyStaticFiles(appDir, distDir);

  const viewModelPath = path.join(distDir, 'status-view-model.js');
  const viewModelJs = readFileSync(viewModelPath, 'utf8');
  const viewModelFileName = `status-view-model.${fingerprint(viewModelJs)}.js`;
  renameSync(viewModelPath, path.join(distDir, viewModelFileName));

  const mainJsPath = path.join(distDir, 'main.js');
  const stylesPath = path.join(distDir, 'styles.css');

  const mainJs = readFileSync(mainJsPath, 'utf8')
    .replace('./status-view-model.js', `./${viewModelFileName}`);
  writeFileSync(mainJsPath, mainJs, 'utf8');

  const stylesCss = readFileSync(stylesPath, 'utf8');

  const mainFileName = `main.${fingerprint(mainJs)}.js`;
  const stylesFileName = `styles.${fingerprint(stylesCss)}.css`;

  renameSync(mainJsPath, path.join(distDir, mainFileName));
  renameSync(stylesPath, path.join(distDir, stylesFileName));

  const indexSource = readFileSync(path.join(appDir, 'index.html'), 'utf8');
  const fingerprintedIndex = indexSource
    .replace('./styles.css', `./${stylesFileName}`)
    .replace('./main.js', `./${mainFileName}`);

  writeFileSync(path.join(distDir, 'index.html'), fingerprintedIndex, 'utf8');
}

main();
