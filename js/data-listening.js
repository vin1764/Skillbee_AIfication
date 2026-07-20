/* =====================================================================
   Hör gut zu! (Listen Carefully!) — listening-comprehension bank.
   The word is SPOKEN (no text shown); phones show four look-alike written
   options and tap the one they heard. Distractors are near-homophones,
   minimal pairs or umlaut variants — genuinely confusable by ear (true
   homophones like Meer/mehr are avoided, since you can't tell them apart).
     { word, meaning, distractors: [3 confusable words] }
   Audio is spoken on the smartboard via the browser's German voice, so no
   pre-generated files or API keys are needed.
   ===================================================================== */
const LISTENING = [
  { word: "Kirche", meaning: "church", distractors: ["Kirsche", "Küche", "Kiste"] },
  { word: "Kuchen", meaning: "cake", distractors: ["Küche", "Kirche", "Kuh"] },
  { word: "Wein", meaning: "wine", distractors: ["Wien", "weinen", "mein"] },
  { word: "schön", meaning: "beautiful", distractors: ["schon", "Sohn", "Bohne"] },
  { word: "Mutter", meaning: "mother", distractors: ["Mütter", "Butter", "Motte"] },
  { word: "Bär", meaning: "bear", distractors: ["Beere", "Bier", "Birne"] },
  { word: "Vater", meaning: "father", distractors: ["Väter", "Futter", "Wetter"] },
  { word: "Tisch", meaning: "table", distractors: ["Fisch", "Tasche", "Tische"] },
  { word: "Hut", meaning: "hat", distractors: ["Hüte", "Hund", "gut"] },
  { word: "Miete", meaning: "rent", distractors: ["Mitte", "Mütze", "Motte"] }
];

window.ListeningData = LISTENING;
