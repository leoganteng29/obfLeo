"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ====================== util: base64 <-> bytes ====================== */
function bytesToB64(bytes) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(bin);
}
function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ====================== AES-256-GCM + PBKDF2 (Web Crypto) ====================== */
const KDF_ITER = 310000;

async function deriveKey(password, saltBytes, usage) {
  const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), { name: "PBKDF2" }, false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBytes, iterations: KDF_ITER, hash: "SHA-256" },
    km,
    { name: "AES-GCM", length: 256 },
    false,
    [usage]
  );
}

async function encryptBytes(bytes, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, "encrypt");
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes));
  return { salt, iv, ct };
}

async function decryptBytes(ct, password, saltB64, ivB64) {
  const salt = b64ToBytes(saltB64), iv = b64ToBytes(ivB64);
  const key = await deriveKey(password, salt, "decrypt");
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct)); // AES-GCM throws on wrong password / tampering
}

/* ====================== password strength (estimate only, local) ====================== */
function pwScore(p) {
  if (!p) return 0;
  let pool = 0;
  if (/[a-z]/.test(p)) pool += 26;
  if (/[A-Z]/.test(p)) pool += 26;
  if (/[0-9]/.test(p)) pool += 10;
  if (/[^A-Za-z0-9]/.test(p)) pool += 32;
  const bits = p.length * Math.log2(Math.max(pool, 1));
  if (p.length < 8) return 1;
  if (bits < 50) return 2;
  if (bits < 80) return 3;
  return 4;
}
function paintMeter(el, score) {
  const colors = ["var(--bad)", "var(--bad)", "var(--warn)", "var(--info)", "var(--ok)"];
  const widths = [6, 25, 50, 75, 100];
  el.style.width = widths[score] + "%";
  el.style.background = colors[score];
}

/* ====================== vault HTML template ====================== */
// Vault = satu file HTML berdiri sendiri. Tidak ada server, tidak ada data terkirim ke mana pun.
// Isi asli (nama file, mime, bytes) hanya bisa dibuka lewat AES-256-GCM dengan password yang benar.
function buildVaultHtml({ filename, mime, saltB64, ivB64, ctB64 }) {
  const safeName = esc(filename);
  return `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Vault · ${safeName}</title>
<style>
:root{--bg:#0c1a2d;--panel:#122640;--panel2:#18304d;--line:#27446a;--text:#eaf1fb;--mute:#93a8c4;--primary:#5aa2ff;--primary-d:#2f6fc9;--bad:#ef6a62;--ok:#3ecf8e}
@media (prefers-color-scheme:light){:root{--bg:#f4efe6;--panel:#fffdf8;--panel2:#f6f0e4;--line:#e4dac6;--text:#23262e;--mute:#6f6a5e;--primary:#2f7fd8;--primary-d:#1f5fae}}
*{box-sizing:border-box}html,body{margin:0;min-height:100vh;background:var(--bg);color:var(--text);font-family:system-ui,sans-serif;display:grid;place-items:center;padding:20px}
.c{width:100%;max-width:380px;background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:28px 24px;box-shadow:0 30px 80px -30px rgba(0,0,0,.6)}
.lk{width:44px;height:44px;border-radius:13px;display:grid;place-items:center;background:linear-gradient(145deg,var(--primary),var(--primary-d));color:#fff;margin-bottom:16px}
h1{font-size:19px;margin:0 0 4px;letter-spacing:-.01em;word-break:break-word}
p{color:var(--mute);font-size:13px;margin:0 0 18px;line-height:1.55}
input{width:100%;background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:12px 13px;font-size:15px;outline:none;color:var(--text)}
input:focus{border-color:var(--primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--primary) 22%,transparent)}
button{width:100%;margin-top:14px;border:0;border-radius:12px;padding:13px;font-weight:700;font-size:15px;cursor:pointer;color:#fff;
  background:linear-gradient(180deg,var(--primary) 0%,var(--primary-d) 100%);box-shadow:0 5px 0 var(--primary-d);transition:transform .1s}
button:active{transform:translateY(4px) scale(.97);box-shadow:0 1px 0 var(--primary-d)}
button:disabled{opacity:.5}
.err{color:var(--bad);font-size:13px;margin-top:12px;min-height:16px}
.ok{color:var(--ok);font-size:13px;margin-top:12px}
a.dl{display:block;text-align:center;margin-top:10px;text-decoration:none;color:var(--primary);font-weight:600;font-size:14px}
.foot{text-align:center;color:var(--mute);font-size:11px;margin-top:16px;line-height:1.6}
</style></head><body>
<div class="c">
  <div class="lk"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2.5 2.5 10.2l6.9 2.6 2.6 6.9z"/><path d="M21.5 2.5 9.4 12.8"/><path d="M9.4 12.8 9 18l3-3.6"/></svg></div>
  <h1>${safeName}</h1>
  <p>File ini terkunci dengan AES-256-GCM. Masukkan password untuk membuka. Semuanya diproses di browser kamu sendiri &mdash; tidak ada yang dikirim ke server mana pun.</p>
  <form id="f" autocomplete="off">
    <input id="pw" type="password" placeholder="Password" autocomplete="current-password" required>
    <button id="go" type="submit">Buka File</button>
  </form>
  <div class="err" id="err"></div>
  <div id="out"></div>
  <div class="foot">Dibuat dengan Vault Generator &mdash; tanpa password yang benar, isi file ini tidak bisa dipulihkan.</div>
</div>
<script>
"use strict";
var SALT="${saltB64}", IV="${ivB64}", CT="${ctB64}", NAME="${filename.replace(/</g, "\\u003c")}", MIME=${JSON.stringify(mime || "application/octet-stream")};
var KDF_ITER=${KDF_ITER};
function b64b(b){var bin=atob(b),o=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)o[i]=bin.charCodeAt(i);return o;}
async function openVault(pw){
  var salt=b64b(SALT), iv=b64b(IV), ct=b64b(CT);
  var km=await crypto.subtle.importKey("raw",new TextEncoder().encode(pw),{name:"PBKDF2"},false,["deriveKey"]);
  var key=await crypto.subtle.deriveKey({name:"PBKDF2",salt:salt,iterations:KDF_ITER,hash:"SHA-256"},km,{name:"AES-GCM",length:256},false,["decrypt"]);
  var pt=await crypto.subtle.decrypt({name:"AES-GCM",iv:iv},key,ct);
  return new Uint8Array(pt);
}
document.getElementById("f").addEventListener("submit", async function(e){
  e.preventDefault();
  var btn=document.getElementById("go"), err=document.getElementById("err"), out=document.getElementById("out");
  err.textContent=""; out.innerHTML=""; btn.disabled=true; btn.textContent="Membuka\u2026";
  try{
    var bytes=await openVault(document.getElementById("pw").value);
    var blob=new Blob([bytes],{type:MIME});
    var url=URL.createObjectURL(blob);
    var a=document.createElement("a"); a.href=url; a.download=NAME; a.className="dl"; a.textContent="\u2713 Terbuka \u2014 Unduh " + NAME;
    out.appendChild(a);
    if (MIME.indexOf("text/html")===0 || MIME.indexOf("text/")===0){
      var v=document.createElement("a"); v.href=url; v.target="_blank"; v.rel="noopener"; v.className="dl"; v.textContent="Lihat di tab baru";
      out.appendChild(v);
    }
  }catch(_){
    err.textContent="Password salah, atau file sudah rusak/diubah.";
  }finally{ btn.disabled=false; btn.textContent="Buka File"; }
});
</script>
</body></html>`;
}

/* ====================== JS packer (base64 wrap + optional string-array layer) ====================== */
// Catatan jujur: ini OBFUSKASI, bukan enkripsi. Kode tetap harus bisa dijalankan oleh browser korban,
// jadi siapapun yang punya akses DevTools pada akhirnya bisa melihat hasil akhirnya. Ini hanya penghalang.
function extractStrings(src) {
  const arr = [];
  const re = /'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g;
  const out = src.replace(re, (m) => {
    if (m.length < 3) return m; // skip string kosong, tidak perlu diacak
    let val;
    try { val = JSON.parse(m[0] === "'" ? '"' + m.slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"') + '"' : m); }
    catch (_) { return m; } // kalau gagal parse (kasus escape rumit), biarkan apa adanya — lebih aman daripada merusak kode
    const idx = arr.length;
    arr.push(btoa(unescape(encodeURIComponent(val))));
    return `__v(${idx})`;
  });
  return { out, arr };
}

/* ---- generator nama variabel per "gaya" (murni kosmetik, tidak mengubah perilaku kode) ---- */
const ID_POOLS = {
  arab: "أبتثجحخدذرزسشصضطظعغفقكلمنهوي".split(""),
  japan: "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん".split(""),
  mandarin: "龙风云山水火光影电梦云海天空星辰月影霜雪龍鳳麒麟虎豹蛟蟒隐影幻影迅捷疾风".split(""),
};
function makeNamer(idStyle, customName) {
  const used = new Set(["eval"]);
  function raw() {
    if (idStyle === "custom") {
      const base = (customName || "X").replace(/[^A-Za-z0-9_$\u00C0-\uFFFF]/g, "").slice(0, 18) || "X";
      return (/^[0-9]/.test(base) ? "_" + base : base) + "_" + Math.random().toString(36).slice(2, 6);
    }
    if (idStyle === "invisible") {
      const zw = ["\u200c", "\u200d"];
      let s = "_";
      const n = 6 + Math.floor(Math.random() * 6);
      for (let i = 0; i < n; i++) s += zw[Math.floor(Math.random() * 2)];
      return s;
    }
    if (idStyle === "arab" || idStyle === "japan" || idStyle === "mandarin") {
      const pool = ID_POOLS[idStyle];
      const n = 3 + Math.floor(Math.random() * 4);
      let s = "";
      for (let i = 0; i < n; i++) s += pool[Math.floor(Math.random() * pool.length)];
      return s;
    }
    return "_" + Math.random().toString(36).slice(2, 8); // ascii (acak)
  }
  return function next() {
    let name = raw(), tries = 0;
    while (used.has(name) && tries++ < 15) name = raw() + (idStyle === "custom" || idStyle === "ascii" ? "" : raw().slice(0, 1));
    used.add(name);
    return name;
  };
}

const PRESET_LABEL = {
  standard: "Standar", quantum: "Quantum Vortex", nebula: "Nebula Polymorphic Storm",
  calcrick: "Calcrick Chaos Core", timelock: "Time-Locked", custom: "Kustom",
};

/* ====================== JS packer (base64 + "gaya" obfuskasi, murni di browser) ======================
   Semua "gaya" di bawah ini HANYA mengubah tampilan/lapisan pembungkus (base64, XOR, pecah-acak,
   balik-string, nama variabel) — bukan enkripsi sungguhan dan bukan proteksi mutlak. Siapa pun yang
   menjalankan kode ini lewat DevTools pada akhirnya tetap bisa melihat hasil akhirnya. */
function extractStrings(src) {
  const arr = [];
  const re = /'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g;
  const out = src.replace(re, (m) => {
    if (m.length < 3) return m; // skip string kosong, tidak perlu diacak
    let val;
    try { val = JSON.parse(m[0] === "'" ? '"' + m.slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"') + '"' : m); }
    catch (_) { return m; } // kalau gagal parse (kasus escape rumit), biarkan apa adanya — lebih aman daripada merusak kode
    const idx = arr.length;
    arr.push(btoa(unescape(encodeURIComponent(val))));
    return `__v(${idx})`;
  });
  return { out, arr };
}

function b64Encode(str) { return btoa(unescape(encodeURIComponent(str))); }

function packJS(src, opts) {
  const { useStringArray, preset = "standard", idStyle = "ascii", customName = "", expireDays = 7, selfCheck = true } = opts || {};
  const effStyle = preset === "custom" ? "custom" : idStyle;
  const name = makeNamer(effStyle, customName);

  let body = src, arr = [];
  if (useStringArray) { const r = extractStrings(src); body = r.out; arr = r.arr; }
  const helper = arr.length ? `var __a=${JSON.stringify(arr)};function __v(i){return decodeURIComponent(escape(atob(__a[i])));}\n` : "";
  const payloadB64 = b64Encode(helper + body);

  const banner = `/* 🕊 dibungkus oleh JS Packer — gaya "${PRESET_LABEL[preset] || preset}". Ini OBFUSKASI, BUKAN enkripsi. */\n`;
  const selfGuard = selfCheck
    ? `if(!((function(){return eval('1+1')===2;})()))throw new Error('Lingkungan eksekusi tidak dikenali.');\n  `
    : "";
  const decodeStd = (pVar, sVar) => `var ${sVar}=decodeURIComponent(escape(atob(${pVar})));`;

  let decl = "", runVar;

  if (preset === "quantum") {
    const vK = name(), vA = name(), vP = name(), vS = name();
    const k = Math.floor(Math.random() * 256);
    const codes = [];
    for (let i = 0; i < payloadB64.length; i++) codes.push(payloadB64.charCodeAt(i) ^ (k + (i % 16)));
    decl = `var ${vK}=${k};\n  var ${vA}=${JSON.stringify(codes)};\n  var ${vP}=String.fromCharCode.apply(null,${vA}.map(function(c,i){return c^(${vK}+(i%16));}));\n  ${decodeStd(vP, vS)}`;
    runVar = vS;
  } else if (preset === "nebula") {
    const n = 6 + Math.floor(Math.random() * 5);
    const size = Math.ceil(payloadB64.length / n);
    const chunks = [];
    for (let i = 0; i < n; i++) chunks.push(payloadB64.slice(i * size, i * size + size));
    const order = chunks.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const shuffled = order.map((origIdx) => chunks[origIdx]);
    const posOf = new Array(n); order.forEach((origIdx, pos) => { posOf[origIdx] = pos; });
    const vC = name(), vO = name(), vP = name(), vS = name();
    decl = `var ${vC}=${JSON.stringify(shuffled)};\n  var ${vO}=${JSON.stringify(posOf)};\n  var ${vP}="";\n  for(var __i=0;__i<${vO}.length;__i++){${vP}+=${vC}[${vO}[__i]];}\n  ${decodeStd(vP, vS)}`;
    runVar = vS;
  } else if (preset === "calcrick") {
    const reversed = payloadB64.split("").reverse().join("");
    const size = 12, chunks = [];
    for (let i = 0; i < reversed.length; i += size) chunks.push(reversed.slice(i, i + size));
    const vC = name(), vP = name(), vS = name();
    decl = `var ${vC}=${JSON.stringify(chunks)};\n  var ${vP}=${vC}.join("").split("").reverse().join("");\n  ${decodeStd(vP, vS)}`;
    runVar = vS;
  } else if (preset === "timelock") {
    const days = Math.min(365, Math.max(1, parseInt(expireDays, 10) || 7));
    const expiry = Date.now() + days * 86400000;
    const vE = name(), vP = name(), vS = name();
    decl = `var ${vE}=${expiry};\n  if(Date.now()>${vE})throw new Error('Skrip ini sudah kedaluwarsa (masa aktif ${days} hari sejak dibungkus).');\n  var ${vP}="${payloadB64}";\n  ${decodeStd(vP, vS)}`;
    runVar = vS;
  } else {
    // standard & custom (custom hanya beda gaya nama variabel)
    const vP = name(), vS = name();
    decl = `var ${vP}="${payloadB64}";\n  ${decodeStd(vP, vS)}`;
    runVar = vS;
  }

  return `${banner}(function(){
  ${selfGuard}${decl}
  (0,eval)(${runVar});
})();
`;
}

/* ====================== UI wiring ====================== */
let VFILE = null; // {name, mime, bytes}
let DFILE = null; // vault html file content
let PFILE = null; // {name, text}

function openTab(name) {
  $$("#tabs .tab").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.tab === name)));
  $$("[data-pane]").forEach((p) => p.classList.toggle("hidden", p.dataset.pane !== name));
}
$("#tabs").addEventListener("click", (e) => { const t = e.target.closest(".tab"); if (t) openTab(t.dataset.tab); });

function wireDrop(dropEl, inputEl, onFile) {
  dropEl.addEventListener("click", () => inputEl.click());
  dropEl.addEventListener("dragover", (e) => { e.preventDefault(); dropEl.classList.add("over"); });
  dropEl.addEventListener("dragleave", () => dropEl.classList.remove("over"));
  dropEl.addEventListener("drop", (e) => { e.preventDefault(); dropEl.classList.remove("over"); if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); });
  inputEl.addEventListener("change", () => { if (inputEl.files[0]) onFile(inputEl.files[0]); });
}

function guessMime(name) {
  const ext = name.split(".").pop().toLowerCase();
  return { zip: "application/zip", js: "text/javascript", html: "text/html", htm: "text/html", json: "application/json", css: "text/css", txt: "text/plain", pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" }[ext] || "application/octet-stream";
}
function takeoff() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  el.setAttribute("viewBox", "0 0 64 40");
  el.setAttribute("class", "takeoff");
  el.innerHTML = '<use href="#pp"/>';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}
function fmtSize(n) { return n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KB" : (n / 1048576).toFixed(1) + " MB"; }

/* ---- Vault: encrypt ---- */
wireDrop($("#vdrop"), $("#vinput"), (f) => {
  const r = new FileReader();
  r.onload = () => {
    VFILE = { name: f.name, mime: f.type || guessMime(f.name), bytes: new Uint8Array(r.result) };
    $("#vchip").classList.remove("hidden");
    $("#vchip b").textContent = f.name;
    $("#vchip span").textContent = fmtSize(f.size);
    $("#vresult").classList.add("hidden");
  };
  r.readAsArrayBuffer(f);
});
$("#vpw").addEventListener("input", () => paintMeter($("#vmeterbar"), pwScore($("#vpw").value)));
$("#veye").onclick = () => { const i = $("#vpw"); i.type = i.type === "password" ? "text" : "password"; };

$("#vgo").addEventListener("click", async () => {
  const err = $("#verr"); err.textContent = "";
  if (!VFILE) return (err.textContent = "Pilih file dulu.");
  const pw = $("#vpw").value, pw2 = $("#vpw2").value;
  if (!pw) return (err.textContent = "Isi password.");
  if (pw !== pw2) return (err.textContent = "Konfirmasi password tidak sama.");
  if (pwScore(pw) < 2) return (err.textContent = "Password terlalu lemah — pakai minimal 8 karakter campuran.");
  const btn = $("#vgo"); btn.disabled = true;
  $("#vprog").classList.add("show");
  try {
    await new Promise((res) => setTimeout(res, 30)); // biar spinner sempat kegambar sebelum PBKDF2 yang berat
    const { salt, iv, ct } = await encryptBytes(VFILE.bytes, pw);
    const html = buildVaultHtml({ filename: VFILE.name, mime: VFILE.mime, saltB64: bytesToB64(salt), ivB64: bytesToB64(iv), ctB64: bytesToB64(ct) });
    DFILE = html;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const outName = VFILE.name.replace(/\.[^.]+$/, "") + ".vault.html";
    takeoff();
    $("#vresult").classList.remove("hidden");
    $("#vresult").innerHTML = `<b>Vault siap</b><a class="btn btn-ghost" style="margin-top:0" href="${url}" download="${esc(outName)}">Unduh ${esc(outName)}</a>
      <div class="hint" style="margin-top:10px">Kirim file ini ke siapa pun kamu mau. Tanpa password yang benar, isinya tidak bisa dipulihkan oleh siapapun.</div>`;
  } catch (e) {
    err.textContent = "Gagal memproses: " + e.message;
  } finally {
    btn.disabled = false;
    $("#vprog").classList.remove("show");
  }
});

/* ---- Vault: decrypt (uji coba vault yang sudah dibuat, tanpa buka file HTML-nya) ---- */
wireDrop($("#ddrop"), $("#dinput"), (f) => {
  const r = new FileReader();
  r.onload = () => { DFILE = r.result; $("#dchip").classList.remove("hidden"); $("#dchip b").textContent = f.name; $("#dchip span").textContent = fmtSize(f.size); };
  r.readAsText(f);
});
$("#deye").onclick = () => { const i = $("#dpw"); i.type = i.type === "password" ? "text" : "password"; };
$("#dgo").addEventListener("click", async () => {
  const err = $("#derr"); err.textContent = ""; $("#dresult").classList.add("hidden");
  if (!DFILE) return (err.textContent = "Pilih file .vault.html dulu.");
  const m = DFILE.match(/var SALT="([^"]*)", IV="([^"]*)", CT="([^"]*)", NAME="((?:[^"\\]|\\.)*)", MIME=(".*?");/);
  if (!m) return (err.textContent = "Bukan file vault yang valid.");
  const btn = $("#dgo"); btn.disabled = true; $("#dprog").classList.add("show");
  try {
    await new Promise((res) => setTimeout(res, 30));
    const bytes = await decryptBytes(b64ToBytes(m[3]), $("#dpw").value, m[1], m[2]);
    const name = m[4].replace(/\\u003c/g, "<");
    const mime = JSON.parse(m[5]);
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    $("#dresult").classList.remove("hidden");
    $("#dresult").innerHTML = `<b>Berhasil dibuka</b><a class="btn btn-ghost" style="margin-top:0" href="${url}" download="${esc(name)}">Unduh ${esc(name)}</a>`;
  } catch (e) {
    err.textContent = "Password salah, atau file sudah rusak/diubah.";
  } finally {
    btn.disabled = false; $("#dprog").classList.remove("show");
  }
});

/* ---- JS Packer ---- */
wireDrop($("#pdrop"), $("#pinput"), (f) => {
  const r = new FileReader();
  r.onload = () => { PFILE = { name: f.name, text: r.result }; $("#pchip").classList.remove("hidden"); $("#pchip b").textContent = f.name; $("#pchip span").textContent = fmtSize(f.size); $("#presult").classList.add("hidden"); };
  r.readAsText(f);
});

const PRESET_HINT = {
  standard: "Satu lapis base64 + loader. Paling ringan, paling cepat.",
  quantum: "Payload di-XOR dengan kunci acak sebelum dibungkus base64 — satu lapis tambahan dari standar.",
  nebula: "Payload dipecah jadi beberapa bagian, urutannya diacak, lalu disusun ulang saat dijalankan.",
  calcrick: "Payload dibalik urutan karakternya lalu dipecah jadi potongan-potongan kecil.",
  timelock: "Sama seperti standar, tapi kode menolak berjalan setelah jumlah hari yang kamu tentukan lewat.",
  custom: "Sama seperti standar, tapi nama variabel di hasilnya memakai kata kuncimu sebagai awalan.",
};
function updatePresetUI() {
  const v = $("#ppreset").value;
  $("#pexpireWrap").classList.toggle("hidden", v !== "timelock");
  $("#pcustomWrap").classList.toggle("hidden", v !== "custom");
  $("#pidstyle").disabled = v === "custom";
  $("#ppresetHint").textContent = PRESET_HINT[v] || "";
}
$("#ppreset").addEventListener("change", updatePresetUI);
updatePresetUI();

$("#pgo").addEventListener("click", () => {
  const err = $("#perr"); err.textContent = "";
  if (!PFILE) return (err.textContent = "Pilih file .js dulu.");
  const preset = $("#ppreset").value;
  if (preset === "custom" && !$("#pcustom").value.trim()) return (err.textContent = "Isi dulu kata kunci nama variabelnya.");
  try {
    const packed = packJS(PFILE.text, {
      useStringArray: $("#padv").checked,
      preset,
      idStyle: $("#pidstyle").value,
      customName: $("#pcustom").value.trim(),
      expireDays: $("#pexpire").value,
      selfCheck: $("#pself").checked,
    });
    const blob = new Blob([packed], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const outName = PFILE.name.replace(/\.js$/, "") + ".packed.js";
    takeoff();
    $("#presult").classList.remove("hidden");
    $("#presult").innerHTML = `<b>File terbungkus (${esc(PRESET_LABEL[preset] || preset)})</b><a class="btn btn-ghost" style="margin-top:0" href="${url}" download="${esc(outName)}">Unduh ${esc(outName)}</a>
      <div class="hint" style="margin-top:10px">Ingat: ini hanya penghalang baca sekilas. Siapa pun yang membuka DevTools browser saat kode ini jalan tetap bisa melihat hasil akhirnya.</div>`;
  } catch (e) {
    err.textContent = "Gagal membungkus: " + e.message;
  }
});


/* ====================== Cari musik ======================
   Sumber utama: iTunes Search API (Apple) — gratis, tanpa API key, mendukung CORS.
   Cadangan 1: iTunes via JSONP (menembus blokir CORS/ekstensi).
   Cadangan 2: Deezer API via JSONP (Deezer tidak mengaktifkan CORS, jadi hanya bisa lewat JSONP).
   Kalau satu sumber gagal/timeout, otomatis pindah ke sumber berikutnya. */
const SEARCH_TIMEOUT = 8000;

function jsonp(url, extra) {
  return new Promise((resolve, reject) => {
    const cb = "__jp" + Math.random().toString(36).slice(2);
    const sc = document.createElement("script");
    const done = () => { clearTimeout(t); delete window[cb]; sc.remove(); };
    const t = setTimeout(() => { done(); reject(new Error("timeout")); }, SEARCH_TIMEOUT);
    window[cb] = (data) => { done(); resolve(data); };
    sc.onerror = () => { done(); reject(new Error("network")); };
    sc.src = url + (url.includes("?") ? "&" : "?") + (extra || "") + "callback=" + cb;
    document.head.appendChild(sc);
  });
}
const safeUrl = (u) => (typeof u === "string" && /^https:\/\//i.test(u) ? u : "");

function fromItunes(d) {
  return (d.results || []).filter((x) => x.trackName).map((x) => ({
    id: "i" + x.trackId, title: x.trackName, artist: x.artistName || "", album: x.collectionName || "",
    art: safeUrl((x.artworkUrl100 || "").replace("100x100", "200x200")), preview: safeUrl(x.previewUrl),
    link: safeUrl(x.trackViewUrl), ms: x.trackTimeMillis || 0,
  }));
}
function fromDeezer(d) {
  if (d.error) throw new Error("deezer");
  return (d.data || []).map((x) => ({
    id: "d" + x.id, title: x.title, artist: (x.artist && x.artist.name) || "", album: (x.album && x.album.title) || "",
    art: safeUrl(x.album && (x.album.cover_medium || x.album.cover)), preview: safeUrl(x.preview),
    link: safeUrl(x.link), ms: (x.duration || 0) * 1000,
  }));
}

async function searchMusic(q) {
  const enc = encodeURIComponent(q);
  const itunes = "https://itunes.apple.com/search?media=music&entity=song&limit=25&term=" + enc;
  const sources = [
    ["Apple iTunes", async () => {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), SEARCH_TIMEOUT);
      try { const r = await fetch(itunes, { signal: ctl.signal }); if (!r.ok) throw new Error("http " + r.status); return fromItunes(await r.json()); }
      finally { clearTimeout(t); }
    }],
    ["Apple iTunes", async () => fromItunes(await jsonp(itunes))],
    ["Deezer", async () => fromDeezer(await jsonp("https://api.deezer.com/search?limit=25&output=jsonp&q=" + enc))],
  ];
  let lastErr;
  for (const [name, run] of sources) {
    try { const tracks = await run(); if (tracks.length) return { name, tracks }; if (name === "Deezer") return { name, tracks: [] }; }
    catch (e) { lastErr = e; }
  }
  if (lastErr) throw lastErr;
  return { name: "Apple iTunes", tracks: [] };
}

const ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4.2" height="14" rx="1.2"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.2"/></svg>';
const ICON_OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4 10 14"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';

const player = new Audio(); player.preload = "none";
let curBtn = null;
function resetPlaying() {
  if (curBtn) { curBtn.innerHTML = ICON_PLAY; curBtn.setAttribute("aria-label", "Putar cuplikan"); curBtn.closest(".track").classList.remove("playing"); curBtn = null; }
}
player.addEventListener("ended", resetPlaying);
player.addEventListener("error", () => { if (curBtn) { $("#merr").textContent = "Cuplikan tidak bisa diputar."; resetPlaying(); } });

function renderTracks(tracks) {
  $("#mlist").innerHTML = tracks.map((t, i) => {
    const mins = t.ms ? Math.floor(t.ms / 60000) + ":" + String(Math.floor(t.ms / 1000) % 60).padStart(2, "0") : "";
    return `<li class="track">
      ${t.art ? `<img class="art" src="${esc(t.art)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<div class="art"></div>`}
      <div class="info"><div class="ti" title="${esc(t.title)}">${esc(t.title)}</div>
        <div class="ar">${esc(t.artist)}${t.album ? " · " + esc(t.album) : ""}${mins ? " · " + mins : ""}</div></div>
      <div class="go">
        <button class="ibtn play" data-i="${i}" ${t.preview ? "" : "disabled"} aria-label="Putar cuplikan">${ICON_PLAY}</button>
        ${t.link ? `<a class="ibtn ext" href="${esc(t.link)}" target="_blank" rel="noopener noreferrer" aria-label="Buka lagu lengkap">${ICON_OPEN}</a>` : ""}
      </div></li>`;
  }).join("");
}

let MTRACKS = [], mSeq = 0;
$("#mform").addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = $("#mq").value.trim();
  const err = $("#merr"); err.textContent = "";
  if (!q) return (err.textContent = "Ketik judul lagu atau nama artis dulu.");
  const seq = ++mSeq;
  player.pause(); resetPlaying();
  $("#mgo").disabled = true;
  $("#mmeta").classList.add("hidden");
  $("#mlist").innerHTML = '<li class="track sk-row sk"></li>'.repeat(4);
  try {
    const { name, tracks } = await searchMusic(q);
    if (seq !== mSeq) return;
    MTRACKS = tracks;
    if (!tracks.length) { $("#mlist").innerHTML = `<li class="empty">Tidak ada hasil untuk “${esc(q)}”. Coba kata kunci lain.</li>`; return; }
    renderTracks(tracks);
    $("#mmeta").classList.remove("hidden");
    $("#mmeta").textContent = `${tracks.length} hasil dari ${name}`;
    takeoff();
  } catch (_) {
    if (seq !== mSeq) return;
    $("#mlist").innerHTML = "";
    err.textContent = "Tidak bisa terhubung ke layanan musik. Periksa koneksi internet kamu (atau matikan ad-blocker untuk situs ini), lalu coba lagi.";
  } finally { if (seq === mSeq) $("#mgo").disabled = false; }
});
$("#mlist").addEventListener("click", (e) => {
  const b = e.target.closest(".play"); if (!b || b.disabled) return;
  const t = MTRACKS[+b.dataset.i]; if (!t) return;
  $("#merr").textContent = "";
  if (curBtn === b) { player.pause(); resetPlaying(); return; }
  resetPlaying();
  player.src = t.preview;
  player.play().then(() => { curBtn = b; b.innerHTML = ICON_PAUSE; b.setAttribute("aria-label", "Jeda"); b.closest(".track").classList.add("playing"); })
    .catch(() => { $("#merr").textContent = "Cuplikan tidak bisa diputar."; });
});
// pindah tab -> hentikan musik
$("#tabs").addEventListener("click", () => { if (!$('[data-pane="music"]').classList.contains("hidden")) return; player.pause(); resetPlaying(); });

/* ---- parallax (pointer + scroll, digabung biar tidak saling timpa) ---- */
const orbs = $$(".orb").map((o, i) => ({ el: o, d: [26, -20, 34][i] || 20, sp: [0.08, -0.06, 0.1][i] || 0.08, px: 0, py: 0, sy: 0 }));
function paintOrbs() { orbs.forEach((o) => { o.el.style.transform = `translate(${o.px}px, ${o.py + o.sy}px)`; }); }
if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
  window.addEventListener("pointermove", (e) => {
    const nx = e.clientX / innerWidth - 0.5, ny = e.clientY / innerHeight - 0.5;
    orbs.forEach((o) => { o.px = nx * o.d; o.py = ny * o.d; });
    paintOrbs();
  }, { passive: true });
}
window.addEventListener("scroll", () => {
  const sc = window.scrollY;
  orbs.forEach((o) => { o.sy = sc * o.sp; });
  paintOrbs();
}, { passive: true });
