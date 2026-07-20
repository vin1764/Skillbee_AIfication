# Higher-quality voices (Azure) — setup

The app speaks German everywhere: the 🔊 buttons, game reveals, and the
**Hör gut zu!** listening game. Out of the box it uses your **computer's
built-in German voice** — no setup, works immediately. You pick which one in
the app: top-right **🎙️ Voice** button.

If you want the nicer **Azure neural voices** (they sound much more natural),
here's the one-time setup. You only do this once.

---

## Why we don't just put the key in the app

The app's website is public, so anything inside it can be read by anyone. An
Azure key is like a credit card — if it's in the website, strangers could use
it and run up charges on your account. So instead we do this:

1. You give me the key **privately** (never in the app, never on GitHub).
2. I run a small script **once** that turns the key into ready-made audio files.
3. The app plays those audio files. The key is never in the app.

---

## Step 1 — get your Azure Speech key

In the Azure portal, open your **Speech** resource → **Keys and Endpoint**, and
copy **KEY 1** and the **Location/Region** (e.g. `westeurope`). If you don't have
one yet, Azure's free tier includes plenty of speech for a classroom.

## Step 2 — give me the key (securely)

The safest way in this setup: add the key as an **environment secret** for this
project (Claude Code environment settings), named:

- `AZURE_SPEECH_KEY` → your KEY 1
- `AZURE_SPEECH_REGION` → your region (e.g. `westeurope`)

That keeps the key out of our chat and out of GitHub. Tell me once it's set and
which voice(s) you'd like (e.g. Katja, Conrad), and I'll take it from there. If
setting an environment secret isn't possible, tell me and we'll find another
safe way — just don't paste the key straight into chat if you can avoid it.

## Step 3 — I generate the audio (once)

I run:

```
AZURE_SPEECH_KEY=… AZURE_SPEECH_REGION=… \
AZURE_VOICES=de-DE-KatjaNeural,de-DE-ConradNeural \
  node scripts/generate-audio.js
```

This creates an `/audio` folder (~400 small files per voice) and an
`audio/manifest.json`. The audio files aren't secret, so they get committed and
published with the site. Your key never leaves your environment.

## Step 4 — pick the voice

Once the audio is live, open **🎙️ Voice** in the app — the Azure voices now
show up (marked ✨) and can be selected. Whatever you pick is used everywhere
the app speaks.

---

**What about words I add later?** Azure audio covers the built-in content. If
you add your own words in the editor, those will use the browser voice until we
re-run the generator (a 1-minute job I can do anytime). If you'd rather have
Azure cover your edits automatically too, that needs a small always-on server —
ask me and I'll explain that option.
