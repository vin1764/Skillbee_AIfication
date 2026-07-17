/* =====================================================================
   GAME: Vokabel-Quiz  (Kahoot-style multiple choice)
   Show a German word (or English word) and 4 answer options with a
   timer. Right answer = points + streak bonus. Great for the whole class.
   ===================================================================== */
(function () {
  App.register({
    id: "quiz",
    name: "Vocabulary Quiz",
    emoji: "🎯",
    color: "#ff595e",
    description: "Multiple-choice quiz with a timer. Answer fast for bonus points!",
    contentType: "words",

    mount(stage, api) {
      const { kit, topic, addScore, el } = api;
      if (!topic.words || topic.words.length === 0) {
        kit.notice(stage, "No words yet", "Add words to this topic via ⚙️ Manage content.", api);
        return;
      }
      const words = topic.words;
      const TOTAL = Math.min(8, words.length);
      const pool = kit.sample(words, TOTAL);
      let index = 0;
      let correct = 0;
      let streak = 0;
      let timer = null;
      let timeLeft = 0;
      // Ask German -> English half the time, English -> German the other half.
      let askGermanToEnglish = true;

      const wrap = el("div", { class: "quiz" });
      stage.appendChild(wrap);

      function render() {
        clearInterval(timer);
        const q = pool[index];
        askGermanToEnglish = index % 2 === 0;
        const prompt = askGermanToEnglish ? q.de : q.en;
        const answer = askGermanToEnglish ? q.en : q.de;

        // Build 3 wrong options from the same topic.
        const others = words.filter((w) => (askGermanToEnglish ? w.en : w.de) !== answer);
        const distractors = kit.sample(others, 3).map((w) => (askGermanToEnglish ? w.en : w.de));
        const options = kit.shuffle([answer, ...distractors]);

        wrap.innerHTML = "";
        wrap.appendChild(
          el("div", { class: "quiz-head" }, [
            el("button", { class: "back-link small", html: "← Menu", on: { click: api.exit } }),
            el("div", { class: "quiz-progress", text: `Question ${index + 1} / ${TOTAL}` }),
            el("div", { class: "quiz-streak", text: streak > 1 ? `🔥 ${streak} streak` : "" })
          ])
        );

        const bar = el("div", { class: "timer-bar" }, [el("div", { class: "timer-fill", attrs: { id: "tfill" } })]);
        wrap.appendChild(bar);

        wrap.appendChild(
          el("div", { class: "quiz-question" }, [
            el("div", { class: "quiz-lang-tag", text: askGermanToEnglish ? "What does this mean?" : "What's the German word?" }),
            el("div", { class: "quiz-word" }, [
              document.createTextNode(prompt + " "),
              askGermanToEnglish ? kit.speakerButton(q.de) : null
            ]),
            q.emoji ? el("div", { class: "quiz-emoji", text: q.emoji }) : null
          ])
        );

        const optWrap = el("div", { class: "quiz-options" });
        const shapes = ["🔺", "🔷", "⬤", "⬛"];
        options.forEach((opt, i) => {
          optWrap.appendChild(
            el("button", {
              class: "quiz-opt",
              attrs: { style: `--i:${i}` },
              on: { click: (e) => choose(e.currentTarget, opt, answer, q) }
            }, [
              el("span", { class: "opt-shape", text: shapes[i] }),
              el("span", { class: "opt-text", text: opt })
            ])
          );
        });
        wrap.appendChild(optWrap);

        // start timer
        timeLeft = 100;
        const fill = document.getElementById("tfill");
        timer = setInterval(() => {
          timeLeft -= 1.5;
          if (fill) fill.style.width = Math.max(0, timeLeft) + "%";
          if (timeLeft <= 0) {
            clearInterval(timer);
            reveal(null, answer, q);
          }
        }, 60);
      }

      function choose(btn, opt, answer, q) {
        clearInterval(timer);
        reveal(btn, answer, q, opt);
      }

      function reveal(btn, answer, q, chosen) {
        const buttons = wrap.querySelectorAll(".quiz-opt");
        buttons.forEach((b) => {
          b.disabled = true;
          const txt = b.querySelector(".opt-text").textContent;
          if (txt === answer) b.classList.add("correct");
          else if (b === btn) b.classList.add("wrong");
        });

        const wasRight = chosen === answer;
        if (wasRight) {
          const bonus = Math.round(timeLeft / 10); // faster = more
          const points = 10 + bonus;
          correct++;
          streak++;
          addScore(points);
          kit.beep("good");
        } else {
          streak = 0;
          kit.beep("bad");
          // Speak the correct German word so students hear it.
          kit.speak(q.de);
        }

        setTimeout(() => {
          index++;
          if (index < TOTAL) render();
          else finish();
        }, 1200);
      }

      function finish() {
        clearInterval(timer);
        const pct = Math.round((correct / TOTAL) * 100);
        if (pct >= 60) kit.confetti();
        kit.beep(pct >= 60 ? "win" : "bad");
        wrap.innerHTML = "";
        wrap.appendChild(
          el("div", { class: "result-card" }, [
            el("div", { class: "result-emoji", text: pct >= 80 ? "🏆" : pct >= 60 ? "🎉" : "💪" }),
            el("h2", { text: pct >= 60 ? "Well done!" : "Keep practising!" }),
            el("p", { class: "result-score", html: `<b>${correct}</b> of <b>${TOTAL}</b> correct · ${pct}%` }),
            el("div", { class: "result-actions" }, [
              el("button", { class: "btn primary", text: "Play again", on: { click: api.restart } }),
              el("button", { class: "btn", text: "Other topic", on: { click: api.backToTopics } }),
              el("button", { class: "btn ghost", text: "Menu", on: { click: api.exit } })
            ])
          ])
        );
      }

      render();
    }
  });
})();
