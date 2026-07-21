# 💎 Skillbee Deutsch Games

A **gamified toolkit of German-learning games** for Skillbee teachers to use live in their
lessons. Open it on any laptop, project it on the classroom screen, pick a game and a topic,
and play with the whole class — **no installation, no accounts, nothing to set up.**

> Four games in one lobby: 🎯 Vokabel-Quiz · 🧩 Memory · 🔤 Galgenmännchen · 🧱 Satzbau

---

## ▶️ How to use it in class

You have two easy options:

1. **Just open the file** — download this project, then double-click **`index.html`**.
   It opens in your web browser and works fully offline.
2. **Use the shared link** — if the online version is turned on (see *Sharing a link* below),
   just send teachers a URL. Nothing to download.

**Tip for the classroom:** press `F11` for full-screen so the games fill the projector.

---

## 🎮 The games

| Game | German name | What students practise |
|------|-------------|------------------------|
| 🎯 **Quiz** | *Vokabel-Quiz* | Vocabulary — fast multiple-choice with a timer & bonus points (Kahoot-style). |
| 🧩 **Memory** | *Paare finden* | Matching a German word to its meaning (with a picture). |
| 🔤 **Hangman** | *Galgenmännchen* | Spelling — guess the German word letter by letter. |
| 🧱 **Sentence Scramble** | *Satzbau* | Word order — rebuild a shuffled German sentence. |

Every game keeps **points** (top-right), plays **sounds**, and can **speak the German word out
loud** 🔊 so students hear correct pronunciation. Win a round to get **confetti** 🎉.

---

## ✏️ Adding or changing the content — no coding needed

Click the **⚙️ Manage content** button (top-right, or on the home screen) to open the built-in
**content editor**.

Every game keeps its own **exercises** — an exercise is one self-contained set of content
(a batch of words, sentences, case sentences, verbs, …). This lets you build a **fresh exercise
for each lesson and keep the previous ones**, instead of overwriting a single list.

- **Pick a game** to see its list of exercises.
- **➕ New exercise** starts a fresh set · **✎** renames · **⧉** duplicates (copy an old
  exercise to build on it) · **🗑** deletes.
- **Open an exercise** to edit its content — add/edit/remove the words, sentences or other rows.
- When you start a game (Solo or in Live Class Mode), you **choose which exercise to play**.

Common toolbar: **Backup** (save everything to a file), **Restore** (load a file), **Reset**
(back to defaults). Changes are **saved automatically** and synced across your devices.

> **Sharing content between teachers/devices:** edits sync automatically through the app's cloud,
> so an exercise built on one device shows up on the others. **Backup** / **Restore** stays
> available as an optional file-based safety net.

### Advanced: editing the default content in code

The built-in defaults live in **`js/data.js`** (friendly instructions at the top). Editing them
changes what everyone sees before any in-app customization. Example word:
```js
{ de: "der Apfel", en: "the apple", emoji: "🍎" },
```
`de` = German · `en` = English meaning · `emoji` = a small picture (optional). After changing
`js/data.js`, run `node build.mjs` to refresh the bundled/offline versions.

---

## 🌐 Sharing a link (optional)

This project can publish itself to a free public web page using **GitHub Pages**:

1. On GitHub, go to **Settings → Pages**.
2. Under *Build and deployment → Source*, choose **GitHub Actions**.

That's it. Every time changes are pushed, the included workflow
(`.github/workflows/deploy.yml`) publishes the latest version, and GitHub gives you a link like
`https://vin1764.github.io/Skillbee_GermanGames/` to share with teachers.

---

## 🧑‍💻 For developers — adding a new game

The app is plain HTML/CSS/JavaScript with **no build step**. Each game is a small self-contained
file in `js/games/` that registers itself into the lobby:

```js
App.register({
  id: "my-game",
  name: "Mein Spiel",
  emoji: "🚀",
  color: "#1982c4",
  description: "Short description shown on the lobby card.",
  contentType: "words",          // "words" (VOCAB_TOPICS) or "sentences" (SENTENCE_TOPICS)
  mount(stage, api) {
    // api.topic     -> the chosen topic {name, words|sentences, ...}
    // api.kit       -> helpers: shuffle, sample, speak(), speakerButton(), beep(), confetti(), el()
    // api.addScore(n)-> add points to the session score
    // api.exit / api.restart / api.backToTopics -> navigation
  }
});
```

Then add one line to `index.html`:
```html
<script src="js/games/my-game.js"></script>
```

**Project structure**
```
index.html            ← the page (loads everything)
css/styles.css        ← all styling
js/data.js            ← 📚 vocabulary & sentences (edit this for content)
js/app.js             ← lobby, navigation, scoring, shared toolkit
js/games/quiz.js      ← 🎯 game
js/games/memory.js    ← 🧩 game
js/games/hangman.js   ← 🔤 game
js/games/scramble.js  ← 🧱 game
```

Made for Skillbee German teachers.
