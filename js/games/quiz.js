/* =====================================================================
   GAME: Quiz-Blitz  (Kahoot-style multiple choice — a general MCQ)
   A question with 4 answer options and a timer. Right answer = points +
   streak bonus; faster = more. The question AND each option can be text,
   audio, image or icon (via MatchTiles) — teachers author the questions.
   ===================================================================== */
(function () {
  App.register({
    id: "quiz",
    name: "Quiz-Blitz",
    emoji: "🎯",
    color: "#ff595e",
    description: "Multiple-choice quiz with a timer. Answer fast for bonus points!",
    contentType: "words",

    mount(stage, api) {
      const { kit, topic, addScore, el } = api;
      const MT = window.MatchTiles;

      // Build the pool of canonical questions:
      //   { q:{type,value}, options:[{type,value,correct}], promptSpeak, revealDe }
      const pool = [];
      // 1) Authored typed MCQ (image/audio/icon/text) if present.
      (topic.mcq || []).forEach((m) => {
        if (!m || !m.question) return;
        const q = { type: m.question.type || "text", value: String(m.question.value || "") };
        const options = (m.options || [])
          .map((o) => ({ type: (o && o.type) || "text", value: String((o && o.value) || ""), correct: !!(o && o.correct) }))
          .filter((o) => o.value !== "");
        if (!q.value || options.length < 2 || !options.some((o) => o.correct)) return;
        const audioCorrect = options.filter((o) => o.correct && o.type === "audio")[0];
        pool.push({ q, options: kit.shuffle(options.slice(0, 4)), promptSpeak: false, revealDe: q.type === "audio" ? q.value : (audioCorrect ? audioCorrect.value : null) });
      });
      // 2) Quick auto-generate from vocab words (both directions, as before).
      const words = (topic.words || []).filter((w) => w.de && w.en);
      const room = Math.max(0, 8 - pool.length);
      const sampled = kit.sample(words, Math.min(room, words.length));
      sampled.forEach((w, i) => {
        const g2e = i % 2 === 0; // ask German→English, then English→German, …
        const prompt = g2e ? w.de : w.en;
        const answer = g2e ? w.en : w.de;
        const others = words.filter((x) => (g2e ? x.en : x.de) !== answer);
        const distract = kit.sample(others, 3).map((x) => (g2e ? x.en : x.de));
        const options = kit.shuffle(
          [{ type: "text", value: answer, correct: true }].concat(distract.map((d) => ({ type: "text", value: d, correct: false })))
        );
        pool.push({ q: { type: "text", value: prompt }, options, promptSpeak: g2e, revealDe: w.de, emoji: w.emoji || "" });
      });

      if (!pool.length) {
        kit.notice(stage, "No content yet", "Add words (or MCQ questions) to this topic via ⚙️ Manage content.", api);
        return;
      }

      const TOTAL = pool.length;
      let index = 0, correct = 0, streak = 0, timer = null, timeLeft = 0, locked = false;

      const wrap = el("div", { class: "quiz" });
      stage.appendChild(wrap);

      function questionNode(q, promptSpeak) {
        if (q.type === "text") {
          return el("div", { class: "quiz-word" }, [document.createTextNode(q.value + " "), promptSpeak ? kit.speakerButton(q.value) : null]);
        }
        if (q.type === "audio") {
          return el("div", { class: "quiz-audio" }, [el("button", { class: "btn primary big", html: "🔊 Play the audio", on: { click: () => { try { MT.play(kit, q); } catch (e) {} } } })]);
        }
        if (q.type === "image") return el("div", { class: "quiz-media" }, [el("img", { class: "mcq-q-img", attrs: { src: q.value, alt: "" } })]);
        return el("div", { class: "quiz-media" }, [el("span", { class: "mcq-q-icon", text: q.value })]); // icon
      }

      function render() {
        clearInterval(timer);
        locked = false;
        const item = pool[index];

        wrap.innerHTML = "";
        wrap.appendChild(
          el("div", { class: "quiz-head" }, [
            el("button", { class: "back-link small", html: "← Menu", on: { click: api.exit } }),
            el("div", { class: "quiz-progress", text: `Question ${index + 1} / ${TOTAL}` }),
            el("div", { class: "quiz-streak", text: streak > 1 ? `🔥 ${streak} streak` : "" })
          ])
        );
        wrap.appendChild(el("div", { class: "timer-bar" }, [el("div", { class: "timer-fill", attrs: { id: "tfill" } })]));
        wrap.appendChild(
          el("div", { class: "quiz-question" }, [
            el("div", { class: "quiz-lang-tag", text: item.q.type === "audio" ? "Listen — which one?" : "What is it?" }),
            questionNode(item.q, item.promptSpeak)
          ])
        );

        const optWrap = el("div", { class: "quiz-options" });
        const shapes = ["🔺", "🔷", "⬤", "⬛"];
        const buttons = [];
        item.options.forEach((opt, i) => {
          const btn = el("button", { class: "quiz-opt mt-" + (opt.type || "text"), attrs: { style: `--i:${i}` } },
            [el("span", { class: "opt-shape", text: shapes[i] })].concat(MT.content(el, opt)));
          let armed = false;
          btn.addEventListener("click", () => {
            if (locked) return;
            if (MT.isAudio(opt)) {
              try { MT.play(kit, opt); } catch (e) {}
              if (!armed) { armed = true; btn.classList.add("armed"); const l = btn.querySelector(".match-slabel"); if (l) l.textContent = "Tap again to choose"; return; }
            }
            choose(opt, item);
          });
          buttons.push({ opt, btn });
          optWrap.appendChild(btn);
        });
        wrap.appendChild(optWrap);
        wrap.__buttons = buttons;

        timeLeft = 100;
        const fill = document.getElementById("tfill");
        timer = setInterval(() => {
          timeLeft -= 1.5;
          if (fill) fill.style.width = Math.max(0, timeLeft) + "%";
          if (timeLeft <= 0) { clearInterval(timer); choose(null, item); }
        }, 60);
      }

      function choose(chosen, item) {
        if (locked) return;
        locked = true;
        clearInterval(timer);
        const wasRight = !!(chosen && chosen.correct);
        (wrap.__buttons || []).forEach((b) => {
          b.btn.disabled = true;
          if (b.opt.correct) b.btn.classList.add("correct");
          else if (b.opt === chosen) b.btn.classList.add("wrong");
        });
        if (wasRight) {
          addScore(10 + Math.round(timeLeft / 10)); // faster = more
          correct++; streak++; kit.beep("good");
        } else {
          streak = 0; kit.beep("bad");
          if (item.revealDe) { try { kit.speak(item.revealDe); } catch (e) {} } // hear the German
        }
        setTimeout(() => { index++; if (index < TOTAL) render(); else finish(); }, 1200);
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
