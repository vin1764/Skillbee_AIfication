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
    show(screen("live-center", [
      el("button", { class: "back-link", html: "← Back", on: { click: goBack } }),
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
          step.appendChild(el("div", { class: "live-label", text: n + " · How students answer" }));
          step.appendChild(el("div", { class: "setup-modes" }, [
            answerPill("options", "Tap the article", "Multiple choice — faster"),
            answerPill("type", "Type the article", "Free recall — harder")
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
            el("button", {
              class: "btn ghost", html: "▶ Preview at " + speed + "×",
              on: { click: function () { previewAudio(); } }
            }),
            el("span", { class: "live-muted", text: "Hear a sample at this speed before you start." })
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

      // Play a sample from the chosen exercise (or a fallback) at the selected speed.
      function previewAudio() {
        var sample = "Guten Morgen";
        try {
          var ex = store.exercise && store.exercise(gameId === "listen" ? "listening" : gameId, topic && topic.id);
          var items = (ex && (ex.items || ex.words)) || [];
          var texts = items.map(function (it) { return it && (it.word || it.de); }).filter(Boolean);
          if (texts.length) sample = texts[Math.floor(Math.random() * texts.length)];
        } catch (e) {}
        kit.speak(sample, { rate: speed });
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
    var sess = null;
    var answersUnsub = null;
    var timer = null;
    var TL = adapter.timeLimit || 20000;

    track(window.LiveDB.listenSession(code, function (s) {
      sess = s;
      if (!s) return;
      if (s.status === "lobby") hostLobby();
    }));

    function hostLobby() {
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
      window.LiveDB.updateSession(code, {
        status: "question", questionIndex: i, reveal: null,
        round: {
          index: i, type: r.type, de: r.de || null, emoji: r.emoji || null, options: r.options || null,
          sentence: r.sentence || null, blank: r.blank || null, clueWord: r.clueWord || null,
          meaning: r.meaning || null, tiles: r.tiles || null,
          answerMode: sess.answerMode || "options",
          startedAt: window.LiveDB.serverTs()
        }
      });
      watchAnswers(i, r);
    }

    function watchAnswers(i, r) {
      if (answersUnsub) { answersUnsub(); answersUnsub = null; }
      var answered = 0;
      answersUnsub = window.LiveDB.listenAnswers(code, i, function (arr) {
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
      var joinedN = Object.keys(sess.joined || {}).length || (sess.students || []).length;
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

    function reveal(i, r) {
      clearTimeout(timer);
      if (answersUnsub) { answersUnsub(); answersUnsub = null; }
      window.LiveDB.getAnswers(code, i).then(function (arr) {
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
          var sc = adapter.score(r, a, elapsed, TL);
          scores[stu.id] = (scores[stu.id] || 0) + sc.points;
          results.push({ studentId: stu.id, name: stu.name, correct: sc.correct, points: sc.points, answered: true });
        });
        results.sort(function (x, y) { return y.points - x.points; });
        results.forEach(function (rr, idx) { rr.rank = idx + 1; });
        window.LiveDB.updateSession(code, {
          status: "reveal", scores: scores,
          reveal: { index: i, correct: adapter.correctLabel(r), explanation: r.explanation || null, results: results }
        });
        var german = adapter.speakOnReveal(r);
        if (german) kit.speak(german);
        renderReveal(i, r, results, scores);
      });
    }

    function renderReveal(i, r, results) {
      var last = (i + 1) >= rounds.length;
      var correctCount = results.filter(function (x) { return x.correct; }).length;
      // Leaderboard for THIS question only (ranked by points earned this round).
      var ranked = results.filter(function (x) { return x.answered; }).sort(function (a, b) { return b.points - a.points; });
      show(screen("host", [
        el("div", { class: "host-topbar" }, [el("div", { class: "host-q-num", text: "Question " + (i + 1) + " / " + rounds.length })]),
        el("div", { class: "reveal-answer" }, [
          el("div", { class: "reveal-label", text: "Correct answer" }),
          el("div", { class: "reveal-value", text: adapter.correctLabel(r) }),
          r.emoji ? el("div", { class: "reveal-emoji", text: r.emoji }) : null,
          r.sentence ? el("div", { class: "reveal-sentence" }, filledSentence(r.sentence, r.correct)) : null,
          r.explanation ? el("div", { class: "reveal-why", text: r.explanation }) : null
        ]),
        el("div", { class: "reveal-stat", text: correctCount + " of " + results.length + " correct" }),
        el("h3", { class: "reveal-board-title", text: "Top scorers — this question" }),
        ranked.length
          ? el("div", { class: "board-list" }, ranked.slice(0, 8).map(function (x, idx) {
              return el("div", { class: "board-row" + (idx === 0 && x.correct ? " top" : "") }, [
                el("span", { class: "board-rank", text: (idx + 1) }),
                el("span", { class: "board-name", text: x.name }),
                el("span", { class: "board-pts", text: x.correct ? "+" + x.points : "✗" })
              ]);
            }))
          : el("p", { class: "live-muted", text: "No answers this round." }),
        el("button", { class: "btn primary big", text: last ? "Finish ▶" : "Next question ▶", on: { click: nextQuestion } })
      ]));
    }

    function podium() {
      // Transition into the final screen (once), then render it.
      window.LiveDB.updateSession(code, { status: "podium" });
      if (sess.persistMode === "continue") window.LiveDB.saveLeaderboard(sess.rosterId, sess.scores || {});
      kit.confetti(); kit.beep("win");
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
      window.LiveDB.updateSession(code, { status: "ended" });
      stop();
      landing();
    }
  }

  /* ============================================================
     PLAYER (phone)
     ============================================================ */
  function playerJoin(prefill) {
    stop();
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
    var answeredIndex = -1;
    var lastStatus = null, lastQ = -1, lastSeq = null;

    track(window.LiveDB.listenSession(code, function (s) {
      if (!s) { show(screen("player live-center", [el("div", { class: "live-card" }, [el("h2", { text: "Room closed" })])])); return; }
      // A new game in the same room resets question numbering — allow answering again.
      var seq = s.gameSeq || 0;
      if (seq !== lastSeq) { answeredIndex = -1; lastSeq = seq; }
      var qi = s.round ? s.round.index : -1;
      if (s.status === lastStatus && qi === lastQ && s.status !== "question") return;
      lastStatus = s.status; lastQ = qi;

      if (s.status === "lobby") return waitScreen("You're in! 🎉", "Get ready — watch the smartboard.");
      if (s.status === "question") {
        if (answeredIndex === qi) return waitScreen("Answer locked ✔", "Waiting for the class…");
        return answerScreen(s);
      }
      if (s.status === "reveal") return resultScreen(s);
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
          window.LiveDB.submitAnswer(code, r.index, stu.id, payload);
          waitScreen("Answer locked ✔", "Waiting for the class…");
        }
      };
      var body = screen("player", [
        el("div", { class: "player-topbar" }, [
          el("div", { class: "player-name-tag", text: stu.name }),
          el("div", { class: "player-qnum", text: "Q" + (r.index + 1) })
        ]),
        el("div", { class: "player-prompt-hint", text: "Tap your answer 👇" }),
        adapter.playerContent(el, r, api)
      ]);
      show(body);
    }

    function resultScreen(s) {
      var me = (s.reveal && s.reveal.results || []).filter(function (x) { return x.studentId === stu.id; })[0];
      var correct = me && me.correct;
      var pts = me ? me.points : 0;
      kit.beep(correct ? "good" : "bad");
      show(screen("player live-center " + (correct ? "res-good" : "res-bad"), [el("div", { class: "live-card" }, [
        el("div", { class: "player-name-tag", text: stu.name }),
        el("div", { class: "live-big-emoji", text: correct ? "✅" : (me && me.answered ? "❌" : "⏰") }),
        el("h2", { text: correct ? "Correct!" : (me && me.answered ? "Not quite" : "Too slow") }),
        el("p", { class: "live-sub", text: "Answer: " + (s.reveal ? s.reveal.correct : "") }),
        s.reveal && s.reveal.explanation ? el("p", { class: "player-why", text: s.reveal.explanation }) : null,
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
