# Skillbee Deutsch Games — Pre-Launch QA Report

**Verdict: not launch-ready yet.** The core game mechanics are solid (all 10 live games score correctly, every screen renders, every mode runs end-to-end), but there are **7 blockers** — mostly around lifecycle/cleanup, the offline bundle, data-loss paths in the editor, and the PIN — plus a set of majors a teacher would hit in the first week.

**Scope tested:** all 10 Live games (host + player screens), all 3 timer modes, both answer modes, all 9 Solo games, the Passage flow, the offline bundle, the content editor + toolbar, the teacher PIN, presence/rejoin, scoring pipelines, voice/audio, edge-case content.
**Method:** automated browser sweeps (host flow per game, player screen per game, type modes, solo mounts, offline bundle, admin), unit-level scoring audit of every adapter (correct **and** wrong payload per round), targeted edge-case probes, deep static audit of every module, and production-database inspection.

---

## Verified WORKING

- **Scoring correctness** for every adapter, verified round-by-round with correct and wrong payloads.
- **Full host flows** for all games: lobby → question → counter → reveal → next → podium, including Match's race flow and Passage's passage-first flow with overlay.
- **Every player screen** renders and submits; both type modes work (Hör gut zu diff, Lücken-Text typed blanks).
- All 9 solo games mount online; presence/rejoin, instant "Play another game", per-game answer namespacing, rule-compatible Speed answers, split audio options, audio-aware solo timer, update popup — all covered by regression suites.
- Toolbar: Backup downloads, Restore opens picker, Reset is triple-guarded; sound toggle mutes beeps; voice panel lists voices with samples.
- Offline bundle boots clean, shows the "Live needs internet" notice, and disables the update checker.

---

## BLOCKERS

### B1 — Closing a room mid-question re-opens it and hijacks the board
`answersUnsub` and the countdown timers are never registered for cleanup (`live.js:823, :856, :980` vs `stop()`), and `hostPhase` stays `"question"`. After "✕ Close room": a late answer snapshot **repaints the question over the Live menu**, and in Per-Question mode the leaked countdown fires `reveal()` → the session doc flips from `"ended"` back to `"reveal"` — every phone pops back into a game the teacher just closed.

### B2 — Same leak on phones
`curCountdown` is never tracked (`live.js:1725, :1768, :1940`); a student who Backs out mid-question later gets a "⏰ Time's up!" card painted over whatever screen they're on.

### B3 — Exited solo Quiz-Blitz becomes a self-restarting zombie
The question interval is only cleared inside the game's own flow (`quiz.js:136-163`). Tap "← Menu" mid-round and the detached game keeps running: a beep + spoken German word every ~5s across every screen (including a Live lobby), ending in full-screen confetti. Only a page reload stops it.

### B4 — The offline/downloadable app can't play its flagship game and can't author content
Quiz-Blitz's default exercise is empty ("Exercise 1 · 0 questions" → "No content yet — add via ⚙️ Manage content"), and **Manage content is unreachable offline**: the only entry point is behind `LiveDB.available()`, and `setAdminVisible()` toggles a `#admin-btn` that doesn't exist anywhere (`app.js:316-319`). Every empty state points at a button that isn't there.

### B5 — Leaving the editor via browser Back / logo freezes cloud sync for the session
`store.editing` is only released by the editor's own "← Menu" (`admin.js:22-60`); Back/logo bypass it. Incoming cloud content parks in `pendingRemote` forever; the "another device updated" banner renders into a detached node. The device runs stale content while showing "☁️ Synced".

### B6 — Exiting the editor can restore a STALE cloud snapshot over newer local edits
`applyPendingRemote()` applies the parked doc **unconditionally** on exit (`store.js:587-597`, `admin.js:58`), overwriting everything typed since it arrived; cloud and device silently diverge. "Load it" has the same no-warning data loss.

### B7 — The teacher PIN is bypassable, overwritable, and unrecoverable
A student device with one failed config read is invited to "Create a teacher PIN" and **overwrites the shared PIN** (`teacher.js:26-40, 96-110`); the rules let anyone write `config/teacher`; the unsalted 4-digit hash is world-readable and brute-forcible instantly; the PIN guards content **Reset** (a student can wipe the bank for everyone); and there is **no recovery** for a forgotten PIN.

---

## MAJOR

- **M1 — "Continue" scoreboard start silently does nothing on a failed leaderboard read** (no `.catch`, `live.js:533-535`): "Start room ▶" becomes a dead button with no error.
- **M2 — "Keep scores" in Play-another-game overwrites the class's long-term leaderboard.** `playAnother` reuses `persistMode: "continue"` for "keep this room's totals", but `podium()` then `saveLeaderboard`s **today's room totals over the term leaderboard** (`live.js:1373 vs :1433-1438`). Irreversible, mixed-meaning data.
- **M3 — Last-instant answers are scored "Too slow".** Reveal scores only from the snapshot listener's latest delivery; the answer doc written in the final ~400 ms sits unused in Firestore (`getAnswers` is never called). With Per-Question auto-reveal this bites a different student every round.
- **M4 — Reveal pronunciation ignores the chosen audio speed** (`kit.speak(german)` without `{rate}` — `live.js:1217`): a 0.75× listening class hears the reveal at full speed. Same for Scramble/Match reveals.
- **M5 — Audio-answer MCQ reveals show a dead "🔊 Tap to hear" chip** (no handler, no audio — `live.js:1320, :2110`): nobody learns which option was right.
- **M6 — Solo Quiz-Blitz gives ~4s per question vs Live's 20s** — most solo rounds time out; failures speak out loud.
- **M7 — Concurrent editing clobbers the whole content bank** (full-doc overwrite + client-clock ordering, `store.js:563-578`): a fast smartboard clock permanently rejects a correct laptop's edits.
- **M8 — Reset produces corrupt-looking content** (only load path that skips `ensureSections()`): Match questions all show "0 pairs" after Reset.
- **M9 — Quiz-Blitz plays words its MCQ-only editor can't show or edit**: "24 questions" on the card, "No questions yet" inside, 24 uneditable questions in class.
- **M10 — Browser Back is inert at the top of the app** and the history trap can overflow (Safari pushState throttle) and then Back *exits* a live game.
- **M11 — "Sound on/off" neither stops speech nor persists** (mutes beeps only; resets on reload).
- **M12 — Azure mp3 and browser TTS can overlap** (`stopCurrent()` never cancels speechSynthesis when an mp3 exists).
- **M13 — Voice settings can list no German voices on a cold Chrome load** (no `voiceschanged` listener, list built once).
- **M14 — Restore is one mis-click from cloud-wide content replacement** (no confirm, no PIN, shape-only validation) while Reset is triple-guarded.
- **M15 — Editor counts vs playable counts disagree across five games** ("8 statements" → "3" in Live setup, or "no usable content" on the smartboard).
- **M16 — Tiny word pools build one-option "multiple choice" rounds** (1-word quiz/listen exercises produce a single always-right button; auto-gen branch lacks the ≥2 guard the authored branch has).
- **M17 — Image answers surface as raw URLs** in text contexts (`correctLabel()`; confirmed in production reveal docs).
- **M18 — Live "Memory Match" is a renamed Quiz-Blitz**, while Solo "Memory" is a real card-flip game — same name, different games.

---

## MINOR

- Solo Wahr-oder-Falsch shows the teacher-facing note "Students tap Wahr/Falsch on their phones" to the solo player (`live-solo.js:90` strip-list misses `.tf-hostnote`).
- Solo throws away Lücken-Text partial credit (flat ✗ instead of Live's "2 of 3 blanks, 667 pts").
- Solo's correct-answer ring only works for plain-text options (`.opt-text` selector); dead for image/icon/audio options.
- No Solo version of Lese & Hör — and it can't be naively added (passage adapter has no playerContent/score; needs its own runner).
- Audio speed support is inconsistent: True/False (no flag + host blocks ignore rate), Scramble listen-mode (one flag away), Hangman audio clue, MCQ audio questions/options all lack it.
- Wortmonster rounds with no meaning/emoji are unanswerable (blank target on board and phones); `partA === partB` rounds can never enable Submit.
- Hangman ships rounds with an empty clue; `ß` uppercases to SS (7 slots for "Straße", no ß key).
- A correct MCQ option beyond index 4 is silently deleted (validate-then-slice; reachable via Import/cloud, not the editor).
- Legacy single-blank sentences with two `___` gaps render a dead, unfillable gap (`replace` without `/g`).
- Passage picker counts raw questions, plays only valid ones ("6 questions" → "no usable content").
- Leaderboard keys are name-derived slugs: renaming/reordering students orphans or swaps carried scores.
- "Continue" points are lost if the room closes before the podium (`saveLeaderboard` only fires there).
- Speed Challenge never shows correct answers (race → totals; no review step — the teaching moment is missing).
- Passage overlay outlives the room (appended to body; survives Close room) and can leave `qPaused: true` stale.
- Lücken-Text/MCQ editors accept unplayable rows silently (no gap marker, empty correct option, empty blank answers).
- Memory editor's "Wrong options" field is read by nothing; "Short description" is discarded for four games.
- `exercisesFor()` returns a detached array for unseeded keys (mutators silently no-op — landmine for game #11).
- Dead code: "sentences" content kind, "Copy from another game" (self-filtered), player standings screen (`status:"leaderboard"` never written), `getAnswers`, `isCustomized`, etc.
- Sync chip shows "☁️ Saving…" forever when offline; PIN modals hang on write failure; unlock is per-tab.
- Voice: "Hear a sample" can play the wrong voice (async fallback); mp3 `error` leaves that word permanently silent; browser TTS runs at 0.95×rate vs mp3 at rate (two speeds in one class).
- Solo ⭐ score never resets and mixes incomparable scales; Live shows a leftover solo number next to the real leaderboard.
- No client-side cap at the rules' 80-student limit (cryptic permission error); room-code collision fallback can overwrite a live room after 10 tries; sessions/answers accumulate forever (no TTL).
- `meta.contentType` strings are dead and two are wrong ("vocab", "pairs"); key mapping (`listen`→`listening`, `wortmonster`→`compounds`) is duplicated instead of shared.

## POLISH

Modals don't close on Escape and sit outside the Back handling; MCQ type-switcher keeps stale values (Text→Image makes broken `<img>`s); emoji inputs truncate ZWJ emoji; `_ai` draft markers leak into cloud/backups; TF statement picker omits legacy icon/image types; empty "Translate all" bar; misleading comments in live-solo/liveGames; `speakOnReveal`/fallback reveal would read URLs aloud/print base64 for imported audio-file or image content; memory game: 1-pair auto-win, identical backs for same-meaning words look broken, always capped at 6 pairs; solo quiz audio rounds can score an untimed max bonus if answered without listening.

---

## Improvement ideas (launch-plus)

**Classroom flow**
1. **Host reconnect** — remember the hosted room + rounds locally; offer "Resume hosting ROOM" after a smartboard reload (students already have rejoin; the teacher has nothing).
2. **Exercise preview** for the teacher in the picker (board + phone view) before class.
3. Wire the dead standings screen into a real **"Show standings" host button** between questions.
4. **Teacher recap at the podium**: per-question right/wrong matrix per student, CSV export.
5. **Kick/rename a student** from the host lobby.
6. A **Speed Challenge review step**: after the clock, step through the questions with correct answers (the missing teaching moment).

**Games & content**
7. A **real Live Memory** (per-phone pair board — the Match engine is 90% there), replacing the Quiz-Blitz clone.
8. **Shared vocab bank** for Quiz-Blitz/Memory + resurrect "copy exercise between games".
9. **"Check my content" validation panel** listing every unplayable row and why — fixes the whole counts-vs-playable family at the root.
10. **CSV/Quizlet import** for vocab; share exercises between teachers via a code.

**Audio**
11. Editor indicator for which words have pre-generated audio vs device TTS.
12. Student-side slow-replay (second tap = 0.75×) on any audio, everywhere.

**Ops**
13. **Firestore TTL on sessions** (console setting, zero code).
14. Harden the PIN: salted WebCrypto hash, owner-guarded `config/teacher` rules, documented recovery path.
15. **Server timestamps + per-section merge writes** for the content bank (ends clock-skew clobbering).
16. Commit the **e2e harness** (rule-enforcing fake backend + per-game flows built during this QA) and run it in CI on every deploy.
17. A tiny **/health page**: app version + expected vs deployed rules version (would have caught both rules-drift outages instantly).
