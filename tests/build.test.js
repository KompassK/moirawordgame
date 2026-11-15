// Build-script tests (Node). Run with `npm test`. The game's own tests run in
// the browser: open tests/index.html.

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { checkStills, stillsWarnings } = require('../scripts/check-stills');

const results = [];
function test(name, fn) {
  try { fn(); results.push(`PASS ${name}`); }
  catch (e) { results.push(`FAIL ${name}\n      ${e.message}`); }
}

// A throwaway stills folder.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stills-'));
['present.jpg', 'also.webp', 'shot.png'].forEach(f => fs.writeFileSync(path.join(dir, f), ''));

test('Build warning: a missing still is listed (by name, once), present ones are not', () => {
  const words = [
    { imageFile: 'present.jpg' }, { imageFile: 'missing.jpg' }, { imageFile: 'missing.jpg' },
    { imageFile: 'also.webp' }, { imageFile: null },
  ];
  const r = checkStills(words, dir);
  assert.deepStrictEqual(r.missing, ['missing.jpg']);
  const lines = stillsWarnings(r);
  assert.strictEqual(lines.length, 1);
  assert.match(lines[0], /^Warning: 1 image file\(s\) not found in assets\/stills\/ \(the game will show the placeholder\): missing\.jpg$/);
});

test('Build warning: jpg, jpeg, png and webp are accepted; anything else is flagged', () => {
  const r = checkStills([{ imageFile: 'shot.png' }, { imageFile: 'a.JPEG' }, { imageFile: 'b.gif' }, { imageFile: 'c.heic' }], dir);
  assert.deepStrictEqual(r.unsupported, ['b.gif', 'c.heic']);
  assert.ok(stillsWarnings(r).some(l => l.startsWith('Warning: 2 image file(s) not in an accepted format')));
});

test('Build warning: nothing to say when every still is there', () => {
  assert.deepStrictEqual(stillsWarnings(checkStills([{ imageFile: 'present.jpg' }, { imageFile: null }], dir)), []);
});

test('Real data: the four test stills are found; the other dummy words are the only missing ones', () => {
  const root = path.join(__dirname, '..');
  const { words } = JSON.parse(fs.readFileSync(path.join(root, 'words.json'), 'utf8'));
  const r = checkStills(words, path.join(root, 'assets', 'stills'));
  const fixtures = ['test-16x9.jpg', 'test-4x3.png', 'test-1x1.webp', 'test-3x4.png'];
  fixtures.forEach(f => assert.ok(!r.missing.includes(f), `${f} should be found`));
  assert.ok(r.missing.every(f => f.startsWith('dummy_')), 'only dummy_*.jpg names missing');
  assert.deepStrictEqual(r.unsupported, []);
});

// --- the service worker's precache list (step 6) ------------------------------

const { SHELL, loadedFiles, shellProblems } = require('../scripts/shell');
const root = path.join(__dirname, '..');

test('Precache list matches the files the page actually loads (nothing missing, nothing that doesn’t exist)', () => {
  const problems = shellProblems(root);
  assert.deepStrictEqual(problems, { notListed: [], missingOnDisk: [] });
  const loaded = loadedFiles(root);
  ['version.js', 'words.js', 'storage.js', 'pwa.js', 'game.js', 'style.css', 'manifest.webmanifest',
    'assets/fonts/josefin-sans-latin.woff2', 'assets/placeholder.svg', 'assets/icons/icon-192.png']
    .forEach(f => assert.ok(loaded.includes(f), `the page should be found to load ${f}`));
  assert.ok(!loaded.includes('sw.js'), 'the worker itself is never precached');
  assert.ok(SHELL.includes('index.html'), 'the page itself is precached');
});

test('Precache check: a shell file left off the list is reported (the build then fails)', () => {
  const problems = shellProblems(root, SHELL.filter(f => f !== 'version.js' && f !== 'assets/icons/favicon.ico'));
  assert.deepStrictEqual(problems.notListed.sort(), ['assets/icons/favicon.ico', 'version.js']);
});

test('Precache check: a listed file that doesn’t exist is reported', () => {
  assert.deepStrictEqual(shellProblems(root, [...SHELL, 'assets/nope.png']).missingOnDisk, ['assets/nope.png']);
});

test('Precache check: the build stops with a clear message when the list is incomplete', () => {
  // Run the real build against a copy of the project whose list lacks pwa.js.
  const { execFileSync } = require('child_process');
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'sesq-'));
  try {
    for (const f of ['index.html', 'style.css', 'manifest.webmanifest', 'game.js', 'storage.js', 'pwa.js', 'version.js', 'words.js', 'package.json']) {
      fs.copyFileSync(path.join(root, f), path.join(copy, f));
    }
    fs.cpSync(path.join(root, 'assets'), path.join(copy, 'assets'), { recursive: true });
    fs.cpSync(path.join(root, 'data', 'dummy'), path.join(copy, 'data', 'dummy'), { recursive: true });
    fs.cpSync(path.join(root, 'scripts'), path.join(copy, 'scripts'), { recursive: true });
    fs.symlinkSync(path.join(root, 'node_modules'), path.join(copy, 'node_modules'), 'junction');
    const shellFile = path.join(copy, 'scripts', 'shell.js');
    fs.writeFileSync(shellFile, fs.readFileSync(shellFile, 'utf8').replace("  'pwa.js',\n", ''));
    let failedWith = null;
    try { execFileSync(process.execPath, [path.join(copy, 'scripts', 'build-words.js')], { cwd: copy, stdio: 'pipe' }); }
    catch (e) { failedWith = e.stderr.toString(); }
    assert.ok(failedWith, 'the build failed');
    assert.match(failedWith, /The page loads pwa\.js, but it isn't in the precache list/);
    assert.ok(!fs.existsSync(path.join(copy, 'sw.js')), 'no sw.js written');
  } finally {
    fs.rmSync(copy, { recursive: true, force: true });
  }
});

fs.rmSync(dir, { recursive: true, force: true });
results.forEach(r => console.log(r));
const failed = results.filter(r => r.startsWith('FAIL')).length;
console.log(`${results.length - failed} of ${results.length} build tests passed`);
process.exit(failed ? 1 : 0);
