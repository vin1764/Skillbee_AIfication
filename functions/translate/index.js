/* =====================================================================
   HTTP wrapper for the translation function (Azure Functions, Node).
   POST { texts: ["der Hund", ...], from?: "de", to?: "en" }
     -> { translations: ["the dog", ...] }
   Also accepts { text: "der Hund" } for a single string.

   The Azure key lives in this function's app settings (env), never in the
   published website. Set these Application settings on the Function App:
     AZURE_TRANSLATOR_KEY     your Cognitive Services / Translator key
     AZURE_TRANSLATOR_REGION  the resource region, e.g. westeurope
     CORS_ORIGIN              your site origin, e.g. https://<user>.github.io
   ===================================================================== */
const { azureTranslate } = require("./translate-core");

module.exports = async function (context, req) {
  const cors = {
    "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  // CORS preflight
  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers: cors };
    return;
  }

  try {
    const body = req.body || {};
    const texts = Array.isArray(body.texts)
      ? body.texts
      : (body.text != null ? [body.text] : []);
    const from = body.from || "de";
    const to = body.to || "en";

    const translations = await azureTranslate(texts, {
      key: process.env.AZURE_TRANSLATOR_KEY,
      region: process.env.AZURE_TRANSLATOR_REGION,
      from: from,
      to: to
    });

    context.res = {
      status: 200,
      headers: Object.assign({ "Content-Type": "application/json" }, cors),
      body: { translations: translations }
    };
  } catch (e) {
    context.log && context.log.error && context.log.error("translate failed:", e && e.message);
    context.res = {
      status: 500,
      headers: Object.assign({ "Content-Type": "application/json" }, cors),
      body: { error: String((e && e.message) || e) }
    };
  }
};
