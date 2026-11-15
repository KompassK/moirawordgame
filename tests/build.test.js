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

fs.rmSync(dir, { recursive: true, force: true });
results.forEach(r => console.log(r));
const failed = results.filter(r => r.startsWith('FAIL')).length;
console.log(`${results.length - failed} of ${results.length} build tests passed`);
process.exit(failed ? 1 : 0);
