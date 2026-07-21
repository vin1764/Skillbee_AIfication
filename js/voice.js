/* =====================================================================
   VoiceBox — one pluggable text-to-speech layer for the whole app.
   Everything that speaks German (speaker buttons, game reveals, the
   Hör-gut-zu! word) goes through VoiceBox.speak(), so the voice chosen in
   Settings is used everywhere.

   Two engines:
   • Browser voices — the operating system's built-in German voices. Free,
     no setup, works offline. Quality varies by device (Chrome's "Google
     Deutsch" is good).
   • Azure neural voices — much higher quality. The app never calls Azure
     directly (the key must stay off this public site); instead a one-time
     script pre-generates the audio into /audio, and VoiceBox plays those
     files, falling back to a browser voice for anything not pre-generated.

   The chosen voice is stored per device (voices differ between a laptop and
   a phone), not synced.
   ===================================================================== */
(function () {
  var KEY = "skillbee_voice_v1";
  var manifest = null; // { files: {hash:1}, voices:[id] } once Azure audio exists

  // Curated Azure German neural voices offered in Settings.
  var AZURE_VOICES = [
    { id: "azure:de-DE-KatjaNeural", label: "Katja · Deutschland (weiblich)" },
    { id: "azure:de-DE-ConradNeural", label: "Conrad · Deutschland (männlich)" },
    { id: "azure:de-DE-AmalaNeural", label: "Amala · Deutschland (weiblich)" },
    { id: "azure:de-DE-KillianNeural", label: "Killian · Deutschland (männlich)" },
    { id: "azure:de-AT-IngridNeural", label: "Ingrid · Österreich (weiblich)" },
    { id: "azure:de-CH-LeniNeural", label: "Leni · Schweiz (weiblich)" }
  ];

  var chosen = loadChoice();

  function loadChoice() { try { return localStorage.getItem(KEY) || "system"; } catch (e) { return "system"; } }
  function setChoice(id) { chosen = id; try { localStorage.setItem(KEY, id); } catch (e) {} }

  // djb2 — must match scripts/generate-audio.js so filenames line up.
  function hash(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) { h = ((h << 5) + h) + s.charCodeAt(i); h = h & 0xffffffff; }
    return (h >>> 0).toString(36);
  }
  function fileFor(voiceId, text) { return hash(voiceId + "|" + text); }

  function loadManifest() {
    try {
      fetch("audio/manifest.json")
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { if (j && j.files) manifest = j; })
        .catch(function () {});
    } catch (e) {}
  }

  function browserVoices() {
    try {
      return (window.speechSynthesis ? window.speechSynthesis.getVoices() : [])
        .filter(function (v) { return v.lang && v.lang.toLowerCase().indexOf("de") === 0; });
    } catch (e) { return []; }
  }

  function speakBrowser(text, rate) {
    try {
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = "de-DE";
      u.rate = 0.95 * (rate || 1);
      var vs = browserVoices(), pick = null;
      if (chosen && chosen.indexOf("browser:") === 0) {
        var want = chosen.slice(8);
        pick = vs.filter(function (v) { return (v.voiceURI || v.name) === want || v.name === want; })[0];
      }
      if (!pick) pick = vs[0];
      if (pick) u.voice = pick;
      window.speechSynthesis.speak(u);
    } catch (e) { /* pronunciation is a nice-to-have */ }
  }

  // Play a specific voice's Azure file if it exists; returns true if it started.
  // `rate` (1 = normal) sets the mp3 playback speed.
  function playAzureFile(voiceId, text, rate) {
    if (!manifest || !manifest.files) return false;
    var h = fileFor(voiceId, text);
    if (!manifest.files[h]) return false;
    try {
      var a = new Audio("audio/" + h + ".mp3");
      if (rate && rate !== 1) { try { a.playbackRate = rate; } catch (e) {} }
      a.play().catch(function () { speakBrowser(text, rate); });
      return true;
    } catch (e) { return false; }
  }

  // speak(text, opts) — opts.rate scales the playback speed (1 = normal).
  function speak(text, opts) {
    text = String(text == null ? "" : text).trim();
    if (!text) return;
    var rate = (opts && opts.rate) || 1;
    if (chosen && chosen.indexOf("azure:") === 0) {
      if (playAzureFile(chosen, text, rate)) return; // pre-generated file
    }
    speakBrowser(text, rate); // fallback / browser voice
  }

  function azureReady() { return !!(manifest && manifest.files); }
  function voiceGenerated(id) {
    return !!(manifest && manifest.voices && manifest.voices.indexOf(id) >= 0);
  }

  /* ------- list of choices for the Settings screen ------- */
  function listVoices() {
    var out = [{ id: "system", label: "System default", kind: "browser" }];
    browserVoices().forEach(function (v) {
      out.push({ id: "browser:" + (v.voiceURI || v.name), label: v.name, kind: "browser" });
    });
    AZURE_VOICES.forEach(function (av) {
      out.push({ id: av.id, label: av.label, kind: "azure", ready: voiceGenerated(av.id) });
    });
    return out;
  }

  /* ------- Settings modal ------- */
  function openSettings() {
    var el = window.App && window.App.kit && window.App.kit.el;
    var overlay = document.createElement("div");
    overlay.className = "voice-overlay";
    function close() { overlay.remove(); }
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });

    var card = document.createElement("div");
    card.className = "voice-card";
    card.innerHTML =
      '<div class="voice-title">🎙️ Voice</div>' +
      '<p class="voice-sub">Pick the German voice used everywhere the app speaks. Saved on this device.</p>';

    var listWrap = document.createElement("div");
    listWrap.className = "voice-list";

    function row(v) {
      var r = document.createElement("label");
      r.className = "voice-row" + (chosen === v.id ? " sel" : "");
      var disabled = v.kind === "azure" && !v.ready;

      var radio = document.createElement("input");
      radio.type = "radio"; radio.name = "voice"; radio.className = "voice-radio";
      radio.checked = chosen === v.id; radio.disabled = disabled;
      radio.addEventListener("change", function () {
        setChoice(v.id);
        Array.prototype.forEach.call(listWrap.children, function (c) { c.classList.remove("sel"); });
        r.classList.add("sel");
      });

      var name = document.createElement("span");
      name.className = "voice-name";
      name.textContent = v.label + (v.kind === "azure" ? "  ✨" : "");

      var test = document.createElement("button");
      test.className = "voice-test"; test.type = "button"; test.textContent = "▶";
      test.title = "Hear a sample";
      test.disabled = disabled;
      test.addEventListener("click", function (e) {
        e.preventDefault();
        var prev = chosen; chosen = v.id;        // temporarily use this voice
        speak("Hallo! Ich spreche Deutsch.");
        chosen = prev;
      });

      r.appendChild(radio); r.appendChild(name); r.appendChild(test);
      if (disabled) { var tag = document.createElement("span"); tag.className = "voice-tag"; tag.textContent = "needs setup"; r.appendChild(tag); }
      return r;
    }

    listVoices().forEach(function (v) { listWrap.appendChild(row(v)); });
    card.appendChild(listWrap);

    if (!azureReady()) {
      var note = document.createElement("p");
      note.className = "voice-note";
      note.innerHTML = "✨ <b>Azure neural voices</b> are higher quality. They appear once your admin has generated the audio (see <code>docs/AUDIO_SETUP.md</code>).";
      card.appendChild(note);
    }

    var done = document.createElement("button");
    done.className = "btn primary voice-done"; done.textContent = "Done";
    done.addEventListener("click", close);
    card.appendChild(done);

    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }

  window.VoiceBox = {
    speak: speak,
    listVoices: listVoices,
    openSettings: openSettings,
    get: function () { return chosen; },
    set: setChoice,
    azureReady: azureReady,
    hash: hash
  };
  loadManifest();
})();
