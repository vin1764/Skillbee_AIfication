/* =====================================================================
   GAME: Memory  (Paare finden)
   Flip cards to match a German word with its English meaning (with a
   helpful emoji). Fewer moves = more points. Good for small groups/pairs.
   ===================================================================== */
(function () {
  App.register({
    id: "memory",
    name: "Memory",
    emoji: "🧩",
    color: "#8ac926",
    description: "Flip cards to match German words with their meaning.",
    contentType: "words",

    mount(stage, api) {
      const { kit, topic, addScore, el } = api;
      const PAIRS = Math.min(6, topic.words.length);
      const chosen = kit.sample(topic.words, PAIRS);

      // Build two cards per word: a German side and an English (+emoji) side.
      let cards = [];
      chosen.forEach((w, i) => {
        cards.push({ pair: i, face: w.de, kind: "de", speak: w.de });
        cards.push({ pair: i, face: (w.emoji ? w.emoji + " " : "") + w.en, kind: "en", speak: w.de });
      });
      cards = kit.shuffle(cards);

      let flipped = [];
      let matched = 0;
      let moves = 0;
      let busy = false;

      const wrap = el("div", { class: "memory" });
      stage.appendChild(wrap);

      wrap.appendChild(
        el("div", { class: "game-head" }, [
          el("button", { class: "back-link small", html: "← Menü", on: { click: api.exit } }),
          el("div", { class: "head-title", text: `${topic.emoji} ${topic.name}` }),
          el("div", { class: "moves", attrs: { id: "moves" }, text: "0 Züge" })
        ])
      );

      const board = el("div", { class: "memory-board", attrs: { style: `--cols:${cards.length > 8 ? 4 : 3}` } });
      wrap.appendChild(board);

      cards.forEach((card, idx) => {
        const node = el("button", {
          class: "mem-card",
          attrs: { "data-idx": idx },
          on: { click: () => flip(idx, node) }
        }, [
          el("div", { class: "mem-inner" }, [
            el("div", { class: "mem-front" }, [
              el("img", {
                class: "mem-logo",
                attrs: { src: window.SkillbeeBrand ? window.SkillbeeBrand.favicon : "", alt: "" }
              })
            ]),
            el("div", { class: `mem-back ${card.kind}`, text: card.face })
          ])
        ]);
        board.appendChild(node);
        card.node = node;
      });

      function flip(idx, node) {
        if (busy || node.classList.contains("flipped") || node.classList.contains("done")) return;
        node.classList.add("flipped");
        flipped.push(idx);
        if (flipped.length === 2) {
          busy = true;
          moves++;
          document.getElementById("moves").textContent = moves + (moves === 1 ? " Zug" : " Züge");
          const [a, b] = flipped;
          if (cards[a].pair === cards[b].pair) {
            kit.beep("good");
            kit.speak(cards[a].speak);
            setTimeout(() => {
              cards[a].node.classList.add("done");
              cards[b].node.classList.add("done");
              flipped = [];
              busy = false;
              matched++;
              addScore(15);
              if (matched === PAIRS) finish();
            }, 550);
          } else {
            kit.beep("bad");
            setTimeout(() => {
              cards[a].node.classList.remove("flipped");
              cards[b].node.classList.remove("flipped");
              flipped = [];
              busy = false;
            }, 900);
          }
        }
      }

      function finish() {
        // Bonus for efficiency: perfect game is `PAIRS` moves.
        const bonus = Math.max(0, (PAIRS * 2 - moves)) * 5;
        if (bonus > 0) addScore(bonus);
        kit.confetti();
        kit.beep("win");
        setTimeout(() => {
          wrap.innerHTML = "";
          wrap.appendChild(
            el("div", { class: "result-card" }, [
              el("div", { class: "result-emoji", text: "🎉" }),
              el("h2", { text: "Alle Paare gefunden!" }),
              el("p", { class: "result-score", html: `In <b>${moves}</b> Zügen · Bonus: <b>${bonus}</b>` }),
              el("div", { class: "result-actions" }, [
                el("button", { class: "btn primary", text: "Nochmal", on: { click: api.restart } }),
                el("button", { class: "btn", text: "Anderes Thema", on: { click: api.backToTopics } }),
                el("button", { class: "btn ghost", text: "Menü", on: { click: api.exit } })
              ])
            ])
          );
        }, 700);
      }
    }
  });
})();
