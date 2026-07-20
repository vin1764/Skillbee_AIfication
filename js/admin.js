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

      var mode = "games"; // "bank" | "games" — Games is the default view
      var bankTab = "vocab"; // "vocab" | "sentences" (within the bank)
      var currentGame = null; // gameId when configuring one game

      function typeOfGame(g) {
        return g.contentType === "sentences" ? "sentences" : "vocab";
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

        // One back button (pinned top-left): steps up a level when inside a
        // single game's editor, otherwise leaves the content editor.
        var inGame = mode === "games" && currentGame;
        container.appendChild(
          el("div", { class: "adm-head" }, [
            el("button", {
              class: "back-link",
              html: inGame ? "← Games" : "← Menu",
              on: { click: inGame ? function () { currentGame = null; render(); } : api.onExit }
            }),
            el("h2", { class: "adm-title", html: "🛠️ Manage content" }),
            el("div", { class: "adm-tools" }, [
              el("button", { class: "btn small", html: "⬇ Export", attrs: { title: "Save everything to a file" }, on: { click: doExport } }),
              el("button", { class: "btn small", html: "⬆ Import", attrs: { title: "Load from a file" }, on: { click: doImport } }),
              (window.TeacherGate && window.TeacherGate.gated())
                ? el("button", { class: "btn small ghost", html: "🔒 PIN", attrs: { title: "Change teacher PIN" }, on: { click: function () { window.TeacherGate.changePin(); } } })
                : null,
              el("button", { class: "btn small ghost", html: "↺ Reset", on: { click: doReset } })
            ])
          ])
        );

        container.appendChild(
          el("div", { class: "adm-tabs adm-modes" }, [
            modeBtn("bank", "📚 Content bank"),
            modeBtn("games", "🎮 Games")
          ])
        );

        var body = el("div", { class: "adm-body" });
        container.appendChild(body);
        if (mode === "bank") renderBank(body);
        else renderGames(body);
      }

      function modeBtn(id, label) {
        return el("button", {
          class: "adm-tab" + (mode === id ? " active" : ""),
          html: label,
          on: {
            click: function () {
              mode = id;
              currentGame = null;
              render();
            }
          }
        });
      }

      /* ---------------- Content bank ---------------- */
      function renderBank(body) {
        body.appendChild(
          el("div", { class: "adm-tabs" }, [
            subBtn("vocab", "🔤 Words"),
            subBtn("sentences", "🗣️ Sentences")
          ])
        );
        body.appendChild(
          el("p", {
            class: "adm-hint",
            html: bankTab === "vocab"
              ? "Words are used by <b>Vocabulary Quiz</b> and <b>Memory</b> (in class and solo) and <b>Hangman</b>. Changes save automatically in this browser."
              : "Sentences are used by <b>Sentence Scramble</b>. Changes save automatically in this browser."
          })
        );
        addTopicButton(body, bankTab, null);
        var list = store.poolFor(bankTab);
        if (!list.length) body.appendChild(emptyState(bankTab === "vocab" ? "No word topics yet." : "No sentence topics yet."));
        list.forEach(function (topic, i) {
          body.appendChild(topicCard(topic, i, bankTab, { expanded: false }));
        });
      }

      /* ---- Fall-Detektiv: case sentences, grouped by case (= difficulty level) ---- */
      function renderCases(body) {
        body.appendChild(
          el("p", {
            class: "adm-hint",
            html:
              "These sentences power <b>🕵️ Fall-Detektiv</b> in Live Class Mode. Put <code>___</code> where the article belongs, then give the correct article. " +
              "Levels stack: <b>Level 1</b> uses Accusative, <b>Level 2</b> adds Dative, <b>Level 3</b> adds Genitive. Changes save automatically."
          })
        );
        var C = store.casesData();
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
      function renderCompounds(body) {
        body.appendChild(
          el("p", {
            class: "adm-hint",
            html:
              "These word-parts power <b>🧟 Wortmonster</b> in Live Class Mode. The word is <b>Part 1 + Part 2</b> joined together, " +
              "and the gender (der/die/das) comes from Part 2. Changes save automatically."
          })
        );
        var list = store.compoundsData();
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

      function subBtn(id, label) {
        return el("button", {
          class: "adm-tab" + (bankTab === id ? " active" : ""),
          html: label,
          on: {
            click: function () {
              bankTab = id;
              render();
            }
          }
        });
      }

      /* ---------------- Games ---------------- */
      // The two Live-only games keep their own content (not the shared word /
      // sentence bank), so their cards open a dedicated editor.
      var LIVE_GAMES = [
        { id: "cases", name: "Fall-Detektiv", emoji: "🕵️", color: "#8b5cf6" },
        { id: "compounds", name: "Wortmonster", emoji: "🧟", color: "#22c55e" }
      ];
      function caseTotal() {
        var C = store.casesData();
        return (C.accusative || []).length + (C.dative || []).length + (C.genitive || []).length;
      }

      function renderGames(body) {
        if (!currentGame) {
          body.appendChild(
            el("p", {
              class: "adm-hint",
              html: "Pick a game to edit its content. For word/sentence games you also choose which topics they offer — those changes update the shared bank."
            })
          );
          var grid = el("div", { class: "adm-game-grid" });
          games.forEach(function (g) {
            var type = typeOfGame(g);
            var total = store.poolFor(type).length;
            var on = store.enabledCount(g.id, type);
            grid.appendChild(
              el("button", {
                class: "adm-game-card",
                attrs: { style: "--accent:" + (g.color || "#3b4de8") },
                on: { click: function () { currentGame = g.id; render(); } }
              }, [
                el("div", { class: "adm-game-emoji", text: g.emoji }),
                el("div", { class: "adm-game-name", text: g.name }),
                el("div", { class: "adm-game-meta", text: on + " of " + total + (type === "sentences" ? " sentence sets" : " topics") })
              ])
            );
          });
          // Live Class Mode games (Fall-Detektiv, Wortmonster) with their own banks.
          LIVE_GAMES.forEach(function (g) {
            var count = g.id === "cases" ? caseTotal() : store.compoundsData().length;
            var label = g.id === "cases" ? " sentences" : " words";
            grid.appendChild(
              el("button", {
                class: "adm-game-card",
                attrs: { style: "--accent:" + g.color },
                on: { click: function () { currentGame = g.id; render(); } }
              }, [
                el("div", { class: "adm-game-badge", text: "Live Class Mode" }),
                el("div", { class: "adm-game-emoji", text: g.emoji }),
                el("div", { class: "adm-game-name", text: g.name }),
                el("div", { class: "adm-game-meta", text: count + label })
              ])
            );
          });
          body.appendChild(grid);
          return;
        }

        // Live-game editors (own content, no shared-bank topic picking).
        if (currentGame === "cases" || currentGame === "compounds") {
          var lg = currentGame === "cases" ? LIVE_GAMES[0] : LIVE_GAMES[1];
          body.appendChild(
            el("div", { class: "adm-subhead" }, [
              el("h3", { class: "adm-game-title", text: lg.emoji + " " + lg.name })
            ])
          );
          if (currentGame === "cases") renderCases(body);
          else renderCompounds(body);
          return;
        }

        var game = null;
        for (var k = 0; k < games.length; k++) if (games[k].id === currentGame) game = games[k];
        if (!game) { currentGame = null; return renderGames(body); }
        var gtype = typeOfGame(game);

        body.appendChild(
          el("div", { class: "adm-subhead" }, [
            el("h3", { class: "adm-game-title", text: game.emoji + " " + game.name })
          ])
        );
        body.appendChild(
          el("p", {
            class: "adm-hint",
            html: "Tick the topics this game should offer. Editing or adding content here also updates the shared bank."
          })
        );
        addTopicButton(body, gtype, game.id);
        var pool = store.poolFor(gtype);
        if (!pool.length) body.appendChild(emptyState(gtype === "vocab" ? "No word topics in the bank yet." : "No sentence topics in the bank yet."));
        pool.forEach(function (topic, i) {
          body.appendChild(topicCard(topic, i, gtype, { expanded: false, gameId: game.id }));
        });
      }

      /* ---------------- reusable topic card ---------------- */
      function topicCard(topic, index, type, opts) {
        opts = opts || {};
        var card = el("div", { class: "adm-topic" });
        var head = el("div", { class: "adm-topic-head" });

        if (opts.gameId) {
          var cb = el("input", { class: "adm-check", attrs: { type: "checkbox", title: "Include in this game" } });
          cb.checked = store.isTopicInGame(opts.gameId, topic.id);
          cb.addEventListener("change", function () {
            store.setTopicInGame(opts.gameId, topic.id, type, cb.checked);
            card.classList.toggle("adm-off", !cb.checked);
          });
          head.appendChild(el("label", { class: "adm-include" }, [cb]));
          if (!cb.checked) card.classList.add("adm-off");
        }

        head.appendChild(input(topic, "emoji", "🙂", "adm-emoji", 6));
        head.appendChild(input(topic, "name", "Topic name (German)", "adm-input grow"));
        head.appendChild(input(topic, "english", "English name", "adm-input"));
        var countText = type === "vocab" ? topic.words.length + " words" : topic.sentences.length + " sentences";
        head.appendChild(el("span", { class: "adm-count", text: countText }));

        var rows = el("div", { class: "adm-rows" });
        if (opts.expanded === false) rows.style.display = "none";
        var toggle = el("button", {
          class: "adm-toggle",
          html: opts.expanded === false ? "Edit ▾" : "▴",
          attrs: { title: "Show / hide content" },
          on: {
            click: function () {
              var hidden = rows.style.display === "none";
              rows.style.display = hidden ? "" : "none";
              toggle.innerHTML = hidden ? "▴" : "Edit ▾";
            }
          }
        });
        head.appendChild(toggle);

        head.appendChild(
          el("button", {
            class: "adm-del",
            html: "🗑",
            attrs: { title: "Delete topic (from bank and all games)" },
            on: {
              click: function () {
                if (confirmDelete("Delete this topic? It will be removed from the bank and every game.")) {
                  store.poolFor(type).splice(index, 1);
                  store.pruneTopic(topic.id);
                  store.save();
                  render();
                }
              }
            }
          })
        );
        card.appendChild(head);

        if (type === "vocab") {
          rows.appendChild(
            el("p", { class: "adm-hint tiny", html: "<b>Wrong options</b> are optional. Leave blank and the game auto-picks wrong answers from the other words in this topic. Type your own (comma-separated) to control exactly what students see." })
          );
          rows.appendChild(
            el("div", { class: "adm-row adm-row-vocab adm-row-head" }, [
              el("span", { class: "adm-emoji-h", text: "Icon" }),
              el("span", { text: "German" }),
              el("span", { text: "English (correct)" }),
              el("span", { text: "Wrong options (optional)" }),
              el("span", {})
            ])
          );
          topic.words.forEach(function (w, wi) {
            rows.appendChild(
              el("div", { class: "adm-row adm-row-vocab" }, [
                input(w, "emoji", "🙂", "adm-emoji", 6),
                input(w, "de", "e.g. der Hund", "adm-input"),
                input(w, "en", "e.g. the dog", "adm-input"),
                optionsInput(w, "distractors", "auto — or e.g. the cat, the fish"),
                delRowBtn("Remove word", function () { topic.words.splice(wi, 1); store.save(); render(); })
              ])
            );
          });
          rows.appendChild(addRowBtn("+ Word", function () { topic.words.push({ de: "", en: "", emoji: "" }); store.save(); render(); }));
        } else {
          rows.appendChild(
            el("div", { class: "adm-row adm-row-sent adm-row-head" }, [
              el("span", { text: "German sentence" }),
              el("span", { text: "English translation" }),
              el("span", {})
            ])
          );
          topic.sentences.forEach(function (s, si) {
            rows.appendChild(
              el("div", { class: "adm-row adm-row-sent" }, [
                input(s, "de", "e.g. Ich lerne Deutsch", "adm-input"),
                input(s, "en", "e.g. I learn German", "adm-input"),
                delRowBtn("Remove sentence", function () { topic.sentences.splice(si, 1); store.save(); render(); })
              ])
            );
          });
          rows.appendChild(addRowBtn("+ Sentence", function () { topic.sentences.push({ de: "", en: "" }); store.save(); render(); }));
        }

        card.appendChild(rows);
        return card;
      }

      function delRowBtn(title, onClick) {
        return el("button", { class: "adm-del", html: "✕", attrs: { title: title }, on: { click: onClick } });
      }

      function addRowBtn(label, onClick) {
        return el("button", { class: "btn small adm-add-row", html: label, on: { click: onClick } });
      }

      function addTopicButton(body, type, gameId) {
        var label = type === "vocab" ? "+ New topic" : "+ New sentence topic";
        body.appendChild(
          el("button", {
            class: "btn primary adm-add",
            html: label,
            on: {
              click: function () {
                var t = type === "vocab"
                  ? { id: store.newId("topic"), name: "New topic", english: "", emoji: "📚", words: [{ de: "", en: "", emoji: "" }] }
                  : { id: store.newId("stopic"), name: "New topic", english: "", emoji: "🗣️", sentences: [{ de: "", en: "" }] };
                store.poolFor(type).push(t);
                if (gameId) store.includeTopicIfConfigured(gameId, t.id);
                store.save();
                render();
              }
            }
          })
        );
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
          render();
          toast("Reset to defaults");
        }
      }

      render();
    }
  };
})();
