/* Bundles the whole calculator into one self-contained HTML file.
   Use it when you'd rather paste the calculator straight into a GoHighLevel
   custom-code block than point an iframe at Netlify.

   Normal build, safe to commit, no API key in it:
       node build.js

   Build a testable copy with your LINZ keys baked in. The repo is public, so
   never commit the result of this one:
       LINZ_KEY=imagery-key LINZ_DATA_KEY=address-key OUT=preview.html node build.js
                                                                             */
const fs = require("fs");
const path = require("path");

const read = p => fs.readFileSync(path.join(__dirname, p), "utf8");
let html = read("index.html");

html = html.replace(
  /<link rel="stylesheet" href="assets\/css\/styles\.css">/,
  "<style>\n" + read("assets/css/styles.css") + "\n</style>"
);

["config", "nz-data", "map", "address", "calculator", "app"].forEach(name => {
  html = html.replace(
    new RegExp('<script src="assets/js/' + name + '\\.js"></script>'),
    "<script>\n" + read("assets/js/" + name + ".js") + "\n</script>"
  );
});

/* Keys are never committed, because this repository is public. Pass them in
   here for a throwaway build you can actually click through:

     LINZ_KEY=... LINZ_DATA_KEY=... OUT=preview.html node build.js            */
[
  ["LINZ_KEY",      'linzBasemapsKey: ""', "linzBasemapsKey", "aerial imagery"],
  ["LINZ_DATA_KEY", 'linzDataKey: ""',     "linzDataKey",     "address search"]
].forEach(([envVar, placeholder, field, what]) => {
  const value = process.env[envVar];
  if (!value) return;
  const before = html;
  html = html.replace(placeholder, field + ': "' + value + '"');
  if (html === before) {
    console.error("Could not find " + field + " in config.js. Not built.");
    process.exit(1);
  }
  console.log("Baked in the " + what + " key. This output must NOT be committed.");
});

const out = process.env.OUT || "dist/index.html";
fs.mkdirSync(path.dirname(path.resolve(__dirname, out)), { recursive: true });
fs.writeFileSync(path.resolve(__dirname, out), html);
console.log("Built " + out + " (" + Math.round(html.length / 1024) + " KB)");
