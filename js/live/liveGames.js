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

  var casesAdapter = {
    meta: { name: "Fall-Detektiv", emoji: "🕵️", contentType: "cases" },
    timeLimit: 20000,
    // The "topics" for this game are the three difficulty levels.
    getTopics: function () {
      return [
        { id: "l1", name: "Level 1", english: "Accusative", emoji: "1️⃣", level: 1 },
        { id: "l2", name: "Level 2", english: "+ Dative", emoji: "2️⃣", level: 2 },
        { id: "l3", name: "Level 3", english: "+ Genitive", emoji: "3️⃣", level: 3 }
      ];
    },
    buildRounds: function (topic) {
      var C = window.CaseData || { accusative: [], dative: [], genitive: [] };
      var pool = C.accusative.slice();
      if (topic.level >= 2) pool = pool.concat(C.dative);
      if (topic.level >= 3) pool = pool.concat(C.genitive);
      return kit().sample(pool, Math.min(10, pool.length)).map(function (s) {
        return {
          type: "cases", sentence: s.sentence, blank: s.blank, clueWord: s.clueWord,
          options: kit().shuffle([s.correct].concat(s.distractors)),
          answer: s.correct, correct: s.correct, explanation: s.explanation
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
      return el("div", { class: "cases-player" }, [
        el("div", { class: "cases-sentence phone" }, renderSentence(el, round.sentence, round.clueWord, false)),
        el("div", { class: "live-q-options phone" }, round.options.map(function (opt, i) {
          return el("button", {
            class: "live-opt phone", attrs: { style: "--c:" + COLORS[i] },
            on: { click: function () { api.submit({ choice: opt }); } }
          }, [el("span", { class: "opt-shape", text: SHAPES[i] }), el("span", { class: "opt-text", text: opt })]);
        }))
      ]);
    },
    score: function (round, payload, elapsedMs, timeLimit) {
      var correct = payload && payload.choice === round.answer;
      if (!correct) return { correct: false, points: 0 };
      var frac = Math.max(0, 1 - elapsedMs / timeLimit);
      return { correct: true, points: Math.round(500 + 500 * frac) };
    },
    correctLabel: function (round) { return round.correct; },
    speakOnReveal: function (round) { return String(round.sentence).replace("___", round.correct); }
  };

  window.LiveGames = {
    quiz: choiceAdapter({ name: "Vocabulary Quiz", emoji: "🎯", contentType: "vocab" }),
    memory: choiceAdapter({ name: "Memory Match", emoji: "🧩", contentType: "vocab" }),
    cases: casesAdapter
    // Wortmonster adapter comes next
  };
})();
