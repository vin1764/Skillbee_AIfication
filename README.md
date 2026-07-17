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

## ✏️ Adding or changing the words (no coding needed)

All the German content lives in **one file: `js/data.js`**. It has friendly instructions at the
top. In short:

- **Add a word** to a topic:
  ```js
  { de: "der Apfel", en: "the apple", emoji: "🍎" },
  ```
  `de` = German · `en` = English meaning · `emoji` = a small picture (optional).

- **Add a whole new topic** (e.g. *Kleidung / Clothes*): copy an existing topic block, give it a
  new `id` and `name`, and list its words.

- **Add a sentence** for the Satzbau game: add a line to `SENTENCE_TOPICS`:
  ```js
  { de: "Ich lerne gern Deutsch", en: "I like learning German" },
  ```

Save the file and refresh the browser — your changes appear instantly.

---

## 🌐 Sharing a link (optional)

This project can publish itself to a free public web page using **GitHub Pages**:

1. On GitHub, go to **Settings → Pages**.
2. Under *Build and deployment → Source*, choose **GitHub Actions**.

That's it. Every time changes are pushed, the included workflow
(`.github/workflows/deploy.yml`) publishes the latest version, and GitHub gives you a link like
`https://<your-name>.github.io/skillbee_aification/` to share with teachers.

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
