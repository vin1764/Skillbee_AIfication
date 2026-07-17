/* =====================================================================
   AdminUI — the in-app "Inhalte verwalten" (Manage content) screen.
   Teachers edit vocabulary topics, words and sentences here. Every change
   is saved automatically to the browser via ContentStore.
   ===================================================================== */
(function () {
  window.AdminUI = {
    mount: function (container, api) {
      var el = api.el;
      var store = api.store;
      var tab = "vocab";

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
              if (field === "name" || field === "de") updateCounts();
            }
          }
        });
      }

      function updateCounts() {
        // Refresh the "N Wörter / N Sätze" labels without a full re-render.
        var cards = container.querySelectorAll(".adm-topic");
        var list = tab === "vocab" ? store.data.vocab : store.data.sentences;
        cards.forEach(function (card, i) {
          var badge = card.querySelector(".adm-count");
          if (badge && list[i]) {
            var n = tab === "vocab" ? list[i].words.length : list[i].sentences.length;
            badge.textContent = n + (tab === "vocab" ? " Wörter" : " Sätze");
          }
        });
      }

      function toast(msg) {
        var t = el("div", { class: "adm-toast", text: msg });
        document.body.appendChild(t);
        setTimeout(function () {
          t.classList.add("show");
        }, 10);
        setTimeout(function () {
          t.classList.remove("show");
          setTimeout(function () {
            t.remove();
          }, 300);
        }, 1800);
      }

      /* ---------- header + tabs ---------- */
      function render() {
        container.innerHTML = "";

        container.appendChild(
          el("div", { class: "adm-head" }, [
            el("button", { class: "back-link", html: "← Menü", on: { click: api.onExit } }),
            el("h2", { class: "adm-title", html: "🛠️ Inhalte verwalten" }),
            el("div", { class: "adm-tools" }, [
              el("button", { class: "btn small", html: "⬇ Export", attrs: { title: "Als Datei sichern" }, on: { click: doExport } }),
              el("button", { class: "btn small", html: "⬆ Import", attrs: { title: "Aus Datei laden" }, on: { click: doImport } }),
              el("button", { class: "btn small ghost", html: "↺ Zurücksetzen", on: { click: doReset } })
            ])
          ])
        );

        container.appendChild(
          el("div", { class: "adm-tabs" }, [
            tabBtn("vocab", "🔤 Wörter"),
            tabBtn("sentences", "🗣️ Sätze")
          ])
        );

        container.appendChild(
          el("p", {
            class: "adm-hint",
            html:
              "Änderungen werden automatisch in diesem Browser gespeichert. Mit <b>Export</b> sicherst du sie als Datei oder überträgst sie auf einen anderen Computer (dort <b>Import</b>)."
          })
        );

        var body = el("div", { class: "adm-body" });
        container.appendChild(body);
        if (tab === "vocab") renderVocab(body);
        else renderSentences(body);
      }

      function tabBtn(id, label) {
        return el("button", {
          class: "adm-tab" + (tab === id ? " active" : ""),
          html: label,
          on: {
            click: function () {
              tab = id;
              render();
            }
          }
        });
      }

      /* ---------- vocabulary tab ---------- */
      function renderVocab(body) {
        body.appendChild(
          el("button", {
            class: "btn primary adm-add",
            html: "+ Neues Thema",
            on: {
              click: function () {
                store.data.vocab.push({
                  id: store.newId("topic"),
                  name: "Neues Thema",
                  english: "",
                  emoji: "📚",
                  words: [{ de: "", en: "", emoji: "" }]
                });
                store.save();
                render();
              }
            }
          })
        );
        if (store.data.vocab.length === 0) body.appendChild(emptyState("Noch keine Wort-Themen. Klicke auf + Neues Thema."));
        store.data.vocab.forEach(function (topic, ti) {
          body.appendChild(vocabTopicCard(topic, ti));
        });
      }

      function vocabTopicCard(topic, ti) {
        var card = el("div", { class: "adm-topic" });
        card.appendChild(
          el("div", { class: "adm-topic-head" }, [
            input(topic, "emoji", "🙂", "adm-emoji", 6),
            input(topic, "name", "Themenname (Deutsch)", "adm-input grow"),
            input(topic, "english", "English name", "adm-input"),
            el("span", { class: "adm-count", text: topic.words.length + " Wörter" }),
            el("button", {
              class: "adm-del",
              html: "🗑",
              attrs: { title: "Thema löschen" },
              on: {
                click: function () {
                  if (confirmDelete("Thema wirklich löschen?")) {
                    store.data.vocab.splice(ti, 1);
                    store.save();
                    render();
                  }
                }
              }
            })
          ])
        );

        card.appendChild(
          el("div", { class: "adm-row adm-row-head" }, [
            el("span", { class: "adm-emoji-h", text: "Bild" }),
            el("span", { text: "Deutsch" }),
            el("span", { text: "English" }),
            el("span", {})
          ])
        );

        topic.words.forEach(function (w, wi) {
          card.appendChild(
            el("div", { class: "adm-row" }, [
              input(w, "emoji", "🙂", "adm-emoji", 6),
              input(w, "de", "z. B. der Hund", "adm-input"),
              input(w, "en", "e.g. the dog", "adm-input"),
              el("button", {
                class: "adm-del",
                html: "✕",
                attrs: { title: "Wort entfernen" },
                on: {
                  click: function () {
                    topic.words.splice(wi, 1);
                    store.save();
                    render();
                  }
                }
              })
            ])
          );
        });

        card.appendChild(
          el("button", {
            class: "btn small adm-add-row",
            html: "+ Wort",
            on: {
              click: function () {
                topic.words.push({ de: "", en: "", emoji: "" });
                store.save();
                render();
              }
            }
          })
        );
        return card;
      }

      /* ---------- sentences tab ---------- */
      function renderSentences(body) {
        body.appendChild(
          el("button", {
            class: "btn primary adm-add",
            html: "+ Neues Satz-Thema",
            on: {
              click: function () {
                store.data.sentences.push({
                  id: store.newId("stopic"),
                  name: "Neues Thema",
                  english: "",
                  emoji: "🗣️",
                  sentences: [{ de: "", en: "" }]
                });
                store.save();
                render();
              }
            }
          })
        );
        if (store.data.sentences.length === 0) body.appendChild(emptyState("Noch keine Satz-Themen."));
        store.data.sentences.forEach(function (topic, ti) {
          body.appendChild(sentenceTopicCard(topic, ti));
        });
      }

      function sentenceTopicCard(topic, ti) {
        var card = el("div", { class: "adm-topic" });
        card.appendChild(
          el("div", { class: "adm-topic-head" }, [
            input(topic, "emoji", "🙂", "adm-emoji", 6),
            input(topic, "name", "Themenname (Deutsch)", "adm-input grow"),
            input(topic, "english", "English name", "adm-input"),
            el("span", { class: "adm-count", text: topic.sentences.length + " Sätze" }),
            el("button", {
              class: "adm-del",
              html: "🗑",
              attrs: { title: "Thema löschen" },
              on: {
                click: function () {
                  if (confirmDelete("Thema wirklich löschen?")) {
                    store.data.sentences.splice(ti, 1);
                    store.save();
                    render();
                  }
                }
              }
            })
          ])
        );

        card.appendChild(
          el("div", { class: "adm-row adm-row-sent adm-row-head" }, [
            el("span", { text: "Deutscher Satz" }),
            el("span", { text: "English translation" }),
            el("span", {})
          ])
        );

        topic.sentences.forEach(function (s, si) {
          card.appendChild(
            el("div", { class: "adm-row adm-row-sent" }, [
              input(s, "de", "z. B. Ich lerne Deutsch", "adm-input"),
              input(s, "en", "e.g. I learn German", "adm-input"),
              el("button", {
                class: "adm-del",
                html: "✕",
                attrs: { title: "Satz entfernen" },
                on: {
                  click: function () {
                    topic.sentences.splice(si, 1);
                    store.save();
                    render();
                  }
                }
              })
            ])
          );
        });

        card.appendChild(
          el("button", {
            class: "btn small adm-add-row",
            html: "+ Satz",
            on: {
              click: function () {
                topic.sentences.push({ de: "", en: "" });
                store.save();
                render();
              }
            }
          })
        );
        return card;
      }

      function emptyState(msg) {
        return el("p", { class: "adm-empty", text: msg });
      }

      /* confirm() is blocked in some sandboxed previews; if so, allow the delete. */
      function confirmDelete(msg) {
        try {
          return window.confirm(msg);
        } catch (e) {
          return true;
        }
      }

      /* ---------- export / import / reset ---------- */
      function doExport() {
        try {
          var blob = new Blob([store.exportJSON()], { type: "application/json" });
          var url = URL.createObjectURL(blob);
          var a = document.createElement("a");
          a.href = url;
          a.download = "skillbee-deutsch-inhalte.json";
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(function () {
            URL.revokeObjectURL(url);
          }, 500);
          toast("Datei heruntergeladen ✓");
        } catch (e) {
          alert("Export nicht möglich: " + e.message);
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
              render();
              toast("Inhalte importiert ✓");
            } catch (e) {
              alert("Import fehlgeschlagen: " + e.message);
            }
          };
          reader.readAsText(file);
        };
        inp.click();
      }

      function doReset() {
        if (confirmDelete("Alle Inhalte auf die Standardvorgaben zurücksetzen? Deine Änderungen gehen verloren.")) {
          store.reset();
          render();
          toast("Auf Standard zurückgesetzt");
        }
      }

      render();
    }
  };
})();
