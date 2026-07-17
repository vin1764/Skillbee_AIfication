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

    /* Speak German out loud (browser text-to-speech). */
    speak(text, lang = "de-DE") {
      try {
        if (!("speechSynthesis" in window)) return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang;
        u.rate = 0.95;
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
      const colors = ["#ffd60a", "#ff595e", "#1982c4", "#8ac926", "#6a4c93", "#ff924c"];
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
        on: { click: () => showHome() },
        html:
          '<img class="skb-logo" src="' +
          (window.SkillbeeBrand ? window.SkillbeeBrand.logoWhite : "") +
          '" alt="Skillbee" />' +
          '<span class="brand-text"><b>Deutsch</b> Games</span>'
      }),
      el("div", { class: "topbar-right" }, [
        el("button", {
          class: "icon-btn",
          attrs: { id: "admin-btn", title: "Manage content" },
          html: "⚙️",
          on: { click: () => showAdmin() }
        }),
        el("div", { class: "score-badge", attrs: { title: "Points this session" } }, [
          el("span", { class: "score-star", html: "⭐" }),
          el("span", { class: "score-value", attrs: { id: "score-value" }, text: "0" })
        ]),
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
  function showHome() {
    window.speechSynthesis && window.speechSynthesis.cancel();
    const main = document.getElementById("screen");
    main.innerHTML = "";

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
        el("button", {
          class: "foot-admin",
          html: "⚙️ Manage content",
          on: { click: () => showAdmin() }
        }),
        el("div", {
          class: "foot-note",
          html: "Made for Skillbee German teachers · Tip: press <kbd>F11</kbd> for full-screen in class"
        })
      ])
    );
  }

  /* ---- topic picker (shown before a game starts) ------------------- */
  function openTopicPicker(game) {
    const usesSentences = game.contentType === "sentences";
    const topics = window.ContentStore.topicsForGame(game.id, usesSentences ? "sentences" : "vocab");
    const main = document.getElementById("screen");
    main.innerHTML = "";

    main.appendChild(
      el("div", { class: "picker" }, [
        el("button", { class: "back-link", html: "← Back", on: { click: () => showHome() } }),
        el("h2", { class: "picker-title", html: `${game.emoji} ${game.name}` }),
        el("p", { class: "picker-sub", text: usesSentences ? "Choose a topic for the sentences:" : "Choose a vocabulary topic:" })
      ])
    );

    if (!topics.length) {
      main.appendChild(
        el("p", {
          class: "picker-empty",
          html: "No topics are enabled for this game yet. Add or enable topics in <b>⚙️ Manage content → Games</b>."
        })
      );
      return;
    }

    const grid = el("div", { class: "topic-grid" });
    topics.forEach((topic) => {
      const count = usesSentences ? topic.sentences.length : topic.words.length;
      grid.appendChild(
        el(
          "button",
          { class: "topic-card", on: { click: () => launch(game, topic) } },
          [
            el("div", { class: "topic-emoji", text: topic.emoji }),
            el("div", { class: "topic-name", text: topic.name }),
            el("div", { class: "topic-en", text: topic.english }),
            el("div", { class: "topic-count", text: `${count} ${usesSentences ? "sentences" : "words"}` })
          ]
        )
      );
    });
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
  function showAdmin() {
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
        games: games.map((g) => ({ id: g.id, name: g.name, emoji: g.emoji, color: g.color, contentType: g.contentType })),
        onExit: () => showHome()
      });
    }
  }

  /* ---- public API -------------------------------------------------- */
  function register(game) {
    games.push(game);
  }

  function init() {
    root = document.getElementById("app");
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
    showHome();
  }

  return { register, init, kit, state, addScore, showHome, showAdmin };
})();

window.App = App;
document.addEventListener("DOMContentLoaded", App.init);
