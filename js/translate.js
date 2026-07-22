/* =====================================================================
   AutoTranslate — German → English, using the BROWSER'S BUILT-IN
   on-device translator (Chrome / Edge). Same spirit as the built-in
   speech voice: no API key, no server, runs on the device (offline once
   the language model has downloaded once).

   The actual translate call lives behind translateText()/translateBatch()
   so the engine can be swapped later without touching any UI code.

   If the browser has no built-in translator (e.g. Safari, Firefox, older
   Chrome), the feature simply reports "not available" — there is no other
   fallback by design.

   NOTE: exposed as window.AutoTranslate on purpose — NOT window.Translator —
   because modern Chrome exposes a native global called `Translator`, and we
   must not clobber it (we call it).
   ===================================================================== */
(function () {
  var SRC = "de", TGT = "en";
  var _t = null;        // cached translator instance
  var _pending = null;  // in-flight create()

  // Find whichever shape of the built-in translator this browser exposes.
  function factory() {
    try {
      if (typeof self !== "undefined" && self.Translator && typeof self.Translator.create === "function") return self.Translator;             // Chrome 138+ (stable)
      if (typeof self !== "undefined" && self.ai && self.ai.translator && typeof self.ai.translator.create === "function") return self.ai.translator; // earlier shape
    } catch (e) {}
    return null;
  }

  // Is a built-in translator present at all? (Sync — safe to gate UI on.)
  function supported() { return !!factory(); }

  function notSupported() {
    var e = new Error("This browser has no built-in translator.");
    e.code = "unsupported";
    return e;
  }

  // 'available' | 'downloadable' | 'downloading' | 'unavailable'
  function availability() {
    var f = factory();
    if (!f) return Promise.resolve("unavailable");
    try {
      if (typeof f.availability === "function") {
        return Promise.resolve(f.availability({ sourceLanguage: SRC, targetLanguage: TGT }));
      }
      if (typeof f.capabilities === "function") { // older capabilities() API
        return Promise.resolve(f.capabilities()).then(function (c) {
          var s = c && typeof c.languagePairAvailable === "function"
            ? c.languagePairAvailable(SRC, TGT) : (c && c.available) || "available";
          if (s === "readily") return "available";
          if (s === "after-download") return "downloadable";
          if (s === "no") return "unavailable";
          return s || "available";
        }).catch(function () { return "available"; });
      }
    } catch (e) {}
    return Promise.resolve("available"); // create() exists but no capability probe — assume usable
  }

  function getTranslator() {
    if (_t) return Promise.resolve(_t);
    if (_pending) return _pending;
    var f = factory();
    if (!f) return Promise.reject(notSupported());
    _pending = Promise.resolve(f.create({ sourceLanguage: SRC, targetLanguage: TGT }))
      .then(function (t) { _t = t; _pending = null; return t; })
      .catch(function (e) { _pending = null; throw e; });
    return _pending;
  }

  function translateText(germanText) {
    var text = String(germanText == null ? "" : germanText);
    if (!text.trim()) return Promise.resolve("");
    return getTranslator().then(function (t) { return t.translate(text); }).then(function (en) { return en || ""; });
  }

  // The on-device model translates one string at a time; chain them so a bulk
  // fill works without firing dozens of concurrent calls.
  function translateBatch(texts) {
    if (!Array.isArray(texts) || !texts.length) return Promise.resolve([]);
    return getTranslator().then(function (t) {
      return texts.reduce(function (chain, txt) {
        return chain.then(function (acc) {
          var s = String(txt == null ? "" : txt);
          if (!s.trim()) { acc.push(""); return acc; }
          return Promise.resolve(t.translate(s)).then(function (en) { acc.push(en || ""); return acc; });
        });
      }, Promise.resolve([]));
    });
  }

  window.AutoTranslate = {
    supported: supported,       // sync boolean — is the built-in translator present?
    availability: availability, // async status string
    translateText: translateText,
    translateBatch: translateBatch
  };
})();
