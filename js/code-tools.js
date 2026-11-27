/* NEXUS TOOLBOX — developer tools (all logic runs locally) */
(function (N) {
  "use strict";

  const ico = (name, cls) => (N.icons ? N.icons.svg(name, cls) : "");
  const { escapeHtml: esc } = N.core;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ============================== JS tokenizer ============================== */
  const KEYWORDS_NEED_SPACE = new Set([
    "return", "throw", "case", "delete", "typeof", "void", "in", "of", "instanceof",
    "new", "yield", "await", "else", "do", "var", "let", "const", "function",
    "class", "extends", "import", "export", "from", "as", "default", "try",
    "catch", "finally", "switch", "if", "for", "while", "with", "debugger", "async"
  ]);
  const OPERATORS = [
    ">>>=", "===", "!==", "**=", "<<=", ">>=", ">>>", "..."
    , "=>", "==", "!=", "<=", ">=", "&&", "||", "??", "?.", "++", "--",
    "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "<<", ">>", "**"
  ].sort((a, b) => b.length - a.length);

  function tokenizeJS(src) {
    const tokens = [];
    const s = String(src || "");
    let i = 0;
    let prevMeaningful = null;

    function push(type, value) {
      const tok = { type, value };
      tokens.push(tok);
      if (type !== "ws" && type !== "comment") prevMeaningful = tok;
    }

    while (i < s.length) {
      const c = s[i];
      const next = s[i + 1];

      if (/\s/.test(c)) {
        let j = i + 1;
        while (j < s.length && /\s/.test(s[j])) j++;
        tokens.push({ type: "ws", value: s.slice(i, j) });
        i = j;
        continue;
      }
      if (c === "/" && next === "/") {
        let j = i + 2;
        while (j < s.length && s[j] !== "\n") j++;
        push("comment", s.slice(i, j));
        i = j;
        continue;
      }
      if (c === "/" && next === "*") {
        const j = s.indexOf("*/", i + 2);
        const end = j < 0 ? s.length : j + 2;
        push("comment", s.slice(i, end));
        i = end;
        continue;
      }
      if (c === '"' || c === "'") {
        let j = i + 1;
        while (j < s.length) {
          if (s[j] === "\\") { j += 2; continue; }
          if (s[j] === c) { j++; break; }
          j++;
        }
        push("string", s.slice(i, j));
        i = j;
        continue;
      }
      if (c === "`") {
        let j = i + 1;
        let depth = 0;
        while (j < s.length) {
          if (s[j] === "\\") { j += 2; continue; }
          if (s[j] === "$" && s[j + 1] === "{") { depth++; j += 2; continue; }
          if (s[j] === "}" && depth > 0) { depth--; j++; continue; }
          if (s[j] === "`" && depth === 0) { j++; break; }
          j++;
        }
        push("template", s.slice(i, j));
        i = j;
        continue;
      }
      if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(next || ""))) {
        let j = i + 1;
        while (j < s.length && /[0-9a-fA-FxXoObBeE._nN+-]/.test(s[j])) {
          if ((s[j] === "+" || s[j] === "-") && !/[eE]/.test(s[j - 1])) break;
          j++;
        }
        push("number", s.slice(i, j));
        i = j;
        continue;
      }
      if (/[A-Za-z_$]/.test(c)) {
        let j = i + 1;
        while (j < s.length && /[A-Za-z0-9_$]/.test(s[j])) j++;
        push("ident", s.slice(i, j));
        i = j;
        continue;
      }
      if (c === "/") {
        const canBeRegex = !prevMeaningful || (prevMeaningful.type === "punct" && "([{,:!&|?;=>+-*/%^~<>".includes(prevMeaningful.value)) || (prevMeaningful.type === "ident" && KEYWORDS_NEED_SPACE.has(prevMeaningful.value));
        if (canBeRegex) {
          let j = i + 1;
          let inClass = false;
          let closed = false;
          while (j < s.length) {
            const ch = s[j];
            if (ch === "\\") { j += 2; continue; }
            if (ch === "\n") break;
            if (ch === "[") inClass = true;
            if (ch === "]") inClass = false;
            if (ch === "/" && !inClass) { j++; closed = true; break; }
            j++;
          }
          if (closed) {
            while (j < s.length && /[a-z]/i.test(s[j])) j++;
            push("regex", s.slice(i, j));
            i = j;
            continue;
          }
        }
      }
      const op = OPERATORS.find((o) => s.startsWith(o, i));
      if (op) { push("punct", op); i += op.length; continue; }
      push("punct", c);
      i++;
    }
    return tokens;
  }

  const WORD_TYPES = new Set(["ident", "number", "string", "template", "regex"]);

  function minifyJS(src, opts) {
    const options = opts || {};
    const tokens = tokenizeJS(src).filter((t) => t.type !== "ws" && (options.keepComments || t.type !== "comment"));
    let out = "";
    let prev = null;
    const NO_SPACE_AFTER = new Set(["(", "[", "{", ".", "?.", "..."]);
    const NO_SPACE_BEFORE = new Set([")", "]", "}", ";", ",", ".", "?."]);
    tokens.forEach((tok) => {
      if (prev) {
        let needSpace = false;
        if (WORD_TYPES.has(prev.type) && WORD_TYPES.has(tok.type)) needSpace = true;
        if (prev.type === "ident" && KEYWORDS_NEED_SPACE.has(prev.value) && tok.type !== "punct") needSpace = true;
        if (prev.type === "ident" && KEYWORDS_NEED_SPACE.has(prev.value) && /^[({[]$/.test(tok.value)) needSpace = true;
        if (prev.type === "punct" && prev.value === "}" && tok.type === "ident") needSpace = true;
        if (prev.type === "punct" && tok.type === "punct") {
          needSpace = !(NO_SPACE_AFTER.has(prev.value) || NO_SPACE_BEFORE.has(tok.value));
        }
        if (tok.type === "regex" && prev.type === "punct" && !NO_SPACE_AFTER.has(prev.value)) needSpace = true;
        if (prev.value === "?" && /^\./.test(tok.value)) needSpace = true;
        if (needSpace) out += " ";
      }
      out += tok.value;
      prev = tok;
    });
    return out.trim();
  }

  function formatJS(src) {
    const tokens = tokenizeJS(src).filter((t) => t.type !== "ws");
    let out = "", indent = 0, line = "";
    const pad = () => "  ".repeat(Math.max(0, indent));
    const OPERATORS = new Set(["=", "==", "===", "!=", "!==", "+", "-", "*", "/", "%", "&&", "||", "??", "<", ">", "<=", ">=", "+=", "-=", "*=", "/=", "%=", "=>", "?", ":"]);
    const NO_SPACE_AFTER = new Set(["(", "[", ".", "?.", "{"]);
    const NO_SPACE_BEFORE = new Set([")", "]", ";", ",", ".", "?."]);

    function flush() { if (line.trim()) out += pad() + line.trim() + "\n"; line = ""; }

    tokens.forEach((tok, idx) => {
      const prev = tokens[idx - 1];
      const next = tokens[idx + 1];
      if (tok.type === "comment") {
        flush();
        out += pad() + tok.value.replace(/\s+$/, "") + "\n";
        return;
      }
      if (tok.value === "}" || tok.value === ")" || tok.value === "]") {
        if (tok.value === "}") {
          indent = Math.max(0, indent - 1);
          line += tok.value;
          if (!next || ![",", ";", ")", "]", "}"].includes(next.value)) flush();
        } else {
          line += tok.value;
        }
        return;
      }
      if (tok.value === "{") {
        line += (line.trim() ? " " : "") + "{";
        flush();
        indent++;
        return;
      }
      if (tok.value === ";") { line += ";"; flush(); return; }
      if (tok.value === ",") { line += ", "; if (line.length > 96) flush(); return; }
      if (tok.type === "ident" && ["case", "else", "do"].includes(tok.value)) {
        if (line.trim()) line += " " + tok.value; else line = tok.value;
        flush();
        return;
      }
      let before = "";
      if (line.trim() && prev) {
        if (WORD_TYPES.has(prev.type) && WORD_TYPES.has(tok.type)) before = " ";
        else if (prev.type === "ident" && KEYWORDS_NEED_SPACE.has(prev.value)) before = " ";
        else if (prev.type === "punct" && OPERATORS.has(prev.value)) before = " ";
        else if (tok.type === "punct" && OPERATORS.has(tok.value)) before = " ";
        else if (prev.type === "punct" && prev.value === "}" && tok.type === "ident") before = " ";
        if (NO_SPACE_AFTER.has(prev.value) || NO_SPACE_BEFORE.has(tok.value)) before = "";
      }
      line += before + tok.value;
    });
    flush();
    return out.trim() + "\n";
  }

  /* ============================== helpers ============================== */
  function bytesToBinary(bytes) {
    const chunk = 0x8000;
    let bin = "";
    for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    return bin;
  }
  function binaryToBytes(bin) {
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function toBase64(text) {
    return btoa(bytesToBinary(new TextEncoder().encode(String(text))));
  }
  function fromBase64(text) {
    const clean = String(text).replace(/\s+/g, "");
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(clean)) throw new Error("Input bukan Base64 yang valid.");
    return new TextDecoder("utf-8", { fatal: true }).decode(binaryToBytes(atob(clean)));
  }
  function jsonError(err, text) {
    const m = /position (\d+)/.exec(err.message);
    if (!m) return err.message;
    const pos = Number(m[1]);
    const before = text.slice(0, pos);
    const line = before.split("\n").length;
    const col = pos - before.lastIndexOf("\n");
    return `${err.message} (baris ${line}, kolom ${col})`;
  }
  function parseColor(value) {
    let v = String(value || "").trim().toLowerCase();
    let r, g, b;
    if (/^#?[0-9a-f]{3}$/.test(v)) {
      v = v.replace("#", "");
      r = parseInt(v[0] + v[0], 16); g = parseInt(v[1] + v[1], 16); b = parseInt(v[2] + v[2], 16);
    } else if (/^#?[0-9a-f]{6}$/.test(v)) {
      v = v.replace("#", "");
      r = parseInt(v.slice(0, 2), 16); g = parseInt(v.slice(2, 4), 16); b = parseInt(v.slice(4, 6), 16);
    } else {
      const rgb = /^rgba?\(\s*([\d.]+)%?\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?/.exec(v);
      if (rgb) {
        const conv = (x) => v.includes("%") ? Math.round(Number(x) * 2.55) : Math.round(Number(x));
        r = conv(rgb[1]); g = conv(rgb[2]); b = conv(rgb[3]);
      } else {
        const hsl = /^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/.exec(v);
        if (!hsl) throw new Error("Format warna tidak dikenali. Gunakan #hex, rgb(...), atau hsl(...).");
        const c = hslToRgb(Number(hsl[1]), Number(hsl[2]), Number(hsl[3]));
        r = c.r; g = c.g; b = c.b;
      }
    }
    if ([r, g, b].some((x) => !Number.isFinite(x) || x < 0 || x > 255)) throw new Error("Nilai warna di luar rentang.");
    return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (d) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
  }
  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
  }
  const hex2 = (n) => n.toString(16).padStart(2, "0");

  function htmlEntitiesEncode(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/\u00a0/g, "&nbsp;");
  }
  function htmlEntitiesDecode(text) {
    return String(text)
      .replace(/&nbsp;/g, "\u00a0").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, d) => safeCodePoint(parseInt(d, 10)));
  }
  function safeCodePoint(n) { try { return String.fromCodePoint(n); } catch (e) { return ""; } }

  function lineDiff(a, b) {
    const A = String(a).split(/\r?\n/), B = String(b).split(/\r?\n/);
    if (A.length * B.length > 250000) return [{ type: "hunk", text: "Teks terlalu besar untuk diff presisi; gunakan potongan lebih kecil." }];
    const dp = Array.from({ length: A.length + 1 }, () => new Uint16Array(B.length + 1));
    for (let i = A.length - 1; i >= 0; i--) {
      for (let j = B.length - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
    const out = [];
    let i = 0, j = 0;
    while (i < A.length && j < B.length) {
      if (A[i] === B[j]) { out.push({ type: "same", text: A[i] }); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ type: "del", text: A[i++] }); }
      else { out.push({ type: "add", text: B[j++] }); }
    }
    while (i < A.length) out.push({ type: "del", text: A[i++] });
    while (j < B.length) out.push({ type: "add", text: B[j++] });
    return out;
  }

  function markdownToHtml(src) {
    const blocks = [];
    const text = String(src || "").replace(/```([\w-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
      blocks.push(`<pre><code class="lang-${esc(lang || "text")}">${esc(code)}</code></pre>`);
      return `\u0000BLOCK${blocks.length - 1}\u0000`;
    });
    const lines = text.split(/\r?\n/);
    let html = "", inList = false, inQuote = false;
    const inline = (s) => esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
      .replace(/~~([^~]+)~~/g, "<del>$1</del>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    lines.forEach((line) => {
      const fence = /^\u0000BLOCK(\d+)\u0000$/.exec(line);
      if (fence) { if (inList) { html += "</ul>"; inList = false; } html += blocks[Number(fence[1])]; return; }
      if (/^\s*$/.test(line)) { if (inList) { html += "</ul>"; inList = false; } if (inQuote) { html += "</blockquote>"; inQuote = false; } return; }
      const h = /^(#{1,6})\s+(.*)$/.exec(line);
      if (h) { if (inList) { html += "</ul>"; inList = false; } html += `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`; return; }
      if (/^\s*([-*_])\1{2,}\s*$/.test(line)) { html += "<hr>"; return; }
      const q = /^>\s?(.*)$/.exec(line);
      if (q) { if (!inQuote) { html += "<blockquote>"; inQuote = true; } html += `<p>${inline(q[1])}</p>`; return; }
      if (inQuote) { html += "</blockquote>"; inQuote = false; }
      const li = /^\s*[-*+]\s+(.*)$/.exec(line);
      if (li) { if (!inList) { html += "<ul>"; inList = true; } html += `<li>${inline(li[1])}</li>`; return; }
      if (inList) { html += "</ul>"; inList = false; }
      html += `<p>${inline(line)}</p>`;
    });
    if (inList) html += "</ul>";
    if (inQuote) html += "</blockquote>";
    return `<div class="md-render" style="line-height:1.75">${html}</div>`;
  }

  function formatCSS(src) {
    const s = String(src || "");
    let out = "", indent = 0, buf = "", i = 0, inString = null;
    const pad = () => "  ".repeat(Math.max(0, indent));
    while (i < s.length) {
      const c = s[i];
      if (inString) { buf += c; if (c === "\\") { buf += s[i + 1] || ""; i += 2; continue; } if (c === inString) inString = null; i++; continue; }
      if (c === '"' || c === "'") { inString = c; buf += c; i++; continue; }
      if (c === "/" && s[i + 1] === "*") {
        const end = s.indexOf("*/", i + 2);
        if (buf.trim()) { out += pad() + buf.trim() + "\n"; buf = ""; }
        out += pad() + s.slice(i, end < 0 ? s.length : end + 2) + "\n";
        i = end < 0 ? s.length : end + 2;
        continue;
      }
      if (c === "{") {
        if (buf.trim()) out += pad() + buf.trim().replace(/\s*,\s*/g, ", ") + " {\n";
        buf = ""; indent++;
        i++; continue;
      }
      if (c === "}") {
        if (buf.trim()) { out += pad() + "  " + buf.trim() + ";\n"; buf = ""; }
        indent = Math.max(0, indent - 1);
        out += pad() + "}\n";
        i++; continue;
      }
      if (c === ";") {
        if (buf.trim()) out += pad() + "  " + buf.trim() + ";\n";
        buf = ""; i++; continue;
      }
      buf += c; i++;
    }
    if (buf.trim()) out += pad() + buf.trim() + "\n";
    return out.trim();
  }

  const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  function formatHTML(src) {
    const tokens = String(src || "").match(/<!--[\s\S]*?-->|<![^>]*>|<\/?[A-Za-z][^>]*>|[^<]+/g) || [];
    let out = "", indent = 0;
    const pad = () => "  ".repeat(Math.max(0, indent));
    tokens.forEach((raw) => {
      const t = raw.trim();
      if (!t) return;
      if (t.startsWith("<!--") || t.startsWith("<!")) { out += pad() + t + "\n"; return; }
      if (/^<\//.test(t)) { indent = Math.max(0, indent - 1); out += pad() + t + "\n"; return; }
      if (/^<[^!/?]/.test(t)) {
        const name = (/^<([A-Za-z][\w-]*)/.exec(t) || [])[1] || "";
        out += pad() + t + "\n";
        if (!VOID_TAGS.has(name.toLowerCase()) && !/\/\s*>$/.test(t)) indent++;
        return;
      }
      out += pad() + t.replace(/\s+/g, " ").trim() + "\n";
    });
    return out.trim();
  }

  /* ============================== SHA-256 fallback ============================== */
  const SHA_K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);
  function sha256Bytes(bytes) {
    const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const len = bytes.length;
    const padded = new Uint8Array((Math.floor((len + 9) / 64) + 1) * 64);
    padded.set(bytes);
    padded[len] = 0x80;
    const bitLen = len * 8;
    const dv = new DataView(padded.buffer);
    dv.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000));
    dv.setUint32(padded.length - 4, bitLen >>> 0);
    const w = new Uint32Array(64);
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let off = 0; off < padded.length; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, hh] = h;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (hh + S1 + ch + SHA_K[i] + w[i]) >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) >>> 0;
        hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
      h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
    }
    return Array.from(h, (x) => x.toString(16).padStart(8, "0")).join("");
  }

  async function digestHex(bytes, algo) {
    if (crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest(algo, bytes);
      return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
    }
    if (algo === "SHA-256") return sha256Bytes(new Uint8Array(bytes));
    throw new Error("Web Crypto tidak tersedia di konteks ini. Buka lewat http://localhost (atau HTTPS) untuk SHA-1/384/512.");
  }

  /* ============================== tool specs ============================== */
  const specs = {
    "js-formatter": {
      title: "JavaScript Formatter", inputLabel: "Source JavaScript", placeholder: "const hello=(name)=>{return `Hai ${name}`}",
      run: (input) => ({ out: formatJS(input) || "// Tidak ada kode untuk diformat." })
    },
    "js-minifier": {
      title: "JavaScript Minifier", inputLabel: "Source JavaScript",
      fields: [{ key: "keepComments", label: "Pertahankan komentar", type: "checkbox", value: false }],
      run: (input, v) => ({ out: minifyJS(input, { keepComments: !!v.keepComments }) })
    },
    "json-formatter": {
      title: "JSON Formatter", inputLabel: "JSON mentah", placeholder: '{"nama":"Nexus","aktif":true}',
      run: (input) => ({ out: JSON.stringify(JSON.parse(input), null, 2) })
    },
    "json-validator": {
      title: "JSON Validator", inputLabel: "JSON yang akan diperiksa",
      run: (input) => {
        const data = JSON.parse(input);
        const type = Array.isArray(data) ? "Array" : data === null ? "null" : typeof data;
        const size = new Blob([input]).size;
        return { html: `<div class="notice info" style="border-color:rgba(52,211,153,.3);background:rgba(52,211,153,.08);color:#a7f3d0">${ico("check")} JSON valid.</div>
          <div class="metric-grid mt-8"><div class="metric"><strong>${esc(type)}</strong><small>Root type</small></div>
          <div class="metric"><strong>${Array.isArray(data) ? data.length : Object.keys(data || {}).length}</strong><small>Elemen/kunci utama</small></div>
          <div class="metric"><strong>${N.core.formatBytes(size)}</strong><small>Ukuran</small></div></div>` };
      }
    },
    "json-minifier": {
      title: "JSON Minifier", inputLabel: "JSON mentah",
      run: (input) => ({ out: JSON.stringify(JSON.parse(input)) })
    },
    "base64": {
      title: "Base64 Encoder / Decoder", inputLabel: "Teks",
      fields: [{ key: "dir", label: "Arah", type: "select", options: [["encode", "Encode → Base64"], ["decode", "Decode → Teks"]], value: "encode" }],
      run: (input, v) => ({ out: v.dir === "decode" ? fromBase64(input) : toBase64(input) })
    },
    "url-encode": {
      title: "URL Encoder / Decoder", inputLabel: "Teks / komponen URL",
      fields: [{ key: "dir", label: "Arah", type: "select", options: [["encode", "Encode"], ["decode", "Decode"]], value: "encode" }],
      run: (input, v) => {
        try { return { out: v.dir === "decode" ? decodeURIComponent(input) : encodeURIComponent(input) }; }
        catch (e) { throw new Error("URI tidak valid: " + e.message); }
      }
    },
    "html-entity": {
      title: "HTML Entity Encoder / Decoder", inputLabel: "Teks HTML",
      fields: [{ key: "dir", label: "Arah", type: "select", options: [["encode", "Encode entities"], ["decode", "Decode entities"]], value: "encode" }],
      run: (input, v) => ({ out: v.dir === "decode" ? htmlEntitiesDecode(input) : htmlEntitiesEncode(input) })
    },
    "color-converter": {
      title: "Color Converter", inputLabel: "Warna (contoh: #7c5cff, rgb(124,92,255), hsl(252,100%,76%))",
      run: (input) => {
        const { r, g, b } = parseColor(input);
        const hsl = rgbToHsl(r, g, b);
        const hex = "#" + hex2(r) + hex2(g) + hex2(b);
        return { html: `<div class="row" style="align-items:stretch">
          <div style="width:86px;min-height:86px;border-radius:14px;border:1px solid var(--line-strong);background:${esc(hex)}"></div>
          <div class="grid" style="flex:1;gap:8px">
            <div class="result-row"><span>HEX</span><code>${esc(hex.toUpperCase())}</code></div>
            <div class="result-row"><span>RGB</span><code>rgb(${r}, ${g}, ${b})</code></div>
            <div class="result-row"><span>HSL</span><code>hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)</code></div>
          </div></div>` };
      }
    },
    "timestamp": {
      title: "Timestamp Converter", inputLabel: "Nilai timestamp atau tanggal",
      fields: [{ key: "dir", label: "Arah", type: "select", options: [["to-date", "Timestamp → Tanggal"], ["to-ts", "Tanggal → Timestamp"]], value: "to-date" }],
      run: (input, v) => {
        if (v.dir === "to-ts") {
          const d = new Date(input.trim());
          if (isNaN(d.getTime())) throw new Error("Tanggal tidak dikenali.");
          return { html: `<div class="result-row"><span>Unix (detik)</span><code>${Math.floor(d.getTime() / 1000)}</code></div>
            <div class="result-row mt-8"><span>Unix (ms)</span><code>${d.getTime()}</code></div>` };
        }
        const raw = input.trim();
        if (!/^-?\d+$/.test(raw)) throw new Error("Masukkan bilangan bulat timestamp.");
        let n = Number(raw);
        if (Math.abs(n) < 1e11) n *= 1000;
        const d = new Date(n);
        if (isNaN(d.getTime())) throw new Error("Timestamp di luar rentang yang didukung.");
        return { html: `<div class="result-row"><span>Lokal</span><code>${esc(d.toLocaleString("id-ID"))}</code></div>
          <div class="result-row mt-8"><span>ISO 8601</span><code>${esc(d.toISOString())}</code></div>
          <div class="result-row mt-8"><span>UTC</span><code>${esc(d.toUTCString())}</code></div>` };
      }
    },
    "text-diff": {
      title: "Text Diff", inputLabel: "Teks A (lama)", placeholder: "Baris pertama...", rows: 10,
      fields: [{ key: "b", label: "Teks B (baru)", type: "textarea", rows: 10, value: "" }],
      run: (input, v) => {
        const rows = lineDiff(input, v.b || "");
        const add = rows.filter((r) => r.type === "add").length;
        const del = rows.filter((r) => r.type === "del").length;
        const body = rows.map((r) => {
          const cls = r.type === "add" ? "diff-add" : r.type === "del" ? "diff-del" : "diff-hunk";
          const sign = r.type === "add" ? "+" : r.type === "del" ? "−" : " ";
          return `<div class="${r.type === "same" ? "faint" : cls}">${sign} ${esc(r.text)}</div>`;
        }).join("");
        return { html: `<div class="row tiny"><span class="ok">+${add} tambahan</span><span class="bad">−${del} hapusan</span></div><div class="output-preview mt-8">${body || "Tidak ada perbedaan."}</div>` };
      }
    },
    "regex-tester": {
      title: "Regex Tester", inputLabel: "Teks uji", placeholder: "hello nexus 123",
      fields: [
        { key: "pattern", label: "Pola regex", type: "text", value: "\\w+", placeholder: "\\w+" },
        { key: "flags", label: "Flags", type: "text", value: "gi", placeholder: "gim" }
      ],
      run: (input, v) => {
        if (!v.pattern) throw new Error("Pola regex tidak boleh kosong.");
        let re;
        try { re = new RegExp(v.pattern, v.flags || ""); } catch (e) { throw new Error("Regex tidak valid: " + e.message); }
        const matches = [];
        let m, guard = 0;
        const global = re.flags.includes("g");
        while ((m = re.exec(input)) !== null && guard++ < 100) {
          matches.push({ index: m.index, value: m[0], groups: m.slice(1) });
          if (!global || m[0] === "") break;
        }
        if (!matches.length) return { html: `<div class="empty"><div class="empty-icon">${ico("search")}</div><strong>Tidak ada match</strong><p>Coba ubah pola atau flags.</p></div>` };
        return { html: `<div class="results">${matches.map((x) => `<div class="result-row"><span class="faint mono">@${x.index}</span><code>${esc(x.value)}</code>${x.groups.length ? `<span class="tiny muted">groups: ${esc(x.groups.join(" | "))}</span>` : ""}</div>`).join("")}</div>` };
      }
    },
    "uuid-generator": {
      title: "UUID Generator", inputLabel: "Tidak diperlukan — gunakan tombol Jalankan",
      fields: [{ key: "count", label: "Jumlah (maks 100)", type: "number", value: 5 }],
      run: (input, v) => {
        const count = Math.min(100, Math.max(1, Number(v.count) || 5));
        const arr = Array.from({ length: count }, () => {
          if (crypto && crypto.randomUUID) return crypto.randomUUID();
          const b = crypto.getRandomValues(new Uint8Array(16));
          b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
          const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
          return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
        });
        return { html: `<div class="results">${arr.map((u) => `<div class="result-row"><code>${esc(u)}</code></div>`).join("")}</div>` };
      }
    },
    "hash-generator": {
      title: "Hash Generator", inputLabel: "Teks yang akan di-hash",
      fields: [
        { key: "algo", label: "Algoritma", type: "select", options: [["SHA-256", "SHA-256"], ["SHA-1", "SHA-1"], ["SHA-384", "SHA-384"], ["SHA-512", "SHA-512"]], value: "SHA-256" },
        { key: "file", label: "Atau pilih file", type: "file" }
      ],
      run: async (input, v) => {
        let bytes;
        let label = "teks";
        if (v.file) {
          if (v.file.size > 25 * 1024 * 1024) throw new Error("Batas file 25 MB.");
          bytes = await v.file.arrayBuffer();
          label = v.file.name;
        } else {
          if (!input) throw new Error("Masukkan teks atau pilih file.");
          bytes = new TextEncoder().encode(input);
        }
        const hex = await digestHex(bytes, v.algo);
        return { out: hex, ext: "txt", html: `<div class="notice info">${esc(v.algo)} · ${esc(label)} · ${N.core.formatBytes(bytes.byteLength)}</div>
          <div class="output-preview mt-8">${esc(hex)}</div>` };
      }
    },
    "markdown-preview": {
      title: "Markdown Previewer", inputLabel: "Markdown", placeholder: "# Judul\n\nTulis **tebal** dan `kode`.", rows: 14,
      run: (input) => {
        const html = markdownToHtml(input) || '<div class="empty"><strong>Preview kosong</strong><p>Tulis Markdown di sebelah kiri.</p></div>';
        return { out: html, ext: "html", html };
      }
    },
    "css-formatter": {
      title: "CSS Formatter", inputLabel: "CSS mentah", placeholder: "body{color:#fff;margin:0}",
      run: (input) => ({ out: formatCSS(input) })
    },
    "html-formatter": {
      title: "HTML Formatter", inputLabel: "HTML mentah", placeholder: "<div><p>Halo</p></div>",
      run: (input) => ({ out: formatHTML(input) })
    }
  };

  /* ============================== renderer ============================== */
  function fieldHtml(f) {
    const id = "f-" + f.key;
    if (f.type === "checkbox") return `<label class="check"><input type="checkbox" id="${id}" data-key="${f.key}" ${f.value ? "checked" : ""}> ${esc(f.label)}</label>`;
    if (f.type === "select") return `<label class="field"><span>${esc(f.label)}</span><select id="${id}" data-key="${f.key}">${f.options.map((o) => `<option value="${esc(o[0])}" ${o[0] === f.value ? "selected" : ""}>${esc(o[1])}</option>`).join("")}</select></label>`;
    if (f.type === "textarea") return `<label class="field"><span>${esc(f.label)}</span><textarea id="${id}" data-key="${f.key}" rows="${f.rows || 5}" placeholder="${esc(f.placeholder || "")}">${esc(f.value || "")}</textarea></label>`;
    if (f.type === "file") return `<label class="field"><span>${esc(f.label)}</span><input type="file" id="${id}" data-key="${f.key}" data-file="1"><small class="hint" id="${id}-name">Belum ada file</small></label>`;
    return `<label class="field"><span>${esc(f.label)}</span><input type="text" id="${id}" data-key="${f.key}" value="${esc(f.value == null ? "" : f.value)}" placeholder="${esc(f.placeholder || "")}"></label>`;
  }

  function render(host, toolId) {
    const tool = N.registry.get(toolId);
    const spec = specs[toolId];
    if (!tool || !spec) { host.innerHTML = '<div class="empty"><strong>Tool tidak ditemukan.</strong></div>'; return; }

    host.innerHTML = `
      <div class="workspace-head">
        <div><span class="eyebrow">${esc(N.registry.category(tool.cat).label)}</span><h1 class="page-title">${esc(spec.title)}</h1><p class="sub">${esc(tool.desc)}</p></div>
        <div class="row"><button class="btn btn-sm btn-ghost" data-act="fav" type="button">${ico(N.core.isFavorite(toolId) ? "star" : "starOff")}<span>${N.core.isFavorite(toolId) ? "Tersimpan" : "Simpan"}</span></button></div>
      </div>
      <div class="card card-pad">
        <div class="opts" ${spec.fields && spec.fields.length ? "" : "hidden"}>${(spec.fields || []).map(fieldHtml).join("")}</div>
        <div class="io-grid mt-16">
          <div class="io-pane">
            <div class="io-label"><span>${esc(spec.inputLabel || "Input")}</span><button class="btn btn-sm btn-ghost" data-act="clear" type="button">Bersihkan</button></div>
            <textarea id="toolInput" spellcheck="false" placeholder="${esc(spec.placeholder || "")}" rows="${spec.rows || 12}"></textarea>
            <div class="status-line" id="toolStatus"></div>
          </div>
          <div class="io-pane">
            <div class="io-label"><span>Hasil</span><div class="io-tools">
              <button class="btn btn-sm" data-act="copy" type="button">Salin</button>
              <button class="btn btn-sm" data-act="download" type="button">Unduh</button>
            </div></div>
            <div id="toolOutput" class="output-preview" style="flex:1">Hasil akan muncul di sini.</div>
            <div class="status-line" id="toolMeta"></div>
          </div>
        </div>
        <div class="row mt-16"><button class="btn btn-primary" data-act="run" type="button">${ico("play")}<span>Jalankan</span></button><span class="hint">Semua proses berjalan di browser Anda.</span></div>
      </div>`;

    const input = $("#toolInput", host);
    const output = $("#toolOutput", host);
    const status = $("#toolStatus", host);
    const meta = $("#toolMeta", host);
    let lastResult = { out: "", html: "" };

    function resultText() {
      if (typeof lastResult.out === "string") return lastResult.out;
      if (typeof lastResult.download === "string") return lastResult.download;
      if (lastResult.html != null) {
        const box = document.createElement("div");
        box.innerHTML = lastResult.html;
        return (box.textContent || "").trim();
      }
      return "";
    }
    function resultExt() {
      if (lastResult.ext) return lastResult.ext;
      if (typeof lastResult.out !== "string") return "txt";
      if (toolId.includes("json")) return "json";
      if (toolId.includes("css")) return "css";
      if (toolId.includes("html")) return "html";
      return "txt";
    }

    function values() {
      const out = {};
      $$("[data-key]", host).forEach((el) => {
        if (el.dataset.file) out[el.dataset.key] = el.files && el.files[0];
        else if (el.type === "checkbox") out[el.dataset.key] = el.checked;
        else out[el.dataset.key] = el.value;
      });
      return out;
    }

    function setStatus(msg, bad) {
      status.textContent = msg;
      status.className = "status-line" + (bad ? " bad" : "");
    }

    async function run() {
      setStatus("Memproses...");
      output.innerHTML = '<div class="loading-overlay"><div><div class="loading-ring" style="margin:auto"></div><div class="mt-8">Memproses...</div></div></div>';
      try {
        lastResult = await spec.run(input.value, values()) || {};
        if (lastResult.html != null) {
          output.innerHTML = lastResult.html;
          output.classList.remove("mono");
        } else {
          output.textContent = lastResult.out || "";
          output.classList.add("mono");
        }
        meta.textContent = lastResult.note || `Selesai · ${new Date().toLocaleTimeString("id-ID")}`;
        setStatus("Berhasil.");
        N.core.trackTool(toolId, "tool");
      } catch (err) {
        lastResult = { out: "" };
        output.innerHTML = `<div class="notice err">${esc(err && err.message ? err.message : "Proses gagal.")}</div>`;
        setStatus("Error: " + (err && err.message ? err.message : "gagal"), true);
        output.classList.remove("mono");
      }
    }

    host.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === "run") run();
      if (act === "clear") { input.value = ""; output.textContent = "Hasil akan muncul di sini."; setStatus("Input dibersihkan."); lastResult = { out: "" }; }
      if (act === "copy") {
        const text = resultText();
        if (!text) { N.core.toast("Belum ada hasil untuk disalin.", "err"); return; }
        if (await N.core.copy(text)) N.core.toast("Hasil disalin.", "ok");
      }
      if (act === "download") {
        const text = resultText();
        if (!text) { N.core.toast("Belum ada hasil untuk diunduh.", "err"); return; }
        N.core.download(`nexus-${toolId}.${resultExt()}`, text);
        N.core.toast("File diunduh.", "ok");
      }
      if (act === "fav") {
        const on = N.core.toggleFavorite(toolId);
        btn.innerHTML = ico(on ? "star" : "starOff") + "<span>" + (on ? "Tersimpan" : "Simpan") + "</span>";
        N.core.toast(on ? "Ditambahkan ke favorites." : "Dihapus dari favorites.", "ok");
      }
    });
    $$("[data-file]", host).forEach((el) => el.addEventListener("change", () => {
      const label = $("#" + el.id + "-name", host);
      if (label) label.textContent = el.files[0] ? `${el.files[0].name} · ${N.core.formatBytes(el.files[0].size)}` : "Belum ada file";
    }));
    input.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); run(); }
    });
    if (N.core.state.settings.autoPreview && input.value.trim()) run();
  }

  N.codeTools = { render, formatJS, minifyJS, tokenizeJS, formatCSS, formatHTML, markdownToHtml, toBase64, fromBase64, sha256Bytes };
})(window.Nexus = window.Nexus || {});
