/* =====================================================================
   Plural-Palast (Plural Palace) — noun plural bank.
   German plurals follow no single rule (-e, -er, -(e)n, -s, umlaut shift,
   or no change), so each entry stores the correct plural plus three
   plausible wrong forms — realistic mistakes (wrong ending, or the
   missing/added umlaut trap), never random nonsense.
     { singular, en, emoji, plural, wrong: [3 wrong plural forms] }
   The plural article is always "die"; options show the bare form so the
   ending is what's being tested. Mass nouns (Milch, Wasser, …) are left
   out — they have no everyday plural.
   ===================================================================== */
const PLURALS = [
  // Tiere
  { singular: "der Hund", en: "dog", emoji: "🐶", plural: "Hunde", wrong: ["Hunden", "Hünde", "Hunds"] },
  { singular: "die Katze", en: "cat", emoji: "🐱", plural: "Katzen", wrong: ["Katze", "Kätzen", "Katzes"] },
  { singular: "das Pferd", en: "horse", emoji: "🐴", plural: "Pferde", wrong: ["Pferden", "Pferder", "Pferds"] },
  { singular: "der Vogel", en: "bird", emoji: "🐦", plural: "Vögel", wrong: ["Vogel", "Vögeln", "Vogels"] },
  { singular: "der Fisch", en: "fish", emoji: "🐟", plural: "Fische", wrong: ["Fischen", "Fischer", "Fischs"] },
  { singular: "die Kuh", en: "cow", emoji: "🐮", plural: "Kühe", wrong: ["Kuhe", "Kühen", "Kuhs"] },
  { singular: "das Schwein", en: "pig", emoji: "🐷", plural: "Schweine", wrong: ["Schweinen", "Schweiner", "Schweins"] },
  { singular: "der Bär", en: "bear", emoji: "🐻", plural: "Bären", wrong: ["Bäre", "Bärer", "Bärs"] },
  { singular: "der Löwe", en: "lion", emoji: "🦁", plural: "Löwen", wrong: ["Löwe", "Löwer", "Löwes"] },
  { singular: "der Elefant", en: "elephant", emoji: "🐘", plural: "Elefanten", wrong: ["Elefante", "Elefanter", "Elefants"] },
  // Essen (countable only)
  { singular: "das Brot", en: "bread", emoji: "🍞", plural: "Brote", wrong: ["Broten", "Bröter", "Brots"] },
  { singular: "der Apfel", en: "apple", emoji: "🍎", plural: "Äpfel", wrong: ["Apfel", "Äpfeln", "Apfels"] },
  { singular: "das Ei", en: "egg", emoji: "🥚", plural: "Eier", wrong: ["Eie", "Eien", "Eis"] },
  { singular: "die Banane", en: "banana", emoji: "🍌", plural: "Bananen", wrong: ["Banane", "Bananes", "Bananer"] },
  { singular: "der Kuchen", en: "cake", emoji: "🍰", plural: "Kuchen", wrong: ["Kuchene", "Küchen", "Kuchens"] },
  // Familie
  { singular: "die Mutter", en: "mother", emoji: "👩", plural: "Mütter", wrong: ["Mutter", "Muttern", "Mütters"] },
  { singular: "der Vater", en: "father", emoji: "👨", plural: "Väter", wrong: ["Vater", "Vatern", "Väters"] },
  { singular: "die Schwester", en: "sister", emoji: "👧", plural: "Schwestern", wrong: ["Schwestere", "Schwesters", "Schwesteren"] },
  { singular: "der Bruder", en: "brother", emoji: "👦", plural: "Brüder", wrong: ["Bruder", "Brudern", "Brüders"] },
  { singular: "die Oma", en: "grandma", emoji: "👵", plural: "Omas", wrong: ["Omen", "Oma", "Omaen"] },
  { singular: "der Opa", en: "grandpa", emoji: "👴", plural: "Opas", wrong: ["Open", "Opa", "Opaen"] },
  { singular: "das Kind", en: "child", emoji: "🧒", plural: "Kinder", wrong: ["Kinde", "Kinden", "Kinds"] },
  { singular: "das Baby", en: "baby", emoji: "👶", plural: "Babys", wrong: ["Babies", "Baben", "Babe"] }
];

window.PluralData = PLURALS;
