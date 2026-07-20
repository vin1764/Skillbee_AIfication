/* =====================================================================
   Wortmonster (Word Monster) — compound-word bank.
   Each entry combines two real word-parts into a compound. The parts join
   directly (partA + partB), and the gender always comes from partB (the
   base word), which is the rule the game teaches.
     { partA, partB, compound, gender, meaning, emoji }
   ===================================================================== */
const COMPOUNDS = [
  { partA: "Hand", partB: "Schuh", compound: "Handschuh", gender: "der", meaning: "glove", emoji: "🧤" },
  { partA: "Zahn", partB: "Bürste", compound: "Zahnbürste", gender: "die", meaning: "toothbrush", emoji: "🪥" },
  { partA: "Regen", partB: "Schirm", compound: "Regenschirm", gender: "der", meaning: "umbrella", emoji: "☂️" },
  { partA: "Feuer", partB: "Zeug", compound: "Feuerzeug", gender: "das", meaning: "lighter", emoji: "🔥" },
  { partA: "Wasser", partB: "Fall", compound: "Wasserfall", gender: "der", meaning: "waterfall", emoji: "🌊" },
  { partA: "Fuß", partB: "Ball", compound: "Fußball", gender: "der", meaning: "football", emoji: "⚽" },
  { partA: "Apfel", partB: "Saft", compound: "Apfelsaft", gender: "der", meaning: "apple juice", emoji: "🧃" },
  { partA: "Schnee", partB: "Mann", compound: "Schneemann", gender: "der", meaning: "snowman", emoji: "⛄" },
  { partA: "Haus", partB: "Tür", compound: "Haustür", gender: "die", meaning: "front door", emoji: "🚪" },
  { partA: "Nacht", partB: "Tisch", compound: "Nachttisch", gender: "der", meaning: "bedside table", emoji: "🛏️" },
  { partA: "Kinder", partB: "Garten", compound: "Kindergarten", gender: "der", meaning: "kindergarten", emoji: "🧒" },
  { partA: "Tisch", partB: "Tennis", compound: "Tischtennis", gender: "das", meaning: "table tennis", emoji: "🏓" },
  { partA: "Auto", partB: "Bahn", compound: "Autobahn", gender: "die", meaning: "motorway", emoji: "🛣️" },
  { partA: "Brief", partB: "Marke", compound: "Briefmarke", gender: "die", meaning: "postage stamp", emoji: "" },
  { partA: "Fahr", partB: "Rad", compound: "Fahrrad", gender: "das", meaning: "bicycle", emoji: "🚲" },
  { partA: "Spiel", partB: "Platz", compound: "Spielplatz", gender: "der", meaning: "playground", emoji: "🎠" },
  { partA: "Buch", partB: "Laden", compound: "Buchladen", gender: "der", meaning: "bookshop", emoji: "📚" }
];

window.CompoundData = COMPOUNDS;
