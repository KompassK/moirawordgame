// Step 3 tests: the device's memory. Open tests/index.html in a browser
// (double-click works). Uses an in-memory store, never the real one.
// The page title ends 'PASS' or 'FAIL' for automated runs.

'use strict';

// Tests are queued here and run in order by report.js, which waits for any
// test that returns a promise (e.g. waiting for an image to load).
const queued = [];
const results = [];
function test(name, fn) {
  queued.push({ name, fn });
}

// Which word list the page loaded (tests/index.html: the dummy fixture by
// default, the real words.js with ?data=live). Tests that depend on the dummy
// fixtures (the four test stills, specific dummy IDs) run on dummy only;
// tests of the live data's quirks run on live only; everything else on both.
const LIVE = /[?&]data=live\b/.test(location.search);
function testDummy(name, fn) { queued.push({ name, fn, skip: LIVE && 'dummy data only' }); }
function testLive(name, fn) { queued.push({ name, fn, skip: !LIVE && 'live data only' }); }
function assert(cond, message) { if (!cond) throw new Error(message); }
function eq(got, want, message) {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${message}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}

// --- harness ----------------------------------------------------------------

function memoryBackend() {
  const s = {};
  return {
    s,
    getItem: k => (k in s ? s[k] : null),
    setItem: (k, v) => { s[k] = String(v); },
    removeItem: k => { delete s[k]; },
  };
}

const ID = 'test-dataset';
let backend;

// A fresh device: empty memory, front card, no game.
function fresh(datasetId = ID, store = memoryBackend()) {
  backend = store;
  Store.init(datasetId, store);
  Object.assign(state, {
    screen: 'front', overlay: null, setup: { type: 'define', count: 2, names: [] }, gameType: 'define',
    players: [], tiebreak: null, usedIds: new Set(), q: null, questions: [], history: [], undo: null, result: null,
  });
  render();
}

// Tap a button exactly as a player would (goes through the real click handler).
function tap(action, value) {
  const sel = value === undefined ? `[data-action="${action}"]` : `[data-action="${action}"][data-value="${value}"]`;
  const el = document.querySelector(sel);
  assert(el, `no '${action}' button on the '${state.screen}' screen (overlay: ${state.overlay})`);
  assert(!el.disabled, `'${action}' is disabled on the '${state.screen}' screen`);
  el.click();
}

// What a page reload does: memory survives, the in-page game doesn't.
function reload() {
  Store.init(ID, backend);
  Object.assign(state, { screen: 'front', overlay: null, players: [], tiebreak: null, q: null, questions: [], usedIds: new Set(), history: [], undo: null, result: null });
  render();
}

function beginTestGame(players = 2) {
  tap('frontStart');
  if (state.overlay === 'confirmAbandon') tap('confirmAbandon');
  tap('setCount', players);
  tap('start');
  tap('ready');
}

// Answer the rest of the current turn correctly, ending on the reveal card of the bonus word.
function finishTurn() {
  while (state.q.kind === 'main') { tap('mainCorrect'); tap('next'); }
  tap('bonusGuess'); tap('bonusCorrect');
}

// Main-pool IDs, complete words first (quote, season and episode), so tests that
// take "the first n" get words every way to play can use – on any data set.
const complete = w => w.quote !== null && w.season !== null && w.episode !== null;
const mainIds = [...MAIN.filter(complete), ...MAIN.filter(w => !complete(w))].map(w => w.id);
const bonusIds = BONUS_POOL.map(w => w.id);
const record = (ids, times = 1) => ids.forEach(id => { for (let i = 0; i < times; i++) Store.recordAsked(id); });

// --- the draw ---------------------------------------------------------------

test('Draw: never-asked words come first, then it dips into once-asked words, never twice-asked ones', () => {
  fresh();
  const zero = mainIds.slice(0, 12);          // never asked
  const once = mainIds.slice(12, 30);         // asked once (18 words)
  const twice = mainIds.slice(30);            // asked twice (6 words)
  record(once, 1); record(twice, 2);
  state.usedIds = new Set();

  const t1 = drawTurn().filter(w => w.pool === 'main').map(w => w.id);
  eq(t1.length, 9, 'turn 1 has nine main words');
  assert(t1.every(id => zero.includes(id)), 'turn 1 is all never-asked words');

  const t2 = drawTurn().filter(w => w.pool === 'main').map(w => w.id);
  eq(t2.filter(id => zero.includes(id)).length, 3, 'turn 2 takes the last 3 never-asked words');
  eq(t2.filter(id => once.includes(id)).length, 6, 'turn 2 dips into once-asked words for the other 6');
  eq(t2.filter(id => twice.includes(id)).length, 0, 'turn 2 takes no twice-asked word');
});

test('Draw: random within a band (not always the same words)', () => {
  fresh();
  const seen = new Set();
  for (let i = 0; i < 30; i++) { state.usedIds = new Set(); drawTurn().forEach(w => seen.add(w.id)); }
  assert(seen.size > 20, `30 first turns used only ${seen.size} different words`);
});

test('Draw: bonus words least-asked first too', () => {
  fresh();
  record(bonusIds.slice(1), 1);               // all but one bonus word asked once
  state.usedIds = new Set();
  eq(drawBonus().id, bonusIds[0], 'the never-asked bonus word is drawn');
});

test('Draw: shared-quote exclusion still applies within a turn', () => {
  fresh();
  const saved = MAIN.map(w => w.quoteGroup);
  try {
    MAIN.forEach((w, i) => { w.quoteGroup = i % 12; });   // 12 groups of 3
    for (let k = 0; k < 20; k++) {
      state.usedIds = new Set();
      const groups = drawTurn().filter(w => w.pool === 'main').map(w => w.quoteGroup);
      eq(new Set(groups).size, 9, 'nine different quote groups');
    }
  } finally {
    MAIN.forEach((w, i) => { w.quoteGroup = saved[i]; });
  }
});

test('No word is asked twice in a 4-player game, and each asked word is counted once', () => {
  fresh();
  beginTestGame(4);
  const asked = [];
  for (let t = 0; t < 4; t++) {
    while (true) {
      asked.push(state.q.word.id);
      if (state.q.kind === 'bonus') { tap('giveUp'); break; }
      tap('mainCorrect'); tap('next');
    }
    tap('next');
    if (t < 3) tap('nextTurn');
  }
  eq(state.screen, 'final', 'game over');
  eq(asked.length, 40, '40 questions asked');
  eq(new Set(asked).size, 40, 'all different');
  assert(asked.every(id => Store.askCount(id) === 1), 'each counted exactly once');
});

test('Second game avoids the first game’s words until it has to', () => {
  fresh();
  beginTestGame(2);
  const first = new Set();
  for (let t = 0; t < 2; t++) {
    while (state.q.kind === 'main') { first.add(state.q.word.id); tap('mainCorrect'); tap('next'); }
    first.add(state.q.word.id); tap('giveUp'); tap('next');
    if (t === 0) tap('nextTurn');
  }
  tap('playAgain'); tap('ready');
  const second = [];
  for (let t = 0; t < 2; t++) {
    while (true) { second.push(state.q.word.id); if (state.q.kind === 'bonus') break; tap('mainCorrect'); tap('next'); }
    tap('giveUp'); tap('next'); if (t === 0) tap('nextTurn');
  }
  // 36 main words: the first game used 18, so the second game's 18 are all new.
  const repeatsMain = second.filter(id => first.has(id) && WORDS_BY_ID.get(id).pool === 'main');
  eq(repeatsMain.length, 0, 'no main word from the first game');
  const repeatsBonus = second.filter(id => first.has(id) && WORDS_BY_ID.get(id).pool === 'bonus');
  eq(repeatsBonus.length, 0, 'no bonus word from the first game');
});

test('A drawn word only counts once it reaches the turn screen (End game before it is asked)', () => {
  fresh();
  tap('frontStart'); tap('start');              // handover screen: turn drawn, nothing asked yet
  eq(state.screen, 'handover', 'on the handover screen');
  const firstWord = state.q.word.id;
  eq(Store.askCount(firstWord), 0, 'not counted before the tester is ready');
  tap('ready');
  eq(Store.askCount(firstWord), 1, 'counted on the turn screen');
  tap('mainCorrect');
  const secondWord = state.questions[1].id;
  // The second word is drawn but never reaches the screen.
  state.screen = 'pass'; render();            // End game lives on the pass screen
  tap('askEnd'); tap('confirmEnd');
  eq(Store.askCount(secondWord), 0, 'drawn-but-unasked word not counted');
});

test('Tiebreak bonus words count as asked', () => {
  fresh();
  beginTestGame(2);
  for (let t = 0; t < 2; t++) {
    while (state.q.kind === 'main') { tap('giveUp'); tap('next'); }
    tap('giveUp'); tap('next'); if (t === 0) tap('nextTurn');
  }
  eq(state.screen, 'final', 'final'); tap('tiebreak'); tap('nextTurn');
  const tbWord = state.q.word.id;
  eq(Store.askCount(tbWord), 1, 'tiebreak word counted');
});

// --- the unlock -------------------------------------------------------------

test('Unlock: locked at 9 main words (count shown), bonus words don’t count, unlocked at exactly 10', () => {
  fresh();
  record(mainIds.slice(0, 9));
  record(bonusIds.slice(0, 5));
  render();
  assert(!isUnlocked('blank') && !isUnlocked('episode'), 'locked at 9');
  const box = document.querySelector('[data-action="selectType"][data-value="blank"]');
  assert(box.disabled, 'box disabled');
  eq(box.querySelector('.type__progress').textContent, '9 of 10 words played', 'count shown');
  record([mainIds[9]]);
  render();
  assert(isUnlocked('blank') && isUnlocked('episode'), 'unlocked at 10');
  const open = document.querySelector('[data-action="selectType"][data-value="episode"]');
  assert(!open.disabled, 'box enabled');
  // Step 4: once unlocked, the box shows the playable set instead of the progress.
  eq(open.querySelector('.type__progress').textContent, '10 words to play', 'playable set shown once unlocked');
  tap('selectType', 'episode');
  eq(state.setup.type, 'episode', 'can be chosen');
  state.setup.type = 'define';
});

test('Unlock counts each word once, however often it was asked', () => {
  fresh();
  record(mainIds.slice(0, 9), 5);
  assert(!isUnlocked('blank'), '9 words asked 5 times each is still 9 words');
});

// --- saving and resuming ----------------------------------------------------

test('Resume mid-question: back at the start of that question, nothing scored, not counted twice', () => {
  fresh();
  beginTestGame(2);
  tap('mainCorrect'); tap('next');            // Q1: +4
  const w = state.q.word.id;
  tap('hint'); tap('mainWrong');              // Q2: quote read, then a wrong guess (capped at 1)
  eq(state.q.capped, true, 'capped before the refresh');
  eq(Store.askCount(w), 1, 'Q2 counted once');

  reload();
  assert(document.querySelector('[data-action="resume"]'), 'front card offers Resume game');
  tap('resume');
  eq(state.screen, 'handover', 'resumes on a pass-the-device screen');
  eq(state.q.word.id, w, 'same question');
  eq([state.q.hints, state.q.capped], [0, false], 'back at the start of the question');
  eq(state.players[0].score, 4, 'only Q1 scored');
  tap('ready');
  eq(state.screen, 'question', 'then the question');
  eq(Store.askCount(w), 1, 'still counted once');
});

test('Resume on a reveal card: that result stands and play moves to the next word', () => {
  fresh();
  beginTestGame(2);
  tap('hint'); tap('mainCorrect');            // reveal: +3
  const next = state.questions[1].id;
  reload(); tap('resume');
  eq(state.players[0].score, 3, 'the result stands');
  eq(state.screen, 'handover', 'pass-the-device screen');
  eq(state.q.word.id, next, 'next word');
});

test('Resume on a pass-the-device screen: exactly as it was', () => {
  fresh();
  beginTestGame(2);
  finishTurn(); tap('next');
  eq(state.screen, 'pass', 'pass screen');
  const before = serializeGame();
  reload(); tap('resume');
  eq(state.screen, 'pass', 'pass screen again');
  eq(serializeGame(), before, 'same game');
  tap('nextTurn');
  eq(state.players[state.turn].name, 'Player 2', 'second turn');
});

test('A saved game over 24 hours old is not offered', () => {
  fresh();
  beginTestGame(2);
  const rec = JSON.parse(backend.getItem('sesquipedalian'));
  rec.savedGame.savedAt -= 25 * 60 * 60 * 1000;
  backend.setItem('sesquipedalian', JSON.stringify(rec));
  reload();
  assert(!document.querySelector('[data-action="resume"]'), 'no Resume button');
});

test('Start with a saved game asks first; abandoning clears it', () => {
  fresh();
  beginTestGame(2);
  reload();
  tap('frontStart');
  eq(state.overlay, 'confirmAbandon', 'asks ‘Abandon the saved game?’');
  tap('closeOverlay');
  assert(Store.loadGame(), 'Keep it: still saved');
  tap('frontStart'); tap('confirmAbandon');
  eq(Store.loadGame(), null, 'abandoned');
  eq(state.screen, 'setup', 'on to setup');
});

test('The saved game is cleared by End game and by the final scoreboard', () => {
  fresh();
  beginTestGame(2);
  finishTurn(); tap('next');
  assert(Store.loadGame(), 'saved during the game');
  tap('askEnd'); tap('confirmEnd');
  eq(Store.loadGame(), null, 'cleared by End game');
  eq(state.screen, 'front', 'back to the front card');

  beginTestGame(2);
  finishTurn(); tap('next'); tap('nextTurn'); finishTurn(); tap('next');
  eq(state.screen, 'final', 'final scoreboard');
  eq(Store.loadGame(), null, 'cleared on the final scoreboard');
});

// --- datasets, settings, robustness -----------------------------------------

test('A different dataset identifier sees empty storage', () => {
  fresh('dataset-A');
  const shared = backend;
  record(mainIds.slice(0, 12));
  beginTestGame(2);                                // leaves a saved game and names
  Store.init('dataset-B', shared);
  eq(Store.playedCount(mainIds), 0, 'no usage');
  eq(Store.loadGame(), null, 'no saved game');
  Store.init('dataset-A', shared);
  eq(Store.playedCount(mainIds), 13, 'dataset A still has its 12 + the word just asked');
  assert(Store.loadGame(), 'and its saved game');
});

test('Remembered names: last game’s names offered on setup; blanks not remembered', () => {
  fresh();
  tap('frontStart'); tap('setCount', 3);
  const inputs = document.querySelectorAll('[data-name]');
  ['Kath', '', 'Alexis'].forEach((v, i) => { inputs[i].value = v; inputs[i].dispatchEvent(new Event('input', { bubbles: true })); });
  tap('start');
  eq(Store.names(), ['Kath', '', 'Alexis'], 'stored as typed');
  eq(state.players.map(p => p.name), ['Kath', 'Player 2', 'Alexis'], 'blank played as Player 2');
  tap('ready'); state.screen = 'pass'; render(); tap('askEnd'); tap('confirmEnd');
  state.setup.names = [];
  tap('frontStart');
  eq(state.setup.count, 3, 'three players');
  eq([...document.querySelectorAll('[data-name]')].map(i => i.value), ['Kath', '', 'Alexis'], 'names pre-filled');
});

test('Settings card: words played per pool, and Reset word history (current dataset only)', () => {
  fresh();
  const shared = backend;
  Store.setNames(['Kath', 'David']);
  record(mainIds.slice(0, 23)); record(bonusIds.slice(0, 6));
  Store.init('other', shared); record(mainIds.slice(0, 5)); Store.init(ID, shared);
  beginTestGame(2); state.screen = 'pass'; render(); tap('askEnd'); tap('closeOverlay');   // a saved game exists
  state.screen = 'front'; render();
  tap('showSettings');
  const text = document.querySelector('.overlay').textContent.replace(/\s+/g, ' ');
  assert(text.includes(`Main: 24 of ${MAIN.length} played`), `main line in: ${text}`);  // 23 + the one asked
  assert(text.includes(`Bonus: 6 of ${BONUS_POOL.length} played`), 'bonus line');
  assert(text.includes('Kath, David'), 'names');
  tap('askReset'); eq(state.overlay, 'confirmReset', 'confirm first');
  tap('showSettings'); eq(Store.playedCount(mainIds), 24, 'Cancel keeps history');
  tap('askReset'); tap('confirmReset');
  eq(Store.playedCount(mainIds) + Store.playedCount(bonusIds), 0, 'history cleared');
  eq(Store.names(), ['Kath', 'David'], 'names kept');
  assert(Store.loadGame(), 'saved game kept');
  Store.init('other', shared);
  eq(Store.playedCount(mainIds), 5, 'other dataset untouched');
});

test('Storage unavailable: the game still plays, just without memory', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() {} };
  fresh(ID, broken);
  assert(!Store.available(), 'reports unavailable');
  beginTestGame(2);
  finishTurn(); tap('next');
  eq(state.screen, 'pass', 'played a whole turn');
  tap('nextTurn'); finishTurn(); tap('next');
  eq(state.screen, 'final', 'and finished the game');
});

test('Corrupt or unknown storage starts fresh', () => {
  const store = memoryBackend();
  store.setItem('sesquipedalian', '{not json');
  fresh(ID, store);
  eq(Store.playedCount(mainIds), 0, 'corrupt JSON: empty');
  store.setItem('sesquipedalian', JSON.stringify({ schemaVersion: 99, datasets: { [ID]: { words: { [mainIds[0]]: { n: 3 } } } } }));
  Store.init(ID, store);
  eq(Store.askCount(mainIds[0]), 0, 'unknown schema version: empty');
  beginTestGame(2);
  eq(Store.askCount(state.q.word.id), 1, 'and it writes a fresh record');
  eq(JSON.parse(store.getItem('sesquipedalian')).schemaVersion, 2, 'current schemaVersion (2 since step 4)');
});

