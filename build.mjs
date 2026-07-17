/* =====================================================================
   Build script — regenerates the two bundled versions from source.
   Run:  node build.mjs
   Outputs:
     dist/skillbee-deutsch-games.html  → standalone offline file (double-click)
     dist/artifact.html                → content-only version for the live link
   You only need this if you change the games; teachers never run it.
   ===================================================================== */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const FAVICON =
  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='%233b4de8'/><path d='M20 13 H44 L54 27 L32 53 L10 27 Z' fill='white'/></svg>";

const css = readFileSync("css/styles.css", "utf8");
const jsFiles = [
  "js/data.js",
  "js/app.js",
  "js/games/quiz.js",
  "js/games/memory.js",
  "js/games/hangman.js",
  "js/games/scramble.js"
];
const js = jsFiles.map((f) => `/* ==== ${f} ==== */\n` + readFileSync(f, "utf8")).join("\n\n");

mkdirSync("dist", { recursive: true });

// 1) Standalone, fully self-contained HTML document.
writeFileSync(
  "dist/skillbee-deutsch-games.html",
  `<!DOCTYPE html>
<html lang="de">
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

console.log("Built dist/skillbee-deutsch-games.html and dist/artifact.html");
