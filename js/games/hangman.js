/* =====================================================================
   GAME: Galgenmännchen  (Hangman)
   Guess the German word letter by letter. An English hint + emoji is
   shown. 6 wrong guesses allowed. Nice as a warm-up with the class.
   ===================================================================== */
(function () {
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ".split("");
  const MAX_WRONG = 6;
  const STAGES = ["😀", "🙂", "😐", "😟", "😧", "😨", "💀"];

  App.register({
    id: "hangman",
    name: "Galgenmännchen",
    emoji: "🔤",
    color: "#6a4c93",
    description: "Guess the German word letter by letter before the timer runs out.",
    contentType: "words",

    mount(stage, api) {
      const { kit, topic, addScore, el } = api;
      const entry = kit.sample(topic.words, 1)[0];
      // Strip the article (der/die/das) for guessing; keep it for the reveal.
      const full = entry.de;
      const guessWord = full.replace(/^(der|die|das)\s+/i, "");
      const letters = guessWord.toUpperCase().split("");
      const guessed = new Set();
      let wrong = 0;
      let solved = false;

      const wrap = el("div", { class: "hangman" });
      stage.appendChild(wrap);

      function isLetter(ch) {
        return /[A-ZÄÖÜ]/.test(ch);
      }

      function render() {
        wrap.innerHTML = "";
        wrap.appendChild(
          el("div", { class: "game-head" }, [
            el("button", { class: "back-link small", html: "← Menü", on: { click: api.exit } }),
            el("div", { class: "head-title", text: `${topic.emoji} ${topic.name}` }),
            el("div", { class: "moves", text: `${MAX_WRONG - wrong} ❤️` })
          ])
        );

        wrap.appendChild(el("div", { class: "hang-face", text: STAGES[wrong] }));
        wrap.appendChild(
          el("div", { class: "hang-hint" }, [
            document.createTextNode(`Tipp: ${entry.en} `),
            entry.emoji ? el("span", { text: entry.emoji }) : null
          ])
        );

        // The word with blanks
        const wordRow = el("div", { class: "hang-word" });
        letters.forEach((ch) => {
          if (!isLetter(ch)) {
            wordRow.appendChild(el("span", { class: "hang-space", text: ch === " " ? "·" : ch }));
          } else {
            const show = guessed.has(ch) || solved;
            wordRow.appendChild(el("span", { class: "hang-slot" + (show ? " filled" : ""), text: show ? ch : "" }));
          }
        });
        wrap.appendChild(wordRow);

        // Keyboard
        const kb = el("div", { class: "keyboard" });
        ALPHABET.forEach((L) => {
          const used = guessed.has(L);
          const inWord = letters.includes(L);
          kb.appendChild(
            el("button", {
              class: "key" + (used ? (inWord ? " right" : " miss") : ""),
              attrs: used ? { disabled: "true" } : {},
              text: L,
              on: { click: () => guess(L) }
            })
          );
        });
        wrap.appendChild(kb);
      }

      function guess(L) {
        if (guessed.has(L) || solved) return;
        guessed.add(L);
        if (letters.includes(L)) {
          kit.beep("good");
          if (letters.filter(isLetter).every((c) => guessed.has(c))) return win();
        } else {
          wrong++;
          kit.beep("bad");
          if (wrong >= MAX_WRONG) return lose();
        }
        render();
      }

      function win() {
        solved = true;
        const points = 20 + (MAX_WRONG - wrong) * 5;
        addScore(points);
        render();
        kit.confetti();
        kit.beep("win");
        kit.speak(full);
        banner(true, points);
      }

      function lose() {
        solved = true;
        render();
        kit.beep("bad");
        kit.speak(full);
        banner(false, 0);
      }

      function banner(won, points) {
        wrap.appendChild(
          el("div", { class: "result-card inline" }, [
            el("div", { class: "result-emoji", text: won ? "🎉" : "😅" }),
            el("h2", { html: won ? `Richtig! <b>${full}</b>` : `Das Wort war: <b>${full}</b>` }),
            won ? el("p", { class: "result-score", html: `+${points} Punkte` }) : null,
            el("div", { class: "result-actions" }, [
              el("button", { class: "btn primary", text: "Neues Wort", on: { click: api.restart } }),
              el("button", { class: "btn", text: "Anderes Thema", on: { click: api.backToTopics } }),
              el("button", { class: "btn ghost", text: "Menü", on: { click: api.exit } })
            ])
          ])
        );
      }

      // Allow physical keyboard typing too.
      function onKey(e) {
        const L = (e.key || "").toUpperCase();
        if (ALPHABET.includes(L)) guess(L);
      }
      document.addEventListener("keydown", onKey);
      // Clean up the listener when leaving via any button that clears the stage.
      const cleanup = new MutationObserver(() => {
        if (!document.body.contains(wrap)) {
          document.removeEventListener("keydown", onKey);
          cleanup.disconnect();
        }
      });
      cleanup.observe(document.body, { childList: true, subtree: true });

      render();
    }
  });
})();
