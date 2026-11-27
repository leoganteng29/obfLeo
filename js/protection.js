/* NEXUS TOOLBOX — JavaScript Code Protector (local transforms only) */
(function (N) {
  "use strict";

  const ico = (name, cls) => (N.icons ? N.icons.svg(name, cls) : "");
  const { escapeHtml: esc } = N.core;
  const tokenize = N.codeTools.tokenizeJS;
  const minifyJS = N.codeTools.minifyJS;

  const MODES = [
    { id: "basic", num: "01", name: "Basic Protection", desc: "Transformasi ringan: hapus komentar, pecah string, ubah bilangan ke hex. Struktur tetap terbaca." },
    { id: "rename", num: "02", name: "Identifier Renaming", desc: "Ganti nama identifier lokal yang aman. Properti, global, export, dan nama di dalam string dikunci." },
    { id: "compact", num: "03", name: "Compact Output", desc: "Hilangkan whitespace dan komentar yang tidak diperlukan tanpa mengubah perilaku kode." },
    { id: "readability", num: "04", name: "Readability Reduction", desc: "Kombinasi kompresi, penggantian nama aman, dan transformasi literal terukur." },
    { id: "custom", num: "05", name: "Custom Settings", desc: "Atur sendiri tiap transformasi, lihat preview, dan baca informasi risikonya." }
  ];

  const GLOBALS = new Set([
    "window", "document", "console", "globalThis", "global", "process", "require", "module", "exports",
    "Buffer", "Math", "JSON", "Object", "Array", "String", "Number", "Boolean", "Date", "RegExp",
    "Promise", "Symbol", "Map", "Set", "WeakMap", "WeakSet", "Proxy", "Reflect", "Error", "TypeError",
    "parseInt", "parseFloat", "isNaN", "isFinite", "encodeURI", "encodeURIComponent", "decodeURI",
    "decodeURIComponent", "fetch", "setTimeout", "setInterval", "clearTimeout", "clearInterval",
    "queueMicrotask", "requestAnimationFrame", "alert", "confirm", "prompt", "localStorage", "sessionStorage",
    "location", "navigator", "history", "HTMLElement", "Event", "CustomEvent", "URL", "URLSearchParams",
    "TextEncoder", "TextDecoder", "Uint8Array", "Uint16Array", "Uint32Array", "ArrayBuffer", "DataView",
    "eval", "Function", "with", "arguments", "this", "undefined", "null", "NaN", "Infinity", "class",
    "await", "async", "yield", "new", "typeof", "instanceof", "void", "delete", "in", "of", "return",
    "throw", "try", "catch", "finally", "if", "else", "for", "while", "do", "switch", "case", "default",
    "break", "continue", "var", "let", "const", "function", "import", "export", "from", "as", "extends",
    "super", "static", "get", "set", "debugger", "true", "false"
  ]);

  const DANGEROUS = /\b(eval|Function|globalThis|window)\b|\bwith\s*\(|\bimport\s*\(|\[\s*["'](?:eval|Function)["']\s*\]|\b(?:setTimeout|setInterval)\s*\(\s*["']/;
  const IDENT_RE = /^[\p{ID_Start}_$][\p{ID_Continue}$‌‍]*$/u;

  function stringContents(tokens) {
    return tokens.filter((t) => ["string", "template", "regex", "comment"].includes(t.type)).map((t) => t.value).join("\n");
  }

  // Tetangga token yang bukan whitespace/komentar.
  function neighbors(tokens, idx) {
    let p = idx - 1;
    while (p >= 0 && (tokens[p].type === "ws" || tokens[p].type === "comment")) p--;
    let n = idx + 1;
    while (n < tokens.length && (tokens[n].type === "ws" || tokens[n].type === "comment")) n++;
    return { prev: p >= 0 ? tokens[p] : null, next: n < tokens.length ? tokens[n] : null };
  }

  // Identifier yang TIDAK boleh diganti namanya (properti, label, key objek, method, global, nama di dalam string).
  function identExclusions(tokens) {
    const stringPool = stringContents(tokens).toLowerCase();
    const excluded = new Set();
    tokens.forEach((t, idx) => {
      if (t.type !== "ident") return;
      const { prev, next } = neighbors(tokens, idx);
      const isP = (tok, type, vals) => !!tok && tok.type === type && vals.includes(tok.value);
      if (isP(prev, "punct", [".", "?.", "#"])) excluded.add(t.value);
      if (isP(next, "punct", [":"])) excluded.add(t.value);
      if (isP(prev, "ident", ["export", "import", "as", "from", "class", "function", "extends", "get", "set", "static", "async"])) excluded.add(t.value);
      if (isP(prev, "punct", ["{", ","]) && isP(next, "punct", [",", "}", "="])) excluded.add(t.value);
      // Deklarasi method: nama yang diikuti "(" dan berada di awal statement / setelah { } ; ,
      if (isP(next, "punct", ["("]) && (!prev || isP(prev, "punct", ["{", "}", ";", ","]))) excluded.add(t.value);
      if (GLOBALS.has(t.value)) excluded.add(t.value);
      if (stringPool.includes(t.value.toLowerCase())) excluded.add(t.value);
    });
    return excluded;
  }

  // Peta rename: nama lama -> nama baru. Nama baru dijamin valid dan tidak bentrok dengan identifier mana pun di sumber.
  function buildRenameMap(tokens, gen) {
    const excluded = identExclusions(tokens);
    const taken = new Set(tokens.filter((t) => t.type === "ident").map((t) => t.value));
    const names = Array.from(new Set(tokens.filter((t) => t.type === "ident" && !excluded.has(t.value)).map((t) => t.value))).sort();
    const map = Object.create(null);
    let n = 0;
    for (const name of names) {
      let cand = "";
      let guard = 0;
      do { cand = gen(n++); } while ((taken.has(cand) || GLOBALS.has(cand) || !IDENT_RE.test(cand)) && ++guard < 10000);
      if (taken.has(cand) || GLOBALS.has(cand) || !IDENT_RE.test(cand)) throw new Error("Gagal membuat nama identifier yang unik.");
      taken.add(cand);
      map[name] = cand;
    }
    return map;
  }

  function unicodeString(raw) {
    const q = raw[0];
    if ((q !== '"' && q !== "'") || raw.length < 3 || raw.includes("\\")) return raw;
    const inner = raw.slice(1, -1);
    let out = "";
    for (let i = 0; i < inner.length; i++) out += "\\u" + inner.charCodeAt(i).toString(16).padStart(4, "0");
    return q + out + q;
  }

  function splitString(raw, unicode) {
    const q = raw[0];
    if (q !== '"' && q !== "'") return raw;
    const inner = raw.slice(1, -1);
    if (!inner || inner.length < 6 || inner.includes("\\") || inner.includes("\n")) return raw;
    const size = inner.length > 24 ? 5 : 3;
    const parts = [];
    for (let i = 0; i < inner.length; i += size) {
      const piece = q + inner.slice(i, i + size) + q;
      parts.push(unicode ? unicodeString(piece) : piece);
    }
    // Dibungkus kurung agar aman terhadap operator unary dan akses properti (mis. !"a"+"b", "abc".length).
    return "(" + parts.join("+") + ")";
  }

  // Pemecahan string tidak aman sebagai key objek, bagian import/export, dan directive ("use strict").
  function canSplit(tokens, idx) {
    const { prev, next } = neighbors(tokens, idx);
    if (!prev) return false;
    if (prev.type === "punct" && [";", "{", "}"].includes(prev.value)) return false;
    if (prev.type === "ident" && ["import", "from", "export"].includes(prev.value)) return false;
    if (prev.type === "punct" && [",", "{"].includes(prev.value) && next && next.type === "punct" && next.value === ":") return false;
    return true;
  }

  function hexNumber(raw) {
    if (!/^[1-9]\d*$/.test(raw) || raw.length < 2 || Number(raw) < 16) return raw;
    return "0x" + Number(raw).toString(16);
  }

  const defaultGen = (i) => "_nx" + i.toString(36);

  function transformTokens(tokens, opts) {
    const o = Object.assign({ stripComments: true, splitStrings: false, hexNumbers: false, rename: false, unicodeEscape: false, preserveLines: false, renameMap: null }, opts);
    let renames = Object.create(null);
    if (o.renameMap) renames = o.renameMap;
    else if (o.rename) renames = buildRenameMap(tokens, defaultGen);

    let out = "";
    tokens.forEach((t, idx) => {
      if (t.type === "comment") {
        if (o.stripComments) out += o.preserveLines ? t.value.replace(/[^\n]/g, " ") : "";
        else out += t.value;
        return;
      }
      if (t.type === "ws") { out += o.preserveLines ? t.value : " "; return; }
      if (t.type === "ident" && o.rename && renames[t.value]) { out += renames[t.value]; return; }
      if (t.type === "string") {
        let v = t.value;
        if (o.splitStrings && canSplit(tokens, idx)) v = splitString(v, o.unicodeEscape);
        if (o.unicodeEscape && v === t.value) v = unicodeString(v);
        out += v; return;
      }
      if (t.type === "number" && o.hexNumbers) { out += hexNumber(t.value); return; }
      out += t.value;
    });
    return out.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();
  }

  function safeRename(code) {
    if (DANGEROUS.test(code)) return { code, warning: "Kode memakai eval/Function/with/import dinamis — renaming dilewati demi kompatibilitas." };
    return { code: transformTokens(tokenize(code), { rename: true, stripComments: false, preserveLines: true }), warning: "" };
  }

  function transform(mode, code, opts) {
    const input = String(code || "");
    if (!input.trim()) throw new Error("Source code kosong.");
    if (input.length > 2 * 1024 * 1024) throw new Error("Batas source 2 MB.");
    switch (mode) {
      case "basic":
        return { output: transformTokens(tokenize(input), { stripComments: true, splitStrings: true, hexNumbers: true, preserveLines: true }), warning: "" };
      case "rename": {
        const r = safeRename(input);
        return { output: r.code, warning: r.warning };
      }
      case "compact":
        return { output: minifyJS(input), warning: "" };
      case "readability": {
        const compacted = minifyJS(input);
        const r = safeRename(compacted);
        let output = transformTokens(tokenize(r.code), { stripComments: true, splitStrings: true, hexNumbers: true });
        if (r.warning) output = transformTokens(tokenize(compacted), { stripComments: true, splitStrings: true, hexNumbers: true });
        return { output, warning: r.warning };
      }
      case "custom": {
        const o = opts || {};
        const withComments = o.stripComments ? minifyJS(input) : input;
        let output = o.collapseWhitespace ? minifyJS(withComments) : transformTokens(tokenize(input), { stripComments: !!o.stripComments, preserveLines: true });
        if (o.rename) {
          const r = safeRename(output);
          output = r.code;
        }
        output = transformTokens(tokenize(output), {
          stripComments: !!o.stripComments,
          splitStrings: !!o.splitStrings,
          hexNumbers: !!o.hexNumbers,
          unicodeEscape: !!o.unicodeEscape,
          preserveLines: !o.collapseWhitespace
        });
        return { output, warning: "" };
      }
      default:
        throw new Error("Mode tidak dikenali.");
    }
  }

  /* ============== Enc Center: port dari plugin enc (xorEncrypt, rc4, shuffleIndices, vmEncrypt) ============== */
  const te = new TextEncoder();

  function randHex(nBytes) {
    const b = new Uint8Array(nBytes);
    crypto.getRandomValues(b);
    return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  }
  // Checksum ringan untuk mendeteksi payload yang diubah (anti-tamper dasar).
  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }
  function toBase64(bytes) {
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function xorEncrypt(text, key) {
    const buf = te.encode(text);
    const kb = te.encode(key);
    const out = new Uint8Array(buf.length);
    for (let i = 0; i < buf.length; i++) out[i] = buf[i] ^ kb[i % kb.length];
    return out;
  }
  function rc4(data, key) {
    const s = new Uint8Array(256);
    for (let i = 0; i < 256; i++) s[i] = i;
    const kb = te.encode(key);
    let j = 0;
    for (let i = 0; i < 256; i++) {
      j = (j + s[i] + kb[i % kb.length]) & 0xff;
      const t = s[i]; s[i] = s[j]; s[j] = t;
    }
    const out = new Uint8Array(data.length);
    let a = 0, b = 0;
    for (let k = 0; k < data.length; k++) {
      a = (a + 1) & 0xff;
      b = (b + s[a]) & 0xff;
      const t = s[a]; s[a] = s[b]; s[b] = t;
      out[k] = data[k] ^ s[(s[a] + s[b]) & 0xff];
    }
    return out;
  }
  // Fisher-Yates dengan RNG kriptografi (bukan LCG yang bisa diprediksi).
  function shuffleIndices(n) {
    const idx = [];
    for (let i = 0; i < n; i++) idx.push(i);
    const rnd = new Uint32Array(n);
    crypto.getRandomValues(rnd);
    for (let i = n - 1; i > 0; i--) {
      const j = rnd[i] % (i + 1);
      const tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp;
    }
    return idx;
  }
  function randomHexKey(bytes, parts) {
    const hex = randHex(bytes);
    const out = [];
    for (let i = 0; i < parts; i++) out.push(hex.substring(Math.floor(hex.length * i / parts), Math.floor(hex.length * (i + 1) / parts)));
    const order = shuffleIndices(parts);
    return { hex, shuffled: order.map((i) => out[i]), order };
  }

  function vmEncrypt(sourceCode, level) {
    const isHard = level === "hard" || level === "extreme";
    const isExtreme = level === "extreme";

    // Setiap proses memakai key & urutan acak baru dari crypto.getRandomValues.
    const key1 = randomHexKey(32, 4);
    const key2 = isHard ? randomHexKey(32, isExtreme ? 8 : 6) : null;

    let encBuf = xorEncrypt(sourceCode, key1.hex);
    if (isHard) encBuf = rc4(encBuf, key2.hex);
    const encB64 = toBase64(encBuf);

    const numChunks = isExtreme ? 8 : 4;
    const chunkSize = isExtreme ? 48 : (isHard ? 96 : 128);
    const chunks = [];
    for (let i = 0; i < encB64.length; i += chunkSize) chunks.push(encB64.substring(i, i + chunkSize));
    const chunkOrder = shuffleIndices(chunks.length);
    const shuffledChunks = chunkOrder.map((i) => chunks[i]);
    const checksum = fnv1a(encB64 + key1.hex + (key2 ? key2.hex : ""));

    const common = `
var _c=${JSON.stringify(shuffledChunks)};
var _co=${JSON.stringify(chunkOrder)};
var _p1=${JSON.stringify(key1.shuffled)};
var _po1=${JSON.stringify(key1.order)};
${isHard ? `var _p2=${JSON.stringify(key2.shuffled)};\nvar _po2=${JSON.stringify(key2.order)};` : ""}
var _h=${checksum};
function _b64(s){if(typeof atob==="function"){var b=atob(s),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u;}if(typeof Buffer!=="undefined")return new Uint8Array(Buffer.from(s,"base64"));throw new Error("Base64 tidak tersedia");}
function _utf(u){if(typeof TextDecoder!=="undefined")return new TextDecoder().decode(u);if(typeof Buffer!=="undefined")return Buffer.from(u).toString("utf8");var s="";for(var i=0;i<u.length;i++)s+=String.fromCharCode(u[i]);return decodeURIComponent(escape(s));}
function _te(k){if(typeof TextEncoder!=="undefined")return new TextEncoder().encode(k);var a=new Uint8Array(k.length);for(var i=0;i<k.length;i++)a[i]=k.charCodeAt(i);return a;}
function _ord(parts,order){var out=new Array(parts.length);for(var i=0;i<order.length;i++)out[order[i]]=parts[i];return out.join("");}
function _chk(s){var h=0x811c9dc5;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return h>>>0;}
function _xor(s,k){var b=_b64(s),kb=_te(k),r=new Uint8Array(b.length);for(var i=0;i<b.length;i++)r[i]=b[i]^kb[i%kb.length];return r;}
function _rc4(data,key){var s=new Uint8Array(256);for(var i=0;i<256;i++)s[i]=i;var kb=_te(key),j=0;for(var i=0;i<256;i++){j=(j+s[i]+kb[i%kb.length])&255;var t=s[i];s[i]=s[j];s[j]=t;}var out=new Uint8Array(data.length),a=0,b=0;for(var k=0;k<data.length;k++){a=(a+1)&255;b=(b+s[a])&255;var t2=s[a];s[a]=s[b];s[b]=t2;out[k]=data[k]^s[(s[a]+s[b])&255];}return out;}
`;

    const decrypt = isHard
      ? `var _fk1=_ord(_p1,_po1),_fk2=_ord(_p2,_po2),_pl64=_ord(_c,_co);\nif(_chk(_pl64+_fk1+_fk2)!==_h)throw new Error("Integritas payload gagal — file mungkin diubah.");\nvar _pl=_utf(_rc4(_xor(_pl64,_fk1),_fk2));`
      : `var _fk1=_ord(_p1,_po1),_pl64=_ord(_c,_co);\nif(_chk(_pl64+_fk1)!==_h)throw new Error("Integritas payload gagal — file mungkin diubah.");\nvar _pl=_utf(_xor(_pl64,_fk1));`;

    const exec = `
try{
  if(typeof require!=="undefined"||typeof module!=="undefined"){
    var _fn=new Function("require","module","exports","__dirname","__filename","global",_pl);
    var _m={exports:{}};
    _fn(typeof require!=="undefined"?require:null,_m,_m.exports,typeof __dirname!=="undefined"?__dirname:".",typeof __filename!=="undefined"?__filename:"main.js",typeof global!=="undefined"?global:{});
  }else{
    (0,eval)(_pl);
  }
}catch(e){if(typeof console!=="undefined")console.error("[VM]",e&&e.message||e);}
`;
    return `(function(){\n'use strict';\n${common}\n${decrypt}\n${exec}\n})();`;
  }

  /* AES-256-GCM + PBKDF2: sandi asli tidak bisa dibaca tanpa passphrase/key.
     GCM memberi authenticated encryption, jadi perubahan 1 bit pun gagal saat decrypt. */
  async function aesEncrypt(sourceCode, mode, input) {
    const wc = (typeof window !== "undefined" && window.crypto) || (typeof globalThis !== "undefined" && globalThis.crypto);
    if (!wc || !wc.subtle) throw new Error("Web Crypto tidak tersedia. Buka lewat HTTPS atau localhost.");
    const withPass = mode === "aes_pass";
    let secret;
    if (withPass) {
      secret = String((input && input.passphrase) || "");
      if (secret.length < 8) throw new Error("Passphrase minimal 8 karakter.");
    } else {
      secret = randHex(32);
    }

    const salt = wc.getRandomValues(new Uint8Array(16));
    const iv = wc.getRandomValues(new Uint8Array(12));
    const iterations = 310000;
    const baseKey = await wc.subtle.importKey("raw", te.encode(secret), "PBKDF2", false, ["deriveKey"]);
    const aesKey = await wc.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"]
    );
    const cipher = new Uint8Array(await wc.subtle.encrypt({ name: "AES-GCM", iv, tagLength: 128 }, aesKey, te.encode(sourceCode)));
    const saltB64 = toBase64(salt), ivB64 = toBase64(iv), ctB64 = toBase64(cipher);
    const checksum = fnv1a(saltB64 + ivB64 + ctB64 + iterations);

    let passRuntime;
    if (withPass) {
      passRuntime = 'typeof prompt==="function"?prompt("Passphrase untuk membuka payload ini:"):(typeof process!=="undefined"&&process.env&&process.env.NEXUS_PASSPHRASE)||""';
    } else {
      const pieces = [];
      const count = 6;
      for (let i = 0; i < count; i++) pieces.push(secret.substring(Math.floor(secret.length * i / count), Math.floor(secret.length * (i + 1) / count)));
      const order = shuffleIndices(count);
      passRuntime = `_ord(${JSON.stringify(order.map((i) => pieces[i]))},${JSON.stringify(order)})`;
    }

    return `(async function(){
'use strict';
var _s=${JSON.stringify(saltB64)},_iv=${JSON.stringify(ivB64)},_ct=${JSON.stringify(ctB64)},_it=${iterations},_h=${checksum};
function _b64(s){if(typeof atob==="function"){var b=atob(s),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u;}if(typeof Buffer!=="undefined")return new Uint8Array(Buffer.from(s,"base64"));throw new Error("Base64 tidak tersedia");}
function _utf(u){if(typeof TextDecoder!=="undefined")return new TextDecoder().decode(u);if(typeof Buffer!=="undefined")return Buffer.from(u).toString("utf8");var s="";for(var i=0;i<u.length;i++)s+=String.fromCharCode(u[i]);return decodeURIComponent(escape(s));}
function _ord(parts,order){var out=new Array(parts.length);for(var i=0;i<order.length;i++)out[order[i]]=parts[i];return out.join("");}
function _chk(s){var h=0x811c9dc5;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return h>>>0;}
var _pf=${passRuntime};
if(!_pf)throw new Error("Passphrase dibutuhkan.");
if(_chk(_s+_iv+_ct+_it)!==_h)throw new Error("Integritas payload gagal — file mungkin diubah.");
var _cr=globalThis.crypto||(typeof require!=="undefined"?require("crypto").webcrypto:null);
if(!_cr||!_cr.subtle)throw new Error("Web Crypto tidak tersedia di runtime ini.");
var _km=await _cr.subtle.importKey("raw",new TextEncoder().encode(_pf),"PBKDF2",false,["deriveKey"]);
var _key=await _cr.subtle.deriveKey({name:"PBKDF2",salt:_b64(_s),iterations:_it,hash:"SHA-256"},_km,{name:"AES-GCM",length:256},false,["decrypt"]);
var _src=_utf(new Uint8Array(await _cr.subtle.decrypt({name:"AES-GCM",iv:_b64(_iv),tagLength:128},_key,_b64(_ct))));
try{
  if(typeof require!=="undefined"||typeof module!=="undefined"){
    var _fn=new Function("require","module","exports","__dirname","__filename","global",_src);
    var _m={exports:{}};
    _fn(typeof require!=="undefined"?require:null,_m,_m.exports,typeof __dirname!=="undefined"?__dirname:".",typeof __filename!=="undefined"?__filename:"main.js",typeof global!=="undefined"?global:{});
  }else{
    (0,eval)(_src);
  }
}catch(e){if(typeof console!=="undefined")console.error("[AES]",e&&e.message||e);}
})().catch(function(e){if(typeof console!=="undefined")console.error("[AES]",e&&e.message||e);});`;
  }


  // Karakter/generator identifier dari plugin enc (JSCONFUSER CONFIGS).
  const MANDARIN_CHARS = Array.from("龙虎风云山河天地雷电火水木金土星月日光影峰泉林海雪霜雾冰焰石");
  const ARAB_CHARS = Array.from("أبتثجحخدذرزسشصضطظعغفقكلمنهوي");
  const JAPAN_CHARS = Array.from("あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん");
  const JAPAN_ARAB_CHARS = JAPAN_CHARS.concat(ARAB_CHARS);
  const ALNUM = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  function randIndex(max) {
    const r = new Uint32Array(1);
    crypto.getRandomValues(r);
    return r[0] % max;
  }
  const randLenBetween = (chars, min, max) => {
    const length = randIndex(max - min + 1) + min;
    let s = "";
    for (let i = 0; i < length; i++) s += chars[randIndex(chars.length)];
    return s;
  };

  // Pilihan enc, nama dan command disesuaikan dari plugin enc bot.
  const ENC_OPTIONS = [
    { id: "vm_normal", cmd: ".encnormal", name: "Enkripsi VM Normal", input: null,
      desc: "Payload di-XOR key 64-hex, dipecah & diacak dengan RNG kriptografi + checksum anti-tamper. Decoder pure JS.",
      run: (src) => ({ output: vmEncrypt(src, "normal") }), prefix: "enc-vm_normal-" },
    { id: "vm_hard", cmd: ".enchard", name: "Enkripsi VM Hard", input: null,
      desc: "XOR + RC4 dua key, 6 bagian, urutan acak kriptografi + checksum. Terenkripsi saat disimpan, decode saat runtime.",
      run: (src) => ({ output: vmEncrypt(src, "hard") }), prefix: "enc-vm_hard-" },
    { id: "vm_extreme", cmd: ".encextreme", name: "Enkripsi VM Extreme", input: null,
      desc: "XOR+RC4, 8 bagian key, chunk kecil, urutan acak kriptografi + checksum anti-tamper.",
      run: (src) => Promise.resolve({ output: vmEncrypt(src, "extreme") }), prefix: "enc-vm_extreme-" },
    { id: "aes_pass", cmd: ".encaes", name: "AES-GCM + Passphrase", input: "passphrase",
      desc: "AES-256-GCM + PBKDF2-SHA256 (310k putaran), salt & IV acak. Kode hanya terbuka dengan passphrase saat runtime — paling aman untuk rahasia.",
      run: async (src, input) => ({ output: await aesEncrypt(src, "aes_pass", input) }), prefix: "enc-aes_pass-" },
    { id: "aes_auto", cmd: ".encaesauto", name: "AES-GCM Auto-Run", input: null,
      desc: "AES-256-GCM + PBKDF2 dengan key acak tersemat terpecah. Langsung jalan tanpa prompt, tapi key tetap bisa diekstrak dari file.",
      run: async (src) => ({ output: await aesEncrypt(src, "aes_auto", {}) }), prefix: "enc-aes_auto-" },
    { id: "quantum", cmd: ".encquantum", name: "Obfuscate Quantum", input: null,
      desc: "Identifier 'qV_' + hex acak, string dipecah + Unicode escape, angka → hex. Mirip gaya Quantum bot.",
      gen: () => () => "qV_" + randHex(4), split: true, unicode: true, hex: true,
      prefix: "enc-quantum-" },
    { id: "mandarin", cmd: ".encmandarin / .enc3", name: "Obfuscate Mandarin", input: null,
      desc: "Identifier karakter Mandarin (3–6), string split + Unicode, angka hex. Gaya .enc3 bot.",
      gen: () => () => randLenBetween(MANDARIN_CHARS, 3, 6), split: true, unicode: true, hex: true,
      prefix: "enc-mandarin-" },
    { id: "arab", cmd: ".encarab / .enc4", name: "Obfuscate Arab", input: null,
      desc: "Identifier huruf Arab (3–6), string split + Unicode, angka hex. Gaya .enc4 bot.",
      gen: () => () => randLenBetween(ARAB_CHARS, 3, 6), split: true, unicode: true, hex: true,
      prefix: "enc-arab-" },
    { id: "japan", cmd: ".encjapan", name: "Obfuscate Japan", input: null,
      desc: "Identifier hiragana Jepang (3–6), string split + Unicode, angka hex. Gaya Japan bot.",
      gen: () => () => randLenBetween(JAPAN_CHARS, 3, 6), split: true, unicode: true, hex: true,
      prefix: "enc-japan-" },
    { id: "japanxarab", cmd: ".encjapanxarab", name: "Obfuscate Japan×Arab", input: null,
      desc: "Identifier campuran hiragana + Arab, string split + Unicode. Gaya JapanxArab bot.",
      gen: () => () => randLenBetween(JAPAN_ARAB_CHARS, 3, 6), split: true, unicode: true, hex: true,
      prefix: "enc-japanxarab-" },
    { id: "enc_custom", cmd: ".enccustom [NamaPrefix]", name: "Obfuscate Custom Prefix", input: "name",
      desc: "Identifier = NamaPrefix + '_' + 2–4 alnum. String split + Unicode + hex. Gaya .enc2 bot.",
      gen: (name) => () => name + "_" + randLenAlnum(), split: true, unicode: true, hex: true,
      prefix: (name) => `enc-custom-${name}-` }
  ];
  function randLenAlnum() {
    const suffixLen = randIndex(3) + 2;
    let s = "";
    for (let i = 0; i < suffixLen; i++) s += ALNUM[randIndex(ALNUM.length)];
    return s;
  }
  const ENC_IDS = new Set(ENC_OPTIONS.map((p) => p.id));

  function modeInfo(id) {
    return MODES.find((m) => m.id === id) || ENC_OPTIONS.find((p) => p.id === id) || MODES[0];
  }

  // Engine rename + string untuk pilihan JS (quantum, mandarin, arab, japan, custom, …).
  function encCore(code, cfg) {
    let warning = "";
    let renameMap = null;
    if (cfg.gen) {
      if (DANGEROUS.test(code)) warning = "Kode memakai eval/Function/with/import dinamis — penggantian nama dilewati demi kompatibilitas.";
      else renameMap = buildRenameMap(tokenize(code), cfg.gen);
    }
    const output = transformTokens(tokenize(code), {
      stripComments: true,
      preserveLines: true,
      rename: !!renameMap,
      renameMap,
      splitStrings: !!cfg.split,
      unicodeEscape: !!cfg.unicode,
      hexNumbers: !!cfg.hex
    });
    return { output, warning };
  }

  // Jalankan satu pilihan enc. input: { name } untuk Custom Prefix.
  async function encTransform(id, code, input, fileName) {
    const p = ENC_OPTIONS.find((x) => x.id === id);
    if (!p) throw new Error("Pilihan tidak dikenali.");
    const src = String(code || "");
    if (!src.trim()) throw new Error("Source code kosong.");
    if (src.length > 2 * 1024 * 1024) throw new Error("Batas source 2 MB.");
    const name = String((input && input.name) || "");
    if (p.input === "name" && !/^[a-zA-Z0-9_]+$/.test(name)) {
      throw new Error("Format Salah! Gunakan format: .enccustom NamaPrefix (huruf, angka, atau _).");
    }
    if (p.input === "passphrase" && String((input && input.passphrase) || "").length < 8) {
      throw new Error("Passphrase minimal 8 karakter. Gunanya untuk membuka payload di runtime.");
    }
    const base = String(fileName || "source.js").replace(/[/\\?%*:|"<>]/g, "_");
    const file = base.toLowerCase().endsWith(".js") ? base : base + ".js";
    const prefix = typeof p.prefix === "function" ? p.prefix(name) : p.prefix;
    const outName = prefix + file;

    if (p.run) {
      const res = await p.run(src, input);
      const warning = id === "aes_pass"
        ? "AES-256-GCM + PBKDF2 aktif. Payload hanya terbuka dengan passphrase yang Anda masukkan saat dijalankan. Simpan passphrase terpisah dari file."
        : id === "aes_auto"
          ? "AES-256-GCM aktif, tetapi key tersemat di file agar auto-run. Ini menghalangi pembacaan kasual, BUKAN perlindungan terhadap kriptografi yang ditentukan."
          : "Source dienkripsi (XOR" + (id === "vm_normal" ? "" : "+RC4") + ") + diacak memakai RNG kriptografi, dengan checksum anti-tamper. Source asli tidak tersimpan di output.";
      return { output: res.output, warning, filename: outName };
    }
    const cfg = { gen: p.gen(name), split: !!p.split, unicode: !!p.unicode, hex: !!p.hex };
    const core = encCore(src, cfg);
    return { output: core.output, warning: core.warning, filename: outName };
  }

  /* ============================== UI ============================== */
  function render(host) {
    let selected = "basic";
    let sourceName = "source.js";
    let encFileName = "";
    const timers = [];
    N.core.addCleanup(() => timers.forEach(clearTimeout));

    host.innerHTML = `
      <div class="workspace-head">
        <div><span class="eyebrow">Code Protection</span><h1 class="page-title">JavaScript <span class="gradient-text">Code Protector</span></h1>
        <p class="sub">Mode transformasi lokal + Enc Center (port dari plugin enc bot). VM = enkripsi payload sungguhan. Semua jalan di browser, source asli tidak pernah diupload.</p></div>
        <button class="btn btn-sm btn-ghost" data-act="fav" type="button">${ico("starOff")}<span>Simpan tool</span></button>
      </div>

      <div class="notice"><span>${ico("shield")}</span><span><strong>Mode 01–05</strong> hanya menyulitkan pembacaan. <strong>VM Normal/Hard/Extreme</strong> memakai XOR+RC4 dengan RNG kriptografi & checksum; <strong>AES-GCM + Passphrase</strong> adalah satu-satunya mode yang kuncinya TIDAK ikut di file. Tidak ada proteksi client-side yang 100% anti-crack — jangan pernah menyimpan token/rahasia produksi di JavaScript.</span></div>

      <div class="section">
        <div class="section-head"><div><span class="eyebrow">Langkah 01</span><h2 class="section-title">Pilih mode processing</h2></div><span class="badge pro">5 mode tersedia</span></div>
        <div class="mode-grid" id="modeGrid">${MODES.map((m) => `<button type="button" class="mode-card ${m.id === selected ? "active" : ""}" data-mode="${m.id}">
          <span class="mode-num">MODE ${m.num}</span><strong>${esc(m.name)}</strong><p>${esc(m.desc)}</p></button>`).join("")}</div>
      </div>

      <div class="section">
        <div class="section-head"><div><span class="eyebrow">Enc Center</span><h2 class="section-title">Pilihan seperti plugin enc bot</h2></div><span class="badge pro">${ENC_OPTIONS.length} pilihan</span></div>
        <div class="mode-grid" id="encGrid">${ENC_OPTIONS.map((b) => `<button type="button" class="mode-card ${b.id === selected ? "active" : ""}" data-mode="${b.id}">
          <span class="mode-num">${esc(b.cmd)}</span><strong>${esc(b.name)}</strong><p>${esc(b.desc)}</p></button>`).join("")}</div>
      </div>

      <div class="section grid grid-2">
        <div class="card card-pad">
          <div class="spread"><div><span class="eyebrow">Langkah 02</span><h3 class="card-title mt-8">Input source</h3></div>
            <button class="btn btn-sm" data-act="toggle-code" id="toggleCode" type="button">${ico("eyeOff")}<span>Sembunyikan</span></button></div>
          <p class="hint mt-8">Maksimal 2 MB per file. Hanya file <span class="mono">.js</span> yang diterima.</p>
          <input type="file" id="protectFile" accept=".js,text/javascript,application/javascript" class="hidden">
          <div class="dropzone mt-16" id="dropzone" tabindex="0" role="button" aria-label="Pilih atau tarik file JavaScript">
            <div class="dz-icon">${ico("upload")}</div><div><strong>Tarik file .js ke sini atau klik untuk pilih</strong><small>Alternatif: tempel kode di textarea di bawah</small></div>
          </div>
          <div class="file-chip mt-16" id="fileChip"><span class="fi">JS</span><span id="fileChipText">Belum ada file — menunggu paste atau upload</span></div>
          <label class="field mt-16"><span>Nama file output</span><input type="text" id="outName" placeholder="source.protected.js" autocomplete="off"></label>
          <div class="spread mt-16"><span class="hint" id="sizeInfo">0 B · 0 baris</span><div class="row"><button class="btn btn-sm" data-act="paste-demo" type="button">Contoh</button><button class="btn btn-sm btn-ghost" data-act="clear-input" type="button">Clear input</button></div></div>
          <textarea id="sourceInput" class="mt-16" rows="12" spellcheck="false" placeholder="// Tempel kode JavaScript di sini..."></textarea>
          <pre id="maskedSource" class="output-preview hidden" style="min-height:250px"></pre>
        </div>

        <div class="card card-pad">
          <div class="spread"><div><span class="eyebrow">Langkah 03</span><h3 class="card-title mt-8">Proses & hasil</h3></div><span class="badge" id="modeBadge">Basic Protection</span></div>
          <div class="notice info mt-16" id="modeDescription">${esc(MODES[0].desc)}</div>
          <div class="opts mt-16 hidden" id="customOpts">
            <label class="check"><input type="checkbox" data-opt="stripComments" checked> Hapus komentar</label>
            <label class="check"><input type="checkbox" data-opt="collapseWhitespace" checked> Kompres whitespace</label>
            <label class="check"><input type="checkbox" data-opt="rename"> Rename identifier aman</label>
            <label class="check"><input type="checkbox" data-opt="splitStrings" checked> Pecah string literal</label>
            <label class="check"><input type="checkbox" data-opt="hexNumbers"> Bilangan ke hex</label>
            <label class="check"><input type="checkbox" data-opt="unicodeEscape"> Escape Unicode string</label>
            <label class="field"><span>Intensitas transformasi</span><input type="range" class="range" id="intensity" min="1" max="3" value="2"></label>
            <div class="field"><span>Risiko kompatibilitas</span><div class="risk-meter" id="riskMeter"><i class="on"></i><i></i><i></i></div><small class="hint" id="riskText">Risiko rendah</small></div>
          </div>
          <div class="opts mt-16 hidden" id="encOpts">
            <label class="field hidden" id="encNameField"><span>NamaPrefix (huruf, angka, _)</span><input type="text" id="encName" placeholder="contoh: MySecret" maxlength="40" autocomplete="off"></label>
            <label class="field hidden" id="encPassField"><span>Passphrase (minimal 8 karakter)</span><input type="password" id="encPass" autocomplete="new-password" spellcheck="false" placeholder="Disimpan hanya di sesi ini"><small class="hint">Passphrase tidak ikut tertanam di file. Simpan terpisah — tanpa itu payload tidak bisa dibuka.</small></label>
          </div>
          <div class="mt-16"><div class="spread tiny muted"><span>Progress</span><span id="progressText">Menunggu input</span></div>
            <div class="progress-line mt-8"><span id="progressBar"></span></div></div>
          <div class="row mt-16"><button class="btn btn-primary" data-act="process" id="processBtn" type="button">${ico("sparkle")}<span>Proses Code</span></button>
            <button class="btn btn-sm" data-act="copy-output" type="button">Salin</button>
            <button class="btn btn-sm" data-act="download" type="button">Unduh</button>
            <button class="btn btn-sm btn-ghost" data-act="reset" type="button">Reset</button></div>
          <div class="status-line mt-8" id="protectStatus"></div>
          <div class="preview-split mt-16">
            <div class="preview-box"><header><span>Source</span><span id="sourceLines">0 baris</span></header><pre id="previewSource">Belum ada source.</pre></div>
            <div class="preview-box"><header><span>Output</span><span id="outputBytes">0 B</span></header><pre id="previewOutput">Belum ada output.</pre></div>
          </div>
          <div class="notice err mt-16 hidden" id="protectError"></div>
          <div class="divider"></div>
          <div class="game-help"><strong>Catatan kompatibilitas:</strong> renaming dilewati bila kode memakai <span class="mono">eval</span>, <span class="mono">Function</span>, <span class="mono">with</span>, atau <span class="mono">import()</span> dinamis. Decoder VM/AES memakai Web Crypto bila tersedia (browser modern & Node 18+) dengan fallback ke <span class="mono">Buffer</span> untuk base64 di Node. Mode AES-GCM + Passphrase menanyakan passphrase saat file dijalankan (di Node: <span class="mono">NEXUS_PASSPHRASE</span> environment variable).</div>
        </div>
      </div>`;

    const $ = (s) => host.querySelector(s);
    const source = $("#sourceInput");
    const output = $("#previewOutput");
    const status = $("#protectStatus");
    const errorBox = $("#protectError");
    let result = "";
    let showCode = true;

    function setError(msg) {
      if (!msg) { errorBox.classList.add("hidden"); errorBox.textContent = ""; return; }
      errorBox.classList.remove("hidden");
      errorBox.innerHTML = `<span>!</span><span>${esc(msg)}</span>`;
    }
    function setStatus(msg, bad) {
      status.textContent = msg;
      status.className = "status-line" + (bad ? " bad" : " ok");
    }
    function setProgress(pct, label) {
      $("#progressBar").style.width = pct + "%";
      $("#progressText").textContent = label;
    }
    function updateSourceInfo() {
      const bytes = new Blob([source.value]).size;
      const lines = source.value ? source.value.split(/\r?\n/).length : 0;
      $("#sizeInfo").textContent = `${N.core.formatBytes(bytes)} · ${lines} baris`;
      $("#sourceLines").textContent = lines + " baris";
      $("#previewSource").textContent = source.value ? source.value.slice(0, 2400) + (source.value.length > 2400 ? "\n… dipotong untuk preview" : "") : "Belum ada source.";
      if (!showCode) $("#maskedSource").textContent = "•".repeat(Math.min(400, source.value.length)) + (source.value.length > 400 ? " …" : "");
      if (bytes > 2 * 1024 * 1024) setError("Source melebihi batas 2 MB.");
      else setError("");
    }
    function setMode(id) {
      selected = id;
      const info = modeInfo(id);
      const enc = ENC_OPTIONS.find((p) => p.id === id);
      host.querySelectorAll(".mode-card").forEach((b) => b.classList.toggle("active", b.dataset.mode === id));
      $("#modeBadge").textContent = info.name;
      $("#modeDescription").textContent = info.desc;
      $("#customOpts").classList.toggle("hidden", id !== "custom");
      $("#encOpts").classList.toggle("hidden", !enc || !enc.input);
      $("#encNameField").classList.toggle("hidden", !enc || enc.input !== "name");
      $("#encPassField").classList.toggle("hidden", !enc || enc.input !== "passphrase");
      result = "";
      encFileName = "";
      output.textContent = "Belum ada output.";
      $("#outputBytes").textContent = "0 B";
    }
    function opts() {
      const o = {};
      host.querySelectorAll("[data-opt]").forEach((el) => { o[el.dataset.opt] = el.checked; });
      const level = Number($("#intensity").value);
      if (level === 1) { o.splitStrings = false; o.unicodeEscape = false; o.rename = false; }
      if (level === 3) { o.splitStrings = true; o.rename = o.rename || false; o.hexNumbers = true; }
      return o;
    }
    function updateRisk() {
      const o = opts();
      const n = Object.values(o).filter((v) => v === true).length;
      const dots = host.querySelectorAll("#riskMeter i");
      dots.forEach((d, i) => d.classList.toggle("on", i < Math.max(1, Math.min(3, Math.ceil(n / 2)))));
      $("#riskText").textContent = n <= 2 ? "Risiko rendah" : n <= 4 ? "Risiko sedang — uji hasil" : "Risiko tinggi — periksa kompatibilitas";
    }

    async function process() {
      setError("");
      if (!source.value.trim()) {
        setStatus("Masukkan kode atau upload file terlebih dahulu.", true);
        source.focus();
        setProgress(0, "Input kosong");
        return;
      }
      const btn = $("#processBtn");
      btn.disabled = true;
      setProgress(15, "Membaca source...");
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      try {
        setProgress(45, "Menerapkan " + modeInfo(selected).name + "...");
        await new Promise((r) => { const t = setTimeout(r, 120); timers.push(t); });
        let res;
        if (ENC_IDS.has(selected)) {
          res = await encTransform(selected, source.value, { name: $("#encName").value, passphrase: $("#encPass").value }, sourceName);
          encFileName = res.filename;
        } else {
          res = transform(selected, source.value, opts());
          encFileName = "";
        }
        result = res.output;
        setProgress(100, "Selesai");
        output.textContent = result.slice(0, 2400) + (result.length > 2400 ? "\n… dipotong untuk preview" : "");
        $("#outputBytes").textContent = N.core.formatBytes(new Blob([result]).size);
        setStatus("Berhasil · " + N.core.formatBytes(new Blob([result]).size), false);
        if (res.warning) setError(res.warning);
        N.core.trackTool("js-protector", "protect");
        N.core.toast("Transformasi selesai.", "ok");
      } catch (err) {
        setProgress(0, "Gagal");
        setStatus("Proses gagal.", true);
        setError(err && err.message ? err.message : "Error tidak diketahui.");
      } finally {
        btn.disabled = false;
      }
    }

    function cleanName(raw) {
      const base = String(raw || sourceName || "source").replace(/[/\\?%*:|"<>]/g, "_").trim() || "source";
      return base.toLowerCase().endsWith(".js") ? base : base + ".js";
    }
    function outputName() {
      const raw = $("#outName").value.trim();
      if (raw) return cleanName(raw);
      if (encFileName) return cleanName(encFileName);
      const base = cleanName(sourceName).replace(/\.js$/i, "");
      return base + ".protected.js";
    }

    function loadText(text, name) {
      if (new Blob([text]).size > 2 * 1024 * 1024) { setError("File terlalu besar (maks 2 MB)."); return; }
      source.value = text;
      sourceName = name || "source.js";
      $("#fileChipText").textContent = `${sourceName} · siap diproses`;
      result = "";
      encFileName = "";
      output.textContent = "Belum ada output.";
      updateSourceInfo();
      setProgress(0, "Source dimuat");
      setStatus("Source siap diproses.", false);
    }

    host.addEventListener("click", async (e) => {
      const modeBtn = e.target.closest("[data-mode]");
      if (modeBtn) { setMode(modeBtn.dataset.mode); return; }
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === "process") process();
      if (act === "fav") {
        const on = N.core.toggleFavorite("js-protector");
        btn.innerHTML = ico(on ? "star" : "starOff") + "<span>" + (on ? "Tersimpan tool" : "Simpan tool") + "</span>";
        N.core.toast(on ? "Tool disimpan." : "Dihapus dari favorites.", "ok");
      }
      if (act === "toggle-code") {
        showCode = !showCode;
        source.classList.toggle("hidden", !showCode);
        $("#maskedSource").classList.toggle("hidden", showCode);
        btn.innerHTML = ico(showCode ? "eyeOff" : "eye") + "<span>" + (showCode ? "Sembunyikan" : "Tampilkan") + "</span>";
        updateSourceInfo();
      }
      if (act === "clear-input") {
        source.value = "";
        result = "";
        encFileName = "";
        output.textContent = "Belum ada output.";
        $("#fileChipText").textContent = "Belum ada file — menunggu paste atau upload";
        $("#outName").value = "";
        if (fileInput) fileInput.value = "";
        updateSourceInfo();
        setProgress(0, "Menunggu input");
        setStatus("Input dibersihkan.");
        N.core.toast("Input dibersihkan.", "info");
      }
      if (act === "paste-demo") {
        loadText(`// contoh modul lokal\nconst API_HOST = "https://example.test";\nlet total = 0;\nfunction add(a, b) {\n  const next = a + b;\n  total = next;\n  return total;\n}\nconsole.log(add(2, 3));`, "contoh.js");
        N.core.toast("Contoh dimuat.", "info");
      }
      if (act === "copy-output") {
        if (!result) { N.core.toast("Belum ada hasil.", "err"); return; }
        if (await N.core.copy(result)) N.core.toast("Hasil disalin.", "ok");
      }
      if (act === "download") {
        if (!result) { N.core.toast("Proses dulu sebelum mengunduh.", "err"); return; }
        N.core.download(outputName(), result, "application/javascript;charset=utf-8");
        N.core.toast("Diunduh: " + outputName(), "ok");
      }
      if (act === "reset") {
        source.value = ""; result = ""; sourceName = "source.js"; encFileName = "";
        if (fileInput) fileInput.value = "";
        $("#outName").value = "";
        output.textContent = "Belum ada output.";
        $("#outputBytes").textContent = "0 B";
        $("#fileChipText").textContent = "Belum ada file — menunggu paste atau upload";
        updateSourceInfo(); setMode("basic"); setProgress(0, "Menunggu input"); setStatus("Form direset.");
        setError("");
      }
    });

    const fileInput = $("#protectFile");
    const dropzone = $("#dropzone");
    dropzone.addEventListener("click", () => fileInput.click());
    dropzone.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); } });
    ["dragenter", "dragover"].forEach((evt) => dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add("dragover"); }));
    ["dragleave", "drop"].forEach((evt) => dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove("dragover"); }));
    dropzone.addEventListener("drop", (e) => {
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) handleFile(file);
    });
    fileInput.addEventListener("change", (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); });
    async function handleFile(file) {
      if (!/\.js$/i.test(file.name || "")) { setError("Hanya file dengan ekstensi .js yang didukung."); setStatus("File ditolak.", true); return; }
      if (file.type && !["text/javascript", "application/javascript", "application/x-javascript", "text/plain", ""].includes(file.type)) {
        setError("Tipe file tidak dikenali sebagai JavaScript teks."); setStatus("File ditolak.", true); return;
      }
      if (file.size > 2 * 1024 * 1024) { setError("File melebihi batas 2 MB."); return; }
      try {
        const text = await file.text();
        if (text.includes("\u0000")) throw new Error("File mengandung binary, bukan source teks.");
        loadText(text, file.name);
        fileInput.value = "";
        N.core.toast("File dimuat: " + file.name, "ok");
      } catch (err) { setError("Gagal membaca file: " + err.message); setStatus("File ditolak.", true); }
    }

    source.addEventListener("input", updateSourceInfo);
    host.addEventListener("change", (e) => { if (e.target.matches("[data-opt], #intensity")) updateRisk(); });
    setMode("basic");
    updateSourceInfo();
    updateRisk();
  }

  N.protection = { MODES, ENC_OPTIONS, transform, encTransform, render };
})(window.Nexus = window.Nexus || {});
