/* =====================================================================
   TeacherGate — a lightweight 4-digit PIN that unlocks teacher-only
   actions (hosting a live class, and the content editor).
   • The PIN is stored in Firestore (shared across devices) and cached
     locally, so students on their own phones are actually gated.
   • It is set once by the teacher on first use.
   • Only enforced when online (Firebase available). Offline single-device
     play stays ungated — there's no sharing and edits are local-only.
   • Once entered, it stays unlocked for the browser session.
   ===================================================================== */
window.TeacherGate = (function () {
  var UNLOCK_KEY = "skillbee_teacher_unlocked"; // sessionStorage
  var PIN_CACHE = "skillbee_teacher_pin";       // localStorage (hashed)

  function hashPin(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) { h = ((h << 5) + h) + s.charCodeAt(i); h = h & 0xffffffff; }
    return "h" + (h >>> 0).toString(36);
  }

  function gated() { return !!(window.LiveDB && window.LiveDB.available()); }
  function isUnlocked() { try { return sessionStorage.getItem(UNLOCK_KEY) === "1"; } catch (e) { return false; } }
  function unlock() { try { sessionStorage.setItem(UNLOCK_KEY, "1"); } catch (e) {} }
  function lock() { try { sessionStorage.removeItem(UNLOCK_KEY); } catch (e) {} }

  function loadStoredHash() {
    if (gated()) {
      return window.LiveDB.getConfig().then(function (c) {
        var h = c && c.pin ? c.pin : null;
        try { if (h) localStorage.setItem(PIN_CACHE, h); } catch (e) {}
        return h;
      }).catch(function () { try { return localStorage.getItem(PIN_CACHE) || null; } catch (e) { return null; } });
    }
    try { return Promise.resolve(localStorage.getItem(PIN_CACHE) || null); } catch (e) { return Promise.resolve(null); }
  }
  function saveHash(h) {
    try { localStorage.setItem(PIN_CACHE, h); } catch (e) {}
    if (gated()) return window.LiveDB.setConfig({ pin: h });
    return Promise.resolve();
  }

  /* ---- tap-friendly PIN keypad modal ---- */
  function modal(opts) {
    var overlay = document.createElement("div"); overlay.className = "pin-overlay";
    var card = document.createElement("div"); card.className = "pin-card";
    var title = document.createElement("div"); title.className = "pin-title"; title.textContent = opts.title; card.appendChild(title);
    var sub = document.createElement("div"); sub.className = "pin-sub"; sub.textContent = opts.sub || ""; card.appendChild(sub);
    var dots = document.createElement("div"); dots.className = "pin-dots";
    var dotEls = [];
    for (var i = 0; i < 4; i++) { var d = document.createElement("span"); d.className = "pin-dot"; dots.appendChild(d); dotEls.push(d); }
    card.appendChild(dots);
    var errEl = document.createElement("div"); errEl.className = "pin-err"; card.appendChild(errEl);
    var pad = document.createElement("div"); pad.className = "pin-pad";
    var val = "";
    function refresh() { dotEls.forEach(function (d, i) { d.classList.toggle("on", i < val.length); }); }
    function press(n) { if (val.length >= 4) return; val += n; refresh(); if (val.length === 4) { var e = val; setTimeout(function () { opts.onPin(e, api); }, 110); } }
    function del() { val = val.slice(0, -1); refresh(); }
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].forEach(function (k) {
      var b = document.createElement("button");
      b.className = "pin-key" + (k === "" ? " empty" : "");
      b.textContent = k;
      if (k === "") b.disabled = true;
      else if (k === "⌫") b.onclick = del;
      else b.onclick = function () { press(k); };
      pad.appendChild(b);
    });
    card.appendChild(pad);
    var cancel = document.createElement("button"); cancel.className = "pin-cancel"; cancel.textContent = "Cancel";
    function close() { overlay.remove(); }
    cancel.onclick = close;
    card.appendChild(cancel);
    overlay.appendChild(card); document.body.appendChild(overlay);
    var api = {
      error: function (m) { errEl.textContent = m; val = ""; refresh(); card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake"); },
      reset: function () { val = ""; refresh(); errEl.textContent = ""; },
      setTitle: function (t) { title.textContent = t; },
      setSub: function (t) { sub.textContent = t; },
      close: close
    };
    return api;
  }

  function createFlow(onOk) {
    var first = null;
    modal({
      title: "Create a teacher PIN",
      sub: "Set a 4-digit PIN. Students won't know it.",
      onPin: function (pin, a) {
        if (first === null) { first = pin; a.reset(); a.setTitle("Re-enter to confirm"); a.setSub(""); }
        else if (pin === first) { saveHash(hashPin(pin)).then(function () { unlock(); a.close(); onOk(); }); }
        else { first = null; a.setTitle("Create a teacher PIN"); a.error("PINs didn't match — start again"); }
      }
    });
  }

  function require(onOk) {
    if (!gated()) return onOk();       // offline: no gate
    if (isUnlocked()) return onOk();
    loadStoredHash().then(function (stored) {
      if (!stored) return createFlow(onOk);
      modal({
        title: "Enter teacher PIN",
        sub: "Ask your teacher if you don't know it.",
        onPin: function (pin, a) {
          if (hashPin(pin) === stored) { unlock(); a.close(); onOk(); }
          else a.error("Wrong PIN");
        }
      });
    });
  }

  function changePin() {
    var first = null;
    modal({
      title: "New teacher PIN",
      sub: "Enter a new 4-digit PIN",
      onPin: function (pin, a) {
        if (first === null) { first = pin; a.reset(); a.setTitle("Confirm new PIN"); a.setSub(""); }
        else if (pin === first) { saveHash(hashPin(pin)).then(function () { unlock(); a.close(); }); }
        else { first = null; a.setTitle("New teacher PIN"); a.error("PINs didn't match"); }
      }
    });
  }

  return { require: require, isUnlocked: isUnlocked, lock: lock, changePin: changePin, gated: gated };
})();
