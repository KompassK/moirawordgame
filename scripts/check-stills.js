// Checks that every still a word refers to (its `imageFile`) is in the stills
// folder and is a format the game accepts. Used by build-words.js, which
// reports problems as warnings, never errors: in the game a missing still
// simply falls back to assets/placeholder.svg.

const fs = require('fs');
const path = require('path');

const ACCEPTED = ['.jpg', '.jpeg', '.png', '.webp'];

// Returns { missing: [file, …], unsupported: [file, …] }, each sorted, no repeats.
function checkStills(words, stillsDir) {
  const files = [...new Set(words.map(w => w.imageFile).filter(Boolean))];
  const present = fs.existsSync(stillsDir) ? new Set(fs.readdirSync(stillsDir)) : new Set();
  return {
    missing: files.filter(f => !present.has(f)).sort(),
    unsupported: files.filter(f => !ACCEPTED.includes(path.extname(f).toLowerCase())).sort(),
  };
}

// The build's warning lines for a checkStills() result (empty if all is well).
function stillsWarnings({ missing, unsupported }) {
  const lines = [];
  if (missing.length) {
    lines.push(`Warning: ${missing.length} image file(s) not found in assets/stills/ (the game will show the placeholder): ${missing.join(', ')}`);
  }
  if (unsupported.length) {
    lines.push(`Warning: ${unsupported.length} image file(s) not in an accepted format (${ACCEPTED.join(', ')}): ${unsupported.join(', ')}`);
  }
  return lines;
}

module.exports = { checkStills, stillsWarnings, ACCEPTED };
