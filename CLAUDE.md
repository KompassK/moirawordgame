# Sesquipedalian – project brief

Ground truth for every build step. Read it in full before changing anything. When a step adds detail, record it here.

## Purpose

**Sesquipedalian** is a Moira Rose vocabulary game for one family of four. One device is passed round the table and read aloud: the tester holds it and reads, the answerer guesses without seeing the screen. Single-page web app, no back end.

The repo (`KompassK/moirawordgame`) and folder (`moira-words`) keep their old names so the web address doesn't change: https://kompassk.github.io/moirawordgame/. Internal names such as `window.MOIRA_WORDS` also stay.

## Tech constraints

- Plain HTML, CSS and JavaScript. No framework, no bundler, no TypeScript, no build step for the app itself.
- Static files only. Must run by double-clicking `index.html` (`file://`) and from GitHub Pages. Keep every path relative (`./…`) because Pages serves from a sub-path.
- Node is used **only** for the build script (`npm run build`), never at runtime. `xlsx` (SheetJS, from the SheetJS CDN) is the only dependency.
- No accounts, no analytics, no sharing, **no third-party requests** (fonts are self-hosted; the game works offline). All persistence is `localStorage` (from step 3; until then the game lives in memory, so a refresh ends it).
- PWA manifest and service worker are added at build step 6. Hooks are marked in `index.html`; don't add them early. Once there is a service worker, bump its cache version every time a cached file changes, and cache `assets/fonts/`.
- Primary target: phone in portrait. Must also work on a tablet in either orientation.
- Keep the screen awake during a game with the Wake Lock API where supported; ignore silently if not.

### Files

| File | Role |
|---|---|
| `index.html` | Shell: `style.css`, then `words.js`, then `game.js`. No external links. |
| `style.css` | All styling, including the `@font-face` rules. Colour tokens on `:root`. |
| `game.js` | All game logic and screens. **Every UI string lives in the `UI` object at the top**, including the front-card and how-to-play text. |
| `words.js` | Generated. `window.MOIRA_WORDS = {…}`, loaded with a plain `<script>` so `file://` works (browsers block `fetch` from `file://`). |
| `words.json` | Generated. Same data, kept for reference. |
| `assets/fonts/` | Josefin Sans variable woff2 (Latin, Latin Extended), weights 100–700 in one file each, plus its licence `OFL.txt`. |
| `assets/placeholder.svg` | Scene still used for every word until step 5. Real stills go in `assets/stills/<imageFile>`; `stillSrc()` in `game.js` is the one place to switch. |
| `scripts/build-words.js` | Spreadsheet → `words.json` + `words.js`. |

## Look and feel

- **Black, white and greys only.** Background white (`#ffffff`; never darker than `#fafafa`), ink `#111111`, greys for panels (`#f5f5f5`), pills (`#ececec`), rules and muted text. No cream, brown, gold or rose. **The only colours anywhere are green `#35664a` on Correct and red `#a13c33` on Wrong.** (End game's confirm button is black, not red.)
- **Type:** Josefin Sans (self-hosted from `assets/fonts/`) for the title, the headline word, handover and final headings, badges, labels and buttons – always in **capitals with 0.08em letter-spacing**, like signage. Body text, the tester panel's definitions, quotes, the reveal card's sentences and small links use the system sans-serif. Josefin sits high in its line box, so signage elements get a little extra top padding.
- **Headline sizes:** the word aims for at least 44px on a phone and 72px on a tablet and is **always on one line**; `fitAll()` shrinks any `.fit` element (title, word, final heading) only if it would overflow its column (never below 28px, when it may wrap). Josefin capitals are wide, so on the dummy list: phone – 19 of 50 words shrink below 44px (smallest 33px, 'Discombobulate'); tablet portrait – 7 below 72px (smallest 62px); tablet landscape – none (smallest 86px). Accepted in step 2.
- Buttons are at least 56px tall (60px phone, 68px tablet); Correct and Wrong are taller still.
- Phone: turn-screen buttons are full width and **pinned to the bottom**, always in the same order – hint, Correct, Wrong – with two small text controls under them: **Give up** (left) and **Oops, go back** (right).
- Tablets, both orientations: the word full width on top; tester panel beside the quote and scene below; hint, Correct and Wrong in one row. (Step 1's two-column landscape layout was dropped because Josefin capitals don't fit a half-width column.)
- Bonus word screen: black background, white text – visibly different, within the palette.
- Tested at 390×844, 768×1024 and 1024×768.

## Data: spreadsheet → `words.json`

`scripts/build-words.js` reads the first `.xlsx` in `data/` (skipping Excel `~$` lock files), sheet `Words`, row 1 = headers. Columns are matched by **exact header text**, never by position. The build fails loudly if a required header is missing, if any Y/T row has an empty Word, Definition or Keywords, or on a bad ID, Include value or season/episode number.

| Header (exact) | JSON field | Notes |
|---|---|---|
| `ID` | `id` | integer, unique |
| `Word` | `word` | |
| `Definition (game answer)` | `definition` | |
| `Acceptable gist / keywords for judging` | `keywords` | one string; semicolons may separate alternative senses; kept as-is |
| `Moira's twist (other sense / how she bends it)` | `twist` | null if empty |
| `Quote` | `quote` | **never altered by code**; null if empty |
| `Season` | `season` | integer or null |
| `Episode` | `episode` | integer or null |
| `Episode title` | `episodeTitle` | null if empty |
| `Scene context` | `sceneContext` | null if empty; written to follow the lead-in 'In this scene, ' |
| `Image file` | `imageFile` | null if empty |
| `Quote printed on photo? (Y/N)` | `quoteOnPhoto` | boolean |
| `Include in game? (Y/N)` | `pool` | `"main"` for Y, `"bonus"` for T; N or blank rows are dropped |
| `Invented example sentence (bonus hint - NOT a real show quote)` | `exampleSentence` | null if empty; only bonus words have one |
| *(derived)* | `quoteGroup` | words with identical quote text (trimmed, whitespace collapsed) share an integer id; no quote → null |

All other columns are ignored. `Bonus point available? (Y/N)` is retired; do not read it. `clues on where its'f rom`, `Timestamp`, `Image type`, `Sources`, `Verification` and `Notes / issues` are editorial.

```json
{
  "generatedAt": "ISO timestamp",
  "source": "filename of the xlsx",
  "words": [ { "id": 9001, "word": "…", "definition": "…", "keywords": "…", "twist": null,
               "quote": "…", "quoteGroup": 1, "season": 1, "episode": 1, "episodeTitle": "…",
               "sceneContext": "…", "imageFile": "…", "quoteOnPhoto": false,
               "pool": "main", "exampleSentence": null } ]
}
```

`data/` currently holds a **dummy** test set (36 main, 14 bonus, no shared quotes). It is swapped for the live file, same column layout, at build step 7. Rebuild and commit `words.json` and `words.js` whenever the spreadsheet changes.

## Screens and flow

**Front card** (on opening, and after End game) → **How to play** (players and names) → handover → turns → reveal after every word → pass-the-device between turns → **final scoreboard** → optional **tiebreak**.

### Front card
- The title 'Sesquipedalian', large; the line 'A Moira Rose vocabulary game'; then this intro, **word for word** (in `UI.intro`):
  > We all love Moira Rose but it's fair to say she was a sesquipedalian. Still we can all learn from her wonderful use of words. The aim of this game is to test our knowledge and understanding of her vocabulary. Highest score wins.
- Then 'There are three ways to play:' and the **three way-to-play boxes**, where the way to play is chosen:
  - **Define the word** – 'Say what the word means. Hints cost points. 2–4 players.'
  - **Fill in the blank** – 'Supply the missing word from the quote. 2–4 players.'
  - **Name the episode** – 'Which season and episode is the quote from? 2–4 players.'
  - A locked box is dashed, greyed, can't be chosen, and shows **only** 'Play a Define the word game first to unlock this mode' – no tag line, no player range. Its tag line and player range appear once it unlocks (`isUnlocked()` in `game.js`; only Define the word until step 3). A word joiner keeps '2–4' together on one line.
- A big **Start** button goes to How to play.

### Rules overlay
A small **Rules** link on the How to play screen and on the pass-the-device screen opens the front card's content as an overlay – title, tagline, intro – followed by 'How to play' for all three ways to play. Close with the **Close** button or Escape.

### How to play (in `UI.gameTypes[…].rules`)
**Define the word** – supplied by Katharine; obvious typos fixed ('asked to define', 'had a turn', '3 points'), otherwise as written:
1. Everyone takes a turn to be asked to define 10 words. The player on your left holds the phone and reads out the words for you to define: nine from the show's dialogue and one Catherine O'Hara loquacity masterclass as a bonus. Once everyone has had a turn, that's the end of the round. Highest scorer wins.
2. For each word, say what it means. Guess it cold for 4 points. You can ask to hear the full quote – but if you do, your score will drop to 3 points. Ask to see a photo of the scene with the quote and the score drops to 2. A wrong guess always drops your possible points for that word to 1, but you can keep going with hints and get the point if you get it right. Any real meaning of the word counts, including the one Moira had in mind.
3. The bonus word has no quote. Guess it cold for 5 points, or hear it in an invented sentence first for 3. Guess wrong, then hear the sentence and get it right, for 2.
4. Stuck? You can give up on any word at any time. It counts as a pass: no points for that word, and you move on to the next one. You still get 10 words in all. *(Added in step 2 at Katharine's request.)*
5. The asker judges. Adults decide what's close enough.

**Fill in the blank** and **Name the episode** – drafted in the same voice from the rules below and agreed: each says 'Everyone takes a turn of 10 questions' and includes the Give up / pass line.

### How to play (the second screen: set-up)
- A top bar with **‹ Back** (to the front card, to change the way to play) and **Rules**.
- The chosen way to play's name as the **title** (e.g. 'Define the word', shrunk to fit one line if needed), **How to play** as the subtitle under it, then its how-to-play text.
- **Number of players: 2, 3 or 4, for every way to play.** Every game needs a tester and an answerer, so there is no solo mode; five and six don't exist. (`MIN_PLAYERS` / `MAX_PLAYERS` in `game.js`.) For Define the word the pool-size check stays (the dummy list supports 4) but won't bite.
- Names in seating order (clockwise). A blank name becomes 'Player N', so a game can start in three taps (Start, Start the game, ready). **Start the game**.
- Phone: all of this in one column with Start the game pinned; tablet: how-to-play text left, players and names right.
- Words per turn is fixed, not configurable.

### Turns
- Player 1 is the first **answerer**. The **tester** is always the next player in seating order (to the answerer's left) and holds the device and reads aloud. After each turn the answerer moves one seat on.
- A round is one pass in which every player has one turn. **A game is one round.**
- Option 1 turn: 9 main-pool words, then 1 bonus-pool word (always the tenth and last).
- Before the first turn a handover screen says 'Pass the device to [tester]' with an 'I'm [tester], ready' button, so nothing is shown until the tester has the device.
- After each turn except the last: pass-the-device screen – 'Pass the device to [next tester]', the answerer's score for the turn, a mini scoreboard, 'I'm [next tester], ready', and two small links: **Rules** and **End game**. After the last word of the last turn the reveal card's button reads 'See the final scores'.

### Draw
- Per turn: 9 main words at random, then 1 bonus word at random. No word is drawn twice in a game (tiebreak words included).
- Shared quotes: once a main word is drawn, other words with the same `quoteGroup` are excluded from the rest of that turn. Only if the pool is too small to avoid it is a sibling allowed (logged as a console warning).

### Option 1 – main-pool words (hint ladder)
The tester's screen, top to bottom: 'Testing: [answerer] · Question n of 10'; the word, very large; a **Points available** badge; a tester-only panel (definition, keywords, and the twist if present – headed 'Any of these senses counts'); then the quote and scene context, **dimmed until 'Read the quote' is tapped**. The answerer must not look. The tester says the word, then:

| Rung | Action | Badge |
|---|---|---|
| 1 | Guess on the word alone | 4 |
| 2 | Tester taps **Read the quote** (quote and scene stop being dimmed), reads it aloud | 3 |
| 3 | Tester taps **Show the photo**: full-screen still, quote overlaid in large text on a translucent dark band near the bottom (no overlay when `quoteOnPhoto` is true); tester turns the device round; a tap anywhere returns. | 2 |

- After the photo, the hint button becomes **Show the photo again**: it re-opens the photo as often as wanted and **never changes the points**.
- **Correct** scores whatever the badge shows and goes to the reveal card.
- **Wrong before the last hint** drops the badge to 1 for good ('Not quite. This question is now worth 1 point – keep going.'). The answerer can keep guessing at 1 point as long as they like (intended); later hints don't change the badge.
- **Wrong after the photo** scores 0 and goes to the reveal card. So: eventually right → 1; never right → 0.
- **Give up** (small, under Wrong) is a **pass**: 0 points for that word at any point, **straight to the reveal card**, then Next moves on. It never draws a replacement – every turn is still exactly 10 words. It **can be undone** with 'Oops, go back' on the reveal card. Give up exists in all three ways to play. (Keeping the screen hidden from the answerer, except for scene photos, is the tester's job, not the app's.)
- **Oops, go back** (small, under Wrong) undoes the last tap on this question – a hint, a mis-tapped Wrong, anything – as many steps back as the question has had taps. It restores the question exactly, including the badge and the dimming. It is disabled before the first tap. Opening the photo again is not a tap that needs undoing.
- Judging: the definition is visible to the tester throughout; the table agrees and the tester taps Correct or Wrong. Any sense of the word counts: if `twist` is present, either meaning scores the full ladder value. No extra point for a second meaning.

### Catherine O'Hara bonus word (bonus-pool words)
- Black screen, a 'Catherine O'Hara bonus word' badge, the word very large, a Points available badge, and a tester-only panel with definition and keywords. No show quote, no photo.
- Two buttons: **Hear it in a sentence** and **Guess**. 'Guess' swaps to Correct / Wrong. 'Hear it in a sentence' shows `exampleSentence` directly under the word, in a dashed box (deliberately unlike a show quote), captioned 'Not a real quote – just for the game', then shows Correct / Wrong.
- Scoring:
  - cold guess right → **5**
  - sentence first, then right → **3**
  - wrong cold, then sentence, then right → **2**
  - wrong after the sentence → **0**
- After a wrong cold guess the only path is the sentence (Guess is disabled). One guess only after the sentence. The app records whether a cold guess was tried (`coldTried`) before the sentence was requested.
- **Give up** and **Oops, go back** work exactly as on main words.
- If a bonus word has no `exampleSentence`, the sentence button is disabled and a wrong cold guess scores 0.

### Reveal card (after every word)
- Right: 'Yes, you're right!', then **the definition underneath in smaller text**: '[Word] means [definition].'
- Wrong or given up: 'Sorry, that's not right – [Word] means [definition].'
- The definition's first letter is lowercased when its first word is 'A' or an ordinary capitalised word (not 'I', not an all-capitals word), and a trailing full stop is dropped.
- Then, only when `sceneContext` is non-empty (so never for bonus words): 'In this scene, [sceneContext].' – the scene text is used as written, only a trailing full stop is dropped.
- The points for the question ('+3 points', or 'No points') and the answerer's running total.
- A big **Next** button and an **Oops, go back** link that restores the question as it was before the tap that ended it (and takes the points back off), with its own undo history intact.

### Final scoreboard
- Ranked names and totals (equal scores share a rank).
- One leader: '[Name] wins!'. Level at the top: 'Tied', the tied names, a one-line explanation, and a **Tiebreak** button.
- **Play again** starts a new game straight away with the same players; **New game** returns to setup with the names kept; a small **End game** link (with confirmation) returns to the front card.

### Tiebreak
- Offered when the top score is shared. The tied players, in seating order, each answer one Catherine O'Hara bonus word per round, scored exactly as a normal bonus word and added to their totals. The tester is the next player round the table, as usual, with a pass-the-device screen before each word ('Tiebreak – round n', the tied players' scores).
- Words: bonus words not yet drawn in this game, at random. **From step 3:** prefer words never asked on this device, then **reuse** bonus words asked in earlier games; only words already drawn in *this* game are off limits. (Until step 3 nothing is remembered between games, so every word not drawn this game is available anyway.)
- After each full round, if one player is ahead, they win ('[Name] wins!', 'Won on the tiebreak'). If not, anyone behind the leaders drops out ('Still level: A and B. Another round.') and the leaders play another round. (Drop-out confirmed by Katharine.)
- If there aren't enough unused bonus words for every remaining player to have one in the next round, it's a **Draw** ('The bonus words have run out, so it's a draw between A and B.').

### End game
A small **End game** link on the pass-the-device screen and the final scoreboard. It asks 'End this game? Scores will be lost.' – **End game** (black) or **Keep playing** (or Escape) – and returns to the front card.

### Option 2 – Fill in the blank (step 4)
Same turn structure as Option 1: each player has one turn of **10 questions**, the tester is the player to their left, everyone has a turn, then the round (and game) ends. 2–4 players. Tester sees the quote with the word blanked and reads it aloud; answerer supplies the word. 1 point, one guess, no hints. Give up = pass (0, next question).

### Option 3 – Name the episode (step 4)
Same turn structure: one turn of **10 questions** per player, everyone has a turn, then the round ends. 2–4 players. Tester reads the quote (and shows the photo if there is one); answerer names the season, then the episode. Season right → 1; season and episode right → 3; season wrong → 0. Give up = pass (0, next question).

### No-repeat tracking (step 3)
- `localStorage` records, per word, whether it has ever been asked in an Option 1 turn on this device.
- The main and bonus pools cycle independently. A game draws unused words first; a pool resets its own 'used' flags when its unused stock is too small for the next game.
- A word is marked used only when actually asked. No word is drawn twice within one game.

### Unlock rule (step 3)
Options 2 and 3 draw only from words with an Option 1 history on this device, and unlock once that set holds 10 or more words.

## Build order

0. **Project setup** (CLAUDE.md, build script, `words.json`, placeholder `index.html`). ← done
1. **Option 1 playable slice on dummy data**: setup, turns, hint ladder, bonus word, reveal card, pass-the-device, scoreboard, placeholder still. ← done
2. **Rename to Sesquipedalian, restyle, answers to open questions**: front card with the way-to-play boxes, How to play screen with players and names, rules overlay, 2–4 players for every way to play (no solo mode), black/white/grey palette, self-hosted Josefin Sans, Give up, undo on the turn screen, re-show photo, definition on a correct reveal, tiebreak, End game. ← done
3. Persistent no-repeat tracking and the Option 2/3 unlock.
4. Options 2 and 3.
5. Real images and the quote-overlay rule.
6. PWA manifest, service worker, GitHub Pages deploy.
7. Swap the dummy spreadsheet for the live one.

One step per session. Test in a browser before committing: open `index.html` directly, and play at phone size (390×844) and tablet sizes.

## Open questions

None at present.

*Resolved in step 2: tiebreak drop-out (yes); tiebreak reuses earlier games' bonus words from step 3 (yes); Options 2 and 3 are turns of 10 questions; Give up is in all three ways to play and in all three rules texts, goes straight to the reveal card and can be undone.*

## Conventions

- British English in all UI text and comments.
- Single quotes in prose (UI text and docs).
- The `quote` field is never modified by code: no trimming, re-punctuating or smart-quoting. Display it exactly as it is in `words.json`. (Capitals on the headline word are CSS only; the data is untouched.)
- All UI strings go in the `UI` object at the top of `game.js`.
- Every step is committed to git with a short message.
