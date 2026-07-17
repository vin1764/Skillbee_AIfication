/* =====================================================================
   GAME: Satzbau  (Sentence Scramble)
   The words of a German sentence are shuffled. Click them in the right
   order to rebuild the sentence. Teaches word order (great for A1–A2).
   ===================================================================== */
(function () {
  App.register({
    id: "scramble",
    name: "Sentence Scramble",
    emoji: "🧱",
    color: "#3b4de8",
    description: "Put the shuffled German words back into the correct order.",
    contentType: "sentences", // uses SENTENCE_TOPICS instead of words

    mount(stage, api) {
      const { kit, topic, addScore, el } = api;
      if (!topic.sentences || topic.sentences.length === 0) {
        kit.notice(stage, "No sentences yet", "Add sentences to this topic via ⚙️ Manage content.", api);
        return;
      }
      const TOTAL = Math.min(5, topic.sentences.length);
      const pool = kit.sample(topic.sentences, TOTAL);
      let index = 0;
      let solvedCount = 0;

      const wrap = el("div", { class: "scramble" });
      stage.appendChild(wrap);

      function render() {
        const item = pool[index];
        const target = item.de.replace(/\s+/g, " ").trim();
        const targetWords = target.split(" ");
        let build = []; // chosen words (indexes into bank)

        wrap.innerHTML = "";
        wrap.appendChild(
          el("div", { class: "game-head" }, [
            el("button", { class: "back-link small", html: "← Menu", on: { click: api.exit } }),
            el("div", { class: "head-title", text: `Sentence ${index + 1} / ${TOTAL}` }),
            el("div", { class: "moves", text: topic.emoji + " " + topic.name })
          ])
        );

        wrap.appendChild(el("div", { class: "scr-hint", text: `„${item.en}"` }));

        const answerRow = el("div", { class: "scr-answer", attrs: { id: "answer" } });
        wrap.appendChild(answerRow);

        const bankRow = el("div", { class: "scr-bank", attrs: { id: "bank" } });
        wrap.appendChild(bankRow);

        // Build a shuffled bank; reshuffle if it happens to match the answer.
        let order = kit.shuffle(targetWords.map((_, i) => i));
        if (targetWords.length > 1 && order.every((v, i) => v === i)) order = order.reverse();

        const bankButtons = [];
        order.forEach((wordIdx, pos) => {
          const btn = el("button", {
            class: "scr-word",
            attrs: { style: `--i:${pos}` },
            text: targetWords[wordIdx],
            on: { click: () => pick(pos) }
          });
          bankButtons.push(btn);
          bankRow.appendChild(btn);
        });

        const checkBtn = el("button", { class: "btn primary scr-check", text: "Check ✓", attrs: { disabled: "true" }, on: { click: check } });
        const clearBtn = el("button", { class: "btn ghost", text: "Reset", on: { click: render } });
        wrap.appendChild(el("div", { class: "scr-actions" }, [clearBtn, checkBtn]));

        function pick(pos) {
          const btn = bankButtons[pos];
          if (btn.classList.contains("used")) return;
          btn.classList.add("used");
          build.push(pos);
          kit.beep("good");
          renderAnswer();
        }

        function unpick(buildPos) {
          const pos = build[buildPos];
          bankButtons[pos].classList.remove("used");
          build.splice(buildPos, 1);
          renderAnswer();
        }

        function renderAnswer() {
          answerRow.innerHTML = "";
          build.forEach((pos, i) => {
            answerRow.appendChild(
              el("button", { class: "scr-word chosen", text: bankButtons[pos].textContent, on: { click: () => unpick(i) } })
            );
          });
          checkBtn.disabled = build.length !== targetWords.length;
          answerRow.classList.remove("shake", "ok");
        }

        function check() {
          const attempt = build.map((pos) => bankButtons[pos].textContent);
          const correct = attempt.join(" ") === targetWords.join(" ");
          if (correct) {
            answerRow.classList.add("ok");
            addScore(20);
            solvedCount++;
            kit.beep("win");
            kit.speak(target);
            checkBtn.disabled = true;
            setTimeout(next, 1300);
          } else {
            answerRow.classList.add("shake");
            kit.beep("bad");
          }
        }
      }

      function next() {
        index++;
        if (index < TOTAL) render();
        else finish();
      }

      function finish() {
        kit.confetti();
        kit.beep("win");
        wrap.innerHTML = "";
        wrap.appendChild(
          el("div", { class: "result-card" }, [
            el("div", { class: "result-emoji", text: "🏗️" }),
            el("h2", { text: "All sentences built!" }),
            el("p", { class: "result-score", html: `<b>${solvedCount}</b> of <b>${TOTAL}</b> sentences` }),
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
