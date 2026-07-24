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

      /* A textarea bound two-way to obj[field] (a string). Grows for long text /
         sentences, so the same editor works for a single word or a full sentence. */
      function textareaInput(obj, field, placeholder, cls) {
        var ta = el("textarea", {
          class: cls || "adm-ta",
          text: obj[field] == null ? "" : String(obj[field]),
          attrs: { placeholder: placeholder || "", rows: 1 },
          on: { input: function (e) { obj[field] = e.target.value; autoGrow(e.target); store.save(); } }
        });
        return ta;
      }
      /* A textarea for a list stored as an array — ONE ENTRY PER LINE (so options
         may themselves be sentences that contain commas). */
      function linesInput(obj, field, placeholder, cls) {
        return el("textarea", {
          class: cls || "adm-ta",
          text: (obj[field] || []).join("\n"),
          attrs: { placeholder: placeholder || "", rows: 1 },
          on: { input: function (e) {
            var arr = e.target.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
            if (arr.length) obj[field] = arr; else delete obj[field];
            autoGrow(e.target);
            store.save();
          } }
        });
      }
      function autoGrow(ta) { try { ta.style.height = "auto"; ta.style.height = (ta.scrollHeight + 2) + "px"; } catch (e) {} }

      /* ---------------- Auto-translate (German → English) ----------------
         Scoped to straightforward German→English pairs: base vocab (words),
         Wortmonster compounds, and Hör gut zu! prompts. Deliberately NOT wired
         into Lücken-Text — its fill-in sentences must stay fully manual, since a
         generic translation can obscure which word carries the grammatical point.
         AI-filled values are DRAFTS: dashed + badged "AI · review" until the
         teacher edits the field or clicks ✓ to confirm. We never silently
         overwrite an existing translation — only empty fields (a per-field
         click on a filled field is treated as an explicit regenerate). */
      function isDraft(o, f) { return !!(o && o._ai && o._ai[f]); }
      function markDraft(o, f) { if (!o._ai) o._ai = {}; o._ai[f] = true; }
      function clearDraft(o, f) {
        if (!o || !o._ai) return;
        delete o._ai[f];
        for (var k in o._ai) { if (o._ai[k]) return; }
        delete o._ai; // no drafts left — drop the marker so it doesn't linger in saved content
      }

      /* ---------------- Auto emoji (offline dictionary) ----------------
         Fills a row's emoji from its text on its own, when a text field is
         finalised (blur/change) — NO button. Non-destructive: only fills an
         empty emoji cell, and never overwrites one the teacher typed. Leaves it
         blank when nothing sensible matches. Returns a fill() to attach to the
         row's text inputs' "change" events. */
      var _autoEmojiRows = (typeof WeakSet !== "undefined") ? new WeakSet() : null;
      function wireAutoEmoji(emojiInput, row, getTexts) {
        if (!emojiInput || !window.EmojiPick) return null;
        // Typing your own emoji opts this row out of any further auto-fill.
        emojiInput.addEventListener("input", function () { if (_autoEmojiRows) _autoEmojiRows.delete(row); });
        return function () {
          var cur = String(row.emoji || "").trim();
          if (cur && !(_autoEmojiRows && _autoEmojiRows.has(row))) return; // leave existing/manual emoji alone
          var e = window.EmojiPick.forTexts((getTexts() || []).filter(Boolean));
          if (e && e !== cur) {
            row.emoji = e;
            emojiInput.value = e;
            if (_autoEmojiRows) _autoEmojiRows.add(row);
            store.save();
          }
        };
      }

      var NO_TRANSLATOR_MSG = "Auto-translate needs a browser with a built-in translator — open the app in Chrome or Edge.";
      // Resolve the browser's built-in translator, toasting once about the
      // one-time model download if it hasn't been fetched yet. Rejects with
      // { code: "unsupported" } when this browser has no built-in translator.
      function ensureTranslator() {
        var AT = window.AutoTranslate;
        if (!AT || !AT.supported()) return Promise.reject({ code: "unsupported" });
        return AT.availability().then(function (av) {
          if (av === "unavailable") throw { code: "unsupported" };
          if (av === "downloadable" || av === "downloading") toast("Setting up the translator — one-time download, please wait…");
          return AT;
        });
      }

      // An English-meaning input paired with an "Auto-translate" (✨) button and
      // an "AI · review" badge. `getGerman()` returns the German source to send.
      function enField(obj, enKey, getGerman, placeholder, inputCls) {
        var wrap = el("div", { class: "adm-en-cell" });
        var inp = el("input", {
          class: inputCls || "adm-input",
          attrs: { type: "text", value: obj[enKey] == null ? "" : obj[enKey], placeholder: placeholder || "e.g. the dog" },
          on: { input: function (e) { obj[enKey] = e.target.value; clearDraft(obj, enKey); paint(); store.save(); } }
        });
        var btn = el("button", { class: "adm-tr-btn", attrs: { type: "button", title: "Auto-translate from German" }, html: "✨" });
        var badge = el("span", { class: "adm-ai-badge" }, [
          el("span", { class: "adm-ai-txt", text: "AI · review" }),
          el("button", {
            class: "adm-ai-ok", attrs: { type: "button", title: "Looks right — confirm" }, html: "✓",
            on: { click: function () { clearDraft(obj, enKey); paint(); store.save(); } }
          })
        ]);
        btn.addEventListener("click", function () {
          var german = String((getGerman && getGerman()) || "").trim();
          if (!german) { toast("Add the German first."); return; }
          btn.disabled = true; btn.classList.add("loading");
          ensureTranslator().then(function (AT) {
            return AT.translateText(german);
          }).then(function (en) {
            en = (en || "").trim();
            if (!en) { toast("No translation came back — try again."); return; }
            obj[enKey] = en; inp.value = en; markDraft(obj, enKey); paint(); store.save();
          }).catch(function (err) {
            toast(err && err.code === "unsupported" ? NO_TRANSLATOR_MSG : "Translation failed — try again.");
          }).then(function () { btn.disabled = false; btn.classList.remove("loading"); });
        });
        function paint() {
          var d = isDraft(obj, enKey);
          inp.classList.toggle("ai-draft", d);
          badge.style.display = d ? "" : "none";
        }
        paint();
        wrap.appendChild(inp); wrap.appendChild(btn); wrap.appendChild(badge);
        return wrap;
      }

      // Top-of-list "Translate all empty English" bulk button. `rows` is a list
      // of { obj, enKey, getGerman }. Only fills BLANK English fields whose
      // German source is present — never overwrites existing translations.
      function bulkTranslateBar(rows) {
        var btn = el("button", { class: "btn small adm-bulk-tr", attrs: { type: "button" }, html: "✨ Translate all empty English" });
        var origHtml = "✨ Translate all empty English";
        btn.addEventListener("click", function () {
          var todo = rows.filter(function (r) {
            return String((r.getGerman && r.getGerman()) || "").trim() && !String(r.obj[r.enKey] || "").trim();
          });
          if (!todo.length) { toast("No empty English fields to fill."); return; }
          if (!window.AutoTranslate || !window.AutoTranslate.supported()) { toast(NO_TRANSLATOR_MSG); return; }
          btn.disabled = true; btn.innerHTML = "Translating…";
          ensureTranslator().then(function (AT) {
            return AT.translateBatch(todo.map(function (r) { return String(r.getGerman()).trim(); }));
          }).then(function (out) {
            var n = 0;
            todo.forEach(function (r, i) {
              var en = (out[i] || "").trim();
              if (en) { r.obj[r.enKey] = en; markDraft(r.obj, r.enKey); n++; }
            });
            store.save();
            render();
            toast(n ? ("Filled " + n + " field" + (n === 1 ? "" : "s") + " — please review") : "Nothing came back — try again.");
          }).catch(function (err) {
            btn.disabled = false; btn.innerHTML = origHtml;
            toast(err && err.code === "unsupported" ? NO_TRANSLATOR_MSG : "Translation failed — try again.");
          });
        });
        return el("div", { class: "adm-bulk-bar" }, [
          btn,
          el("span", { class: "adm-bulk-note", text: "Fills blank English only · AI drafts you review before they count" })
        ]);
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
              el("button", { class: "btn small ghost adm-reset", html: "↺ Reset", attrs: { title: "Erase all content and restore defaults (type RESET + enter your PIN)" }, on: { click: doReset } })
            ])
          ])
        );
        updateSyncChip(store.syncState);

        var body = el("div", { class: "adm-body" });
        container.appendChild(body);
        renderGames(body);
      }

      /* ---- Lücken-Text: fill-in sentences (one or many blanks), by case ---- */
      function renderCases(body, ex) {
        body.appendChild(
          el("p", {
            class: "adm-hint",
            html:
              "These sentences power <b>✏️ Lücken-Text</b> (fill in the blank) in Live Class Mode. Type <code>___</code> wherever a word is missing — " +
              "<b>one or several blanks per sentence</b> — then give the correct word for each. The <b>word bank</b> (answers + wrong choices) is what students " +
              "pick from in Tap mode; leave it blank and the game fills in plausible articles. Group by case; the class plays <b>all</b> the exercise's sentences. Changes save automatically."
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
            list.push({ sentence: "", blanks: [], wordBank: [], explanation: "" });
            store.save();
            render();
          }));
        });
      }

      // Count the ___ gaps in a sentence and keep entry.blanks the same length,
      // preserving the answers already typed (so editing text mid-sentence is safe).
      function syncBlanks(entry) {
        var n = (String(entry.sentence || "").match(/_{2,}/g) || []).length;
        if (!Array.isArray(entry.blanks)) entry.blanks = [];
        while (entry.blanks.length < n) entry.blanks.push({ id: entry.blanks.length + 1, correct: "" });
        if (entry.blanks.length > n) entry.blanks = entry.blanks.slice(0, n);
        entry.blanks.forEach(function (b, i) { b.id = i + 1; if (b.correct == null) b.correct = ""; });
      }

      function caseRow(entry, list, index) {
        if (!Array.isArray(entry.blanks)) entry.blanks = [];
        syncBlanks(entry);
        var card = el("div", { class: "adm-case" });
        var blanksWrap = el("div", { class: "adm-case-blanks" });

        function renderBlanks() {
          blanksWrap.innerHTML = "";
          if (!entry.blanks.length) {
            blanksWrap.appendChild(el("span", { class: "adm-blank-hint", text: "Type ___ in the sentence above to add a blank." }));
            return;
          }
          entry.blanks.forEach(function (b, i) {
            blanksWrap.appendChild(el("label", { class: "adm-blank-field" }, [
              el("span", { class: "adm-blank-num", text: "Blank " + (i + 1) }),
              input(b, "correct", "answer", "adm-input adm-article", 14)
            ]));
          });
        }

        var sentInput = textareaInput(entry, "sentence", "e.g. Ich sehe ___ Mann und gebe ___ Frau ein Buch.", "adm-ta grow");
        // Re-sync the per-blank answer fields live as the teacher edits the text,
        // without rebuilding the textarea (keeps their cursor/focus in place).
        sentInput.addEventListener("input", function () { syncBlanks(entry); renderBlanks(); store.save(); });

        card.appendChild(el("div", { class: "adm-case-line" }, [
          sentInput,
          el("button", {
            class: "adm-del", html: "🗑", attrs: { title: "Remove sentence" },
            on: { click: function () { list.splice(index, 1); store.save(); render(); } }
          })
        ]));
        card.appendChild(blanksWrap);
        // Word bank + explanation each get their own full-width row with a short
        // label, so the guidance is never clipped inside a narrow input.
        card.appendChild(el("div", { class: "adm-case-line" }, [
          el("span", { class: "adm-field-lbl", text: "Word bank" }),
          optionsInput(entry, "wordBank", "e.g. den, der, dem, des  ·  answers + wrong choices, blank = auto")
        ]));
        card.appendChild(el("div", { class: "adm-case-line" }, [
          el("span", { class: "adm-field-lbl", text: "Why" }),
          input(entry, "explanation", "shown to students at reveal (optional)", "adm-input grow")
        ]));
        renderBlanks();
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
        body.appendChild(bulkTranslateBar(list.map(function (c) {
          return { obj: c, enKey: "meaning", getGerman: function () { return joinCompound(c.partA, c.partB); } };
        })));
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
        body.appendChild(bulkTranslateBar(list.map(function (p) {
          return { obj: p, enKey: "en", getGerman: function () { return p.singular; } };
        })));
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
          var emojiInp = input(p, "emoji", "🙂", "adm-emoji", 6);
          var singInp = input(p, "singular", "e.g. der Hund", "adm-input");
          var enCell = enField(p, "en", function () { return p.singular; }, "dog");
          var fill = wireAutoEmoji(emojiInp, p, function () { return [p.singular, p.en]; });
          if (fill) { singInp.addEventListener("change", fill); var ei = enCell.querySelector("input"); if (ei) ei.addEventListener("change", fill); }
          body.appendChild(el("div", { class: "adm-row adm-plural-row" }, [
            emojiInp, singInp, enCell,
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
              "These power <b>👂 Hör gut zu!</b> in Live Class Mode. The smartboard <b>says each one out loud</b> (no text) and students pick it from four look-alikes. " +
              "A prompt can be a single <b>word</b> or a whole <b>sentence</b> — mix both freely. The <b>look-alike options</b> (one per line) should sound confusingly similar " +
              "(near-homophones, minimal pairs, or sentences that differ in a small detail). Changes save automatically."
          })
        );
        var list = ex.items;
        body.appendChild(bulkTranslateBar(list.map(function (w) {
          return { obj: w, enKey: "meaning", getGerman: function () { return w.word; } };
        })));
        if (!list.length) body.appendChild(emptyState("Nothing here yet — add the first prompt below."));
        list.forEach(function (w, i) { body.appendChild(listenCard(w, list, i)); });
        body.appendChild(addRowBtn("+ Prompt", function () {
          list.push({ word: "", meaning: "", distractors: [] });
          store.save();
          render();
        }));
      }

      function listenCard(w, list, index) {
        var card = el("div", { class: "adm-listen-item" });
        card.appendChild(el("div", { class: "adm-listen-line" }, [
          el("span", { class: "adm-listen-lbl", text: "Spoken" }),
          textareaInput(w, "word", "e.g. Kirche — or a whole sentence students must catch", "adm-ta grow"),
          el("button", {
            class: "adm-del", html: "✕", attrs: { title: "Remove" },
            on: { click: function () { list.splice(index, 1); store.save(); render(); } }
          })
        ]));
        card.appendChild(el("div", { class: "adm-listen-line" }, [
          el("span", { class: "adm-listen-lbl", text: "Meaning" }),
          enField(w, "meaning", function () { return w.word; }, "what it means (shown at the reveal)", "adm-input grow")
        ]));
        card.appendChild(el("div", { class: "adm-listen-line" }, [
          el("span", { class: "adm-listen-lbl", text: "Look-alikes" }),
          linesInput(w, "distractors", "one per line — leave blank to auto-pick from the other prompts", "adm-ta grow")
        ]));
        return card;
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
        var emojiInp = input(c, "emoji", "🙂", "adm-emoji", 6);
        // Emoji comes from the meaning (glove → 🧤) or the joined word (Handschuh → 🧤).
        var fill = wireAutoEmoji(emojiInp, c, function () { return [c.meaning, joinCompound(c.partA, c.partB)]; });
        var pa = partInput(c, "partA", "Hand", refresh);
        var pb = partInput(c, "partB", "Schuh", refresh);
        var meaningCell = enField(c, "meaning", function () { return joinCompound(c.partA, c.partB); }, "e.g. glove");
        if (fill) {
          pa.addEventListener("change", fill);
          pb.addEventListener("change", fill);
          var mi = meaningCell.querySelector("input"); if (mi) mi.addEventListener("change", fill);
        }
        return el("div", { class: "adm-row adm-compound-row" }, [
          emojiInp, pa, pb, word, genderSelect(c), meaningCell,
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
        { id: "cases", name: "Lücken-Text", emoji: "✏️", color: "#8b5cf6" },
        { id: "compounds", name: "Wortmonster", emoji: "🧟", color: "#22c55e" },
        { id: "plurals", name: "Plural-Palast", emoji: "🏰", color: "#e0731c" },
        { id: "verbs", name: "Konjugations-Karussell", emoji: "🎠", color: "#e11d74" },
        { id: "listening", name: "Hör gut zu!", emoji: "👂", color: "#0ea5b7" },
        { id: "hoerpaare", name: "Match the Following", emoji: "🔗", color: "#06b6d4" }
      ];
      function liveKind(id) {
        if (id === "cases") return "cases";
        if (id === "hoerpaare") return "pairs";
        return "items";
      }
      // The full set of content games (Solo word/sentence games + Live games),
      // each tagged with the "kind" that selects its editor.
      function allGames() {
        var out = games.map(function (g) {
          return { id: g.id, name: g.name, emoji: g.emoji, color: g.color,
                   kind: g.contentType === "sentences" ? "sentences" : "words", live: false };
        });
        LIVE_GAMES.forEach(function (g) {
          out.push({ id: g.id, name: g.name, emoji: g.emoji, color: g.color, kind: liveKind(g.id), live: true });
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
        if (kind === "pairs") return (ex.questions || []).length;
        return (ex.items || []).length;
      }
      function unitFor(id, kind) {
        if (kind === "words") return " words";
        if (kind === "sentences") return " sentences";
        if (kind === "pairs") return " questions";
        if (id === "plurals") return " nouns";
        if (id === "verbs") return " verbs";
        if (id === "listening") return " prompts";
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
        else if (game.kind === "pairs") renderPairsExercise(body, ex);
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
        var list = ex.words;
        body.appendChild(bulkTranslateBar(list.map(function (w) {
          return { obj: w, enKey: "en", getGerman: function () { return w.de; } };
        })));
        body.appendChild(
          el("div", { class: "adm-row adm-row-vocab adm-row-head" }, [
            el("span", { class: "adm-emoji-h", text: "Icon" }),
            el("span", { text: "German" }),
            el("span", { text: "English (correct)" }),
            el("span", { text: "Wrong options (optional)" }),
            el("span", {})
          ])
        );
        if (!list.length) body.appendChild(emptyState("No words yet — add the first one below."));
        list.forEach(function (w, wi) {
          var emojiInp = input(w, "emoji", "🙂", "adm-emoji", 6);
          var deInp = input(w, "de", "e.g. der Hund", "adm-input");
          var enCell = enField(w, "en", function () { return w.de; }, "e.g. the dog");
          var fill = wireAutoEmoji(emojiInp, w, function () { return [w.de, w.en]; });
          if (fill) { deInp.addEventListener("change", fill); var ei = enCell.querySelector("input"); if (ei) ei.addEventListener("change", fill); }
          body.appendChild(
            el("div", { class: "adm-row adm-row-vocab" }, [
              emojiInp, deInp, enCell,
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
        var list = ex.sentences;
        body.appendChild(bulkTranslateBar(list.map(function (s) {
          return { obj: s, enKey: "en", getGerman: function () { return s.de; } };
        })));
        body.appendChild(
          el("div", { class: "adm-row adm-row-sent adm-row-head" }, [
            el("span", { text: "German sentence" }),
            el("span", { text: "English translation" }),
            el("span", {})
          ])
        );
        if (!list.length) body.appendChild(emptyState("No sentences yet — add the first one below."));
        list.forEach(function (s, si) {
          body.appendChild(
            el("div", { class: "adm-row adm-row-sent" }, [
              input(s, "de", "e.g. Ich lerne Deutsch", "adm-input"),
              enField(s, "en", function () { return s.de; }, "e.g. I learn German"),
              delRowBtn("Remove sentence", function () { list.splice(si, 1); store.save(); render(); })
            ])
          );
        });
        body.appendChild(addRowBtn("+ Sentence", function () { list.push({ de: "", en: "" }); store.save(); render(); }));
      }

      /* ---- Hör-Paare editor (Listen & Match): each exercise = N questions, each ≥3 words ---- */
      function renderPairsExercise(body, ex) {
        body.appendChild(
          el("p", {
            class: "adm-hint",
            html:
              "These power <b>🔗 Match the Following</b> in Live Class Mode. Each <b>question</b> is one matching round: students hear the German words and tap the English meaning that matches. " +
              "Give every question <b>at least 3 words</b>. The German is spoken with the app's voice (generated audio where available, otherwise the device voice). Changes save automatically."
          })
        );
        body.appendChild(el("div", { class: "adm-ex-head" }, [ input(ex, "emoji", "🎧", "adm-emoji", 6) ]));
        if (!Array.isArray(ex.questions)) ex.questions = [];
        var list = ex.questions;
        // Bulk translate spans every word in every question of this exercise.
        var trRows = [];
        list.forEach(function (q) {
          (q.words || []).forEach(function (w) { trRows.push({ obj: w, enKey: "en", getGerman: function () { return w.de; } }); });
        });
        body.appendChild(bulkTranslateBar(trRows));
        if (!list.length) body.appendChild(emptyState("No questions yet — add the first one below."));
        list.forEach(function (q, qi) {
          if (!Array.isArray(q.words)) q.words = [];
          var complete = q.words.filter(function (w) { return w.de && w.en; }).length;
          var card = el("div", { class: "adm-pairs-q" });
          card.appendChild(el("div", { class: "adm-pairs-head" }, [
            el("h4", { class: "adm-pairs-title", text: "Question " + (qi + 1) }),
            el("span", { class: "adm-pairs-count" + (complete < 3 ? " warn" : ""), text: complete + (complete === 1 ? " word" : " words") + (complete < 3 ? " · needs at least 3" : "") }),
            el("button", { class: "adm-del", html: "🗑", attrs: { title: "Remove this question" }, on: { click: function () { list.splice(qi, 1); store.save(); render(); } } })
          ]));
          card.appendChild(el("div", { class: "adm-row adm-row-head adm-pairs-row" }, [
            el("span", { class: "adm-emoji-h", text: "Icon" }),
            el("span", { text: "German (spoken)" }),
            el("span", { text: "English (meaning)" }),
            el("span", {})
          ]));
          q.words.forEach(function (w, wi) {
            var emojiInp = input(w, "emoji", "🙂", "adm-emoji", 6);
            var deInp = input(w, "de", "e.g. der Hund", "adm-input");
            var enCell = enField(w, "en", function () { return w.de; }, "e.g. the dog");
            var fill = wireAutoEmoji(emojiInp, w, function () { return [w.de, w.en]; });
            if (fill) { deInp.addEventListener("change", fill); var ei = enCell.querySelector("input"); if (ei) ei.addEventListener("change", fill); }
            card.appendChild(el("div", { class: "adm-row adm-pairs-row" }, [
              emojiInp, deInp, enCell,
              delRowBtn("Remove word", function () { q.words.splice(wi, 1); store.save(); render(); })
            ]));
          });
          card.appendChild(addRowBtn("+ Word", function () { q.words.push({ de: "", en: "", emoji: "" }); store.save(); render(); }));
          body.appendChild(card);
        });
        body.appendChild(addRowBtn("+ Question", function () {
          list.push({ words: [{ de: "", en: "", emoji: "" }, { de: "", en: "", emoji: "" }, { de: "", en: "", emoji: "" }] });
          store.save(); render();
        }));
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

      // Reset wipes ALL content back to defaults — irreversible. Gate it behind a
      // deliberate "type the word to confirm" modal so it can't be hit by accident.
      function doReset() {
        var overlay = el("div", { class: "adm-overlay" });
        function close() { overlay.remove(); }
        overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });

        var input = el("input", {
          class: "adm-input",
          attrs: { type: "text", placeholder: "Type RESET", autocapitalize: "characters", autocomplete: "off", spellcheck: "false" }
        });
        var goBtn = el("button", { class: "btn danger", text: "Reset everything", attrs: { disabled: "true" } });
        function matches() { return input.value.trim().toUpperCase() === "RESET"; }
        input.addEventListener("input", function () { goBtn.disabled = !matches(); });
        input.addEventListener("keydown", function (e) { if (e.key === "Enter" && matches()) goBtn.click(); });
        goBtn.addEventListener("click", function () {
          if (!matches()) return;
          close(); // close this modal first, so the PIN keypad shows on its own
          function run() {
            store.reset();
            currentGame = null;
            currentExercise = null;
            render();
            toast("Reset to defaults");
          }
          // Require the teacher PIN (fresh, every time) before actually wiping.
          if (window.TeacherGate && window.TeacherGate.verify) window.TeacherGate.verify(run);
          else run();
        });

        overlay.appendChild(el("div", { class: "adm-modal" }, [
          el("div", { class: "adm-modal-title", text: "⚠️ Reset ALL content?" }),
          el("p", {
            class: "adm-hint",
            html: "This erases <b>every exercise and word you've added</b> across all games and restores the built-in defaults. <b>It can't be undone.</b> Consider clicking <b>⬇ Backup</b> first."
          }),
          el("label", { class: "live-label", text: "Type RESET to confirm" }),
          input,
          el("div", { class: "adm-modal-actions" }, [
            el("button", { class: "btn ghost", text: "Cancel", on: { click: close } }),
            goBtn
          ])
        ]));
        document.body.appendChild(overlay);
        setTimeout(function () { try { input.focus(); } catch (e) {} }, 50);
      }

      render();
    }
  };
})();
