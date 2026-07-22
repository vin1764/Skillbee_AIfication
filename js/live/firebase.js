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
      if (window.__FIRESTORE_EMULATOR__) {
        // Test-only: point at a local Firestore emulator. Never set in production.
        try { db.useEmulator(window.__FIRESTORE_EMULATOR__.host, window.__FIRESTORE_EMULATOR__.port); } catch (e) {}
      } else {
        // Long-polling is more reliable behind corporate/school proxies than
        // the default streaming transport.
        try {
          db.settings({ experimentalForceLongPolling: true, useFetchStreams: false });
        } catch (e) {}
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
    joinSession: function (code, studentId, studentName) {
      var patch = { joined: {} };
      patch.joined[studentId] = { name: studentName, at: Date.now() };
      return db.collection("sessions").doc(code).set(patch, { merge: true });
    },

    /* ---------------- answers ---------------- */
    submitAnswer: function (code, qIndex, studentId, payload) {
      var id = qIndex + "_" + studentId; // one answer per student per question
      var ref = db.collection("sessions").doc(code).collection("answers").doc(id);
      return ref.set(Object.assign({ questionIndex: qIndex, studentId: studentId, ts: serverTs() }, payload));
    },
    // Per-match progress for the individual match game (Hör-Paare). Each matched
    // pair — and the final "done" state — is its own write-once document, so the
    // host can show a live progress bar per student. `key` (the running matched
    // count) makes each id unique per milestone. Reuses the same write-once
    // answers rule, so no security-rules change is needed.
    submitProgress: function (code, qIndex, studentId, key, payload) {
      var id = qIndex + "_" + studentId + "_" + key;
      var ref = db.collection("sessions").doc(code).collection("answers").doc(id);
      return ref.set(Object.assign({ questionIndex: qIndex, studentId: studentId, ts: serverTs() }, payload));
    },
    listenAnswers: function (code, qIndex, cb) {
      return db
        .collection("sessions").doc(code).collection("answers")
        .where("questionIndex", "==", qIndex)
        .onSnapshot(
          function (snap) {
            var arr = [];
            snap.forEach(function (d) { arr.push(d.data()); });
            cb(arr);
          },
          function (e) { cb([], e); }
        );
    },
    getAnswers: function (code, qIndex) {
      return db
        .collection("sessions").doc(code).collection("answers")
        .where("questionIndex", "==", qIndex)
        .get()
        .then(function (snap) {
          var arr = [];
          snap.forEach(function (d) { arr.push(d.data()); });
          return arr;
        });
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
    setContent: function (payload) {
      // Full overwrite — the whole content bank is written each time.
      return db.collection("content").doc("bank").set(payload);
    },
    listenContent: function (cb) {
      return db.collection("content").doc("bank").onSnapshot(
        function (d) { cb(d.exists ? d.data() : null); },
        function () { /* ignore transient listen errors */ }
      );
    },

    /* ---------------- cumulative leaderboards ---------------- */
    getLeaderboard: function (rosterId) {
      return db.collection("leaderboards").doc(rosterId).get().then(function (d) {
        return d.exists ? d.data() : { scores: {} };
      });
    },
    saveLeaderboard: function (rosterId, scores) {
      return db.collection("leaderboards").doc(rosterId).set(
        { scores: scores, updatedAt: serverTs() },
        { merge: true }
      );
    }
  };

  window.LiveDB = LiveDB;
})();
