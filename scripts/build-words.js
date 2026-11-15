#!/usr/bin/env node
// Builds words.json (and words.js) from the live spreadsheet in data/, writes
// version.js for the version stamp and sw.js for offline play.
//
//   npm run build                         the live set: first .xlsx in data/
//   npm run build -- data/dummy/<file>    the dummy set, for tests: written to
//                                         tests/fixtures/dummy-words.js(on) only
//
// The spreadsheets are not in the repo (they hold the answers); the build needs
// them present locally. Everything it prints identifies rows by ID only – never
// a word, definition or quote – so a build can be run in front of a player.
// Node is used here only; the game never needs it.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const XLSX = require('xlsx');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const DUMMY_DIR = path.join(ROOT, 'data', 'dummy');
// Each word's imageFile names a file here (step 5).
const STILLS_DIR = path.join(ROOT, 'assets', 'stills');
const { checkStills, stillsWarnings } = require('./check-stills');
const VERSION_JS = path.join(ROOT, 'version.js');
// Generated files never count as 'uncommitted changes' for the version stamp.
const GENERATED = ['words.json', 'words.js', 'version.js', 'sw.js'];
const SHEET_NAME = 'Words';

// Column header (exact) -> JSON field. Every other column is ignored,
// including the retired 'Bonus point available? (Y/N)'.
const COLUMNS = {
  'ID': 'id',
  'Word': 'word',
  'Definition (game answer)': 'definition',
  'Acceptable gist / keywords for judging': 'keywords',
  "Moira's twist (other sense / how she bends it)": 'twist',
  'Quote': 'quote',
  'Season': 'season',
  'Episode': 'episode',
  'Episode title': 'episodeTitle',
  'Scene context': 'sceneContext',
  'Image file': 'imageFile',
  'Quote printed on photo? (Y/N)': 'quoteOnPhoto',
  'Include in game? (Y/N)': 'include',
  'Invented example sentence (bonus hint - NOT a real show quote)': 'exampleSentence',
};

// Include value -> pool. N or blank rows are dropped.
const POOLS = { Y: 'main', T: 'bonus' };

function fail(lines) {
  console.error('\nBuild failed:\n  ' + [].concat(lines).join('\n  ') + '\n');
  process.exit(1);
}

// Trimmed string, or null if empty.
function text(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

// --- find the spreadsheet ---------------------------------------------------

// Optional argument: an .xlsx file, or a folder to take the first .xlsx from.
// Skip Excel's '~$' lock files, which appear while the workbook is open.
const given = process.argv[2] ? path.resolve(process.argv[2]) : DATA_DIR;
let sourcePath = given;
if (fs.existsSync(given) && fs.statSync(given).isDirectory()) {
  const xlsxFiles = fs.readdirSync(given).filter(f => f.toLowerCase().endsWith('.xlsx') && !f.startsWith('~$')).sort();
  if (xlsxFiles.length === 0) fail(`No .xlsx file found in ${given} (the spreadsheet isn't in the repo: put it there first)`);
  sourcePath = path.join(given, xlsxFiles[0]);
}
if (!fs.existsSync(sourcePath)) fail(`No spreadsheet at ${sourcePath}`);
const sourceFile = path.basename(sourcePath);

// The dummy set (anything under data/dummy/) builds a test fixture and touches
// nothing the game ships: no words.js, version.js or sw.js.
const FIXTURE = path.relative(DUMMY_DIR, sourcePath).split(path.sep)[0] !== '..';
const OUT_DIR = FIXTURE ? path.join(ROOT, 'tests', 'fixtures') : ROOT;
const OUT_FILE = path.join(OUT_DIR, FIXTURE ? 'dummy-words.json' : 'words.json');
// Same data as a script, so index.html works from file:// (where fetch is blocked).
const OUT_JS = path.join(OUT_DIR, FIXTURE ? 'dummy-words.js' : 'words.js');

const workbook = XLSX.readFile(sourcePath);
const sheet = workbook.Sheets[SHEET_NAME];
if (!sheet) fail(`No sheet named '${SHEET_NAME}' in ${sourceFile} (found: ${workbook.SheetNames.join(', ')})`);

const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
if (rows.length === 0) fail(`Sheet '${SHEET_NAME}' is empty`);

// --- map headers to columns -------------------------------------------------

const headers = rows[0].map(h => (h === null ? '' : String(h).trim()));
const colIndex = {};
const missing = [];
for (const [header, field] of Object.entries(COLUMNS)) {
  const i = headers.indexOf(header);
  if (i === -1) missing.push(`'${header}'`);
  else colIndex[field] = i;
}
if (missing.length) {
  fail([`Missing required column(s) in '${SHEET_NAME}':`, ...missing.map(m => '  ' + m)]);
}

// --- read rows --------------------------------------------------------------

const words = [];
const errors = [];
const seenIds = new Map();

rows.slice(1).forEach((row, i) => {
  const rowNum = i + 2; // spreadsheet row number, for error messages
  if (row.every(v => text(v) === null)) return;

  const cell = field => row[colIndex[field]];
  // Rows are identified by row number and ID only – never the word.
  const where = () => `Row ${rowNum}${text(cell('id')) ? ` (ID ${text(cell('id'))})` : ''}`;

  // Integer, or null if empty. Anything else is an error.
  const integer = (field, label, required) => {
    const s = text(cell(field));
    if (s === null) {
      if (required) errors.push(`${where()}: empty ${label}`);
      return null;
    }
    if (!/^\d+$/.test(s)) {
      errors.push(`${where()}: ${label} '${s}' is not a whole number`);
      return null;
    }
    return Number(s);
  };

  const include = (text(cell('include')) || 'N').toUpperCase();
  if (include === 'N') return;
  const pool = POOLS[include];
  if (!pool) {
    errors.push(`${where()}: Include value '${include}' is not Y, T or N`);
    return;
  }

  const word = text(cell('word'));
  const definition = text(cell('definition'));
  const keywords = text(cell('keywords'));
  const empty = [];
  if (!word) empty.push('Word');
  if (!definition) empty.push('Definition');
  if (!keywords) empty.push('Keywords');
  if (empty.length) errors.push(`${where()}, Include ${include}: empty ${empty.join(', ')}`);

  const id = integer('id', 'ID', true);
  if (id !== null) {
    if (seenIds.has(id)) errors.push(`${where()}: ID ${id} already used on row ${seenIds.get(id)}`);
    else seenIds.set(id, rowNum);
  }

  // The quote is copied exactly as it is in the sheet. Never alter it.
  const rawQuote = cell('quote');
  const quote = text(rawQuote) === null ? null : String(rawQuote);

  words.push({
    id,
    word,
    definition,
    keywords,
    twist: text(cell('twist')),
    quote,
    quoteGroup: null, // filled in below
    season: integer('season', 'Season', false),
    episode: integer('episode', 'Episode', false),
    episodeTitle: text(cell('episodeTitle')),
    sceneContext: text(cell('sceneContext')),
    imageFile: text(cell('imageFile')),
    quoteOnPhoto: text(cell('quoteOnPhoto'))?.toUpperCase() === 'Y',
    pool,
    exampleSentence: text(cell('exampleSentence')),
  });
});

if (errors.length) fail(errors);

// --- quote groups -----------------------------------------------------------

// Words with identical quote text (after trimming and collapsing whitespace)
// share a group id, numbered from 1 in sheet order. No quote -> null.
const groupIds = new Map();
for (const w of words) {
  if (w.quote === null) continue;
  const key = w.quote.trim().replace(/\s+/g, ' ');
  if (!groupIds.has(key)) groupIds.set(key, groupIds.size + 1);
  w.quoteGroup = groupIds.get(key);
}

// --- write ------------------------------------------------------------------

// Dataset identifier: what the device's memory (storage.js) is keyed by, so a
// different spreadsheet (e.g. the live one at step 7) starts with a clean slate.
// FNV-1a hash of the source filename, plus the number of words.
function fnv1a(s) {
  let h = 0x811c9dc5;
  for (const ch of Buffer.from(s, 'utf8')) { h ^= ch; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
const datasetId = `${fnv1a(sourceFile)}-${words.length}`;

const out = { generatedAt: new Date().toISOString(), source: sourceFile, datasetId, words };
const json = JSON.stringify(out, null, 2);
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, json + '\n');
fs.writeFileSync(OUT_JS, '// Generated by scripts/build-words.js - do not edit.\nwindow.MOIRA_WORDS = ' + json + ';\n');

// --- summary: counts and IDs only ---------------------------------------------

const count = pool => words.filter(w => w.pool === pool).length;
const groupSizes = new Map();
words.forEach(w => { if (w.quoteGroup !== null) groupSizes.set(w.quoteGroup, (groupSizes.get(w.quoteGroup) || 0) + 1); });
const shared = [...groupSizes.values()].filter(n => n > 1);
const ids = list => list.map(w => w.id).join(', ') || 'none';
const main = words.filter(w => w.pool === 'main');
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');

console.log(`${rel(OUT_FILE)} + ${rel(OUT_JS)}: ${count('main')} main, ${count('bonus')} bonus (from ${sourceFile}, dataset ${datasetId})`);
console.log(`Shared quotes: ${shared.length} group(s) with more than one word, largest ${shared.length ? Math.max(...shared) : 0}`);
// The known quirks the game handles, so they're visible at every build (by ID).
console.log(`Main words with no quote (no quote rung; not in Options 2 and 3): ${ids(main.filter(w => w.quote === null))}`);
console.log(`Main words with no season/episode (not in Name the episode): ${ids(main.filter(w => w.season === null || w.episode === null))}`);
console.log(`Main words with no image file (placeholder still): ${ids(main.filter(w => !w.imageFile))}`);
console.log(`Main words with the quote printed on the photo (no overlay): ${main.filter(w => w.quoteOnPhoto).length}`);

// --- stills (step 5): warn, never fail ---------------------------------------

stillsWarnings(checkStills(words, STILLS_DIR)).forEach(line => console.warn(line));

// --- Fill in the blank: the word must be findable in its quote ----------------
// Same rule as blankQuote() in game.js: a quote word starting with the first
// five letters of the word's first word, case-insensitive. Where nothing
// matches, the game blanks nothing and shows the tester a warning.

const unblankable = main.filter(w => {
  if (w.quote === null) return false;
  const stem = ((w.word.match(/\p{L}+/u) || [''])[0]).toLowerCase().slice(0, 5);
  return !stem || ![...w.quote.matchAll(/\p{L}+/gu)].some(m => m[0].toLowerCase().startsWith(stem));
});
if (unblankable.length) {
  console.warn(`Warning: ${unblankable.length} main word(s) can't be blanked in their quote for Fill in the blank (no quote word starts with the word's first five letters): IDs ${ids(unblankable)}`);
}

if (FIXTURE) {
  console.log('Dummy fixture only: version.js and sw.js not touched.');
  process.exit(0);
}

// --- version stamp ----------------------------------------------------------

// A file can't contain the hash of the commit it is part of, so the stamp
// records the commit the build was made on (HEAD), plus '+' if tracked files
// other than the generated ones had uncommitted changes. The build time is
// the reliable 'is this the latest?' signal.
function git(cmd) {
  // trimEnd only: 'git status --porcelain' lines start with a significant space.
  try { return execSync(`git ${cmd}`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trimEnd(); }
  catch { return null; }
}
const commit = git('rev-parse --short HEAD') || 'unknown';
const changed = (git('status --porcelain --untracked-files=no') || '')
  .split('\n').map(l => l.slice(3).trim()).filter(f => f && !GENERATED.includes(f));
const version = { commit, dirty: changed.length > 0, builtAt: new Date().toISOString() };
fs.writeFileSync(VERSION_JS, '// Generated by scripts/build-words.js - do not edit.\nwindow.MOIRA_VERSION = ' + JSON.stringify(version) + ';\n');
console.log(`version.js: ${commit}${version.dirty ? '+' : ''}, built ${version.builtAt}${version.dirty ? ' (uncommitted: ' + changed.join(', ') + ')' : ''}`);

// --- service worker (step 6) -------------------------------------------------
// Every file the page loads must be in the precache list (scripts/shell.js), or
// the game breaks offline: stop the build if one isn't. Then write sw.js with
// this build's version, so every build produces a new worker.

const { SHELL, shellProblems } = require('./shell');
const shell = shellProblems(ROOT);
if (shell.notListed.length || shell.missingOnDisk.length) {
  fail([
    ...shell.notListed.map(f => `The page loads ${f}, but it isn't in the precache list (scripts/shell.js).`),
    ...shell.missingOnDisk.map(f => `The precache list (scripts/shell.js) names ${f}, which doesn't exist.`),
  ]);
}
const swTemplate = fs.readFileSync(path.join(__dirname, 'sw.template.js'), 'utf8');
fs.writeFileSync(path.join(ROOT, 'sw.js'), swTemplate
  .replace('__VERSION__', JSON.stringify(version))
  .replace('__SHELL__', JSON.stringify(SHELL, null, 2)));
console.log(`sw.js: ${SHELL.length} shell files precached, version ${commit}${version.dirty ? '+' : ''} ${version.builtAt}`);
