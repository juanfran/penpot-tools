#!/usr/bin/env node
// Packaging entry point. Works around the issue where electron-builder follows
// pnpm's broken peer-dep symlinks under <workspace>/node_modules/.pnpm/node_modules
// by deploying viewer-electron to a self-contained directory via `pnpm deploy`,
// then running electron-builder from there.

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const electronAppDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(electronAppDir, '..', '..');
const viewerOutputDir = path.join(repoRoot, 'apps', 'viewer', '.output');
// Deploy *outside* the workspace so electron-builder's native-module walker
// cannot bubble up to <repo>/node_modules/.pnpm/node_modules and stat broken
// peer-dep symlinks (the original failure mode).
const deployDir = path.join(os.tmpdir(), 'penpot-viewer-electron-deploy');
const releaseDir = path.join(electronAppDir, 'release');

const targetFlags = process.argv.slice(2);

function run(cmd, args, opts = {}) {
  console.log(`\n$ ${cmd} ${args.join(' ')}  (cwd: ${opts.cwd ?? process.cwd()})`);
  const result = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function rmrf(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function copyDir(from, to) {
  fs.cpSync(from, to, { recursive: true, dereference: false });
}

// 1. Build the viewer if its Nitro output is missing.
if (!fs.existsSync(path.join(viewerOutputDir, 'server', 'index.mjs'))) {
  run('pnpm', ['--filter', 'viewer', 'build'], { cwd: repoRoot });
}

// 2. Deploy viewer-electron to a self-contained directory without pnpm symlinks.
rmrf(deployDir);
run('pnpm', ['--filter', 'viewer-electron', 'deploy', '--legacy', deployDir], { cwd: repoRoot });

// 3. Copy the viewer build into the deploy so extraResources can find it via a
//    path that resolves both inside and outside the deploy dir.
const deployedViewerOutput = path.join(deployDir, 'viewer-output');
rmrf(deployedViewerOutput);
copyDir(viewerOutputDir, deployedViewerOutput);

// 4. Run electron-builder from the deployed dir. Its package.json carries the
//    `build` config; extraResources point to ./viewer-output (see package.json).
const electronBuilderBin = path.join(
  deployDir,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder',
);
const builderArgs = [
  ...targetFlags,
  '--config.directories.output',
  releaseDir,
];
run(electronBuilderBin, builderArgs, { cwd: deployDir });

console.log(`\nElectron build artifacts written to ${releaseDir}`);
