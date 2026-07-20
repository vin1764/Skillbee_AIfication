/* =====================================================================
   ContentStore — lets teachers edit the game content from inside the app.
   ---------------------------------------------------------------------
   • The built-in content in data.js is the "default".
   • Teacher edits are saved in the browser (localStorage), so they persist
     on that computer even after closing the tab.
   • Export/Import moves content between computers (or to the shared link).
   The games and the topic picker read their content from here, so any edit
   shows up immediately.
   ===================================================================== */
(function () {
  var KEY = "skillbee_deutsch_content_v1";

  function clone(x) {
    return JSON.parse(JSON.stringify(x));
  }

  function defaultCases() {
    return clone(window.CaseData || { accusative: [], dative: [], genitive: [] });
  }
  function defaultCompounds() {
    return clone(window.CompoundData || []);
  }

  function defaults() {
    return {
      vocab: clone(window.GameData.VOCAB_TOPICS),
      sentences: clone(window.GameData.SENTENCE_TOPICS),
      // Fall-Detektiv (case sentences) and Wortmonster (compound words) content,
      // seeded from the built-in banks but editable + saved like everything else.
      cases: defaultCases(),
      compounds: defaultCompounds(),
      // Per-game topic selection. Missing entry / no "topics" list = the game
      // uses ALL topics of its type from the bank (the default).
      games: {}
    };
  }

  // Make sure an older saved store (from before these games existed) gains the
  // new sections instead of showing empty editors.
  function ensureSections(d) {
    if (!d.cases || typeof d.cases !== "object") d.cases = defaultCases();
    ["accusative", "dative", "genitive"].forEach(function (k) {
      if (!Array.isArray(d.cases[k])) d.cases[k] = [];
    });
    if (!Array.isArray(d.compounds)) d.compounds = defaultCompounds();
    if (!d.games || typeof d.games !== "object") d.games = {};
    return d;
  }

  var store = {
    data: null,

    load: function () {
      try {
        var raw = localStorage.getItem(KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.vocab) && Array.isArray(parsed.sentences)) {
            this.data = ensureSections(parsed);
            return;
          }
        }
      } catch (e) {
        /* localStorage may be unavailable (e.g. sandboxed) — fall back to defaults */
      }
      this.data = defaults();
    },

    save: function () {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.data));
        return true;
      } catch (e) {
        return false; // still edited in-memory for this session
      }
    },

    reset: function () {
      this.data = defaults();
      try {
        localStorage.removeItem(KEY);
      } catch (e) {}
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

    /* Fall-Detektiv case sentences, grouped by case (accusative/dative/genitive). */
    casesData: function () {
      return this.data.cases;
    },
    /* Wortmonster compound-word list. */
    compoundsData: function () {
      return this.data.compounds;
    },

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
      this.save();
    }
  };

  store.load();
  window.ContentStore = store;
})();
