/* =====================================================================
   Skillbee Deutsch Games — CORE APP
   ---------------------------------------------------------------------
   This runs the lobby (home screen), moves between screens, keeps the
   score, and gives every game a shared toolkit (App.kit): shuffling,
   German pronunciation, sounds and confetti.
   (You normally don't need to edit this file to add vocabulary.)
   ===================================================================== */

const App = (function () {
  const games = [];
  let root = null;

  /* ---- tiny helpers to build HTML elements ------------------------- */
  function el(tag, opts = {}, children = []) {
    const node = document.createElement(tag);
    if (opts.class) node.className = opts.class;
    if (opts.html != null) node.innerHTML = opts.html;
    if (opts.text != null) node.textContent = opts.text;
    if (opts.attrs) for (const k in opts.attrs) node.setAttribute(k, opts.attrs[k]);
    if (opts.on) for (const evt in opts.on) node.addEventListener(evt, opts.on[evt]);
    (Array.isArray(children) ? children : [children]).forEach((c) => {
      if (c == null) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  /* ---- shared game toolkit ----------------------------------------- */
  const kit = {
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    sample(arr, n) {
      return kit.shuffle(arr).slice(0, n);
    },
    randInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    },
    el,

    /* Speak German out loud. Routed through VoiceBox so the voice chosen in
       Settings is used everywhere; falls back to plain browser speech.
       opts.rate scales the playback speed (1 = normal). */
    speak(text, opts) {
      if (window.VoiceBox) return window.VoiceBox.speak(text, opts);
      try {
        if (!("speechSynthesis" in window)) return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "de-DE";
        u.rate = 0.95 * ((opts && opts.rate) || 1);
        const voices = window.speechSynthesis.getVoices();
        const de = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("de"));
        if (de) u.voice = de;
        window.speechSynthesis.speak(u);
      } catch (e) {
        /* ignore — pronunciation is a nice-to-have */
      }
    },

    /* A small "speaker" button that pronounces a German word. */
    speakerButton(text) {
      return el("button", {
        class: "speaker-btn",
        attrs: { "aria-label": "Aussprache anhören", title: "Aussprache anhören" },
        html: "🔊",
        on: {
          click: (e) => {
            e.stopPropagation();
            kit.speak(text);
          }
        }
      });
    },

    /* Simple beeps via the Web Audio API (no sound files needed). */
    beep(type = "good") {
      try {
        if (App.state.muted) return;
        const ctx = (kit._audio = kit._audio || new (window.AudioContext || window.webkitAudioContext)());
        const now = ctx.currentTime;
        const notes =
          type === "good" ? [660, 880] : type === "win" ? [523, 659, 784, 1046] : [220, 160];
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = type === "bad" ? "sawtooth" : "sine";
          osc.frequency.value = freq;
          const t = now + i * 0.09;
          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
          osc.connect(gain).connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.2);
        });
      } catch (e) {
        /* ignore */
      }
    },

    /* Confetti burst on a big win. Pure canvas — no libraries. */
    confetti() {
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const canvas = el("canvas", { class: "confetti-canvas" });
      document.body.appendChild(canvas);
      const ctx = canvas.getContext("2d");
      const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      };
      resize();
      const colors = ["#0A84FF", "#FF3B67", "#12C08A", "#FFA51F", "#0B3FDD", "#FFB703"];
      const pieces = Array.from({ length: 140 }, () => ({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * canvas.height,
        r: 4 + Math.random() * 6,
        c: colors[Math.floor(Math.random() * colors.length)],
        vx: -2 + Math.random() * 4,
        vy: 2 + Math.random() * 4,
        rot: Math.random() * Math.PI,
        vr: -0.2 + Math.random() * 0.4
      }));
      let frame = 0;
      (function tick() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        pieces.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.rot += p.vr;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.c;
          ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
          ctx.restore();
        });
        frame++;
        if (frame < 160) requestAnimationFrame(tick);
        else canvas.remove();
      })();
    },

    /* Friendly message shown when a topic has no content yet. */
    notice(stage, title, message, api) {
      stage.appendChild(
        el("div", { class: "result-card" }, [
          el("div", { class: "result-emoji", text: "📝" }),
          el("h2", { text: title }),
          el("p", { class: "result-score", text: message }),
          el("div", { class: "result-actions" }, [
            el("button", { class: "btn", text: "Other topic", on: { click: api.backToTopics } }),
            el("button", { class: "btn ghost", text: "Menu", on: { click: api.exit } })
          ])
        ])
      );
    }
  };

  /* ---- score / session state --------------------------------------- */
  const state = {
    score: 0,
    muted: false
  };

  function addScore(points) {
    state.score += points;
    const badge = document.getElementById("score-value");
    if (badge) {
      badge.textContent = state.score;
      badge.classList.remove("pulse");
      void badge.offsetWidth; // restart animation
      badge.classList.add("pulse");
    }
  }

  /* ---- top bar (persistent) ---------------------------------------- */
  function renderTopBar() {
    const bar = el("header", { class: "topbar" }, [
      el("button", {
        class: "brand",
        attrs: { title: "Back to home" },
        on: { click: () => showModeSelect() },
        html:
          '<img class="skb-logo" src="' +
          (window.SkillbeeBrand ? window.SkillbeeBrand.logoWhite : "") +
          '" alt="Skillbee" />' +
          '<span class="brand-text"><b>Deutsch</b> Games</span>'
      }),
      el("div", { class: "topbar-right" }, [
        el("div", { class: "score-badge", attrs: { title: "Points this session" } }, [
          el("span", { class: "score-star", html: "⭐" }),
          el("span", { class: "score-value", attrs: { id: "score-value" }, text: "0" })
        ]),
        el("button", {
          class: "icon-btn",
          attrs: { id: "voice-btn", title: "Voice settings" },
          html: "🎙️",
          on: { click: () => { if (window.VoiceBox) window.VoiceBox.openSettings(); } }
        }),
        el("button", {
          class: "icon-btn",
          attrs: { id: "mute-btn", title: "Sound on/off" },
          html: "🔊",
          on: {
            click: (e) => {
              state.muted = !state.muted;
              e.currentTarget.innerHTML = state.muted ? "🔇" : "🔊";
            }
          }
        })
      ])
    ]);
    return bar;
  }

  /* ---- home screen (the lobby) ------------------------------------- */
  /* The admin gear is teacher-only: shown in Solo mode, hidden on the mode
     picker and everywhere in Live Mode (so students on phones can't reach it). */
  function setAdminVisible(v) {
    const b = document.getElementById("admin-btn");
    if (b) b.style.display = v ? "" : "none";
  }

  function showModeSelect() {
    if (window.LiveMode) window.LiveMode.stop();
    setAdminVisible(false);
    window.speechSynthesis && window.speechSynthesis.cancel();
    const main = document.getElementById("screen");
    main.innerHTML = "";
    main.appendChild(
      el("section", { class: "hero" }, [
        el("h1", { class: "hero-title", html: 'Skillbee <span>Deutsch</span> Games' }),
        el("p", { class: "hero-sub", text: "Choose how you want to play." })
      ])
    );
    const modeGrid = el("div", { class: "mode-grid" });
    modeGrid.appendChild(
      el("button", { class: "mode-card solo", on: { click: () => showHome() } }, [
        el("div", { class: "mode-emoji", text: "🎮" }),
        el("div", { class: "mode-name", text: "Solo / Offline" }),
        el("div", { class: "mode-desc", text: "Practice on one device — works without internet. Great for a single learner or a station." })
      ])
    );
    modeGrid.appendChild(
      el("button", { class: "mode-card live", on: { click: () => showLive() } }, [
        el("div", { class: "mode-emoji", text: "📡" }),
        el("div", { class: "mode-name", text: "Live Class Mode" }),
        el("div", { class: "mode-desc", text: "Teacher hosts on the smartboard, students play on their phones — room code, live scoring, leaderboard." })
      ])
    );
    main.appendChild(modeGrid);
  }

  function showLive() {
    setAdminVisible(false);
    const main = document.getElementById("screen");
    main.innerHTML = "";
    if (window.LiveMode) {
      window.LiveMode.start(main, { el, kit, store: window.ContentStore, back: () => showModeSelect() });
    }
  }

  function showHome() {
    if (window.LiveMode) window.LiveMode.stop();
    setAdminVisible(true);
    window.speechSynthesis && window.speechSynthesis.cancel();
    const main = document.getElementById("screen");
    main.innerHTML = "";

    main.appendChild(
      el("div", { class: "screen-back" }, [
        el("button", { class: "back-link", html: "← Modes", on: { click: () => showModeSelect() } })
      ])
    );

    main.appendChild(
      el("section", { class: "hero" }, [
        el("h1", { class: "hero-title", html: 'Welcome! Pick a <span>game</span> 🎲' }),
        el("p", {
          class: "hero-sub",
          text: "Gamify your German lessons — pick a game, choose a topic, and play with the class."
        })
      ])
    );

    const grid = el("div", { class: "game-grid" });
    games.forEach((game) => {
      grid.appendChild(
        el(
          "button",
          {
            class: "game-card",
            attrs: { style: `--accent:${game.color || "#1982c4"}` },
            on: { click: () => openTopicPicker(game) }
          },
          [
            el("div", { class: "game-emoji", text: game.emoji }),
            el("div", { class: "game-name", text: game.name }),
            el("div", { class: "game-desc", text: game.description }),
            el("div", { class: "game-play", html: "Spielen →" })
          ]
        )
      );
    });
    main.appendChild(grid);

    main.appendChild(
      el("footer", { class: "home-foot" }, [
        el("div", {
          class: "foot-note",
          html: "Made for Skillbee German teachers · Tip: press <kbd>F11</kbd> for full-screen in class"
        })
      ])
    );
  }

  /* ---- exercise picker (shown before a game starts) ---------------- */
  function openTopicPicker(game) {
    const main = document.getElementById("screen");
    main.innerHTML = "";

    main.appendChild(
      el("div", { class: "picker" }, [
        el("button", { class: "back-link", html: "← Back", on: { click: () => showHome() } }),
        el("h2", { class: "picker-title", html: `${game.emoji} ${game.name}` }),
        el("p", { class: "picker-sub", text: "Choose an exercise:" })
      ])
    );

    // Live-derived Solo games supply their own topic list (built from their
    // adapter); plain word/sentence games list their exercises directly.
    let topics, makeCard;
    if (typeof game.getTopics === "function") {
      topics = game.getTopics() || [];
      makeCard = (t) =>
        el("button", { class: "topic-card", on: { click: () => launch(game, t) } }, [
          el("div", { class: "topic-emoji", text: t.emoji || game.emoji }),
          el("div", { class: "topic-name", text: t.name }),
          el("div", { class: "topic-count", text: t.english || "" })
        ]);
    } else {
      const usesSentences = game.contentType === "sentences";
      topics = window.ContentStore.exercisesFor(game.id);
      makeCard = (ex) => {
        const count = usesSentences ? (ex.sentences || []).length : (ex.words || []).length;
        return el("button", { class: "topic-card", on: { click: () => launch(game, ex) } }, [
          el("div", { class: "topic-emoji", text: ex.emoji || (usesSentences ? "🗣️" : "📚") }),
          el("div", { class: "topic-name", text: ex.name }),
          el("div", { class: "topic-en", text: ex.english || "" }),
          el("div", { class: "topic-count", text: `${count} ${usesSentences ? "sentences" : "words"}` })
        ]);
      };
    }

    if (!topics.length) {
      main.appendChild(
        el("p", {
          class: "picker-empty",
          html: "No exercises for this game yet. Add one in <b>⚙️ Manage content</b>."
        })
      );
      return;
    }

    const grid = el("div", { class: "topic-grid" });
    topics.forEach((t) => grid.appendChild(makeCard(t)));
    main.appendChild(grid);
  }

  /* ---- launch a game with a chosen topic --------------------------- */
  function launch(game, topic) {
    const main = document.getElementById("screen");
    main.innerHTML = "";
    const stage = el("div", { class: "stage" });
    main.appendChild(stage);

    const api = {
      kit,
      topic,
      addScore,
      el,
      exit: () => showHome(),
      restart: () => launch(game, topic),
      backToTopics: () => openTopicPicker(game)
    };
    game.mount(stage, api);
  }

  /* ---- admin screen (content editor) ------------------------------- */
  function showAdmin(onExit) {
    // Teacher PIN gate (only enforced online); once unlocked, opens the editor.
    if (window.TeacherGate) window.TeacherGate.require(() => openAdmin(onExit));
    else openAdmin(onExit);
  }

  function openAdmin(onExit) {
    if (window.LiveMode) window.LiveMode.stop();
    setAdminVisible(false);
    window.speechSynthesis && window.speechSynthesis.cancel();
    const main = document.getElementById("screen");
    main.innerHTML = "";
    const container = el("div", { class: "admin" });
    main.appendChild(container);
    if (window.AdminUI) {
      window.AdminUI.mount(container, {
        el,
        kit,
        store: window.ContentStore,
        // Live-wrapped Solo games are excluded here — their content is edited
        // under the Live games, so listing them again would duplicate editors.
        games: games.filter((g) => !g.liveWrapped).map((g) => ({ id: g.id, name: g.name, emoji: g.emoji, color: g.color, contentType: g.contentType })),
        onExit: typeof onExit === "function" ? onExit : () => showHome()
      });
    }
  }

  /* ---- public API -------------------------------------------------- */
  function register(game) {
    games.push(game);
  }

  /* A fixed, decorative backdrop of floating doodles (gems, sparkles, German
     letters, a speech bubble) behind everything. Pure SVG so it stays crisp on
     a projector and works offline; content sits on opaque cards above it. */
  function renderBackdrop() {
    var bg = document.createElement("div");
    bg.className = "app-bg";
    bg.setAttribute("aria-hidden", "true");
    var gem = function (fill, op, facet) {
      return '<path d="M50 20 78 44 50 86 22 44Z" fill="' + fill + '" opacity="' + op + '"/>' +
        (facet ? '<path d="M22 44 50 56 78 44" stroke="' + fill + '" stroke-opacity="0.28" stroke-width="3" fill="none"/>' : '');
    };
    var star = function (fill, op) {
      return '<path d="M20 2 24 16 38 20 24 24 20 38 16 24 2 20 16 16Z" fill="' + fill + '" opacity="' + op + '"/>';
    };
    bg.innerHTML =
      '<svg class="ab ab-float" style="top:11%;left:4%" width="72" height="72" viewBox="0 0 100 100">' + gem("#0A84FF", 0.16, true) + '</svg>' +
      '<svg class="ab ab-float s2" style="bottom:12%;left:6%" width="54" height="54" viewBox="0 0 100 100">' + gem("#7A2BFF", 0.15, false) + '</svg>' +
      '<svg class="ab ab-float s3" style="top:16%;right:5%" width="60" height="60" viewBox="0 0 100 100">' + gem("#0B3FDD", 0.15, false) + '</svg>' +
      '<svg class="ab ab-float s2" style="bottom:16%;right:4%" width="46" height="46" viewBox="0 0 100 100">' + gem("#0A84FF", 0.14, false) + '</svg>' +
      '<svg class="ab ab-float" style="top:45%;left:2.5%" width="30" height="30" viewBox="0 0 40 40">' + star("#FFB703", 0.45) + '</svg>' +
      '<svg class="ab ab-float s3 ab-sm" style="bottom:30%;right:8%" width="26" height="26" viewBox="0 0 40 40">' + star("#0A84FF", 0.4) + '</svg>' +
      '<div class="ab ab-float s2 ab-letter ab-sm" style="top:12%;right:24%;font-size:3.4rem;color:#0A84FF;opacity:.11">ä</div>' +
      '<div class="ab ab-float ab-letter ab-sm" style="bottom:13%;right:21%;font-size:3rem;color:#7A2BFF;opacity:.11">ü</div>' +
      '<div class="ab ab-float s3 ab-letter ab-sm" style="bottom:34%;left:20%;font-size:2.6rem;color:#0B3FDD;opacity:.11">ß</div>' +
      '<svg class="ab ab-float ab-sm" style="top:36%;right:10%" width="90" height="74" viewBox="0 0 120 100">' +
        '<rect x="6" y="6" width="108" height="66" rx="20" fill="#0A84FF" opacity="0.12"/>' +
        '<path d="M30 70 26 92 50 70Z" fill="#0A84FF" opacity="0.12"/>' +
        '<text x="60" y="47" text-anchor="middle" font-family="' + "inherit" + '" font-weight="900" font-size="26" fill="#0B3FDD" fill-opacity="0.45">Hallo!</text>' +
      '</svg>';
    document.body.insertBefore(bg, document.body.firstChild);
  }

  function init() {
    root = document.getElementById("app");
    renderBackdrop();
    // Set the browser-tab icon to the official Skillbee badge.
    if (window.SkillbeeBrand && window.SkillbeeBrand.favicon) {
      let link = document.querySelector('link[rel="icon"]');
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = window.SkillbeeBrand.favicon;
    }
    root.appendChild(renderTopBar());
    root.appendChild(el("main", { class: "screen", attrs: { id: "screen" } }));
    // Warm up voices list for speech synthesis.
    if ("speechSynthesis" in window) window.speechSynthesis.getVoices();
    // Start cloud content sync now that Firebase (if present) has loaded.
    if (window.ContentStore && window.ContentStore.initCloud) window.ContentStore.initCloud();
    showModeSelect();
  }

  return { register, init, kit, state, addScore, showHome, showAdmin, showModeSelect, showLive, setAdminVisible };
})();

window.App = App;
document.addEventListener("DOMContentLoaded", App.init);
