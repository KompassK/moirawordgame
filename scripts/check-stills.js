// Checks that every still a word refers to (its `imageFile`) is in the stills
// folder and is a format the game accepts. Used by build-words.js, which
// reports problems as warnings, never errors: in the game a missing still
// simply falls back to assets/placeholder.svg.
//
// Warnings name the words by ID, never the filename: the live filenames
// often contain the word itself, and the build must not show answers.

const fs = require('fs');
const path = require('path');

const ACCEPTED = ['.jpg', '.jpeg', '.png', '.webp'];

// Returns { missing: [{ file, ids }], unsupported: [{ file, ids }] }, sorted by
// file. The match is exact, including case (GitHub Pages is case-sensitive).
function checkStills(words, stillsDir) {
  const byFile = new Map();
  for (const w of words) {
    if (!w.imageFile) continue;
    if (!byFile.has(w.imageFile)) byFile.set(w.imageFile, []);
    byFile.get(w.imageFile).push(w.id);
  }
  const present = fs.existsSync(stillsDir) ? new Set(fs.readdirSync(stillsDir)) : new Set();
  const entries = [...byFile.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([file, ids]) => ({ file, ids }));
  return {
    missing: entries.filter(e => !present.has(e.file)),
    unsupported: entries.filter(e => !ACCEPTED.includes(path.extname(e.file).toLowerCase())),
  };
}

const idList = entries => entries.flatMap(e => e.ids).sort((a, b) => a - b).join(', ');

// The build's warning lines for a checkStills() result (empty if all is well).
function stillsWarnings({ missing, unsupported }) {
  const lines = [];
  if (missing.length) {
    lines.push(`Warning: ${missing.length} image file(s) not found in assets/stills/ (the game will show the placeholder), for IDs ${idList(missing)}`);
  }
  if (unsupported.length) {
    lines.push(`Warning: ${unsupported.length} image file(s) not in an accepted format (${ACCEPTED.join(', ')}), for IDs ${idList(unsupported)}`);
  }
  return lines;
}

module.exports = { checkStills, stillsWarnings, ACCEPTED };
