// Moira Words – game logic and screens.
// Plain JavaScript, no framework. Game state lives in memory only (step 1);
// a page refresh ends the game.

'use strict';

// --- UI text ----------------------------------------------------------------
// Every string the players see. British English, single quotes in prose.

const UI = {
  title: 'Moira Words',
  tagline: 'A family game of Moira’s most magnificent words',
  gameTypeHeading: 'Game type',
  gameTypes: {
    define: { name: 'Define the word', blurb: 'Say what the word means. Hints cost points.' },
    blank: { name: 'Fill in the blank', blurb: 'Supply the missing word from the quote.' },
    episode: { name: 'Name the episode', blurb: 'Which season and episode is the quote from?' },
  },
  lockedNote: 'Play a Define the word game first to unlock this mode',
  playersHeading: 'Number of players',
  namesHeading: 'Names, in seating order (clockwise)',
  defaultName: n => `Player ${n}`,
  notEnoughWords: max => `There are only enough words for ${max} players at the moment.`,
  start: 'Start',

  passTo: name => `Pass the device to ${name}`,
  firstTurnNote: (answerer, tester) => `${tester} reads the questions to ${answerer}. ${answerer}, don’t look at the screen.`,
  turnScored: (name, pts) => `${name} scored ${pts} ${pts === 1 ? 'point' : 'points'} this turn`,
  nextTurnNote: (answerer, tester) => `Next: ${tester} reads to ${answerer}.`,
  ready: name => `I’m ${name}, ready`,

  testing: (name, q, of) => `Testing: ${name} · Question ${q} of ${of}`,
  pointsAvailable: 'Points available',
  testerOnly: 'For the tester only',
  definition: 'Definition',
  keywords: 'Accept answers like',
  anySense: 'Any of these senses counts',
  quoteLabel: 'The quote',
  sceneLabel: 'The scene',
  readQuote: 'Read the quote',
  showPhoto: 'Show the photo',
  photoShown: 'Photo shown',
  correct: 'Correct',
  wrong: 'Wrong',
  cappedNote: 'Not quite. This question is now worth 1 point – keep going.',
  lastChanceNote: 'Last hint used. One more guess.',
  photoBack: 'Tap anywhere to go back',

  bonusBadge: 'Catherine O’Hara bonus word',
  guess: 'Guess',
  hearSentence: 'Hear it in a sentence',
  sentenceShown: 'Sentence shown',
  sentenceCaption: 'Not a real quote – just for the game',
  bonusColdWrongNote: 'Not quite. Hear it in a sentence for one more guess.',
  bonusGuessingNote: 'Did they get it?',
  bonusSentenceNote: 'Read the sentence aloud. One guess.',

  revealRight: 'Yes, you’re right!',
  revealWrong: (word, definition) => `Sorry, that’s not right – ${word} means ${lowerFirst(stripFullStop(definition))}.`,
  // sceneContext is written to follow the lead-in, so it is used as-is.
  revealScene: scene => `In this scene, ${stripFullStop(scene)}.`,
  pointsScored: pts => (pts === 0 ? 'No points' : `+${pts} ${pts === 1 ? 'point' : 'points'}`),
  runningTotal: (name, total) => `${name}’s total: ${total}`,
  next: 'Next',
  finish: 'See the final scores',
  undo: 'Oops, go back',

  finalHeading: 'Final scores',
  winner: name => `${name} wins!`,
  tied: 'Tied',
  tiedNames: (names, pts) => `${joinNames(names)} – ${pts} ${pts === 1 ? 'point' : 'points'} each`,
  points: pts => `${pts} ${pts === 1 ? 'pt' : 'pts'}`,
  playAgain: 'Play again',
  newGame: 'New game',

  noData: 'The word list didn’t load. Run npm run build, then reload this page.',
};

// --- constants --------------------------------------------------------------

const MAIN_PER_TURN = 9;
const QUESTIONS_PER_TURN = MAIN_PER_TURN + 1; // plus the bonus word, always last
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;
const PLACEHOLDER_STILL = './assets/placeholder.svg';

// Main-pool hint ladder: points for a right answer after 0, 1 or 2 hints.
const LADDER = [4, 3, 2];
const CAPPED_POINTS = 1;
const LAST_RUNG = LADDER.length - 1;

// Bonus-word scoring (CLAUDE.md).
const BONUS = { cold: 5, sentenceFirst: 3, sentenceAfterWrong: 2 };

// --- data -------------------------------------------------------------------

const DATA = window.MOIRA_WORDS;
const MAIN = DATA ? DATA.words.filter(w => w.pool === 'main') : [];
const BONUS_POOL = DATA ? DATA.words.filter(w => w.pool === 'bonus') : [];

// Most players the word list can serve without repeating a word in a game.
const PLAYER_LIMIT = Math.min(MAX_PLAYERS, Math.floor(MAIN.length / MAIN_PER_TURN), BONUS_POOL.length);

// --- state ------------------------------------------------------------------

const state = {
  screen: 'setup',          // setup | handover | question | photo | reveal | pass | final
  setup: { count: 2, names: [] },
  players: [],              // { name, score }
  turn: 0,                  // index of the current answerer
  turnScore: 0,
  questions: [],            // this turn's ten words
  qIndex: 0,
  q: null,                  // state of the current question
  undo: null,               // snapshot from before the tap that ended the question
  result: null,             // { correct, points } for the reveal card
  usedIds: new Set(),       // words already drawn this game
};

function newQuestion(word) {
  return word.pool === 'bonus'
    ? { word, kind: 'bonus', phase: 'start', coldTried: false, note: null }
    // phase: start | guessing | coldWrong | sentence
    : { word, kind: 'main', hints: 0, capped: false, note: null };
}

function mainPoints(q) {
  return q.capped ? CAPPED_POINTS : LADDER[q.hints];
}

function bonusPoints(q) {
  if (q.phase === 'start' || q.phase === 'guessing') return BONUS.cold;
  if (q.phase === 'coldWrong') return BONUS.sentenceAfterWrong;
  return q.coldTried ? BONUS.sentenceAfterWrong : BONUS.sentenceFirst;
}

function pointsAvailable(q) {
  return q.kind === 'main' ? mainPoints(q) : bonusPoints(q);
}

const answerer = () => state.players[state.turn];
const testerOf = turn => state.players[(turn + 1) % state.players.length];
const isLastTurn = () => state.turn === state.players.length - 1;

// --- drawing words ----------------------------------------------------------

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Nine main words (no two from the same quote group in one turn) then one
// bonus word. No word is drawn twice in a game.
function drawTurn() {
  const picked = [];
  const groups = new Set();
  const skipped = [];
  for (const w of shuffle(MAIN.filter(w => !state.usedIds.has(w.id)))) {
    if (picked.length === MAIN_PER_TURN) break;
    if (w.quoteGroup !== null && groups.has(w.quoteGroup)) { skipped.push(w); continue; }
    picked.push(w);
    if (w.quoteGroup !== null) groups.add(w.quoteGroup);
  }
  // Only if the pool is too small to avoid it: fill with shared-quote siblings.
  while (picked.length < MAIN_PER_TURN && skipped.length) {
    console.warn('Not enough distinct quotes for this turn; allowing a shared-quote word.');
    picked.push(skipped.shift());
  }
  const bonus = shuffle(BONUS_POOL.filter(w => !state.usedIds.has(w.id)))[0];
  const turn = [...picked, bonus].filter(Boolean);
  turn.forEach(w => state.usedIds.add(w.id));
  return turn;
}

// --- screen wake lock -------------------------------------------------------

let wakeLock = null;

async function keepAwake(on) {
  try {
    if (on && !wakeLock && 'wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch (e) { /* not supported or not allowed: carry on */ }
}

// The browser drops the lock when the page is hidden; take it back on return.
document.addEventListener('visibilitychange', () => {
  const inGame = !['setup', 'final'].includes(state.screen);
  if (document.visibilityState === 'visible' && inGame) keepAwake(true);
});

// --- game flow --------------------------------------------------------------

function startGame(names) {
  state.players = names.map(name => ({ name, score: 0 }));
  state.usedIds = new Set();
  state.turn = 0;
  keepAwake(true);
  startTurn();
  state.screen = 'handover';
}

function startTurn() {
  state.turnScore = 0;
  state.questions = drawTurn();
  state.qIndex = 0;
  state.q = newQuestion(state.questions[0]);
  state.undo = null;
}

function endQuestion(correct, points) {
  state.undo = {
    q: structuredClone(state.q),
    turnScore: state.turnScore,
    score: answerer().score,
  };
  state.turnScore += points;
  answerer().score += points;
  state.result = { correct, points };
  state.screen = 'reveal';
}

function undoLastTap() {
  if (!state.undo) return;
  state.q = state.undo.q;
  state.turnScore = state.undo.turnScore;
  answerer().score = state.undo.score;
  state.undo = null;
  state.result = null;
  state.screen = 'question';
}

function nextQuestion() {
  state.undo = null;
  state.qIndex++;
  if (state.qIndex < state.questions.length) {
    state.q = newQuestion(state.questions[state.qIndex]);
    state.screen = 'question';
  } else if (isLastTurn()) {
    keepAwake(false);
    state.screen = 'final';
  } else {
    state.screen = 'pass';
  }
}

function beginNextTurn() {
  state.turn++;
  startTurn();
  state.screen = 'question';
}

// --- actions ----------------------------------------------------------------
// Buttons carry data-action; one click handler dispatches here.

const actions = {
  setCount(el) {
    state.setup.count = Number(el.dataset.value);
  },
  start() {
    const names = [];
    for (let i = 0; i < state.setup.count; i++) {
      names.push((state.setup.names[i] || '').trim() || UI.defaultName(i + 1));
    }
    startGame(names);
  },
  ready() {
    state.screen = 'question';
  },

  // Main-pool words
  hint() {
    const q = state.q;
    if (q.hints >= LAST_RUNG) return;
    q.hints++;
    q.note = null;
    if (q.hints === LAST_RUNG) {
      q.note = UI.lastChanceNote;
      state.screen = 'photo';
    }
  },
  closePhoto() {
    state.screen = 'question';
  },
  mainCorrect() {
    endQuestion(true, mainPoints(state.q));
  },
  mainWrong() {
    const q = state.q;
    if (q.hints < LAST_RUNG) {
      q.capped = true;
      q.note = UI.cappedNote;
    } else {
      endQuestion(false, 0);
    }
  },

  // Bonus word
  bonusGuess() {
    state.q.phase = 'guessing';
    state.q.note = UI.bonusGuessingNote;
  },
  bonusSentence() {
    state.q.phase = 'sentence';
    state.q.note = UI.bonusSentenceNote;
  },
  bonusCorrect() {
    endQuestion(true, bonusPoints(state.q));
  },
  bonusWrong() {
    const q = state.q;
    if (q.phase === 'guessing') {
      q.coldTried = true;
      if (q.word.exampleSentence) {
        q.phase = 'coldWrong';
        q.note = UI.bonusColdWrongNote;
      } else {
        endQuestion(false, 0); // no sentence to fall back on
      }
    } else {
      endQuestion(false, 0);
    }
  },

  undo: undoLastTap,
  next: nextQuestion,
  nextTurn: beginNextTurn,
  playAgain() {
    startGame(state.players.map(p => p.name));
  },
  newGame() {
    state.screen = 'setup';
  },
};

// --- helpers ----------------------------------------------------------------

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function lowerFirst(s) {
  // 'Utterly astonished' -> 'utterly astonished', but leave 'I', names and acronyms alone.
  return /^[A-Z][a-z]/.test(s) && !/^I\b/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;
}

function stripFullStop(s) {
  return s.replace(/[.\s]+$/, '');
}

function joinNames(names) {
  return names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names.at(-1);
}

function stillSrc(word) {
  // Real stills arrive in step 5 as ./assets/stills/<imageFile>.
  return PLACEHOLDER_STILL;
}

function button(action, label, cls = '', attrs = '') {
  return `<button type="button" class="btn ${cls}" data-action="${action}" ${attrs}>${esc(label)}</button>`;
}

function badge(points, dark = false) {
  return `<div class="points${dark ? ' points--dark' : ''}" aria-label="${esc(UI.pointsAvailable)}: ${points}">
    <span class="points__label">${esc(UI.pointsAvailable)}</span>
    <span class="points__value">${points}</span>
  </div>`;
}

function scoreList(players, highlight) {
  return `<ol class="scores">${players.map(p => `
    <li class="scores__row${p === highlight ? ' scores__row--active' : ''}">
      <span class="scores__name">${esc(p.name)}</span>
      <span class="scores__pts">${esc(UI.points(p.score))}</span>
    </li>`).join('')}</ol>`;
}

// --- screens ----------------------------------------------------------------

function renderSetup() {
  const s = state.setup;
  s.count = Math.min(s.count, Math.max(PLAYER_LIMIT, MIN_PLAYERS));
  const types = Object.entries(UI.gameTypes).map(([key, t]) => {
    const on = key === 'define';
    return `<div class="type${on ? ' type--on' : ' type--locked'}" ${on ? 'aria-current="true"' : 'aria-disabled="true"'}>
      <span class="type__name">${esc(t.name)}</span>
      <span class="type__blurb">${esc(on ? t.blurb : UI.lockedNote)}</span>
    </div>`;
  }).join('');

  const counts = [];
  for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n++) {
    const disabled = n > PLAYER_LIMIT;
    counts.push(`<button type="button" class="seg${n === s.count ? ' seg--on' : ''}" data-action="setCount" data-value="${n}"
      ${disabled ? 'disabled' : ''} aria-pressed="${n === s.count}">${n}</button>`);
  }

  const names = [];
  for (let i = 0; i < s.count; i++) {
    names.push(`<label class="name">
      <span class="name__num">${i + 1}</span>
      <input type="text" data-name="${i}" value="${esc(s.names[i] || '')}" placeholder="${esc(UI.defaultName(i + 1))}"
        autocomplete="off" autocapitalize="words" enterkeyhint="next" maxlength="20">
    </label>`);
  }

  return `<section class="screen setup">
    <header class="setup__head">
      <h1 class="display setup__title">${esc(UI.title)}</h1>
      <p class="setup__tagline">${esc(UI.tagline)}</p>
    </header>
    <div class="setup__body">
      <div class="setup__col">
        <h2 class="label">${esc(UI.gameTypeHeading)}</h2>
        <div class="types">${types}</div>
      </div>
      <div class="setup__col">
        <h2 class="label">${esc(UI.playersHeading)}</h2>
        <div class="segs" role="group">${counts.join('')}</div>
        ${PLAYER_LIMIT < MAX_PLAYERS ? `<p class="hint-text">${esc(UI.notEnoughWords(PLAYER_LIMIT))}</p>` : ''}
        <h2 class="label">${esc(UI.namesHeading)}</h2>
        <div class="names">${names.join('')}</div>
      </div>
    </div>
    <div class="actions">${button('start', UI.start, 'btn--primary')}</div>
  </section>`;
}

function renderHandover() {
  const tester = testerOf(state.turn);
  return `<section class="screen centre">
    <div class="centre__body">
      <h1 class="display handover__title">${esc(UI.passTo(tester.name))}</h1>
      <p class="lead">${esc(UI.firstTurnNote(answerer().name, tester.name))}</p>
    </div>
    <div class="actions">${button('ready', UI.ready(tester.name), 'btn--primary')}</div>
  </section>`;
}

function renderMain() {
  const q = state.q;
  const w = q.word;
  const quoteOn = q.hints >= 1;
  const hintLabel = q.hints === 0 ? UI.readQuote : q.hints === 1 ? UI.showPhoto : UI.photoShown;

  return `<section class="screen turn">
    <p class="turn__meta">${esc(UI.testing(answerer().name, state.qIndex + 1, state.questions.length))}</p>
    <div class="turn__grid">
      <div class="turn__word">
        <h1 class="display word">${esc(w.word)}</h1>
        ${badge(pointsAvailable(q))}
        ${q.note ? `<p class="note" role="status">${esc(q.note)}</p>` : ''}
      </div>
      <div class="turn__panel">
        <div class="panel">
          <p class="panel__tag">${esc(UI.testerOnly)}</p>
          <p class="panel__label">${esc(w.twist ? UI.anySense : UI.definition)}</p>
          <p class="panel__def">${esc(w.definition)}</p>
          ${w.twist ? `<p class="panel__def panel__def--twist">${esc(w.twist)}</p>` : ''}
          <p class="panel__label">${esc(UI.keywords)}</p>
          <p class="panel__kw">${esc(w.keywords)}</p>
        </div>
        ${w.quote ? `<div class="reveal-block${quoteOn ? ' is-on' : ''}">
          <p class="panel__label">${esc(UI.quoteLabel)}</p>
          <blockquote class="quote">${esc(w.quote)}</blockquote>
        </div>` : ''}
        ${w.sceneContext ? `<div class="reveal-block${quoteOn ? ' is-on' : ''}">
          <p class="panel__label">${esc(UI.sceneLabel)}</p>
          <p class="scene">${esc(w.sceneContext)}</p>
        </div>` : ''}
      </div>
    </div>
    <div class="actions actions--turn">
      ${button('hint', hintLabel, 'btn--hint', q.hints >= LAST_RUNG ? 'disabled' : '')}
      ${button('mainCorrect', UI.correct, 'btn--correct')}
      ${button('mainWrong', UI.wrong, 'btn--wrong')}
    </div>
  </section>`;
}

function renderBonus() {
  const q = state.q;
  const w = q.word;
  const hasSentence = Boolean(w.exampleSentence);
  const sentenceOn = q.phase === 'sentence';
  const judging = q.phase === 'guessing' || q.phase === 'sentence';
  const canHear = hasSentence && (q.phase === 'start' || q.phase === 'coldWrong');

  return `<section class="screen turn turn--bonus">
    <p class="turn__meta">${esc(UI.testing(answerer().name, state.qIndex + 1, state.questions.length))}</p>
    <div class="turn__grid">
      <div class="turn__word">
        <p class="bonus-badge">${esc(UI.bonusBadge)}</p>
        <h1 class="display word">${esc(w.word)}</h1>
        ${badge(pointsAvailable(q), true)}
        ${q.note ? `<p class="note" role="status">${esc(q.note)}</p>` : ''}
        ${sentenceOn ? `<figure class="invented">
          <p class="invented__text">${esc(w.exampleSentence)}</p>
          <figcaption class="invented__caption">${esc(UI.sentenceCaption)}</figcaption>
        </figure>` : ''}
      </div>
      <div class="turn__panel">
        <div class="panel panel--dark">
          <p class="panel__tag">${esc(UI.testerOnly)}</p>
          <p class="panel__label">${esc(UI.definition)}</p>
          <p class="panel__def">${esc(w.definition)}</p>
          <p class="panel__label">${esc(UI.keywords)}</p>
          <p class="panel__kw">${esc(w.keywords)}</p>
        </div>
      </div>
    </div>
    <div class="actions actions--turn">
      ${button('bonusSentence', sentenceOn ? UI.sentenceShown : UI.hearSentence, 'btn--hint', canHear ? '' : 'disabled')}
      ${judging
        ? button('bonusCorrect', UI.correct, 'btn--correct') + button('bonusWrong', UI.wrong, 'btn--wrong')
        : button('bonusGuess', UI.guess, 'btn--primary btn--span', q.phase === 'coldWrong' ? 'disabled' : '')}
    </div>
  </section>`;
}

function renderPhoto() {
  const w = state.q.word;
  const overlay = w.quote && !w.quoteOnPhoto;
  return `<section class="photo" data-action="closePhoto" role="button" aria-label="${esc(UI.photoBack)}">
    <img class="photo__img" src="${esc(stillSrc(w))}" alt="">
    ${overlay ? `<div class="photo__band"><p class="photo__quote">${esc(w.quote)}</p></div>` : ''}
    <p class="photo__back">${esc(UI.photoBack)}</p>
  </section>`;
}

function renderReveal() {
  const w = state.q.word;
  const r = state.result;
  const scene = w.pool === 'main' && w.sceneContext;
  const last = state.qIndex === state.questions.length - 1 && isLastTurn();
  return `<section class="screen centre reveal ${r.correct ? 'reveal--right' : 'reveal--wrong'}">
    <div class="centre__body">
      <h1 class="display reveal__line">${esc(r.correct ? UI.revealRight : UI.revealWrong(w.word, w.definition))}</h1>
      ${scene ? `<p class="reveal__scene">${esc(UI.revealScene(w.sceneContext))}</p>` : ''}
      <p class="reveal__pts">${esc(UI.pointsScored(r.points))}</p>
      <p class="reveal__total">${esc(UI.runningTotal(answerer().name, answerer().score))}</p>
    </div>
    <div class="actions">
      ${button('next', last ? UI.finish : UI.next, 'btn--primary')}
      ${state.undo ? button('undo', UI.undo, 'btn--link') : ''}
    </div>
  </section>`;
}

function renderPass() {
  const nextTurn = state.turn + 1;
  const nextAnswerer = state.players[nextTurn];
  const nextTester = testerOf(nextTurn);
  return `<section class="screen centre">
    <div class="centre__body">
      <h1 class="display handover__title">${esc(UI.passTo(nextTester.name))}</h1>
      <p class="lead">${esc(UI.turnScored(answerer().name, state.turnScore))}</p>
      ${scoreList(state.players, answerer())}
      <p class="hint-text">${esc(UI.nextTurnNote(nextAnswerer.name, nextTester.name))}</p>
    </div>
    <div class="actions">${button('nextTurn', UI.ready(nextTester.name), 'btn--primary')}</div>
  </section>`;
}

function renderFinal() {
  const ranked = state.players.slice().sort((a, b) => b.score - a.score);
  const top = ranked[0].score;
  const leaders = ranked.filter(p => p.score === top);
  const tied = leaders.length > 1;

  let rank = 0;
  const rows = ranked.map((p, i) => {
    if (i === 0 || p.score !== ranked[i - 1].score) rank = i + 1;
    return `<li class="final__row${p.score === top ? ' final__row--win' : ''}">
      <span class="final__rank">${rank}</span>
      <span class="final__name">${esc(p.name)}</span>
      <span class="final__pts">${esc(UI.points(p.score))}</span>
    </li>`;
  }).join('');

  return `<section class="screen centre final">
    <div class="centre__body">
      <p class="label">${esc(UI.finalHeading)}</p>
      <h1 class="display final__title">${esc(tied ? UI.tied : UI.winner(leaders[0].name))}</h1>
      ${tied ? `<p class="lead">${esc(UI.tiedNames(leaders.map(p => p.name), top))}</p>` : ''}
      <ol class="final__list">${rows}</ol>
    </div>
    <div class="actions">
      ${button('playAgain', UI.playAgain, 'btn--primary')}
      ${button('newGame', UI.newGame, 'btn--secondary')}
    </div>
  </section>`;
}

function renderNoData() {
  return `<section class="screen centre"><div class="centre__body">
    <h1 class="display">${esc(UI.title)}</h1><p class="lead">${esc(UI.noData)}</p>
  </div></section>`;
}

// --- render loop ------------------------------------------------------------

const app = document.getElementById('app');
let lastScreenKey = '';

function render() {
  let html;
  let theme = 'light';
  if (!DATA || PLAYER_LIMIT < MIN_PLAYERS) html = renderNoData();
  else switch (state.screen) {
    case 'setup': html = renderSetup(); break;
    case 'handover': html = renderHandover(); break;
    case 'question':
      html = state.q.kind === 'bonus' ? renderBonus() : renderMain();
      if (state.q.kind === 'bonus') theme = 'dark';
      break;
    case 'photo': html = renderPhoto(); theme = 'photo'; break;
    case 'reveal': html = renderReveal(); break;
    case 'pass': html = renderPass(); break;
    case 'final': html = renderFinal(); break;
  }
  document.body.dataset.theme = theme;
  app.innerHTML = html;

  fitWord();

  // Start each new screen or question at the top.
  const key = `${state.screen}:${state.turn}:${state.qIndex}`;
  if (key !== lastScreenKey) window.scrollTo(0, 0);
  lastScreenKey = key;
}

// Keep the headline word on one line: shrink it only if it would overflow its
// column. Words are never split; below MIN_WORD_PX it is allowed to wrap.
const MIN_WORD_PX = 32;

function fitWord() {
  const el = app.querySelector('.word');
  if (!el) return;
  el.style.fontSize = '';
  el.classList.remove('word--wrap');
  const size = parseFloat(getComputedStyle(el).fontSize);
  const available = el.parentElement.clientWidth;
  if (el.scrollWidth <= available) return;
  const fitted = Math.floor(size * available / el.scrollWidth);
  if (fitted >= MIN_WORD_PX) el.style.fontSize = fitted + 'px';
  else { el.style.fontSize = MIN_WORD_PX + 'px'; el.classList.add('word--wrap'); }
}

window.addEventListener('resize', fitWord);
if (document.fonts) document.fonts.ready.then(fitWord);

app.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled || !actions[el.dataset.action]) return;
  actions[el.dataset.action](el);
  render();
});

app.addEventListener('input', e => {
  const i = e.target.dataset.name;
  if (i !== undefined) state.setup.names[Number(i)] = e.target.value;
});

// Enter in a name field moves to the next one, then starts the game.
app.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.target.dataset.name === undefined) return;
  e.preventDefault();
  const next = app.querySelector(`[data-name="${Number(e.target.dataset.name) + 1}"]`);
  if (next) next.focus();
  else { actions.start(); render(); }
});

render();
