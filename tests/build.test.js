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

test('Build warning: a missing still is reported by word ID, never by filename (filenames can contain the word)', () => {
  const words = [
    { id: 1, imageFile: 'present.jpg' }, { id: 7, imageFile: 'missing.jpg' }, { id: 3, imageFile: 'missing.jpg' },
    { id: 4, imageFile: 'also.webp' }, { id: 5, imageFile: null },
  ];
  const r = checkStills(words, dir);
  assert.deepStrictEqual(r.missing, [{ file: 'missing.jpg', ids: [7, 3] }]);
  const lines = stillsWarnings(r);
  assert.strictEqual(lines.length, 1);
  assert.strictEqual(lines[0], 'Warning: 1 image file(s) not found in assets/stills/ (the game will show the placeholder), for IDs 3, 7');
  assert.ok(!lines[0].includes('missing.jpg'), 'no filename in the warning');
});

test('Build warning: jpg, jpeg, png and webp are accepted; anything else is flagged (by ID)', () => {
  const r = checkStills([{ id: 1, imageFile: 'shot.png' }, { id: 2, imageFile: 'a.JPEG' }, { id: 3, imageFile: 'b.gif' }, { id: 4, imageFile: 'c.heic' }], dir);
  assert.deepStrictEqual(r.unsupported.map(e => e.file), ['b.gif', 'c.heic']);
  assert.ok(stillsWarnings(r).some(l => l === 'Warning: 2 image file(s) not in an accepted format (.jpg, .jpeg, .png, .webp), for IDs 3, 4'));
});

test('Build warning: nothing to say when every still is there', () => {
  assert.deepStrictEqual(stillsWarnings(checkStills([{ id: 1, imageFile: 'present.jpg' }, { id: 2, imageFile: null }], dir)), []);
});

test('Real data (live): every still a live word names is in assets/stills, in an accepted format', () => {
  const root = path.join(__dirname, '..');
  const { words } = JSON.parse(fs.readFileSync(path.join(root, 'words.json'), 'utf8'));
  const r = checkStills(words, path.join(root, 'assets', 'stills'));
  assert.deepStrictEqual(r.missing.flatMap(e => e.ids), [], 'IDs whose still is missing');
  assert.deepStrictEqual(r.unsupported.flatMap(e => e.ids), [], 'IDs with an unsupported format');
});

test('Real data (dummy fixture): the four test stills are found; only the made-up dummy_*.jpg are missing', () => {
  const root = path.join(__dirname, '..');
  const { words } = JSON.parse(fs.readFileSync(path.join(root, 'tests', 'fixtures', 'dummy-words.json'), 'utf8'));
  const r = checkStills(words, path.join(root, 'assets', 'stills'));
  ['test-16x9.jpg', 'test-4x3.png', 'test-1x1.webp', 'test-3x4.png'].forEach(f => assert.ok(!r.missing.some(e => e.file === f), f + ' should be found'));
  assert.ok(r.missing.length === 32 && r.missing.every(e => e.file.startsWith('dummy_')), 'only the 32 dummy_*.jpg');
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
    // The build reads the first .xlsx in data/: give the copy the dummy one (never the live one).
    fs.mkdirSync(path.join(copy, 'data'));
    fs.copyFileSync(path.join(root, 'data', 'dummy', 'Moira words database - DUMMY TEST DATA.xlsx'), path.join(copy, 'data', 'dummy.xlsx'));
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
