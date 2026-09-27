# Moira Words – project brief

Ground truth for every build step. Read it in full before changing anything.

## Purpose

A family vocabulary quiz built around Moira Rose's words. One device is passed round the table and read aloud: the tester holds it and reads, the answerer guesses without seeing the screen. Single-page web app, no back end.

## Tech constraints

- Plain HTML, CSS and JavaScript. No framework, no bundler, no TypeScript.
- Static files only. Must run from `file://` for testing and from GitHub Pages in production. Keep every path relative (`./…`) because Pages serves from a sub-path.
- Node is used **only** for the build script (`npm run build`), never at runtime. `xlsx` (SheetJS, from the SheetJS CDN) is the only dependency.
- No accounts, no analytics, no sharing, no network calls beyond loading our own files. All persistence is `localStorage`.
- PWA manifest and service worker are added at build step 6. Hooks are marked in `index.html`; don't add them early. Once there is a service worker, bump its cache version every time a cached file changes.
- Primary target: phone in portrait. Must also work on a tablet in either orientation. Large type and big tap targets everywhere, readable at arm's length.
- Visual style, 'Rose Apothecary': cream background, near-black text, a serif display face for the headline word; restrained and elegant. Readability always beats decoration.

### Known issue: `fetch` from `file://`

`index.html` loads `words.json` with `fetch`. Chrome, Edge and Safari block `fetch` of local files from `file://`, so this works on GitHub Pages and on any local server (e.g. `python -m http.server`) but **not** from a double-clicked file. Decide at step 1: either test via a local server, or have the build also emit `words.js` (`window.MOIRA_WORDS = …`) loaded with a `<script>` tag, which does work from `file://`.

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

`data/` currently holds a **dummy** test set (36 main, 14 bonus, no shared quotes). It is swapped for the live file, same column layout, at build step 7. Rebuild and commit `words.json` whenever the spreadsheet changes.

## Game rules

### Setup
- 2–6 players enter their names.
- Choose a game type: **Option 1** Define the word, **Option 2** Fill in the blank, **Option 3** Name the episode. Options 2 and 3 are greyed out until unlocked (see Unlock rule).
- Words per turn is fixed, not configurable.

### Turns
- Players sit in order. The **answerer** is asked; the player to their left is the **tester**, who holds the device and reads aloud. At the end of the turn the device passes left.
- A round is one pass in which every player has one turn. **A game is one round.**
- Option 1 turn: 9 main-pool words, then 1 bonus-pool word (always last).

### Option 1 – hint ladder (main-pool words)
The tester sees the word large, with the quote and scene context beneath in smaller text. The answerer cannot see the screen. The tester says the word, then:

| Rung | Action | Points if right |
|---|---|---|
| 1 | Guess on the word alone | 4 |
| 2 | Tester taps **Read quote**, reads it aloud, answerer guesses | 3 |
| 3 | Tester taps **Show photo**: full-screen scene still with the quote overlaid (no overlay when `quoteOnPhoto` is true); tester turns the device round; answerer guesses; tap returns to the tester screen | 2 |

- **Any wrong guess at any rung caps the question at 1 point.** The hint buttons stay; the 'points available' indicator drops to 1 and stays there. Eventually right → 1; never right → 0.
- **Judging, 'reveal then agree':** tester taps **Reveal** and sees definition, keywords and twist (if present); the table agrees; tester taps **Correct** or **Wrong**.
- Any sense of the word counts: if `twist` is present, either meaning scores the full ladder value. No extra point for a second meaning.
- **Reveal card spoken line:** correct → 'Yes, you're right!'; otherwise → 'Sorry, that's not right – [Word] means [definition].' If `sceneContext` is non-empty, follow with 'In this scene, [sceneContext].' Then 'Pass the device to [next tester].'

### Catherine O'Hara bonus word (bonus-pool words)
- No show quote, no photo. The word is shown with a badge marking it as the bonus word, plus two buttons: **Guess** and **Hear it in a sentence**.
- The sentence is `exampleSentence`, always captioned as invented: 'not a real quote – just for the game'.
- Scoring:
  - cold guess right → **5**
  - sentence first, then right → **3**
  - wrong cold, then sentence, then right → **2**
  - wrong after the sentence → **0**
- One guess only after the sentence. The app must record whether a cold guess was tried before the sentence was requested.
- No scene-context line on the reveal.

### Option 2 – Fill in the blank
Tester sees the quote with the word blanked and reads it aloud; answerer supplies the word. 1 point, one guess, no hints.

### Option 3 – Name the episode
Tester reads the quote (and shows the photo if there is one); answerer names the season, then the episode. Season right → 1; season and episode right → 3; season wrong → 0.

### Shared quotes
When a word is drawn in a turn, every other word with the same `quoteGroup` is excluded from that turn's draw.

### No-repeat tracking
- `localStorage` records, per word, whether it has ever been asked in an Option 1 turn on this device.
- The main and bonus pools cycle independently. A game draws unused words first; a pool resets its own 'used' flags when its unused stock is too small for the next game.
- A word is marked used only when actually asked. No word is drawn twice within one game.

### Unlock rule
Options 2 and 3 draw only from words with an Option 1 history on this device, and unlock once that set holds 10 or more words.

### Tiebreak
Level final scores: the tied players alternate bonus-pool words, sudden death.

### Scoreboard
Running totals shown between turns and at the end.

## Build order

0. **Project setup** (CLAUDE.md, build script, `words.json`, placeholder `index.html`). ← done
1. Option 1 playable slice on dummy data: setup, one full turn (hint ladder, bonus word), reveal card, pass-the-device, scoreboard. Placeholder image for every word.
2. Play-test fixes and screen design.
3. Persistent no-repeat tracking and the Option 2/3 unlock.
4. Options 2 and 3.
5. Real images and the quote-overlay rule.
6. PWA manifest, service worker, GitHub Pages deploy.
7. Swap the dummy spreadsheet for the live one.

One step per session. Test in a browser before committing.

## Conventions

- British English in all UI text and comments.
- Single quotes in prose (UI text and docs).
- The `quote` field is never modified by code: no trimming, re-punctuating or smart-quoting. Display it exactly as it is in `words.json`.
- Every step is committed to git with a short message.
