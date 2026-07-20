/* =====================================================================
   Build script — regenerates the two bundled versions from source.
   Run:  node build.mjs
   Outputs:
     dist/skillbee-deutsch-games.html  → standalone offline file (double-click)
     dist/artifact.html                → content-only version for the live link
   You only need this if you change the games; teachers never run it.
   ===================================================================== */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";

// Neutral fallback; app.js swaps in the official Skillbee badge (from brand.js) at runtime.
const FAVICON =
  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='%233b4de8'/></svg>";

const css = readFileSync("css/styles.css", "utf8");
const jsFiles = [
  "js/data.js",
  "js/data-cases.js",
  "js/data-compounds.js",
  "js/brand.js",
  "js/store.js",
  "js/teacher.js",
  "js/app.js",
  "js/games/quiz.js",
  "js/games/memory.js",
  "js/games/hangman.js",
  "js/games/scramble.js",
  "js/admin.js",
  // Live Mode files are bundled too, but the offline file has no Firebase,
  // so Live Mode there shows a friendly "needs the internet" message.
  "js/live/firebase.js",
  "js/live/liveGames.js",
  "js/live/live.js"
];
const js = jsFiles.map((f) => `/* ==== ${f} ==== */\n` + readFileSync(f, "utf8")).join("\n\n");

mkdirSync("dist", { recursive: true });

// 1) Standalone, fully self-contained HTML document.
writeFileSync(
  "dist/skillbee-deutsch-games.html",
  `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Skillbee Deutsch Games — Gamify your German lessons</title>
<link rel="icon" href="${FAVICON}" />
<style>
${css}
</style>
</head>
<body>
<div id="app"></div>
<script>
${js}
</script>
</body>
</html>
`
);

// 2) Artifact format (no <!doctype>/<html>/<head>/<body> — added at publish time).
writeFileSync(
  "dist/artifact.html",
  `<title>Skillbee Deutsch Games</title>
<style>
${css}
</style>
<div id="app"></div>
<script>
${js}
</script>
`
);

// 3) Cache-busting: stamp index.html's local asset URLs with a content hash so
//    that a normal page reload always fetches the newest code (no hard-refresh
//    needed). The hash only changes when the CSS/JS actually change.
const version = createHash("sha1").update(css + js).digest("hex").slice(0, 8);
let indexHtml = readFileSync("index.html", "utf8");
indexHtml = indexHtml.replace(
  /((?:href|src)="(?:css|js)\/[^"?]+)(?:\?v=[a-f0-9]+)?"/g,
  `$1?v=${version}"`
);
writeFileSync("index.html", indexHtml);

console.log("Built dist/skillbee-deutsch-games.html and dist/artifact.html");
console.log("Stamped index.html assets with ?v=" + version);
