/* =====================================================================
   EmojiPick — a small, offline German/English word → emoji dictionary.
   Used by Manage Content to auto-fill the emoji column from a row's text.
   No network, no key — just a lookup table shipped with the app, so it
   works in every browser. When nothing sensible matches, it returns ""
   (blank) — a missing emoji is better than a wrong one.
   ===================================================================== */
(function () {
  // One concept per line: [emoji, [German + English keywords]]. Both languages
  // are indexed, so a match works whether the German or the English is present.
  var GROUPS = [
    // numbers
    ["0️⃣", ["null", "zero"]],
    ["1️⃣", ["eins", "one"]],
    ["2️⃣", ["zwei", "two"]],
    ["3️⃣", ["drei", "three"]],
    ["4️⃣", ["vier", "four"]],
    ["5️⃣", ["fünf", "five"]],
    ["6️⃣", ["sechs", "six"]],
    ["7️⃣", ["sieben", "seven"]],
    ["8️⃣", ["acht", "eight"]],
    ["9️⃣", ["neun", "nine"]],
    ["🔟", ["zehn", "ten"]],
    // colours
    ["🔴", ["rot", "red"]],
    ["🔵", ["blau", "blue"]],
    ["🟢", ["grün", "green"]],
    ["🟡", ["gelb", "yellow"]],
    ["🟠", ["orange"]],
    ["🟣", ["lila", "violett", "purple", "violet"]],
    ["🟤", ["braun", "brown"]],
    ["⚫", ["schwarz", "black"]],
    ["⚪", ["weiß", "weiss", "white"]],
    ["💗", ["rosa", "pink"]],
    // animals
    ["🐶", ["hund", "dog", "welpe", "puppy"]],
    ["🐱", ["katze", "cat", "kätzchen", "kitten"]],
    ["🐴", ["pferd", "horse"]],
    ["🐦", ["vogel", "bird"]],
    ["🐭", ["maus", "mouse"]],
    ["🐟", ["fisch", "fish"]],
    ["🐮", ["kuh", "cow", "rind"]],
    ["🐷", ["schwein", "pig"]],
    ["🐑", ["schaf", "sheep"]],
    ["🐐", ["ziege", "goat"]],
    ["🐔", ["huhn", "hen", "chicken"]],
    ["🐓", ["hahn", "rooster"]],
    ["🦆", ["ente", "duck"]],
    ["🐰", ["hase", "kaninchen", "rabbit", "bunny"]],
    ["🐻", ["bär", "bear"]],
    ["🦁", ["löwe", "lion"]],
    ["🐯", ["tiger"]],
    ["🐘", ["elefant", "elephant"]],
    ["🐵", ["affe", "monkey"]],
    ["🐸", ["frosch", "frog"]],
    ["🐍", ["schlange", "snake"]],
    ["🐧", ["pinguin", "penguin"]],
    ["🐝", ["biene", "bee"]],
    ["🦋", ["schmetterling", "butterfly"]],
    ["🕷️", ["spinne", "spider"]],
    ["🐺", ["wolf"]],
    ["🦊", ["fuchs", "fox"]],
    ["🐢", ["schildkröte", "turtle", "tortoise"]],
    ["🐬", ["delfin", "delphin", "dolphin"]],
    ["🐋", ["wal", "whale"]],
    ["🦅", ["adler", "eagle"]],
    ["🦉", ["eule", "owl"]],
    // food & drink
    ["🍎", ["apfel", "apple"]],
    ["🍌", ["banane", "banana"]],
    ["🍊", ["orange (frucht)", "mandarine", "tangerine"]],
    ["🍇", ["traube", "trauben", "grape", "grapes"]],
    ["🍓", ["erdbeere", "strawberry"]],
    ["🍋", ["zitrone", "lemon"]],
    ["🍉", ["wassermelone", "melone", "watermelon", "melon"]],
    ["🍒", ["kirsche", "cherry"]],
    ["🍑", ["pfirsich", "peach"]],
    ["🍅", ["tomate", "tomato"]],
    ["🥔", ["kartoffel", "potato"]],
    ["🥕", ["karotte", "möhre", "carrot"]],
    ["🧅", ["zwiebel", "onion"]],
    ["🌽", ["mais", "corn"]],
    ["🍞", ["brot", "bread"]],
    ["🥐", ["croissant", "hörnchen"]],
    ["🧀", ["käse", "cheese"]],
    ["🥚", ["ei", "egg"]],
    ["🥛", ["milch", "milk"]],
    ["💧", ["wasser", "water"]],
    ["☕", ["kaffee", "coffee"]],
    ["🍵", ["tee", "tea"]],
    ["🍺", ["bier", "beer"]],
    ["🍷", ["wein", "wine"]],
    ["🧃", ["saft", "juice", "apfelsaft"]],
    ["🍕", ["pizza"]],
    ["🍔", ["hamburger", "burger"]],
    ["🍟", ["pommes", "fries"]],
    ["🌭", ["würstchen", "hotdog"]],
    ["🍖", ["fleisch", "meat"]],
    ["🍗", ["hähnchen", "wurst"]],
    ["🍚", ["reis", "rice"]],
    ["🍝", ["nudeln", "pasta", "spaghetti", "noodles"]],
    ["🍲", ["suppe", "soup", "eintopf"]],
    ["🥗", ["salat", "salad"]],
    ["🍰", ["kuchen", "cake"]],
    ["🍫", ["schokolade", "chocolate"]],
    ["🍪", ["keks", "cookie", "plätzchen"]],
    ["🍦", ["eis", "eiscreme", "icecream"]],
    ["🍯", ["honig", "honey"]],
    ["🧂", ["salz", "salt"]],
    ["🍽️", ["essen", "food", "meal", "restaurant"]],
    // family & people
    ["👩", ["frau", "mutter", "mama", "woman", "mother", "mom"]],
    ["👨", ["mann", "vater", "papa", "man", "father", "dad"]],
    ["👦", ["junge", "bruder", "boy", "brother"]],
    ["👧", ["mädchen", "schwester", "girl", "sister"]],
    ["👶", ["baby"]],
    ["🧒", ["kind", "child"]],
    ["👵", ["oma", "großmutter", "grandma", "grandmother"]],
    ["👴", ["opa", "großvater", "grandpa", "grandfather"]],
    ["👪", ["familie", "family"]],
    ["🧑‍🤝‍🧑", ["freund", "freundin", "friend"]],
    ["🧑‍🏫", ["lehrer", "lehrerin", "teacher"]],
    ["🧑‍🎓", ["schüler", "student", "pupil"]],
    ["👮", ["polizist", "polizei", "police"]],
    ["🧑‍🍳", ["koch", "köchin", "cook", "chef"]],
    ["🧑‍⚕️", ["arzt", "ärztin", "doctor"]],
    // body
    ["👁️", ["auge", "eye"]],
    ["👂", ["ohr", "ear"]],
    ["👃", ["nase", "nose"]],
    ["👄", ["mund", "lippen", "mouth", "lips"]],
    ["🦷", ["zahn", "tooth"]],
    ["✋", ["hand"]],
    ["🦶", ["fuß", "fuss", "foot"]],
    ["🦵", ["bein", "leg"]],
    ["💪", ["arm", "muskel", "muscle"]],
    ["❤️", ["herz", "heart", "liebe", "love", "lieben"]],
    ["🧠", ["gehirn", "kopf", "brain", "head"]],
    ["💇", ["haar", "haare", "hair"]],
    // nature & weather
    ["☀️", ["sonne", "sun", "sonnig", "sunny"]],
    ["🌙", ["mond", "moon"]],
    ["⭐", ["stern", "star"]],
    ["☁️", ["wolke", "cloud", "bewölkt", "cloudy"]],
    ["🌧️", ["regen", "rain", "regnerisch", "rainy"]],
    ["❄️", ["schnee", "snow"]],
    ["⛈️", ["gewitter", "sturm", "storm"]],
    ["💨", ["wind", "windig", "windy"]],
    ["🔥", ["feuer", "fire", "heiß", "heiss", "hot"]],
    ["🌊", ["meer", "welle", "sea", "wave", "ocean", "wasserfall", "waterfall"]],
    ["⛰️", ["berg", "gebirge", "mountain"]],
    ["🌳", ["baum", "tree", "wald", "forest"]],
    ["🌸", ["blume", "blüte", "flower", "blossom"]],
    ["🌷", ["tulpe", "tulip"]],
    ["🍃", ["blatt", "blätter", "leaf", "leaves"]],
    ["🌍", ["erde", "welt", "earth", "world"]],
    // home & objects
    ["🏠", ["haus", "house", "zuhause", "home"]],
    ["🚪", ["tür", "haustür", "door"]],
    ["🪟", ["fenster", "window"]],
    ["🛏️", ["bett", "bed", "nachttisch"]],
    ["🪑", ["stuhl", "chair", "tisch", "table"]],
    ["🛋️", ["sofa", "couch"]],
    ["💡", ["lampe", "licht", "lamp", "light"]],
    ["🕐", ["uhr", "clock", "zeit", "time"]],
    ["📱", ["handy", "telefon", "smartphone", "phone", "mobile"]],
    ["💻", ["computer", "laptop"]],
    ["📺", ["fernseher", "tv", "television"]],
    ["🔑", ["schlüssel", "key"]],
    ["💰", ["geld", "money"]],
    ["👜", ["tasche", "handtasche", "bag", "handbag"]],
    ["🎒", ["rucksack", "backpack", "schultasche"]],
    ["👟", ["schuh", "schuhe", "shoe", "shoes"]],
    ["🧤", ["handschuh", "handschuhe", "glove", "gloves"]],
    ["🧣", ["schal", "scarf"]],
    ["🎩", ["hut", "hat"]],
    ["🧢", ["mütze", "cap"]],
    ["👕", ["hemd", "shirt", "t-shirt"]],
    ["👖", ["hose", "jeans", "trousers", "pants"]],
    ["👗", ["kleid", "dress"]],
    ["🧥", ["jacke", "mantel", "jacket", "coat"]],
    ["👓", ["brille", "glasses"]],
    ["⌚", ["armbanduhr", "watch"]],
    ["☂️", ["regenschirm", "schirm", "umbrella"]],
    ["🪥", ["zahnbürste", "toothbrush"]],
    ["✂️", ["schere", "scissors"]],
    ["✏️", ["stift", "bleistift", "pencil", "pen"]],
    ["📄", ["papier", "blatt papier", "paper"]],
    ["✉️", ["brief", "letter", "post", "mail"]],
    ["📷", ["kamera", "camera", "foto"]],
    ["🎁", ["geschenk", "gift", "present"]],
    ["🔥", ["feuerzeug", "lighter"]],
    ["⛄", ["schneemann", "snowman"]],
    // school
    ["🏫", ["schule", "school"]],
    ["📖", ["buch", "book", "lesen", "read"]],
    ["📚", ["bücher", "books", "bibliothek", "library"]],
    ["📋", ["tafel", "board"]],
    ["📝", ["schreiben", "write", "notiz", "note"]],
    // transport
    ["🚗", ["auto", "car", "wagen", "fahren", "drive"]],
    ["🚌", ["bus"]],
    ["🚆", ["zug", "train", "bahn"]],
    ["🚇", ["u-bahn", "metro", "subway"]],
    ["🚲", ["fahrrad", "rad", "bike", "bicycle"]],
    ["🏍️", ["motorrad", "motorbike", "motorcycle"]],
    ["🚕", ["taxi"]],
    ["✈️", ["flugzeug", "plane", "airplane", "fliegen", "fly"]],
    ["🚢", ["schiff", "ship"]],
    ["⛵", ["boot", "segelboot", "boat", "sailboat"]],
    ["🚀", ["rakete", "rocket"]],
    // places
    ["⛪", ["kirche", "church"]],
    ["🏥", ["krankenhaus", "hospital"]],
    ["🏦", ["bank"]],
    ["🏨", ["hotel"]],
    ["🏪", ["laden", "geschäft", "shop", "store"]],
    ["🏙️", ["stadt", "city"]],
    ["🏡", ["garten", "kindergarten", "garden"]],
    ["🏞️", ["park", "natur", "nature"]],
    // sport & activities
    ["⚽", ["fußball", "fussball", "ball", "football", "soccer"]],
    ["🏀", ["basketball"]],
    ["🎾", ["tennis"]],
    ["🏊", ["schwimmen", "swim", "swimming"]],
    ["🏃", ["laufen", "rennen", "run", "running"]],
    ["🚶", ["gehen", "spazieren", "walk", "walking"]],
    ["🎮", ["spielen", "spiel", "game", "play"]],
    ["🎵", ["musik", "music", "lied", "song"]],
    ["🎤", ["singen", "sing", "mikrofon"]],
    ["💃", ["tanzen", "dance", "tanz"]],
    ["🎨", ["malen", "kunst", "paint", "art"]],
    ["🍳", ["kochen", "cook", "cooking"]],
    ["😴", ["schlafen", "sleep", "müde", "tired"]],
    ["🛒", ["kaufen", "einkaufen", "shop", "buy", "shopping"]],
    ["💼", ["arbeiten", "arbeit", "work", "job", "büro", "office"]],
    ["🗣️", ["sprechen", "reden", "speak", "talk"]],
    ["👀", ["sehen", "schauen", "see", "look", "watch"]],
    ["🤔", ["denken", "think"]],
    // feelings & simple adjectives
    ["😊", ["glücklich", "froh", "happy", "glück"]],
    ["😢", ["traurig", "sad", "weinen", "cry"]],
    ["😂", ["lachen", "laugh"]],
    ["😠", ["wütend", "böse", "angry"]],
    ["😨", ["angst", "afraid", "scared", "fear"]],
    ["👍", ["gut", "good", "toll", "super"]],
    ["👎", ["schlecht", "bad"]],
    ["🥶", ["kalt", "cold", "frieren"]],
    ["⚡", ["schnell", "fast", "quick", "blitz"]],
    ["🐌", ["langsam", "slow"]]
  ];

  var DICT = {};
  GROUPS.forEach(function (g) {
    var emoji = g[0];
    g[1].forEach(function (k) { if (!(k in DICT)) DICT[k] = emoji; });
  });

  // Normalise a term for lookup: lowercase, trim punctuation, drop a leading
  // article ("der/die/das", "the/a/an") or "to " (for verbs).
  function norm(s) {
    s = String(s == null ? "" : s).toLowerCase();
    try { s = s.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""); } catch (e) { s = s.replace(/^[^a-z0-9äöüß]+|[^a-z0-9äöüß]+$/g, ""); }
    s = s.replace(/^(der|die|das|den|dem|des|ein|eine|einen|einem|the|a|an|to)\s+/, "");
    return s.trim();
  }

  // Return an emoji for `text`, or "" if nothing sensible matches.
  function forText(text) {
    var n = norm(text);
    if (!n) return "";
    if (DICT[n]) return DICT[n];
    var words = n.split(/\s+/);
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (DICT[w]) return DICT[w];
      if (w.length > 3 && w.charAt(w.length - 1) === "s" && DICT[w.slice(0, -1)]) return DICT[w.slice(0, -1)]; // English plural
    }
    return "";
  }

  // First emoji found across several candidate strings (e.g. [German, English]).
  function forTexts(arr) {
    for (var i = 0; i < (arr || []).length; i++) {
      var e = forText(arr[i]);
      if (e) return e;
    }
    return "";
  }

  window.EmojiPick = { forText: forText, forTexts: forTexts };
})();
