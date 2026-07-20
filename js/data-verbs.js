/* =====================================================================
   Konjugations-Karussell (Conjugation Carousel) — present-tense verbs.
   Each verb stores all six present-tense forms (most reliable for the
   irregular stem-changers), plus an optional "naive" map: the du/er forms
   a beginner would produce if they FORGOT the stem change (e.g. "fahrst"
   instead of "fährst"). That naive form becomes the star distractor.
     { inf, en, forms: {ich,du,er,wir,ihr,sie}, naive?: {du,er} }
   Pronoun "er" covers er/sie/es; "sie" is the plural (they).
   ===================================================================== */
const VERBS = [
  // --- regular ---
  { inf: "spielen", en: "to play", forms: { ich: "spiele", du: "spielst", er: "spielt", wir: "spielen", ihr: "spielt", sie: "spielen" } },
  { inf: "machen", en: "to do / make", forms: { ich: "mache", du: "machst", er: "macht", wir: "machen", ihr: "macht", sie: "machen" } },
  { inf: "wohnen", en: "to live", forms: { ich: "wohne", du: "wohnst", er: "wohnt", wir: "wohnen", ihr: "wohnt", sie: "wohnen" } },
  { inf: "lernen", en: "to learn", forms: { ich: "lerne", du: "lernst", er: "lernt", wir: "lernen", ihr: "lernt", sie: "lernen" } },
  { inf: "kaufen", en: "to buy", forms: { ich: "kaufe", du: "kaufst", er: "kauft", wir: "kaufen", ihr: "kauft", sie: "kaufen" } },
  { inf: "gehen", en: "to go", forms: { ich: "gehe", du: "gehst", er: "geht", wir: "gehen", ihr: "geht", sie: "gehen" } },
  // --- stem-changing a -> ä ---
  { inf: "fahren", en: "to drive", forms: { ich: "fahre", du: "fährst", er: "fährt", wir: "fahren", ihr: "fahrt", sie: "fahren" }, naive: { du: "fahrst", er: "fahrt" } },
  { inf: "schlafen", en: "to sleep", forms: { ich: "schlafe", du: "schläfst", er: "schläft", wir: "schlafen", ihr: "schlaft", sie: "schlafen" }, naive: { du: "schlafst", er: "schlaft" } },
  // --- stem-changing e -> i ---
  { inf: "essen", en: "to eat", forms: { ich: "esse", du: "isst", er: "isst", wir: "essen", ihr: "esst", sie: "essen" } },
  { inf: "geben", en: "to give", forms: { ich: "gebe", du: "gibst", er: "gibt", wir: "geben", ihr: "gebt", sie: "geben" }, naive: { du: "gebst", er: "gebt" } },
  { inf: "nehmen", en: "to take", forms: { ich: "nehme", du: "nimmst", er: "nimmt", wir: "nehmen", ihr: "nehmt", sie: "nehmen" }, naive: { du: "nehmst", er: "nehmt" } },
  { inf: "sprechen", en: "to speak", forms: { ich: "spreche", du: "sprichst", er: "spricht", wir: "sprechen", ihr: "sprecht", sie: "sprechen" }, naive: { du: "sprechst", er: "sprecht" } },
  { inf: "helfen", en: "to help", forms: { ich: "helfe", du: "hilfst", er: "hilft", wir: "helfen", ihr: "helft", sie: "helfen" }, naive: { du: "helfst", er: "helft" } },
  // --- stem-changing e -> ie ---
  { inf: "sehen", en: "to see", forms: { ich: "sehe", du: "siehst", er: "sieht", wir: "sehen", ihr: "seht", sie: "sehen" }, naive: { du: "sehst", er: "seht" } },
  { inf: "lesen", en: "to read", forms: { ich: "lese", du: "liest", er: "liest", wir: "lesen", ihr: "lest", sie: "lesen" } },
  // --- highly irregular ---
  { inf: "sein", en: "to be", forms: { ich: "bin", du: "bist", er: "ist", wir: "sind", ihr: "seid", sie: "sind" } },
  { inf: "haben", en: "to have", forms: { ich: "habe", du: "hast", er: "hat", wir: "haben", ihr: "habt", sie: "haben" } }
];

window.VerbData = VERBS;
