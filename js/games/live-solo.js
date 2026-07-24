/* =====================================================================
   Solo/Offline wrappers for the Live-Class games.
   ---------------------------------------------------------------------
   Fall-Detektiv, Wortmonster, Plural-Palast, Konjugations-Karussell,
   Uhrzeit-Blitz, Hör gut zu! and Hör-Paare were originally Live-only.
   This registers a Solo version of each by reusing the very same content
   logic the Live adapters already provide (buildRounds / score /
   correctLabel / speakOnReveal). The result plays like the existing Solo
   Vocabulary Quiz: one round at a time, ✓/✗ feedback, then a score card.
   (Quiz and Memory already have their own richer Solo games, so they're
   not wrapped here.)
   ===================================================================== */
(function () {
  // How each game draws its Solo screen:
  //   "prompt" — the adapter's board prompt (word / clock / audio) on top,
  //              with the interactive tap-options below.
  //   "player" — the adapter's phone UI is already self-contained (it shows
  //              its own prompt), so we render only that (plus a tag).
  //   "match"  — Hör-Paare's tap-the-pairs board (its own little runner).
  var SOLO_GAMES = [
    { key: "cases", name: "Lücken-Text", emoji: "✏️", color: "#8b5cf6", layout: "player",
      tag: "✏️ Fill in the blank",
      description: "Fill the blanks in each sentence — pick the missing words from the bank." },
    { key: "wortmonster", name: "Wortmonster", emoji: "🧟", color: "#22c55e", layout: "player",
      tag: "🧟 Build the German word",
      description: "Smash two parts together to build German compound nouns." },
    { key: "plural", name: "Plural-Palast", emoji: "🏰", color: "#e0731c", layout: "prompt",
      description: "Pick the correct plural form and master those tricky endings." },
    { key: "verben", name: "Konjugations-Karussell", emoji: "🎠", color: "#e11d74", layout: "prompt",
      description: "Conjugate the verb for each pronoun — fast-paced practice." },
    { key: "uhrzeit", name: "Uhrzeit-Blitz", emoji: "🕐", color: "#2f80c4", layout: "prompt",
      description: "Read the clock and pick the German time. No setup needed." },
    { key: "listen", name: "Hör gut zu!", emoji: "👂", color: "#0ea5b7", layout: "prompt",
      description: "Listen to the German word and pick what you heard." },
    { key: "hoerpaare", name: "Hör-Paare", emoji: "🎧", color: "#06b6d4", layout: "match",
      description: "Hear each word and tap its matching meaning. Listening practice." }
  ];

  function register() {
    if (!window.App || !window.LiveGames) return;
    SOLO_GAMES.forEach(function (g) {
      var adapter = window.LiveGames[g.key];
      if (!adapter) return;
      window.App.register({
        id: "solo-" + g.key,          // unique; never collides with content ids
        name: g.name, emoji: g.emoji, color: g.color, description: g.description,
        liveWrapped: true,            // hidden from the content editor (managed via Live)
        // The exercise picker uses the adapter's own topic list.
        getTopics: function () {
          return adapter.getTopics ? adapter.getTopics() : (window.ContentStore.exercisesFor(g.key) || []);
        },
        mount: function (stage, api) { runSolo(stage, api, adapter, g); }
      });
    });
  }

  /* ---- generic round-by-round runner (prompt / player layouts) ---- */
  function runSolo(stage, api, adapter, cfg) {
    if (cfg.layout === "match") return soloMatch(stage, api, adapter);
    var el = api.el, K = api.kit;
    var rounds = adapter.buildRounds(api.topic);
    if (!rounds || !rounds.length) {
      K.notice(stage, "No content yet", "Add some content in ⚙️ Manage content, then try again.", api);
      return;
    }
    var TOTAL = rounds.length, idx = 0, correct = 0, streak = 0;
    var TL = adapter.timeLimit || 20000;
    var wrap = el("div", { class: "solo-live" });
    stage.appendChild(wrap);

    function render() {
      var r = rounds[idx];
      var startedAt = Date.now();
      var answered = false;
      wrap.innerHTML = "";
      wrap.appendChild(el("div", { class: "quiz-head" }, [
        el("button", { class: "back-link small", html: "← Menu", on: { click: api.exit } }),
        el("div", { class: "quiz-progress", text: "Question " + (idx + 1) + " / " + TOTAL }),
        el("div", { class: "quiz-streak", text: streak > 1 ? "🔥 " + streak + " streak" : "" })
      ]));
      var card = el("div", { class: "solo-live-card" });
      if (cfg.layout === "player") {
        if (cfg.tag) card.appendChild(el("div", { class: "cases-tag", text: cfg.tag }));
      } else {
        // Reuse the adapter's board prompt, but drop its non-interactive option
        // tiles — the tap-options rendered below are the interactive ones.
        var host = adapter.hostContent(el, r);
        Array.prototype.forEach.call(host.querySelectorAll(".live-q-options.board"), function (n) { n.remove(); });
        card.appendChild(host);
      }
      var subApi = {
        submit: function (payload) {
          if (answered) return;
          answered = true;
          onAnswer(r, payload, Date.now() - startedAt);
        }
      };
      card.appendChild(adapter.playerContent(el, r, subApi));
      wrap.appendChild(card);
    }

    function onAnswer(r, payload, elapsed) {
      var sc = adapter.score(r, payload, elapsed, TL);
      var frac = Math.max(0, 1 - elapsed / TL);
      if (sc.correct) { correct++; streak++; api.addScore(10 + Math.round(10 * frac)); K.beep("good"); }
      else { streak = 0; K.beep("bad"); }
      var german = adapter.speakOnReveal(r);
      if (german) K.speak(german);
      reveal(r, sc);
    }

    function reveal(r, sc) {
      // Lock every answer control (but keep the ← Menu link usable).
      Array.prototype.forEach.call(wrap.querySelectorAll("button"), function (b) {
        if (!b.classList.contains("back-link")) b.disabled = true;
      });
      var answerText = String(adapter.correctLabel(r));
      // Ring the correct option, for the games that use tap-options.
      Array.prototype.forEach.call(wrap.querySelectorAll(".live-opt.phone"), function (btn) {
        var t = (btn.querySelector(".opt-text") || {}).textContent;
        if (t === r.answer || t === answerText) btn.classList.add("correct");
      });
      wrap.appendChild(el("div", { class: "solo-reveal " + (sc.correct ? "good" : "bad") }, [
        el("div", { class: "solo-reveal-icon", text: sc.correct ? "✓" : "✗" }),
        el("div", { class: "solo-reveal-body" }, [
          el("div", { class: "solo-reveal-title", text: sc.correct ? "Correct!" : "Not quite" }),
          el("div", { class: "solo-reveal-ans", text: "Answer: " + answerText })
        ])
      ]));
      setTimeout(next, sc.correct ? 1100 : 1900);
    }

    function next() { idx++; if (idx < TOTAL) render(); else finish(); }

    function finish() {
      var pct = Math.round((correct / TOTAL) * 100);
      if (pct >= 60) K.confetti();
      K.beep(pct >= 60 ? "win" : "bad");
      wrap.innerHTML = "";
      wrap.appendChild(el("div", { class: "result-card" }, [
        el("div", { class: "result-emoji", text: pct >= 80 ? "🏆" : pct >= 60 ? "🎉" : "💪" }),
        el("h2", { text: pct >= 60 ? "Well done!" : "Keep practising!" }),
        el("p", { class: "result-score", html: "<b>" + correct + "</b> of <b>" + TOTAL + "</b> correct · " + pct + "%" }),
        el("div", { class: "result-actions" }, [
          el("button", { class: "btn primary", text: "Play again", on: { click: api.restart } }),
          el("button", { class: "btn", text: "Other exercise", on: { click: api.backToTopics } }),
          el("button", { class: "btn ghost", text: "Menu", on: { click: api.exit } })
        ])
      ]));
    }

    render();
  }

  /* ---- Hör-Paare Solo: tap a speaker, then its meaning ---- */
  function soloMatch(stage, api, adapter) {
    var el = api.el, K = api.kit;
    var rounds = adapter.buildRounds(api.topic);
    if (!rounds || !rounds.length) {
      K.notice(stage, "No content yet", "Add some rounds in ⚙️ Manage content, then try again.", api);
      return;
    }
    var TOTAL = rounds.length, idx = 0, totalMatched = 0, totalPairs = 0;
    var wrap = el("div", { class: "solo-live" });
    stage.appendChild(wrap);

    function render() {
      var r = rounds[idx];
      var words = (r.words || []).slice();
      var n = words.length;
      var matched = 0, wrong = 0, done = false, busy = false;
      var startTs = Date.now();
      wrap.innerHTML = "";
      var counter = el("span", { class: "match-count-n", text: "0 / " + n });
      wrap.appendChild(el("div", { class: "quiz-head" }, [
        el("button", { class: "back-link small", html: "← Menu", on: { click: api.exit } }),
        el("div", { class: "quiz-progress", text: "Round " + (idx + 1) + " / " + TOTAL }),
        el("div", { class: "match-count", text: "Matched " }, [counter])
      ]));
      wrap.appendChild(el("div", { class: "player-prompt-hint", text: "Tap 🔊 to hear it, then its meaning 👇" }));

      var speakerCol = el("div", { class: "match-col speakers" });
      var meaningCol = el("div", { class: "match-col meanings" });
      var speakers = K.shuffle(words.map(function (w, i) { return { idx: i, de: w.de }; }));
      var meanings = K.shuffle(words.map(function (w, i) { return { idx: i, en: w.en, emoji: w.emoji }; }));
      var sel = { s: null, m: null };
      function play(de) { try { K.speak(de, { rate: r.speed || 1 }); } catch (e) {} }

      function tryMatch() {
        if (!sel.s || !sel.m) return;
        var s = sel.s, m = sel.m;
        if (s.idx === m.idx) {
          matched++; counter.textContent = matched + " / " + n;
          s.btn.classList.remove("sel"); m.btn.classList.remove("sel");
          s.btn.classList.add("done"); m.btn.classList.add("done");
          s.btn.disabled = true; m.btn.disabled = true;
          var lbl = s.btn.querySelector(".match-slabel");
          if (lbl) lbl.textContent = words[s.idx].de;
          sel.s = null; sel.m = null;
          try { K.beep("good"); } catch (e) {}
          if (matched >= n) finishRound();
        } else {
          wrong++; busy = true;
          s.btn.classList.remove("sel"); m.btn.classList.remove("sel");
          s.btn.classList.add("wrong"); m.btn.classList.add("wrong");
          try { K.beep("bad"); } catch (e) {}
          var a = s.btn, b = m.btn; sel.s = null; sel.m = null;
          setTimeout(function () { a.classList.remove("wrong"); b.classList.remove("wrong"); busy = false; }, 500);
        }
      }

      speakers.forEach(function (it) {
        var btn = el("button", { class: "match-tile speaker" }, [
          el("span", { class: "match-ico", text: "🔊" }),
          el("span", { class: "match-slabel", text: "Tap to hear" })
        ]);
        btn.addEventListener("click", function () {
          if (busy || btn.disabled) return;
          play(it.de);
          if (sel.s) sel.s.btn.classList.remove("sel");
          sel.s = { idx: it.idx, btn: btn }; btn.classList.add("sel");
          tryMatch();
        });
        speakerCol.appendChild(btn);
      });
      meanings.forEach(function (it) {
        var btn = el("button", { class: "match-tile meaning" }, [
          it.emoji ? el("span", { class: "match-memoji", text: it.emoji }) : null,
          el("span", { class: "match-mtext", text: it.en })
        ]);
        btn.addEventListener("click", function () {
          if (busy || btn.disabled) return;
          if (sel.m) sel.m.btn.classList.remove("sel");
          sel.m = { idx: it.idx, btn: btn }; btn.classList.add("sel");
          tryMatch();
        });
        meaningCol.appendChild(btn);
      });
      wrap.appendChild(el("div", { class: "match-board" }, [speakerCol, meaningCol]));

      function finishRound() {
        if (done) return;
        done = true;
        totalMatched += matched; totalPairs += n;
        api.addScore(Math.max(3, 5 + matched * 2 - wrong * 2));
        var secs = Math.max(1, Math.round((Date.now() - startTs) / 1000));
        var last = (idx + 1) >= TOTAL;
        setTimeout(function () {
          wrap.appendChild(el("div", { class: "solo-reveal good" }, [
            el("div", { class: "solo-reveal-icon", text: "🎧" }),
            el("div", { class: "solo-reveal-body" }, [
              el("div", { class: "solo-reveal-title", text: "All " + n + " matched!" }),
              el("div", { class: "solo-reveal-ans", text: secs + "s" + (wrong ? " · " + wrong + " wrong tap" + (wrong === 1 ? "" : "s") : "") })
            ])
          ]));
          setTimeout(function () { idx++; if (last) finishAll(); else render(); }, 950);
        }, 300);
      }
    }

    function finishAll() {
      var pct = totalPairs ? Math.round((totalMatched / totalPairs) * 100) : 0;
      if (pct >= 60) K.confetti();
      K.beep(pct >= 60 ? "win" : "bad");
      wrap.innerHTML = "";
      wrap.appendChild(el("div", { class: "result-card" }, [
        el("div", { class: "result-emoji", text: pct >= 80 ? "🏆" : "🎧" }),
        el("h2", { text: "Nice listening!" }),
        el("p", { class: "result-score", html: "Matched <b>" + totalMatched + "</b> of <b>" + totalPairs + "</b> pairs across " + TOTAL + (TOTAL === 1 ? " round" : " rounds") }),
        el("div", { class: "result-actions" }, [
          el("button", { class: "btn primary", text: "Play again", on: { click: api.restart } }),
          el("button", { class: "btn", text: "Other exercise", on: { click: api.backToTopics } }),
          el("button", { class: "btn ghost", text: "Menu", on: { click: api.exit } })
        ])
      ]));
    }

    render();
  }

  register();
})();
