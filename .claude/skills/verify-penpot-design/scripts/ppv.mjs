#!/usr/bin/env node
// Harness for the verify-penpot-design skill. Drives the real penpot-tools
// MCP over stdio against a disposable Penpot instance and captures evidence.
// Usage: scripts/ppv <command> [...args]   (see SKILL.md for every command)

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(SKILL_DIR, '../../..');
const MCP_DIR = path.join(REPO, 'apps/mcp');
const MCP_BIN = path.join(MCP_DIR, 'bin/mcp.mjs');
const COMPOSE_FILE = path.join(SKILL_DIR, 'scripts/compose.yaml');
const PROJECT = 'penpot-verify';
const PORT = process.env.PPV_PORT ?? '9101';
const VERSION = process.env.PPV_PENPOT_VERSION ?? '2.19.5';
const BASE = `http://localhost:${PORT}`;
const VERIFY_DIR = process.env.PPV_DIR ?? path.join(REPO, 'tmp/verify');
const INSTANCE_FILE = path.join(VERIFY_DIR, '.instance.json');
const BOT = { fullname: 'Verify Bot', email: 'verify@example.com', password: 'Verify-penpot-123!' };

const req = createRequire(path.join(MCP_DIR, 'package.json'));

// ---------------------------------------------------------------- utils

function die(msg, code = 2) {
  console.error(`ppv: ${msg}`);
  process.exit(code);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

function compose(args, opts = {}) {
  return spawnSync('docker', ['compose', '-p', PROJECT, '-f', COMPOSE_FILE, ...args], {
    encoding: 'utf8',
    env: { ...process.env, PPV_PORT: PORT, PPV_PENPOT_VERSION: VERSION },
    ...opts,
  });
}

function instance() {
  if (!fs.existsSync(INSTANCE_FILE)) die('no seeded instance; run `ppv up` first');
  return readJson(INSTANCE_FILE);
}

function runDir(runId) {
  const dir = path.join(VERIFY_DIR, runId);
  if (!fs.existsSync(path.join(dir, 'run.json'))) die(`unknown run ${runId}; run \`ppv new-run\``);
  return dir;
}

function nextSeq(dir) {
  const f = path.join(dir, '.seq');
  const n = fs.existsSync(f) ? Number(fs.readFileSync(f, 'utf8')) + 1 : 1;
  fs.writeFileSync(f, String(n));
  return String(n).padStart(2, '0');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rpc(method, params = {}, { token, cookie, raw } = {}) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) headers.Authorization = `Token ${token}`;
  if (cookie) headers.Cookie = `auth-token=${cookie}`;
  const res = await fetch(`${BASE}/api/main/methods/${method}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  if (raw) return res;
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} → HTTP ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

async function login() {
  const res = await rpc(
    'login-with-password',
    { email: BOT.email, password: BOT.password },
    { raw: true },
  );
  if (!res.ok) throw new Error(`login failed: HTTP ${res.status} ${await res.text()}`);
  const cookies = res.headers.getSetCookie?.() ?? [res.headers.get('set-cookie') ?? ''];
  const hit = cookies.map((c) => /auth-token=([^;]+)/.exec(c)).find(Boolean);
  if (!hit) throw new Error('login returned no auth-token cookie');
  return hit[1];
}

function loadPlaywright() {
  return req('playwright');
}

async function withBrowser(fn) {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ args: ['--font-render-hinting=none'] });
  try {
    return await fn(browser);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------- file data

async function getFile(inst, fileId) {
  const team = await rpc('get-team', { id: inst.teamId }, { token: inst.token });
  return rpc('get-file', { id: fileId, features: team.features }, { token: inst.token });
}

function pageOf(file, pageId) {
  const page = file.data?.pagesIndex?.[pageId];
  if (!page) throw new Error(`page ${pageId} not found in file ${file.id}`);
  return page;
}

function findByName(objects, name) {
  const hits = Object.values(objects).filter((s) => s.name === name);
  if (hits.length === 0) throw new Error(`no shape named "${name}"`);
  if (hits.length > 1)
    throw new Error(`${hits.length} shapes named "${name}"; names in specs must be unique`);
  return hits[0];
}

function subtree(objects, rootId) {
  const out = [];
  const walk = (id) => {
    const s = objects[id];
    if (!s) return;
    out.push(s);
    for (const c of s.shapes ?? []) walk(c);
  };
  walk(rootId);
  return out;
}

function textLeaves(content) {
  const leaves = [];
  const walk = (n) => {
    if (!n) return;
    if (typeof n.text === 'string') leaves.push(n);
    for (const c of n.children ?? []) walk(c);
  };
  walk(content);
  return leaves;
}

// ---------------------------------------------------------------- commands

async function cmdUp() {
  const up = compose(['up', '-d'], { stdio: 'inherit' });
  if (up.status !== 0) die('docker compose up failed');
  process.stderr.write(`waiting for Penpot ${VERSION} at ${BASE} `);
  let ok = false;
  for (let i = 0; i < 100; i++) {
    try {
      const res = await rpc('get-profile', {}, { raw: true });
      const front = await fetch(`${BASE}/`);
      if (res.status === 200 && front.ok) {
        ok = true;
        break;
      }
    } catch {
      /* not up yet */
    }
    process.stderr.write('.');
    await sleep(3000);
  }
  process.stderr.write('\n');
  if (!ok) die('Penpot did not become ready; see `ppv logs`');

  if (fs.existsSync(INSTANCE_FILE)) {
    const inst = readJson(INSTANCE_FILE);
    const res = await rpc('get-profile', {}, { token: inst.token, raw: true });
    if (res.ok && (await res.json()).email === BOT.email) {
      console.log(`READY ${BASE} (existing seed, team ${inst.teamId})`);
      return;
    }
    console.error('stale .instance.json; reseeding');
  }

  const prep = await rpc('prepare-register-profile', BOT, { raw: true });
  const prepBody = await prep.json();
  if (prep.ok) {
    await rpc('register-profile', { token: prepBody.token });
  } else if (prepBody.code !== 'email-already-exists') {
    die(`register failed: ${JSON.stringify(prepBody)}`);
  }
  const cookie = await login();
  const { token } = await rpc('create-access-token', { name: `ppv-${Date.now()}` }, { cookie });
  const profile = await rpc('get-profile', {}, { token });
  writeJson(INSTANCE_FILE, {
    baseUrl: BASE,
    version: VERSION,
    email: BOT.email,
    profileId: profile.id,
    teamId: profile.defaultTeamId,
    token,
    seededAt: new Date().toISOString(),
  });
  fs.chmodSync(INSTANCE_FILE, 0o600);
  console.log(`READY ${BASE} (seeded, team ${profile.defaultTeamId})`);
}

async function cmdDoctor() {
  const problems = [];
  const ps = compose(['ps', '--format', '{{.Service}} {{.State}}']);
  const states = Object.fromEntries(
    ps.stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((l) => l.split(' ')),
  );
  for (const svc of [
    'penpot-frontend',
    'penpot-backend',
    'penpot-exporter',
    'penpot-postgres',
    'penpot-valkey',
  ]) {
    if (states[svc] !== 'running') problems.push(`${svc} is ${states[svc] ?? 'missing'}`);
  }
  const port = compose(['port', 'penpot-frontend', '8080']).stdout.trim();
  if (!port.endsWith(`:${PORT}`))
    problems.push(`port ${PORT} is not owned by ${PROJECT} (got "${port}")`);
  const img = compose(['images', '--format', 'json']).stdout;
  if (!img.includes(`"${VERSION}"`) && !img.includes(`:${VERSION}`)) {
    problems.push(`images are not tagged ${VERSION}`);
  }
  let inst;
  if (!fs.existsSync(INSTANCE_FILE)) problems.push('not seeded (.instance.json missing)');
  else {
    inst = readJson(INSTANCE_FILE);
    try {
      const p = await rpc('get-profile', {}, { token: inst.token });
      if (p.email !== BOT.email) problems.push(`token resolves to ${p.email ?? 'anonymous'}`);
    } catch (e) {
      problems.push(`token check failed: ${e.message}`);
    }
  }
  try {
    const exe = loadPlaywright().chromium.executablePath();
    if (!fs.existsSync(exe))
      problems.push(
        `Playwright Chromium missing at ${exe}; run \`pnpm --filter @penpot-tools/mcp exec playwright install chromium\``,
      );
  } catch (e) {
    problems.push(`playwright not resolvable from apps/mcp: ${e.message}`);
  }
  if (!fs.existsSync(path.join(MCP_DIR, 'node_modules/@modelcontextprotocol/sdk'))) {
    problems.push('apps/mcp dependencies missing; run `pnpm install`');
  }
  const commit = spawnSync('git', ['-C', REPO, 'rev-parse', '--short', 'HEAD'], {
    encoding: 'utf8',
  }).stdout.trim();
  const dirty = spawnSync('git', ['-C', REPO, 'status', '--porcelain', '--', 'apps', 'packages'], {
    encoding: 'utf8',
  }).stdout.trim();
  console.log(`penpot    ${BASE} ${VERSION}`);
  console.log(`team      ${inst?.teamId ?? '-'}`);
  console.log(
    `mcp       ${MCP_BIN} @ ${commit}${dirty ? ' (uncommitted changes in apps/ or packages/)' : ''}`,
  );
  console.log(`evidence  ${VERIFY_DIR}`);
  if (problems.length) {
    console.log('DOCTOR FAIL');
    for (const p of problems) console.log(`  - ${p}`);
    process.exit(1);
  }
  console.log('DOCTOR OK');
}

async function cmdNewRun(label = 'run') {
  const inst = instance();
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
  const runId = `${stamp}-${label.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}`;
  const dir = path.join(VERIFY_DIR, runId);
  fs.mkdirSync(dir, { recursive: true });
  const project = await rpc(
    'create-project',
    { teamId: inst.teamId, name: `ppv ${runId}` },
    { token: inst.token },
  );
  const created = await rpc(
    'create-file',
    { projectId: project.id, name: runId },
    { token: inst.token },
  );
  const file = await getFile(inst, created.id);
  const pageId = file.data.pages[0];
  const run = {
    runId,
    dir,
    projectId: project.id,
    fileId: file.id,
    pageId,
    teamId: inst.teamId,
    createdAt: new Date().toISOString(),
  };
  writeJson(path.join(dir, 'run.json'), run);
  writeJson(path.join(dir, 'mcp-state.json'), {
    token: inst.token,
    selection: { fileId: file.id, pageId, teamId: inst.teamId },
    updatedAt: new Date().toISOString(),
  });
  fs.chmodSync(path.join(dir, 'mcp-state.json'), 0o600);
  console.log(runId);
}

async function mcpClient(dir) {
  const sdk = path.join(MCP_DIR, 'node_modules/@modelcontextprotocol/sdk/dist/esm');
  const { Client } = await import(pathToFileURL(path.join(sdk, 'client/index.js')).href);
  const { StdioClientTransport } = await import(
    pathToFileURL(path.join(sdk, 'client/stdio.js')).href
  );
  const inst = instance();
  const env = { ...process.env };
  delete env.PENPOT_TOKEN;
  Object.assign(env, {
    PENPOT_BASE_URL: BASE,
    PENPOT_TOKEN: inst.token,
    PENPOT_RANDOM_STATE_FILE: path.join(dir, 'mcp-state.json'),
    PENPOT_MCP_MODE: process.env.PPV_MCP_MODE ?? 'read-write',
  });
  const stderrFile = fs.openSync(path.join(dir, 'mcp-stderr.log'), 'a');
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [MCP_BIN],
    env,
    cwd: MCP_DIR,
    stderr: stderrFile,
  });
  const client = new Client({ name: 'ppv', version: '1.0.0' });
  await client.connect(transport);
  return {
    client,
    close: async () => {
      await Promise.race([client.close(), sleep(3000)]);
      fs.closeSync(stderrFile);
    },
  };
}

function resolveRefs(value, ctx) {
  if (typeof value === 'string') {
    return value
      .replace(/\$\{(fileId|pageId|teamId)\}/g, (_, k) => ctx.run[k])
      .replace(/\$\{shape:([^}]+)\}/g, (_, name) => {
        const s = findByName(ctx.objects(), name);
        return s.id;
      });
  }
  if (Array.isArray(value)) return value.map((v) => resolveRefs(v, ctx));
  if (value && typeof value === 'object') {
    if (typeof value.$file === 'string')
      return fs.readFileSync(path.resolve(ctx.base, value.$file), 'utf8');
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveRefs(v, ctx)]));
  }
  return value;
}

async function callTool(client, dir, tool, args) {
  const seq = nextSeq(dir);
  const stem = path.join(dir, `${seq}-${tool}`);
  writeJson(`${stem}.request.json`, { tool, args });
  const started = Date.now();
  let result;
  try {
    result = await client.callTool({ name: tool, arguments: args }, undefined, {
      timeout: 180_000,
    });
  } catch (e) {
    result = { isError: true, content: [{ type: 'text', text: `client error: ${e.message}` }] };
  }
  const ms = Date.now() - started;
  const texts = [];
  let img = 0;
  const content = (result.content ?? []).map((c) => {
    if (c.type === 'image') {
      const f = `${stem}.image-${++img}.png`;
      fs.writeFileSync(f, Buffer.from(c.data, 'base64'));
      return { type: 'image', file: path.basename(f), mimeType: c.mimeType };
    }
    if (c.type === 'text') texts.push(c.text);
    return c;
  });
  writeJson(`${stem}.response.json`, { isError: !!result.isError, ms, content });
  fs.writeFileSync(`${stem}.response.md`, texts.join('\n\n'));
  const failed =
    result.isError || texts.some((t) => /^(Error|Tool execution failed|Penpot .* failed)/m.test(t));
  console.log(
    `${failed ? 'TOOL-ERROR' : 'TOOL-OK'} ${seq} ${tool} (${ms} ms) → ${path.relative(REPO, stem)}.response.md`,
  );
  return { failed, texts };
}

async function cmdMcp(runId, tool, argsArg) {
  const dir = runDir(runId);
  const run = readJson(path.join(dir, 'run.json'));
  const { client, close } = await mcpClient(dir);
  try {
    if (tool === '--list-tools') {
      const { tools } = await client.listTools();
      writeJson(path.join(dir, 'tools.json'), tools);
      for (const t of tools) console.log(t.name);
      return;
    }
    let args = {};
    if (argsArg) args = argsArg.trim().startsWith('{') ? JSON.parse(argsArg) : readJson(argsArg);
    let objects;
    if (JSON.stringify(args).includes('${shape:')) {
      objects = pageOf(await getFile(instance(), run.fileId), run.pageId).objects;
    }
    const ctx = { run, base: process.cwd(), objects: () => objects };
    const { failed } = await callTool(client, dir, tool, resolveRefs(args, ctx));
    if (failed) process.exitCode = 1;
  } finally {
    await close();
  }
}

async function cmdPlay(runId, fixtureDir) {
  const dir = runDir(runId);
  const run = readJson(path.join(dir, 'run.json'));
  const inst = instance();
  const target = path.resolve(fixtureDir);
  const stepsFile = fs.statSync(target).isDirectory() ? path.join(target, 'steps.json') : target;
  const base = path.dirname(stepsFile);
  const steps = readJson(stepsFile);
  fs.copyFileSync(stepsFile, path.join(dir, `fixture-${path.basename(stepsFile)}`));
  if (fs.existsSync(path.join(base, 'spec.json')))
    fs.copyFileSync(path.join(base, 'spec.json'), path.join(dir, 'spec.json'));
  for (const f of fs.readdirSync(base))
    if (f.endsWith('.html')) fs.copyFileSync(path.join(base, f), path.join(dir, `fixture-${f}`));
  const { client, close } = await mcpClient(dir);
  let failures = 0;
  try {
    for (const [i, step] of steps.entries()) {
      let objects;
      const ctx = { run, base, objects: () => objects };
      if (JSON.stringify(step.args ?? {}).includes('${shape:')) {
        objects = pageOf(await getFile(inst, run.fileId), run.pageId).objects;
      }
      let args;
      try {
        args = resolveRefs(step.args ?? {}, ctx);
      } catch (e) {
        console.log(`STEP-FAIL ${i + 1} ${step.tool}: ${e.message}`);
        failures++;
        if (!step.continueOnError) break;
        continue;
      }
      const { failed } = await callTool(client, dir, step.tool, args);
      if (failed) {
        failures++;
        if (!step.continueOnError) break;
      }
    }
  } finally {
    await close();
  }
  console.log(failures ? `PLAY FAIL (${failures} step(s))` : 'PLAY OK');
  if (failures) process.exitCode = 1;
}

async function cmdSnapshot(runId, label = 'after') {
  const dir = runDir(runId);
  const run = readJson(path.join(dir, 'run.json'));
  const file = await getFile(instance(), run.fileId);
  const out = path.join(dir, `snapshot-${label}.json`);
  writeJson(out, file);
  const page = pageOf(file, run.pageId);
  console.log(
    `SNAPSHOT ${label} revn=${file.revn} shapes=${Object.keys(page.objects).length - 1} → ${path.relative(REPO, out)}`,
  );
}

async function cmdRender(runId, shapeName, label) {
  const dir = runDir(runId);
  const run = readJson(path.join(dir, 'run.json'));
  const inst = instance();
  const objects = pageOf(await getFile(inst, run.fileId), run.pageId).objects;
  const shape = findByName(objects, shapeName);
  const cookie = await login();
  const out = path.join(dir, `render-${label ?? slug(shapeName)}.png`);
  const errors = [];
  await withBrowser(async (browser) => {
    const context = await browser.newContext({
      deviceScaleFactor: 1,
      viewport: { width: 1920, height: 1080 },
    });
    await context.addCookies([{ name: 'auth-token', value: cookie, url: BASE }]);
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    const q = new URLSearchParams({
      'file-id': run.fileId,
      'page-id': run.pageId,
      'object-id': shape.id,
      route: 'objects',
    });
    await page.goto(`${BASE}/render.html?${q}`, { waitUntil: 'networkidle' });
    const node = page.locator(`#screenshot-${shape.id}`);
    await node.waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1000);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => (document.body.style.background = 'transparent'));
    await node.screenshot({ path: out, omitBackground: true });
  });
  writeJson(out.replace(/\.png$/, '.json'), {
    shape: { id: shape.id, name: shape.name },
    renderer: 'penpot render.html',
    errors,
  });
  console.log(
    `RENDER ${shapeName} (${shape.id}) → ${path.relative(REPO, out)}${errors.length ? ` with ${errors.length} page error(s)` : ''}`,
  );
}

function slug(s) {
  return s
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function fontLinks(html) {
  const generic = new Set([
    'serif',
    'sans-serif',
    'monospace',
    'system-ui',
    'cursive',
    'fantasy',
    'inherit',
    'initial',
  ]);
  const fams = new Set();
  for (const m of html.matchAll(/font-family\s*:\s*([^;"]+)/gi)) {
    const first = m[1]
      .split(',')[0]
      .trim()
      .replace(/^['"]|['"]$/g, '');
    if (first && !generic.has(first.toLowerCase()) && !first.startsWith('var(')) fams.add(first);
  }
  return [...fams]
    .map(
      (f) =>
        `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(f).replace(/%20/g, '+')}:ital,wght@0,100..900;1,100..900&display=block">`,
    )
    .join('\n');
}

async function cmdReference(runId, htmlFile, label = 'reference') {
  const dir = runDir(runId);
  const html = fs.readFileSync(htmlFile, 'utf8');
  const baseCss = fs.readFileSync(path.join(SKILL_DIR, 'scripts/reference-base.css'), 'utf8');
  const tokensFile = path.join(path.dirname(htmlFile), 'tokens.css');
  const tokensCss = fs.existsSync(tokensFile) ? fs.readFileSync(tokensFile, 'utf8') : '';
  const out = path.join(dir, `${label}.png`);
  await withBrowser(async (browser) => {
    const page = await browser.newPage({
      deviceScaleFactor: 1,
      viewport: { width: 1920, height: 1080 },
    });
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8">${fontLinks(html)}<style>${baseCss}</style><style>${tokensCss}</style><style>body>*{position:absolute;left:0;top:0}</style></head><body>${html}</body></html>`,
      { waitUntil: 'networkidle' },
    );
    await page.evaluate(() => document.fonts.ready);
    const node = page.locator('body > *').first();
    await node.screenshot({ path: out, omitBackground: true });
  });
  console.log(`REFERENCE ${htmlFile} → ${path.relative(REPO, out)}`);
}

async function cmdCompare(runId, a, b, label = 'compare', threshold = '0.02') {
  const dir = runDir(runId);
  const pa = path.resolve(dir, a);
  const pb = path.resolve(dir, b);
  const toUrl = (p) => `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
  const out = path.join(dir, `${label}-diff.png`);
  const result = await withBrowser(async (browser) => {
    const page = await browser.newPage();
    return page.evaluate(
      async ([ua, ub]) => {
        const load = (u) =>
          new Promise((ok) => {
            const i = new Image();
            i.onload = () => ok(i);
            i.src = u;
          });
        const [ia, ib] = await Promise.all([load(ua), load(ub)]);
        const w = Math.max(ia.width, ib.width);
        const h = Math.max(ia.height, ib.height);
        const px = (img) => {
          const c = new OffscreenCanvas(w, h);
          const x = c.getContext('2d');
          x.drawImage(img, 0, 0);
          return x.getImageData(0, 0, w, h).data;
        };
        const da = px(ia);
        const db = px(ib);
        const diff = new OffscreenCanvas(w, h);
        const dx = diff.getContext('2d');
        const outData = dx.createImageData(w, h);
        let bad = 0;
        let painted = 0;
        for (let i = 0; i < da.length; i += 4) {
          const delta = Math.max(
            Math.abs(da[i] - db[i]),
            Math.abs(da[i + 1] - db[i + 1]),
            Math.abs(da[i + 2] - db[i + 2]),
            Math.abs(da[i + 3] - db[i + 3]),
          );
          if (da[i + 3] > 0 || db[i + 3] > 0) painted++;
          if (delta > 48) {
            bad++;
            outData.data.set([255, 0, 0, 255], i);
          } else {
            const g = 255 - Math.round(da[i + 3] / 4);
            outData.data.set([g, g, g, 255], i);
          }
        }
        dx.putImageData(outData, 0, 0);
        const blob = await diff.convertToBlob({ type: 'image/png' });
        const buf = new Uint8Array(await blob.arrayBuffer());
        let bin = '';
        for (const byte of buf) bin += String.fromCharCode(byte);
        return {
          a: [ia.width, ia.height],
          b: [ib.width, ib.height],
          mismatched: bad,
          painted,
          png: btoa(bin),
        };
      },
      [toUrl(pa), toUrl(pb)],
    );
  });
  fs.writeFileSync(out, Buffer.from(result.png, 'base64'));
  const ratio = result.painted ? result.mismatched / result.painted : 0;
  const sizeOk =
    Math.abs(result.a[0] - result.b[0]) <= 1 && Math.abs(result.a[1] - result.b[1]) <= 1;
  const pass = sizeOk && ratio <= Number(threshold);
  const summary = {
    a,
    b,
    sizeA: result.a,
    sizeB: result.b,
    sizeOk,
    mismatchRatio: Number(ratio.toFixed(4)),
    threshold: Number(threshold),
    pass,
    diff: path.basename(out),
  };
  writeJson(path.join(dir, `${label}.json`), summary);
  console.log(
    `${pass ? 'COMPARE PASS' : 'COMPARE FAIL'} size ${result.a.join('x')} vs ${result.b.join('x')}, mismatch ${(ratio * 100).toFixed(2)}% (limit ${(Number(threshold) * 100).toFixed(1)}%) → ${path.relative(REPO, out)}`,
  );
  if (!pass) process.exitCode = 1;
}

async function cmdEditor(runId) {
  const dir = runDir(runId);
  const run = readJson(path.join(dir, 'run.json'));
  const cookie = await login();
  const out = path.join(dir, 'editor.png');
  const errors = [];
  const consoleErrors = [];
  let errorScreen = null;
  await withBrowser(async (browser) => {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    await context.addCookies([{ name: 'auth-token', value: cookie, url: BASE }]);
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
    await page.goto(
      `${BASE}/#/workspace?team-id=${run.teamId}&file-id=${run.fileId}&page-id=${run.pageId}`,
      { waitUntil: 'networkidle' },
    );
    await page.waitForTimeout(8000);
    const body = await page.locator('body').innerText();
    errorScreen =
      /Internal error|Something wrong has happened|Unexpected error|not found/i.exec(body)?.[0] ??
      null;
    await page.screenshot({ path: out });
  });
  const pass = !errorScreen && errors.length === 0;
  writeJson(path.join(dir, 'editor.json'), {
    pass,
    errorScreen,
    pageErrors: errors,
    consoleErrors,
  });
  console.log(
    `${pass ? 'EDITOR PASS' : 'EDITOR FAIL'} ${errorScreen ? `error screen "${errorScreen}" ` : ''}${errors.length} page error(s), ${consoleErrors.length} console error(s) → ${path.relative(REPO, out)}`,
  );
  if (!pass) process.exitCode = 1;
}

// ---------------------------------------------------------------- audit

const TAG_NAMES = new Set([
  'div',
  'span',
  'p',
  'section',
  'article',
  'header',
  'footer',
  'main',
  'nav',
  'img',
  'button',
  'a',
  'ul',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'svg',
  'text',
  'label',
  'input',
]);

function canon(v) {
  const norm = (x) => {
    if (typeof x === 'string') return /^#[0-9a-f]{3,8}$/i.test(x) ? x.toLowerCase() : x;
    if (Array.isArray(x)) return x.map(norm);
    if (x && typeof x === 'object')
      return Object.fromEntries(
        Object.keys(x)
          .sort()
          .map((k) => [k, norm(x[k])]),
      );
    return x;
  };
  return JSON.stringify(norm(v));
}

// tokensLib travels as DTCG JSON: set names at the top level, nested groups,
// leaves with $value/$type, plus $themes and $metadata.
function readTokensLib(lib) {
  const sets = [];
  const tokens = {};
  for (const [setName, body] of Object.entries(lib ?? {})) {
    if (setName.startsWith('$')) continue;
    sets.push(setName);
    const walk = (node, prefix) => {
      for (const [k, v] of Object.entries(node ?? {})) {
        if (!v || typeof v !== 'object') continue;
        const name = prefix ? `${prefix}.${k}` : k;
        if ('$value' in v) tokens[name] = { set: setName, type: v.$type, value: v.$value };
        else walk(v, name);
      }
    };
    walk(body, '');
  }
  const themes = (lib?.$themes ?? []).map((t) => (t.group ? `${t.group}/${t.name}` : t.name));
  return { sets, tokens, themes };
}

function isIdentity(t) {
  return !t || (t.a === 1 && t.b === 0 && t.c === 0 && t.d === 1);
}

async function cmdAudit(runId, specArg, label = 'after') {
  const dir = runDir(runId);
  const run = readJson(path.join(dir, 'run.json'));
  const spec = readJson(specArg ?? path.join(dir, 'spec.json'));
  const snapFile = path.join(dir, `snapshot-${label}.json`);
  if (!fs.existsSync(snapFile))
    die(`missing ${snapFile}; run \`ppv snapshot ${runId} ${label}\` first`);
  const file = readJson(snapFile);
  const page = pageOf(file, run.pageId);
  const objects = page.objects;
  const checks = [];
  const check = (id, pass, detail) => checks.push({ id, pass: !!pass, detail });

  let root;
  try {
    root = findByName(objects, spec.root);
    check('root.exists', true, `${root.type} ${root.id}`);
  } catch (e) {
    check('root.exists', false, e.message);
  }
  const tree = root ? subtree(objects, root.id) : [];
  const g = spec.generic ?? {};

  if (root && g.rootOnTop !== false) {
    const parent = objects[root.parentId];
    const top = parent?.shapes?.at(-1);
    check(
      'generic.root-on-top',
      top === root.id,
      top === root.id
        ? 'root is the top layer of its parent'
        : `top layer is ${objects[top]?.name ?? top}`,
    );
  }
  if (root && g.layerNames !== false) {
    const bad = tree.filter((s) => TAG_NAMES.has(String(s.name)));
    check(
      'generic.layer-names',
      bad.length === 0,
      bad.length
        ? `${bad.length} layer(s) named after HTML tags: ${[...new Set(bad.map((s) => s.name))].join(', ')}`
        : 'every layer has a design name',
    );
  }
  if (root && g.fonts !== false) {
    const leaves = tree
      .filter((s) => s.type === 'text')
      .flatMap((s) => textLeaves(s.content).map((l) => ({ s, l })));
    const bad = leaves.filter(({ l }) => !l.fontId || !l.fontVariantId);
    check(
      'generic.fonts-resolved',
      leaves.length > 0 && bad.length === 0,
      leaves.length === 0
        ? 'no text leaves found'
        : bad.length
          ? `${bad.length}/${leaves.length} text leaves lack fontId/fontVariantId (e.g. "${bad[0].s.name}": family ${bad[0].l.fontFamily}, fontId ${bad[0].l.fontId ?? 'none'})`
          : `${leaves.length} leaves resolved`,
    );
  }
  if (root && g.rotation !== false) {
    const rotated = tree.filter((s) => s.rotation && Math.abs(s.rotation % 360) > 0.01);
    const bad = rotated.filter((s) => isIdentity(s.transform));
    check(
      'generic.rotation-transform',
      bad.length === 0,
      rotated.length === 0
        ? 'no rotated shapes'
        : bad.length
          ? `${bad.length}/${rotated.length} rotated shapes keep an identity transform: ${bad.map((s) => s.name).join(', ')}`
          : `${rotated.length} rotated shapes carry a matching transform`,
    );
  }
  if (root && g.positionData !== false) {
    const texts = tree.filter((s) => s.type === 'text');
    const missing = texts.filter((s) => !s.positionData || s.positionData.length === 0);
    check(
      'generic.text-position-data',
      missing.length === 0,
      missing.length
        ? `${missing.length}/${texts.length} texts have no position-data until someone opens the page`
        : `${texts.length} texts complete`,
    );
  }

  for (const exp of spec.layers ?? []) {
    let s;
    try {
      s = findByName(objects, exp.name);
    } catch (e) {
      check(`layer.${exp.name}`, false, e.message);
      continue;
    }
    for (const [attr, want] of Object.entries(exp.attrs ?? {})) {
      const got = s[attr];
      const ok = canon(got) === canon(want);
      check(
        `layer.${exp.name}.${attr}`,
        ok,
        ok
          ? `= ${JSON.stringify(want)}`
          : `expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`,
      );
    }
    if (exp.text) {
      const leaves = textLeaves(s.content);
      for (const [attr, want] of Object.entries(exp.text)) {
        const vals = [...new Set(leaves.map((l) => l[attr]))];
        const ok = vals.length > 0 && vals.every((v) => String(v) === String(want));
        check(
          `layer.${exp.name}.text.${attr}`,
          ok,
          ok ? `= ${want}` : `expected ${want}, got ${JSON.stringify(vals)}`,
        );
      }
    }
    if (exp.content !== undefined) {
      const got = textLeaves(s.content)
        .map((l) => l.text)
        .join('');
      check(
        `layer.${exp.name}.content`,
        got === exp.content,
        `expected ${JSON.stringify(exp.content)}, got ${JSON.stringify(got)}`,
      );
    }
    if (exp.rotation !== undefined) {
      const norm = (d) => ((Number(d) % 360) + 360) % 360;
      const got = norm(s.rotation ?? 0);
      const ok = Math.abs(got - norm(exp.rotation)) < 0.5 && !isIdentity(s.transform);
      check(
        `layer.${exp.name}.rotation`,
        ok,
        `expected ${norm(exp.rotation)}° with a rotated transform, got ${got}° and transform ${JSON.stringify(s.transform)}`,
      );
    }
    if (exp.fill) {
      const got = s.fills?.[0]?.fillColor?.toLowerCase();
      check(
        `layer.${exp.name}.fill`,
        got === exp.fill.toLowerCase(),
        `expected ${exp.fill}, got ${got ?? 'none'}`,
      );
    }
  }

  const {
    sets: setNames,
    tokens: allTokens,
    themes: themeNames,
  } = readTokensLib(file.data?.tokensLib);
  const t = spec.tokens ?? {};
  for (const name of t.sets ?? [])
    check(
      `tokens.set.${name}`,
      setNames.includes(name),
      setNames.includes(name) ? 'present' : `missing; sets: ${JSON.stringify(setNames)}`,
    );
  for (const name of t.themes ?? []) {
    check(
      `tokens.theme.${name}`,
      themeNames.includes(name),
      themeNames.includes(name) ? 'present' : `missing; themes: ${JSON.stringify(themeNames)}`,
    );
  }
  for (const tok of t.tokens ?? []) {
    const got = allTokens[tok.name];
    const ok =
      got &&
      (!tok.type || got.type === tok.type) &&
      (tok.value === undefined || String(got.value) === String(tok.value));
    check(
      `tokens.token.${tok.name}`,
      ok,
      got ? `type ${got.type}, value ${JSON.stringify(got.value)}` : 'missing',
    );
  }
  for (const ap of t.applied ?? []) {
    let s;
    try {
      s = findByName(objects, ap.layer);
    } catch (e) {
      check(`tokens.applied.${ap.layer}.${ap.attr}`, false, e.message);
      continue;
    }
    const got = s.appliedTokens?.[ap.attr];
    check(
      `tokens.applied.${ap.layer}.${ap.attr}`,
      got === ap.token,
      got === ap.token
        ? ap.token
        : `expected ${ap.token}, got ${got ?? 'none'} (applied: ${JSON.stringify(s.appliedTokens ?? {})})`,
    );
    if (ap.resolved !== undefined) {
      const val =
        ap.attr === 'fill'
          ? s.fills?.[0]?.fillColor
          : ap.attr === 'stroke-color'
            ? s.strokes?.[0]?.strokeColor
            : s[ap.attr];
      check(
        `tokens.resolved.${ap.layer}.${ap.attr}`,
        String(val).toLowerCase() === String(ap.resolved).toLowerCase(),
        `shape value ${val}, token value ${ap.resolved}`,
      );
    }
  }

  const comps = Object.values(file.data?.components ?? {}).filter((c) => !c.deleted);
  const c = spec.components ?? {};
  for (const want of c.defined ?? []) {
    const comp = comps.find(
      (x) => x.name === want.name || `${x.path ? x.path + ' / ' : ''}${x.name}` === want.name,
    );
    check(
      `components.defined.${want.name}`,
      comp,
      comp
        ? `component ${comp.id}`
        : `missing; components: ${JSON.stringify(comps.map((x) => x.name))}`,
    );
    if (comp && want.variants) {
      const siblings = comps.filter((x) => x.variantId && x.variantId === comp.variantId);
      check(
        `components.variants.${want.name}`,
        siblings.length >= want.variants,
        `${siblings.length} variant(s), expected ≥ ${want.variants}`,
      );
    }
  }
  for (const inst of c.instances ?? []) {
    let s;
    try {
      s = findByName(objects, inst.layer);
    } catch (e) {
      check(`components.instance.${inst.layer}`, false, e.message);
      continue;
    }
    const comp = comps.find((x) => x.id === s.componentId);
    const ok =
      s.componentId &&
      !s.mainInstance &&
      comp &&
      (comp.name === inst.component || comp.path?.endsWith(inst.component));
    check(
      `components.instance.${inst.layer}`,
      ok,
      s.componentId
        ? `instance of ${comp?.name ?? s.componentId}${s.mainInstance ? ' (main, not a copy)' : ''}`
        : 'plain shape, not a component copy',
    );
  }

  const typos = Object.values(file.data?.typographies ?? {});
  for (const want of spec.typographies ?? []) {
    const ty = typos.find(
      (x) => x.name === want.name || `${x.path ? x.path + ' / ' : ''}${x.name}` === want.name,
    );
    check(`typographies.defined.${want.name}`, ty, ty ? `typography ${ty.id}` : 'missing');
    for (const layer of want.usedBy ?? []) {
      let s;
      try {
        s = findByName(objects, layer);
      } catch (e) {
        check(`typographies.used.${want.name}.${layer}`, false, e.message);
        continue;
      }
      const refs = textLeaves(s.content).map((l) => l.typographyRefId);
      const ok = ty && refs.length > 0 && refs.every((r) => r === ty.id);
      check(
        `typographies.used.${want.name}.${layer}`,
        ok,
        ok ? 'linked' : `typographyRefId: ${JSON.stringify([...new Set(refs)])}`,
      );
    }
  }
  const colors = Object.values(file.data?.colors ?? {});
  for (const want of spec.colors ?? []) {
    const col = colors.find(
      (x) => x.name === want.name || `${x.path ? x.path + ' / ' : ''}${x.name}` === want.name,
    );
    check(`colors.defined.${want.name}`, col, col ? `color ${col.color}` : 'missing');
  }

  if (spec.preserve) {
    const beforeFile = path.join(dir, `snapshot-${spec.preserve.from ?? 'before'}.json`);
    if (!fs.existsSync(beforeFile))
      check('preserve.snapshot', false, `missing ${path.basename(beforeFile)}`);
    else {
      const before = readJson(beforeFile);
      const bObj = pageOf(before, run.pageId).objects;
      const allowed = new Set(spec.preserve.allowDeleted ?? []);
      const lost = Object.values(bObj).filter((s) => !objects[s.id] && !allowed.has(s.name));
      check(
        'preserve.shapes',
        lost.length === 0,
        lost.length
          ? `${lost.length} shape(s) disappeared: ${lost
              .slice(0, 8)
              .map((s) => s.name)
              .join(', ')}`
          : `${Object.keys(bObj).length} earlier shapes kept`,
      );
      for (const name of spec.preserve.sameId ?? []) {
        const bIds = Object.values(bObj)
          .filter((x) => x.name === name)
          .map((x) => x.id);
        const aIds = new Set(
          Object.values(objects)
            .filter((x) => x.name === name)
            .map((x) => x.id),
        );
        const kept = bIds.length > 0 && bIds.every((id) => aIds.has(id));
        check(
          `preserve.same-id.${name}`,
          kept,
          bIds.length === 0
            ? 'layer missing before'
            : kept
              ? `${bIds.length} id(s) unchanged`
              : `ids before ${bIds.join(', ')}; after ${[...aIds].join(', ') || 'none'}`,
        );
      }
      const lostApplied = [];
      for (const bs of Object.values(bObj)) {
        const as = objects[bs.id];
        if (!as) continue;
        for (const k of Object.keys(bs.appliedTokens ?? {}))
          if (!(k in (as.appliedTokens ?? {}))) lostApplied.push(`${bs.name}.${k}`);
      }
      check(
        'preserve.applied-tokens',
        lostApplied.length === 0,
        lostApplied.length
          ? `applied tokens dropped: ${lostApplied.slice(0, 10).join(', ')}`
          : 'no applied token dropped on kept shapes',
      );
      const b = readTokensLib(before.data?.tokensLib);
      const lostSets = b.sets.filter((x) => !setNames.includes(x));
      check(
        'preserve.token-sets',
        lostSets.length === 0,
        lostSets.length
          ? `lost sets: ${lostSets.join(', ')}`
          : `${b.sets.length} earlier sets kept`,
      );
      const lostTokens = Object.keys(b.tokens).filter((x) => !allTokens[x]);
      check(
        'preserve.tokens',
        lostTokens.length === 0,
        lostTokens.length
          ? `lost tokens: ${lostTokens.slice(0, 8).join(', ')}`
          : `${Object.keys(b.tokens).length} earlier tokens kept`,
      );
      const lostThemes = b.themes.filter((x) => !themeNames.includes(x));
      check(
        'preserve.token-themes',
        lostThemes.length === 0,
        lostThemes.length
          ? `lost themes: ${lostThemes.join(', ')}`
          : `${b.themes.length} earlier themes kept`,
      );
      const bComps = Object.keys(before.data?.components ?? {});
      const lostComps = bComps.filter(
        (id) => !file.data?.components?.[id] || file.data.components[id].deleted,
      );
      check(
        'preserve.components',
        lostComps.length === 0,
        lostComps.length
          ? `${lostComps.length} component(s) lost`
          : `${bComps.length} earlier components kept`,
      );
    }
  }

  for (const f of spec.visual ?? []) {
    const cmp = path.join(dir, `${f}.json`);
    if (!fs.existsSync(cmp)) check(`visual.${f}`, false, `missing ${f}.json; run \`ppv compare\``);
    else {
      const r = readJson(cmp);
      check(
        `visual.${f}`,
        r.pass,
        `mismatch ${(r.mismatchRatio * 100).toFixed(2)}%, size ${r.sizeA.join('x')} vs ${r.sizeB.join('x')}`,
      );
    }
  }
  if (spec.editor !== false) {
    const ed = path.join(dir, 'editor.json');
    if (!fs.existsSync(ed)) check('editor.opens', false, 'missing editor.json; run `ppv editor`');
    else {
      const r = readJson(ed);
      check(
        'editor.opens',
        r.pass,
        r.pass
          ? 'opens without errors'
          : `${r.errorScreen ?? ''} ${r.pageErrors.length} page error(s)`,
      );
    }
  }

  const failed = checks.filter((x) => !x.pass);
  writeJson(path.join(dir, `audit-${label}.json`), {
    runId,
    spec: spec.name,
    snapshot: path.basename(snapFile),
    pass: failed.length === 0,
    checks,
  });
  const lines = [
    `# Audit ${spec.name ?? ''} — ${runId}`,
    '',
    `Snapshot: \`${path.basename(snapFile)}\` · ${checks.length - failed.length}/${checks.length} checks pass`,
    '',
    '| Check | Result | Detail |',
    '|---|---|---|',
  ];
  for (const x of checks)
    lines.push(
      `| \`${x.id}\` | ${x.pass ? 'PASS' : '**FAIL**'} | ${String(x.detail ?? '')
        .replace(/\|/g, '\\|')
        .replace(/\n/g, ' ')} |`,
    );
  fs.writeFileSync(path.join(dir, `audit-${label}.md`), lines.join('\n') + '\n');
  for (const x of checks) console.log(`${x.pass ? 'PASS' : 'FAIL'} ${x.id} — ${x.detail}`);
  console.log(
    `${failed.length ? 'AUDIT FAIL' : 'AUDIT PASS'} ${checks.length - failed.length}/${checks.length} → ${path.relative(REPO, path.join(dir, `audit-${label}.md`))}`,
  );
  if (failed.length) process.exitCode = 1;
}

async function cmdCleanRun(runId) {
  const dir = runDir(runId);
  const run = readJson(path.join(dir, 'run.json'));
  await rpc('delete-project', { id: run.projectId }, { token: instance().token });
  for (const f of ['mcp-state.json', '.seq']) fs.rmSync(path.join(dir, f), { force: true });
  console.log(
    `CLEANED run ${runId} (project deleted; evidence kept in ${path.relative(REPO, dir)})`,
  );
}

function cmdDown(flag) {
  const args = ['down'];
  if (flag === '--destroy') args.push('-v');
  const r = compose(args, { stdio: 'inherit' });
  if (r.status !== 0) die('docker compose down failed');
  if (flag === '--destroy') fs.rmSync(INSTANCE_FILE, { force: true });
  console.log(
    flag === '--destroy'
      ? `DOWN (volumes ${PROJECT}_* removed; evidence kept in ${path.relative(REPO, VERIFY_DIR)})`
      : 'DOWN (volumes kept; `ppv up` resumes)',
  );
}

function cmdLogs(service = 'penpot-backend') {
  compose(['logs', '--tail', '80', service], { stdio: 'inherit' });
}

const [cmd, ...rest] = process.argv.slice(2);
const table = {
  up: cmdUp,
  doctor: cmdDoctor,
  'new-run': cmdNewRun,
  mcp: cmdMcp,
  play: cmdPlay,
  snapshot: cmdSnapshot,
  render: cmdRender,
  reference: cmdReference,
  compare: cmdCompare,
  editor: cmdEditor,
  audit: cmdAudit,
  'clean-run': cmdCleanRun,
  down: cmdDown,
  logs: cmdLogs,
};
if (!table[cmd]) {
  console.error(
    'usage: ppv <up|doctor|new-run|mcp|play|snapshot|render|reference|compare|editor|audit|clean-run|down|logs> ...',
  );
  process.exit(2);
}
try {
  await table[cmd](...rest);
} catch (e) {
  die(e.stack ?? String(e));
}
// The MCP SDK stdio transport can keep the event loop alive after close.
process.exit(process.exitCode ?? 0);
