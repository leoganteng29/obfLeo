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
:root{--bg:#0e1116;--panel:#151a22;--panel2:#1b212b;--line:#262e3a;--text:#e6e9ef;--mute:#8b93a3;--primary:#4f8cff;--primary-d:#2f63c9;--bad:#e5534b;--ok:#3ecf8e}
@media (prefers-color-scheme:light){:root{--bg:#f7f8fa;--panel:#fff;--panel2:#f0f2f5;--line:#e0e4ea;--text:#1a1f28;--mute:#6b7280;--primary:#2563eb;--primary-d:#1d4ed8}}
*{box-sizing:border-box}html,body{margin:0;min-height:100vh;background:var(--bg);color:var(--text);font-family:system-ui,sans-serif;display:grid;place-items:center;padding:20px}
.c{width:100%;max-width:380px;background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:28px 24px;box-shadow:0 30px 80px -30px rgba(0,0,0,.6)}
.lk{width:44px;height:44px;border-radius:13px;display:grid;place-items:center;background:linear-gradient(145deg,var(--primary),var(--primary-d));color:#fff;margin-bottom:16px}
h1{font-size:19px;margin:0 0 4px;letter-spacing:-.01em;word-break:break-word}
p{color:var(--mute);font-size:13px;margin:0 0 18px;line-height:1.55}
input{width:100%;background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:12px 13px;font-size:15px;outline:none;color:var(--text)}
input:focus{border-color:var(--primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--primary) 22%,transparent)}
button{width:100%;margin-top:14px;border:0;border-radius:12px;padding:13px;font-weight:700;font-size:15px;cursor:pointer;color:#fff;
  background:linear-gradient(180deg,#5b98ff 0%,var(--primary) 55%,var(--primary-d) 100%);box-shadow:0 5px 0 var(--primary-d);transition:transform .1s}
button:active{transform:translateY(4px) scale(.97);box-shadow:0 1px 0 var(--primary-d)}
button:disabled{opacity:.5}
.err{color:var(--bad);font-size:13px;margin-top:12px;min-height:16px}
.ok{color:var(--ok);font-size:13px;margin-top:12px}
a.dl{display:block;text-align:center;margin-top:10px;text-decoration:none;color:var(--primary);font-weight:600;font-size:14px}
.foot{text-align:center;color:var(--mute);font-size:11px;margin-top:16px;line-height:1.6}
</style></head><body>
<div class="c">
  <div class="lk"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></div>
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

function packJS(src, useStringArray) {
  let body = src, arr = [];
  if (useStringArray) { const r = extractStrings(src); body = r.out; arr = r.arr; }
  const helper = arr.length ? `var __a=${JSON.stringify(arr)};function __v(i){return decodeURIComponent(escape(atob(__a[i])));}\n` : "";
  const payload = btoa(unescape(encodeURIComponent(helper + body)));
  return `/* dibungkus oleh JS Packer — base64 + loader, hanya penghalang baca sekilas, BUKAN enkripsi */
(function(){
  var __p="${payload}";
  var __s=decodeURIComponent(escape(atob(__p)));
  (0,eval)(__s);
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
$("#pgo").addEventListener("click", () => {
  const err = $("#perr"); err.textContent = "";
  if (!PFILE) return (err.textContent = "Pilih file .js dulu.");
  try {
    const packed = packJS(PFILE.text, $("#padv").checked);
    const blob = new Blob([packed], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const outName = PFILE.name.replace(/\.js$/, "") + ".packed.js";
    $("#presult").classList.remove("hidden");
    $("#presult").innerHTML = `<b>File terbungkus</b><a class="btn btn-ghost" style="margin-top:0" href="${url}" download="${esc(outName)}">Unduh ${esc(outName)}</a>
      <div class="hint" style="margin-top:10px">Ingat: ini hanya penghalang baca sekilas. Siapa pun yang membuka DevTools browser saat kode ini jalan tetap bisa melihat hasil akhirnya.</div>`;
  } catch (e) {
    err.textContent = "Gagal membungkus: " + e.message;
  }
});

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
