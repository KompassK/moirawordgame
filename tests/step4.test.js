// Step 4 tests: Options 2 and 3, the New game / End game fixes, and the
// v1 → v2 storage migration. Uses the harness in step3.test.js.

'use strict';

// Unlock Options 2 and 3 by giving `n` main words an Option 1 history.
function playedInDefine(n) {
  record(mainIds.slice(0, n));
  return mainIds.slice(0, n);
}

// From the front card: choose a way to play, set the players, start, and hand over.
function beginOption(type, players = 2) {
  render();
  tap('selectType', type);
  tap('frontStart');
  if (state.overlay === 'confirmAbandon') tap('confirmAbandon');
  tap('setCount', players);
  tap('start');
  tap('ready');
}

// Answer the rest of an Option 2 or 3 turn (correct), ending on the last reveal card.
function finishOptionTurn() {
  while (true) {
    if (state.q.kind === 'blank') tap('blankCorrect');
    else { tap('seasonCorrect'); tap('episodeCorrect'); }
    if (state.qIndex === state.questions.length - 1) return;
    tap('next');
  }
}

// Temporarily change some words' data; always restored.
function withWords(changes, fn) {
  const saved = changes.map(([w]) => ({ w, copy: { ...w } }));
  try { changes.forEach(([w, patch]) => Object.assign(w, patch)); fn(); }
  finally { saved.forEach(({ w, copy }) => Object.assign(w, copy)); }
}

// --- step 3 play-test fixes ---------------------------------------------------

test('New game goes to the front card (where the way to play is chosen); Play again keeps way to play and players', () => {
  fresh();
  playedInDefine(20);
  beginOption('blank', 3);
  for (let t = 0; t < 3; t++) { finishOptionTurn(); tap('next'); if (t < 2) tap('nextTurn'); }
  eq(state.screen, 'final', 'final scoreboard');
  const names = state.players.map(p => p.name);
  tap('playAgain');
  eq([state.screen, state.gameType], ['handover', 'blank'], 'Play again: same way to play, straight in');
  eq(state.players.map(p => p.name), names, 'same players');
  tap('ready');
  for (let t = 0; t < 3; t++) { finishOptionTurn(); tap('next'); if (t < 2) tap('nextTurn'); }
  tap('newGame');
  eq(state.screen, 'front', 'New game: the front card');
  assert(document.querySelectorAll('[data-action="selectType"]').length === 3, 'with the three way-to-play boxes');
  eq(state.setup.type, 'blank', 'last way to play still chosen');
});

test('End game is on every turn screen, asks first, and mid-question it clears the saved game and returns to the front card', () => {
  fresh();
  playedInDefine(20);
  beginTestGame(2);
  // Option 1 main word, mid-question
  tap('hint');
  assert(document.querySelector('.turn__top [data-action="askEnd"]'), 'on the main-word turn screen');
  tap('askEnd');
  eq(state.overlay, 'confirmEnd', 'asks first');
  tap('closeOverlay');
  eq([state.screen, state.q.hints], ['question', 1], 'Keep playing: nothing changed');
  assert(Store.loadGame(), 'still saved');
  tap('askEnd'); tap('confirmEnd');
  eq(state.screen, 'front', 'back to the front card');
  eq(Store.loadGame(), null, 'saved game cleared');
  assert(!document.querySelector('[data-action="resume"]'), 'no Resume offered');

  // Option 1 bonus word
  beginTestGame(2);
  while (state.q.kind === 'main') { tap('mainCorrect'); tap('next'); }
  assert(document.querySelector('.turn--bonus .turn__top [data-action="askEnd"]'), 'on the bonus-word screen');
  tap('askEnd'); tap('confirmEnd');
  eq(Store.loadGame(), null, 'cleared from the bonus word');

  // Options 2 and 3
  for (const type of ['blank', 'episode']) {
    beginOption(type, 2);
    assert(document.querySelector('.turn__top [data-action="askEnd"]'), `on the ${type} turn screen`);
    tap('askEnd'); tap('confirmEnd');
    eq([state.screen, Store.loadGame()], ['front', null], `${type}: cleared, front card`);
  }
});

// --- the playable set -------------------------------------------------------

test('Playable set is exactly the Option 1 history (main pool) minus words with no quote', () => {
  fresh();
  const history = playedInDefine(15);
  record(bonusIds.slice(0, 5));                       // bonus history: never playable
  Store.recordAsked(mainIds[20], 'blank');           // Option 2 history alone doesn't make a word playable
  const [noQuote, noEpisode] = [WORDS_BY_ID.get(history[0]), WORDS_BY_ID.get(history[1])];
  withWords([[noQuote, { quote: null }], [noEpisode, { episode: null }]], () => {
    const blank = playable('blank').map(w => w.id).sort();
    eq(blank, history.filter(id => id !== noQuote.id).sort(), 'Fill in the blank: history minus the no-quote word');
    const episode = playable('episode').map(w => w.id).sort();
    eq(episode, history.filter(id => id !== noQuote.id && id !== noEpisode.id).sort(),
      'Name the episode: also minus the word with no episode number');
    assert(playable('blank').every(w => w.pool === 'main'), 'no bonus words');
  });
});

test('Front card: the playable set size shows once unlocked', () => {
  fresh();
  playedInDefine(32);
  render();
  eq(document.querySelector('[data-value="blank"] .type__progress').textContent, '32 words to play', 'Fill in the blank');
  eq(document.querySelector('[data-value="episode"] .type__progress').textContent, '32 words to play', 'Name the episode');
  assert(/1 point a word/.test(document.querySelector('[data-value="blank"]').textContent), 'scoring shown');
  assert(/1 point for the season, 3 for both/.test(document.querySelector('[data-value="episode"]').textContent), 'scoring shown');
});

test('Words per turn: 9, or fewer when the playable set is small (and the setup screen says so)', () => {
  fresh();
  playedInDefine(32);
  render(); tap('selectType', 'blank'); tap('frontStart'); tap('setCount', 3);
  eq(document.querySelector('.per-turn').textContent, '9 words per turn, from the 32 you’ve played.', '32 words, 3 players: 9');
  tap('setCount', 4);
  eq(document.querySelector('.per-turn').textContent, '8 words per turn, from the 32 you’ve played.', '32 words, 4 players: 8');
  tap('start'); tap('ready');
  const asked = [];
  for (let t = 0; t < 4; t++) {
    eq(state.questions.length, 8, `turn ${t + 1} has 8 questions`);
    while (true) { asked.push(state.q.word.id); tap('blankCorrect'); if (state.qIndex === state.questions.length - 1) break; tap('next'); }
    tap('next'); if (t < 3) tap('nextTurn');
  }
  eq(new Set(asked).size, 32, 'all 32 playable words, none twice');
  assert(asked.every(id => WORDS_BY_ID.get(id).pool === 'main'), 'no bonus word in the turns');
});

test('Not enough playable words for the players: Start is disabled and the setup screen says why', () => {
  fresh();
  const history = playedInDefine(10);
  withWords(history.slice(0, 7).map(id => [WORDS_BY_ID.get(id), { quote: null }]), () => {
    render(); tap('selectType', 'blank'); tap('frontStart'); tap('setCount', 4);  // 3 playable, 4 players
    assert(document.querySelector('[data-action="start"]').disabled, 'Start disabled');
    assert(/Only 3 played words/.test(document.querySelector('.per-turn').textContent), 'explains');
    tap('setCount', 3);
    eq(document.querySelector('.per-turn').textContent, '1 word per turn, from the 3 you’ve played.', '3 players: 1 each');
  });
});

// --- Fill in the blank: blanking ---------------------------------------------

test('Blanking: exact word, any case, every occurrence; the quote text itself is untouched', () => {
  const q = 'Flabbergasted? I was FLABBERGASTED, utterly flabbergasted.';
  const { parts, matched } = blankQuote('Flabbergasted', q);
  assert(matched, 'matched');
  eq(parts.filter(p => p.blank).map(p => p.text), ['Flabbergasted', 'FLABBERGASTED', 'flabbergasted'], 'all three blanked');
  eq(parts.map(p => p.text).join(''), q, 'parts rebuild the exact quote');
});

test('Blanking: a different form of the word (first five letters), e.g. ‘Squire (verb)’ finds ‘squired’', () => {
  const { parts, matched } = blankQuote('Squire (verb)', 'He squired her round the fete, Desmond’s idea.');
  assert(matched, 'matched');
  eq(parts.filter(p => p.blank).map(p => p.text), ['squired'], 'the inflected form is blanked');
  // Forms that change spelling before the end of the word: only the five-letter rule finds these.
  eq(blankQuote('Squire (verb)', 'He was squiring her about.').parts.filter(p => p.blank).map(p => p.text), ['squiring'], 'e dropped');
  eq(blankQuote('Haughty', 'She answered haughtily.').parts.filter(p => p.blank).map(p => p.text), ['haughtily'], 'y to i');
  eq(blankQuote('Belligerent', 'Positively belligerently so.').parts.filter(p => p.blank).map(p => p.text), ['belligerently'], 'longer form');
  eq(blankQuote('Odd', 'How odd, how oddly odd.').parts.filter(p => p.blank).length, 3, 'short word: whole word as the stem');
  eq(blankQuote('Moira', 'That is Moira’s wig.').parts.filter(p => p.blank).map(p => p.text), ['Moira'], 'letters only: the ’s stays');
});

test('Blanking: no match blanks nothing and warns the tester', () => {
  const r = blankQuote('Ostentatious', 'One calls it correct, Desmond.');
  eq(r.matched, false, 'no match');
  eq(r.parts.map(p => p.text).join(''), 'One calls it correct, Desmond.', 'quote shown in full');
  assert(r.parts.every(p => !p.blank), 'nothing blanked');

  fresh();
  playedInDefine(10);
  const words = mainIds.slice(0, 10).map(id => WORDS_BY_ID.get(id));
  withWords(words.map(w => [w, { quote: 'Nothing to see here, Desmond.' }]), () => {
    beginOption('blank', 2);
    assert(!document.querySelector('.quote--read .blank'), 'no blank on the turn screen');
    const warning = document.querySelector('.panel .panel__warning');
    assert(warning && warning.textContent.includes(state.q.word.word), 'warning names the word, in the tester panel');
    tap('askEnd'); tap('confirmEnd');
  });
});

test('Fill in the blank turn and reveal: blank shown, answer in the tester panel, 1 point, word highlighted after', () => {
  fresh();
  playedInDefine(18);
  beginOption('blank', 2);
  const w = state.q.word;
  eq(state.q.kind, 'blank', 'Option 2 question');
  assert(document.querySelector('.quote--read .blank'), 'blank in the quote');
  assert(!document.querySelector('.quote--read').textContent.toLowerCase().includes(w.word.toLowerCase()), 'word not visible in the quote');
  eq(document.querySelector('.panel__answer').textContent, w.word, 'answer for the tester');
  eq(document.querySelector('.points__value').textContent, '1', 'worth 1');
  tap('blankCorrect');
  eq(state.players[0].score, 1, '1 point');
  eq(document.querySelector('.reveal__quote mark').textContent.toLowerCase().slice(0, 5), w.word.toLowerCase().slice(0, 5), 'word highlighted');
  assert(document.querySelector('.reveal__scene'), '‘In this scene’ line');
  tap('next'); tap('blankWrong');
  eq(state.players[0].score, 1, 'wrong: no point');
  assert(document.querySelector('.reveal__line').textContent.startsWith('Sorry, that’s not right – the word was '), 'wrong line');
});

// --- Name the episode: scoring ----------------------------------------------

test('Name the episode scoring: season wrong 0 (episode not asked); season only 1; both 3; give up 0', () => {
  fresh();
  playedInDefine(18);
  beginOption('episode', 2);
  const score = () => state.players[0].score;
  assert(document.querySelector('[data-action="seasonCorrect"]') && !document.querySelector('[data-action="episodeCorrect"]'), 'season first');
  tap('seasonWrong');
  eq([state.screen, score()], ['reveal', 0], 'season wrong: 0, straight to the reveal');
  eq(document.querySelector('.reveal__line').textContent, 'Sorry, that’s not right.', 'wrong line');
  tap('next');
  tap('seasonCorrect');
  assert(document.querySelector('[data-action="episodeCorrect"]'), 'then the episode');
  tap('episodeWrong');
  eq(score(), 1, 'season only: 1');
  eq(document.querySelector('.reveal__line').textContent, 'Right season, wrong episode.', 'season-only line');
  const w = state.q.word;
  eq(document.querySelector('.reveal__meaning').textContent, `Season ${w.season}, episode ${w.episode}: ‘${w.episodeTitle}’.`, 'season, episode and title');
  tap('next');
  tap('seasonCorrect'); tap('episodeCorrect');
  eq(score(), 4, 'both: 3 more');
  tap('next');
  tap('seasonCorrect'); tap('undoTap');
  eq(state.q.phase, 'season', 'Oops undoes the season');
  tap('seasonCorrect'); tap('giveUp');
  eq(score(), 4, 'give up: a pass, 0');
});

// --- separate ask-counts ------------------------------------------------------

test('Each way to play has its own ask-counts: Option 2 never changes Option 1’s', () => {
  fresh();
  playedInDefine(27);   // 18 used by the first Option 2 game, 9 left
  const defineBefore = mainIds.map(id => Store.askCount(id, 'define'));
  beginOption('blank', 2);
  const asked = new Set();
  for (let t = 0; t < 2; t++) {
    while (true) { asked.add(state.q.word.id); tap('blankCorrect'); if (state.qIndex === state.questions.length - 1) break; tap('next'); }
    tap('next'); if (t === 0) tap('nextTurn');
  }
  eq(mainIds.map(id => Store.askCount(id, 'define')), defineBefore, 'Option 1 counts unchanged');
  assert([...asked].every(id => Store.askCount(id, 'blank') === 1), 'Option 2 counts went up');
  eq(Store.playedCount(mainIds, 'episode'), 0, 'Option 3 counts untouched');

  // Option 1's draw ignores Option 2 counts: the 9 never-asked-in-Option-1 words still come first.
  state.usedIds = new Set(); state.gameType = 'define';
  const unasked = mainIds.slice(27);
  assert(drawTurn().filter(w => w.pool === 'main').every(w => unasked.includes(w.id)), 'Option 1 still draws its own least-asked words');
  // Option 2's draw uses Option 2 counts: a second game avoids the first game's words.
  state.usedIds = new Set(); state.gameType = 'blank'; state.perTurn = 9;
  assert(drawTurn().every(w => !asked.has(w.id)), 'Option 2 draws words not yet asked in Option 2');
});

test('Option 2/3 tiebreak uses bonus words, scored as in Option 1, counted in Option 1’s bonus history', () => {
  fresh();
  playedInDefine(18);
  beginOption('episode', 2);
  for (let t = 0; t < 2; t++) {
    while (true) { tap('giveUp'); if (state.qIndex === state.questions.length - 1) break; tap('next'); }
    tap('next'); if (t === 0) tap('nextTurn');
  }
  eq(state.screen, 'final', 'level at 0');
  tap('tiebreak'); tap('nextTurn');
  eq(state.q.kind, 'bonus', 'a bonus word');
  const id = state.q.word.id;
  eq(Store.askCount(id, 'define'), 1, 'counted in Option 1');
  tap('bonusGuess'); tap('bonusCorrect');
  eq(state.players[0].score, 5, 'scored as Option 1: 5 cold');
});

test('Resume keeps the way to play (Option 2, mid-question)', () => {
  fresh();
  playedInDefine(18);
  beginOption('blank', 2);
  tap('blankCorrect'); tap('next');
  const w = state.q.word.id;
  reload(); tap('resume');
  eq([state.gameType, state.screen], ['blank', 'handover'], 'Fill in the blank, pass-the-device screen');
  tap('ready');
  eq([state.q.kind, state.q.word.id, state.players[0].score], ['blank', w, 1], 'same question, score kept');
});

// --- storage migration ------------------------------------------------------

test('Storage v1 → v2: Option 1 history kept as counts.define; Options 2 and 3 start empty', () => {
  const store = memoryBackend();
  store.setItem('sesquipedalian', JSON.stringify({
    schemaVersion: 1, names: ['Kath', 'David'],
    datasets: { [ID]: { words: { [mainIds[0]]: { n: 3, last: '2026-11-01' }, [mainIds[1]]: { n: 1, last: '2026-11-02' } } } },
    savedGame: null,
  }));
  fresh(ID, store);
  eq([Store.askCount(mainIds[0]), Store.askCount(mainIds[1])], [3, 1], 'Option 1 counts kept');
  eq(Store.playedCount(mainIds, 'blank') + Store.playedCount(mainIds, 'episode'), 0, 'Options 2 and 3 empty');
  eq(Store.names(), ['Kath', 'David'], 'names kept');
  Store.recordAsked(mainIds[2]);
  const rec = JSON.parse(store.getItem('sesquipedalian'));
  eq(rec.schemaVersion, 2, 'written back as v2');
  eq(Object.keys(rec.datasets[ID].counts).sort(), ['blank', 'define', 'episode'], 'v2 layout');
});
