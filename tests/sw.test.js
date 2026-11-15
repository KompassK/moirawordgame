// Service-worker tests (Node). Runs the generated sw.js in a sandbox with a
// fake Cache Storage, network and event objects, as if on GitHub Pages under
// /moirawordgame/. Run with `npm test` (after `npm run build`).

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { SHELL } = require('../scripts/shell');

const ROOT = path.join(__dirname, '..');
const SCOPE = 'https://kompassk.github.io/moirawordgame/';
const ORIGIN = 'https://kompassk.github.io';

// --- fakes --------------------------------------------------------------------

class FakeCache {
  constructor() { this.entries = new Map(); }           // url → Response, oldest first
  key(r, opts = {}) { const u = typeof r === 'string' ? r : r.url; return opts.ignoreSearch ? u.split('?')[0] : u; }
  async match(r, opts) {
    const k = this.key(r, opts);
    for (const [u, res] of this.entries) if ((opts && opts.ignoreSearch ? u.split('?')[0] : u) === k) return res.clone();
    return undefined;
  }
  async put(r, res) { const k = this.key(r); this.entries.delete(k); this.entries.set(k, res.clone()); }
  async delete(r) { return this.entries.delete(this.key(r)); }
  async keys() { return [...this.entries.keys()].map(url => ({ url })); }
  async addAll(requests) { for (const r of requests) this.put(r, await sandbox.fetch(r)); }
}

let sandbox, network, handlers, skipped;

function load() {
  network = { offline: false, files: new Map(), fetched: [] };
  handlers = {};
  skipped = false;
  const caches = {
    stores: new Map(),
    async open(name) { if (!this.stores.has(name)) this.stores.set(name, new FakeCache()); return this.stores.get(name); },
    async keys() { return [...this.stores.keys()]; },
    async delete(name) { return this.stores.delete(name); },
  };
  sandbox = {
    console, URL, Request, Response, MessageChannel, setTimeout,
    caches,
    fetch: async r => {
      const url = typeof r === 'string' ? r : r.url;
      network.fetched.push({ url, cache: typeof r === 'string' ? 'default' : r.cache });
      if (network.offline) throw new TypeError('Failed to fetch');
      return network.files.has(url) ? new Response(network.files.get(url), { status: 200 }) : new Response('not found', { status: 404 });
    },
  };
  sandbox.self = {
    registration: { scope: SCOPE },
    location: { origin: ORIGIN },
    clients: { claim: async () => {} },
    skipWaiting: () => { skipped = true; },
    addEventListener: (type, fn) => { handlers[type] = fn; },
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), sandbox);
  // Every shell file is on the network.
  SHELL.forEach(f => network.files.set(SCOPE + f, `contents of ${f}`));
  return sandbox;
}

function extendable() {
  const waits = [];
  return { waits, waitUntil: p => waits.push(p), done: () => Promise.all(waits) };
}

async function install() { const e = extendable(); handlers.install(e); await e.done(); }
async function activate() { const e = extendable(); handlers.activate(e); await e.done(); }

// Dispatch a fetch; resolves to the Response (or undefined if the worker let it through).
async function request(url, mode = 'no-cors') {
  const e = extendable();
  let responded;
  e.request = { url, method: 'GET', mode };
  e.respondWith = p => { responded = p; };
  handlers.fetch(e);
  const res = responded && await responded;
  await e.done();
  return res;
}

const shellCacheName = () => [...sandbox.caches.stores.keys()].find(k => k.startsWith('sesquipedalian-shell-'));
const stillsCache = () => sandbox.caches.stores.get('sesquipedalian-stills');

// --- tests --------------------------------------------------------------------

const results = [];
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('sw.js carries this build’s version and exactly the shell list from scripts/shell.js', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const version = JSON.parse(src.match(/const VERSION = (\{.*\});/)[1]);
  const built = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.js'), 'utf8').match(/MOIRA_VERSION = (\{.*\});/)[1]);
  assert.deepStrictEqual(version, built, 'same version as version.js');
  const shell = JSON.parse(src.match(/const SHELL = (\[[\s\S]*?\]);/)[1]);
  assert.deepStrictEqual(shell, SHELL);
});

test('Install precaches every shell file, under the scope (not the site root), bypassing the HTTP cache', async () => {
  load();
  await install();
  const cache = sandbox.caches.stores.get(shellCacheName());
  const urls = [...cache.entries.keys()];
  assert.deepStrictEqual(urls.sort(), SHELL.map(f => SCOPE + f).sort());
  assert.ok(urls.every(u => u.startsWith(SCOPE)), 'all under /moirawordgame/');
  assert.ok(network.fetched.length === SHELL.length && network.fetched.every(f => f.cache === 'reload'), 'every shell fetch bypasses the HTTP cache');
  assert.strictEqual(skipped, false, 'a new worker waits: no skipWaiting on install');
});

test('Offline: the shell is served from the cache', async () => {
  load(); await install(); await activate();
  network.offline = true;
  for (const f of ['game.js', 'style.css', 'version.js', 'assets/fonts/josefin-sans-latin.woff2', 'assets/placeholder.svg']) {
    const res = await request(SCOPE + f);
    assert.ok(res && res.ok, `${f} served offline`);
    assert.strictEqual(await res.text(), `contents of ${f}`);
  }
  const page = await request(SCOPE, 'navigate');
  assert.strictEqual(await page.text(), 'contents of index.html', 'the page itself, offline');
});

test('A stale deep link inside the scope is redirected to the game', async () => {
  load(); await install(); await activate();
  const res = await request(SCOPE + 'some/old/link', 'navigate');
  assert.strictEqual(res.status, 302);
  assert.strictEqual(res.headers.get('location'), SCOPE);
});

test('Stills: cached on first use, served from the cache offline', async () => {
  load(); await install(); await activate();
  const still = SCOPE + 'assets/stills/test-16x9.jpg';
  network.files.set(still, 'jpeg bytes');
  assert.strictEqual(await (await request(still)).text(), 'jpeg bytes');
  network.offline = true;
  const again = await request(still);
  assert.ok(again.ok, 'served offline');
  assert.strictEqual(await again.text(), 'jpeg bytes');
});

test('Stills: not cached and offline → a network error (the page shows the placeholder); nothing cached', async () => {
  load(); await install(); await activate();
  network.offline = true;
  const res = await request(SCOPE + 'assets/stills/never-seen.jpg');
  assert.strictEqual(res.type, 'error');
  assert.strictEqual(stillsCache() ? stillsCache().entries.size : 0, 0);
});

test('Stills: a missing file (404) is passed through and not cached', async () => {
  load(); await install(); await activate();
  const res = await request(SCOPE + 'assets/stills/missing.jpg');
  assert.strictEqual(res.status, 404);
  assert.strictEqual(stillsCache().entries.size, 0);
});

test('Stills cache cap: only the 60 most recently used are kept', async () => {
  load(); await install(); await activate();
  const url = i => `${SCOPE}assets/stills/s${i}.jpg`;
  for (let i = 1; i <= 65; i++) { network.files.set(url(i), `still ${i}`); await request(url(i)); }
  let kept = [...stillsCache().entries.keys()];
  assert.strictEqual(kept.length, 60, '60 kept');
  assert.ok(!kept.includes(url(1)) && !kept.includes(url(5)) && kept.includes(url(6)) && kept.includes(url(65)), 'the oldest 5 dropped');
  // Using still 6 makes it recent, so the next new still pushes out 7 instead.
  await request(url(6));
  network.files.set(url(66), 'still 66'); await request(url(66));
  kept = [...stillsCache().entries.keys()];
  assert.strictEqual(kept.length, 60);
  assert.ok(kept.includes(url(6)) && !kept.includes(url(7)), 'least recently used goes first');
});

test('Activate deletes older shell caches but keeps the stills cache', async () => {
  load();
  await sandbox.caches.open('sesquipedalian-shell-old-version');
  await sandbox.caches.open('sesquipedalian-stills');
  await install(); await activate();
  const names = [...sandbox.caches.stores.keys()];
  assert.ok(!names.includes('sesquipedalian-shell-old-version'), 'old shell gone');
  assert.ok(names.includes('sesquipedalian-stills'), 'stills kept');
  assert.ok(names.includes(shellCacheName()), 'new shell present');
});

test('Messages: SKIP_WAITING activates the waiting worker; GET_VERSION answers with the version', async () => {
  load();
  handlers.message({ data: { type: 'SKIP_WAITING' }, ports: [] });
  assert.strictEqual(skipped, true);
  const answer = await new Promise(resolve => handlers.message({ data: { type: 'GET_VERSION' }, ports: [{ postMessage: resolve }] }));
  assert.ok(answer.commit && answer.builtAt, 'version object');
});

test('Requests outside the scope or to other sites are left alone', async () => {
  load(); await install();
  assert.strictEqual(await request('https://kompassk.github.io/other-repo/game.js'), undefined);
  assert.strictEqual(await request('https://example.com/x.js'), undefined);
});

(async () => {
  for (const { name, fn } of tests) {
    try { await fn(); results.push(`PASS ${name}`); }
    catch (e) { results.push(`FAIL ${name}\n      ${e.message}`); }
  }
  results.forEach(r => console.log(r));
  const failed = results.filter(r => r.startsWith('FAIL')).length;
  console.log(`${results.length - failed} of ${results.length} service-worker tests passed`);
  process.exit(failed ? 1 : 0);
})();
