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
    return clone(window.CaseData || { items: [] });
  }
  function defaultCompounds() {
    return clone(window.CompoundData || []);
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
       cases (Lücken-Text)                   -> { id, name, items: [...] }
       item games (compounds/listening)      -> { id, name, items: [...] }
     --------------------------------------------------------------------- */
  var WORD_GAMES = ["quiz", "memory", "hangman"];
  var ITEM_GAMES = ["compounds", "listening"];

  function gameKind(gameKey) {
    if (gameKey === "scramble") return "sentences";
    if (gameKey === "cases") return "cases";
    if (gameKey === "hoerpaare") return "pairs";
    if (gameKey === "truefalse") return "truefalse";
    if (gameKey === "passage") return "passage";
    if (WORD_GAMES.indexOf(gameKey) >= 0) return "words";
    return "items"; // compounds / listening
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
  // A fresh Lücken-Text exercise: one flat list of sentences. `seed` may be new
  // ({ items }) or a legacy case-grouped ({ accusative, dative, genitive }) shape.
  function caseExercise(name, seed) {
    seed = seed || {};
    var items = Array.isArray(seed.items) ? clone(seed.items) : [];
    ["accusative", "dative", "genitive"].forEach(function (k) { if (Array.isArray(seed[k])) items = items.concat(clone(seed[k])); });
    return { id: exId(), name: name || "Exercise 1", items: items };
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
    // Optional typed MCQ questions (Quiz-Blitz): { question:{type,value},
    // options:[{type,value,correct}] } — keep 4 options with exactly one correct.
    if (Array.isArray(e.mcq)) {
      e.mcq = e.mcq.filter(function (m) { return m && typeof m === "object"; }).map(function (m) {
        var q = (m.question && typeof m.question === "object") ? { type: m.question.type || "text", value: String(m.question.value == null ? "" : m.question.value) } : { type: "text", value: "" };
        var opts = (Array.isArray(m.options) ? m.options : []).map(function (o) { return { type: (o && o.type) || "text", value: String((o && o.value) || ""), correct: !!(o && o.correct) }; });
        while (opts.length < 4) opts.push({ type: (opts[0] || {}).type || "text", value: "", correct: false });
        opts = opts.slice(0, 4);
        if (!opts.some(function (o) { return o.correct; })) opts[0].correct = true;
        return { question: q, options: opts };
      });
    }
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
    if (!Array.isArray(e.items)) e.items = [];
    // Fold the old accusative/dative/genitive sub-groups into one flat list.
    ["accusative", "dative", "genitive"].forEach(function (k) {
      if (Array.isArray(e[k]) && e[k].length) e.items = e.items.concat(e[k]);
      delete e[k];
    });
    e.items = e.items.map(migrateCaseEntry);
  }
  function normalizeListEx(e) {
    if (!e.id) e.id = exId();
    if (typeof e.name !== "string" || !e.name) e.name = "Exercise";
    if (!Array.isArray(e.items)) e.items = [];
  }
  // Hör-Paare (Listen & Match): an exercise is a list of "questions", and each
  // question is a set of words (min 3) students match audio-to-meaning.
  function pairsExercise(name, questions) {
    return { id: exId(), name: name || "Exercise 1", emoji: "🔗", questions: Array.isArray(questions) ? clone(questions) : [] };
  }
  function normalizePairsEx(e) {
    if (!e.id) e.id = exId();
    if (typeof e.name !== "string" || !e.name) e.name = "Exercise";
    if (typeof e.emoji !== "string") e.emoji = "🔗";
    if (!Array.isArray(e.questions)) e.questions = [];
    e.questions = e.questions.filter(function (q) { return q && typeof q === "object"; });
    e.questions.forEach(function (q) {
      // A question picks a left + right tile type once, then holds entries
      // { left, right } sharing those types. Default is Audio ↔ Text (spoken
      // German ↔ English) — the classic matching round.
      if (typeof q.leftType !== "string") q.leftType = "audio";
      if (typeof q.rightType !== "string") q.rightType = "text";
      if (!Array.isArray(q.entries)) q.entries = [];
      // Migrate the brief earlier per-pair form into the per-question model.
      if (Array.isArray(q.pairs) && q.pairs.length && !q.entries.length) {
        var first = q.pairs[0] || {};
        q.leftType = (first.question && first.question.type) || "text";
        q.rightType = (first.answer && first.answer.type) || "text";
        q.entries = q.pairs.map(function (p) {
          return { left: String(((p && p.question) || {}).value || ""), right: String(((p && p.answer) || {}).value || "") };
        });
      }
      delete q.pairs;
      // Migrate the old German↔English "words" rows into Audio↔Text entries.
      if (Array.isArray(q.words) && q.words.length) {
        var we = q.words.filter(function (w) { return w && w.de && w.en; }).map(function (w) { return { left: w.de, right: w.en }; });
        if (!q.entries.length) { q.leftType = "audio"; q.rightType = "text"; q.entries = we; }
        else if (q.leftType === "audio" && q.rightType === "text") { q.entries = q.entries.concat(we); }
        // else: incompatible types (rare) — the words are dropped.
      }
      delete q.words;
      q.entries = q.entries.filter(function (en) { return en && typeof en === "object"; });
      q.entries.forEach(function (en) { if (en.left == null) en.left = ""; if (en.right == null) en.right = ""; });
    });
  }
  // Seed Hör-Paare with a few ready-made questions (4 words each) from the vocab.
  function defaultPairsQuestions() {
    var vt = (window.GameData && window.GameData.VOCAB_TOPICS) || [];
    var pick = ["zahlen", "farben", "tiere", "essen"];
    return vt.filter(function (t) { return pick.indexOf(t.id) >= 0; }).map(function (t) {
      return { words: (t.words || []).slice(0, 4).map(function (w) { return { de: w.de, en: w.en, emoji: w.emoji || "" }; }) };
    });
  }

  /* Wahr oder Falsch? (True or False) — an exercise is a list of statements. Each
     statement has an OPTIONAL context block and a REQUIRED statement block, each
     independently text / audio / image / icon, plus a true|false answer. A block
     is { type, value }; context is null when there's no supporting context. The
     shape is deliberately Passage-ready: a passage-embedded question is the same
     object with context:null (the passage itself provides the context). */
  var TF_BLOCK_TYPES = ["text", "audio", "image", "icon"];
  function tfBlock(b, allowNull) {
    if (allowNull && (b == null)) return null;
    if (!b || typeof b !== "object") return { type: "text", value: "" };
    return {
      type: TF_BLOCK_TYPES.indexOf(b.type) >= 0 ? b.type : "text",
      value: String(b.value == null ? "" : b.value)
    };
  }
  function trueFalseExercise(name, questions) {
    return { id: exId(), name: name || "Exercise 1", emoji: "⚖️", english: "", questions: Array.isArray(questions) ? clone(questions) : [] };
  }
  function normalizeTrueFalseEx(e) {
    if (!e.id) e.id = exId();
    if (typeof e.name !== "string" || !e.name) e.name = "Exercise";
    if (typeof e.emoji !== "string") e.emoji = "⚖️";
    if (typeof e.english !== "string") e.english = "";
    if (!Array.isArray(e.questions)) e.questions = [];
    e.questions = e.questions.filter(function (q) { return q && typeof q === "object"; });
    e.questions.forEach(function (q) {
      q.context = tfBlock(q.context, true);          // optional → may stay null
      q.statement = tfBlock(q.statement, false);     // required → always an object
      q.answer = !!q.answer;
    });
  }
  // A few ready-made statements covering all four combos (with/without context,
  // audio/non-audio statement) so the game plays out of the box.
  function defaultTrueFalseQuestions() {
    return [
      { context: null, statement: { type: "text", value: "Deutschland liegt in Europa." }, answer: true },
      { context: null, statement: { type: "text", value: "Eine Katze ist ein Gemüse." }, answer: false },
      { context: { type: "icon", value: "🐶" }, statement: { type: "text", value: "Das ist ein Hund." }, answer: true },
      { context: { type: "icon", value: "🐱" }, statement: { type: "text", value: "Das ist ein großer Elefant." }, answer: false },
      { context: null, statement: { type: "audio", value: "Berlin ist die Hauptstadt von Deutschland." }, answer: true }
    ];
  }

  /* Passage-based comprehension: an exercise is a passage (text or audio) plus an
     ORDERED list of questions, each in one of the reusable formats. A question is
     { format, content } where content is that format's OWN standard schema —
     nothing about the formats changes, they're just sequenced under one passage.
     (Match the Following is a later addition; the first pass covers mcq /
     lucken-text / true-false.) */
  var PASSAGE_FORMATS = ["mcq", "lucken-text", "true-false"];
  function normalizeMcqContent(m) {
    m = (m && typeof m === "object") ? m : {};
    var q = (m.question && typeof m.question === "object")
      ? { type: m.question.type || "text", value: String(m.question.value == null ? "" : m.question.value) }
      : { type: "text", value: "" };
    var opts = (Array.isArray(m.options) ? m.options : []).map(function (o) {
      return { type: (o && o.type) || "text", value: String((o && o.value) || ""), correct: !!(o && o.correct) };
    });
    while (opts.length < 4) opts.push({ type: (opts[0] || {}).type || "text", value: "", correct: false });
    opts = opts.slice(0, 4);
    if (!opts.some(function (o) { return o.correct; })) opts[0].correct = true;
    return { question: q, options: opts };
  }
  function passageExercise(name, passage, questions) {
    return {
      id: exId(), name: name || "Exercise 1", emoji: "📖",
      passage: (passage && typeof passage === "object")
        ? { type: passage.type === "audio" ? "audio" : "text", value: String(passage.value == null ? "" : passage.value) }
        : { type: "text", value: "" },
      questions: Array.isArray(questions) ? clone(questions) : []
    };
  }
  function normalizePassageQuestion(pq) {
    if (!pq || typeof pq !== "object") return null;
    var fmt = PASSAGE_FORMATS.indexOf(pq.format) >= 0 ? pq.format : "mcq";
    var content = (pq.content && typeof pq.content === "object") ? pq.content : {};
    if (fmt === "mcq") content = normalizeMcqContent(content);
    else if (fmt === "lucken-text") content = migrateCaseEntry(content);
    else if (fmt === "true-false") content = { context: tfBlock(content.context, true), statement: tfBlock(content.statement, false), answer: !!content.answer };
    return { format: fmt, content: content };
  }
  function normalizePassageEx(e) {
    if (!e.id) e.id = exId();
    if (typeof e.name !== "string" || !e.name) e.name = "Exercise";
    if (typeof e.emoji !== "string") e.emoji = "📖";
    if (!e.passage || typeof e.passage !== "object") e.passage = { type: "text", value: "" };
    e.passage.type = e.passage.type === "audio" ? "audio" : "text";
    e.passage.value = String(e.passage.value == null ? "" : e.passage.value);
    if (!Array.isArray(e.questions)) e.questions = [];
    e.questions = e.questions.map(normalizePassageQuestion).filter(Boolean);
  }
  function defaultPassageExercise() {
    return passageExercise("Exercise 1",
      { type: "text", value: "Anna wohnt in Berlin. Sie hat einen Hund und eine Katze. Jeden Morgen geht sie mit dem Hund im Park spazieren. Am Abend liest sie ein Buch." },
      [
        { format: "mcq", content: { question: { type: "text", value: "Wo wohnt Anna?" }, options: [
          { type: "text", value: "In Berlin", correct: true }, { type: "text", value: "In München", correct: false },
          { type: "text", value: "In Hamburg", correct: false }, { type: "text", value: "In Köln", correct: false }
        ] } },
        { format: "true-false", content: { context: null, statement: { type: "text", value: "Anna hat einen Hund." }, answer: true } },
        { format: "lucken-text", content: { sentence: "Am Abend liest Anna ein ___1___.", blanks: [{ id: 1, correct: "Buch" }], wordBank: ["Buch", "Auto", "Haus", "Hund"], explanation: "" } }
      ]);
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
      quiz: [wordsExercise("Exercise 1", [])], // Quiz-Blitz: authored MCQ, starts empty
      memory: pickWords(["tiere", "essen", "farben", "familie"]),
      hangman: pickWords(["tiere", "essen", "familie", "verben"]),
      scramble: st.map(function (t) { return topicToExercise(t, "sentences"); }),
      cases: [caseExercise("Exercise 1", defaultCases())],
      compounds: [listExercise("Exercise 1", defaultCompounds())],
      listening: [listExercise("Exercise 1", defaultListening())],
      hoerpaare: [pairsExercise("Exercise 1", defaultPairsQuestions())],
      truefalse: [trueFalseExercise("Exercise 1", defaultTrueFalseQuestions())],
      passage: [defaultPassageExercise()]
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
    // Wahr oder Falsch? (true/false)
    if (!Array.isArray(ex.truefalse)) ex.truefalse = [trueFalseExercise("Exercise 1", defaultTrueFalseQuestions())];
    if (!ex.truefalse.length) ex.truefalse = [trueFalseExercise("Exercise 1", null)];
    ex.truefalse.forEach(normalizeTrueFalseEx);
    // Passage-based comprehension
    if (!Array.isArray(ex.passage)) ex.passage = [defaultPassageExercise()];
    if (!ex.passage.length) ex.passage = [defaultPassageExercise()];
    ex.passage.forEach(normalizePassageEx);

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
      // Run the built-in defaults through the same normalisers as saved content
      // (so e.g. Match-the-Following seed words migrate into the entries model).
      this.data = ensureSections(defaults());
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
      if (kind === "truefalse") return trueFalseExercise(name, [{ context: null, statement: { type: "text", value: "" }, answer: true }]);
      if (kind === "passage") return passageExercise(name, { type: "text", value: "" }, [{ format: "mcq", content: {} }]);
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
      return { items: (e && Array.isArray(e.items)) ? e.items : [] };
    },
    compoundsData: function () { var e = this.exercise("compounds"); return e ? e.items : []; },
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
