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
     Exercises — the 5 Live-Class content games (Fall-Detektiv, Wortmonster,
     Plural-Palast, Konjugations-Karussell, Hör gut zu!) each hold a LIST of
     named "exercises" rather than one flat bank. A teacher can build a fresh
     exercise for every lesson while keeping the previous ones. "cases" keeps
     three case sub-lists per exercise; the others keep a flat "items" list.
     --------------------------------------------------------------------- */
  function exId() {
    return "ex-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e4).toString(36);
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
  function normalizeCaseEx(e) {
    if (!e.id) e.id = exId();
    if (typeof e.name !== "string" || !e.name) e.name = "Exercise";
    ["accusative", "dative", "genitive"].forEach(function (k) { if (!Array.isArray(e[k])) e[k] = []; });
  }
  function normalizeListEx(e) {
    if (!e.id) e.id = exId();
    if (typeof e.name !== "string" || !e.name) e.name = "Exercise";
    if (!Array.isArray(e.items)) e.items = [];
  }

  function defaultExercises() {
    return {
      cases: [caseExercise("Exercise 1", defaultCases())],
      compounds: [listExercise("Exercise 1", defaultCompounds())],
      plurals: [listExercise("Exercise 1", defaultPlurals())],
      verbs: [listExercise("Exercise 1", defaultVerbs())],
      listening: [listExercise("Exercise 1", defaultListening())]
    };
  }

  function defaults() {
    return {
      vocab: clone(window.GameData.VOCAB_TOPICS),
      sentences: clone(window.GameData.SENTENCE_TOPICS),
      // Live-game content, seeded from the built-in data but editable and
      // saved/synced like everything else. Each game holds named exercises.
      exercises: defaultExercises(),
      // Per-game topic selection. Missing entry / no "topics" list = the game
      // uses ALL topics of its type from the bank (the default).
      games: {}
    };
  }

  // Make sure an older saved store gains the new sections instead of showing
  // empty editors. Legacy flat banks (d.cases / d.compounds / …) are migrated
  // into a first exercise, then dropped so exercises are the single source.
  function ensureSections(d) {
    if (!d.exercises || typeof d.exercises !== "object") d.exercises = {};
    var ex = d.exercises;

    if (!Array.isArray(ex.cases)) ex.cases = [caseExercise("Exercise 1", d.cases)];
    else if (!ex.cases.length) ex.cases = [caseExercise("Exercise 1", null)];
    ex.cases.forEach(normalizeCaseEx);

    ["compounds", "plurals", "verbs", "listening"].forEach(function (k) {
      if (!Array.isArray(ex[k])) ex[k] = [listExercise("Exercise 1", d[k])];
      else if (!ex[k].length) ex[k] = [listExercise("Exercise 1", null)];
      ex[k].forEach(normalizeListEx);
    });

    // Legacy flat fields are now represented as exercises — drop them.
    delete d.cases; delete d.compounds; delete d.plurals; delete d.verbs; delete d.listening;

    if (!d.games || typeof d.games !== "object") d.games = {};
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
          if (parsed && Array.isArray(parsed.vocab) && Array.isArray(parsed.sentences)) {
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

    vocabTopics: function () {
      return this.data.vocab;
    },
    sentenceTopics: function () {
      return this.data.sentences;
    },

    poolFor: function (type) {
      return type === "sentences" ? this.data.sentences : this.data.vocab;
    },

    /* -------- Exercises (Live-Class content games) -------- */
    // The list of exercises for one game ("cases" | "compounds" | ...).
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
      return gameKey === "cases" ? caseExercise(name, null) : listExercise(name, null);
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

    /* Topics a given game should offer (its selected subset, or all by default). */
    topicsForGame: function (gameId, type) {
      var pool = this.poolFor(type);
      var cfg = this.data.games && this.data.games[gameId];
      if (!cfg || !cfg.topics) return pool;
      var set = {};
      cfg.topics.forEach(function (id) { set[id] = true; });
      return pool.filter(function (t) { return set[t.id]; });
    },

    isTopicInGame: function (gameId, topicId) {
      var cfg = this.data.games && this.data.games[gameId];
      if (!cfg || !cfg.topics) return true; // "all" by default
      return cfg.topics.indexOf(topicId) !== -1;
    },

    setTopicInGame: function (gameId, topicId, type, on) {
      if (!this.data.games) this.data.games = {};
      var cfg = this.data.games[gameId];
      if (!cfg || !cfg.topics) {
        // Was "all" — materialize the full list so unchecking one keeps the rest.
        cfg = { topics: this.poolFor(type).map(function (t) { return t.id; }) };
        this.data.games[gameId] = cfg;
      }
      var i = cfg.topics.indexOf(topicId);
      if (on && i === -1) cfg.topics.push(topicId);
      if (!on && i !== -1) cfg.topics.splice(i, 1);
      this.save();
    },

    /* When a new topic is added from a game view, include it there if that
       game already has an explicit selection (otherwise "all" already covers it). */
    includeTopicIfConfigured: function (gameId, topicId) {
      var cfg = this.data.games && this.data.games[gameId];
      if (cfg && cfg.topics && cfg.topics.indexOf(topicId) === -1) cfg.topics.push(topicId);
    },

    /* Drop a deleted topic id from every game's selection. */
    pruneTopic: function (topicId) {
      var games = this.data.games || {};
      Object.keys(games).forEach(function (gid) {
        var cfg = games[gid];
        if (cfg && cfg.topics) {
          var i = cfg.topics.indexOf(topicId);
          if (i !== -1) cfg.topics.splice(i, 1);
        }
      });
    },

    enabledCount: function (gameId, type) {
      var pool = this.poolFor(type);
      var self = this;
      return pool.filter(function (t) { return self.isTopicInGame(gameId, t.id); }).length;
    },

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
      if (!parsed || !Array.isArray(parsed.vocab) || !Array.isArray(parsed.sentences)) {
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
