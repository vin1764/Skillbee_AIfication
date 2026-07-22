/* =====================================================================
   Translator — German → English auto-translation for Manage Content.
   ---------------------------------------------------------------------
   The ACTUAL translation call lives behind translateText() / translateBatch()
   so the backend service can be swapped later (Azure Translator today; DeepL,
   Claude, … tomorrow) WITHOUT touching any UI code — change only this file.

   SECURITY: the Azure key is NEVER here. It lives server-side in the
   translation Cloud Function's environment config (see docs/TRANSLATE_SETUP.md).
   This module only calls that function's public URL. Same pattern as the audio
   setup: the key stays out of the published site.
   ===================================================================== */
(function () {
  // The deployed translation function's URL. Blank until the function is
  // deployed; set it here (or via window.TRANSLATE_ENDPOINT) to switch the
  // Auto-translate buttons on. Everything else is already wired.
  var DEFAULT_ENDPOINT = "";

  function endpoint() {
    if (typeof window.TRANSLATE_ENDPOINT === "string" && window.TRANSLATE_ENDPOINT) return window.TRANSLATE_ENDPOINT;
    return DEFAULT_ENDPOINT || "";
  }

  function notConfigured() {
    var e = new Error("Auto-translate isn't switched on yet.");
    e.code = "no-endpoint";
    return e;
  }

  // Translate an array of German strings to English in a SINGLE request
  // (Azure Translator accepts many texts at once — efficient for bulk fills).
  function translateBatch(texts) {
    var url = endpoint();
    if (!url) return Promise.reject(notConfigured());
    if (!Array.isArray(texts) || !texts.length) return Promise.resolve([]);
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: texts, from: "de", to: "en" })
    }).then(function (res) {
      if (!res.ok) throw new Error("Translation service returned " + res.status);
      return res.json();
    }).then(function (data) {
      var out = (data && data.translations) || [];
      // Always return one entry per input (blank where the service gave nothing).
      return texts.map(function (_, i) { return typeof out[i] === "string" ? out[i] : ""; });
    });
  }

  // Translate a single German string. This is the primitive the spec asks for.
  function translateText(germanText) {
    return translateBatch([germanText]).then(function (a) { return a[0] || ""; });
  }

  window.Translator = {
    available: function () { return !!endpoint(); },
    endpoint: endpoint,
    translateText: translateText,
    translateBatch: translateBatch
  };
})();
