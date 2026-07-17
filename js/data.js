/* =====================================================================
   Skillbee Deutsch Games — VOCABULARY DATA
   ---------------------------------------------------------------------
   👋 NON-TECHNICAL FRIENDLY: This is the file you edit to change what
   students learn. You do NOT need to touch any other file.

   HOW TO ADD A WORD:
     Copy one line inside a topic's "words" list and change it, e.g.
        { de: "der Apfel", en: "the apple", emoji: "🍎" },
     - de    = the German word (add der/die/das for nouns if you like)
     - en    = the English meaning
     - emoji = a small picture (optional — leave "" if none fits)

   HOW TO ADD A WHOLE NEW TOPIC:
     Copy a whole { ... } topic block, give it a new "id" (no spaces),
     a "name", an "emoji", and its own list of words.

   HOW TO ADD A SENTENCE (used by the "Satzbau" game):
     Add a line to SENTENCE_TOPICS below, e.g.
        { de: "Ich lerne gern Deutsch", en: "I like learning German" },
   ===================================================================== */

const VOCAB_TOPICS = [
  {
    id: "zahlen",
    name: "Zahlen",
    english: "Numbers",
    emoji: "🔢",
    words: [
      { de: "eins", en: "one", emoji: "1️⃣" },
      { de: "zwei", en: "two", emoji: "2️⃣" },
      { de: "drei", en: "three", emoji: "3️⃣" },
      { de: "vier", en: "four", emoji: "4️⃣" },
      { de: "fünf", en: "five", emoji: "5️⃣" },
      { de: "sechs", en: "six", emoji: "6️⃣" },
      { de: "sieben", en: "seven", emoji: "7️⃣" },
      { de: "acht", en: "eight", emoji: "8️⃣" },
      { de: "neun", en: "nine", emoji: "9️⃣" },
      { de: "zehn", en: "ten", emoji: "🔟" },
      { de: "elf", en: "eleven", emoji: "" },
      { de: "zwölf", en: "twelve", emoji: "" }
    ]
  },
  {
    id: "farben",
    name: "Farben",
    english: "Colors",
    emoji: "🎨",
    words: [
      { de: "rot", en: "red", emoji: "🟥" },
      { de: "blau", en: "blue", emoji: "🟦" },
      { de: "grün", en: "green", emoji: "🟩" },
      { de: "gelb", en: "yellow", emoji: "🟨" },
      { de: "orange", en: "orange", emoji: "🟧" },
      { de: "lila", en: "purple", emoji: "🟪" },
      { de: "schwarz", en: "black", emoji: "⬛" },
      { de: "weiß", en: "white", emoji: "⬜" },
      { de: "braun", en: "brown", emoji: "🟫" },
      { de: "rosa", en: "pink", emoji: "🌸" }
    ]
  },
  {
    id: "tiere",
    name: "Tiere",
    english: "Animals",
    emoji: "🐾",
    words: [
      { de: "der Hund", en: "the dog", emoji: "🐶" },
      { de: "die Katze", en: "the cat", emoji: "🐱" },
      { de: "das Pferd", en: "the horse", emoji: "🐴" },
      { de: "der Vogel", en: "the bird", emoji: "🐦" },
      { de: "der Fisch", en: "the fish", emoji: "🐟" },
      { de: "die Kuh", en: "the cow", emoji: "🐮" },
      { de: "das Schwein", en: "the pig", emoji: "🐷" },
      { de: "der Bär", en: "the bear", emoji: "🐻" },
      { de: "der Löwe", en: "the lion", emoji: "🦁" },
      { de: "der Elefant", en: "the elephant", emoji: "🐘" }
    ]
  },
  {
    id: "essen",
    name: "Essen & Trinken",
    english: "Food & Drink",
    emoji: "🍽️",
    words: [
      { de: "das Brot", en: "the bread", emoji: "🍞" },
      { de: "der Apfel", en: "the apple", emoji: "🍎" },
      { de: "der Käse", en: "the cheese", emoji: "🧀" },
      { de: "das Ei", en: "the egg", emoji: "🥚" },
      { de: "die Milch", en: "the milk", emoji: "🥛" },
      { de: "der Kaffee", en: "the coffee", emoji: "☕" },
      { de: "das Wasser", en: "the water", emoji: "💧" },
      { de: "der Fisch", en: "the fish", emoji: "🐟" },
      { de: "die Banane", en: "the banana", emoji: "🍌" },
      { de: "der Kuchen", en: "the cake", emoji: "🍰" }
    ]
  },
  {
    id: "familie",
    name: "Familie",
    english: "Family",
    emoji: "👪",
    words: [
      { de: "die Mutter", en: "the mother", emoji: "👩" },
      { de: "der Vater", en: "the father", emoji: "👨" },
      { de: "die Schwester", en: "the sister", emoji: "👧" },
      { de: "der Bruder", en: "the brother", emoji: "👦" },
      { de: "die Oma", en: "the grandma", emoji: "👵" },
      { de: "der Opa", en: "the grandpa", emoji: "👴" },
      { de: "das Kind", en: "the child", emoji: "🧒" },
      { de: "das Baby", en: "the baby", emoji: "👶" }
    ]
  },
  {
    id: "verben",
    name: "Verben",
    english: "Verbs",
    emoji: "🏃",
    words: [
      { de: "gehen", en: "to go", emoji: "🚶" },
      { de: "essen", en: "to eat", emoji: "🍴" },
      { de: "trinken", en: "to drink", emoji: "🥤" },
      { de: "schlafen", en: "to sleep", emoji: "😴" },
      { de: "lesen", en: "to read", emoji: "📖" },
      { de: "spielen", en: "to play", emoji: "🎮" },
      { de: "sprechen", en: "to speak", emoji: "💬" },
      { de: "lernen", en: "to learn", emoji: "🧠" },
      { de: "arbeiten", en: "to work", emoji: "💼" },
      { de: "kaufen", en: "to buy", emoji: "🛒" }
    ]
  }
];

/* Sentences are used by the "Satzbau" (Sentence Scramble) game.
   Keep them short (A1/A2 level) so students can rebuild them. */
const SENTENCE_TOPICS = [
  {
    id: "alltag",
    name: "Alltag",
    english: "Everyday",
    emoji: "🗣️",
    sentences: [
      { de: "Ich lerne gern Deutsch", en: "I like learning German" },
      { de: "Wie heißt du?", en: "What is your name?" },
      { de: "Ich komme aus Deutschland", en: "I come from Germany" },
      { de: "Das Wetter ist heute schön", en: "The weather is nice today" },
      { de: "Wir spielen am Wochenende Fußball", en: "We play football on the weekend" },
      { de: "Kannst du mir bitte helfen?", en: "Can you please help me?" },
      { de: "Ich trinke morgens einen Kaffee", en: "I drink a coffee in the morning" },
      { de: "Meine Familie wohnt in Berlin", en: "My family lives in Berlin" }
    ]
  },
  {
    id: "schule",
    name: "Schule",
    english: "School",
    emoji: "🏫",
    sentences: [
      { de: "Der Lehrer erklärt die Aufgabe", en: "The teacher explains the task" },
      { de: "Wir schreiben morgen einen Test", en: "We write a test tomorrow" },
      { de: "Ich habe meine Hausaufgaben gemacht", en: "I did my homework" },
      { de: "Die Schüler lernen neue Wörter", en: "The students learn new words" },
      { de: "Bitte öffnet euer Buch auf Seite zehn", en: "Please open your book to page ten" },
      { de: "Wer kennt die richtige Antwort?", en: "Who knows the correct answer?" }
    ]
  }
];

/* Make the data available to the rest of the app. */
window.GameData = { VOCAB_TOPICS, SENTENCE_TOPICS };
