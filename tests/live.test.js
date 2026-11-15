// Live-data tests (step 7): run only with tests/index.html?data=live, against
// the real words.js. They check the live data's known quirks and the game's
// handling of them.
//
// PRIVACY: nothing here may print a word, definition, quote or scene context
// from the live data – not even in a failure message. Assertions compare IDs,
// counts and booleans only; never eq() on live text.

'use strict';

const L = id => WORDS_BY_ID.get(id);
const idsOf = list => list.map(w => w.id).sort((a, b) => a - b);

testLive('Live pools: 170 main, 60 bonus; its own dataset identifier; player cap 4', () => {
  eq([MAIN.length, BONUS_POOL.length], [170, 60], 'pool sizes');
  assert(DATA.datasetId !== 'f7f1920f-50' && /-230$/.test(DATA.datasetId), 'a dataset identifier of its own (230 words)');
  eq(PLAYER_LIMIT, 4, 'player cap stays at 4');
});

testLive('Capacity: a 4-player game uses 36 main + 4 bonus words, all different, and the pool has room', () => {
  fresh();
  state.gameType = 'define';
  state.usedIds = new Set();
  const turns = [0, 1, 2, 3].map(() => drawTurn());
  const all = turns.flat();
  eq(turns.map(t => t.length), [10, 10, 10, 10], 'ten words a turn');
  eq([all.filter(w => w.pool === 'main').length, all.filter(w => w.pool === 'bonus').length], [36, 4], '36 main + 4 bonus');
  eq(new Set(all.map(w => w.id)).size, 40, 'no repeats');
  assert(MAIN.length >= 36 && BONUS_POOL.length >= 4, 'enough for a full game without dipping into asked words');
});

testLive('Quirk 1 (ID 113): no quote and no episode – a genuine main word, kept by the build', () => {
  const w = L(113);
  assert(w, 'ID 113 is in words.js');
  // (Its Scene context cell is not empty in the live sheet; the game shows no
  // scene line for a word with no quote – see the next test.)
  eq([w.pool, w.quote === null, w.season === null || w.episode === null], ['main', true, true], 'main pool, no quote, no episode');
  assert(!playable('blank').includes(w) && !playable('episode').includes(w), 'never in Options 2 or 3');
});

testLive('Quirk 1 (ID 113): the hint goes straight to the photo, 4 → 2; no ‘In this scene’ line', () => {
  fresh();
  beginTestGame(2);
  setQuestion(L(113)); state.screen = 'question'; render();
  eq(document.querySelector('[data-action="hint"]').textContent, 'Show the photo', 'no Read the quote');
  eq(document.querySelector('.points__value').textContent, '4', 'starts at 4');
  assert(!document.querySelector('.reveal-block'), 'no quote or scene block on the turn screen');
  tap('hint');
  eq(state.screen, 'photo', 'one tap: the photo');
  assert(!document.querySelector('.photo .still__band'), 'no quote to draw over the photo');
  tap('closePhoto');
  eq(document.querySelector('.points__value').textContent, '2', 'now worth 2');
  eq(document.querySelector('[data-action="hint"]').textContent, 'Show the photo again', 'photo can be shown again');
  tap('mainCorrect');
  eq(state.result.points, 2, 'scores 2');
  assert(!document.querySelector('.reveal__scene'), 'no In this scene line');
  // A wrong guess before the photo still caps it at 1.
  tap('next');
  setQuestion(L(113)); state.screen = 'question'; render();
  tap('mainWrong'); eq(document.querySelector('.points__value').textContent, '1', 'capped at 1');
  tap('hint'); tap('closePhoto'); tap('mainCorrect');
  eq(state.result.points, 1, 'scores 1');
  tap('undo'); tap('undoTap');
  eq([state.q.hints, state.q.capped], [0, true], 'Oops undoes the photo step back to the start (still capped)');
});

testLive('Quirk 2 (IDs 25, 32, 66, 100): no image file → the placeholder, with the quote drawn over it', () => {
  const ids = [25, 32, 66, 100];
  eq(idsOf(MAIN.filter(w => !w.imageFile)), ids, 'exactly these main words have no image file');
  for (const id of ids) {
    const w = L(id);
    eq(stillSrc(w), PLACEHOLDER_STILL, `ID ${id}: placeholder`);
    const box = document.createElement('div');
    box.innerHTML = renderStill(w, 'full');
    eq(box.querySelector('img').getAttribute('src'), PLACEHOLDER_STILL, `ID ${id}: placeholder drawn`);
    eq(Boolean(box.querySelector('.still__band')), Boolean(w.quote) && !w.quoteOnPhoto, `ID ${id}: quote overlay when it has a quote`);
  }
  assert(ids.every(id => L(id).quote && !L(id).quoteOnPhoto), 'all four have a quote to overlay');
});

testLive('Quirk 3: words with the quote printed on the photo get no overlay; every other quoted main word does', () => {
  const onPhoto = MAIN.filter(w => w.quoteOnPhoto);
  assert(onPhoto.length > 0, 'some main words have the quote on the photo');
  const banded = w => { const b = document.createElement('div'); b.innerHTML = renderStill(w, 'full'); return Boolean(b.querySelector('.still__band')); };
  const wrong = MAIN.filter(w => w.quote && banded(w) === w.quoteOnPhoto);
  eq(idsOf(wrong), [], 'overlay drawn exactly when the quote isn’t on the photo');
});

testLive('Shared quotes: real groups exist, and a turn never draws two words from one group', () => {
  const sizes = new Map();
  MAIN.forEach(w => { if (w.quoteGroup !== null) sizes.set(w.quoteGroup, (sizes.get(w.quoteGroup) || 0) + 1); });
  const shared = [...sizes.values()].filter(n => n > 1);
  assert(shared.length > 0, 'shared-quote groups exist');
  fresh();
  state.gameType = 'define';
  for (let k = 0; k < 300; k++) {
    state.usedIds = new Set();
    for (let t = 0; t < 4; t++) {
      const groups = drawTurn().filter(w => w.quoteGroup !== null).map(w => w.quoteGroup);
      eq(new Set(groups).size, groups.length, `draw ${k}, turn ${t + 1}: no two words share a quote`);
    }
  }
});

testLive('Fill in the blank: every quoted main word can be blanked except ID 54 (flagged by the build)', () => {
  const unblankable = MAIN.filter(w => w.quote && !blankQuote(w.word, w.quote).matched);
  eq(idsOf(unblankable), [54], 'only ID 54');
});

testLive('Stills: every main word’s image file is in assets/stills and loads (exact name, any case-sensitive host)', async () => {
  const files = [...new Set(MAIN.filter(w => w.imageFile).map(w => w.imageFile))];
  const failed = [];
  await Promise.all(files.map(f => new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => { failed.push(f); resolve(); };
    img.src = STILLS_DIR + encodeURIComponent(f);
  })));
  const failedIds = idsOf(MAIN.filter(w => failed.includes(w.imageFile)));
  eq(failedIds, [], `${failed.length} of ${files.length} stills failed to load (IDs listed)`);
});
