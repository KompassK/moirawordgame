// Sesquipedalian – game logic and screens.
// Plain JavaScript, no framework. Game state lives in memory only until
// step 3; a page refresh ends the game.

'use strict';

// --- UI text ----------------------------------------------------------------
// Every string the players see. British English, single quotes in prose.

const UI = {
  title: 'Sesquipedalian',
  tagline: 'A Moira Rose vocabulary game',

  // Front card. The intro wording is fixed; keep it as written.
  intro: [
    'We all love Moira Rose but it’s fair to say she was a sesquipedalian (that’s someone who uses too many long words). Still we can all learn from her wonderful use of words. The aim of this game is to test our knowledge and understanding of her vocabulary.',
  ],
  waysToPlay: 'There are three ways to play:',
  frontStart: 'Start',

  howToPlay: 'How to play',
  gameTypes: {
    define: {
      name: 'Define the word',
      blurb: 'Say what the word means. Hints cost points.',
      players: '2–⁠4 players.', // ⁠ (word joiner) keeps '2–4' on one line
      rules: [
        'Everyone takes a turn to be asked to define 10 words. The player on your left holds the phone and reads out the words for you to define: nine from the show’s dialogue and one Catherine O’Hara loquacity masterclass as a bonus. Once everyone has had a turn, that’s the end of the round. Highest scorer wins.',
        'For each word, say what it means. Guess it cold for 4 points. You can ask to hear the full quote – but if you do, your score will drop to 3 points. Ask to see a photo of the scene with the quote and the score drops to 2. A wrong guess always drops your possible points for that word to 1, but you can keep going with hints and get the point if you get it right. Any real meaning of the word counts, including the one Moira had in mind.',
        'The bonus word has no quote. Guess it cold for 5 points, or hear it in an invented sentence first for 3. Guess wrong, then hear the sentence and get it right, for 2.',
        'The asker judges. Adults decide what’s close enough.',
      ],
    },
    blank: {
      name: 'Fill in the blank',
      blurb: 'Supply the missing word from the quote.',
      players: '2–⁠4 players.',
      rules: [
        'Everyone takes a turn. The player on your left holds the phone and reads out a line from the show with one word missing. Say the missing word.',
        'One guess, no hints: 1 point for each right answer. Once everyone has had a turn, that’s the end of the round. Highest scorer wins.',
        'The lines come from words you’ve already met in Define the word, so play that first.',
        'The asker judges. Adults decide what’s close enough.',
      ],
    },
    episode: {
      name: 'Name the episode',
      blurb: 'Which season and episode is the quote from?',
      players: '2–⁠4 players.',
      rules: [
        'Everyone takes a turn. The player on your left holds the phone, reads out a quote from the show and shows you the photo of the scene if there is one. Name the season, then the episode.',
        'The right season scores 1 point; get the episode right too and it’s 3. A wrong season scores nothing. Once everyone has had a turn, that’s the end of the round. Highest scorer wins.',
        'The quotes come from words you’ve already met in Define the word, so play that first.',
      ],
    },
  },
  lockedNote: 'Play a Define the word game first to unlock this mode',
  back: '‹ Back',
  playersHeading: 'Number of players',
  namesHeading: 'Names, in seating order (clockwise)',
  defaultName: n => `Player ${n}`,
  notEnoughWords: max => `There are only enough words for ${max} players at the moment.`,
  startGame: 'Start the game',
  rulesLink: 'Rules',
  close: 'Close',

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
  showPhotoAgain: 'Show the photo again',
  correct: 'Correct',
  wrong: 'Wrong',
  giveUp: 'Give up',
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
  revealWrong: (word, definition) => `Sorry, that’s not right – ${word} means ${asClause(definition)}.`,
  revealMeaning: (word, definition) => `${word} means ${asClause(definition)}.`,
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

  tiebreak: 'Tiebreak',
  tiebreakNote: 'The tied players take turns with Catherine O’Hara bonus words. After each round, whoever is ahead wins.',
  tiebreakMeta: (name, round) => `Tiebreak · Round ${round} · Testing: ${name}`,
  tiebreakRound: round => `Tiebreak – round ${round}`,
  tiebreakStillLevel: names => `Still level: ${joinNames(names)}. Another round.`,
  wonOnTiebreak: 'Won on the tiebreak',
  draw: 'Draw',
  drawNote: names => `The bonus words have run out, so it’s a draw between ${joinNames(names)}.`,

  endGame: 'End game',
  endConfirm: 'End this game? Scores will be lost.',
  endYes: 'End game',
  endNo: 'Keep playing',

  noData: 'The word list didn’t load. Run npm run build, then reload this page.',
};

// --- constants --------------------------------------------------------------

const MAIN_PER_TURN = 9;
const QUESTIONS_PER_TURN = MAIN_PER_TURN + 1; // plus the bonus word, always last
// Every way to play needs a tester and an answerer, so 2–4 players (one family of four).
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;

// Options 2 and 3 unlock in step 3; until then only Define the word is open.
function isUnlocked(type) {
  return type === 'define';
}
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
  screen: 'front',          // front | setup | handover | question | photo | reveal | pass | final
  overlay: null,            // null | 'rules' | 'confirmEnd'
  setup: { type: 'define', count: 2, names: [] },
  players: [],              // { name, score }
  turn: 0,                  // index of the current answerer
  turnScore: 0,
  questions: [],            // this turn's ten words
  qIndex: 0,
  q: null,                  // state of the current question
  history: [],              // snapshots of q before each tap this question (for undo)
  undo: null,               // snapshot from before the tap that ended the question
  result: null,             // { correct, points } for the reveal card
  usedIds: new Set(),       // words already drawn this game
  tiebreak: null,           // see startTiebreak()
};

function newQuestion(word) {
  return word.pool === 'bonus'
    // phase: start | guessing | coldWrong | sentence
    ? { word, kind: 'bonus', phase: 'start', coldTried: false, note: null }
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
const inGame = () => !['front', 'setup', 'final'].includes(state.screen);

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
  const bonus = drawBonus();
  const turn = [...picked, bonus].filter(Boolean);
  turn.forEach(w => state.usedIds.add(w.id));
  return turn;
}

// A bonus word not yet drawn this game, or undefined if none are left.
function drawBonus() {
  return shuffle(BONUS_POOL.filter(w => !state.usedIds.has(w.id)))[0];
}

const bonusLeft = () => BONUS_POOL.filter(w => !state.usedIds.has(w.id)).length;

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
  if (document.visibilityState === 'visible' && inGame()) keepAwake(true);
});

// --- game flow --------------------------------------------------------------

function startGame(names) {
  state.players = names.map(name => ({ name, score: 0 }));
  state.usedIds = new Set();
  state.tiebreak = null;
  state.turn = 0;
  keepAwake(true);
  startTurn();
  state.screen = 'handover';
}

function startTurn() {
  state.turnScore = 0;
  state.questions = drawTurn();
  state.qIndex = 0;
  setQuestion(state.questions[0]);
}

function setQuestion(word) {
  state.q = newQuestion(word);
  state.history = [];
  state.undo = null;
}

// Call before any tap that changes the question, so 'Oops, go back' can restore it.
function remember() {
  state.history.push(structuredClone(state.q));
}

function endQuestion(correct, points) {
  state.undo = {
    q: structuredClone(state.q),
    history: state.history.slice(),
    turnScore: state.turnScore,
    score: answerer().score,
  };
  state.turnScore += points;
  answerer().score += points;
  state.result = { correct, points };
  state.screen = 'reveal';
}

// Undo on the reveal card: back to the question as it was before the last tap.
function undoReveal() {
  const u = state.undo;
  if (!u) return;
  state.q = u.q;
  state.history = u.history;
  state.turnScore = u.turnScore;
  answerer().score = u.score;
  state.undo = null;
  state.result = null;
  state.screen = 'question';
}

// Undo on the question screen: step back one tap.
function undoTap() {
  if (!state.history.length) return;
  state.q = state.history.pop();
}

function nextQuestion() {
  if (state.tiebreak) return nextTiebreakQuestion();
  state.qIndex++;
  if (state.qIndex < state.questions.length) {
    setQuestion(state.questions[state.qIndex]);
    state.screen = 'question';
  } else if (isLastTurn()) {
    finishGame();
  } else {
    state.screen = 'pass';
  }
}

function beginNextTurn() {
  state.turn++;
  startTurn();
  state.screen = 'question';
}

function finishGame() {
  keepAwake(false);
  state.screen = 'final';
}

function leaders(players) {
  const top = Math.max(...players.map(p => p.score));
  return players.filter(p => p.score === top);
}

// --- tiebreak ---------------------------------------------------------------
// The tied players, in seating order, each answer one bonus word per round
// (tester: the next player round the table, as usual). After each full round
// whoever is ahead wins; anyone behind the leaders drops out; if the bonus
// words can't cover another full round, it's a draw.

function startTiebreak() {
  state.tiebreak = {
    contenders: leaders(state.players),
    round: 0,
    index: 0,
    outcome: null,          // null | 'won' | 'draw'
    stillLevel: false,
  };
  keepAwake(true);
  startTiebreakRound();
}

function startTiebreakRound() {
  const tb = state.tiebreak;
  if (bonusLeft() < tb.contenders.length) {
    tb.outcome = 'draw';
    finishGame();
    return;
  }
  tb.round++;
  tb.index = 0;
  queueTiebreakWord();
}

function queueTiebreakWord() {
  const tb = state.tiebreak;
  const word = drawBonus();
  state.usedIds.add(word.id);
  state.turn = state.players.indexOf(tb.contenders[tb.index]);
  state.turnScore = 0;
  setQuestion(word);
  state.screen = 'pass';
}

function nextTiebreakQuestion() {
  const tb = state.tiebreak;
  tb.stillLevel = false;
  if (tb.index < tb.contenders.length - 1) {
    tb.index++;
    queueTiebreakWord();
    return;
  }
  // End of a round.
  const ahead = leaders(tb.contenders);
  if (ahead.length === 1) {
    tb.outcome = 'won';
    finishGame();
    return;
  }
  tb.contenders = ahead;
  tb.stillLevel = true;
  startTiebreakRound();
}

// --- actions ----------------------------------------------------------------
// Buttons carry data-action; one click handler dispatches here.

const actions = {
  selectType(el) {
    if (isUnlocked(el.dataset.value)) state.setup.type = el.dataset.value;
  },
  frontStart() {
    state.screen = 'setup';
  },
  back() {
    state.screen = 'front';
  },
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
    if (q.hints >= LAST_RUNG) {           // photo already seen: show it again, points unchanged
      state.screen = 'photo';
      return;
    }
    remember();
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
      remember();
      q.capped = true;
      q.note = UI.cappedNote;
    } else {
      endQuestion(false, 0);
    }
  },

  // Bonus word
  bonusGuess() {
    remember();
    state.q.phase = 'guessing';
    state.q.note = UI.bonusGuessingNote;
  },
  bonusSentence() {
    remember();
    state.q.phase = 'sentence';
    state.q.note = UI.bonusSentenceNote;
  },
  bonusCorrect() {
    endQuestion(true, bonusPoints(state.q));
  },
  bonusWrong() {
    const q = state.q;
    if (q.phase === 'guessing' && q.word.exampleSentence) {
      remember();
      q.coldTried = true;
      q.phase = 'coldWrong';
      q.note = UI.bonusColdWrongNote;
    } else {
      endQuestion(false, 0);              // after the sentence, or no sentence to fall back on
    }
  },

  giveUp() {
    endQuestion(false, 0);
  },
  undoTap,
  undo: undoReveal,
  next: nextQuestion,
  nextTurn() {
    if (state.tiebreak) state.screen = 'question';
    else beginNextTurn();
  },

  playAgain() {
    startGame(state.players.map(p => p.name));
  },
  newGame() {
    state.tiebreak = null;
    state.screen = 'setup';
  },
  tiebreak: startTiebreak,

  showRules() {
    state.overlay = 'rules';
  },
  askEnd() {
    state.overlay = 'confirmEnd';
  },
  closeOverlay() {
    state.overlay = null;
  },
  confirmEnd() {
    keepAwake(false);
    state.overlay = null;
    state.tiebreak = null;
    state.screen = 'front';
  },
};

// --- helpers ----------------------------------------------------------------

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// 'Utterly astonished.' -> 'utterly astonished', 'A frivolous…' -> 'a frivolous…',
// to follow '[Word] means'. Leaves 'I' and all-capital words (acronyms) alone.
function asClause(s) {
  const t = stripFullStop(s);
  const first = t.split(/[\s;,]/)[0];
  const lower = first === 'A' || /^[A-Z][a-z]/.test(first);
  return lower ? t[0].toLowerCase() + t.slice(1) : t;
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

function link(action, label, attrs = '') {
  return `<button type="button" class="link" data-action="${action}" ${attrs}>${esc(label)}</button>`;
}

function badge(points, dark = false) {
  return `<div class="points${dark ? ' points--dark' : ''}" aria-label="${esc(UI.pointsAvailable)}: ${points}">
    <span class="points__label">${esc(UI.pointsAvailable)}</span>
    <span class="points__value">${points}</span>
  </div>`;
}

function paragraphs(list, cls = '') {
  return list.map(p => `<p class="${cls}">${esc(p)}</p>`).join('');
}

function scoreList(players, highlight) {
  return `<ol class="scores">${players.map(p => `
    <li class="scores__row${p === highlight ? ' scores__row--active' : ''}">
      <span class="scores__name">${esc(p.name)}</span>
      <span class="scores__pts">${esc(UI.points(p.score))}</span>
    </li>`).join('')}</ol>`;
}

// Small controls under Correct / Wrong: Give up on the left, undo on the right.
function minorControls() {
  return `<div class="minor">
    ${link('giveUp', UI.giveUp)}
    ${link('undoTap', UI.undo, state.history.length ? '' : 'disabled')}
  </div>`;
}

// --- screens ----------------------------------------------------------------

// The three ways to play as selectable boxes. Locked ones show only the lock
// note; unlocked ones show their tag line and player range.
function renderTypes() {
  return Object.entries(UI.gameTypes).map(([key, t]) => {
    const open = isUnlocked(key);
    const on = key === state.setup.type;
    const cls = !open ? ' type--locked' : on ? ' type--on' : '';
    return `<button type="button" class="type${cls}" data-action="selectType" data-value="${key}"
      ${open ? `aria-pressed="${on}"` : 'disabled'}>
      <span class="type__name">${esc(t.name)}</span>
      <span class="type__blurb">${esc(open ? `${t.blurb} ${t.players}` : UI.lockedNote)}</span>
    </button>`;
  }).join('');
}

function renderFront() {
  return `<section class="screen front">
    <div class="front__body">
      <h1 class="display fit front__title">${esc(UI.title)}</h1>
      <p class="front__tagline">${esc(UI.tagline)}</p>
      <div class="prose">
        ${paragraphs(UI.intro)}
        <p>${esc(UI.waysToPlay)}</p>
      </div>
      <div class="types" role="group" aria-label="${esc(UI.waysToPlay)}">${renderTypes()}</div>
    </div>
    <div class="actions">${button('frontStart', UI.frontStart, 'btn--primary')}</div>
  </section>`;
}

// Most players the chosen way to play allows. Define the word is also capped
// by the word list (nine main words and one bonus word per player, no repeats).
function playerLimit(type) {
  return type === 'define' ? PLAYER_LIMIT : MAX_PLAYERS;
}

function renderSetup() {
  const s = state.setup;
  const min = MIN_PLAYERS;
  const max = playerLimit(s.type);
  s.count = Math.min(Math.max(s.count, min), Math.max(max, min));

  const counts = [];
  for (let n = min; n <= MAX_PLAYERS; n++) {
    const disabled = n > max;
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
    <header class="topbar">
      ${link('back', UI.back)}
      ${link('showRules', UI.rulesLink)}
    </header>
    <h1 class="display fit setup__title">${esc(UI.gameTypes[s.type].name)}</h1>
    <p class="setup__type">${esc(UI.howToPlay)}</p>
    <div class="setup__body">
      <div class="setup__col">
        <div class="prose">${paragraphs(UI.gameTypes[s.type].rules)}</div>
      </div>
      <div class="setup__col">
        <h2 class="label">${esc(UI.playersHeading)}</h2>
        <div class="segs" role="group">${counts.join('')}</div>
        ${max < MAX_PLAYERS ? `<p class="hint-text">${esc(UI.notEnoughWords(max))}</p>` : ''}
        <h2 class="label">${esc(UI.namesHeading)}</h2>
        <div class="names">${names.join('')}</div>
      </div>
    </div>
    <div class="actions">${button('start', UI.startGame, 'btn--primary')}</div>
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

function metaLine() {
  const tb = state.tiebreak;
  return tb
    ? UI.tiebreakMeta(answerer().name, tb.round)
    : UI.testing(answerer().name, state.qIndex + 1, state.questions.length);
}

function renderMain() {
  const q = state.q;
  const w = q.word;
  const quoteOn = q.hints >= 1;
  const hintLabel = q.hints === 0 ? UI.readQuote : q.hints === 1 ? UI.showPhoto : UI.showPhotoAgain;

  return `<section class="screen turn">
    <p class="turn__meta">${esc(metaLine())}</p>
    <div class="turn__grid">
      <div class="turn__word">
        <h1 class="display fit word">${esc(w.word)}</h1>
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
      ${button('hint', hintLabel, 'btn--hint')}
      ${button('mainCorrect', UI.correct, 'btn--correct')}
      ${button('mainWrong', UI.wrong, 'btn--wrong')}
      ${minorControls()}
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
    <p class="turn__meta">${esc(metaLine())}</p>
    <div class="turn__grid">
      <div class="turn__word">
        <p class="bonus-badge">${esc(UI.bonusBadge)}</p>
        <h1 class="display fit word">${esc(w.word)}</h1>
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
      ${minorControls()}
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
  const last = !state.tiebreak && state.qIndex === state.questions.length - 1 && isLastTurn();
  return `<section class="screen centre reveal ${r.correct ? 'reveal--right' : 'reveal--wrong'}">
    <div class="centre__body">
      <h1 class="reveal__line">${esc(r.correct ? UI.revealRight : UI.revealWrong(w.word, w.definition))}</h1>
      ${r.correct ? `<p class="reveal__meaning">${esc(UI.revealMeaning(w.word, w.definition))}</p>` : ''}
      ${scene ? `<p class="reveal__scene">${esc(UI.revealScene(w.sceneContext))}</p>` : ''}
      <p class="reveal__pts">${esc(UI.pointsScored(r.points))}</p>
      <p class="reveal__total">${esc(UI.runningTotal(answerer().name, answerer().score))}</p>
    </div>
    <div class="actions">
      ${button('next', last ? UI.finish : UI.next, 'btn--primary')}
      ${state.undo ? link('undo', UI.undo) : ''}
    </div>
  </section>`;
}

function renderPass() {
  const tb = state.tiebreak;
  let tester, lead, board, note;
  if (tb) {
    // Tiebreak: the question is already queued for the next contender.
    tester = testerOf(state.turn);
    lead = tb.stillLevel ? UI.tiebreakStillLevel(tb.contenders.map(p => p.name)) : UI.tiebreakRound(tb.round);
    board = scoreList(tb.contenders, answerer());
    note = UI.nextTurnNote(answerer().name, tester.name);
  } else {
    const nextTurn = state.turn + 1;
    tester = testerOf(nextTurn);
    lead = UI.turnScored(answerer().name, state.turnScore);
    board = scoreList(state.players, answerer());
    note = UI.nextTurnNote(state.players[nextTurn].name, tester.name);
  }
  return `<section class="screen centre">
    <div class="centre__body">
      <h1 class="display handover__title">${esc(UI.passTo(tester.name))}</h1>
      <p class="lead">${esc(lead)}</p>
      ${board}
      <p class="hint-text">${esc(note)}</p>
    </div>
    <div class="actions">
      ${button('nextTurn', UI.ready(tester.name), 'btn--primary')}
      <div class="minor">${link('showRules', UI.rulesLink)}${link('askEnd', UI.endGame)}</div>
    </div>
  </section>`;
}

function renderFinal() {
  const tb = state.tiebreak;
  const ranked = state.players.slice().sort((a, b) => b.score - a.score);
  const top = ranked[0].score;
  const level = leaders(state.players);

  let title, lead = '';
  if (tb && tb.outcome === 'won') {
    title = UI.winner(level[0].name);
    lead = UI.wonOnTiebreak;
  } else if (tb && tb.outcome === 'draw') {
    title = UI.draw;
    lead = UI.drawNote(tb.contenders.map(p => p.name));
  } else if (level.length > 1) {
    title = UI.tied;
    lead = UI.tiedNames(level.map(p => p.name), top);
  } else {
    title = UI.winner(level[0].name);
  }
  const offerTiebreak = !tb && level.length > 1;

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
      <h1 class="display fit final__title">${esc(title)}</h1>
      ${lead ? `<p class="lead">${esc(lead)}</p>` : ''}
      <ol class="final__list">${rows}</ol>
      ${offerTiebreak ? `<p class="hint-text">${esc(UI.tiebreakNote)}</p>` : ''}
    </div>
    <div class="actions">
      ${offerTiebreak ? button('tiebreak', UI.tiebreak, 'btn--primary') : ''}
      ${button('playAgain', UI.playAgain, offerTiebreak ? 'btn--secondary' : 'btn--primary')}
      ${button('newGame', UI.newGame, 'btn--secondary')}
      <div class="minor minor--centre">${link('askEnd', UI.endGame)}</div>
    </div>
  </section>`;
}

function renderRulesOverlay() {
  const types = Object.entries(UI.gameTypes).map(([key, t]) => `
    <h3 class="rules__type">${esc(t.name)}</h3>
    <div class="prose">${paragraphs(t.rules)}</div>`).join('');
  return `<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="rules-title">
    <div class="overlay__card overlay__card--rules">
      <div class="overlay__scroll">
        <h1 class="display fit front__title" id="rules-title">${esc(UI.title)}</h1>
        <p class="front__tagline">${esc(UI.tagline)}</p>
        <div class="prose">${paragraphs(UI.intro)}</div>
        <h2 class="label">${esc(UI.howToPlay)}</h2>
        ${types}
      </div>
      <div class="overlay__actions">${button('closeOverlay', UI.close, 'btn--primary')}</div>
    </div>
  </div>`;
}

function renderConfirmEnd() {
  return `<div class="overlay" role="alertdialog" aria-modal="true" aria-labelledby="end-title">
    <div class="overlay__card overlay__card--small">
      <p class="overlay__message" id="end-title">${esc(UI.endConfirm)}</p>
      <div class="overlay__actions">
        ${button('confirmEnd', UI.endYes, 'btn--primary')}
        ${button('closeOverlay', UI.endNo, 'btn--secondary')}
      </div>
    </div>
  </div>`;
}

function renderNoData() {
  return `<section class="screen centre"><div class="centre__body">
    <h1 class="display fit">${esc(UI.title)}</h1><p class="lead">${esc(UI.noData)}</p>
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
    case 'front': html = renderFront(); break;
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
  if (state.overlay === 'rules') html += renderRulesOverlay();
  if (state.overlay === 'confirmEnd') html += renderConfirmEnd();

  document.body.dataset.theme = theme;
  document.body.classList.toggle('has-overlay', Boolean(state.overlay));
  app.innerHTML = html;
  fitAll();

  // Start each new screen or question at the top.
  const key = `${state.screen}:${state.turn}:${state.qIndex}:${state.q && state.q.word.id}`;
  if (key !== lastScreenKey) window.scrollTo(0, 0);
  lastScreenKey = key;
}

// Keep headline text (title, word) on one line: shrink only if it would
// overflow its column. Words are never split; below MIN_FIT_PX it may wrap.
const MIN_FIT_PX = 28;

function fit(el) {
  el.style.fontSize = '';
  el.classList.remove('fit--wrap');
  const size = parseFloat(getComputedStyle(el).fontSize);
  const box = getComputedStyle(el.parentElement);
  const available = el.parentElement.clientWidth - parseFloat(box.paddingLeft) - parseFloat(box.paddingRight);
  if (el.scrollWidth <= available) return;
  const fitted = Math.floor(size * available / el.scrollWidth);
  if (fitted >= MIN_FIT_PX) el.style.fontSize = fitted + 'px';
  else { el.style.fontSize = MIN_FIT_PX + 'px'; el.classList.add('fit--wrap'); }
}

function fitAll() {
  document.querySelectorAll('.fit').forEach(fit);
}

window.addEventListener('resize', fitAll);
if (document.fonts) document.fonts.ready.then(fitAll);

document.addEventListener('click', e => {
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

// Escape closes an overlay.
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && state.overlay) { state.overlay = null; render(); }
});

render();
