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
          round.emoji ? el("div", { class: "live-q-emoji", text: round.emoji }) : null,
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

  window.LiveGames = {
    quiz: choiceAdapter({ name: "Vocabulary Quiz", emoji: "🎯", contentType: "vocab" }),
    memory: choiceAdapter({ name: "Memory Match", emoji: "🧩", contentType: "vocab" })
    // hangman & scramble adapters are added in the next slice
  };
})();
