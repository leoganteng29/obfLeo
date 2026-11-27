/* Build aman untuk NEXUS TOOLBOX: menolak zip publik bila API key terisi. */
(function () {
  "use strict";
  const fs = require("fs");
  const path = require("path");
  const crypto = require("crypto");
  const { execFileSync } = require("child_process");

  const root = __dirname;
  const zip = path.join(root, "nexus-toolbox-secure.zip");
  const configPath = path.join(root, "js", "ai-key.local.js");
  const config = fs.readFileSync(configPath, "utf8");

  const block = config.match(/NEXUS_AI_KEYS\s*=\s*window\.NEXUS_AI_KEYS\s*\|\|\s*\{([\s\S]*?)\}/);
  if (!block) {
    console.error("GAGAL: blok NEXUS_AI_KEYS tidak ditemukan di js/ai-key.local.js");
    process.exit(1);
  }
  const filled = block[1].split(/\r?\n/).filter((line) => {
    if (!/^\s*[a-z]+\s*:/.test(line)) return false;
    const value = (line.match(/["']([^"']*)["']/) || [])[1];
    return !!value && !/^(tempel|isi|sk-?)$/i.test(value);
  });
  if (filled.length) {
    console.error("GAGAL: js/ai-key.local.js berisi API key. Kosongkan sebelum membuat zip publik!");
    console.error("Baris terisi: " + filled.map((s) => s.trim()).join(" | "));
    process.exit(1);
  }

  const publicFiles = [
    "index.html", "README.md", "build-public.js",
    "css/ai.css", "css/modern.css", "css/styles.css",
    "js/ai-key.local.js", "js/ai.js", "js/app.js", "js/code-tools.js", "js/core.js",
    "js/fx.js", "js/games.js", "js/icons.js", "js/music.js", "js/photolive.js",
    "js/protection.js", "js/qr.js", "js/registry.js", "js/security.js",
    "js/utility-tools.js",
    "vendor/gsap.min.js", "vendor/ScrollTrigger.min.js", "vendor/SplitText.min.js",
    "vendor/lenis-lite.js", "fonts/AROMA.ttf"
  ];

  for (const rel of publicFiles) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) { console.error("GAGAL: file hilang: " + rel); process.exit(1); }
    if (/\.(js|html|md|css)$/.test(rel) && /(sk-[A-Za-z0-9_-]{10,}|xoxb-[A-Za-z0-9-]{10,})/.test(fs.readFileSync(abs, "utf8"))) {
      console.error("GAGAL: pola API key ditemukan di file publik: " + rel);
      process.exit(1);
    }
  }

  try { fs.unlinkSync(zip); } catch (e) {}
  execFileSync("zip", ["-q", "-r", zip].concat(publicFiles), { cwd: root, stdio: "inherit" });
  const hash = crypto.createHash("sha256").update(fs.readFileSync(zip)).digest("hex");
  console.log("ZIP publik aman: " + zip);
  console.log("SHA-256: " + hash);
})();
