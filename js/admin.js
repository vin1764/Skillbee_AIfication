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

      var mode = "bank"; // "bank" | "games"
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

        container.appendChild(
          el("div", { class: "adm-head" }, [
            el("button", { class: "back-link", html: "← Menu", on: { click: api.onExit } }),
            el("h2", { class: "adm-title", html: "🛠️ Manage content" }),
            el("div", { class: "adm-tools" }, [
              el("button", { class: "btn small", html: "⬇ Export", attrs: { title: "Save everything to a file" }, on: { click: doExport } }),
              el("button", { class: "btn small", html: "⬆ Import", attrs: { title: "Load from a file" }, on: { click: doImport } }),
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
            html:
              "This is the shared bank that feeds every game. Words are used by <b>Vocabulary Quiz</b>, <b>Memory</b> and <b>Hangman</b>; sentences by <b>Sentence Scramble</b>. Changes save automatically in this browser."
          })
        );
        addTopicButton(body, bankTab, null);
        var list = store.poolFor(bankTab);
        if (!list.length) body.appendChild(emptyState(bankTab === "vocab" ? "No word topics yet." : "No sentence topics yet."));
        list.forEach(function (topic, i) {
          body.appendChild(topicCard(topic, i, bankTab, { expanded: true }));
        });
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
      function renderGames(body) {
        if (!currentGame) {
          body.appendChild(
            el("p", {
              class: "adm-hint",
              html: "Pick a game to choose exactly which topics it offers. You can also edit or add content here — those changes also update the shared bank."
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
          body.appendChild(grid);
          return;
        }

        var game = null;
        for (var k = 0; k < games.length; k++) if (games[k].id === currentGame) game = games[k];
        if (!game) { currentGame = null; return renderGames(body); }
        var gtype = typeOfGame(game);

        body.appendChild(
          el("div", { class: "adm-subhead" }, [
            el("button", { class: "back-link small", html: "← Games", on: { click: function () { currentGame = null; render(); } } }),
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
            el("div", { class: "adm-row adm-row-head" }, [
              el("span", { class: "adm-emoji-h", text: "Icon" }),
              el("span", { text: "German" }),
              el("span", { text: "English" }),
              el("span", {})
            ])
          );
          topic.words.forEach(function (w, wi) {
            rows.appendChild(
              el("div", { class: "adm-row" }, [
                input(w, "emoji", "🙂", "adm-emoji", 6),
                input(w, "de", "e.g. der Hund", "adm-input"),
                input(w, "en", "e.g. the dog", "adm-input"),
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
