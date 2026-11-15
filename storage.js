// Sesquipedalian – everything the device remembers between games.
// The only file that touches localStorage. Every read and write is wrapped:
// if storage is unavailable, full or corrupt, the game still plays, just
// without memory (changes are kept in memory for the session).
//
// Schema (one localStorage key, 'sesquipedalian'):
// {
//   schemaVersion: 1,
//   names: ['Kath', 'David', …],            // last game's names, up to 4 (not per dataset)
//   datasets: {
//     '<datasetId>': {
//       words: { '<wordId>': { n: 2, last: '2026-11-15' } }   // Option 1 ask-count and last date
//     }
//   },
//   savedGame: { datasetId, savedAt, game } | null   // the in-progress game (see game.js)
// }
// The dataset identifier comes from words.js (build-words.js), so a different
// word list starts with empty usage and no saved game.

'use strict';

const Store = (() => {
  const KEY = 'sesquipedalian';
  const SCHEMA_VERSION = 1;
  const SAVED_GAME_MAX_AGE_MS = 24 * 60 * 60 * 1000;

  let backend = null;       // localStorage, or a test double
  let data = null;          // the parsed record, always valid
  let datasetId = 'unknown';
  let ok = true;            // false once a read or write has failed

  function empty() {
    return { schemaVersion: SCHEMA_VERSION, names: [], datasets: {}, savedGame: null };
  }

  // Later schema versions add steps here. Anything unrecognised starts fresh.
  function migrate(raw) {
    if (!raw || typeof raw !== 'object' || raw.schemaVersion !== SCHEMA_VERSION) return empty();
    return {
      schemaVersion: SCHEMA_VERSION,
      names: Array.isArray(raw.names) ? raw.names.filter(n => typeof n === 'string').slice(0, 4) : [],
      datasets: raw.datasets && typeof raw.datasets === 'object' ? raw.datasets : {},
      savedGame: raw.savedGame && typeof raw.savedGame === 'object' ? raw.savedGame : null,
    };
  }

  function read() {
    try {
      const text = backend && backend.getItem(KEY);
      data = text ? migrate(JSON.parse(text)) : empty();
    } catch (e) {
      ok = false;
      data = empty();
    }
  }

  function write() {
    try {
      if (backend) backend.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      ok = false;           // carry on with what's in memory
    }
  }

  function dataset() {
    if (!data.datasets[datasetId] || typeof data.datasets[datasetId].words !== 'object') {
      data.datasets[datasetId] = { words: {} };
    }
    return data.datasets[datasetId];
  }

  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  return {
    // Call once at start-up with the word list's identifier.
    init(id, store) {
      datasetId = id || 'unknown';
      if (store !== undefined) backend = store;
      else {
        try { backend = window.localStorage; } catch (e) { backend = null; ok = false; }
      }
      read();
    },

    // True if the device's memory is working (for diagnostics).
    available: () => ok && Boolean(backend),

    // --- per-word usage (Option 1), for the current dataset ---
    askCount(wordId) {
      const w = dataset().words[wordId];
      return w && Number.isFinite(w.n) ? w.n : 0;
    },
    recordAsked(wordId) {
      const words = dataset().words;
      const w = words[wordId] || { n: 0, last: null };
      words[wordId] = { n: (Number.isFinite(w.n) ? w.n : 0) + 1, last: today() };
      write();
    },
    // How many of these word IDs have ever been asked.
    playedCount(wordIds) {
      return wordIds.filter(id => this.askCount(id) > 0).length;
    },
    resetHistory() {
      data.datasets[datasetId] = { words: {} };
      write();
    },

    // --- remembered names (not per dataset) ---
    names: () => data.names.slice(),
    setNames(names) {
      data.names = names.slice(0, 4);
      write();
    },

    // --- the game in progress ---
    saveGame(game) {
      data.savedGame = { datasetId, savedAt: Date.now(), game };
      write();
    },
    // The saved game, if it belongs to this dataset and is under 24 hours old.
    loadGame() {
      const s = data.savedGame;
      if (!s || s.datasetId !== datasetId || !s.game) return null;
      if (!(Date.now() - s.savedAt < SAVED_GAME_MAX_AGE_MS)) return null;
      return s.game;
    },
    clearGame() {
      if (data.savedGame === null) return;
      data.savedGame = null;
      write();
    },
  };
})();
