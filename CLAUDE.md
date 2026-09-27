# Moira Words – project brief

Ground truth for every build step. Read it in full before changing anything. When a step adds detail, record it here.

## Purpose

A family vocabulary quiz built around Moira Rose's words. One device is passed round the table and read aloud: the tester holds it and reads, the answerer guesses without seeing the screen. Single-page web app, no back end.

## Tech constraints

- Plain HTML, CSS and JavaScript. No framework, no bundler, no TypeScript, no build step for the app itself.
- Static files only. Must run by double-clicking `index.html` (`file://`) and from GitHub Pages. Keep every path relative (`./…`) because Pages serves from a sub-path.
- Node is used **only** for the build script (`npm run build`), never at runtime. `xlsx` (SheetJS, from the SheetJS CDN) is the only dependency.
- No accounts, no analytics, no sharing. The only third-party request is Google Fonts for the display face (see Open questions). All persistence is `localStorage` (from step 3; step 1 keeps the game in memory, so a refresh ends it).
- PWA manifest and service worker are added at build step 6. Hooks are marked in `index.html`; don't add them early. Once there is a service worker, bump its cache version every time a cached file changes.
- Primary target: phone in portrait. Must also work on a tablet in either orientation.
- Keep the screen awake during a game with the Wake Lock API where supported; ignore silently if not.

### Files

| File | Role |
|---|---|
| `index.html` | Shell: fonts, `style.css`, then `words.js`, then `game.js`. |
| `style.css` | All styling. Colour tokens on `:root`. |
| `game.js` | All game logic and screens. **Every UI string lives in the `UI` object at the top.** |
| `words.js` | Generated. `window.MOIRA_WORDS = {…}`, loaded with a plain `<script>` so `file://` works (browsers block `fetch` from `file://`). |
| `words.json` | Generated. Same data, kept for reference. |
| `assets/placeholder.svg` | Scene still used for every word until step 5. Real stills go in `assets/stills/<imageFile>`; `stillSrc()` in `game.js` is the one place to switch. |
| `scripts/build-words.js` | Spreadsheet → `words.json` + `words.js`. |

## Look and feel – 'Rose Apothecary'

- Cream background `#f6f1e7`, near-black ink `#1d1a17`, one accent: muted gold `#a07c3f` (badges, the chosen game type, 'winner'). Correct is green `#35664a`, Wrong is red `#a13c33`. Restrained; readability always beats decoration.
- The headline word is set in **Playfair Display** (Google Fonts) with a system serif fallback (Palatino, Georgia) so it still looks right offline. Body text is the system sans-serif.
- Sizes: the word is at least 44px on a phone and 72px on a tablet, and **always on one line** – `fitWord()` shrinks it only if it would overflow (never below 32px, when it may wrap). Buttons are at least 56px tall (60px phone, 68px tablet).
- Phone: buttons are full width and **pinned to the bottom** of the turn screen, always in the same order – hint, Correct, Wrong – so thumbs learn them.
- Tablet portrait (≥700px): word full width on top; tester panel and quote/scene side by side below; buttons in one row.
- Tablet landscape (≥900px, landscape): two columns – word and badge left, tester panel and quote right.
- Bonus word screen: dark background (`#1e1a17`), cream text – visibly different.
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

## Game rules

### Setup
- Choose a game type: **Option 1** Define the word, **Option 2** Fill in the blank, **Option 3** Name the episode. Options 2 and 3 are greyed out with the note 'Play a Define the word game first to unlock this mode' until unlocked (see Unlock rule).
- Choose 2–6 players, then enter names in seating order (clockwise). A blank name becomes 'Player N', so a game can start in two taps. Player counts the word list can't serve without repeats are disabled (see Draw).
- Words per turn is fixed, not configurable.

### Turns
- Player 1 is the first **answerer**. The **tester** is always the next player in seating order (to the answerer's left) and holds the device and reads aloud. After each turn the answerer moves one seat on.
- A round is one pass in which every player has one turn. **A game is one round.**
- Option 1 turn: 9 main-pool words, then 1 bonus-pool word (always the tenth and last).
- Before the first turn a handover screen says 'Pass the device to [tester]' with an 'I'm [tester], ready' button, so nothing is shown until the tester has the device.
- After each turn except the last: pass-the-device screen – 'Pass the device to [next tester]', the answerer's score for the turn, a mini scoreboard, and 'I'm [next tester], ready'. After the last word of the last turn the reveal card's button reads 'See the final scores' and goes straight to the final scoreboard.

### Draw
- Per turn: 9 main words at random, then 1 bonus word at random. No word is drawn twice in a game.
- Shared quotes: once a main word is drawn, other words with the same `quoteGroup` are excluded from the rest of that turn. Only if the pool is too small to avoid it is a sibling allowed (logged as a console warning).
- The most players offered is the smaller of 6, ⌊main words ÷ 9⌋ and the number of bonus words. The dummy data allows 4.

### Option 1 – main-pool words (hint ladder)
The tester's screen, top to bottom: 'Testing: [answerer] · Question n of 10'; the word, very large; a **Points available** badge; a tester-only panel (definition, keywords, and the twist if present – headed 'Any of these senses counts'); then the quote and scene context, **dimmed until 'Read the quote' is tapped**. The answerer must not look. The tester says the word, then:

| Rung | Action | Badge |
|---|---|---|
| 1 | Guess on the word alone | 4 |
| 2 | Tester taps **Read the quote** (quote and scene stop being dimmed), reads it aloud | 3 |
| 3 | Tester taps **Show the photo**: full-screen still, quote overlaid in large text on a translucent dark band near the bottom (no overlay when `quoteOnPhoto` is true); tester turns the device round; a tap anywhere returns. The hint button is then disabled ('Photo shown'). | 2 |

- **Correct** scores whatever the badge shows and goes to the reveal card.
- **Wrong before the last hint** drops the badge to 1 for good ('Not quite. This question is now worth 1 point – keep going.'). The turn continues with the same buttons; later hints don't change the badge.
- **Wrong after the photo** (no hints left) scores 0 and goes to the reveal card. So: eventually right → 1; never right → 0.
- Judging: the definition is visible to the tester throughout; the table agrees and the tester taps Correct or Wrong. Any sense of the word counts: if `twist` is present, either meaning scores the full ladder value. No extra point for a second meaning.

### Catherine O'Hara bonus word (bonus-pool words)
- Dark screen, a 'Catherine O'Hara bonus word' badge, the word very large, a Points available badge, and a tester-only panel with definition and keywords. No show quote, no photo.
- Two buttons: **Hear it in a sentence** and **Guess**. 'Guess' swaps to Correct / Wrong. 'Hear it in a sentence' shows `exampleSentence` directly under the word, in a dashed sans-serif box (deliberately unlike a show quote), captioned 'Not a real quote – just for the game', then shows Correct / Wrong.
- Scoring:
  - cold guess right → **5**
  - sentence first, then right → **3**
  - wrong cold, then sentence, then right → **2**
  - wrong after the sentence → **0**
- After a wrong cold guess the only path is the sentence (Guess is disabled). One guess only after the sentence. The app records whether a cold guess was tried (`coldTried`) before the sentence was requested.
- If a bonus word has no `exampleSentence`, the sentence button is disabled and a wrong cold guess scores 0.

### Reveal card (after every word)
- Large: 'Yes, you're right!' or 'Sorry, that's not right – [Word] means [definition].' (The definition's first letter is lowercased unless it starts with 'I' or a capitalised run such as an acronym, and a trailing full stop is dropped.)
- Then, only when `sceneContext` is non-empty (so never for bonus words): 'In this scene, [sceneContext].' – the scene text is used as written, only a trailing full stop is dropped.
- The points for the question ('+3 points', or 'No points') and the answerer's running total.
- A big **Next** button and an **Oops, go back** link: a one-level undo that restores the question exactly as it was before the tap that ended it, and takes the points back off.

### Option 2 – Fill in the blank
Tester sees the quote with the word blanked and reads it aloud; answerer supplies the word. 1 point, one guess, no hints.

### Option 3 – Name the episode
Tester reads the quote (and shows the photo if there is one); answerer names the season, then the episode. Season right → 1; season and episode right → 3; season wrong → 0.

### No-repeat tracking (step 3)
- `localStorage` records, per word, whether it has ever been asked in an Option 1 turn on this device.
- The main and bonus pools cycle independently. A game draws unused words first; a pool resets its own 'used' flags when its unused stock is too small for the next game.
- A word is marked used only when actually asked. No word is drawn twice within one game.

### Unlock rule (step 3)
Options 2 and 3 draw only from words with an Option 1 history on this device, and unlock once that set holds 10 or more words.

### Tiebreak
Level final scores: the tied players alternate bonus-pool words, sudden death. **Not built yet** – until then the final scoreboard just says 'Tied'.

### Final scoreboard
Ranked names and totals (equal scores share a rank); the winner celebrated ('[Name] wins!'), or 'Tied' with the tied names if the top score is shared. **Play again** starts a new game straight away with the same players; **New game** returns to setup with the names kept.

## Build order

0. **Project setup** (CLAUDE.md, build script, `words.json`, placeholder `index.html`). ← done
1. **Option 1 playable slice on dummy data**: setup, turns, hint ladder, bonus word, reveal card, pass-the-device, scoreboard, placeholder still. ← done
2. Play-test fixes and screen design.
3. Persistent no-repeat tracking and the Option 2/3 unlock.
4. Options 2 and 3.
5. Real images and the quote-overlay rule.
6. PWA manifest, service worker, GitHub Pages deploy.
7. Swap the dummy spreadsheet for the live one.

One step per session. Test in a browser before committing: open `index.html` directly, and play at phone size (390×844) and tablet sizes.

## Open questions

1. **Five and six players.** A game needs 9 × players main words and 1 × players bonus words with no repeats, so the dummy data supports at most 4 players and setup disables 5 and 6. How big is the live pool? If it's under 54 main words, should big games be allowed to repeat words across turns?
2. **Endless guessing at 1 point.** After a wrong guess the badge sits at 1 and the answerer can keep guessing until the photo is shown; only a wrong guess after the photo ends the question at 0. Is that intended, or should each rung allow one guess?
3. **Giving up early.** The only way to score 0 is to tap through every hint and then Wrong. Is a 'Give up' button wanted?
4. **Mis-tapped Wrong mid-ladder.** 'Oops, go back' is only on the reveal card, so a mis-tapped Wrong that caps a question at 1 can't be undone. Add an undo there too?
5. **Photo shown once.** The hint button is disabled after the photo, so the tester can't show it again. Should they be able to?
6. **Correct reveal line.** On a right answer the card says only 'Yes, you're right!' and doesn't read out the definition. Intended?
7. **Tiebreak** isn't in any build step. Which step should it join?
8. **Quitting a game.** There's no way to abandon a game except reloading the page. Add a discreet 'End game' control?
9. **Google Fonts** is a third-party request (it shares the viewer's IP address with Google) and won't work offline. Self-host Playfair Display in `assets/` at step 6 so the PWA is fully offline?

## Conventions

- British English in all UI text and comments.
- Single quotes in prose (UI text and docs).
- The `quote` field is never modified by code: no trimming, re-punctuating or smart-quoting. Display it exactly as it is in `words.json`.
- All UI strings go in the `UI` object at the top of `game.js`.
- Every step is committed to git with a short message.
