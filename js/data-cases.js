/* =====================================================================
   Case-article drills — the first content set for Lücken-Text (fill in
   the blank). Authored here in a compact single-blank form (sentence with
   one ___, the correct article, wrong-article choices, a one-line
   explanation) and transformed at the bottom into the general Lücken-Text
   schema { sentence, blanks:[{id,correct}], wordBank, explanation } that
   the engine and the content editor use.

   Levels build up (a class only sees cases it has learned):
     Level 1 = accusative
     Level 2 = accusative + dative
     Level 3 = accusative + dative + genitive
   ===================================================================== */
const CASE_DRILLS = {
  accusative: [
    { sentence: "Ich sehe ___ Mann.", blank: "Mann", correct: "den", distractors: ["der", "dem", "des"], clueWord: "sehe", explanation: "sehen + accusative — direct object" },
    { sentence: "Er isst ___ Banane.", blank: "Banane", correct: "die", distractors: ["der", "den", "dem"], clueWord: "isst", explanation: "essen + accusative — direct object" },
    { sentence: "Für ___ Kind ist das Geschenk.", blank: "Kind", correct: "das", distractors: ["dem", "des", "der"], clueWord: "Für", explanation: "für + accusative (preposition)" },
    { sentence: "Wir kaufen ___ Apfel.", blank: "Apfel", correct: "den", distractors: ["der", "dem", "des"], clueWord: "kaufen", explanation: "kaufen + accusative — direct object" },
    { sentence: "Ich lese ___ Buch.", blank: "Buch", correct: "das", distractors: ["dem", "des", "der"], clueWord: "lese", explanation: "lesen + accusative — direct object" },
    { sentence: "Sie trinkt ___ Milch.", blank: "Milch", correct: "die", distractors: ["der", "den", "dem"], clueWord: "trinkt", explanation: "trinken + accusative — direct object" },
    { sentence: "Hast du ___ Hund?", blank: "Hund", correct: "den", distractors: ["der", "dem", "des"], clueWord: "Hast", explanation: "haben + accusative — direct object" },
    { sentence: "Ohne ___ Auto komme ich nicht.", blank: "Auto", correct: "das", distractors: ["dem", "des", "der"], clueWord: "Ohne", explanation: "ohne + accusative (preposition)" },
    { sentence: "Ich suche ___ Katze.", blank: "Katze", correct: "die", distractors: ["der", "den", "dem"], clueWord: "suche", explanation: "suchen + accusative — direct object" },
    { sentence: "Er nimmt ___ Ball.", blank: "Ball", correct: "den", distractors: ["der", "dem", "des"], clueWord: "nimmt", explanation: "nehmen + accusative — direct object" },
    { sentence: "Wir besuchen ___ Oma.", blank: "Oma", correct: "die", distractors: ["der", "den", "dem"], clueWord: "besuchen", explanation: "besuchen + accusative — direct object" },
    { sentence: "Durch ___ Fenster scheint die Sonne.", blank: "Fenster", correct: "das", distractors: ["dem", "des", "der"], clueWord: "Durch", explanation: "durch + accusative (preposition)" },
    { sentence: "Ich brauche ___ Löffel.", blank: "Löffel", correct: "den", distractors: ["der", "dem", "des"], clueWord: "brauche", explanation: "brauchen + accusative — direct object" },
    { sentence: "Sie liest ___ Zeitung.", blank: "Zeitung", correct: "die", distractors: ["der", "den", "dem"], clueWord: "liest", explanation: "lesen + accusative — direct object" },
    { sentence: "Gegen ___ Wand steht ein Tisch.", blank: "Wand", correct: "die", distractors: ["der", "den", "dem"], clueWord: "Gegen", explanation: "gegen + accusative (preposition)" },
    { sentence: "Ich mache ___ Tür auf.", blank: "Tür", correct: "die", distractors: ["der", "den", "dem"], clueWord: "mache", explanation: "aufmachen + accusative — direct object" }
  ],
  dative: [
    { sentence: "Ich helfe ___ Mann.", blank: "Mann", correct: "dem", distractors: ["der", "den", "des"], clueWord: "helfe", explanation: "helfen + dative" },
    { sentence: "Wir fahren mit ___ Bus.", blank: "Bus", correct: "dem", distractors: ["der", "den", "des"], clueWord: "mit", explanation: "mit + dative (preposition)" },
    { sentence: "Sie gibt ___ Kind einen Apfel.", blank: "Kind", correct: "dem", distractors: ["das", "den", "des"], clueWord: "gibt", explanation: "geben — the recipient takes dative" },
    { sentence: "Das Buch gehört ___ Frau.", blank: "Frau", correct: "der", distractors: ["die", "dem", "den"], clueWord: "gehört", explanation: "gehören + dative" },
    { sentence: "Nach ___ Schule gehe ich nach Hause.", blank: "Schule", correct: "der", distractors: ["die", "dem", "den"], clueWord: "Nach", explanation: "nach + dative (preposition)" },
    { sentence: "Ich danke ___ Lehrer.", blank: "Lehrer", correct: "dem", distractors: ["der", "den", "des"], clueWord: "danke", explanation: "danken + dative" },
    { sentence: "Bei ___ Oma ist es schön.", blank: "Oma", correct: "der", distractors: ["die", "dem", "den"], clueWord: "Bei", explanation: "bei + dative (preposition)" },
    { sentence: "Der Hund folgt ___ Kind.", blank: "Kind", correct: "dem", distractors: ["das", "den", "des"], clueWord: "folgt", explanation: "folgen + dative" },
    { sentence: "Aus ___ Flasche trinkt er Wasser.", blank: "Flasche", correct: "der", distractors: ["die", "dem", "den"], clueWord: "Aus", explanation: "aus + dative (preposition)" },
    { sentence: "Ich antworte ___ Lehrerin.", blank: "Lehrerin", correct: "der", distractors: ["die", "dem", "den"], clueWord: "antworte", explanation: "antworten + dative" },
    { sentence: "Mit ___ Katze spielt das Kind.", blank: "Katze", correct: "der", distractors: ["die", "dem", "den"], clueWord: "Mit", explanation: "mit + dative (preposition)" },
    { sentence: "Von ___ Frau habe ich es gehört.", blank: "Frau", correct: "der", distractors: ["die", "dem", "den"], clueWord: "Von", explanation: "von + dative (preposition)" },
    { sentence: "Seit ___ Woche bin ich krank.", blank: "Woche", correct: "der", distractors: ["die", "dem", "den"], clueWord: "Seit", explanation: "seit + dative (preposition)" },
    { sentence: "Das Auto gehört ___ Mann.", blank: "Mann", correct: "dem", distractors: ["der", "den", "des"], clueWord: "gehört", explanation: "gehören + dative" },
    { sentence: "Der Film gefällt ___ Kind.", blank: "Kind", correct: "dem", distractors: ["das", "den", "des"], clueWord: "gefällt", explanation: "gefallen + dative" }
  ],
  genitive: [
    { sentence: "Wegen ___ Wetters bleiben wir zu Hause.", blank: "Wetters", correct: "des", distractors: ["dem", "das", "der"], clueWord: "Wegen", explanation: "wegen + genitive (preposition)" },
    { sentence: "Trotz ___ Regens spielen sie Fußball.", blank: "Regens", correct: "des", distractors: ["dem", "den", "der"], clueWord: "Trotz", explanation: "trotz + genitive (preposition)" },
    { sentence: "Während ___ Woche arbeite ich viel.", blank: "Woche", correct: "der", distractors: ["die", "dem", "den"], clueWord: "Während", explanation: "während + genitive (preposition)" },
    { sentence: "Wegen ___ Kindes bleibt sie zu Hause.", blank: "Kindes", correct: "des", distractors: ["dem", "das", "der"], clueWord: "Wegen", explanation: "wegen + genitive (preposition)" },
    { sentence: "Trotz ___ Kälte gehen wir spazieren.", blank: "Kälte", correct: "der", distractors: ["die", "dem", "den"], clueWord: "Trotz", explanation: "trotz + genitive (preposition)" },
    { sentence: "Während ___ Films schläft er ein.", blank: "Films", correct: "des", distractors: ["dem", "den", "der"], clueWord: "Während", explanation: "während + genitive (preposition)" },
    { sentence: "Statt ___ Apfels isst er eine Banane.", blank: "Apfels", correct: "des", distractors: ["dem", "den", "der"], clueWord: "Statt", explanation: "statt + genitive (preposition)" },
    { sentence: "Wegen ___ Krankheit fehlt der Lehrer.", blank: "Krankheit", correct: "der", distractors: ["die", "dem", "den"], clueWord: "Wegen", explanation: "wegen + genitive (preposition)" },
    { sentence: "Trotz ___ Problems bleibt er ruhig.", blank: "Problems", correct: "des", distractors: ["dem", "das", "der"], clueWord: "Trotz", explanation: "trotz + genitive (preposition)" },
    { sentence: "Während ___ Reise regnet es oft.", blank: "Reise", correct: "der", distractors: ["die", "dem", "den"], clueWord: "Während", explanation: "während + genitive (preposition)" },
    { sentence: "Wegen ___ Autos kommen wir zu spät.", blank: "Autos", correct: "des", distractors: ["dem", "das", "der"], clueWord: "Wegen", explanation: "wegen + genitive (preposition)" },
    { sentence: "Trotz ___ Hundes hat sie keine Angst.", blank: "Hundes", correct: "des", distractors: ["dem", "den", "der"], clueWord: "Trotz", explanation: "trotz + genitive (preposition)" },
    { sentence: "Während ___ Stunde stellt er viele Fragen.", blank: "Stunde", correct: "der", distractors: ["die", "dem", "den"], clueWord: "Während", explanation: "während + genitive (preposition)" },
    { sentence: "Statt ___ Buches liest sie eine Zeitung.", blank: "Buches", correct: "des", distractors: ["dem", "das", "der"], clueWord: "Statt", explanation: "statt + genitive (preposition)" },
    { sentence: "Wegen ___ Mannes sind alle nervös.", blank: "Mannes", correct: "des", distractors: ["dem", "den", "der"], clueWord: "Wegen", explanation: "wegen + genitive (preposition)" }
  ]
};

// Transform the compact single-blank rows into the general Lücken-Text schema.
// Each becomes a one-blank sentence; the word bank = correct + distractors.
function toBlanks(list) {
  return (list || []).map(function (e) {
    var correct = String(e.correct || "").trim();
    var bank = [correct];
    (e.distractors || []).forEach(function (d) { d = String(d).trim(); if (d && bank.indexOf(d) < 0) bank.push(d); });
    return {
      sentence: String(e.sentence || ""),        // plain ___ marks the blank
      blanks: [{ id: 1, correct: correct }],
      wordBank: bank,
      explanation: e.explanation || ""
    };
  });
}

window.CaseData = {
  items: toBlanks(CASE_DRILLS.accusative)
    .concat(toBlanks(CASE_DRILLS.dative))
    .concat(toBlanks(CASE_DRILLS.genitive))
};
