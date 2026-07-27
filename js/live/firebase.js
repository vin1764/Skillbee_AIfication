/* =====================================================================
   LiveDB — thin wrapper around Firebase Firestore for Live Class Mode.
   Loaded only in the hosted (online) app; the offline file has no
   Firebase, so LiveDB.available() returns false and Live Mode shows a
   friendly "online only" message instead of breaking.
   ===================================================================== */
(function () {
  var firebaseConfig = {
    apiKey: "AIzaSyB6cUPKYzxb_HFpyISG5k5yok_zUWbmgDw",
    authDomain: "skillbee-gamification.firebaseapp.com",
    projectId: "skillbee-gamification",
    storageBucket: "skillbee-gamification.firebasestorage.app",
    messagingSenderId: "826364816558",
    appId: "1:826364816558:web:59abca483a808e52f6513f"
  };

  var db = null;
  var initError = null;

  (function init() {
    try {
      if (typeof firebase === "undefined" || !firebase.initializeApp) {
        initError = "no-sdk";
        return;
      }
      firebase.initializeApp(firebaseConfig);
      db = firebase.firestore();
      // ignoreUndefinedProperties: without it, ONE `undefined` field anywhere in
      // a payload makes the SDK throw the entire write away — synchronously,
      // inside whichever click handler asked for it (this froze the host's
      // Reveal button in every game whose scorer omitted a field). Dropping the
      // stray field is always better than losing the write.
      var settings = { ignoreUndefinedProperties: true };
      if (!window.__FIRESTORE_EMULATOR__) {
        // Long-polling is more reliable behind corporate/school proxies than
        // the default streaming transport.
        settings.experimentalForceLongPolling = true;
        settings.useFetchStreams = false;
      }
      try { db.settings(settings); } catch (e) {}
      if (window.__FIRESTORE_EMULATOR__) {
        // Test-only: point at a local Firestore emulator. Never set in production.
        try { db.useEmulator(window.__FIRESTORE_EMULATOR__.host, window.__FIRESTORE_EMULATOR__.port); } catch (e) {}
      }
    } catch (e) {
      initError = e;
    }
  })();

  function serverTs() {
    return firebase.firestore.FieldValue.serverTimestamp();
  }

  var ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 to avoid confusion
  function genCode() {
    var c = "";
    for (var i = 0; i < 4; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    return c;
  }

  var LiveDB = {
    available: function () {
      return !!db;
    },
    error: function () {
      return initError;
    },
    serverTs: serverTs,

    /* ---------------- rosters ---------------- */
    createRoster: function (name, students) {
      var ref = db.collection("rosters").doc();
      return ref.set({ name: name, students: students, createdAt: serverTs() }).then(function () {
        return ref.id;
      });
    },
    updateRoster: function (id, data) {
      return db.collection("rosters").doc(id).set(data, { merge: true });
    },
    deleteRoster: function (id) {
      return db.collection("rosters").doc(id).delete();
    },
    getRoster: function (id) {
      return db.collection("rosters").doc(id).get().then(function (d) {
        return d.exists ? Object.assign({ id: d.id }, d.data()) : null;
      });
    },

    /* ---------------- sessions ---------------- */
    createSession: function (data) {
      function attempt(tries) {
        var code = genCode();
        var ref = db.collection("sessions").doc(code);
        return ref.get().then(function (d) {
          if (d.exists && tries < 10) return attempt(tries + 1);
          return ref.set(Object.assign({ createdAt: serverTs() }, data)).then(function () {
            return code;
          });
        });
      }
      return attempt(0);
    },
    getSession: function (code) {
      return db.collection("sessions").doc(code).get().then(function (d) {
        return d.exists ? Object.assign({ code: d.id }, d.data()) : null;
      });
    },
    listenSession: function (code, cb) {
      return db.collection("sessions").doc(code).onSnapshot(
        function (d) {
          cb(d.exists ? Object.assign({ code: d.id }, d.data()) : null, null);
        },
        function (e) {
          cb(null, e);
        }
      );
    },
    updateSession: function (code, data) {
      return db.collection("sessions").doc(code).set(data, { merge: true });
    },
    // A student's claimed roster slot lives in its OWN document at
    // sessions/{code}/joined/{studentId}, with a heartbeat the client refreshes.
    // A name is "free" again once its heartbeat is older than JOIN_STALE_MS.
    JOIN_STALE_MS: 15000, // 15s (~3 missed 5s heartbeats) — see claimName/presence

    // A stable per-BROWSER token so we can tell "the same phone reconnecting"
    // (allowed to keep its name) from "a different phone grabbing the same name"
    // (refused). Two students can't be distinguished by (id, name) alone.
    deviceToken: function () {
      try {
        var t = localStorage.getItem("skillbee_device_token");
        if (!t) { t = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem("skillbee_device_token", t); }
        return t;
      } catch (e) { return "d-" + Math.random().toString(36).slice(2); }
    },

    // The claim/heartbeat presence system needs the NEWER firestore.rules (the
    // sessions/{code}/joined subcollection block). Rules deploy MANUALLY in the
    // Firebase console — GitHub Pages only publishes the app — so a newer app
    // can meet an older ruleset, where every /joined access is denied and nobody
    // can join any room. Never hard-depend on that infra step: on the first
    // permission-denied we flip to the legacy session-doc `joined` map (allowed
    // by every ruleset this app has shipped). Joining then works exactly as it
    // did pre-presence; only stale-name detection is lost until the rules from
    // firestore.rules are pasted into the console.
    _joinLegacy: false,
    _legacyClaim: function (code, studentId, studentName) {
      var patch = { joined: {} };
      patch.joined[studentId] = { name: studentName, at: Date.now() };
      return db.collection("sessions").doc(code).set(patch, { merge: true }).then(function () { return true; });
    },
    _isDenied: function (e) { return !!(e && e.code === "permission-denied"); },

    // Claim a name ATOMICALLY. A Firestore transaction makes the read-check-write
    // one indivisible step: if two DIFFERENT phones tap the same name at once, one
    // wins and the other's transaction retries, sees the fresh claim by a
    // different owner, and fails with { code:"name-taken" } — no silent overwrite.
    // The true owner may always re-claim (reconnect); a slot whose heartbeat has
    // gone stale (owner gone) is reclaimable by anyone.
    claimName: function (code, studentId, studentName, owner) {
      if (LiveDB._joinLegacy) return LiveDB._legacyClaim(code, studentId, studentName);
      var ref = db.collection("sessions").doc(code).collection("joined").doc(studentId);
      var STALE = LiveDB.JOIN_STALE_MS;
      return db.runTransaction(function (tx) {
        return tx.get(ref).then(function (d) {
          if (d.exists) {
            var data = d.data() || {};
            var hb = data.heartbeat;
            var ms = (hb && hb.toMillis) ? hb.toMillis() : 0;
            // Held by a DIFFERENT device with a fresh heartbeat — refuse.
            if (ms && (Date.now() - ms) < STALE && data.owner !== owner) {
              return Promise.reject({ code: "name-taken" });
            }
          }
          tx.set(ref, { name: studentName, owner: owner, joinedAt: serverTs(), heartbeat: serverTs() });
          return null;
        });
      }).then(function () { return true; }).catch(function (e) {
        if (LiveDB._isDenied(e)) {
          LiveDB._joinLegacy = true;
          return LiveDB._legacyClaim(code, studentId, studentName);
        }
        return Promise.reject(e);
      });
    },
    // Refresh this student's heartbeat (called every few seconds while joined).
    heartbeat: function (code, studentId) {
      if (LiveDB._joinLegacy) return Promise.resolve(); // no presence system to feed
      return db.collection("sessions").doc(code).collection("joined").doc(studentId)
        .set({ heartbeat: serverTs() }, { merge: true })
        .catch(function (e) { if (LiveDB._isDenied(e)) LiveDB._joinLegacy = true; });
    },
    // Explicitly give up a slot (tab close / leave) so the name frees instantly.
    leaveSession: function (code, studentId) {
      function legacyLeave() {
        var patch = { joined: {} };
        patch.joined[studentId] = firebase.firestore.FieldValue.delete();
        return db.collection("sessions").doc(code).set(patch, { merge: true }).catch(function () {});
      }
      if (LiveDB._joinLegacy) return legacyLeave();
      return db.collection("sessions").doc(code).collection("joined").doc(studentId)
        .delete().catch(function (e) {
          if (LiveDB._isDenied(e)) { LiveDB._joinLegacy = true; return legacyLeave(); }
        });
    },
    // Live view of every claimed slot: [{ id, name, heartbeat(ms) }]. A pending
    // serverTimestamp reads back null momentarily — treat that as "just now".
    listenJoined: function (code, cb) {
      // Legacy source: adapt the session doc's `joined` map to the same shape.
      // It has no heartbeats, so report every joined name as fresh — joined
      // students simply always count as present (the pre-presence behavior).
      function listenLegacy() {
        return db.collection("sessions").doc(code).onSnapshot(
          function (d) {
            var j = (d.exists && d.data().joined) || {};
            cb(Object.keys(j).map(function (id) {
              return { id: id, name: (j[id] && j[id].name) || "", heartbeat: Date.now() };
            }));
          },
          function () { cb([]); }
        );
      }
      if (LiveDB._joinLegacy) return listenLegacy();
      var inner = db.collection("sessions").doc(code).collection("joined").onSnapshot(
        function (snap) {
          var arr = [];
          snap.forEach(function (d) {
            var x = d.data() || {};
            var hb = (x.heartbeat && x.heartbeat.toMillis) ? x.heartbeat.toMillis() : Date.now();
            arr.push({ id: d.id, name: x.name, heartbeat: hb });
          });
          cb(arr);
        },
        function (e) {
          // A listen error is terminal for this listener. If it's the rules
          // gap, swap to the legacy source in place — same cb, same unsub.
          if (LiveDB._isDenied(e)) { LiveDB._joinLegacy = true; inner = listenLegacy(); return; }
          cb([]);
        }
      );
      return function () { try { inner(); } catch (e) {} };
    },

    /* ---------------- answers ---------------- */
    // Answers are WRITE-ONCE documents (the rules forbid updates), and one room
    // hosts MANY games via "Play another game". Every answer is therefore
    // namespaced by `seq` (the session's gameSeq): without it, game 2's
    // question 0 would collide with game 1's docs — the new answers rejected by
    // write-once, and the host re-scoring game 1's stale answers.
    submitAnswer: function (code, qIndex, studentId, payload, seq) {
      seq = seq || 0;
      var id = seq + "_" + qIndex + "_" + studentId; // one answer per student per question per game
      var ref = db.collection("sessions").doc(code).collection("answers").doc(id);
      return ref.set(Object.assign({ questionIndex: qIndex, gameSeq: seq, studentId: studentId, ts: serverTs() }, payload));
    },
    // Per-match progress for the individual match game (Hör-Paare). Each matched
    // pair — and the final "done" state — is its own write-once document, so the
    // host can show a live progress bar per student. `key` (the running matched
    // count) makes each id unique per milestone. Reuses the same write-once
    // answers rule, so no security-rules change is needed.
    submitProgress: function (code, qIndex, studentId, key, payload, seq) {
      seq = seq || 0;
      var id = seq + "_" + qIndex + "_" + studentId + "_" + key;
      var ref = db.collection("sessions").doc(code).collection("answers").doc(id);
      return ref.set(Object.assign({ questionIndex: qIndex, gameSeq: seq, studentId: studentId, ts: serverTs() }, payload));
    },
    // Both equality filters together need no composite index (zig-zag merge).
    listenAnswers: function (code, qIndex, cb, seq) {
      return db
        .collection("sessions").doc(code).collection("answers")
        .where("questionIndex", "==", qIndex)
        .where("gameSeq", "==", seq || 0)
        .onSnapshot(
          function (snap) {
            var arr = [];
            snap.forEach(function (d) { arr.push(d.data()); });
            cb(arr);
          },
          function (e) { cb([], e); }
        );
    },
    getAnswers: function (code, qIndex, seq) {
      return db
        .collection("sessions").doc(code).collection("answers")
        .where("questionIndex", "==", qIndex)
        .where("gameSeq", "==", seq || 0)
        .get()
        .then(function (snap) {
          var arr = [];
          snap.forEach(function (d) { arr.push(d.data()); });
          return arr;
        });
    },
    // Speed Challenge answers. The deployed security rules only accept an
    // answer while the session has status "question" AND the answer's
    // questionIndex equals round.index — so Speed runs under status "question"
    // with this sentinel round index, which every speed answer carries; the
    // student's REAL position rides in `pos` (the doc id keeps one write-once
    // doc per position per student per game).
    SPEED_ROUND_INDEX: -9,
    submitSpeedAnswer: function (code, pos, studentId, payload, seq) {
      seq = seq || 0;
      var id = seq + "_s" + pos + "_" + studentId;
      var ref = db.collection("sessions").doc(code).collection("answers").doc(id);
      return ref.set(Object.assign({ questionIndex: LiveDB.SPEED_ROUND_INDEX, pos: pos, gameSeq: seq, studentId: studentId, ts: serverTs() }, payload));
    },
    // Speed Challenge is student-paced: every phone is on its own question, so the
    // host can't watch "the current question" — it watches every answer OF THIS
    // GAME (gameSeq-filtered, like listenAnswers: a room hosts many games) and
    // derives each student's progress + running score from it.
    listenAllAnswers: function (code, cb, seq) {
      return db
        .collection("sessions").doc(code).collection("answers")
        .where("gameSeq", "==", seq || 0)
        .onSnapshot(
          function (snap) {
            var arr = [];
            snap.forEach(function (d) { arr.push(d.data()); });
            cb(arr);
          },
          function (e) { cb([], e); }
        );
    },

    /* ---------------- teacher PIN config ---------------- */
    getConfig: function () {
      return db.collection("config").doc("teacher").get().then(function (d) {
        return d.exists ? d.data() : null;
      });
    },
    setConfig: function (data) {
      return db.collection("config").doc("teacher").set(data, { merge: true });
    },

    /* ---------------- shared content bank (cloud sync) ---------------- */
    getContent: function () {
      return db.collection("content").doc("bank").get().then(function (d) {
        return d.exists ? d.data() : null;
      });
    },
    // FULL write — seeds an empty cloud, and Reset/Restore (a deliberate
    // wholesale replace). Stamps a SERVER timestamp so ordering never depends
    // on a device's (possibly wrong) clock.
    setContent: function (payload) {
      var body = Object.assign({}, payload, { updatedAt: serverTs() });
      return db.collection("content").doc("bank").set(body);
    },
    // INCREMENTAL write — merges ONLY the changed game sections, so two
    // teachers editing DIFFERENT games can't clobber each other (Firestore
    // deep-merges the nested `data.exercises` map; each game's array is
    // replaced independently). `sections` = { gameKey: [exercises…] }.
    mergeContent: function (sections, clientId) {
      return db.collection("content").doc("bank").set(
        { data: { exercises: sections }, clientId: clientId, updatedAt: serverTs() },
        { merge: true }
      );
    },
    listenContent: function (cb) {
      return db.collection("content").doc("bank").onSnapshot(
        function (d) { cb(d.exists ? d.data() : null); },
        function () { /* ignore transient listen errors */ }
      );
    },

    /* ---------------- cumulative (term) leaderboards ---------------- */
    getLeaderboard: function (rosterId) {
      return db.collection("leaderboards").doc(rosterId).get().then(function (d) {
        return d.exists ? d.data() : { scores: {} };
      });
    },
    // Term leaderboards are ONLY EVER ADDED TO — never overwritten. Each call
    // atomically increments the given students' totals by the points they just
    // earned (a per-round delta), so an interrupted class keeps everything
    // earned so far and two rooms can't clobber the running totals.
    addToLeaderboard: function (rosterId, deltas) {
      var FV = firebase.firestore.FieldValue;
      var inc = {};
      Object.keys(deltas || {}).forEach(function (k) {
        var v = Number(deltas[k]) || 0;
        if (v) inc[k] = FV.increment(v);
      });
      if (!Object.keys(inc).length) return Promise.resolve();
      return db.collection("leaderboards").doc(rosterId).set(
        { scores: inc, updatedAt: serverTs() },
        { merge: true }
      );
    },
    // Kept for backup/compat; the game flow uses addToLeaderboard (additive).
    saveLeaderboard: function (rosterId, scores) {
      return db.collection("leaderboards").doc(rosterId).set(
        { scores: scores, updatedAt: serverTs() },
        { merge: true }
      );
    }
  };

  window.LiveDB = LiveDB;
})();
