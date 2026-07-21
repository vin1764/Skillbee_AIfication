/* =====================================================================
   AdminUI — the in-app "Manage content" screen.
   Two modes:
     • Content bank — the master word/sentence sets that feed every game.
     • Games        — per game, tick which topics that game offers, and edit
                      content inline (edits also update the shared bank).
   Every change is saved automatically via ContentStore.
   ===================================================================== */
(function () {
  window.AdminUI = {
    mount: function (container, api) {
      var el = api.el;
      var store = api.store;
      var games = api.games || [];

      var currentGame = null; // gameId when configuring one content game
      var currentExercise = null; // exercise id when editing one exercise
      var syncChipEl = null;

      /* ---- cloud sync hooks ---- */
      // Mark the editor open so incoming cloud updates don't clobber active edits.
      store.editing = true;
      store.onSyncState = function (s) { updateSyncChip(s); };
      store.onSync = function () { render(); };
      store.onRemotePending = function () { showRemoteBanner(); };

      function updateSyncChip(s) {
        if (!syncChipEl) return;
        var map = {
          synced: ["☁️ Synced", "ok"],
          saving: ["☁️ Saving…", "busy"],
          offline: ["💾 This device", "off"],
          local: ["💾 This device", "off"]
        };
        var m = map[s] || map.local;
        syncChipEl.textContent = m[0];
        syncChipEl.className = "adm-sync " + m[1];
      }

      function showRemoteBanner() {
        if (container.querySelector(".adm-remote-banner")) return;
        container.insertBefore(
          el("div", { class: "adm-remote-banner" }, [
            el("span", { text: "📥 Another device updated the content." }),
            el("button", { class: "btn small", text: "Load it", on: { click: function () { store.applyPendingRemote(); render(); } } })
          ]),
          container.firstChild
        );
      }

      // Leaving the editor: release the edit lock and pick up anything that
      // arrived while we were editing.
      function exitAdmin() {
        store.editing = false;
        store.onSync = null;
        store.onSyncState = null;
        store.onRemotePending = null;
        if (store.applyPendingRemote) store.applyPendingRemote();
        api.onExit();
      }

      /* A text input bound two-way to obj[field]; saves on every keystroke. */
      function input(obj, field, placeholder, cls, maxlen) {
        var attrs = { type: "text", value: obj[field] == null ? "" : obj[field], placeholder: placeholder || "" };
        if (maxlen) attrs.maxlength = maxlen;
        return el("input", {
          class: cls || "adm-input",
          attrs: attrs,
          on: {
            input: function (e) {
              obj[field] = e.target.value;
              store.save();
            }
          }
        });
      }

      /* An input for an optional list of "wrong options" (comma-separated).
         Stored as an array; blank = let the game auto-generate them. */
      function optionsInput(obj, field, placeholder) {
        return el("input", {
          class: "adm-input",
          attrs: { type: "text", value: (obj[field] || []).join(", "), placeholder: placeholder || "" },
          on: {
            input: function (e) {
              var arr = e.target.value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
              if (arr.length) obj[field] = arr; else delete obj[field];
              store.save();
            }
          }
        });
      }

      function toast(msg) {
        var t = el("div", { class: "adm-toast", text: msg });
        document.body.appendChild(t);
        setTimeout(function () { t.classList.add("show"); }, 10);
        setTimeout(function () {
          t.classList.remove("show");
          setTimeout(function () { t.remove(); }, 300);
        }, 1800);
      }

      function confirmDelete(msg) {
        try { return window.confirm(msg); } catch (e) { return true; }
      }

      /* ---------------- top-level render ---------------- */
      function render() {
        container.innerHTML = "";

        // One back button (pinned top-left): steps up through exercise → game →
        // menu depending on how deep we are.
        var inExercise = currentGame && currentExercise;
        var inGame = !!currentGame;
        var backHtml = inExercise ? "← Exercises" : inGame ? "← Games" : "← Menu";
        var backFn = inExercise
          ? function () { currentExercise = null; render(); }
          : inGame
            ? function () { currentGame = null; currentExercise = null; render(); }
            : exitAdmin;
        syncChipEl = el("span", { class: "adm-sync", attrs: { title: "Content is saved to your Firebase and shared with every device" }, text: "☁️ Synced" });
        container.appendChild(
          el("div", { class: "adm-head" }, [
            el("button", { class: "back-link", html: backHtml, on: { click: backFn } }),
            el("h2", { class: "adm-title", html: "🛠️ Manage content" }),
            el("div", { class: "adm-tools" }, [
              syncChipEl,
              el("button", { class: "btn small ghost", html: "⬇ Backup", attrs: { title: "Download a copy (optional safety backup)" }, on: { click: doExport } }),
              el("button", { class: "btn small ghost", html: "⬆ Restore", attrs: { title: "Load content from a backup file" }, on: { click: doImport } }),
              (window.TeacherGate && window.TeacherGate.gated())
                ? el("button", { class: "btn small ghost", html: "🔒 PIN", attrs: { title: "Change teacher PIN" }, on: { click: function () { window.TeacherGate.changePin(); } } })
                : null,
              el("button", { class: "btn small ghost", html: "↺ Reset", on: { click: doReset } })
            ])
          ])
        );
        updateSyncChip(store.syncState);

        var body = el("div", { class: "adm-body" });
        container.appendChild(body);
        renderGames(body);
      }

      /* ---- Fall-Detektiv: case sentences, grouped by case within one exercise ---- */
      function renderCases(body, ex) {
        body.appendChild(
          el("p", {
            class: "adm-hint",
            html:
              "These sentences power <b>🕵️ Fall-Detektiv</b> in Live Class Mode. Put <code>___</code> where the article belongs, then give the correct article. " +
              "Group them by case below; when the class plays this exercise, <b>all</b> its sentences are used. Changes save automatically."
          })
        );
        var C = ex;
        [
          ["accusative", "Accusative — Level 1", "🥇"],
          ["dative", "Dative — Level 2", "🥈"],
          ["genitive", "Genitive — Level 3", "🥉"]
        ].forEach(function (sec) {
          var key = sec[0];
          var list = C[key] || (C[key] = []);
          body.appendChild(el("h3", { class: "adm-case-h", text: sec[2] + " " + sec[1] + "  (" + list.length + ")" }));
          list.forEach(function (entry, i) { body.appendChild(caseRow(entry, list, i)); });
          body.appendChild(addRowBtn("+ Sentence", function () {
            list.push({ sentence: "", correct: "", clueWord: "", explanation: "" });
            store.save();
            render();
          }));
        });
      }

      function caseRow(entry, list, index) {
        var card = el("div", { class: "adm-case" });
        card.appendChild(el("div", { class: "adm-case-line" }, [
          input(entry, "sentence", "e.g. Ich sehe ___ Mann.", "adm-input grow"),
          input(entry, "correct", "den", "adm-input adm-article", 5),
          el("button", {
            class: "adm-del", html: "🗑", attrs: { title: "Remove sentence" },
            on: { click: function () { list.splice(index, 1); store.save(); render(); } }
          })
        ]));
        card.appendChild(el("div", { class: "adm-case-line" }, [
          input(entry, "clueWord", "clue word (the verb or preposition)", "adm-input"),
          optionsInput(entry, "distractors", "wrong articles (optional, auto if blank)"),
          input(entry, "explanation", "why it's correct (shown at reveal)", "adm-input grow")
        ]));
        return card;
      }

      /* ---- Wortmonster: compound words (Part 1 + Part 2) ---- */
      function renderCompounds(body, ex) {
        body.appendChild(
          el("p", {
            class: "adm-hint",
            html:
              "These word-parts power <b>🧟 Wortmonster</b> in Live Class Mode. The word is <b>Part 1 + Part 2</b> joined together, " +
              "and the gender (der/die/das) comes from Part 2. Changes save automatically."
          })
        );
        var list = ex.items;
        body.appendChild(el("div", { class: "adm-row adm-row-head adm-compound-row" }, [
          el("span", { text: "Icon" }),
          el("span", { text: "Part 1" }),
          el("span", { text: "Part 2" }),
          el("span", { text: "= Word" }),
          el("span", { text: "Gender" }),
          el("span", { text: "Meaning" }),
          el("span", {})
        ]));
        if (!list.length) body.appendChild(emptyState("No compound words yet."));
        list.forEach(function (c, i) { body.appendChild(compoundRow(c, list, i)); });
        body.appendChild(addRowBtn("+ Compound", function () {
          list.push({ emoji: "", partA: "", partB: "", gender: "der", meaning: "" });
          store.save();
          render();
        }));
      }

      /* ---- Plural-Palast: noun → correct plural (+ optional wrong forms) ---- */
      function renderPlurals(body, ex) {
        body.appendChild(
          el("p", {
            class: "adm-hint",
            html:
              "These nouns power <b>🏰 Plural-Palast</b> in Live Class Mode. Give each noun (with der/die/das) its correct plural. " +
              "<b>Wrong options</b> are optional — leave blank and the game auto-picks plausible wrong plurals; type your own (comma-separated) to control them. Changes save automatically."
          })
        );
        var list = ex.items;
        body.appendChild(el("div", { class: "adm-row adm-row-head adm-plural-row" }, [
          el("span", { text: "Icon" }),
          el("span", { text: "Singular (with article)" }),
          el("span", { text: "English" }),
          el("span", { text: "Plural (correct)" }),
          el("span", { text: "Wrong options (optional)" }),
          el("span", {})
        ]));
        if (!list.length) body.appendChild(emptyState("No nouns yet."));
        list.forEach(function (p, i) {
          body.appendChild(el("div", { class: "adm-row adm-plural-row" }, [
            input(p, "emoji", "🙂", "adm-emoji", 6),
            input(p, "singular", "e.g. der Hund", "adm-input"),
            input(p, "en", "dog", "adm-input"),
            input(p, "plural", "e.g. Hunde", "adm-input"),
            optionsInput(p, "wrong", "auto — or e.g. Hunden, Hünde"),
            el("button", {
              class: "adm-del", html: "✕", attrs: { title: "Remove" },
              on: { click: function () { list.splice(i, 1); store.save(); render(); } }
            })
          ]));
        });
        body.appendChild(addRowBtn("+ Noun", function () {
          list.push({ emoji: "", singular: "", en: "", plural: "", wrong: [] });
          store.save();
          render();
        }));
      }

      /* ---- Hör gut zu!: spoken word + look-alike options ---- */
      function renderListening(body, ex) {
        body.appendChild(
          el("p", {
            class: "adm-hint",
            html:
              "These words power <b>👂 Hör gut zu!</b> in Live Class Mode. The smartboard <b>says the word out loud</b> (no text) and students pick it from four look-alikes. " +
              "The <b>look-alike options</b> should be words that sound confusingly similar (near-homophones, minimal pairs, umlaut variants). Changes save automatically."
          })
        );
        var list = ex.items;
        body.appendChild(el("div", { class: "adm-row adm-row-head adm-listen-row" }, [
          el("span", { text: "Word (spoken)" }),
          el("span", { text: "Meaning" }),
          el("span", { text: "Look-alike options (3)" }),
          el("span", {})
        ]));
        if (!list.length) body.appendChild(emptyState("No words yet."));
        list.forEach(function (w, i) {
          body.appendChild(el("div", { class: "adm-row adm-listen-row" }, [
            input(w, "word", "e.g. Kirche", "adm-input"),
            input(w, "meaning", "church", "adm-input"),
            optionsInput(w, "distractors", "e.g. Kirsche, Küche, Kiste"),
            el("button", {
              class: "adm-del", html: "✕", attrs: { title: "Remove" },
              on: { click: function () { list.splice(i, 1); store.save(); render(); } }
            })
          ]));
        });
        body.appendChild(addRowBtn("+ Word", function () {
          list.push({ word: "", meaning: "", distractors: [] });
          store.save();
          render();
        }));
      }

      /* ---- Konjugations-Karussell: a verb's six present-tense forms ---- */
      function renderVerbs(body, ex) {
        body.appendChild(
          el("p", {
            class: "adm-hint",
            html:
              "These verbs power <b>🎠 Konjugations-Karussell</b> in Live Class Mode. Fill in all six present-tense forms — " +
              "the game shows the verb + a pronoun and asks students to pick the right one. Wrong options are built from the verb's " +
              "other forms automatically. Changes save automatically."
          })
        );
        var list = ex.items;
        if (!list.length) body.appendChild(emptyState("No verbs yet."));
        list.forEach(function (v, i) { body.appendChild(verbCard(v, list, i)); });
        body.appendChild(addRowBtn("+ Verb", function () {
          list.push({ inf: "", en: "", forms: { ich: "", du: "", er: "", wir: "", ihr: "", sie: "" } });
          store.save();
          render();
        }));
      }

      function verbCard(v, list, index) {
        if (!v.forms) v.forms = { ich: "", du: "", er: "", wir: "", ihr: "", sie: "" };
        var card = el("div", { class: "adm-verb" });
        card.appendChild(el("div", { class: "adm-case-line" }, [
          input(v, "inf", "e.g. fahren", "adm-input"),
          input(v, "en", "to drive", "adm-input"),
          el("button", {
            class: "adm-del", html: "🗑", attrs: { title: "Remove verb" },
            on: { click: function () { list.splice(index, 1); store.save(); render(); } }
          })
        ]));
        var forms = el("div", { class: "adm-verb-forms" });
        [["ich", "ich"], ["du", "du"], ["er", "er/sie/es"], ["wir", "wir"], ["ihr", "ihr"], ["sie", "sie"]].forEach(function (pair) {
          forms.appendChild(el("label", { class: "adm-verb-field" }, [
            el("span", { class: "adm-verb-lbl", text: pair[1] }),
            input(v.forms, pair[0], "", "adm-input")
          ]));
        });
        card.appendChild(forms);
        return card;
      }

      // Join German-style: second part's first letter goes lower-case.
      function joinCompound(a, b) {
        b = String(b || "");
        return String(a || "") + (b ? b.charAt(0).toLowerCase() + b.slice(1) : "");
      }

      function compoundRow(c, list, index) {
        var word = el("span", { class: "adm-compound-word", text: joinCompound(c.partA, c.partB) });
        function refresh() { word.textContent = joinCompound(c.partA, c.partB); }
        return el("div", { class: "adm-row adm-compound-row" }, [
          input(c, "emoji", "🙂", "adm-emoji", 6),
          partInput(c, "partA", "Hand", refresh),
          partInput(c, "partB", "Schuh", refresh),
          word,
          genderSelect(c),
          input(c, "meaning", "e.g. glove", "adm-input"),
          el("button", {
            class: "adm-del", html: "✕", attrs: { title: "Remove" },
            on: { click: function () { list.splice(index, 1); store.save(); render(); } }
          })
        ]);
      }

      function partInput(obj, field, placeholder, after) {
        return el("input", {
          class: "adm-input",
          attrs: { type: "text", value: obj[field] == null ? "" : obj[field], placeholder: placeholder },
          on: { input: function (e) { obj[field] = e.target.value; if (after) after(); store.save(); } }
        });
      }

      function genderSelect(obj) {
        var sel = document.createElement("select");
        sel.className = "adm-input adm-gender";
        ["der", "die", "das"].forEach(function (g) {
          var o = document.createElement("option");
          o.value = g; o.textContent = g;
          if ((obj.gender || "der") === g) o.selected = true;
          sel.appendChild(o);
        });
        sel.addEventListener("change", function () { obj.gender = sel.value; store.save(); });
        return sel;
      }

      /* ---------------- Games ---------------- */
      // Live-Class-only games get a badge; the rest come from the registered
      // Solo games passed in `games`. Every game owns its own exercises.
      var LIVE_GAMES = [
        { id: "cases", name: "Fall-Detektiv", emoji: "🕵️", color: "#8b5cf6" },
        { id: "compounds", name: "Wortmonster", emoji: "🧟", color: "#22c55e" },
        { id: "plurals", name: "Plural-Palast", emoji: "🏰", color: "#e0731c" },
        { id: "verbs", name: "Konjugations-Karussell", emoji: "🎠", color: "#e11d74" },
        { id: "listening", name: "Hör gut zu!", emoji: "👂", color: "#0ea5b7" }
      ];
      // The full set of content games (Solo word/sentence games + Live games),
      // each tagged with the "kind" that selects its editor.
      function allGames() {
        var out = games.map(function (g) {
          return { id: g.id, name: g.name, emoji: g.emoji, color: g.color,
                   kind: g.contentType === "sentences" ? "sentences" : "words", live: false };
        });
        LIVE_GAMES.forEach(function (g) {
          out.push({ id: g.id, name: g.name, emoji: g.emoji, color: g.color,
                     kind: g.id === "cases" ? "cases" : "items", live: true });
        });
        return out;
      }
      function gameById(id) {
        var all = allGames();
        for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
        return null;
      }
      // Games you can copy an exercise FROM into `gameId`. Only the word games
      // (Quiz / Memory / Hangman) share a compatible content shape.
      var WORD_COPY_GROUP = ["quiz", "memory", "hangman"];
      function copySourcesFor(gameId) {
        if (WORD_COPY_GROUP.indexOf(gameId) < 0) return [];
        return WORD_COPY_GROUP.filter(function (g) { return g !== gameId && store.exercisesFor(g).length > 0; });
      }
      // Modal: pick an exercise from another word game to copy into `destGame`.
      function openCopyPicker(destGame) {
        var overlay = el("div", { class: "adm-overlay" });
        function close() { overlay.remove(); }
        overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
        var card = el("div", { class: "adm-modal" });
        card.appendChild(el("div", { class: "adm-modal-title", text: "Copy into " + destGame.emoji + " " + destGame.name }));
        card.appendChild(el("p", { class: "adm-hint", html: "Pick an exercise from another word game — it's copied here as a new exercise (the original stays put)." }));
        var listWrap = el("div", { class: "adm-copy-list" });
        copySourcesFor(destGame.id).forEach(function (srcId) {
          var srcGame = gameById(srcId);
          listWrap.appendChild(el("div", { class: "adm-copy-group", text: srcGame.emoji + " " + srcGame.name }));
          store.exercisesFor(srcId).forEach(function (e) {
            var count = exerciseItemCount("words", e);
            listWrap.appendChild(el("button", {
              class: "adm-copy-row",
              on: { click: function () {
                var copy = store.copyExerciseFrom(destGame.id, srcId, e.id);
                close();
                if (copy) { currentExercise = copy.id; render(); toast("Copied “" + e.name + "” ✓"); }
              } }
            }, [
              el("span", { class: "adm-copy-name", text: (e.emoji ? e.emoji + " " : "") + e.name }),
              el("span", { class: "adm-copy-count", text: count + " words" })
            ]));
          });
        });
        card.appendChild(listWrap);
        card.appendChild(el("button", { class: "btn ghost adm-copy-cancel", text: "Cancel", on: { click: close } }));
        overlay.appendChild(card);
        document.body.appendChild(overlay);
      }
      // Count the content rows inside a single exercise, given the game's kind.
      function exerciseItemCount(kind, ex) {
        if (!ex) return 0;
        if (kind === "cases") return (ex.accusative || []).length + (ex.dative || []).length + (ex.genitive || []).length;
        if (kind === "words") return (ex.words || []).length;
        if (kind === "sentences") return (ex.sentences || []).length;
        return (ex.items || []).length;
      }
      function unitFor(id, kind) {
        if (kind === "words") return " words";
        if (kind === "sentences") return " sentences";
        if (id === "plurals") return " nouns";
        if (id === "verbs") return " verbs";
        return " words";
      }

      /* ---- The list of exercises for one game (create / rename / copy / delete) ---- */
      function renderExerciseList(body, game) {
        body.appendChild(
          el("p", {
            class: "adm-hint",
            html:
              "Each <b>exercise</b> is its own set of content. Build a new exercise for each lesson — your earlier ones stay saved, so you never have to delete previous work. " +
              "You choose which exercise to play when you start the game."
          })
        );
        var list = store.exercisesFor(game.id);
        var wrap = el("div", { class: "adm-ex-list" });
        list.forEach(function (e) {
          var count = exerciseItemCount(game.kind, e);
          var card = el("div", { class: "adm-ex-card" });
          card.appendChild(el("button", {
            class: "adm-ex-main",
            attrs: { title: "Edit this exercise" },
            on: { click: function () { currentExercise = e.id; render(); } }
          }, [
            el("div", { class: "adm-ex-name", text: (e.emoji ? e.emoji + " " : "") + e.name }),
            el("div", { class: "adm-ex-count", text: count + unitFor(game.id, game.kind) })
          ]));
          card.appendChild(el("div", { class: "adm-ex-actions" }, [
            el("button", {
              class: "adm-ex-btn", html: "✎", attrs: { title: "Rename exercise" },
              on: { click: function () {
                var name = window.prompt("Rename exercise:", e.name);
                if (name != null) { store.renameExercise(game.id, e.id, name); render(); }
              } }
            }),
            el("button", {
              class: "adm-ex-btn", html: "⧉", attrs: { title: "Duplicate — copy this exercise's content into a new one" },
              on: { click: function () { if (store.duplicateExercise(game.id, e.id)) { render(); toast("Exercise duplicated ✓"); } } }
            }),
            el("button", {
              class: "adm-ex-btn danger", html: "🗑", attrs: { title: "Delete exercise" },
              on: { click: function () {
                if (confirmDelete("Delete the exercise “" + e.name + "” and all its content?")) { store.deleteExercise(game.id, e.id); render(); }
              } }
            })
          ]));
          wrap.appendChild(card);
        });
        body.appendChild(wrap);
        var actions = el("div", { class: "adm-ex-bar" }, [
          el("button", {
            class: "btn primary",
            html: "+ New exercise",
            on: { click: function () { var e = store.addExercise(game.id); currentExercise = e.id; render(); } }
          })
        ]);
        if (copySourcesFor(game.id).length) {
          actions.appendChild(el("button", {
            class: "btn ghost",
            html: "⧉ Copy from another game",
            on: { click: function () { openCopyPicker(game); } }
          }));
        }
        body.appendChild(actions);
      }

      function renderGames(body) {
        // 1) game grid
        if (!currentGame) {
          body.appendChild(
            el("p", { class: "adm-hint", html: "Pick a game, then build its <b>exercises</b> — each is a separate set of content you can name, reuse and keep." })
          );
          var grid = el("div", { class: "adm-game-grid" });
          allGames().forEach(function (g) {
            var n = store.exercisesFor(g.id).length;
            grid.appendChild(
              el("button", {
                class: "adm-game-card",
                attrs: { style: "--accent:" + (g.color || "#3b4de8") },
                on: { click: function () { currentGame = g.id; currentExercise = null; render(); } }
              }, [
                g.live ? el("div", { class: "adm-game-badge", text: "Live Class Mode" }) : null,
                el("div", { class: "adm-game-emoji", text: g.emoji }),
                el("div", { class: "adm-game-name", text: g.name }),
                el("div", { class: "adm-game-meta", text: n + (n === 1 ? " exercise" : " exercises") })
              ])
            );
          });
          body.appendChild(grid);
          return;
        }

        var game = gameById(currentGame);
        if (!game) { currentGame = null; return renderGames(body); }

        // 2) exercise list for the chosen game
        if (!currentExercise) {
          body.appendChild(el("div", { class: "adm-subhead" }, [
            el("h3", { class: "adm-game-title", text: game.emoji + " " + game.name })
          ]));
          renderExerciseList(body, game);
          return;
        }

        // 3) editor for one exercise (by game kind)
        var ex = store.exercise(currentGame, currentExercise);
        if (!ex) { currentExercise = null; return renderGames(body); }
        body.appendChild(el("div", { class: "adm-subhead" }, [
          el("h3", { class: "adm-game-title", text: game.emoji + " " + game.name + "  ·  " + ex.name })
        ]));
        if (game.kind === "words") renderWordsExercise(body, ex);
        else if (game.kind === "sentences") renderSentencesExercise(body, ex);
        else if (currentGame === "cases") renderCases(body, ex);
        else if (currentGame === "compounds") renderCompounds(body, ex);
        else if (currentGame === "plurals") renderPlurals(body, ex);
        else if (currentGame === "verbs") renderVerbs(body, ex);
        else if (currentGame === "listening") renderListening(body, ex);
      }

      /* ---- Words exercise editor (Vocabulary Quiz / Memory / Hangman) ---- */
      function renderWordsExercise(body, ex) {
        body.appendChild(
          el("p", { class: "adm-hint", html: "The words in this exercise. <b>Wrong options</b> are optional — leave blank and the game auto-picks wrong answers from the other words here; type your own (comma-separated) to control them. Changes save automatically." })
        );
        body.appendChild(el("div", { class: "adm-ex-head" }, [
          input(ex, "emoji", "📚", "adm-emoji", 6),
          input(ex, "english", "Short description (optional, e.g. Animals)", "adm-input")
        ]));
        body.appendChild(
          el("div", { class: "adm-row adm-row-vocab adm-row-head" }, [
            el("span", { class: "adm-emoji-h", text: "Icon" }),
            el("span", { text: "German" }),
            el("span", { text: "English (correct)" }),
            el("span", { text: "Wrong options (optional)" }),
            el("span", {})
          ])
        );
        var list = ex.words;
        if (!list.length) body.appendChild(emptyState("No words yet — add the first one below."));
        list.forEach(function (w, wi) {
          body.appendChild(
            el("div", { class: "adm-row adm-row-vocab" }, [
              input(w, "emoji", "🙂", "adm-emoji", 6),
              input(w, "de", "e.g. der Hund", "adm-input"),
              input(w, "en", "e.g. the dog", "adm-input"),
              optionsInput(w, "distractors", "auto — or e.g. the cat, the fish"),
              delRowBtn("Remove word", function () { list.splice(wi, 1); store.save(); render(); })
            ])
          );
        });
        body.appendChild(addRowBtn("+ Word", function () { list.push({ de: "", en: "", emoji: "" }); store.save(); render(); }));
      }

      /* ---- Sentences exercise editor (Satzbau / Sentence Scramble) ---- */
      function renderSentencesExercise(body, ex) {
        body.appendChild(
          el("p", { class: "adm-hint", html: "The sentences students rebuild in <b>Satzbau</b>. Keep them short (A1/A2). Changes save automatically." })
        );
        body.appendChild(el("div", { class: "adm-ex-head" }, [
          input(ex, "emoji", "🗣️", "adm-emoji", 6),
          input(ex, "english", "Short description (optional, e.g. Everyday)", "adm-input")
        ]));
        body.appendChild(
          el("div", { class: "adm-row adm-row-sent adm-row-head" }, [
            el("span", { text: "German sentence" }),
            el("span", { text: "English translation" }),
            el("span", {})
          ])
        );
        var list = ex.sentences;
        if (!list.length) body.appendChild(emptyState("No sentences yet — add the first one below."));
        list.forEach(function (s, si) {
          body.appendChild(
            el("div", { class: "adm-row adm-row-sent" }, [
              input(s, "de", "e.g. Ich lerne Deutsch", "adm-input"),
              input(s, "en", "e.g. I learn German", "adm-input"),
              delRowBtn("Remove sentence", function () { list.splice(si, 1); store.save(); render(); })
            ])
          );
        });
        body.appendChild(addRowBtn("+ Sentence", function () { list.push({ de: "", en: "" }); store.save(); render(); }));
      }

      function delRowBtn(title, onClick) {
        return el("button", { class: "adm-del", html: "✕", attrs: { title: title }, on: { click: onClick } });
      }

      function addRowBtn(label, onClick) {
        return el("button", { class: "btn small adm-add-row", html: label, on: { click: onClick } });
      }

      function emptyState(msg) {
        return el("p", { class: "adm-empty", text: msg });
      }

      /* ---------------- export / import / reset ---------------- */
      function doExport() {
        try {
          var blob = new Blob([store.exportJSON()], { type: "application/json" });
          var url = URL.createObjectURL(blob);
          var a = document.createElement("a");
          a.href = url;
          a.download = "skillbee-deutsch-content.json";
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 500);
          toast("File downloaded ✓");
        } catch (e) {
          alert("Export not possible: " + e.message);
        }
      }

      function doImport() {
        var inp = document.createElement("input");
        inp.type = "file";
        inp.accept = "application/json,.json";
        inp.onchange = function () {
          var file = inp.files && inp.files[0];
          if (!file) return;
          var reader = new FileReader();
          reader.onload = function () {
            try {
              store.importJSON(String(reader.result));
              currentGame = null;
              currentExercise = null;
              render();
              toast("Content imported ✓");
            } catch (e) {
              alert("Import failed: " + e.message);
            }
          };
          reader.readAsText(file);
        };
        inp.click();
      }

      function doReset() {
        if (confirmDelete("Reset all content back to the defaults? Your changes will be lost.")) {
          store.reset();
          currentGame = null;
          currentExercise = null;
          render();
          toast("Reset to defaults");
        }
      }

      render();
    }
  };
})();
