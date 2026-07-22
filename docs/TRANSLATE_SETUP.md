# Auto-translate (German → English) — setup

The **Manage Content** screens have an **✨ Auto-translate** button next to the
English field, plus a **"Translate all empty English"** button at the top of the
list. They fill in English meanings for you as **editable AI drafts** (shown with
a dashed amber box and an "AI · review" tag) that you check before they count.

It's turned on for the games where content is a plain German → English pair:

- Base vocabulary (numbers, colours, animals, food, family, verbs) — used by
  Vocabulary Quiz, Memory, Hangman
- **Wortmonster** compound words
- **Hör gut zu!** listening prompts

It is deliberately **off for Fall-Detektiv**. Those case sentences teach which
noun takes which grammatical case, and a generic translation can quietly move the
emphasis and teach the wrong thing — so that content stays fully manual.

---

## Why there's a small server

Same reason as the audio: an Azure key is like a credit card, and the website is
public, so the key must never be inside it. Translation happens live (you click a
button and get a result), so — unlike the audio, which we could pre-bake into
files — we need a tiny **server function** that holds the key and does the call.
The website only talks to that function; the key never leaves it.

The function code is in **`functions/`** in this repo. It reuses the **same Azure
account** as the speech setup (a multi-service Cognitive Services key covers both
Speech and Translator).

---

## Step 1 — get an Azure Translator key

In the Azure portal, open your **Translator** (or multi-service **Cognitive
Services**) resource → **Keys and Endpoint** → copy **KEY 1** and the **Region**
(e.g. `westeurope`). Azure's free tier includes 2,000,000 characters/month — far
more than a classroom needs.

## Step 2 — deploy the function (one time)

The `functions/` folder is a ready-to-deploy Azure Functions app. The simplest
route (no command line):

1. In the Azure portal, **Create a resource → Function App** (Node 18+,
   Consumption plan — the free one).
2. Deploy the `functions/` folder to it (VS Code's *Azure Functions* extension →
   *Deploy to Function App*, or `func azure functionapp publish <name>` if you use
   the CLI).
3. On the Function App, open **Settings → Environment variables / Configuration**
   and add three **Application settings**:
   - `AZURE_TRANSLATOR_KEY` → your KEY 1
   - `AZURE_TRANSLATOR_REGION` → your region (e.g. `westeurope`)
   - `CORS_ORIGIN` → your site's address (e.g. `https://<your-user>.github.io`)
4. Copy the function's URL from **Functions → translate → Get Function URL**. It
   looks like:
   `https://<app>.azurewebsites.net/api/translate?code=<function-key>`
   (The `code=…` is a per-function key that only permits translation — it is *not*
   the Azure key, and it can be rotated any time.)

> Prefer not to run a server at all? The whole translation call lives behind one
> file — `functions/translate/translate-core.js`. It can be re-pointed at DeepL,
> Claude, etc., or moved to Firebase/Cloudflare, without changing any app code.

## Step 3 — switch it on in the app

Tell me the function URL and I'll drop it into `js/translate.js`
(`DEFAULT_ENDPOINT`) and rebuild — the ✨ buttons light up immediately. (For a
quick local test you can also set `window.TRANSLATE_ENDPOINT = "…"` in the
browser console.)

---

## How the drafts behave (by design)

- A translation is filled in as a **draft** — dashed amber box + "AI · review".
- It becomes normal content when you **edit the field** or click the **✓**.
- The buttons **never overwrite** an English field you already typed. The bulk
  button only fills **blank** ones. (Clicking ✨ on a field that already has text
  is treated as an explicit "re-generate", and still leaves a draft.)

## Local testing (optional, for developers)

```
cd functions
cp local.settings.json.example local.settings.json   # then paste your key/region
npm i -g azure-functions-core-tools@4
func start                                            # serves http://localhost:7071/api/translate
```
Then in the app's browser console:
`window.TRANSLATE_ENDPOINT = "http://localhost:7071/api/translate"`
