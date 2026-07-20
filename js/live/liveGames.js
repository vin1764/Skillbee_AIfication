/* =====================================================================
   LiveGames — adapts each game to the shared Live Class flow.
   Each adapter provides:
     meta          { name, emoji, contentType }
     buildRounds(topic)              -> [ round, ... ]
     hostContent(el, round)          -> render the board's question area
     playerContent(el, round, api)   -> tap UI; api.submit(payload)
     score(round, payload, elapsedMs, timeLimit) -> { correct, points }
     correctLabel(round)             -> text shown at reveal
     speakOnReveal(round)            -> German text to pronounce (or null)
   The Live controller supplies all the surrounding chrome (room code,
   timer, answered counter, leaderboard, podium).
   ===================================================================== */
(function () {
  function kit() {
    return window.App.kit;
  }

  /* Kahoot-style shape/colour set for up to 4 answer buttons. */
  var SHAPES = ["🔺", "🔷", "⬤", "⬛"];
  var COLORS = ["#ff595e", "#1982c4", "#8ac926", "#ff924c"];

  /* A "choice" game: board shows a German word, phones show 4 tap buttons. */
  function choiceAdapter(meta) {
    return {
      meta: meta,
      timeLimit: 20000,
      buildRounds: function (topic) {
        var words = (topic.words || []).filter(function (w) { return w.de && w.en; });
        var picked = kit().sample(words, Math.min(10, words.length));
        return picked.map(function (w) {
          var others = words.filter(function (x) { return x.en !== w.en; });
          var distract = kit().sample(others, Math.min(3, others.length)).map(function (x) { return x.en; });
          var options = kit().shuffle([w.en].concat(distract));
          return { type: "choice", de: w.de, emoji: w.emoji || "", options: options, answer: w.en };
        });
      },
      hostContent: function (el, round) {
        return el("div", { class: "live-q" }, [
          el("div", { class: "live-q-tag", text: "What does this mean?" }),
          el("div", { class: "live-q-word" }, [
            document.createTextNode(round.de + " "),
            kit().speakerButton(round.de)
          ]),
          // NOTE: the word's emoji is deliberately NOT shown here — for colours,
          // numbers, etc. it would give away the answer. It appears at reveal.
          el("div", { class: "live-q-options board" }, round.options.map(function (opt, i) {
            return el("div", { class: "live-opt board", attrs: { style: "--c:" + COLORS[i] } }, [
              el("span", { class: "opt-shape", text: SHAPES[i] }),
              el("span", { class: "opt-text", text: opt })
            ]);
          }))
        ]);
      },
      playerContent: function (el, round, api) {
        return el("div", { class: "live-q-options phone" }, round.options.map(function (opt, i) {
          return el("button", {
            class: "live-opt phone",
            attrs: { style: "--c:" + COLORS[i] },
            on: { click: function () { api.submit({ choice: opt }); } }
          }, [
            el("span", { class: "opt-shape", text: SHAPES[i] }),
            el("span", { class: "opt-text", text: opt })
          ]);
        }));
      },
      score: function (round, payload, elapsedMs, timeLimit) {
        var correct = payload && payload.choice === round.answer;
        if (!correct) return { correct: false, points: 0 };
        var frac = Math.max(0, 1 - elapsedMs / timeLimit); // decays over the window
        return { correct: true, points: Math.round(500 + 500 * frac) };
      },
      correctLabel: function (round) {
        return round.answer;
      },
      speakOnReveal: function (round) {
        return round.de;
      }
    };
  }

  /* ---- Fall-Detektiv (Case Detective): pick the correctly-declined article ---- */
  // Render a sentence, styling the blank and (on the host) the clue word, which
  // glows after a short delay via CSS so struggling students get a hint.
  function renderSentence(el, sentence, clueWord, isHost) {
    return String(sentence).split(/(\s+)/).map(function (tok) {
      if (/^\s+$/.test(tok)) return document.createTextNode(tok);
      if (tok.indexOf("___") >= 0) return el("span", { class: "cases-blank", text: "____" });
      var core = tok.replace(/[.,!?;:]/g, "");
      if (isHost && clueWord && core.toLowerCase() === clueWord.toLowerCase()) {
        return el("span", { class: "cases-clue", text: tok });
      }
      return el("span", { text: tok });
    });
  }

  // Three wrong article options. Use the ones stored with the sentence if
  // present; otherwise pick three other real German articles (so teacher-added
  // rows work without having to type distractors by hand).
  var ARTICLE_POOL = ["der", "die", "das", "den", "dem", "des"];
  function caseDistractors(s) {
    if (s.distractors && s.distractors.length >= 3) return s.distractors.slice(0, 3);
    var pool = ARTICLE_POOL.filter(function (a) { return a !== s.correct; });
    return kit().sample(pool, 3);
  }

  var casesAdapter = {
    meta: { name: "Fall-Detektiv", emoji: "🕵️", contentType: "cases" },
    timeLimit: 20000,
    supportsTyping: true, // teacher can choose tap-options or type-the-answer
    // The "topics" for this game are the three difficulty levels.
    getTopics: function () {
      return [
        { id: "l1", name: "Level 1", english: "Accusative", emoji: "1️⃣", level: 1 },
        { id: "l2", name: "Level 2", english: "+ Dative", emoji: "2️⃣", level: 2 },
        { id: "l3", name: "Level 3", english: "+ Genitive", emoji: "3️⃣", level: 3 }
      ];
    },
    buildRounds: function (topic) {
      var store = window.ContentStore;
      var C = (store && store.casesData && store.casesData()) || window.CaseData || { accusative: [], dative: [], genitive: [] };
      var pool = (C.accusative || []).slice();
      if (topic.level >= 2) pool = pool.concat(C.dative || []);
      if (topic.level >= 3) pool = pool.concat(C.genitive || []);
      // Skip half-finished rows a teacher may have added in the editor.
      pool = pool.filter(function (s) {
        return s && s.sentence && String(s.sentence).indexOf("___") >= 0 && s.correct;
      });
      return kit().sample(pool, Math.min(10, pool.length)).map(function (s) {
        return {
          type: "cases", sentence: s.sentence, blank: s.blank || "", clueWord: s.clueWord || "",
          options: kit().shuffle([s.correct].concat(caseDistractors(s))),
          answer: s.correct, correct: s.correct, explanation: s.explanation || ""
        };
      });
    },
    hostContent: function (el, round) {
      return el("div", { class: "cases-q" }, [
        el("div", { class: "cases-tag", text: "🕵️ Which article fits the blank?" }),
        el("div", { class: "cases-sentence" }, renderSentence(el, round.sentence, round.clueWord, true))
      ]);
    },
    playerContent: function (el, round, api) {
      var sentence = el("div", { class: "cases-sentence phone" }, renderSentence(el, round.sentence, round.clueWord, false));
      if (round.answerMode === "type") {
        var input = el("input", { class: "type-input", attrs: { type: "text", placeholder: "type the article…", autocapitalize: "off", autocomplete: "off", spellcheck: "false" } });
        var submit = function () { var v = (input.value || "").trim(); if (v) api.submit({ text: v }); };
        input.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
        setTimeout(function () { try { input.focus(); } catch (e) {} }, 50);
        return el("div", { class: "cases-player" }, [
          sentence,
          el("div", { class: "type-row" }, [input, el("button", { class: "btn primary type-go", text: "Submit", on: { click: submit } })])
        ]);
      }
      return el("div", { class: "cases-player" }, [
        sentence,
        el("div", { class: "live-q-options phone" }, round.options.map(function (opt, i) {
          return el("button", {
            class: "live-opt phone", attrs: { style: "--c:" + COLORS[i] },
            on: { click: function () { api.submit({ choice: opt }); } }
          }, [el("span", { class: "opt-shape", text: SHAPES[i] }), el("span", { class: "opt-text", text: opt })]);
        }))
      ]);
    },
    score: function (round, payload, elapsedMs, timeLimit) {
      var given = payload ? (payload.choice != null ? payload.choice : (payload.text || "").trim().toLowerCase()) : "";
      if (given !== round.answer) return { correct: false, points: 0 };
      var frac = Math.max(0, 1 - elapsedMs / timeLimit);
      return { correct: true, points: Math.round(500 + 500 * frac) };
    },
    correctLabel: function (round) { return round.correct; },
    speakOnReveal: function (round) { return String(round.sentence).replace("___", round.correct); }
  };

  /* ---- Wortmonster (Word Monster): build compound nouns from two tiles ---- */
  // Join two parts the German way: the second part's first letter becomes
  // lower-case (Hand + Schuh -> Handschuh). Used for teacher-added rows.
  function joinCompound(a, b) {
    b = String(b || "");
    return String(a || "") + (b ? b.charAt(0).toLowerCase() + b.slice(1) : "");
  }

  var compoundAdapter = {
    meta: { name: "Wortmonster", emoji: "🧟", contentType: "compounds" },
    timeLimit: 20000,
    getTopics: function () {
      return [{ id: "all", name: "Wortmonster", english: "All compounds", emoji: "🧟" }];
    },
    buildRounds: function () {
      var store = window.ContentStore;
      var raw = (store && store.compoundsData && store.compoundsData()) || window.CompoundData || [];
      // Keep only usable rows and make sure each has a compound (parts join directly).
      var all = raw.filter(function (c) { return c && c.partA && c.partB; }).map(function (c) {
        return {
          partA: c.partA, partB: c.partB, gender: c.gender || "der",
          meaning: c.meaning || "", emoji: c.emoji || "",
          compound: c.compound || joinCompound(c.partA, c.partB)
        };
      });
      return kit().sample(all, Math.min(10, all.length)).map(function (c) {
        // tile set = the two correct parts + a few decoy parts from other words
        var others = all.filter(function (x) { return x.compound !== c.compound; });
        var decoys = kit().sample(others, 5).map(function (o) { return kit().shuffle([o.partA, o.partB])[0]; });
        var seen = {}, tiles = [];
        kit().shuffle([c.partA, c.partB].concat(decoys)).forEach(function (t) { if (!seen[t]) { seen[t] = 1; tiles.push(t); } });
        return {
          type: "compound", meaning: c.meaning, emoji: c.emoji, tiles: tiles,
          partA: c.partA, partB: c.partB, compound: c.compound, gender: c.gender,
          correct: c.compound,
          explanation: c.gender + " — from " + c.gender + " " + c.partB
        };
      });
    },
    hostContent: function (el, round) {
      return el("div", { class: "wm-host" }, [
        el("div", { class: "cases-tag", text: "🧟 Build the German word" }),
        round.emoji ? el("div", { class: "wm-emoji big", text: round.emoji }) : null,
        el("div", { class: "wm-meaning big", text: round.meaning })
      ]);
    },
    playerContent: function (el, round, api) {
      var built = [], tileEls = {};
      var answerRow = el("div", { class: "wm-answer" });
      var bank = el("div", { class: "wm-bank" });
      var submitBtn = el("button", { class: "btn primary wm-submit", text: "Submit", attrs: { disabled: "true" }, on: { click: function () { if (built.length === 2) api.submit({ parts: built.slice() }); } } });
      function renderAnswer() {
        answerRow.innerHTML = "";
        built.forEach(function (t, i) { answerRow.appendChild(el("button", { class: "wm-tile chosen", text: t, on: { click: function () { unpick(i); } } })); });
        submitBtn.disabled = built.length !== 2;
      }
      function pick(t, btn) { if (built.length >= 2 || btn.classList.contains("used")) return; built.push(t); btn.classList.add("used"); renderAnswer(); }
      function unpick(i) { var t = built[i]; built.splice(i, 1); if (tileEls[t]) tileEls[t].classList.remove("used"); renderAnswer(); }
      round.tiles.forEach(function (t) { var btn = el("button", { class: "wm-tile", text: t, on: { click: function () { pick(t, btn); } } }); tileEls[t] = btn; bank.appendChild(btn); });
      return el("div", { class: "wm-player" }, [
        el("div", { class: "wm-target" }, [round.emoji ? el("div", { class: "wm-emoji", text: round.emoji }) : null, el("div", { class: "wm-meaning", text: round.meaning })]),
        el("div", { class: "wm-hint", text: "Tap two parts in order" }),
        answerRow, bank, submitBtn
      ]);
    },
    score: function (round, payload, elapsedMs, timeLimit) {
      var p = payload && payload.parts;
      var correct = p && p.length === 2 && p[0] === round.partA && p[1] === round.partB;
      if (!correct) return { correct: false, points: 0 };
      var frac = Math.max(0, 1 - elapsedMs / timeLimit);
      return { correct: true, points: Math.round(500 + 500 * frac) };
    },
    correctLabel: function (round) { return round.gender + " " + round.compound; },
    speakOnReveal: function (round) { return round.gender + " " + round.compound; }
  };

  window.LiveGames = {
    quiz: choiceAdapter({ name: "Vocabulary Quiz", emoji: "🎯", contentType: "vocab" }),
    memory: choiceAdapter({ name: "Memory Match", emoji: "🧩", contentType: "vocab" }),
    cases: casesAdapter,
    wortmonster: compoundAdapter
  };
})();
