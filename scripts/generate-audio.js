/* =====================================================================
   generate-audio.js — ONE-TIME Azure neural-voice audio generator.
   ---------------------------------------------------------------------
   Run this once (with your Azure Speech key) to produce high-quality
   German audio for the app's built-in content. The app then plays those
   static files — it never calls Azure at runtime and never sees the key.

   Usage:
     AZURE_SPEECH_KEY=xxxx AZURE_SPEECH_REGION=westeurope \
     AZURE_VOICES=de-DE-KatjaNeural,de-DE-ConradNeural \
       node scripts/generate-audio.js

   • Reads the key/region from environment variables (never committed).
   • AZURE_VOICES is an optional comma list; defaults to Katja + Conrad.
   • Writes mp3s + audio/manifest.json. Commit the /audio folder (the audio
     is not secret); the key stays only in your environment.
   See docs/AUDIO_SETUP.md for the plain-language walkthrough.
   ===================================================================== */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");

const KEY = process.env.AZURE_SPEECH_KEY;
const REGION = process.env.AZURE_SPEECH_REGION || "westeurope";
const VOICES = (process.env.AZURE_VOICES || "de-DE-KatjaNeural,de-DE-ConradNeural")
  .split(",").map((s) => s.trim()).filter(Boolean);

if (!KEY) {
  console.error("Missing AZURE_SPEECH_KEY. See docs/AUDIO_SETUP.md.");
  process.exit(1);
}

const ROOT = path.join(__dirname, "..");
const AUDIO_DIR = path.join(ROOT, "audio");

/* ---- load the built-in content by stubbing the browser global ---- */
global.window = {};
["data.js", "data-cases.js", "data-compounds.js", "data-plurals.js", "data-verbs.js", "data-listening.js"]
  .forEach((f) => require(path.join(ROOT, "js", f)));
const W = global.window;

/* ---- djb2 hash — MUST match js/voice.js ---- */
function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) + h) + s.charCodeAt(i); h = h & 0xffffffff; }
  return (h >>> 0).toString(36);
}

/* ---- clock phrases (mirror of the Uhrzeit-Blitz generator) ---- */
function clockPhrases() {
  const NUMW = ["", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf"];
  const hw = (h, uhr) => h === 1 ? (uhr ? "ein" : "eins") : NUMW[h];
  const nh = (h) => h % 12 + 1;
  const MN = { 5: "fünf", 10: "zehn", 20: "zwanzig" }, MV = { 40: "zwanzig", 50: "zehn", 55: "fünf" };
  const out = [];
  for (let h = 1; h <= 12; h++) {
    [0, 5, 10, 15, 20, 30, 40, 45, 50, 55].forEach((m) => {
      out.push(m === 0 ? hw(h, true) + " Uhr" : m === 15 ? "viertel nach " + hw(h) : m === 30 ? "halb " + hw(nh(h)) :
        m === 45 ? "viertel vor " + hw(nh(h)) : MN[m] ? MN[m] + " nach " + hw(h) : MV[m] ? MV[m] + " vor " + hw(nh(h)) : "");
    });
  }
  return out;
}

/* ---- collect every German string the app speaks ---- */
function collectTexts() {
  const set = new Set();
  const add = (s) => { s = String(s || "").trim(); if (s) set.add(s); };

  (W.GameData && W.GameData.VOCAB_TOPICS || []).forEach((t) => (t.words || []).forEach((w) => add(w.de)));
  (W.PluralData || []).forEach((p) => { add(p.singular); add("die " + p.plural); });
  (W.VerbData || []).forEach((v) => {
    add(v.inf);
    ["ich", "du", "er", "wir", "ihr", "sie"].forEach((k) => v.forms && v.forms[k] && add(k + " " + v.forms[k]));
  });
  const C = W.CaseData || {};
  ["accusative", "dative", "genitive"].forEach((k) => (C[k] || []).forEach((s) => add(String(s.sentence).replace("___", s.correct))));
  (W.CompoundData || []).forEach((c) => add((c.gender || "der") + " " + (c.compound || (c.partA + c.partB))));
  (W.ListeningData || []).forEach((w) => add(w.word));
  clockPhrases().forEach(add);

  return Array.from(set);
}

/* ---- Azure REST TTS ---- */
function xmlEscape(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function synth(voice, text) {
  const ssml = `<speak version='1.0' xml:lang='de-DE'><voice name='${voice}'>${xmlEscape(text)}</voice></speak>`;
  const opts = {
    method: "POST",
    hostname: `${REGION}.tts.speech.microsoft.com`,
    path: "/cognitiveservices/v1",
    headers: {
      "Ocp-Apim-Subscription-Key": KEY,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "skillbee-deutsch-games"
    }
  };
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on("data", (d) => chunks.push(d));
      res.on("end", () => res.statusCode === 200 ? resolve(Buffer.concat(chunks))
        : reject(new Error("HTTP " + res.statusCode + " " + Buffer.concat(chunks).toString().slice(0, 200))));
    });
    req.on("error", reject);
    req.write(ssml);
    req.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async function main() {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
  const texts = collectTexts();
  console.log(`Generating ${texts.length} phrases × ${VOICES.length} voice(s) = ${texts.length * VOICES.length} files`);
  const files = {}, voiceIds = [];
  let done = 0, failed = 0;
  for (const azureVoice of VOICES) {
    const voiceId = "azure:" + azureVoice;
    voiceIds.push(voiceId);
    for (const text of texts) {
      const h = hash(voiceId + "|" + text);
      const out = path.join(AUDIO_DIR, h + ".mp3");
      if (fs.existsSync(out)) { files[h] = 1; continue; } // resume-friendly
      try {
        const buf = await synth(azureVoice, text);
        fs.writeFileSync(out, buf);
        files[h] = 1; done++;
        if (done % 25 === 0) console.log(`  ${done} generated…`);
      } catch (e) {
        failed++;
        console.error(`  ✗ ${azureVoice} "${text}": ${e.message}`);
      }
      await sleep(60); // be gentle with the API
    }
  }
  fs.writeFileSync(path.join(AUDIO_DIR, "manifest.json"),
    JSON.stringify({ files, voices: voiceIds, count: texts.length, updated: new Date().toISOString() }, null, 0));
  console.log(`Done. ${done} new, ${failed} failed. Wrote audio/manifest.json (${Object.keys(files).length} files).`);
})();
