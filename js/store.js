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

  function defaults() {
    return {
      vocab: clone(window.GameData.VOCAB_TOPICS),
      sentences: clone(window.GameData.SENTENCE_TOPICS)
    };
  }

  var store = {
    data: null,

    load: function () {
      try {
        var raw = localStorage.getItem(KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.vocab) && Array.isArray(parsed.sentences)) {
            this.data = parsed;
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
        throw new Error("Die Datei hat nicht das richtige Format.");
      }
      this.data = parsed;
      this.save();
    }
  };

  store.load();
  window.ContentStore = store;
})();
