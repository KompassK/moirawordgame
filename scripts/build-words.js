#!/usr/bin/env node
// Builds words.json (and words.js) from the spreadsheet in data/, and writes
// version.js for the version stamp on the front card.
// Run with `npm run build`. Node is used here only; the game never needs it.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const XLSX = require('xlsx');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const OUT_FILE = path.join(ROOT, 'words.json');
// Same data as a script, so index.html works from file:// (where fetch is blocked).
const OUT_JS = path.join(ROOT, 'words.js');
const VERSION_JS = path.join(ROOT, 'version.js');
// Generated files never count as 'uncommitted changes' for the version stamp.
const GENERATED = ['words.json', 'words.js', 'version.js'];
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

// Skip Excel's '~$' lock files, which appear while the workbook is open.
const xlsxFiles = fs.existsSync(DATA_DIR)
  ? fs.readdirSync(DATA_DIR).filter(f => f.toLowerCase().endsWith('.xlsx') && !f.startsWith('~$')).sort()
  : [];
if (xlsxFiles.length === 0) fail(`No .xlsx file found in ${DATA_DIR}`);
const sourceFile = xlsxFiles[0];

const workbook = XLSX.readFile(path.join(DATA_DIR, sourceFile));
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
  const where = () => `Row ${rowNum}${text(cell('word')) ? ` ('${text(cell('word'))}')` : ''}`;

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
fs.writeFileSync(OUT_FILE, json + '\n');
fs.writeFileSync(OUT_JS, '// Generated by scripts/build-words.js - do not edit.\nwindow.MOIRA_WORDS = ' + json + ';\n');

const count = pool => words.filter(w => w.pool === pool).length;
const sharedGroups = [...groupIds.values()].filter(g => words.filter(w => w.quoteGroup === g).length > 1).length;
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

console.log(`words.json + words.js: ${count('main')} main, ${count('bonus')} bonus, ${sharedGroups} shared-quote group(s) (from ${sourceFile})`);
console.log(`version.js: ${commit}${version.dirty ? '+' : ''}, built ${version.builtAt}${version.dirty ? ' (uncommitted: ' + changed.join(', ') + ')' : ''}`);
