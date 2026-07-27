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
      const V = window.ContentValidator;
      const pool = [];
      // Authored typed MCQ only (image/audio/icon/text). Quiz-Blitz plays ONLY the
      // questions a teacher writes — it never auto-generates from vocabulary words.
      // Playability (question + ≥2 options + a correct one) is decided by the shared
      // validator, so the count on the menu always matches what actually plays.
      (topic.mcq || []).forEach((m) => {
        if (V.reason("quiz", m)) return;
        const q = { type: m.question.type || "text", value: String(m.question.value || "") };
        const options = V.mcqPlayOptions(
          (m.options || [])
            .map((o) => ({ type: (o && o.type) || "text", value: String((o && o.value) || ""), correct: !!(o && o.correct) }))
            .filter((o) => o.value.trim() !== "")
        );
        const audioCorrect = options.filter((o) => o.correct && o.type === "audio")[0];
        pool.push({ q, options: kit.shuffle(options), promptSpeak: false, revealDe: q.type === "audio" ? q.value : (audioCorrect ? audioCorrect.value : null) });
      });

      if (!pool.length) {
        kit.notice(stage, "No questions yet", "Add multiple-choice questions to this topic via ⚙️ Manage content.", api);
        return;
      }

      const TOTAL = pool.length;
      let index = 0, correct = 0, streak = 0, timer = null, timeLeft = 0, locked = false;
      let advanceTimer = null, dead = false; // dead = the screen was torn down; stop everything

      const wrap = el("div", { class: "quiz" });
      stage.appendChild(wrap);

      // Leaving the game (Back, ← Menu, restart, any navigation) tears the round
      // down: kill the countdown AND the pending "next question" timeout so the
      // detached game can't beep, speak, re-render, or throw confetti afterward.
      if (api.onCleanup) api.onCleanup(function () { dead = true; clearInterval(timer); clearTimeout(advanceTimer); });

      function questionNode(q, promptSpeak, onListen) {
        if (q.type === "text") {
          return el("div", { class: "quiz-word" }, [document.createTextNode(q.value + " "), promptSpeak ? kit.speakerButton(q.value) : null]);
        }
        if (q.type === "audio") {
          return el("div", { class: "quiz-audio" }, [el("button", { class: "btn primary big", html: "🔊 Play the audio", on: { click: () => { if (onListen) onListen(); try { MT.play(kit, q); } catch (e) {} } } })]);
        }
        if (q.type === "image") return el("div", { class: "quiz-media" }, [el("img", { class: "mcq-q-img", attrs: { src: q.value, alt: "" } })]);
        return el("div", { class: "quiz-media" }, [el("span", { class: "mcq-q-icon", text: q.value })]); // icon
      }

      function render() {
        if (dead) return; // torn down — never rebuild on a detached stage
        clearInterval(timer);
        locked = false;
        const item = pool[index];
        // Listening needs time: when the question or any option is audio, the
        // countdown only begins at the FIRST listen (until then the bar sits
        // full — no pressure) and then drains at half speed (~8s instead of
        // ~4s). Plain text/image/icon rounds keep the snappy Kahoot pace.
        const hasAudio = item.q.type === "audio" || item.options.some((o) => o.type === "audio");
        let clockArmed = !hasAudio;
        const armClock = () => { clockArmed = true; };

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
            questionNode(item.q, item.promptSpeak, armClock)
          ])
        );

        const optWrap = el("div", { class: "quiz-options" });
        const shapes = ["🔺", "🔷", "⬤", "⬛"];
        const buttons = [];
        item.options.forEach((opt, i) => {
          let btn;
          if (MT.isAudio(opt)) {
            // Audio option: playing and choosing are SEPARATE controls, so the
            // student can replay freely; ✓ Choose unlocks after the first listen.
            const playLbl = el("span", { class: "match-slabel", text: "Hear it" });
            const playBtn = el("button", { class: "mcq-audio-play", attrs: { type: "button", "aria-label": `Play option ${i + 1}` } },
              [el("span", { class: "match-ico", text: "🔊" }), playLbl]);
            const chooseBtn = el("button", { class: "mcq-audio-choose", attrs: { type: "button", disabled: "true" }, text: "Listen first" });
            playBtn.addEventListener("click", () => {
              if (locked) return;
              armClock(); // first listen starts the countdown
              try { MT.play(kit, opt); } catch (e) {}
              playLbl.textContent = "Play again";
              if (chooseBtn.disabled) { chooseBtn.disabled = false; chooseBtn.textContent = "✓ Choose"; }
            });
            chooseBtn.addEventListener("click", () => { if (!locked && !chooseBtn.disabled) choose(opt, item); });
            btn = el("div", { class: "quiz-opt mt-audio split", attrs: { style: `--i:${i}` } },
              [el("span", { class: "opt-shape", text: shapes[i] }), playBtn, chooseBtn]);
          } else {
            btn = el("button", { class: "quiz-opt mt-" + (opt.type || "text"), attrs: { style: `--i:${i}` } },
              [el("span", { class: "opt-shape", text: shapes[i] })].concat(MT.content(el, opt)));
            btn.addEventListener("click", () => { if (!locked) choose(opt, item); });
          }
          buttons.push({ opt, btn });
          optWrap.appendChild(btn);
        });
        wrap.appendChild(optWrap);
        wrap.__buttons = buttons;

        timeLeft = 100;
        const drain = hasAudio ? 0.75 : 1.5; // audio rounds get double the window
        const fill = document.getElementById("tfill");
        timer = setInterval(() => {
          if (!clockArmed) return; // audio round, nothing played yet — no countdown
          timeLeft -= drain;
          if (fill) fill.style.width = Math.max(0, timeLeft) + "%";
          if (timeLeft <= 0) { clearInterval(timer); choose(null, item); }
        }, 60);
      }

      function choose(chosen, item) {
        if (locked || dead) return;
        locked = true;
        clearInterval(timer);
        const wasRight = !!(chosen && chosen.correct);
        (wrap.__buttons || []).forEach((b) => {
          b.btn.disabled = true; // no-op on a split (div) tile…
          // …so also lock the split tile's inner play/choose buttons.
          Array.prototype.forEach.call(b.btn.querySelectorAll("button"), (x) => { x.disabled = true; });
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
        advanceTimer = setTimeout(() => { if (dead) return; index++; if (index < TOTAL) render(); else finish(); }, 1200);
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
