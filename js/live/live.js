/* =====================================================================
   LiveMode — Live Class Mode controller (host + player).
   Renders into the app's #screen container. Talks to Firestore via
   LiveDB and to per-game adapters via LiveGames. The correct answer is
   NEVER written to the player-readable session doc during a question, so
   phones can't peek — the host holds the answers and scores each round.
   ===================================================================== */
window.LiveMode = (function () {
  var C, el, kit, store, goBack;
  var unsubs = [];

  function stop() {
    // Silence any audio when leaving/changing a Live screen (host listen clip,
    // reveal pronunciation, player match audio) — it must not outlive the screen.
    try { if (window.VoiceBox && window.VoiceBox.stop) window.VoiceBox.stop(); } catch (e) {}
    unsubs.forEach(function (u) { try { u(); } catch (e) {} });
    unsubs = [];
  }
  function track(u) { unsubs.push(u); return u; }
  function show(node) { C.innerHTML = ""; C.appendChild(node); }
  function screen(cls, children) { return el("div", { class: "live " + (cls || "") }, children); }

  // Rebuild a sentence with the blank filled in (article highlighted) — used on
  // the reveal so students see the full, correct sentence.
  function filledSentence(sentence, article) {
    return String(sentence).split(/(\s+)/).map(function (tok) {
      if (/^\s+$/.test(tok)) return document.createTextNode(tok);
      if (tok.indexOf("___") >= 0) return el("span", { class: "rs-fill", text: article });
      return el("span", { text: tok });
    });
  }

  // Lücken-Text reveal: the sentence with every numbered blank replaced by its
  // correct word, each highlighted. `filled` maps blank id -> shown text/class.
  function blanksFilled(sentence, filled) {
    return String(sentence).split(/(___\d+___)/).map(function (part) {
      var m = /^___(\d+)___$/.exec(part);
      if (m) {
        var f = filled(parseInt(m[1], 10));
        return el("span", { class: f.cls, text: f.text });
      }
      return part ? el("span", { text: part }) : document.createTextNode("");
    });
  }

  /* ---------- entry ---------- */
  function start(container, api) {
    C = container; el = api.el; kit = api.kit; store = api.store; goBack = api.back;
    stop();
    if (window.App) window.App.setAdminVisible(false); // admin is teacher-only, never in Live
    if (!window.LiveDB || !window.LiveDB.available()) return offlineNotice();
    landing();
  }

  function offlineNotice() {
    show(screen("live-center", [
      el("div", { class: "live-card" }, [
        el("div", { class: "live-big-emoji", text: "🌐" }),
        el("h2", { text: "Live Class Mode needs the internet" }),
        el("p", { class: "live-sub", text: "Open the app from its online link (GitHub Pages) to host or join a live game. Solo / Offline mode works here without internet." }),
        el("button", { class: "btn primary", text: "← Back", on: { click: goBack } })
      ])
    ]));
  }

  function landing() {
    stop();
    window.AppNav.set(function () { goBack(); }, null);
    show(screen("live-center", [
      el("button", { class: "back-link", html: "← Back", on: { click: goBack } }),
      el("div", { class: "live-big-emoji", text: "📡" }),
      el("h2", { class: "live-title", text: "Live Class Mode" }),
      el("p", { class: "live-sub", text: "Play together in real time — one screen hosts, phones join with a room code." }),
      el("div", { class: "live-choice" }, [
        el("button", { class: "live-choice-card host", on: { click: function () { if (window.TeacherGate) window.TeacherGate.require(hostRosters); else hostRosters(); } } }, [
          el("div", { class: "live-big-emoji", text: "🖥️" }),
          el("div", { class: "live-choice-name", text: "Host a class" }),
          el("div", { class: "live-choice-sub", text: "Teacher — show on the smartboard" })
        ]),
        el("button", { class: "live-choice-card join", on: { click: function () { playerJoin(); } } }, [
          el("div", { class: "live-big-emoji", text: "📱" }),
          el("div", { class: "live-choice-name", text: "Join a game" }),
          el("div", { class: "live-choice-sub", text: "Student — enter the room code" })
        ])
      ])
    ]));
  }

  /* ============================================================
     ROSTERS  (teacher-created, reusable class lists)
     ============================================================ */
  var RKEY = "skillbee_live_rosters";
  function myRosterIds() {
    try { return JSON.parse(localStorage.getItem(RKEY) || "[]"); } catch (e) { return []; }
  }
  function rememberRoster(id) {
    var ids = myRosterIds();
    if (ids.indexOf(id) < 0) { ids.push(id); try { localStorage.setItem(RKEY, JSON.stringify(ids)); } catch (e) {} }
  }
  function forgetRoster(id) {
    try { localStorage.setItem(RKEY, JSON.stringify(myRosterIds().filter(function (x) { return x !== id; }))); } catch (e) {}
  }
  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";
  }
  function studentsFromText(text) {
    var seen = {}, out = [];
    text.split("\n").forEach(function (line) {
      var name = line.trim();
      if (!name) return;
      var base = slug(name), id = base, n = 2;
      while (seen[id]) id = base + "-" + n++;
      seen[id] = true;
      out.push({ id: id, name: name });
    });
    return out;
  }

  function hostRosters() {
    stop();
    window.AppNav.set(landing, null);
    var ids = myRosterIds();
    var wrap = screen("", [
      el("button", { class: "back-link", html: "← Back", on: { click: landing } }),
      el("h2", { class: "live-title", text: "Choose a class" }),
      el("p", { class: "live-sub", text: "A class is a reusable list of student names." })
    ]);
    var list = el("div", { class: "roster-list" });
    wrap.appendChild(list);
    wrap.appendChild(el("div", { class: "roster-toolbar" }, [
      el("button", { class: "btn primary", html: "+ New class", on: { click: function () { rosterEditor(null); } } }),
      el("button", { class: "btn ghost", html: "⚙️ Manage content", attrs: { title: "Edit words & sentences (teacher only)" }, on: { click: function () { if (window.App) window.App.showAdmin(hostRosters); } } })
    ]));
    show(wrap);

    if (!ids.length) {
      list.appendChild(el("p", { class: "live-muted", text: "No classes yet — create one to get started." }));
      return;
    }
    ids.forEach(function (id) {
      var row = el("div", { class: "roster-row" }, [el("div", { class: "live-muted", text: "Loading…" })]);
      list.appendChild(row);
      window.LiveDB.getRoster(id).then(function (r) {
        row.innerHTML = "";
        if (!r) { forgetRoster(id); row.remove(); return; }
        row.appendChild(el("button", { class: "roster-main", on: { click: function () { hostSetup(r); } } }, [
          el("div", { class: "roster-name", text: r.name }),
          el("div", { class: "roster-count", text: (r.students || []).length + " students" })
        ]));
        row.appendChild(el("button", { class: "roster-edit", html: "✎", attrs: { title: "Edit" }, on: { click: function () { rosterEditor(r); } } }));
      }).catch(function () { row.remove(); });
    });
  }

  function rosterEditor(existing) {
    stop();
    window.AppNav.set(hostRosters, null);
    var nameInput = el("input", { class: "adm-input", attrs: { type: "text", placeholder: "Class name (e.g. Period 3 German)", value: existing ? existing.name : "" } });
    var namesArea = el("textarea", {
      class: "roster-textarea",
      attrs: { placeholder: "One student name per line…\nAnna\nBen\nClara" }
    });
    if (existing) namesArea.value = (existing.students || []).map(function (s) { return s.name; }).join("\n");

    function save() {
      var name = nameInput.value.trim() || "My class";
      var students = studentsFromText(namesArea.value);
      if (!students.length) { alert("Add at least one student name."); return; }
      var p = existing
        ? window.LiveDB.updateRoster(existing.id, { name: name, students: students }).then(function () { return existing.id; })
        : window.LiveDB.createRoster(name, students);
      p.then(function (id) { rememberRoster(id); hostRosters(); }).catch(function (e) { alert("Could not save: " + e.message); });
    }

    var wrap = screen("", [
      el("button", { class: "back-link", html: "← Back", on: { click: hostRosters } }),
      el("h2", { class: "live-title", text: existing ? "Edit class" : "New class" }),
      el("div", { class: "roster-form" }, [
        nameInput,
        el("label", { class: "live-label", text: "Student names" }),
        namesArea,
        el("div", { class: "roster-actions" }, [
          el("button", { class: "btn primary", text: "Save", on: { click: save } }),
          existing ? el("button", {
            class: "btn ghost", text: "Delete class", on: {
              click: function () {
                if (confirm("Delete this class?")) {
                  window.LiveDB.deleteRoster(existing.id).then(function () { forgetRoster(existing.id); hostRosters(); });
                }
              }
            }
          }) : null
        ])
      ])
    ]);
    show(wrap);
  }

  /* ============================================================
     HOST — set up a session
     ============================================================ */
  // Reusable game / topic / answer-mode / scoreboard picker. Used both for the
  // first game of a room and for "play another game" in an existing room.
  // opts: { title, sub, startLabel, back, continueLabel, continueSub, freshSub,
  //         onStart({ gameId, topic, answerMode, persistMode, adapter, rounds }) }
  function gamePicker(opts) {
    stop();
    window.AppNav.set(opts.back, null);
    var gameId = null, topic = null, persistMode = "fresh", answerMode = "options", speed = 1;
    var gameIds = Object.keys(window.LiveGames);
    var SPEEDS = [
      { v: 0.75, label: "Slow", sub: "0.75×" },
      { v: 1, label: "Normal", sub: "1×" },
      { v: 1.25, label: "Fast", sub: "1.25×" },
      { v: 1.5, label: "Faster", sub: "1.5×" }
    ];

    var wrap = screen("", [
      el("button", { class: "back-link", html: "← Back", on: { click: opts.back } }),
      el("h2", { class: "live-title", text: opts.title }),
      el("p", { class: "live-sub", text: opts.sub })
    ]);
    var step = el("div", { class: "host-setup" });
    wrap.appendChild(step);
    show(wrap);

    function renderStep() {
      step.innerHTML = "";
      // 1) game
      step.appendChild(el("div", { class: "live-label", text: "1 · Game" }));
      var gg = el("div", { class: "setup-grid" });
      gameIds.forEach(function (id) {
        var meta = window.LiveGames[id].meta;
        gg.appendChild(el("button", {
          class: "setup-card" + (gameId === id ? " sel" : ""),
          on: { click: function () { gameId = id; topic = null; renderStep(); } }
        }, [el("div", { class: "setup-emoji", text: meta.emoji }), el("div", { text: meta.name })]));
      });
      step.appendChild(gg);

      // 2) topic
      if (gameId) {
        var gAdapter = window.LiveGames[gameId];
        var topics = gAdapter.getTopics ? gAdapter.getTopics() : store.exercisesFor(gameId);
        var pickLabel = gAdapter.pickLabel || "Exercise";
        step.appendChild(el("div", { class: "live-label", text: "2 · " + pickLabel }));
        if (!topics.length) {
          step.appendChild(el("p", { class: "live-muted", text: "This game has no exercises yet. Add one in ⚙️ Manage content." }));
        } else {
          var tg = el("div", { class: "setup-grid" });
          topics.forEach(function (t) {
            tg.appendChild(el("button", {
              class: "setup-card" + (topic && topic.id === t.id ? " sel" : ""),
              on: { click: function () { topic = t; renderStep(); } }
            }, [el("div", { class: "setup-emoji", text: t.emoji }), el("div", { text: t.name }), t.english ? el("div", { class: "setup-sub", text: t.english }) : null]));
          });
          step.appendChild(tg);
        }
      }

      // 3) answer mode / audio speed (per game) + scoreboard + start
      if (gameId && topic) {
        var gAdapter3 = window.LiveGames[gameId];
        var n = 3;
        if (gAdapter3.supportsTyping) {
          var tl = gAdapter3.typeLabels || { options: ["Tap the article", "Multiple choice — faster"], type: ["Type the article", "Free recall — harder"] };
          step.appendChild(el("div", { class: "live-label", text: n + " · How students answer" }));
          step.appendChild(el("div", { class: "setup-modes" }, [
            answerPill("options", tl.options[0], tl.options[1]),
            answerPill("type", tl.type[0], tl.type[1])
          ]));
          n++;
        }
        if (gAdapter3.audioSpeed) {
          step.appendChild(el("div", { class: "live-label", text: n + " · Audio speed" }));
          var speedRow = el("div", { class: "setup-modes" }, SPEEDS.map(function (s) {
            return el("button", {
              class: "mode-pill" + (speed === s.v ? " sel" : ""),
              on: { click: function () { speed = s.v; renderStep(); } }
            }, [el("b", { text: s.label }), el("span", { text: s.sub })]);
          }));
          step.appendChild(speedRow);
          step.appendChild(el("div", { class: "setup-preview" }, [
            el("span", { class: "live-muted", text: "Preview at " + speed + "×:" }),
            el("button", { class: "btn ghost", html: "▶ Word", attrs: { title: "Hear a word at this speed" }, on: { click: function () { preview("word"); } } }),
            el("button", { class: "btn ghost", html: "▶ Sentence", attrs: { title: "Hear a full sentence at this speed" }, on: { click: function () { preview("sentence"); } } })
          ]));
          n++;
        }
        step.appendChild(el("div", { class: "live-label", text: n + " · Scoreboard" }));
        var modeRow = el("div", { class: "setup-modes" }, [
          modeBtn("fresh", "Start fresh", opts.freshSub || "Leaderboard resets to zero"),
          modeBtn("continue", opts.continueLabel || "Continue", opts.continueSub || "Add to this class's running scores")
        ]);
        step.appendChild(modeRow);
        step.appendChild(el("button", { class: "btn primary big", text: opts.startLabel || "Start room ▶", on: { click: doStart } }));
      }

      function answerPill(id, title, sub) {
        return el("button", {
          class: "mode-pill" + (answerMode === id ? " sel" : ""),
          on: { click: function () { answerMode = id; renderStep(); } }
        }, [el("b", { text: title }), el("span", { text: sub })]);
      }

      function modeBtn(id, title, sub) {
        return el("button", {
          class: "mode-pill" + (persistMode === id ? " sel" : ""),
          on: { click: function () { persistMode = id; renderStep(); } }
        }, [el("b", { text: title }), el("span", { text: sub })]);
      }

      // Play a sample WORD or SENTENCE at the selected speed, so the teacher can
      // judge the pace for both short prompts and connected speech. Samples come
      // from the chosen exercise (split by whether they contain a space), with a
      // sensible fallback if the exercise has none of that kind yet.
      function preview(kind) {
        var words = [], sentences = [];
        try {
          var ex = store.exercise && store.exercise(gameId === "listen" ? "listening" : gameId, topic && topic.id);
          var items = ((ex && (ex.items || ex.words)) || []).slice();
          // Hör-Paare keeps its words inside each question — flatten them in too.
          if (ex && Array.isArray(ex.questions)) {
            ex.questions.forEach(function (q) { (q.words || []).forEach(function (w) { items.push(w); }); });
          }
          items.forEach(function (it) {
            var t = it && (it.word || it.de);
            if (!t) return;
            (/\s/.test(String(t).trim()) ? sentences : words).push(t);
          });
        } catch (e) {}
        var pool = kind === "sentence" ? sentences : words;
        var fallback = kind === "sentence" ? "Heute lernen wir zusammen ein bisschen Deutsch." : "Kirche";
        var text = pool.length ? pool[Math.floor(Math.random() * pool.length)] : fallback;
        kit.speak(text, { rate: speed });
      }
    }
    renderStep();

    function doStart() {
      var adapter = window.LiveGames[gameId];
      var rounds = adapter.buildRounds(topic);
      if (!rounds.length) { alert("This topic has no usable content."); return; }
      if (adapter.audioSpeed) rounds.forEach(function (r) { r.speed = speed; });
      opts.onStart({ gameId: gameId, topic: topic, answerMode: answerMode, persistMode: persistMode, adapter: adapter, rounds: rounds, speed: speed });
    }
  }

  function hostSetup(roster) {
    gamePicker({
      title: roster.name,
      sub: "Pick a game and a topic, then start the room.",
      startLabel: "Start room ▶",
      back: hostRosters,
      onStart: function (sel) {
        // Host keeps the full rounds (with answers) in memory only.
        var seed = { scores: {} };
        var afterSeed = function () {
          window.LiveDB.createSession({
            rosterId: roster.id, rosterName: roster.name, students: roster.students,
            gameId: sel.gameId, gameName: sel.adapter.meta.name, topicName: sel.topic.name,
            status: "lobby", questionIndex: -1, totalQuestions: sel.rounds.length,
            round: null, reveal: null, scores: seed.scores, joined: {}, persistMode: sel.persistMode,
            answerMode: sel.answerMode, gameSeq: 0
          }).then(function (code) {
            hostRun(code, sel.adapter, sel.rounds, roster);
          }).catch(function (e) { alert("Could not start: " + e.message); });
        };
        if (sel.persistMode === "continue") {
          window.LiveDB.getLeaderboard(roster.id).then(function (lb) { seed.scores = lb.scores || {}; afterSeed(); });
        } else afterSeed();
      }
    });
  }

  /* ============================================================
     HOST — run the session (lobby → questions → podium)
     ============================================================ */
  function hostRun(code, adapter, rounds, roster) {
    stop();
    // Back closes the room; confirm while a question/reveal is on screen (mid-game).
    window.AppNav.set(function () { closeRoom(); }, function () { return !!document.querySelector(".host-controls, .reveal-answer"); });
    var sess = null;
    var answersUnsub = null;
    var latestAnswers = []; // answers delivered by the live listener for the current question
    var timer = null;
    var TL = adapter.timeLimit || 20000;
    var hostRenderedQ = -1; // host question screen is built once per round; later
                            // answers only update the counter, never rebuild the DOM
    var hostPhase = "lobby"; // "lobby" | "question" | "reveal" | "podium". Once the
                             // teacher reveals, late-arriving answer/progress
                             // snapshots must NOT rebuild the question screen over
                             // the reveal — renderQuestion/renderMatchHost bail
                             // unless we're actually in the question phase.

    // Every write that moves the room forward runs inside a click handler. The
    // Firestore SDK throws SYNCHRONOUSLY on invalid data (e.g. an `undefined`
    // field slipping into a payload) — unguarded, that throw aborts the click
    // handler mid-flight and freezes the host screen (this is exactly how the
    // Reveal button died). Guard the sync throw AND the async rejection: the
    // host screen must always advance; a lost write is re-synced by the next.
    function safeUpdate(data) {
      try {
        var p = window.LiveDB.updateSession(code, data);
        if (p && p.catch) p.catch(function () {});
      } catch (e) {}
    }

    track(window.LiveDB.listenSession(code, function (s) {
      sess = s;
      if (!s) return;
      if (s.status === "lobby") hostLobby();
    }));

    function hostLobby() {
      hostPhase = "lobby";
      var joined = sess.joined || {};
      var names = Object.keys(joined).map(function (id) { return joined[id].name; });
      var chips = el("div", { class: "join-chips" }, names.map(function (n) { return el("span", { class: "join-chip", text: n }); }));
      show(screen("host", [
        el("div", { class: "roomcode-wrap" }, [
          el("div", { class: "roomcode-label", text: "Join at this screen's URL — room code:" }),
          el("div", { class: "roomcode", text: code })
        ]),
        el("div", { class: "join-count", text: names.length + " joined" }),
        chips,
        el("button", { class: "btn primary big", text: "Start game ▶", attrs: names.length ? {} : { disabled: "true" }, on: { click: nextQuestion } }),
        el("button", { class: "back-link small", html: "✕ Close room", on: { click: closeRoom } })
      ]));
    }

    function nextQuestion() {
      var i = (sess.questionIndex == null ? -1 : sess.questionIndex) + 1;
      if (i >= rounds.length) return podium();
      var r = rounds[i];
      // Carry the session's answer mode onto the in-memory round so the host
      // view (hostContent) and scoring (score) both know Tap vs Type.
      r.answerMode = sess.answerMode || "options";
      safeUpdate({
        status: "question", questionIndex: i, reveal: null,
        round: {
          index: i, type: r.type, de: r.de || null, emoji: r.emoji || null,
          // MCQ: send the typed question + options WITHOUT the `correct` flag so a
          // phone can't peek which option wins. Other games keep options as-is
          // (e.g. Hör gut zu!'s tap board sends plain option strings).
          question: (adapter.mcq && r.question) ? r.question : null,
          options: (adapter.mcq && r.options)
            ? r.options.map(function (o) { return { type: o.type, value: o.value }; })
            : (r.options || null),
          sentence: r.sentence || null, blank: r.blank || null, clueWord: r.clueWord || null,
          meaning: r.meaning || null, tiles: r.tiles || null,
          words: r.words || null, pairs: r.pairs || null, speed: r.speed || null,
          answerMode: sess.answerMode || "options",
          // Lücken-Text: phones need the blank ids (to lay out the gaps) and, in
          // tap mode, the shuffled word bank — but NEVER the correct answers, so
          // type mode can't be peeked. The bank naturally contains the answers.
          blanks: (adapter.blanks && r.blanks) ? r.blanks.map(function (b) { return { id: b.id }; }) : null,
          wordBank: (adapter.blanks && sess.answerMode !== "type") ? (r.wordBank || null) : null,
          // Type mode needs the answer on the phone (to diff on submit). Only sent
          // for the type-diff game in type mode — tap mode still hides it.
          correct: (adapter.typeResult && sess.answerMode === "type") ? (r.correct || r.word || null) : null,
          startedAt: window.LiveDB.serverTs()
        }
      });
      watchAnswers(i, r);
    }

    function watchAnswers(i, r) {
      hostPhase = "question"; // we're now taking answers for round i
      if (answersUnsub) { answersUnsub(); answersUnsub = null; }
      var answered = 0;
      latestAnswers = []; // fresh question
      answersUnsub = window.LiveDB.listenAnswers(code, i, function (arr) {
        latestAnswers = arr; // keep the newest set so reveal needn't re-query
        answered = arr.length;
        renderQuestion(i, r, answered);
        var joinedN = Object.keys(sess.joined || {}).length || sess.students.length;
        if (answered >= joinedN && joinedN > 0) { /* everyone answered — teacher may reveal */ }
      });
      // cosmetic countdown then auto-enable reveal
      clearTimeout(timer);
      timer = setTimeout(function () {}, TL);
      renderQuestion(i, r, 0);
    }

    function renderQuestion(i, r, answered) {
      // A late answer snapshot can still fire after the teacher reveals (the
      // Firestore listener isn't cancelled instantly). Never rebuild the question
      // screen unless we're actually in the question phase — otherwise we'd tear
      // the reveal screen down and drop the teacher back onto the question, which
      // looked like "the Reveal button stopped working".
      if (hostPhase !== "question") return;
      if (adapter.match) return renderMatchHost(i, r);
      var joinedN = Object.keys(sess.joined || {}).length || (sess.students || []).length;
      // Build the question screen once per round; on every later answer just
      // update the "X of Y answered" counter in place. Calling show() on each
      // submission would tear down and rebuild the Reveal button under the
      // teacher's finger, so in a fast class she couldn't tap it until the
      // answers stopped flowing (i.e. until everyone had answered).
      var counter = document.querySelector(".host-answered");
      if (hostRenderedQ === i && counter) {
        counter.textContent = answered + " of " + joinedN + " answered";
        return;
      }
      hostRenderedQ = i;
      show(screen("host", [
        el("div", { class: "host-topbar" }, [
          el("div", { class: "host-q-num", text: "Question " + (i + 1) + " / " + rounds.length }),
          el("div", { class: "host-answered", text: answered + " of " + joinedN + " answered" })
        ]),
        adapter.hostContent(el, r),
        el("div", { class: "host-controls" }, [
          el("button", { class: "btn primary big", text: "Reveal answer ▶", on: { click: function () { reveal(i, r); } } })
        ])
      ]));
    }

    // ---- Host: live per-student progress for the individual match game ----
    // Build the per-student progress rows + the "N finished" count from the
    // progress docs the live listener has delivered so far.
    function matchProgress(r) {
      var total = (r.pairs || []).length || 1;
      var joined = sess.joined || {};
      var joinedIds = Object.keys(joined);
      // Best progress per student, from the docs the live listener delivered.
      var prog = {};
      latestAnswers.forEach(function (a) {
        if (a.studentId == null) return;
        var cur = prog[a.studentId] || { matched: 0, done: false };
        if ((a.matched || 0) > cur.matched) cur.matched = a.matched || 0;
        if (a.done) cur.done = true;
        prog[a.studentId] = cur;
      });
      // Show the students who joined (fall back to the full roster before anyone joins).
      var roster = sess.students || [];
      var shown = joinedIds.length
        ? roster.filter(function (s) { return joinedIds.indexOf(s.id) >= 0; })
        : roster;
      var doneCount = 0;
      var rows = shown.map(function (stu) {
        var p = prog[stu.id] || { matched: 0, done: false };
        if (p.done) doneCount++;
        var pct = Math.round(Math.min(1, p.matched / total) * 100);
        return el("div", { class: "match-prow" + (p.done ? " done" : "") }, [
          el("span", { class: "match-pname", text: stu.name }),
          el("div", { class: "match-pbar" }, [
            el("div", { class: "match-pfill", attrs: { style: "width:" + pct + "%" } })
          ]),
          el("span", { class: "match-pcount", text: (p.done ? "✓ " : "") + p.matched + "/" + total })
        ]);
      });
      return { rows: rows, doneCount: doneCount, denom: (shown.length || roster.length) };
    }

    function renderMatchHost(i, r) {
      var d = matchProgress(r);
      // The `.match-progress` container is ALWAYS rendered (a "waiting…" line lives
      // inside it when empty), so once the round is built we only ever refresh the
      // bars + counter in place. Rebuilding the whole screen on every matched pair
      // would keep destroying the "Reveal & score" button under the teacher.
      function fill(container) {
        container.innerHTML = "";
        if (d.rows.length) d.rows.forEach(function (row) { container.appendChild(row); });
        else container.appendChild(el("p", { class: "live-muted", text: "Waiting for students to join…" }));
      }
      var counter = document.querySelector(".host-answered");
      var progWrap = document.querySelector(".match-progress");
      if (hostRenderedQ === i && counter && progWrap) {
        counter.textContent = d.doneCount + " of " + d.denom + " finished";
        fill(progWrap);
        return;
      }
      hostRenderedQ = i;
      var progContainer = el("div", { class: "match-progress" });
      fill(progContainer);
      show(screen("host", [
        el("div", { class: "host-topbar" }, [
          el("div", { class: "host-q-num", text: "Round " + (i + 1) + " / " + rounds.length }),
          el("div", { class: "host-answered", text: d.doneCount + " of " + d.denom + " finished" })
        ]),
        el("div", { class: "match-host-tag", text: "🔗 Each student matches every pair" }),
        progContainer,
        el("div", { class: "host-controls" }, [
          el("button", { class: "btn primary big", text: "Reveal & score ▶", on: { click: function () { reveal(i, r); } } })
        ])
      ]));
    }

    // renderReveal is well-tested, but a reveal must NEVER leave the teacher stuck
    // on the question screen. If the rich reveal ever throws (some unforeseen
    // content), fall back to a minimal reveal card (answer + Next) so the room can
    // always move on.
    function safeReveal(i, r, results, scores) {
      try { renderReveal(i, r, results, scores); return; } catch (e) {}
      var last = (i + 1) >= rounds.length;
      var correctText = "";
      try { correctText = String(adapter.correctLabel(r) || ""); } catch (e2) {}
      try {
        show(screen("host", [
          el("div", { class: "host-topbar" }, [el("div", { class: "host-q-num", text: "Question " + (i + 1) + " / " + rounds.length })]),
          el("div", { class: "reveal-answer" }, [
            el("div", { class: "reveal-label", text: "Correct answer" }),
            el("div", { class: "reveal-value", text: correctText })
          ]),
          el("button", { class: "btn primary big", text: last ? "Finish ▶" : "Next question ▶", on: { click: nextQuestion } })
        ]));
      } catch (e3) {}
    }

    function reveal(i, r) {
      // Revealing is the teacher's call at ANY moment. Mark the phase first so a
      // late answer snapshot can't rebuild the question screen over this reveal.
      hostPhase = "reveal";
      if (adapter.match) return revealMatch(i, r);
      clearTimeout(timer);
      if (answersUnsub) { answersUnsub(); answersUnsub = null; }
      // Reuse the answers our live listener already delivered instead of
      // re-querying Firestore — saves ~one read per student, every question.
      var arr = latestAnswers;
      {
        var startedAt = sess.round && sess.round.startedAt && sess.round.startedAt.toMillis ? sess.round.startedAt.toMillis() : null;
        var byStudent = {};
        arr.forEach(function (a) { byStudent[a.studentId] = a; });
        var scores = Object.assign({}, sess.scores || {});
        var results = [];
        (sess.students || []).forEach(function (stu) {
          var a = byStudent[stu.id];
          if (!a) { results.push({ studentId: stu.id, name: stu.name, correct: false, points: 0, answered: false }); return; }
          var ts = a.ts && a.ts.toMillis ? a.ts.toMillis() : null;
          var elapsed = (startedAt != null && ts != null) ? Math.max(0, ts - startedAt) : TL;
          // A bad answer payload must never brick the reveal — score defensively.
          var sc; try { sc = adapter.score(r, a, elapsed, TL) || {}; } catch (e) { sc = { correct: false, points: 0 }; }
          scores[stu.id] = (scores[stu.id] || 0) + (sc.points || 0);
          var row = { studentId: stu.id, name: stu.name, correct: !!sc.correct, points: sc.points || 0, answered: true };
          // Only the partial-credit scorers (Lücken-Text, type mode) return
          // matched/total. Writing them as `undefined` for every other game
          // made Firestore reject the WHOLE reveal write — thrown synchronously
          // from inside the click handler — so the Reveal button looked dead in
          // each MCQ-style game once one student had answered. Omit, never
          // write `undefined`.
          if (sc.matched != null) row.matched = sc.matched;
          if (sc.total != null) row.total = sc.total;
          results.push(row);
        });
        results.sort(function (x, y) { return y.points - x.points; });
        results.forEach(function (rr, idx) { rr.rank = idx + 1; });
        var correctLabelText; try { correctLabelText = adapter.correctLabel(r); } catch (e) { correctLabelText = ""; }
        var revealDoc = { index: i, correct: correctLabelText, explanation: r.explanation || null, results: results };
        // Lücken-Text: now that the round is over it's safe to ship the correct
        // answers so each phone can mark its own blanks right/wrong.
        if (adapter.blanks) { revealDoc.blanks = r.blanks; revealDoc.sentence = r.sentence; }
        // MCQ: ship the correct option (type+value) so a picture/audio answer can
        // be rendered at reveal, not just its text value.
        if (adapter.mcq) { revealDoc.correctOption = (r.options || []).filter(function (o) { return o.correct; })[0] || null; }
        safeUpdate({ status: "reveal", scores: scores, reveal: revealDoc });
        var german; try { german = adapter.speakOnReveal(r); } catch (e) { german = null; }
        // Pronunciation is a nice-to-have — it must never stop the reveal screen.
        if (german) { try { kit.speak(german); } catch (e) {} }
        safeReveal(i, r, results, scores);
      }
    }

    // ---- Score the individual match round from each student's progress docs ----
    function revealMatch(i, r) {
      hostPhase = "reveal"; // late progress docs must not rebuild over the reveal
      clearTimeout(timer);
      if (answersUnsub) { answersUnsub(); answersUnsub = null; }
      var arr = latestAnswers;
      var total = (r.pairs || []).length || 1;
      var startedAt = sess.round && sess.round.startedAt && sess.round.startedAt.toMillis ? sess.round.startedAt.toMillis() : null;
      // Keep the most complete record per student (a "done" doc, else highest matched).
      var best = {};
      arr.forEach(function (a) {
        if (a.studentId == null) return;
        var cur = best[a.studentId];
        if (!cur || a.done || (a.matched || 0) > (cur.matched || 0)) best[a.studentId] = a;
      });
      var scores = Object.assign({}, sess.scores || {});
      var results = [];
      (sess.students || []).forEach(function (stu) {
        var a = best[stu.id];
        if (!a) {
          results.push({ studentId: stu.id, name: stu.name, correct: false, points: 0, answered: false, matched: 0, total: total });
          return;
        }
        var matched = Math.min(a.matched || 0, total);
        var wrong = a.wrong || 0;
        var done = !!a.done || matched >= total;
        var ts = a.ts && a.ts.toMillis ? a.ts.toMillis() : null;
        var elapsed = (startedAt != null && ts != null) ? Math.max(0, ts - startedAt) : TL;
        var frac = Math.max(0, 1 - elapsed / TL);
        // Partial credit for pairs found + a speed bonus only when fully done,
        // minus a deduction for each wrong tap. Floored at zero.
        var pts = Math.round((matched / total) * 600) + (done ? Math.round(400 * frac) : 0) - 40 * wrong;
        if (pts < 0) pts = 0;
        scores[stu.id] = (scores[stu.id] || 0) + pts;
        results.push({ studentId: stu.id, name: stu.name, correct: done, points: pts, answered: matched > 0, matched: matched, total: total });
      });
      results.sort(function (x, y) { return y.points - x.points; });
      results.forEach(function (rr, idx) { rr.rank = idx + 1; });
      var mCorrect; try { mCorrect = adapter.correctLabel(r); } catch (e) { mCorrect = ""; }
      safeUpdate({
        status: "reveal", scores: scores,
        reveal: { index: i, correct: mCorrect, explanation: null, results: results, match: true }
      });
      safeReveal(i, r, results, scores);
    }

    function renderReveal(i, r, results) {
      var last = (i + 1) >= rounds.length;
      var isMatch = !!adapter.match;
      var isBlanks = !!adapter.blanks;
      var correctCount = results.filter(function (x) { return x.correct; }).length;
      var mtotal = (r.pairs || []).length;
      // Leaderboard for THIS question only (ranked by points earned this round).
      var ranked = results.filter(function (x) { return x.answered; }).sort(function (a, b) { return b.points - a.points; });
      var answerBlock;
      if (isMatch) {
        answerBlock = el("div", { class: "reveal-answer" }, [
          el("div", { class: "reveal-label", text: "Round complete" }),
          el("div", { class: "reveal-value", text: "🔗 " + mtotal + (mtotal === 1 ? " pair" : " pairs") })
        ]);
      } else if (isBlanks) {
        // The full sentence with every gap filled + highlighted, plus the note.
        var byId = {}; (r.blanks || []).forEach(function (b) { byId[b.id] = b.correct; });
        answerBlock = el("div", { class: "reveal-answer" }, [
          el("div", { class: "reveal-label", text: "Correct answer" }),
          el("div", { class: "reveal-sentence lt" }, blanksFilled(r.sentence, function (id) { return { cls: "rs-fill", text: byId[id] != null ? byId[id] : "___" }; })),
          r.explanation ? el("div", { class: "reveal-why", text: r.explanation }) : null
        ]);
      } else if (adapter.mcq) {
        // Render the winning option by its type (a picture answer shows the
        // picture, an icon the icon, etc.) — not just its raw value.
        var co = (r.options || []).filter(function (o) { return o.correct; })[0];
        answerBlock = el("div", { class: "reveal-answer" }, [
          el("div", { class: "reveal-label", text: "Correct answer" }),
          (co && co.type && co.type !== "text")
            ? el("div", { class: "reveal-value mcq-reveal" }, window.MatchTiles.content(el, co))
            : el("div", { class: "reveal-value", text: adapter.correctLabel(r) }),
          r.emoji ? el("div", { class: "reveal-emoji", text: r.emoji }) : null
        ]);
      } else {
        answerBlock = el("div", { class: "reveal-answer" }, [
          el("div", { class: "reveal-label", text: "Correct answer" }),
          el("div", { class: "reveal-value", text: adapter.correctLabel(r) }),
          r.emoji ? el("div", { class: "reveal-emoji", text: r.emoji }) : null,
          r.sentence ? el("div", { class: "reveal-sentence" }, filledSentence(r.sentence, r.correct)) : null,
          r.explanation ? el("div", { class: "reveal-why", text: r.explanation }) : null
        ]);
      }
      var showCount = isMatch || isBlanks;   // board shows an "x/y" suffix per student
      var statText = isMatch
        ? correctCount + " of " + results.length + " finished every pair"
        : (isBlanks
            ? correctCount + " of " + results.length + " filled every blank"
            : correctCount + " of " + results.length + " correct");
      show(screen("host", [
        el("div", { class: "host-topbar" }, [el("div", { class: "host-q-num", text: (isMatch ? "Round " : "Question ") + (i + 1) + " / " + rounds.length })]),
        answerBlock,
        el("div", { class: "reveal-stat", text: statText }),
        el("h3", { class: "reveal-board-title", text: "Top scorers — this " + (isMatch ? "round" : "question") }),
        ranked.length
          ? el("div", { class: "board-list" }, ranked.slice(0, 8).map(function (x, idx) {
              return el("div", { class: "board-row" + (idx === 0 && x.points > 0 ? " top" : "") }, [
                el("span", { class: "board-rank", text: (idx + 1) }),
                el("span", { class: "board-name", text: x.name + (showCount ? "  (" + x.matched + "/" + x.total + ")" : "") }),
                el("span", { class: "board-pts", text: x.points > 0 ? "+" + x.points : (showCount ? "0" : "✗") })
              ]);
            }))
          : el("p", { class: "live-muted", text: "No answers this round." }),
        el("button", { class: "btn primary big", text: last ? "Finish ▶" : (isMatch ? "Next round ▶" : "Next question ▶"), on: { click: nextQuestion } })
      ]));
    }

    function podium() {
      hostPhase = "podium";
      // Transition into the final screen (once), then render it.
      safeUpdate({ status: "podium" });
      try { if (sess.persistMode === "continue") window.LiveDB.saveLeaderboard(sess.rosterId, sess.scores || {}).catch(function () {}); } catch (e) {}
      try { kit.confetti(); kit.beep("win"); } catch (e) {}
      renderPodium();
    }

    function renderPodium() {
      var scores = sess.scores || {};
      var rows = (sess.students || []).map(function (s) { return { name: s.name, pts: scores[s.id] || 0 }; })
        .sort(function (a, b) { return b.pts - a.pts; });
      var top3 = rows.slice(0, 3);
      show(screen("host", [
        el("h2", { class: "live-title", text: "🏆 " + (sess.gameName || "Final") + " — results" }),
        el("div", { class: "podium" }, top3.map(function (row, i) {
          return el("div", { class: "podium-col p" + (i + 1) }, [
            el("div", { class: "podium-medal", text: ["🥇", "🥈", "🥉"][i] }),
            el("div", { class: "podium-name", text: row.name }),
            el("div", { class: "podium-pts", text: row.pts }),
            el("div", { class: "podium-block", text: (i + 1) })
          ]);
        })),
        // Full standings for the whole class.
        el("h3", { class: "reveal-board-title", text: "Final leaderboard" }),
        rows.length
          ? el("div", { class: "board-list" }, rows.map(function (row, idx) {
              return el("div", { class: "board-row" + (idx === 0 ? " top" : "") }, [
                el("span", { class: "board-rank", text: (idx + 1) }),
                el("span", { class: "board-name", text: row.name }),
                el("span", { class: "board-pts", text: row.pts })
              ]);
            }))
          : el("p", { class: "live-muted", text: "No players." }),
        el("div", { class: "podium-actions" }, [
          el("button", { class: "btn primary big", text: "▶ Play another game", on: { click: playAnother } }),
          el("button", { class: "back-link small", html: "✕ Close room", on: { click: closeRoom } })
        ])
      ]));
    }

    // Start a new game in the SAME room, keeping the joined students.
    function playAnother() {
      var carried = (sess && sess.scores) || {};
      var seq = (sess && sess.gameSeq) || 0;
      gamePicker({
        title: "Play another game",
        sub: "Same room · code " + code + " · same players. Pick the next game.",
        startLabel: "Start game ▶",
        continueLabel: "Keep scores",
        continueSub: "Add to this room's running totals",
        freshSub: "Everyone starts this game at zero",
        back: renderPodium,
        onStart: function (sel) {
          var seedScores = sel.persistMode === "continue" ? carried : {};
          window.LiveDB.updateSession(code, {
            gameId: sel.gameId, gameName: sel.adapter.meta.name, topicName: sel.topic.name,
            status: "lobby", questionIndex: -1, totalQuestions: sel.rounds.length,
            round: null, reveal: null, scores: seedScores, answerMode: sel.answerMode,
            persistMode: sel.persistMode, gameSeq: seq + 1
          }).then(function () {
            hostRun(code, sel.adapter, sel.rounds, roster);
          }).catch(function (e) { alert("Could not start: " + e.message); });
        }
      });
    }

    function closeRoom() {
      safeUpdate({ status: "ended" });
      stop();
      landing();
    }
  }

  /* ============================================================
     PLAYER (phone)
     ============================================================ */
  function playerJoin(prefill) {
    stop();
    window.AppNav.set(landing, null);
    var codeInput = el("input", {
      class: "code-input",
      attrs: { type: "text", maxlength: 4, placeholder: "CODE", autocapitalize: "characters", value: typeof prefill === "string" ? prefill : "" }
    });
    codeInput.addEventListener("input", function () { codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); });
    function go() {
      var code = codeInput.value.trim().toUpperCase();
      if (code.length < 4) { return; }
      window.LiveDB.getSession(code).then(function (s) {
        if (!s) { showErr("No room with that code. Check the smartboard."); return; }
        if (s.status === "ended") { showErr("That game has ended."); return; }
        playerPickName(code, s);
      }).catch(function (e) { showErr("Could not connect: " + e.message); });
    }
    var errBox = el("div", { class: "code-err" });
    function showErr(m) { errBox.textContent = m; }
    show(screen("player live-center", [
      el("button", { class: "back-link", html: "← Back", on: { click: landing } }),
      el("div", { class: "player-join" }, [
        el("div", { class: "live-big-emoji", text: "📱" }),
        el("h2", { text: "Enter room code" }),
        codeInput,
        errBox,
        el("button", { class: "btn primary big", text: "Join", on: { click: go } })
      ])
    ]));
  }

  function playerPickName(code, s) {
    stop();
    window.AppNav.set(function () { playerJoin(); }, null);
    var joined = s.joined || {};
    var grid = el("div", { class: "name-grid" }, (s.students || []).map(function (stu) {
      var taken = !!joined[stu.id];
      return el("button", {
        class: "name-btn" + (taken ? " taken" : ""),
        on: { click: function () { pick(stu); } }
      }, [el("span", { text: stu.name }), taken ? el("span", { class: "name-taken", text: "✓" }) : null]);
    }));
    function pick(stu) {
      window.LiveDB.joinSession(code, stu.id, stu.name).then(function () {
        playerRun(code, stu);
      }).catch(function (e) { alert("Could not join: " + e.message); });
    }
    show(screen("player live-center", [
      el("h2", { class: "live-title", text: "Who are you?" }),
      el("p", { class: "live-sub", text: "Tap your name" }),
      grid
    ]));
  }

  function playerRun(code, stu) {
    stop();
    // Back leaves the room; confirm while the student is on an answering screen.
    window.AppNav.set(function () { landing(); }, function () { return !!document.querySelector(".match-board, .live-q-options.phone, .cases-player, .wm-player"); });
    var answeredIndex = -1;
    var lastStatus = null, lastQ = -1, lastSeq = null;
    var matchRenderedQ = -1; // match board is stateful — render it once per round
    var typeRenderedQ = -1;  // type input is stateful too — render once per round
    var statefulRenderedQ = -1; // Lücken-Text widget: build once, don't rebuild
    var typeState = { qi: -1, text: "" }; // this phone's last typed answer
    var blanksState = { qi: -1, answers: null }; // this phone's submitted blanks

    track(window.LiveDB.listenSession(code, function (s) {
      if (!s) { show(screen("player live-center", [el("div", { class: "live-card" }, [el("h2", { text: "Room closed" })])])); return; }
      // A new game in the same room resets question numbering — allow answering again.
      var seq = s.gameSeq || 0;
      if (seq !== lastSeq) { answeredIndex = -1; matchRenderedQ = -1; typeRenderedQ = -1; statefulRenderedQ = -1; lastSeq = seq; }
      var qi = s.round ? s.round.index : -1;
      if (s.status === lastStatus && qi === lastQ && s.status !== "question") return;
      lastStatus = s.status; lastQ = qi;
      // Leaving a question (to reveal / leaderboard / podium / ended): stop any
      // audio the student started (e.g. a Hör-Paare tap) so it doesn't play on.
      if (s.status !== "question") { try { if (window.VoiceBox && window.VoiceBox.stop) window.VoiceBox.stop(); } catch (e) {} }

      if (s.status === "lobby") return waitScreen("You're in! 🎉", "Get ready — watch the smartboard.");
      if (s.status === "question") {
        var qAdapter = window.LiveGames[s.gameId];
        if (qAdapter && qAdapter.match) {
          // Individual match game: build the board once and never rebuild it
          // mid-round (that would reset the student's taps and re-shuffle).
          if (answeredIndex === qi) return waitScreen("All matched! 🎉", "Waiting for the class…");
          if (matchRenderedQ === qi) return;
          matchRenderedQ = qi;
          return matchPlayerScreen(s);
        }
        if (qAdapter && qAdapter.typeResult && s.answerMode === "type") {
          if (answeredIndex === qi) return;   // already submitted — keep their diff on screen
          if (typeRenderedQ === qi) return;   // don't rebuild the text box under them
          typeRenderedQ = qi;
          return typePlayerScreen(s, qAdapter);
        }
        if (qAdapter && qAdapter.statefulPlayer) {
          // Lücken-Text: the fill-in widget holds in-progress taps/typing, so it
          // must be built once and never rebuilt while the student is working.
          if (answeredIndex === qi) return waitScreen("Answer locked ✔", "Waiting for the class…");
          if (statefulRenderedQ === qi) return;
          statefulRenderedQ = qi;
          return answerScreen(s);
        }
        if (answeredIndex === qi) return waitScreen("Answer locked ✔", "Waiting for the class…");
        return answerScreen(s);
      }
      if (s.status === "reveal") {
        var rAdapter = window.LiveGames[s.gameId];
        if (rAdapter && rAdapter.typeResult && s.answerMode === "type") return typeRevealScreen(s, rAdapter);
        if (rAdapter && rAdapter.blanks) return blanksRevealScreen(s, rAdapter);
        return resultScreen(s);
      }
      if (s.status === "leaderboard") return standingScreen(s);
      if (s.status === "podium") return finalScreen(s);
      if (s.status === "ended") return waitScreen("Game over", "Thanks for playing!");
    }));

    function waitScreen(title, sub) {
      show(screen("player live-center", [el("div", { class: "live-card" }, [
        el("div", { class: "player-name-tag", text: stu.name }),
        el("div", { class: "live-big-emoji", text: "⏳" }),
        el("h2", { text: title }),
        el("p", { class: "live-sub", text: sub })
      ])]));
    }

    function answerScreen(s) {
      var adapter = window.LiveGames[s.gameId];
      var r = s.round;
      var locked = false;
      var api = {
        submit: function (payload) {
          if (locked || answeredIndex === r.index) return;
          locked = true; answeredIndex = r.index;
          // Remember this phone's blanks so it can mark them right/wrong at reveal.
          if (payload && payload.blanks) blanksState = { qi: r.index, answers: payload.blanks };
          window.LiveDB.submitAnswer(code, r.index, stu.id, payload);
          waitScreen("Answer locked ✔", "Waiting for the class…");
        }
      };
      var hint = adapter.blanks
        ? (s.answerMode === "type" ? "Fill in the blanks ✍️" : "Tap the words to fill the blanks 👇")
        : "Tap your answer 👇";
      var body = screen("player", [
        el("div", { class: "player-topbar" }, [
          el("div", { class: "player-name-tag", text: stu.name }),
          el("div", { class: "player-qnum", text: "Q" + (r.index + 1) })
        ]),
        el("div", { class: "player-prompt-hint", text: hint }),
        adapter.playerContent(el, r, api)
      ]);
      show(body);
    }

    /* ---- Individual match board (Hör-Paare) ----
       Each phone gets its OWN shuffled columns of speaker tiles (tap = hear the
       German word) and meaning tiles (English + emoji). Tap a speaker, then its
       meaning, to lock a pair. Wrong taps flash and cost points at scoring, but
       replaying audio is always free. Progress is reported to the host as each
       pair is matched. */
    function matchPlayerScreen(s) {
      var r = s.round;
      var pairs = (r.pairs || []).slice();
      var total = pairs.length;
      var rate = r.speed || 1;
      var matched = 0, wrong = 0, finished = false;
      var startTs = Date.now();
      var MT = window.MatchTiles;

      // Independent shuffles per side → every phone's layout is different.
      var lefts = kit.shuffle(pairs.map(function (p, idx) { return { idx: idx, side: p.q }; }));
      var rights = kit.shuffle(pairs.map(function (p, idx) { return { idx: idx, side: p.a }; }));
      var sel = { q: null, a: null }; // { idx, btn } per column
      var busy = false; // brief lock during the wrong-answer flash

      var counter = el("span", { class: "match-count-n", text: "0 / " + total });
      var leftCol = el("div", { class: "match-col questions" });
      var rightCol = el("div", { class: "match-col answers" });

      function reportMatch() {
        // One write-once doc per matched pair drives the host's live bar; the
        // final one (matched === total) carries done:true for scoring. Rejected
        // silently if the host has already moved on.
        try {
          window.LiveDB.submitProgress(code, r.index, stu.id, matched, {
            matched: matched, total: total, wrong: wrong, done: matched >= total
          }).catch(function () {});
        } catch (e) {}
      }

      // A solved audio tile reveals the German text it was speaking (a reward).
      function revealAudio(btn, side) {
        if (side && side.type === "audio") { var lbl = btn.querySelector(".match-slabel"); if (lbl) lbl.textContent = side.value; }
      }

      function tryMatch() {
        if (!sel.q || !sel.a) return;
        var q = sel.q, a = sel.a;
        if (q.idx === a.idx) {
          matched++;
          counter.textContent = matched + " / " + total;
          q.btn.classList.remove("sel"); a.btn.classList.remove("sel");
          q.btn.classList.add("done"); a.btn.classList.add("done");
          q.btn.disabled = true; a.btn.disabled = true;
          revealAudio(q.btn, pairs[q.idx].q); revealAudio(a.btn, pairs[a.idx].a);
          sel.q = null; sel.a = null;
          try { kit.beep("good"); } catch (e) {}
          reportMatch();
          if (matched >= total) return finish();
        } else {
          wrong++;
          busy = true;
          q.btn.classList.remove("sel"); a.btn.classList.remove("sel");
          q.btn.classList.add("wrong"); a.btn.classList.add("wrong");
          try { kit.beep("bad"); } catch (e) {}
          var x = q.btn, y = a.btn;
          sel.q = null; sel.a = null;
          setTimeout(function () { x.classList.remove("wrong"); y.classList.remove("wrong"); busy = false; }, 500);
        }
      }

      function onTile(col, item, btn) {
        if (busy || btn.disabled) return;
        if (MT.isAudio(item.side)) MT.play(kit, item.side, rate); // always free to replay
        if (sel[col]) sel[col].btn.classList.remove("sel");
        sel[col] = { idx: item.idx, btn: btn };
        btn.classList.add("sel");
        tryMatch();
      }

      function finish() {
        if (finished) return;
        finished = true;
        answeredIndex = r.index; // lock this round for this phone
        var secs = Math.max(1, Math.round((Date.now() - startTs) / 1000));
        show(screen("player live-center res-good", [el("div", { class: "live-card" }, [
          el("div", { class: "player-name-tag", text: stu.name }),
          el("div", { class: "live-big-emoji", text: "🔗" }),
          el("h2", { text: "All matched! 🎉" }),
          el("p", { class: "live-sub", text: "You matched all " + total + " pairs in " + secs + "s" }),
          wrong ? el("p", { class: "player-why", text: wrong + (wrong === 1 ? " wrong tap" : " wrong taps") }) : null,
          el("p", { class: "live-sub", text: "Waiting for the class…" })
        ])]));
      }

      lefts.forEach(function (item) {
        var btn = MT.render(el, item.side);
        btn.addEventListener("click", function () { onTile("q", item, btn); });
        leftCol.appendChild(btn);
      });
      rights.forEach(function (item) {
        var btn = MT.render(el, item.side);
        btn.addEventListener("click", function () { onTile("a", item, btn); });
        rightCol.appendChild(btn);
      });

      var anyAudio = pairs.some(function (p) { return MT.isAudio(p.q) || MT.isAudio(p.a); });
      show(screen("player", [
        el("div", { class: "player-topbar" }, [
          el("div", { class: "player-name-tag", text: stu.name }),
          el("div", { class: "match-count", text: "Matched " }, [counter])
        ]),
        el("div", { class: "player-prompt-hint", text: anyAudio ? "Tap 🔊 to hear it, then match each pair 👇" : "Tap one tile on each side to match them 👇" }),
        el("div", { class: "match-board" }, [leftCol, rightCol])
      ]));
    }

    /* ---- Hör gut zu! TYPE mode: type it, then see your own word-by-word diff ----
       The phone shows a text box; on submit it immediately shows a green/red
       diff of what they typed vs the correct answer (computed locally). If the
       teacher reveals before this phone submits, it's locked out ("Too slow!"). */
    function typePlayerScreen(s, adapter) {
      var r = s.round;
      var locked = false;
      var input = el("input", { class: "type-input", attrs: { type: "text", placeholder: "Type what you heard…", autocapitalize: "off", autocomplete: "off", autocorrect: "off", spellcheck: "false" } });
      function submit() {
        if (locked || answeredIndex === r.index) return;
        var text = (input.value || "").trim();
        if (!text) return;
        locked = true; answeredIndex = r.index;
        typeState = { qi: r.index, text: text };
        window.LiveDB.submitAnswer(code, r.index, stu.id, { text: text });
        show(typeDiffNode(r, text, adapter, null)); // null = scored at reveal
      }
      input.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
      setTimeout(function () { try { input.focus(); } catch (e) {} }, 60);
      show(screen("player", [
        el("div", { class: "player-topbar" }, [
          el("div", { class: "player-name-tag", text: stu.name }),
          el("div", { class: "player-qnum", text: "Q" + (r.index + 1) })
        ]),
        el("div", { class: "player-prompt-hint", text: "Type what you heard 👂" }),
        el("div", { class: "type-row" }, [input, el("button", { class: "btn primary type-go", text: "Submit", on: { click: submit } })])
      ]));
    }

    // Build the diff result card: "You typed:" (green/red/strikethrough) over
    // "Correct answer:" (missing words shown as a distinct placeholder). `me` is
    // the scored result (null while still waiting for the reveal).
    function typeDiffNode(r, text, adapter, me) {
      var d = adapter.diff(text, r.correct || "");
      // Render each line as a normal, flowing sentence — words separated by real
      // spaces, coloured in place (green/red), not boxed chips.
      function inline(items, clsFor) {
        var out = [];
        items.forEach(function (x, i) {
          if (i > 0) out.push(" ");
          out.push(el("span", { class: clsFor(x), text: x.word }));
        });
        return out;
      }
      var typedLine = el("div", { class: "diff-line" }, d.typedRow.length
        ? inline(d.typedRow, function (x) { return "diff-word diff-" + x.status; })
        : [el("span", { class: "diff-word diff-wrong", text: "(nothing typed)" })]);
      var correctLine = el("div", { class: "diff-line ref" },
        inline(d.correctRow, function (x) { return "diff-word" + (x.missing ? " diff-missing" : ""); }));
      var body = [
        el("div", { class: "player-name-tag", text: stu.name }),
        el("div", { class: "diff-label", text: "You typed" }),
        typedLine,
        el("div", { class: "diff-label", text: "Correct answer" }),
        correctLine
      ];
      if (me) {
        body.push(el("div", { class: "player-points", text: (me.points > 0 ? "+" + me.points : "0") + " points" }));
        body.push(el("div", { class: "diff-score", text: (me.matched || 0) + " of " + (me.total || d.total) + " words correct" }));
      } else {
        body.push(el("p", { class: "live-sub diff-wait", text: "Waiting for the class…" }));
      }
      var good = me ? me.correct : false;
      return screen("player live-center " + (me ? (good ? "res-good" : "res-bad") : ""), [el("div", { class: "live-card diff-card" }, body)]);
    }

    function typeRevealScreen(s, adapter) {
      var r = s.round;
      // Didn't submit before the teacher revealed → locked out.
      if (answeredIndex !== r.index || typeState.qi !== r.index) {
        kit.beep("bad");
        return show(screen("player live-center res-bad", [el("div", { class: "live-card" }, [
          el("div", { class: "player-name-tag", text: stu.name }),
          el("div", { class: "live-big-emoji", text: "⏰" }),
          el("h2", { text: "Too slow!" }),
          el("p", { class: "live-sub", text: "Answer: " + (r.correct || "") }),
          el("div", { class: "player-points", text: "0 points" })
        ])]));
      }
      var me = (s.reveal && s.reveal.results || []).filter(function (x) { return x.studentId === stu.id; })[0];
      kit.beep(me && me.correct ? "good" : "bad");
      show(typeDiffNode(r, typeState.text, adapter, me || { points: 0, matched: 0, total: 0 }));
    }

    // Lücken-Text reveal: the sentence with THIS phone's answers dropped into the
    // gaps, each coloured green/red, plus the correct word under any wrong gap.
    function blanksRevealScreen(s, adapter) {
      var r = s.round;
      // Didn't submit before the teacher revealed → locked out with the answer.
      if (answeredIndex !== r.index || blanksState.qi !== r.index) {
        kit.beep("bad");
        return show(screen("player live-center res-bad", [el("div", { class: "live-card" }, [
          el("div", { class: "player-name-tag", text: stu.name }),
          el("div", { class: "live-big-emoji", text: "⏰" }),
          el("h2", { text: "Too slow!" }),
          el("p", { class: "live-sub", text: "Answer: " + (s.reveal ? s.reveal.correct : "") }),
          el("div", { class: "player-points", text: "0 points" })
        ])]));
      }
      var me = (s.reveal && s.reveal.results || []).filter(function (x) { return x.studentId === stu.id; })[0] || { points: 0, matched: 0, total: 0, correct: false };
      var mine = blanksState.answers || {};
      var correctById = {}; (s.reveal && s.reveal.blanks || []).forEach(function (b) { correctById[b.id] = b.correct; });
      var normEq = function (a, b) {
        var n = function (x) {
          return String(x == null ? "" : x).toLowerCase()
            .replace(/[.,!?;:"'“”„«»()¡¿…\-–—]/g, "")
            .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").trim();
        };
        return n(a) !== "" && n(a) === n(b);
      };
      var sentence = s.reveal && s.reveal.sentence ? s.reveal.sentence : r.sentence;
      var line = el("div", { class: "diff-line lt-reveal" }, blanksFilled(sentence, function (id) {
        var typed = mine[id], right = normEq(typed, correctById[id]);
        return { cls: "diff-word diff-" + (right ? "correct" : "wrong"), text: (typed && String(typed).trim()) ? typed : "＿＿" };
      }));
      // Corrections list for any blank the student got wrong.
      var wrongs = (s.reveal && s.reveal.blanks || []).filter(function (b) { return !normEq(mine[b.id], b.correct); });
      var body = [
        el("div", { class: "player-name-tag", text: stu.name }),
        el("div", { class: "diff-label", text: "Your answer" }),
        line
      ];
      if (wrongs.length) {
        body.push(el("div", { class: "lt-corrections" }, wrongs.map(function (b) {
          return el("div", { class: "lt-correction", text: "✓ " + b.correct });
        })));
      }
      if (s.reveal && s.reveal.explanation) body.push(el("p", { class: "player-why", text: s.reveal.explanation }));
      body.push(el("div", { class: "player-points", text: (me.points > 0 ? "+" + me.points : "0") + " points" }));
      body.push(el("div", { class: "diff-score", text: (me.matched || 0) + " of " + (me.total || (s.reveal && s.reveal.blanks || []).length) + " blanks correct" }));
      show(screen("player live-center " + (me.correct ? "res-good" : "res-bad"), [el("div", { class: "live-card diff-card" }, body)]));
    }

    function resultScreen(s) {
      if (s.reveal && s.reveal.match) return matchResultScreen(s);
      var me = (s.reveal && s.reveal.results || []).filter(function (x) { return x.studentId === stu.id; })[0];
      var correct = me && me.correct;
      var pts = me ? me.points : 0;
      kit.beep(correct ? "good" : "bad");
      show(screen("player live-center " + (correct ? "res-good" : "res-bad"), [el("div", { class: "live-card" }, [
        el("div", { class: "player-name-tag", text: stu.name }),
        el("div", { class: "live-big-emoji", text: correct ? "✅" : (me && me.answered ? "❌" : "⏰") }),
        el("h2", { text: correct ? "Correct!" : (me && me.answered ? "Not quite" : "Too slow") }),
        // Show the winning answer by type (image/icon/audio), else its text value.
        (s.reveal && s.reveal.correctOption && s.reveal.correctOption.type && s.reveal.correctOption.type !== "text")
          ? el("div", { class: "mcq-result-answer" }, [el("span", { class: "live-sub", text: "Answer:" }), el("div", { class: "mcq-result-tile mt-" + s.reveal.correctOption.type }, window.MatchTiles.content(el, s.reveal.correctOption))])
          : el("p", { class: "live-sub", text: "Answer: " + (s.reveal ? s.reveal.correct : "") }),
        s.reveal && s.reveal.explanation ? el("p", { class: "player-why", text: s.reveal.explanation }) : null,
        el("div", { class: "player-points", text: (pts > 0 ? "+" + pts : "0") + " points" })
      ])]));
    }

    function matchResultScreen(s) {
      var me = (s.reveal && s.reveal.results || []).filter(function (x) { return x.studentId === stu.id; })[0];
      var matched = me ? me.matched : 0, total = me ? me.total : 0, pts = me ? me.points : 0;
      var allDone = !!(me && me.correct);
      kit.beep(allDone ? "good" : "bad");
      show(screen("player live-center " + (allDone ? "res-good" : "res-bad"), [el("div", { class: "live-card" }, [
        el("div", { class: "player-name-tag", text: stu.name }),
        el("div", { class: "live-big-emoji", text: allDone ? "🔗" : (matched > 0 ? "🧩" : "⏰") }),
        el("h2", { text: allDone ? "All matched!" : (matched > 0 ? "Time's up" : "Too slow") }),
        el("p", { class: "live-sub", text: "You matched " + matched + " of " + total + (total === 1 ? " pair" : " pairs") }),
        el("div", { class: "player-points", text: (pts > 0 ? "+" + pts : "0") + " points" })
      ])]));
    }

    function standingScreen(s) {
      var scores = s.scores || {};
      var rows = (s.students || []).map(function (x) { return { id: x.id, name: x.name, pts: scores[x.id] || 0 }; })
        .sort(function (a, b) { return b.pts - a.pts; });
      var myRank = 0; for (var i = 0; i < rows.length; i++) if (rows[i].id === stu.id) myRank = i + 1;
      show(screen("player live-center", [el("div", { class: "live-card" }, [
        el("div", { class: "player-name-tag", text: stu.name }),
        el("div", { class: "live-big-emoji", text: "📊" }),
        el("h2", { text: "You're #" + myRank }),
        el("div", { class: "player-points", text: (scores[stu.id] || 0) + " points" }),
        el("p", { class: "live-sub", text: "Watch the smartboard for the full leaderboard." })
      ])]));
    }

    function finalScreen(s) {
      var scores = s.scores || {};
      var rows = (s.students || []).map(function (x) { return { id: x.id, name: x.name, pts: scores[x.id] || 0 }; })
        .sort(function (a, b) { return b.pts - a.pts; });
      var myRank = 0; for (var i = 0; i < rows.length; i++) if (rows[i].id === stu.id) myRank = i + 1;
      if (myRank <= 3) kit.confetti();
      show(screen("player live-center", [el("div", { class: "live-card" }, [
        el("div", { class: "player-name-tag", text: stu.name }),
        el("div", { class: "live-big-emoji", text: myRank === 1 ? "🥇" : myRank === 2 ? "🥈" : myRank === 3 ? "🥉" : "🎉" }),
        el("h2", { text: myRank <= 3 ? "You placed #" + myRank + "!" : "Final rank: #" + myRank }),
        el("div", { class: "player-points", text: (scores[stu.id] || 0) + " points" })
      ])]));
    }
  }

  return { start: start, stop: stop };
})();
