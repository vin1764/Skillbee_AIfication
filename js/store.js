/* =====================================================================
   ContentStore — lets teachers edit the game content from inside the app.
   ---------------------------------------------------------------------
   • The built-in content in data.js is the "default".
   • Teacher edits are saved in the browser (localStorage) AND synced to the
     cloud (the same Firebase as Live Mode), so an edit on one device shows
     up on every device — including the smartboard used for hosting.
   • Offline (no Firebase), it falls back to localStorage on that device.
   • Backup/Restore (JSON) stays available as an optional safety net.
   The games and the topic picker read their content from here, so any edit
   shows up immediately.
   ===================================================================== */
(function () {
  var KEY = "skillbee_deutsch_content_v1";
  var TS_KEY = "skillbee_deutsch_content_ts_v1";
  // A per-tab id so a device ignores the echo of its own cloud writes.
  var CLIENT_ID = "c" + Math.random().toString(36).slice(2, 10);

  function clone(x) {
    return JSON.parse(JSON.stringify(x));
  }

  function defaultCases() {
    return clone(window.CaseData || { accusative: [], dative: [], genitive: [] });
  }
  function defaultCompounds() {
    return clone(window.CompoundData || []);
  }
  function defaultPlurals() {
    return clone(window.PluralData || []);
  }
  function defaultVerbs() {
    return clone(window.VerbData || []);
  }
  function defaultListening() {
    return clone(window.ListeningData || []);
  }

  /* ---------------------------------------------------------------------
     Exercises — EVERY content game holds its own LIST of named "exercises".
     A teacher builds a fresh exercise for each lesson and keeps the previous
     ones instead of overwriting; in each game they pick which to play.
     Each game owns its content (nothing is shared between games). Shapes:
       words games  (quiz, memory, hangman)  -> { id, name, emoji, english, words: [...] }
       sentence game (scramble)              -> { id, name, emoji, english, sentences: [...] }
       cases (Fall-Detektiv)                 -> { id, name, accusative, dative, genitive }
       item games (compounds/plurals/verbs/listening) -> { id, name, items: [...] }
     --------------------------------------------------------------------- */
  var WORD_GAMES = ["quiz", "memory", "hangman"];
  var ITEM_GAMES = ["compounds", "plurals", "verbs", "listening"];

  function gameKind(gameKey) {
    if (gameKey === "scramble") return "sentences";
    if (gameKey === "cases") return "cases";
    if (gameKey === "hoerpaare") return "pairs";
    if (WORD_GAMES.indexOf(gameKey) >= 0) return "words";
    return "items"; // compounds / plurals / verbs / listening
  }

  function exId() {
    return "ex-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e4).toString(36);
  }
  function wordsExercise(name, words) {
    return { id: exId(), name: name || "Exercise 1", emoji: "📚", english: "", words: Array.isArray(words) ? clone(words) : [] };
  }
  function sentencesExercise(name, sentences) {
    return { id: exId(), name: name || "Exercise 1", emoji: "🗣️", english: "", sentences: Array.isArray(sentences) ? clone(sentences) : [] };
  }
  // A fresh exercise for the case game (three sub-lists). `seed` may be a legacy
  // { accusative, dative, genitive } object whose content is migrated in.
  function caseExercise(name, seed) {
    seed = seed || {};
    return {
      id: exId(), name: name || "Exercise 1",
      accusative: Array.isArray(seed.accusative) ? clone(seed.accusative) : [],
      dative: Array.isArray(seed.dative) ? clone(seed.dative) : [],
      genitive: Array.isArray(seed.genitive) ? clone(seed.genitive) : []
    };
  }
  // A fresh exercise for a flat-list game. `items` may be a legacy array migrated in.
  function listExercise(name, items) {
    return { id: exId(), name: name || "Exercise 1", items: Array.isArray(items) ? clone(items) : [] };
  }
  // Turn a legacy shared-bank topic into a per-game exercise (keeps its name/emoji).
  function topicToExercise(topic, kind) {
    var e = clone(topic || {});
    if (!e.id) e.id = exId();
    if (typeof e.name !== "string" || !e.name) e.name = "Exercise";
    if (typeof e.emoji !== "string") e.emoji = kind === "sentences" ? "🗣️" : "📚";
    if (typeof e.english !== "string") e.english = "";
    if (kind === "sentences") { if (!Array.isArray(e.sentences)) e.sentences = []; delete e.words; }
    else { if (!Array.isArray(e.words)) e.words = []; delete e.sentences; }
    return e;
  }
  function normalizeWordsEx(e) {
    if (!e.id) e.id = exId();
    if (typeof e.name !== "string" || !e.name) e.name = "Exercise";
    if (typeof e.emoji !== "string") e.emoji = "📚";
    if (typeof e.english !== "string") e.english = "";
    if (!Array.isArray(e.words)) e.words = [];
  }
  function normalizeSentencesEx(e) {
    if (!e.id) e.id = exId();
    if (typeof e.name !== "string" || !e.name) e.name = "Exercise";
    if (typeof e.emoji !== "string") e.emoji = "🗣️";
    if (typeof e.english !== "string") e.english = "";
    if (!Array.isArray(e.sentences)) e.sentences = [];
  }
  // A Lücken-Text sentence entry: { sentence, blanks:[{id,correct}], wordBank,
  // explanation }. Older stores hold single-blank case rows ({ sentence, correct,
  // distractors, clueWord }) — migrate those forward in place. Idempotent.
  function migrateCaseEntry(e) {
    if (!e || typeof e !== "object") return { sentence: "", blanks: [], wordBank: [], explanation: "" };
    if (Array.isArray(e.blanks)) {
      e.sentence = String(e.sentence || "");
      e.blanks = e.blanks.map(function (b, i) {
        return { id: (b && b.id != null) ? b.id : i + 1, correct: String((b && b.correct) || "").trim() };
      });
      e.wordBank = Array.isArray(e.wordBank) ? e.wordBank.map(function (w) { return String(w).trim(); }).filter(Boolean) : [];
      if (typeof e.explanation !== "string") e.explanation = "";
      delete e.correct; delete e.distractors; delete e.clueWord; delete e.blank; delete e.answer;
      return e;
    }
    var correct = String(e.correct || "").trim();
    var bank = [];
    if (correct) bank.push(correct);
    (Array.isArray(e.distractors) ? e.distractors : []).forEach(function (d) { d = String(d).trim(); if (d && bank.indexOf(d) < 0) bank.push(d); });
    return {
      sentence: String(e.sentence || ""),
      blanks: correct ? [{ id: 1, correct: correct }] : [],
      wordBank: bank,
      explanation: e.explanation || ""
    };
  }
  function normalizeCaseEx(e) {
    if (!e.id) e.id = exId();
    if (typeof e.name !== "string" || !e.name) e.name = "Exercise";
    ["accusative", "dative", "genitive"].forEach(function (k) {
      if (!Array.isArray(e[k])) e[k] = [];
      e[k] = e[k].map(migrateCaseEntry);
    });
  }
  function normalizeListEx(e) {
    if (!e.id) e.id = exId();
    if (typeof e.name !== "string" || !e.name) e.name = "Exercise";
    if (!Array.isArray(e.items)) e.items = [];
  }
  // Hör-Paare (Listen & Match): an exercise is a list of "questions", and each
  // question is a set of words (min 3) students match audio-to-meaning.
  function pairsExercise(name, questions) {
    return { id: exId(), name: name || "Exercise 1", emoji: "🎧", questions: Array.isArray(questions) ? clone(questions) : [] };
  }
  function normalizePairsEx(e) {
    if (!e.id) e.id = exId();
    if (typeof e.name !== "string" || !e.name) e.name = "Exercise";
    if (typeof e.emoji !== "string") e.emoji = "🎧";
    if (!Array.isArray(e.questions)) e.questions = [];
    e.questions = e.questions.filter(function (q) { return q && typeof q === "object"; });
    e.questions.forEach(function (q) { if (!Array.isArray(q.words)) q.words = []; });
  }
  // Seed Hör-Paare with a few ready-made questions (4 words each) from the vocab.
  function defaultPairsQuestions() {
    var vt = (window.GameData && window.GameData.VOCAB_TOPICS) || [];
    var pick = ["zahlen", "farben", "tiere", "essen"];
    return vt.filter(function (t) { return pick.indexOf(t.id) >= 0; }).map(function (t) {
      return { words: (t.words || []).slice(0, 4).map(function (w) { return { de: w.de, en: w.en, emoji: w.emoji || "" }; }) };
    });
  }

  // The topics a legacy store's game offered (its selection subset, or all).
  function legacyTopicsFor(d, gameId, type) {
    var pool = (type === "sentences" ? d.sentences : d.vocab) || [];
    var cfg = d.games && d.games[gameId];
    if (!cfg || !Array.isArray(cfg.topics)) return pool;
    var set = {};
    cfg.topics.forEach(function (id) { set[id] = true; });
    return pool.filter(function (t) { return set[t.id]; });
  }

  function defaultExercises() {
    var vt = (window.GameData && window.GameData.VOCAB_TOPICS) || [];
    var st = (window.GameData && window.GameData.SENTENCE_TOPICS) || [];
    // Each word game starts from a DIFFERENT subset of the built-in topics, so
    // Quiz / Memory / Hangman aren't identical out of the box (teachers add more).
    var pickWords = function (ids) {
      var chosen = ids ? vt.filter(function (t) { return ids.indexOf(t.id) >= 0; }) : vt;
      if (!chosen.length) chosen = vt; // never seed a word game empty on a typo
      return chosen.map(function (t) { return topicToExercise(t, "words"); });
    };
    return {
      quiz: pickWords(null), // the full set
      memory: pickWords(["tiere", "essen", "farben", "familie"]),
      hangman: pickWords(["tiere", "essen", "familie", "verben"]),
      scramble: st.map(function (t) { return topicToExercise(t, "sentences"); }),
      cases: [caseExercise("Exercise 1", defaultCases())],
      compounds: [listExercise("Exercise 1", defaultCompounds())],
      plurals: [listExercise("Exercise 1", defaultPlurals())],
      verbs: [listExercise("Exercise 1", defaultVerbs())],
      listening: [listExercise("Exercise 1", defaultListening())],
      hoerpaare: [pairsExercise("Exercise 1", defaultPairsQuestions())]
    };
  }

  function defaults() {
    // Every game holds its own named exercises, seeded from the built-in data.
    return { exercises: defaultExercises() };
  }

  // Make sure any saved/imported store is in the current shape. Legacy shared
  // banks (d.vocab / d.sentences with d.games selection, and d.cases / d.compounds
  // / …) are migrated into per-game exercises, then dropped.
  function ensureSections(d) {
    if (!d.exercises || typeof d.exercises !== "object") d.exercises = {};
    var ex = d.exercises;

    // word games — migrate the legacy shared vocab bank (honouring old per-game selection)
    WORD_GAMES.forEach(function (g) {
      if (!Array.isArray(ex[g])) ex[g] = legacyTopicsFor(d, g, "vocab").map(function (t) { return topicToExercise(t, "words"); });
      if (!ex[g].length) ex[g] = [wordsExercise("Exercise 1", null)];
      ex[g].forEach(normalizeWordsEx);
    });
    // sentence game (scramble)
    if (!Array.isArray(ex.scramble)) ex.scramble = legacyTopicsFor(d, "scramble", "sentences").map(function (t) { return topicToExercise(t, "sentences"); });
    if (!ex.scramble.length) ex.scramble = [sentencesExercise("Exercise 1", null)];
    ex.scramble.forEach(normalizeSentencesEx);
    // cases (Fall-Detektiv)
    if (!Array.isArray(ex.cases)) ex.cases = [caseExercise("Exercise 1", d.cases)];
    if (!ex.cases.length) ex.cases = [caseExercise("Exercise 1", null)];
    ex.cases.forEach(normalizeCaseEx);
    // flat-list games
    ITEM_GAMES.forEach(function (k) {
      if (!Array.isArray(ex[k])) ex[k] = [listExercise("Exercise 1", d[k])];
      if (!ex[k].length) ex[k] = [listExercise("Exercise 1", null)];
      ex[k].forEach(normalizeListEx);
    });
    // Hör-Paare (pairs)
    if (!Array.isArray(ex.hoerpaare)) ex.hoerpaare = [pairsExercise("Exercise 1", defaultPairsQuestions())];
    if (!ex.hoerpaare.length) ex.hoerpaare = [pairsExercise("Exercise 1", null)];
    ex.hoerpaare.forEach(normalizePairsEx);

    // Legacy fields are now represented as exercises — drop them.
    delete d.vocab; delete d.sentences; delete d.games;
    delete d.cases; delete d.compounds; delete d.plurals; delete d.verbs; delete d.listening;
    return d;
  }

  var store = {
    data: null,
    _ts: 0,                 // last-change timestamp (ms) used to order edits
    syncState: "local",     // local | saving | synced | offline
    editing: false,         // true while the content editor is open
    pendingRemote: null,    // a newer cloud version that arrived mid-edit
    cloudUnsub: null,
    _pushTimer: null,
    onSync: null,           // called after cloud content is adopted (re-render)
    onSyncState: null,      // called when syncState changes (update the chip)
    onRemotePending: null,  // called when a newer cloud version arrives mid-edit

    load: function () {
      try {
        var raw = localStorage.getItem(KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          if (parsed && (parsed.exercises || Array.isArray(parsed.vocab) || Array.isArray(parsed.sentences))) {
            this.data = ensureSections(parsed);
            this._ts = Number(localStorage.getItem(TS_KEY)) || 0;
            return;
          }
        }
      } catch (e) {
        /* localStorage may be unavailable (e.g. sandboxed) — fall back to defaults */
      }
      this.data = defaults();
      this._ts = 0;
    },

    _saveLocal: function () {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.data));
        localStorage.setItem(TS_KEY, String(this._ts));
        return true;
      } catch (e) { return false; }
    },

    // Called on every edit: save on this device, then sync to the cloud.
    save: function () {
      this._ts = Date.now();
      var ok = this._saveLocal();
      this._scheduleCloudPush();
      return ok;
    },

    reset: function () {
      this.data = defaults();
      this._ts = Date.now();
      this._saveLocal();
      this._scheduleCloudPush();
    },

    /* ---------------- cloud sync (uses the same Firebase as Live Mode) ---------------- */
    _online: function () {
      return !!(window.LiveDB && window.LiveDB.available());
    },
    _setState: function (s) {
      this.syncState = s;
      if (this.onSyncState) this.onSyncState(s);
    },
    _scheduleCloudPush: function () {
      if (!this._online()) { this._setState("offline"); return; }
      var self = this;
      this._setState("saving");
      if (this._pushTimer) clearTimeout(this._pushTimer);
      this._pushTimer = setTimeout(function () { self._pushCloud(); }, 1200);
    },
    _pushCloud: function () {
      if (!this._online()) { this._setState("offline"); return; }
      var self = this;
      window.LiveDB.setContent({ data: this.data, updatedAt: this._ts, clientId: CLIENT_ID })
        .then(function () { self._setState("synced"); })
        .catch(function () { self._setState("offline"); });
    },
    // Start listening once Firebase is ready (called from App.init).
    initCloud: function () {
      if (!this._online()) { this._setState("offline"); return; }
      var self = this;
      this._setState("synced");
      this.cloudUnsub = window.LiveDB.listenContent(function (doc) {
        if (!doc) { self._pushCloud(); return; }          // empty cloud → seed it
        if (doc.clientId === CLIENT_ID) return;            // our own write, echoed
        if (!doc.data || (doc.updatedAt || 0) <= self._ts) return; // not newer
        if (self.editing) {                                // don't clobber active edits
          self.pendingRemote = doc;
          if (self.onRemotePending) self.onRemotePending();
          return;
        }
        self._adoptRemote(doc);
      });
    },
    _adoptRemote: function (doc) {
      this.data = ensureSections(doc.data);
      this._ts = doc.updatedAt || Date.now();
      this._saveLocal();
      this.pendingRemote = null;
      this._setState("synced");
      if (this.onSync) this.onSync();
    },
    applyPendingRemote: function () {
      if (this.pendingRemote) this._adoptRemote(this.pendingRemote);
    },

    isCustomized: function () {
      try {
        return !!localStorage.getItem(KEY);
      } catch (e) {
        return false;
      }
    },

    /* -------- Exercises — every content game -------- */
    gameKind: function (gameKey) { return gameKind(gameKey); },
    // The list of exercises for one game ("quiz" | "cases" | "compounds" | ...).
    exercisesFor: function (gameKey) {
      var arr = this.data.exercises && this.data.exercises[gameKey];
      return Array.isArray(arr) ? arr : [];
    },
    // One exercise by id (falls back to the first exercise of that game).
    exercise: function (gameKey, id) {
      var arr = this.exercisesFor(gameKey);
      if (id) { for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i]; }
      return arr[0] || null;
    },
    _blankExercise: function (gameKey, name) {
      var kind = gameKind(gameKey);
      if (kind === "cases") return caseExercise(name, null);
      if (kind === "words") return wordsExercise(name, null);
      if (kind === "sentences") return sentencesExercise(name, null);
      if (kind === "pairs") return pairsExercise(name, [{ words: [{ de: "", en: "", emoji: "" }, { de: "", en: "", emoji: "" }, { de: "", en: "", emoji: "" }] }]);
      return listExercise(name, null);
    },
    addExercise: function (gameKey, name) {
      var arr = this.exercisesFor(gameKey);
      var e = this._blankExercise(gameKey, name || "Exercise " + (arr.length + 1));
      arr.push(e);
      this.save();
      return e;
    },
    duplicateExercise: function (gameKey, id) {
      var src = this.exercise(gameKey, id);
      if (!src) return null;
      var copy = clone(src);
      copy.id = exId();
      copy.name = (src.name || "Exercise") + " (copy)";
      this.exercisesFor(gameKey).push(copy);
      this.save();
      return copy;
    },
    renameExercise: function (gameKey, id, name) {
      var e = this.exercise(gameKey, id);
      if (e) { e.name = String(name || "").trim() || e.name; this.save(); }
    },
    deleteExercise: function (gameKey, id) {
      var arr = this.exercisesFor(gameKey);
      for (var i = 0; i < arr.length; i++) if (arr[i].id === id) { arr.splice(i, 1); break; }
      if (!arr.length) arr.push(this._blankExercise(gameKey, "Exercise 1")); // keep at least one
      this.save();
    },
    // Copy an exercise from another content-compatible game into this one.
    copyExerciseFrom: function (destKey, srcKey, srcId) {
      if (gameKind(destKey) !== gameKind(srcKey)) return null;
      var src = this.exercise(srcKey, srcId);
      if (!src) return null;
      var copy = clone(src);
      copy.id = exId();
      this.exercisesFor(destKey).push(copy);
      this.save();
      return copy;
    },

    /* Back-compat accessors — the FIRST exercise's content (used as a fallback
       when no specific exercise is chosen, e.g. by the audio helper). */
    casesData: function () {
      var e = this.exercise("cases");
      return e ? { accusative: e.accusative, dative: e.dative, genitive: e.genitive } : { accusative: [], dative: [], genitive: [] };
    },
    compoundsData: function () { var e = this.exercise("compounds"); return e ? e.items : []; },
    pluralsData: function () { var e = this.exercise("plurals"); return e ? e.items : []; },
    verbsData: function () { var e = this.exercise("verbs"); return e ? e.items : []; },
    listeningData: function () { var e = this.exercise("listening"); return e ? e.items : []; },

    newId: function (prefix) {
      return (
        (prefix || "id") +
        "-" +
        Date.now().toString(36) +
        "-" +
        Math.floor(Math.random() * 1e4).toString(36)
      );
    },

    exportJSON: function () {
      return JSON.stringify(this.data, null, 2);
    },

    importJSON: function (text) {
      var parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" ||
          (!parsed.exercises && !Array.isArray(parsed.vocab) && !Array.isArray(parsed.sentences))) {
        throw new Error("The file is not in the right format.");
      }
      this.data = ensureSections(parsed);
      this._ts = Date.now();
      this._saveLocal();
      this._scheduleCloudPush();
    }
  };

  store.load();
  window.ContentStore = store;
})();
