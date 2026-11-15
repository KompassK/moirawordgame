// Step 5 tests: real stills, the placeholder fallback, the quote overlay,
// and the shared renderer. Uses the harness in step3.test.js and the helpers
// in step4.test.js. The four test stills are fixtures in assets/stills/.

'use strict';

const W = id => WORDS_BY_ID.get(id);
const STILL_16x9 = 9001, STILL_4x3_ON_PHOTO = 9002, STILL_1x1 = 9003, STILL_3x4 = 9004;

// Wait (up to `ms`) until check() is true.
async function until(check, ms = 4000, what = 'condition') {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error(`timed out waiting for ${what}`);
    await new Promise(r => setTimeout(r, 25));
  }
}

// Put a given word on the photo screen of an Option 1 game.
function showPhotoOf(id) {
  fresh();
  beginTestGame(2);
  setQuestion(W(id));
  state.screen = 'question'; render();
  tap('hint'); tap('hint');
  eq(state.screen, 'photo', 'photo screen');
  return document.querySelector('.photo .still');
}

test('Stills: a word’s still is assets/stills/<imageFile>; no imageFile → the placeholder', () => {
  eq(stillSrc(W(STILL_16x9)), './assets/stills/test-16x9.jpg', 'jpg fixture');
  eq(stillSrc(W(STILL_1x1)), './assets/stills/test-1x1.webp', 'webp fixture');
  withWords([[W(9010), { imageFile: null }]], () => {
    eq(stillSrc(W(9010)), PLACEHOLDER_STILL, 'no imageFile: placeholder');
  });
});

test('Stills: a file that fails to load falls back to the placeholder, silently', async () => {
  const word = W(9010);
  const restore = { ...word };
  Object.assign(word, { imageFile: 'definitely-not-there.jpg' });
  try {
    const still = showPhotoOf(9010);
    const img = still.querySelector('img');
    await until(() => img.getAttribute('src') === PLACEHOLDER_STILL, 4000, 'the placeholder');
    assert(failedStills.has('./assets/stills/definitely-not-there.jpg'), 'remembered as failed');
    render();
    eq(document.querySelector('.photo .still img').getAttribute('src'), PLACEHOLDER_STILL, 're-renders go straight to the placeholder');
    eq(document.querySelector('.photo').children.length, 1, 'no message shown, just the still');
  } finally { Object.assign(word, restore); }
});

test('Photo screen: the frame takes the image’s shape (3:4 portrait loads as 0.75), contain, nothing else on screen', async () => {
  const still = showPhotoOf(STILL_3x4);
  const img = still.querySelector('img');
  await until(() => img.complete && img.naturalWidth > 0, 4000, 'the 3:4 still to load');
  await until(() => Math.abs(parseFloat(still.style.getPropertyValue('--r')) - 0.75) < 0.001, 2000, '--r to become 0.75');
  eq(getComputedStyle(img).objectFit, 'contain', 'contain, not cover');
  const photo = document.querySelector('.photo');
  eq(photo.children.length, 1, 'only the still on the photo screen');
  tap('closePhoto');
  eq(state.screen, 'question', 'a tap anywhere returns');
});

test('Overlay: the quote is drawn over the still, the word in the display font', () => {
  const still = showPhotoOf(STILL_16x9);
  const band = still.querySelector('.still__band');
  assert(band, 'band drawn');
  eq(band.textContent.trim(), W(STILL_16x9).quote, 'the exact quote');
  const word = band.querySelector('.still__word');
  assert(word && word.textContent.toLowerCase().startsWith('flabbergasted'), 'the word marked');
  assert(getComputedStyle(word).fontFamily.includes('Josefin'), 'word in the display font');
  assert(!getComputedStyle(band.querySelector('.still__quote')).fontFamily.includes('Josefin'), 'the rest in the body font');
});

test('Overlay: skipped when quoteOnPhoto is true (the still already carries the quote)', () => {
  eq(W(STILL_4x3_ON_PHOTO).quoteOnPhoto, true, 'fixture is marked quoteOnPhoto');
  const still = showPhotoOf(STILL_4x3_ON_PHOTO);
  assert(still, 'still shown');
  assert(!still.querySelector('.still__band'), 'no band');
  assert(!document.querySelector('.photo').textContent.trim(), 'no text at all');
});

test('Overlay text is at least 24px on a phone-sized photo screen', async () => {
  const still = showPhotoOf(STILL_16x9);
  await until(() => still.querySelector('img').complete, 4000, 'load');
  assert(parseFloat(getComputedStyle(still.querySelector('.still__quote')).fontSize) >= 24, 'at least 24px');
});

test('Option 3 inline photo uses the same renderer, overlay included (and skipped for quoteOnPhoto)', () => {
  fresh();
  playedInDefine(18);
  beginOption('episode', 2);
  setQuestion(W(STILL_16x9)); render();
  const inline = document.querySelector('.turn .still.still--inline');
  assert(inline, 'inline still on the turn screen');
  assert(inline.querySelector('.still__band .still__word'), 'overlay included, word in the display font');
  setQuestion(W(STILL_4x3_ON_PHOTO)); render();
  assert(document.querySelector('.still--inline') && !document.querySelector('.still--inline .still__band'), 'quoteOnPhoto: image alone');
  tap('askEnd'); tap('confirmEnd');
});

test('Lazy loading: a word’s still is fetched when its question comes up, and the next word’s ahead of time', () => {
  fresh();
  beginTestGame(2);
  prefetchedStills.clear();
  state.questions = [W(STILL_1x1), W(STILL_3x4), ...state.questions.slice(2)];
  state.qIndex = 0;
  setQuestion(W(STILL_1x1));
  state.screen = 'pass'; render();
  eq(prefetchedStills.size, 0, 'nothing fetched before the question is on screen');
  state.screen = 'question'; render();
  assert(prefetchedStills.has(stillSrc(W(STILL_1x1))), 'current word’s still fetched');
  assert(prefetchedStills.has(stillSrc(W(STILL_3x4))), 'next word’s still pre-fetched');
  eq(prefetchedStills.size, 2, 'nothing else');
});
