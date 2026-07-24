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

  /* Jewel-toned shape/colour set for up to 4 answer buttons (Skillbee gem theme).
     Diamond leads (the Skillbee mark); shapes stay distinct for colourblind clarity. */
  var SHAPES = ["◆", "●", "▲", "■"];
  var COLORS = ["#0A84FF", "#FF3B67", "#12C08A", "#FFA51F"];

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

  /* ---- General MCQ (was Vokabel-Quiz): a question + up to 4 options, where the
     question AND each option is independently text · audio · image · icon. The
     fast, timed, speed-scored Kahoot flow is unchanged — only rendering adapts.
     Quick content comes from vocab words (German text ↔ English text options);
     typed content comes from an authored `mcq` list. */
  function mcqCorrect(round) { return (round.options || []).filter(function (o) { return o.correct; })[0] || null; }
  function mcqSide(s, fallback) {
    if (s && typeof s === "object" && typeof s.type === "string") return { type: s.type, value: String(s.value == null ? "" : s.value) };
    return { type: fallback || "text", value: String(s == null ? "" : s) };
  }
  // German-ish text to pronounce at reveal: an audio side if there is one, else
  // the text question, else a text answer.
  function mcqSpeak(round) {
    var q = round.question || {};
    if (q.type === "audio") return q.value;
    var c = mcqCorrect(round);
    if (c && c.type === "audio") return c.value;
    if (q.type === "text") return q.value;
    if (c && c.type === "text") return c.value;
    return null;
  }
  // A phone option button rendered by type + a shape badge. Audio options play
  // (preview) on the first tap and arm; a second tap on the armed tile submits —
  // so a student can hear it before committing. Every other type submits on the
  // first tap, so the fast Kahoot feel is unchanged.
  function mcqOptionButton(el, opt, i, submit) {
    var armed = false;
    var btn = el("button", { class: "live-opt phone mt-" + (opt.type || "text"), attrs: { style: "--c:" + COLORS[i] } },
      [el("span", { class: "opt-shape", text: SHAPES[i] })].concat(window.MatchTiles.content(el, opt)));
    btn.addEventListener("click", function () {
      if (window.MatchTiles.isAudio(opt)) {
        try { window.MatchTiles.play(kit(), opt); } catch (e) {}
        if (!armed) { armed = true; btn.classList.add("armed"); var l = btn.querySelector(".match-slabel"); if (l) l.textContent = "Tap again to choose"; return; }
      }
      submit();
    });
    return btn;
  }

  function choiceAdapter(meta) {
    return {
      meta: meta,
      timeLimit: 20000,
      pickLabel: "Exercise",
      mcq: true,
      buildRounds: function (topic) {
        var rounds = [];
        // 1) Authored typed MCQ (image/audio/icon/text questions + options).
        (topic.mcq || []).forEach(function (m) {
          if (!m || !m.question) return;
          var q = mcqSide(m.question, "text");
          var opts = (m.options || []).map(function (o) { return { type: (o && o.type) || "text", value: String((o && o.value) || ""), correct: !!(o && o.correct) }; })
            .filter(function (o) { return o.value !== ""; });
          if (!q.value || opts.length < 2 || !opts.some(function (o) { return o.correct; })) return;
          rounds.push({ type: "mcq", question: q, options: kit().shuffle(opts.slice(0, 4)) });
        });
        // 2) Quick auto-generate from vocab → German-text question, English-text options.
        var words = (topic.words || []).filter(function (w) { return w.de && w.en; });
        kit().sample(words, Math.min(10, words.length)).forEach(function (w) {
          var autoPool = words.filter(function (x) { return x.en !== w.en; }).map(function (x) { return x.en; });
          var distract = wrongOptions(w.distractors, w.en, autoPool, 3);
          var opts = [{ type: "text", value: w.en, correct: true }].concat(distract.map(function (d) { return { type: "text", value: d, correct: false }; }));
          rounds.push({ type: "mcq", question: { type: "text", value: w.de }, options: kit().shuffle(opts), emoji: w.emoji || "" });
        });
        return rounds.slice(0, 10);
      },
      hostContent: function (el, round) {
        var q = round.question || { type: "text", value: "" };
        var qNode;
        if (q.type === "text") {
          qNode = el("div", { class: "live-q-word" }, [document.createTextNode(q.value + " "), kit().speakerButton(q.value)]);
        } else if (q.type === "audio") {
          qNode = el("div", { class: "live-q-audio" }, [el("button", { class: "btn primary big listen-play", html: "🔊 Play the audio", on: { click: function () { try { window.MatchTiles.play(kit(), q); } catch (e) {} } } })]);
        } else if (q.type === "image") {
          qNode = el("div", { class: "live-q-media" }, [el("img", { class: "mcq-q-img", attrs: { src: q.value, alt: "" } })]);
        } else {
          qNode = el("div", { class: "live-q-media" }, [el("span", { class: "mcq-q-icon", text: q.value })]);
        }
        return el("div", { class: "live-q" }, [
          el("div", { class: "live-q-tag", text: q.type === "audio" ? "Listen — which one?" : "What is it?" }),
          qNode,
          el("div", { class: "live-q-options board" }, round.options.map(function (opt, i) {
            return el("div", { class: "live-opt board mt-" + (opt.type || "text"), attrs: { style: "--c:" + COLORS[i] } },
              [el("span", { class: "opt-shape", text: SHAPES[i] })].concat(window.MatchTiles.content(el, opt)));
          }))
        ]);
      },
      playerContent: function (el, round, api) {
        return el("div", { class: "live-q-options phone" }, round.options.map(function (opt, i) {
          return mcqOptionButton(el, opt, i, function () { api.submit({ choice: i }); });
        }));
      },
      score: function (round, payload, elapsedMs, timeLimit) {
        var opt = (round.options || [])[payload && payload.choice];
        if (!opt || !opt.correct) return { correct: false, points: 0 };
        var frac = Math.max(0, 1 - elapsedMs / timeLimit); // faster = more, decays over the window
        return { correct: true, points: Math.round(500 + 500 * frac) };
      },
      correctLabel: function (round) { var c = mcqCorrect(round); return c ? c.value : ""; },
      speakOnReveal: function (round) { return mcqSpeak(round); }
    };
  }

  /* ==================================================================
     Lücken-Text (Fill in the Blank) — a general fill-in-the-blank format.
     A sentence has one OR MANY blanks (___1___, ___2___, …). The teacher
     picks Tap (a shared word bank of answers + distractors) or Type (an
     inline text box per blank). Any content set that provides sentences +
     blanks can plug in — case articles are just the first data set. See the
     schema in js/data-cases.js. This game replaces the old case-only
     "Fall-Detektiv"; its single-blank case sentences migrate in unchanged
     (one blank each), and it keeps reading the same "cases" content bank.
     ================================================================== */
  var ARTICLE_POOL = ["der", "die", "das", "den", "dem", "des"];
  function caseDistractors(s) {
    return wrongOptions(s.distractors, s.correct, ARTICLE_POOL, 3);
  }

  // Answer matching: case-insensitive, punctuation stripped, ä/ö/ü/ß folded to
  // ae/oe/ue/ss — the same lenient rules used by Hör gut zu!'s type mode.
  function ltNorm(s) {
    return String(s == null ? "" : s).toLowerCase()
      .replace(/[.,!?;:"'“”„«»()¡¿…\-–—]/g, "")
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .trim();
  }

  // If a sentence uses plain "___" gaps (legacy), number them ___1___, ___2___…
  // in reading order so every blank has a stable id. Already-numbered sentences
  // are returned untouched.
  function ensureNumbered(sentence, blanks) {
    if (/___\d+___/.test(sentence)) return sentence;
    var i = 0;
    return sentence.replace(/_{2,}/g, function () {
      var b = blanks[i]; i++;
      return "___" + (b ? b.id : i) + "___";
    });
  }

  // How many blanks a sentence marks (numbered ___N___ if present, else plain ___).
  function countGaps(sentence) {
    var numbered = (String(sentence).match(/___\d+___/g) || []).length;
    return numbered || (String(sentence).match(/_{2,}/g) || []).length;
  }

  // Build the tap-mode word bank: the teacher's list if given, otherwise the
  // correct answers topped up with plausible article distractors so tap mode
  // isn't trivial. Always includes every correct answer, de-duplicated.
  function buildWordBank(corrects, provided) {
    var out = [];
    (Array.isArray(provided) ? provided : []).forEach(function (w) { w = String(w).trim(); if (w && out.indexOf(w) < 0) out.push(w); });
    corrects.forEach(function (c) { if (c && out.indexOf(c) < 0) out.push(c); });
    if (out.length < corrects.length + 1) {
      var pool = ARTICLE_POOL.filter(function (a) { return out.indexOf(a) < 0; });
      kit().sample(pool, (corrects.length + 1) - out.length).forEach(function (a) { out.push(a); });
    }
    return out;
  }

  // Accept BOTH the new multi-blank schema and the legacy single-blank case
  // rows (sentence + correct + distractors) a teacher may have in the editor,
  // and normalise to { sentence, blanks:[{id,correct}], wordBank, explanation }.
  function normBlankEntry(s) {
    if (!s) return null;
    if (Array.isArray(s.blanks) && s.blanks.length) {
      var sentence = String(s.sentence || "");
      if (sentence.indexOf("___") < 0) return null;               // no blank marker
      var blanks = s.blanks.map(function (b, i) {
        return { id: (b.id != null ? b.id : i + 1), correct: String(b.correct == null ? "" : b.correct).trim() };
      }).filter(function (b) { return b.correct !== ""; });
      if (!blanks.length) return null;
      // Skip half-finished rows: an unfilled gap would render a slot that can't
      // be scored, so only play sentences whose gaps all have answers.
      if (countGaps(sentence) !== blanks.length) return null;
      var wordBank = buildWordBank(blanks.map(function (b) { return b.correct; }), s.wordBank);
      return { sentence: ensureNumbered(sentence, blanks), blanks: blanks, wordBank: wordBank, explanation: s.explanation || "" };
    }
    // Legacy: one blank marked by "___", with a single correct article.
    if (s.sentence && String(s.sentence).indexOf("___") >= 0 && s.correct) {
      var sent = String(s.sentence).replace(/_{2,}/, "___1___");
      return {
        sentence: sent,
        blanks: [{ id: 1, correct: String(s.correct).trim() }],
        wordBank: [String(s.correct).trim()].concat(caseDistractors(s)),
        explanation: s.explanation || ""
      };
    }
    return null;
  }

  // The full correct sentence, blanks filled in — for reveal + pronunciation.
  function fillBlanksText(round) {
    var byId = {};
    (round.blanks || []).forEach(function (b) { byId[b.id] = b.correct; });
    return String(round.sentence).replace(/___(\d+)___/g, function (_, n) {
      return byId[n] != null ? byId[n] : "___";
    });
  }

  // Host board: the sentence with visible numbered gaps, no answers shown.
  function blanksHostNodes(el, sentence) {
    return String(sentence).split(/(___\d+___)/).map(function (part) {
      var m = /^___(\d+)___$/.exec(part);
      if (m) return el("span", { class: "lt-gap", text: "＿＿" });
      return part ? el("span", { text: part }) : document.createTextNode("");
    });
  }

  var blanksAdapter = {
    meta: { name: "Lücken-Text", emoji: "✏️", contentType: "cases" },
    timeLimit: 20000,           // used only as a fallback elapsed cap; no countdown
    supportsTyping: true,       // teacher chooses Tap (word bank) or Type (inline)
    blanks: true,               // routes to the fill-in player + per-blank reveal
    statefulPlayer: true,       // the phone widget builds once per round (no rebuild)
    pickLabel: "Exercise",
    typeLabels: {
      options: ["Tap the words", "Word bank — pick & place"],
      type: ["Type the answers", "Free recall — harder"]
    },
    getTopics: function () {
      var store = window.ContentStore;
      var list = (store && store.exercisesFor) ? store.exercisesFor("cases") : [];
      return list.map(function (e) {
        var n = (e.items || []).length || ((e.accusative || []).length + (e.dative || []).length + (e.genitive || []).length);
        return { id: e.id, name: e.name, emoji: "✏️", english: n + (n === 1 ? " sentence" : " sentences") };
      });
    },
    buildRounds: function (topic) {
      var store = window.ContentStore;
      var e = (store && store.exercise) ? store.exercise("cases", topic && topic.id) : null;
      var C = e || window.CaseData || { items: [] };
      // One flat list of sentences (older content may still be split into the
      // accusative/dative/genitive groups — read those too, for safety).
      var pool = Array.isArray(C.items) && C.items.length ? C.items.slice() : (C.accusative || []).concat(C.dative || []).concat(C.genitive || []);
      var norm = pool.map(normBlankEntry).filter(Boolean);
      return kit().sample(norm, Math.min(10, norm.length)).map(function (s) {
        return {
          type: "blanks",
          sentence: s.sentence,
          blanks: s.blanks,
          wordBank: kit().shuffle(s.wordBank.slice()),
          explanation: s.explanation || ""
        };
      });
    },
    hostContent: function (el, round) {
      var many = (round.blanks || []).length > 1;
      var typing = round.answerMode === "type";
      return el("div", { class: "lt-q" }, [
        el("div", { class: "lt-tag", text: "✏️ Fill in the blank" + (many ? "s" : "") }),
        el("div", { class: "lt-sentence host" }, blanksHostNodes(el, round.sentence)),
        el("div", { class: "lt-hostnote", text: typing
          ? "⌨️ Students type the missing word" + (many ? "s" : "") + " on their phones"
          : "🔤 Students build the sentence from a word bank on their phones" })
      ]);
    },
    // The interactive fill-in widget — self-contained so both Live and the Solo
    // wrapper reuse it. api.submit({ blanks: { id: text } }) once every gap is set.
    playerContent: function (el, round, api) {
      var typing = round.answerMode === "type";
      var order = [];            // blank ids in reading order
      var state = {};            // id -> { value, fromBank, el }
      var bankBtns = [];         // { btn, word, usedBy }
      var submitBtn;

      function refresh() {
        var allFilled = order.length && order.every(function (id) { return state[id].value !== ""; });
        if (submitBtn) submitBtn.disabled = !allFilled;
      }
      function nextEmptyId() {
        for (var k = 0; k < order.length; k++) { if (state[order[k]].value === "") return order[k]; }
        return null;
      }
      function doSubmit() {
        if (submitBtn && submitBtn.disabled) return;
        var answers = {};
        order.forEach(function (id) { answers[id] = state[id].value; });
        api.submit({ blanks: answers });
      }
      function fillSlot(id, word, bankIdx) {
        var st = state[id];
        st.value = word; st.fromBank = (bankIdx == null ? null : bankIdx);
        st.el.textContent = word; st.el.classList.remove("empty"); st.el.classList.add("filled");
        refresh();
      }
      function clearSlot(id) {              // tap mode: return the word to the bank
        var st = state[id];
        if (st.value === "") return;
        var bi = st.fromBank;
        st.value = ""; st.fromBank = null;
        st.el.textContent = "＿＿"; st.el.classList.add("empty"); st.el.classList.remove("filled");
        if (bi != null && bankBtns[bi]) { bankBtns[bi].usedBy = null; bankBtns[bi].btn.classList.remove("used"); bankBtns[bi].btn.disabled = false; }
        refresh();
      }
      function placeWord(bankIdx) {
        var entry = bankBtns[bankIdx];
        if (!entry || entry.usedBy != null) return;
        var id = nextEmptyId();
        if (id == null) return;
        entry.usedBy = id; entry.btn.classList.add("used"); entry.btn.disabled = true;
        fillSlot(id, entry.word, bankIdx);
        try { kit().beep && kit().beep("good"); } catch (e) {}
      }

      var sentEl = el("div", { class: "lt-sentence phone" });
      String(round.sentence).split(/(___\d+___)/).forEach(function (part) {
        var m = /^___(\d+)___$/.exec(part);
        if (m) {
          var id = parseInt(m[1], 10);
          order.push(id);
          state[id] = { value: "", fromBank: null, el: null };
          var slot;
          if (typing) {
            slot = el("input", { class: "lt-input", attrs: { type: "text", size: "6", "aria-label": "blank " + id, autocapitalize: "off", autocomplete: "off", spellcheck: "false", placeholder: "?" } });
            slot.addEventListener("input", function () { state[id].value = slot.value.trim(); refresh(); });
            slot.addEventListener("keydown", function (ev) {
              if (ev.key !== "Enter") return;
              ev.preventDefault();
              var pos = order.indexOf(id);
              if (pos >= 0 && pos < order.length - 1) { try { state[order[pos + 1]].el.focus(); } catch (e) {} }
              else doSubmit();
            });
          } else {
            slot = el("button", { class: "lt-slot empty", attrs: { type: "button" }, text: "＿＿", on: { click: function () { clearSlot(id); } } });
          }
          state[id].el = slot;
          sentEl.appendChild(slot);
        } else if (part) {
          sentEl.appendChild(el("span", { class: "lt-txt", text: part }));
        }
      });

      var children = [sentEl];
      if (typing) {
        children.push(el("div", { class: "lt-typehint", text: "Tap a blank and type the missing word." + (order.length > 1 ? " Enter jumps to the next." : "") }));
        setTimeout(function () { try { state[order[0]].el.focus(); } catch (e) {} }, 60);
      } else {
        var bank = el("div", { class: "lt-bank" });
        kit().shuffle((round.wordBank || []).slice()).forEach(function (w, i) {
          var btn = el("button", { class: "lt-word", attrs: { type: "button" }, text: w, on: { click: function () { placeWord(i); } } });
          bankBtns.push({ btn: btn, word: w, usedBy: null });
          bank.appendChild(btn);
        });
        children.push(bank);
      }
      submitBtn = el("button", { class: "btn primary lt-submit", text: "Submit", attrs: { disabled: "true" }, on: { click: doSubmit } });
      children.push(submitBtn);
      refresh();
      return el("div", { class: "lt-player" }, children);
    },
    // Per-blank partial credit: 0…1000 points scaled by the share of blanks right.
    score: function (round, payload, elapsedMs, timeLimit) {
      var ans = (payload && payload.blanks) || {};
      var blanks = round.blanks || [];
      var total = blanks.length || 1;
      var matched = 0;
      blanks.forEach(function (b) {
        var g = ltNorm(ans[b.id]);
        if (g !== "" && g === ltNorm(b.correct)) matched++;
      });
      return { correct: matched === total, points: Math.round((matched / total) * 1000), matched: matched, total: total };
    },
    correctLabel: function (round) { return fillBlanksText(round); },
    speakOnReveal: function (round) { return fillBlanksText(round); }
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
    pickLabel: "Exercise",
    getTopics: function () {
      var store = window.ContentStore;
      var list = (store && store.exercisesFor) ? store.exercisesFor("compounds") : [];
      return list.map(function (e) {
        var n = (e.items || []).length;
        return { id: e.id, name: e.name, emoji: "🧟", english: n + (n === 1 ? " word" : " words") };
      });
    },
    buildRounds: function (topic) {
      var store = window.ContentStore;
      var e = (store && store.exercise) ? store.exercise("compounds", topic && topic.id) : null;
      var raw = (e && e.items) || window.CompoundData || [];
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

  /* ---- Hör gut zu! (Listen Carefully!): pick OR type the word you heard ----
     The smartboard speaks the word/sentence; the teacher picks Tap (4 options)
     or Type at setup. Type mode is lenient about how it's typed (case,
     punctuation, and ae/oe/ue/ss for ä/ö/ü/ß — most phones can't type those)
     but strict about word CHOICE. It scores by the % of words right and shows
     each phone a word-by-word green/red diff. Same logic for words & sentences. */

  // Lenient normalisation for one word (used only for comparing, not display).
  function typeNorm(w) {
    w = String(w == null ? "" : w).toLowerCase();
    w = w.replace(/[.,!?;:"'“”„«»()¡¿…\-–—]/g, "");
    return w.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").trim();
  }
  function typeWords(s) { return String(s == null ? "" : s).trim().split(/\s+/).filter(Boolean); }
  // Position-sensitive word diff, shared by host scoring and the on-phone result.
  function typeDiff(typed, correct) {
    var t = typeWords(typed), c = typeWords(correct), matched = 0;
    var typedRow = t.map(function (w, i) {
      return { word: w, status: i >= c.length ? "extra" : (typeNorm(w) === typeNorm(c[i]) ? "correct" : "wrong") };
    });
    var correctRow = c.map(function (w, i) {
      if (i < t.length && typeNorm(t[i]) === typeNorm(w)) matched++;
      return { word: w, missing: i >= t.length };
    });
    return { typedRow: typedRow, correctRow: correctRow, matched: matched, total: c.length };
  }

  var listenAdapter = {
    meta: { name: "Hör gut zu!", emoji: "👂", contentType: "listening" },
    timeLimit: 20000,
    pickLabel: "Exercise",
    audioSpeed: true,     // host can choose the playback speed at setup
    supportsTyping: true, // teacher picks Tap or Type at setup
    typeResult: true,     // Type mode uses the per-phone diff flow (see live.js)
    diff: typeDiff,
    typeLabels: {
      options: ["Tap", "Pick the word from four choices"],
      type: ["Type", "Students type exactly what they hear"]
    },
    getTopics: function () {
      var store = window.ContentStore;
      var list = (store && store.exercisesFor) ? store.exercisesFor("listening") : [];
      return list.map(function (e) {
        var n = (e.items || []).length;
        return { id: e.id, name: e.name, emoji: "👂", english: n + (n === 1 ? " prompt" : " prompts") };
      });
    },
    buildRounds: function (topic) {
      var store = window.ContentStore;
      var e = (store && store.exercise) ? store.exercise("listening", topic && topic.id) : null;
      var all = ((e && e.items) || window.ListeningData || [])
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
      // Teacher may replay the clip as many times as she likes — no cap.
      function label() { return round._plays === 0 ? "🔊 Play the audio" : "🔁 Play again"; }
      btn = el("button", {
        class: "btn primary big listen-play",
        on: { click: function () { round._plays++; try { kit().speak(round.word, { rate: round.speed || 1 }); } catch (e) {} btn.innerHTML = label(); } }
      });
      btn.innerHTML = label();
      var typing = round.answerMode === "type";
      return el("div", { class: "live-q" }, [
        el("div", { class: "live-q-tag", text: typing ? "👂 Type what you hear" : "👂 Which one did you hear?" }),
        el("div", { class: "listen-audio" }, [el("div", { class: "listen-emoji", text: "🎧" }), btn]),
        typing
          ? el("div", { class: "listen-typing-note", text: "✍️ Students are typing what they hear on their phones" })
          : el("div", { class: "live-q-options board" }, round.options.map(function (opt, i) {
              return el("div", { class: "live-opt board", attrs: { style: "--c:" + COLORS[i] } }, [
                el("span", { class: "opt-shape", text: SHAPES[i] }),
                el("span", { class: "opt-text", text: opt })
              ]);
            }))
      ]);
    },
    // Tap-mode tiles. Type mode uses a custom screen in live.js (typePlayerScreen).
    playerContent: function (el, round, api) {
      return el("div", { class: "live-q-options phone" }, round.options.map(function (opt, i) {
        return el("button", {
          class: "live-opt phone", attrs: { style: "--c:" + COLORS[i] },
          on: { click: function () { api.submit({ choice: opt }); } }
        }, [el("span", { class: "opt-shape", text: SHAPES[i] }), el("span", { class: "opt-text", text: opt })]);
      }));
    },
    score: function (round, payload, elapsedMs, timeLimit) {
      if (round.answerMode === "type") {
        // Accuracy only (no speed bonus) — % of words right, out of 1000.
        var d = typeDiff((payload && payload.text) || "", round.correct);
        var pct = d.total ? d.matched / d.total : 0;
        return { correct: d.total > 0 && d.matched === d.total, points: Math.round(pct * 1000), matched: d.matched, total: d.total };
      }
      if (!payload || payload.choice !== round.answer) return { correct: false, points: 0 };
      var frac = Math.max(0, 1 - elapsedMs / timeLimit);
      return { correct: true, points: Math.round(500 + 500 * frac) };
    },
    correctLabel: function (round) { return round.correct; },
    speakOnReveal: function (round) { return round.correct; }
  };

  /* ---- Match the Following (was Hör-Paare): tap one tile from each side ----
     UNLIKE every other Live game, this one is INDIVIDUAL: each phone works
     through the same set of pairs at its own pace, with its own shuffled tiles.
     The host shows a live progress bar per student instead of a shared prompt.
     Scoring rewards completeness and speed, and deducts for wrong taps. The
     Live controller (live.js) branches on `match: true` to drive this flow.

     Generalised so EITHER side of a pair is independently one of four tile
     types — text · icon (emoji) · image (url/data-uri) · audio (German text
     spoken on tap). The classic audio↔English content still works unchanged:
     legacy { de, en, emoji } rows normalise to a spoken German tile ↔ an
     English text tile (with the emoji kept as decoration). */

  // Normalise one content "question" into canonical pairs { q, a } where each
  // side is { type, value } (+ optional emoji decoration on a text side). A
  // question may carry BOTH custom-type pairs and simple word rows — they merge,
  // so the manual authoring and the quick word-pair flow coexist in one round.
  function roundPairs(q) {
    var out = [];
    // Manual authoring: the QUESTION picks a left + right type once, then holds
    // a list of entries { left, right } that all share those two types.
    if (q && Array.isArray(q.entries) && q.entries.length) {
      var lt = q.leftType || "text", rt = q.rightType || "text";
      q.entries.forEach(function (en) {
        if (!en) return;
        var lv = String(en.left == null ? "" : en.left).trim();
        var rv = String(en.right == null ? "" : en.right).trim();
        if (lv && rv) out.push({ q: { type: lt, value: lv }, a: { type: rt, value: rv } });
      });
    }
    // Back-compat: the earlier per-pair form { question:{type,value}, answer:… }.
    if (q && Array.isArray(q.pairs)) {
      q.pairs.forEach(function (p) {
        if (!p || !p.question || !p.answer) return;
        var qv = String(p.question.value == null ? "" : p.question.value).trim();
        var av = String(p.answer.value == null ? "" : p.answer.value).trim();
        if (!qv || !av) return;
        out.push({ q: { type: p.question.type || "text", value: qv }, a: { type: p.answer.type || "text", value: av } });
      });
    }
    // Quick word pairs: [{ de, en, emoji }] → spoken German ↔ English text.
    ((q && q.words) || []).forEach(function (w) {
      if (w && w.de && w.en) out.push({ q: { type: "audio", value: w.de }, a: { type: "text", value: w.en, emoji: w.emoji || "" } });
    });
    return out;
  }

  // Shared tile renderer + audio playback, so the Match board, the Solo board and
  // the MCQ boards render the four tile types identically. `side` = { type,
  // value, emoji? }. content() returns just the inner nodes (so callers like the
  // quiz can wrap them in their own tile with a shape/colour badge).
  window.MatchTiles = {
    content: function (el, side) {
      var type = (side && side.type) || "text";
      var value = side && side.value != null ? side.value : "";
      if (type === "audio") return [el("span", { class: "match-ico", text: "🔊" }), el("span", { class: "match-slabel", text: "Tap to hear" })];
      if (type === "icon") return [el("span", { class: "match-icon-big", text: value })];
      if (type === "image") return [el("img", { class: "match-img", attrs: { src: value, alt: "", loading: "lazy" } })];
      var kids = []; // text
      if (side && side.emoji) kids.push(el("span", { class: "match-memoji", text: side.emoji }));
      kids.push(el("span", { class: "match-mtext", text: value }));
      return kids;
    },
    render: function (el, side) {
      return el("button", { class: "match-tile mt-" + ((side && side.type) || "text") }, this.content(el, side));
    },
    isAudio: function (side) { return !!(side && side.type === "audio"); },
    // Play an audio side: a hosted/uploaded file plays as-is; plain German text
    // is spoken via VoiceBox (pre-generated Azure voice, else the device voice).
    play: function (kit, side, rate) {
      var v = side && side.value != null ? String(side.value) : "";
      if (!v) return;
      if (/^(https?:|data:audio|blob:)/i.test(v) || /\.(mp3|ogg|wav|m4a)(\?|$)/i.test(v)) {
        try { var a = new Audio(v); if (rate && rate !== 1) { try { a.playbackRate = rate; } catch (e) {} } a.play().catch(function () {}); return; } catch (e) {}
      }
      try { kit.speak(v, { rate: rate || 1 }); } catch (e) {}
    }
  };

  var hoerpaareAdapter = {
    meta: { name: "Match the Following", emoji: "🔗", contentType: "pairs" },
    timeLimit: 60000, // students self-pace through several pairs at once
    pickLabel: "Exercise",
    match: true,      // individual match flow (see live.js)
    audioSpeed: true, // host can pick the playback speed at setup
    getTopics: function () {
      var store = window.ContentStore;
      var list = (store && store.exercisesFor) ? store.exercisesFor("hoerpaare") : [];
      return list.map(function (e) {
        var n = (e.questions || []).filter(function (q) { return roundPairs(q).length >= 3; }).length;
        return { id: e.id, name: e.name, emoji: e.emoji || "🔗", english: n + (n === 1 ? " round" : " rounds") };
      });
    },
    buildRounds: function (topic) {
      var store = window.ContentStore;
      var e = (store && store.exercise) ? store.exercise("hoerpaare", topic && topic.id) : null;
      var rounds = [];
      ((e && e.questions) || []).forEach(function (q) {
        var pairs = roundPairs(q).slice(0, 6); // up to 6 pairs on screen at once
        if (pairs.length >= 3) rounds.push({ type: "pairs", pairs: pairs });
      });
      return rounds.slice(0, 20);
    },
    // The generic controller never calls these for a match game, but provide
    // gentle fallbacks so nothing breaks if it ever does.
    hostContent: function (el, round) {
      return el("div", { class: "live-q" }, [
        el("div", { class: "live-q-tag", text: "🔗 Match every pair" })
      ]);
    },
    playerContent: function (el, round) {
      return el("div", { class: "live-muted", text: "Loading…" });
    },
    correctLabel: function (round) { return "All " + ((round.pairs || []).length) + " pairs"; },
    speakOnReveal: function () { return null; }
  };

  /* ---- Wahr oder Falsch? (True or False) ----------------------------------
     Two blocks: an OPTIONAL context block and a REQUIRED statement block, each
     independently text / audio / image / icon (rendered by MatchTiles). Students
     tap one of two fixed buttons: Wahr (True) / Falsch (False). The answer is
     kept host-side only (the round doc sent to phones never carries it), so a
     phone can't peek. The schema is Passage-ready: a passage question is the
     same round with context null. Pacing/scoring is the shared timed model. */

  // A host-side render of one block. Visual blocks (text/image/icon) stay on
  // screen; an audio block becomes a labelled, replayable play button. Because
  // VoiceBox.stop()s any playing clip before starting a new one, two audio
  // blocks can never sound at once — the teacher plays context, then statement.
  function tfBlockNode(el, block, cls, label) {
    if (!block) return null;
    if (block.type === "audio") {
      var btn = el("button", {
        class: "btn primary big tf-audio-btn",
        on: { click: function () { try { window.MatchTiles.play(kit(), block, 1); } catch (e) {} } }
      }, [el("span", { class: "tf-audio-ico", text: "🔊" }), el("span", { text: "Play the " + label.toLowerCase() })]);
      return el("div", { class: "tf-block tf-" + cls }, [el("div", { class: "tf-block-lbl", text: label }), btn]);
    }
    return el("div", { class: "tf-block tf-" + cls }, [
      el("div", { class: "tf-block-lbl", text: label }),
      el("div", { class: "tf-block-tile mt-" + block.type }, window.MatchTiles.content(el, block))
    ]);
  }

  var truefalseAdapter = {
    meta: { name: "Wahr oder Falsch?", emoji: "⚖️", contentType: "truefalse" },
    timeLimit: 20000,
    pickLabel: "Exercise",
    truefalse: true,
    getTopics: function () {
      var store = window.ContentStore;
      var list = (store && store.exercisesFor) ? store.exercisesFor("truefalse") : [];
      return list.map(function (e) {
        var n = (e.questions || []).filter(function (q) { return q && q.statement && String((q.statement || {}).value || "").trim(); }).length;
        return { id: e.id, name: e.name, emoji: e.emoji || "⚖️", english: n + (n === 1 ? " statement" : " statements") };
      });
    },
    buildRounds: function (topic) {
      var store = window.ContentStore;
      var e = (store && store.exercise) ? store.exercise("truefalse", topic && topic.id) : null;
      var items = ((e && e.questions) || []).filter(function (q) {
        return q && q.statement && String((q.statement || {}).value || "").trim() !== "";
      });
      return kit().sample(items, Math.min(10, items.length)).map(function (q) {
        var ctx = (q.context && String((q.context || {}).value || "").trim() !== "")
          ? { type: q.context.type || "text", value: String(q.context.value) } : null;
        return {
          type: "truefalse",
          context: ctx,
          statement: { type: (q.statement.type || "text"), value: String(q.statement.value) },
          answer: !!q.answer
        };
      });
    },
    hostContent: function (el, round) {
      var both = round.context && round.context.type === "audio" && round.statement.type === "audio";
      return el("div", { class: "live-q tf-host" }, [
        el("div", { class: "live-q-tag", text: "⚖️ Wahr oder Falsch?" }),
        tfBlockNode(el, round.context, "context", "Context"),
        both ? el("div", { class: "tf-then", text: "then" }) : null,
        tfBlockNode(el, round.statement, "statement", "Statement"),
        el("div", { class: "tf-hostnote", text: "Is this true or false? Students tap Wahr / Falsch on their phones." })
      ]);
    },
    playerContent: function (el, round, api) {
      return el("div", { class: "tf-player" }, [
        el("button", { class: "tf-btn tf-true", on: { click: function () { api.submit({ choice: true }); } } },
          [el("span", { class: "tf-btn-ico", text: "✓" }), el("span", { class: "tf-btn-lbl", text: "Wahr / True" })]),
        el("button", { class: "tf-btn tf-false", on: { click: function () { api.submit({ choice: false }); } } },
          [el("span", { class: "tf-btn-ico", text: "✗" }), el("span", { class: "tf-btn-lbl", text: "Falsch / False" })])
      ]);
    },
    score: function (round, payload, elapsedMs, timeLimit) {
      if (!payload || typeof payload.choice !== "boolean" || payload.choice !== round.answer) return { correct: false, points: 0 };
      var frac = Math.max(0, 1 - elapsedMs / timeLimit);
      return { correct: true, points: Math.round(500 + 500 * frac) };
    },
    correctLabel: function (round) { return round.answer ? "Wahr (True)" : "Falsch (False)"; },
    // Pronounce the statement's German (or the context's) at reveal, when spoken.
    speakOnReveal: function (round) {
      var s = round.statement || {};
      if (s.type === "audio" || s.type === "text") return s.value;
      var c = round.context || {};
      if (c.type === "audio" || c.type === "text") return c.value;
      return null;
    }
  };

  /* ---- Passage (Lese & Hör): an ORCHESTRATOR, not a new question engine ------
     A passage (text or audio, host/projector-only) followed by an ordered list
     of questions, each in one of the EXISTING formats. buildRounds turns each
     question into that format's normal round and tags it with `fmt` (the format's
     LiveGames key). The Live controller reads `fmt` per round and dispatches to
     the right format's hostContent/playerContent/score — reusing them unchanged.
     The passage itself rides only on the in-memory round (r.passage); it is NEVER
     written into the round doc, so it can never reach a student's phone. This
     first pass covers mcq / lucken-text / true-false. */
  function passageRound(pq, passage) {
    if (!pq || typeof pq !== "object") return null;
    var c = pq.content || {};
    var base = { passage: passage };
    if (pq.format === "mcq") {
      var q = mcqSide(c.question, "text");
      var opts = (c.options || []).map(function (o) { return { type: (o && o.type) || "text", value: String((o && o.value) || ""), correct: !!(o && o.correct) }; })
        .filter(function (o) { return o.value !== ""; });
      if (!q.value || opts.length < 2 || !opts.some(function (o) { return o.correct; })) return null;
      return Object.assign(base, { type: "mcq", fmt: "quiz", question: q, options: kit().shuffle(opts.slice(0, 4)) });
    }
    if (pq.format === "lucken-text") {
      var nb = normBlankEntry(c);
      if (!nb) return null;
      return Object.assign(base, { type: "blanks", fmt: "cases", sentence: nb.sentence, blanks: nb.blanks, wordBank: kit().shuffle(nb.wordBank.slice()), explanation: nb.explanation });
    }
    if (pq.format === "true-false") {
      if (!c.statement || String((c.statement || {}).value || "").trim() === "") return null;
      var ctx = (c.context && String((c.context || {}).value || "").trim() !== "") ? { type: c.context.type || "text", value: String(c.context.value) } : null;
      return Object.assign(base, { type: "truefalse", fmt: "truefalse", context: ctx, statement: { type: (c.statement.type || "text"), value: String(c.statement.value) }, answer: !!c.answer });
    }
    return null;
  }
  var passageAdapter = {
    meta: { name: "Lese & Hör", emoji: "📖", contentType: "passage" },
    timeLimit: 20000,
    pickLabel: "Exercise",
    passage: true,               // routes to the passage-first + Show-Passage flow
    audioSpeed: true,            // teacher can pick the AUDIO passage's playback speed
    // Only offer the speed picker when the chosen exercise's passage is audio —
    // a text passage isn't played, so speed is meaningless there.
    wantsSpeed: function (topic) {
      var store = window.ContentStore;
      var e = (store && store.exercise) ? store.exercise("passage", topic && topic.id) : null;
      return !!(e && e.passage && e.passage.type === "audio");
    },
    getTopics: function () {
      var store = window.ContentStore;
      var list = (store && store.exercisesFor) ? store.exercisesFor("passage") : [];
      return list.map(function (e) {
        var n = (e.questions || []).length;
        return { id: e.id, name: e.name, emoji: e.emoji || "📖", english: ((e.passage && e.passage.type === "audio") ? "🎧 " : "📄 ") + n + (n === 1 ? " question" : " questions") };
      });
    },
    buildRounds: function (topic) {
      var store = window.ContentStore;
      var e = (store && store.exercise) ? store.exercise("passage", topic && topic.id) : null;
      var passage = (e && e.passage && String((e.passage || {}).value || "").trim() !== "")
        ? { type: e.passage.type === "audio" ? "audio" : "text", value: String(e.passage.value) } : null;
      var rounds = [];
      ((e && e.questions) || []).forEach(function (pq) {
        var r = passageRound(pq, passage);
        if (r) rounds.push(r);
      });
      return rounds.slice(0, 20);
    }
  };

  window.LiveGames = {
    quiz: choiceAdapter({ name: "Quiz-Blitz", emoji: "🎯", contentType: "vocab" }),
    passage: passageAdapter,
    truefalse: truefalseAdapter,
    memory: choiceAdapter({ name: "Memory Match", emoji: "🧩", contentType: "vocab" }),
    cases: blanksAdapter,
    wortmonster: compoundAdapter,
    listen: listenAdapter,
    hoerpaare: hoerpaareAdapter
  };
})();
