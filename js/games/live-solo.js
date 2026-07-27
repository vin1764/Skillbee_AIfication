/* =====================================================================
   Solo/Offline wrappers for the Live-Class games.
   ---------------------------------------------------------------------
   Lücken-Text, Wortmonster, Hör gut zu! and Match the Following were
   originally Live-only.
   This registers a Solo version of each by reusing the very same content
   logic the Live adapters already provide (buildRounds / score /
   correctLabel / speakOnReveal). The result plays like the existing Solo
   Quiz-Blitz: one round at a time, ✓/✗ feedback, then a score card.
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
    { key: "listen", name: "Hör gut zu!", emoji: "👂", color: "#0ea5b7", layout: "prompt",
      description: "Listen to the German word and pick what you heard." },
    { key: "hoerpaare", name: "Match the Following", emoji: "🔗", color: "#06b6d4", layout: "match",
      description: "Match each tile to its pair — text, icons, pictures or audio." },
    { key: "truefalse", name: "Wahr oder Falsch?", emoji: "⚖️", color: "#f59e0b", layout: "prompt",
      description: "Decide whether each statement is true or false." },
    { key: "scramble", name: "Sentence Scramble", emoji: "🧱", color: "#3b4de8", layout: "prompt",
      description: "Tap the shuffled German words back into the correct order." },
    { key: "hangman", name: "Hangman", emoji: "🔤", color: "#6a4c93", layout: "prompt",
      description: "Spell the German word the clue describes, letter by letter." }
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

    // Leaving mid-round must stop the pending advance timer so a detached game
    // can't render, beep, speak, or throw confetti over the next screen.
    var dead = false, timers = [];
    function later(fn, ms) { var id = setTimeout(function () { if (!dead) fn(); }, ms); timers.push(id); return id; }
    if (api.onCleanup) api.onCleanup(function () { dead = true; timers.forEach(clearTimeout); });

    function render() {
      if (dead) return;
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
        // Reuse the adapter's board prompt, but drop the pieces meant only for the
        // teacher's board: non-interactive option tiles, the "students do it on their
        // phones" notes, and the host's duplicate audio button (the interactive UI
        // below already has its own).
        var host = adapter.hostContent(el, r);
        // Strip every teacher/board-only bit so the lone solo player never sees a
        // "students tap … on their phones" note meant for the smartboard.
        Array.prototype.forEach.call(host.querySelectorAll(".live-q-options.board, .scr-hostnote, .hang-hostnote, .scr-host-audio, .tf-hostnote, .listen-typing-note, .lt-hostnote"), function (n) { n.remove(); });
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
      var full = 10 + Math.round(10 * frac);
      // Partial-credit games (Lücken-Text, Hör-gut-zu Type) return matched/total;
      // award points PRO-RATA instead of the old all-or-nothing ✗ that threw away
      // "2 of 3 blanks right". Non-partial games keep the plain correct/wrong path.
      if (sc.matched != null && sc.total) {
        var pts = Math.round((sc.matched / sc.total) * full);
        if (pts > 0) api.addScore(pts);
        if (sc.correct) { correct++; streak++; K.beep("good"); }
        else { streak = 0; K.beep(sc.matched > 0 ? "good" : "bad"); }
      } else if (sc.correct) {
        correct++; streak++; api.addScore(full); K.beep("good");
      } else {
        streak = 0; K.beep("bad");
      }
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
      // Ring the correct option. Text options carry their label in .opt-text
      // (Hör-gut-zu) or .match-mtext (MCQ/match); fall back to the button's own
      // text so plain-text tap options still light up.
      var want = String(r.answer == null ? "" : r.answer).trim();
      var wantLabel = answerText.trim();
      Array.prototype.forEach.call(wrap.querySelectorAll(".live-opt.phone"), function (btn) {
        var lbl = btn.querySelector(".opt-text, .match-mtext");
        var t = String((lbl ? lbl.textContent : btn.textContent) || "").trim();
        if (t && (t === want || t === wantLabel)) btn.classList.add("correct");
      });
      // Partial-credit reveal: a Lücken-Text where 2 of 3 blanks were right is
      // "Almost!", not a flat ✗ — show the tally, like Live.
      var partial = (sc.matched != null && sc.total != null && sc.total > 0);
      var someRight = partial && sc.matched > 0 && !sc.correct;
      var icon = sc.correct ? "✓" : someRight ? "◐" : "✗";
      var title = sc.correct ? "Correct!" : someRight ? "Almost!" : "Not quite";
      wrap.appendChild(el("div", { class: "solo-reveal " + (sc.correct ? "good" : someRight ? "partial" : "bad") }, [
        el("div", { class: "solo-reveal-icon", text: icon }),
        el("div", { class: "solo-reveal-body" }, [
          el("div", { class: "solo-reveal-title", text: title }),
          partial ? el("div", { class: "solo-reveal-count", text: sc.matched + " of " + sc.total + " correct" }) : null,
          el("div", { class: "solo-reveal-ans", text: "Answer: " + answerText })
        ])
      ]));
      later(next, sc.correct ? 1100 : 1900);
    }

    function next() { if (dead) return; idx++; if (idx < TOTAL) render(); else finish(); }

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

    // Same teardown guard as runSolo — see there.
    var dead = false, timers = [];
    function later(fn, ms) { var id = setTimeout(function () { if (!dead) fn(); }, ms); timers.push(id); return id; }
    if (api.onCleanup) api.onCleanup(function () { dead = true; timers.forEach(clearTimeout); });

    function render() {
      if (dead) return;
      var r = rounds[idx];
      var pairs = (r.pairs || []).slice();
      var n = pairs.length;
      var matched = 0, wrong = 0, done = false, busy = false;
      var startTs = Date.now();
      var MT = window.MatchTiles;
      wrap.innerHTML = "";
      var counter = el("span", { class: "match-count-n", text: "0 / " + n });
      wrap.appendChild(el("div", { class: "quiz-head" }, [
        el("button", { class: "back-link small", html: "← Menu", on: { click: api.exit } }),
        el("div", { class: "quiz-progress", text: "Round " + (idx + 1) + " / " + TOTAL }),
        el("div", { class: "match-count", text: "Matched " }, [counter])
      ]));
      var anyAudio = pairs.some(function (p) { return MT.isAudio(p.q) || MT.isAudio(p.a); });
      wrap.appendChild(el("div", { class: "player-prompt-hint", text: anyAudio ? "Tap 🔊 to hear it, then match each pair 👇" : "Tap one tile on each side to match them 👇" }));

      var leftCol = el("div", { class: "match-col questions" });
      var rightCol = el("div", { class: "match-col answers" });
      var lefts = K.shuffle(pairs.map(function (p, i) { return { idx: i, side: p.q }; }));
      var rights = K.shuffle(pairs.map(function (p, i) { return { idx: i, side: p.a }; }));
      var sel = { q: null, a: null };

      function revealAudio(btn, side) {
        if (side && side.type === "audio") { var lbl = btn.querySelector(".match-slabel"); if (lbl) lbl.textContent = side.value; }
      }
      function tryMatch() {
        if (!sel.q || !sel.a) return;
        var q = sel.q, a = sel.a;
        if (q.idx === a.idx) {
          matched++; counter.textContent = matched + " / " + n;
          q.btn.classList.remove("sel"); a.btn.classList.remove("sel");
          q.btn.classList.add("done"); a.btn.classList.add("done");
          q.btn.disabled = true; a.btn.disabled = true;
          revealAudio(q.btn, pairs[q.idx].q); revealAudio(a.btn, pairs[a.idx].a);
          sel.q = null; sel.a = null;
          try { K.beep("good"); } catch (e) {}
          if (matched >= n) finishRound();
        } else {
          wrong++; busy = true;
          q.btn.classList.remove("sel"); a.btn.classList.remove("sel");
          q.btn.classList.add("wrong"); a.btn.classList.add("wrong");
          try { K.beep("bad"); } catch (e) {}
          var x = q.btn, y = a.btn; sel.q = null; sel.a = null;
          later(function () { x.classList.remove("wrong"); y.classList.remove("wrong"); busy = false; }, 500);
        }
      }
      function onTile(col, it, btn) {
        if (busy || btn.disabled) return;
        if (MT.isAudio(it.side)) MT.play(K, it.side, r.speed || 1);
        if (sel[col]) sel[col].btn.classList.remove("sel");
        sel[col] = { idx: it.idx, btn: btn }; btn.classList.add("sel");
        tryMatch();
      }

      lefts.forEach(function (it) {
        var btn = MT.render(el, it.side);
        btn.addEventListener("click", function () { onTile("q", it, btn); });
        leftCol.appendChild(btn);
      });
      rights.forEach(function (it) {
        var btn = MT.render(el, it.side);
        btn.addEventListener("click", function () { onTile("a", it, btn); });
        rightCol.appendChild(btn);
      });
      wrap.appendChild(el("div", { class: "match-board" }, [leftCol, rightCol]));

      function finishRound() {
        if (done) return;
        done = true;
        totalMatched += matched; totalPairs += n;
        api.addScore(Math.max(3, 5 + matched * 2 - wrong * 2));
        var secs = Math.max(1, Math.round((Date.now() - startTs) / 1000));
        var last = (idx + 1) >= TOTAL;
        later(function () {
          wrap.appendChild(el("div", { class: "solo-reveal good" }, [
            el("div", { class: "solo-reveal-icon", text: "🔗" }),
            el("div", { class: "solo-reveal-body" }, [
              el("div", { class: "solo-reveal-title", text: "All " + n + " matched!" }),
              el("div", { class: "solo-reveal-ans", text: secs + "s" + (wrong ? " · " + wrong + " wrong tap" + (wrong === 1 ? "" : "s") : "") })
            ])
          ]));
          later(function () { idx++; if (last) finishAll(); else render(); }, 950);
        }, 300);
      }
    }

    function finishAll() {
      var pct = totalPairs ? Math.round((totalMatched / totalPairs) * 100) : 0;
      if (pct >= 60) K.confetti();
      K.beep(pct >= 60 ? "win" : "bad");
      wrap.innerHTML = "";
      wrap.appendChild(el("div", { class: "result-card" }, [
        el("div", { class: "result-emoji", text: pct >= 80 ? "🏆" : "🔗" }),
        el("h2", { text: "Nice matching!" }),
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
