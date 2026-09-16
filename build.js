/* Bundles the whole calculator into one self-contained dist/index.html.
   Use it when you'd rather paste the calculator straight into a GoHighLevel
   custom-code block than point an iframe at Netlify.
   Run with:  node build.js                                                  */
const fs = require("fs");
const path = require("path");

const read = p => fs.readFileSync(path.join(__dirname, p), "utf8");
let html = read("index.html");

html = html.replace(
  /<link rel="stylesheet" href="assets\/css\/styles\.css">/,
  "<style>\n" + read("assets/css/styles.css") + "\n</style>"
);

["config", "nz-data", "map", "calculator", "app"].forEach(name => {
  html = html.replace(
    new RegExp('<script src="assets/js/' + name + '\\.js"></script>'),
    "<script>\n" + read("assets/js/" + name + ".js") + "\n</script>"
  );
});

fs.mkdirSync(path.join(__dirname, "dist"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "dist/index.html"), html);
console.log("Built dist/index.html (" + Math.round(html.length / 1024) + " KB)");
