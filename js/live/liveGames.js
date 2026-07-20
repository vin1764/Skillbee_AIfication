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

  // Build up to `n` wrong options. Uses the teacher's custom ones first (from the
  // admin editor), then tops up with auto-generated ones from `autoPool`. Never
  // includes the correct answer; blanks/duplicates are dropped. If the teacher
  // set nothing, this behaves exactly like the previous auto-only generation.
  function wrongOptions(custom, correct, autoPool, n) {
    var out = [];
    (custom || []).forEach(function (d) {
      d = String(d).trim();
      if (d && d !== correct && out.indexOf(d) < 0) out.push(d);
    });
    if (out.length < n) {
      var pool = autoPool.filter(function (x) { return x !== correct && out.indexOf(x) < 0; });
      kit().sample(pool, n - out.length).forEach(function (x) { out.push(x); });
    }
    return out.slice(0, n);
  }

  /* A "choice" game: board shows a German word, phones show 4 tap buttons. */
  function choiceAdapter(meta) {
    return {
      meta: meta,
      timeLimit: 20000,
      buildRounds: function (topic) {
        var words = (topic.words || []).filter(function (w) { return w.de && w.en; });
        var picked = kit().sample(words, Math.min(10, words.length));
        return picked.map(function (w) {
          var autoPool = words.filter(function (x) { return x.en !== w.en; }).map(function (x) { return x.en; });
          var distract = wrongOptions(w.distractors, w.en, autoPool, 3);
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
    return wrongOptions(s.distractors, s.correct, ARTICLE_POOL, 3);
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

  /* ---- Plural-Palast (Plural Palace): pick a noun's correct plural ---- */
  var pluralAdapter = {
    meta: { name: "Plural-Palast", emoji: "🏰", contentType: "plurals" },
    timeLimit: 20000,
    getTopics: function () {
      return [{ id: "all", name: "Plural-Palast", english: "All nouns", emoji: "🏰" }];
    },
    buildRounds: function () {
      var store = window.ContentStore;
      var all = ((store && store.pluralsData && store.pluralsData()) || window.PluralData || [])
        .filter(function (p) { return p && p.singular && p.plural; });
      var autoPool = all.map(function (p) { return p.plural; });
      return kit().sample(all, Math.min(10, all.length)).map(function (p) {
        return {
          type: "plural", de: p.singular, en: p.en || "", emoji: p.emoji || "",
          options: kit().shuffle([p.plural].concat(wrongOptions(p.wrong, p.plural, autoPool, 3))),
          answer: p.plural, correct: p.plural
        };
      });
    },
    hostContent: function (el, round) {
      return el("div", { class: "live-q" }, [
        el("div", { class: "live-q-tag", text: "🏰 What is the plural?" }),
        el("div", { class: "live-q-word" }, [
          document.createTextNode(round.de + " "),
          kit().speakerButton(round.de)
        ]),
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
          class: "live-opt phone", attrs: { style: "--c:" + COLORS[i] },
          on: { click: function () { api.submit({ choice: opt }); } }
        }, [el("span", { class: "opt-shape", text: SHAPES[i] }), el("span", { class: "opt-text", text: opt })]);
      }));
    },
    score: function (round, payload, elapsedMs, timeLimit) {
      if (!payload || payload.choice !== round.answer) return { correct: false, points: 0 };
      var frac = Math.max(0, 1 - elapsedMs / timeLimit);
      return { correct: true, points: Math.round(500 + 500 * frac) };
    },
    correctLabel: function (round) { return "die " + round.correct; },
    speakOnReveal: function (round) { return "die " + round.correct; }
  };

  /* ---- Konjugations-Karussell (Conjugation Carousel): conjugate a verb ---- */
  var PRON_LABEL = { ich: "ich", du: "du", er: "er/sie/es", wir: "wir", ihr: "ihr", sie: "sie (they)" };
  // Ask about du / er more often — that's where the stem changes (and errors) are.
  var PRON_WEIGHTED = ["du", "du", "er", "er", "ich", "wir", "ihr", "sie"];

  var verbAdapter = {
    meta: { name: "Konjugations-Karussell", emoji: "🎠", contentType: "verbs" },
    timeLimit: 15000, // fast-paced warm-up
    getTopics: function () {
      return [{ id: "all", name: "Konjugations-Karussell", english: "All verbs", emoji: "🎠" }];
    },
    buildRounds: function () {
      var store = window.ContentStore;
      var all = ((store && store.verbsData && store.verbsData()) || window.VerbData || [])
        .filter(function (v) { return v && v.inf && v.forms && v.forms.du; });
      return kit().sample(all, Math.min(10, all.length)).map(function (v) {
        var pron = kit().shuffle(PRON_WEIGHTED.slice())[0];
        var correct = v.forms[pron];
        // Distractors: the star trap (naive "no stem change" form, for du/er) plus
        // this verb's other pronoun-forms — all realistic mistakes.
        var opts = [];
        if (v.naive && v.naive[pron] && v.naive[pron] !== correct) opts.push(v.naive[pron]);
        var others = Object.keys(v.forms).map(function (k) { return v.forms[k]; })
          .filter(function (f) { return f !== correct; });
        kit().shuffle(others).forEach(function (f) { if (opts.length < 3 && opts.indexOf(f) < 0) opts.push(f); });
        return {
          type: "verb", inf: v.inf, en: v.en || "", pron: pron, pronLabel: PRON_LABEL[pron] || pron,
          options: kit().shuffle([correct].concat(opts.slice(0, 3))), answer: correct, correct: correct
        };
      });
    },
    hostContent: function (el, round) {
      return el("div", { class: "live-q" }, [
        el("div", { class: "live-q-tag", text: "🎠 Conjugate the verb" }),
        el("div", { class: "live-q-word" }, [
          document.createTextNode(round.inf + "  —  " + round.pronLabel + " "),
          kit().speakerButton(round.inf)
        ]),
        round.en ? el("div", { class: "live-q-en", text: round.en }) : null,
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
          class: "live-opt phone", attrs: { style: "--c:" + COLORS[i] },
          on: { click: function () { api.submit({ choice: opt }); } }
        }, [el("span", { class: "opt-shape", text: SHAPES[i] }), el("span", { class: "opt-text", text: opt })]);
      }));
    },
    score: function (round, payload, elapsedMs, timeLimit) {
      if (!payload || payload.choice !== round.answer) return { correct: false, points: 0 };
      var frac = Math.max(0, 1 - elapsedMs / timeLimit);
      return { correct: true, points: Math.round(500 + 500 * frac) };
    },
    correctLabel: function (round) { return round.pron + " " + round.correct; },
    speakOnReveal: function (round) { return round.pron + " " + round.correct; }
  };

  /* ---- Uhrzeit-Blitz (Clock Flash): read the analog clock in German ---- */
  // Pure generator — no content bank. German colloquial time follows fixed
  // rules from the hands, so we build the correct phrase + plausible wrong
  // ones (the halb trap, off-by-a-quarter, nach/vor swap, wrong hour).
  var NUMW = ["", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf"];
  function hourWord(h, uhr) { if (h === 1) return uhr ? "ein" : "eins"; return NUMW[h]; }
  function nextHour(h) { return (h % 12) + 1; }
  function prevHour(h) { return ((h + 10) % 12) + 1; }
  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
  var MIN_NACH = { 5: "fünf", 10: "zehn", 20: "zwanzig" };
  var MIN_VOR = { 40: "zwanzig", 50: "zehn", 55: "fünf" };
  function timePhrase(h, m) {
    var nh = nextHour(h);
    if (m === 0) return hourWord(h, true) + " Uhr";
    if (m === 15) return "viertel nach " + hourWord(h, false);
    if (m === 30) return "halb " + hourWord(nh, false);
    if (m === 45) return "viertel vor " + hourWord(nh, false);
    if (MIN_NACH[m]) return MIN_NACH[m] + " nach " + hourWord(h, false);
    if (MIN_VOR[m]) return MIN_VOR[m] + " vor " + hourWord(nh, false);
    return hourWord(h, true) + " Uhr";
  }
  function timeDistractors(h, m, correct) {
    var nh = nextHour(h), ph = prevHour(h), cands = [];
    if (m === 30) cands.push("halb " + hourWord(h, false)); // THE trap: "half past h"
    if (m === 15) cands.push("viertel vor " + hourWord(nh, false));
    else if (m === 45) cands.push("viertel nach " + hourWord(h, false));
    else if (MIN_NACH[m]) cands.push(MIN_NACH[m] + " vor " + hourWord(nh, false));
    else if (MIN_VOR[m]) cands.push(MIN_VOR[m] + " nach " + hourWord(h, false));
    cands.push(timePhrase(nh, m), timePhrase(ph, m)); // wrong hour
    if (m === 0) cands.push("viertel nach " + hourWord(h, false));
    if (m === 15) cands.push("halb " + hourWord(nh, false));
    if (m === 30) cands.push("viertel nach " + hourWord(h, false));
    if (m === 45) cands.push("halb " + hourWord(nh, false));
    var seen = {}, out = [];
    cands.forEach(function (c) { if (c && c !== correct && !seen[c]) { seen[c] = 1; out.push(c); } });
    return out.slice(0, 3);
  }
  function clockSVG(h, m) {
    function hand(angle, len, w, color) {
      var r = (angle - 90) * Math.PI / 180;
      return '<line x1="100" y1="100" x2="' + (100 + len * Math.cos(r)).toFixed(1) + '" y2="' +
        (100 + len * Math.sin(r)).toFixed(1) + '" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="round"/>';
    }
    var ticks = "";
    for (var i = 0; i < 12; i++) {
      var a = (i * 30 - 90) * Math.PI / 180, big = i % 3 === 0;
      ticks += '<line x1="' + (100 + 78 * Math.cos(a)).toFixed(1) + '" y1="' + (100 + 78 * Math.sin(a)).toFixed(1) +
        '" x2="' + (100 + 90 * Math.cos(a)).toFixed(1) + '" y2="' + (100 + 90 * Math.sin(a)).toFixed(1) +
        '" stroke="' + (big ? "#3b4de8" : "#c9d2e3") + '" stroke-width="' + (big ? 4 : 2) + '"/>';
    }
    var hAng = ((h % 12) + m / 60) * 30, mAng = m * 6;
    return '<svg viewBox="0 0 200 200" class="clock-svg" role="img" aria-label="clock">' +
      '<circle cx="100" cy="100" r="94" fill="#fff" stroke="#3b4de8" stroke-width="4"/>' + ticks +
      hand(hAng, 50, 7, "#1b2440") + hand(mAng, 74, 4, "#3b4de8") +
      '<circle cx="100" cy="100" r="5" fill="#1b2440"/></svg>';
  }

  var timeAdapter = {
    meta: { name: "Uhrzeit-Blitz", emoji: "🕐", contentType: "time" },
    timeLimit: 20000,
    getTopics: function () {
      return [{ id: "all", name: "Uhrzeit-Blitz", english: "Random times", emoji: "🕐" }];
    },
    buildRounds: function () {
      // weight toward the quarter times (and halb — the trap)
      var MINS = [0, 15, 30, 30, 45, 5, 10, 20, 40, 50, 55];
      var used = {}, rounds = [];
      for (var n = 0; n < 10; n++) {
        var h, m, key, guard = 0;
        do { h = 1 + Math.floor(Math.random() * 12); m = kit().sample(MINS, 1)[0]; key = h + ":" + m; guard++; }
        while (used[key] && guard < 30);
        used[key] = 1;
        var correct = timePhrase(h, m);
        rounds.push({
          type: "time", h: h, m: m, correct: correct, answer: correct,
          explanation: "(" + h + ":" + pad2(m) + ")",
          options: kit().shuffle([correct].concat(timeDistractors(h, m, correct)))
        });
      }
      return rounds;
    },
    hostContent: function (el, round) {
      return el("div", { class: "live-q" }, [
        el("div", { class: "live-q-tag", text: "🕐 What time is it?" }),
        el("div", { class: "clock-wrap", html: clockSVG(round.h, round.m) }),
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
          class: "live-opt phone", attrs: { style: "--c:" + COLORS[i] },
          on: { click: function () { api.submit({ choice: opt }); } }
        }, [el("span", { class: "opt-shape", text: SHAPES[i] }), el("span", { class: "opt-text", text: opt })]);
      }));
    },
    score: function (round, payload, elapsedMs, timeLimit) {
      if (!payload || payload.choice !== round.answer) return { correct: false, points: 0 };
      var frac = Math.max(0, 1 - elapsedMs / timeLimit);
      return { correct: true, points: Math.round(500 + 500 * frac) };
    },
    correctLabel: function (round) { return round.correct; },
    speakOnReveal: function (round) { return round.correct; }
  };

  /* ---- Hör gut zu! (Listen Carefully!): pick the word you heard ---- */
  // The smartboard speaks the word (browser German voice); phones show 4
  // look-alike options. The teacher may play it once more (one replay).
  var listenAdapter = {
    meta: { name: "Hör gut zu!", emoji: "👂", contentType: "listening" },
    timeLimit: 20000,
    getTopics: function () {
      return [{ id: "all", name: "Hör gut zu!", english: "All words", emoji: "👂" }];
    },
    buildRounds: function () {
      var store = window.ContentStore;
      var all = ((store && store.listeningData && store.listeningData()) || window.ListeningData || [])
        .filter(function (w) { return w && w.word; });
      var autoPool = all.map(function (w) { return w.word; });
      return kit().sample(all, Math.min(10, all.length)).map(function (w) {
        return {
          type: "listen", word: w.word, meaning: w.meaning || "", explanation: w.meaning || "",
          options: kit().shuffle([w.word].concat(wrongOptions(w.distractors, w.word, autoPool, 3))),
          answer: w.word, correct: w.word
        };
      });
    },
    hostContent: function (el, round) {
      if (round._plays == null) round._plays = 0;
      var btn;
      function label() {
        if (round._plays === 0) return "🔊 Play the word";
        if (round._plays === 1) return "🔁 Play again (1 left)";
        return "✓ Played twice";
      }
      function refresh() { btn.innerHTML = label(); btn.disabled = round._plays >= 2; }
      btn = el("button", {
        class: "btn primary big listen-play",
        on: { click: function () { if (round._plays < 2) { round._plays++; try { kit().speak(round.word); } catch (e) {} refresh(); } } }
      });
      refresh();
      return el("div", { class: "live-q" }, [
        el("div", { class: "live-q-tag", text: "👂 Which word did you hear?" }),
        el("div", { class: "listen-audio" }, [el("div", { class: "listen-emoji", text: "🎧" }), btn]),
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
          class: "live-opt phone", attrs: { style: "--c:" + COLORS[i] },
          on: { click: function () { api.submit({ choice: opt }); } }
        }, [el("span", { class: "opt-shape", text: SHAPES[i] }), el("span", { class: "opt-text", text: opt })]);
      }));
    },
    score: function (round, payload, elapsedMs, timeLimit) {
      if (!payload || payload.choice !== round.answer) return { correct: false, points: 0 };
      var frac = Math.max(0, 1 - elapsedMs / timeLimit);
      return { correct: true, points: Math.round(500 + 500 * frac) };
    },
    correctLabel: function (round) { return round.correct; },
    speakOnReveal: function (round) { return round.correct; }
  };

  window.LiveGames = {
    quiz: choiceAdapter({ name: "Vocabulary Quiz", emoji: "🎯", contentType: "vocab" }),
    memory: choiceAdapter({ name: "Memory Match", emoji: "🧩", contentType: "vocab" }),
    cases: casesAdapter,
    wortmonster: compoundAdapter,
    plural: pluralAdapter,
    verben: verbAdapter,
    uhrzeit: timeAdapter,
    listen: listenAdapter
  };
})();
