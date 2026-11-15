// The app shell: every file the service worker precaches, so the game starts
// and plays with the network off. Paths are relative to the project root
// (the worker's scope), never to the site root.
//
// The build checks this list against the files the page actually loads (see
// loadedFiles) and FAILS if one is missing, so adding a file to index.html,
// style.css, the manifest or the game without listing it here can't slip by.
// Stills (assets/stills/) are not in the shell: they're cached on first use.

const fs = require('fs');
const path = require('path');

const SHELL = [
  'index.html',
  'style.css',
  'version.js',
  'words.js',
  'storage.js',
  'pwa.js',
  'game.js',
  'manifest.webmanifest',
  'assets/fonts/josefin-sans-latin.woff2',
  'assets/fonts/josefin-sans-latin-ext.woff2',
  'assets/placeholder.svg',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/favicon.ico',
  'assets/icons/favicon-32.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-512-maskable.png',
];

// Never precached: the worker itself.
const NOT_SHELL = ['sw.js'];

const isLocal = u => u && !/^(https?:|data:|#|mailto:|\/\/)/i.test(u);
const norm = u => path.posix.normalize(u.replace(/^\.\//, '').split(/[?#]/)[0]);

// Every local file the page loads: index.html's src/href, style.css's url(),
// the manifest's icons, and asset paths written as './assets/…' in the scripts.
function loadedFiles(root) {
  const read = f => fs.readFileSync(path.join(root, f), 'utf8');
  const found = new Set();
  for (const m of read('index.html').matchAll(/\s(?:src|href)="([^"]+)"/g)) if (isLocal(m[1])) found.add(norm(m[1]));
  for (const m of read('style.css').matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) if (isLocal(m[1])) found.add(norm(m[1]));
  for (const icon of JSON.parse(read('manifest.webmanifest')).icons || []) if (isLocal(icon.src)) found.add(norm(icon.src));
  for (const script of [...found].filter(f => f.endsWith('.js'))) {
    if (!fs.existsSync(path.join(root, script))) continue;
    for (const m of read(script).matchAll(/['"`]\.\/((?:assets\/)?[\w./-]+\.[a-z0-9]+)['"`]/gi)) found.add(norm(m[1]));
  }
  NOT_SHELL.forEach(f => found.delete(f));
  return [...found].sort();
}

// Problems that should stop the build: files the page loads that aren't in
// the list, and listed files that don't exist.
function shellProblems(root, list = SHELL) {
  const loaded = loadedFiles(root);
  return {
    notListed: loaded.filter(f => !list.includes(f)),
    missingOnDisk: list.filter(f => !fs.existsSync(path.join(root, f))),
  };
}

module.exports = { SHELL, loadedFiles, shellProblems };
