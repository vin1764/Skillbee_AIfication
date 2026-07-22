/* =====================================================================
   translate-core — the ONLY place the translation provider lives.
   Swap this file to change providers (DeepL, Claude, …) without touching
   the HTTP wrapper (index.js) or any front-end code.

   azureTranslate(texts, { key, region, from, to }) -> Promise<string[]>
   Returns one English string per input, in order.
   ===================================================================== */
async function azureTranslate(texts, opts) {
  opts = opts || {};
  const key = opts.key;
  const region = opts.region;
  const from = opts.from || "de";
  const to = opts.to || "en";
  if (!key) throw new Error("Missing AZURE_TRANSLATOR_KEY");
  if (!Array.isArray(texts) || texts.length === 0) return [];

  const url =
    "https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=" +
    encodeURIComponent(from) + "&to=" + encodeURIComponent(to);

  const headers = {
    "Ocp-Apim-Subscription-Key": key,
    "Content-Type": "application/json"
  };
  // Multi-service / regional Cognitive Services keys require the region header;
  // a global Translator resource ignores it. Sending it is safe either way.
  if (region) headers["Ocp-Apim-Subscription-Region"] = region;

  const res = await fetch(url, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(texts.map(function (t) { return { Text: String(t == null ? "" : t) }; }))
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error("Azure Translator " + res.status + ": " + detail.slice(0, 300));
  }
  const data = await res.json();
  return data.map(function (d) {
    return (d && d.translations && d.translations[0] && d.translations[0].text) || "";
  });
}

module.exports = { azureTranslate };
