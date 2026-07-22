# Auto-translate (German → English)

The **Manage Content** screens have an **✨ Auto-translate** button next to the
English field, plus a **"Translate all empty English"** button at the top of the
list. They fill in English meanings as **editable AI drafts** (dashed amber box +
an "AI · review" tag) that you check before they count.

It's on for the games where content is a plain German → English pair:

- Base vocabulary (numbers, colours, animals, food, family, verbs) — used by
  Vocabulary Quiz, Memory, Hangman
- **Wortmonster** compound words (translates the joined word, e.g. *Handschuh*)
- **Hör gut zu!** listening prompts (a word *or* a whole sentence)

It is deliberately **off for Fall-Detektiv**. Those case sentences teach which
noun takes which grammatical case, and a generic translation can quietly shift
the emphasis and teach the wrong thing — so that content stays fully manual.

---

## No setup, no key, no server

Unlike a cloud translator, this uses the **browser's own built-in translator** —
the same idea as the built-in German *voice* the app already falls back on. The
translation runs **on the device**, so there is **no API key and no server** to
set up or pay for, and once the language model has downloaded once it even works
offline.

**Requirements**

- **Chrome or Edge**, a reasonably **recent version** (the built-in translator
  shipped to stable through 2025). The first time it's used, the browser
  downloads a small German→English model — that one time can take a minute; after
  that it's instant and offline.
- On browsers without a built-in translator (Safari, Firefox, older Chrome), the
  buttons simply say *"needs Chrome or Edge"* and do nothing. There is **no other
  fallback** by design.

**Check your browser** — paste this into the browser console (F12 → Console):

```js
"Translator" in self ? Translator.availability({sourceLanguage:"de",targetLanguage:"en"}) : "no built-in translator"
```

`"available"` or `"downloadable"` means you're good to go. `"downloadable"` just
means the model downloads on first use.

---

## How the drafts behave (by design)

- A translation is filled in as a **draft** — dashed amber box + "AI · review".
- It becomes normal content when you **edit the field** or click the **✓**.
- The buttons **never overwrite** an English field you already typed. The bulk
  button only fills **blank** ones. (Clicking ✨ on a field that already has text
  is treated as an explicit "re-generate", and still leaves a draft.)

---

## Swapping the engine later

The whole translation call lives behind one file — **`js/translate.js`**
(`translateText()` / `translateBatch()`). To move to a cloud service (Azure
Translator, DeepL, Claude, …) later, only that file changes; no UI code moves. A
reference server-based Azure implementation exists in this repo's **git history**
(the `functions/` folder) if broader browser coverage is ever needed.
