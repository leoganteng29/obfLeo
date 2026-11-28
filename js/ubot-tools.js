/* NEXUS TOOLBOX — Toolkit (dipindahkan dari logika plugin bot Telegram).
   Hanya logika yang berjalan offline di browser. Tidak ada token, API key, atau data pengguna bot.
   Setiap tool punya sub-tab; semua hasil dihitung lokal. */
(function (N) {
  "use strict";

  const { escapeHtml: esc } = N.core;
  const ico = (name, cls) => (N.icons ? N.icons.svg(name, cls) : "");
  const impl = {};

  /* ------------------------------ helpers ------------------------------ */
  const LS_PREFIX = "nexus.toolkit.";
  function store(key, fallback) {
    try {
      const raw = window.localStorage.getItem(LS_PREFIX + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function saveStore(key, value) {
    try { window.localStorage.setItem(LS_PREFIX + key, JSON.stringify(value)); } catch (e) { /* penyimpanan opsional */ }
  }

  // Parse angka format Indonesia ("1.500.000", "2,5") maupun format internasional ("2.5").
  function num(value) {
    const s = String(value == null ? "" : value).trim().replace(/\s+/g, "");
    if (!s) return null;
    let t = s;
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) t = s.replace(/\./g, "");
    t = t.replace(",", ".");
    const x = Number(t);
    return Number.isFinite(x) ? x : null;
  }
  const fmt = (n, d) => {
    if (!Number.isFinite(n)) return "–";
    return n.toLocaleString("id-ID", { maximumFractionDigits: d == null ? 4 : d });
  };
  const rp = (n) => (Number.isFinite(n) ? "Rp" + Math.round(n).toLocaleString("id-ID") : "–");

  class NeedError extends Error {}
  function need(values, keys) {
    for (const k of keys) if (values[k] == null) throw new NeedError("Isi semua angka dengan benar.");
  }

  // Tanggal lokal (YYYY-MM-DD), bukan UTC, agar kebiasaan tidak pindah hari di WIB.
  function dayKey(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function head(tool) {
    const cat = N.registry.category(tool.cat);
    return `<div class="workspace-head"><div>
        <span class="eyebrow">${esc(cat ? cat.label : "Toolkit")}</span>
        <h1 class="page-title">${esc(tool.name)}</h1><p class="sub">${esc(tool.desc)}</p></div>
        <div class="row"><button class="btn btn-sm btn-ghost" data-util="fav" type="button">${ico(N.core.isFavorite(tool.id) ? "star" : "starOff")}<span>${N.core.isFavorite(tool.id) ? "Tersimpan" : "Simpan"}</span></button></div></div>`;
  }
  function bindFav(host, id) {
    host.addEventListener("click", (e) => {
      const b = e.target.closest('[data-util="fav"]');
      if (!b) return;
      const on = N.core.toggleFavorite(id);
      b.innerHTML = ico(on ? "star" : "starOff") + "<span>" + (on ? "Tersimpan" : "Simpan") + "</span>";
      N.core.toast(on ? "Disimpan ke favorites." : "Dihapus.", "ok");
    });
  }
  const notice = (msg) => `<div class="notice err"><span>!</span><span>${esc(msg)}</span></div>`;
  const rows = (pairs) => pairs.map(([k, v]) => `<div class="result-row"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join("");
  const copyBtn = (text) => `<button class="btn btn-sm" type="button" data-copy="${esc(text)}">Salin</button>`;
  function bindCopy(root) {
    root.addEventListener("click", (e) => {
      const b = e.target.closest("[data-copy]");
      if (!b) return;
      const text = b.getAttribute("data-copy");
      const done = () => N.core.toast("Disalin ke clipboard.", "ok");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, () => N.core.toast("Gagal menyalin.", "bad"));
      } else N.core.toast("Clipboard tidak tersedia di browser ini.", "bad");
    });
  }

  // Tab horizontal di dalam satu tool. Setiap tab me-render panelnya sendiri.
  function tabbed(id, tabs) {
    return (host, tool) => {
      host.innerHTML = head(tool) +
        `<div class="segmented ub-tabs" role="tablist">${tabs.map((t, i) =>
          `<button type="button" role="tab" data-tab="${esc(t.key)}" class="${i === 0 ? "active" : ""}">${esc(t.label)}</button>`).join("")}</div>
         <div class="card card-pad mt-16 ub-body"></div>`;
      const body = host.querySelector(".ub-body");
      const show = (key) => {
        const t = tabs.find((x) => x.key === key) || tabs[0];
        host.querySelectorAll("[data-tab]").forEach((b) => {
          const on = b.dataset.tab === t.key;
          b.classList.toggle("active", on);
          b.setAttribute("aria-selected", on ? "true" : "false");
        });
        body.innerHTML = "";
        t.render(body);
      };
      host.querySelector(".ub-tabs").addEventListener("click", (e) => {
        const b = e.target.closest("[data-tab]");
        if (b) show(b.dataset.tab);
      });
      bindFav(host, id);
      bindCopy(host);
      show(tabs[0].key);
      N.core.trackTool(id, "utility");
    };
  }

  // Form hitung generik: daftar field -> fungsi calc(values) yang mengembalikan HTML hasil.
  function calcForm(el, fields, calc) {
    el.innerHTML = `<form class="ub-form" novalidate>
        ${fields.map((f) => `<label class="ub-field"><span>${esc(f.label)}</span>
          <input name="${esc(f.name)}" inputmode="decimal" autocomplete="off" placeholder="${esc(f.ph || "")}" value="${esc(f.value == null ? "" : f.value)}"></label>`).join("")}
        <button class="btn btn-primary" type="submit">Hitung</button></form>
        <div class="ub-out mt-16" aria-live="polite"></div>`;
    const form = el.querySelector("form");
    const out = el.querySelector(".ub-out");
    const run = () => {
      const v = {};
      fields.forEach((f) => { v[f.name] = num(form.elements[f.name].value); });
      try { out.innerHTML = calc(v); } catch (err) {
        out.innerHTML = notice(err instanceof NeedError ? err.message : "Input tidak valid.");
      }
    };
    form.addEventListener("submit", (e) => { e.preventDefault(); run(); });
    run();
  }

  // Pilihan kalkulator (dropdown) + form di bawahnya.
  function selectCalc(el, items) {
    el.innerHTML = `<label class="ub-field"><span>Pilih perhitungan</span>
        <select class="ub-select">${items.map((it, i) => `<option value="${i}">${esc(it.label)}</option>`).join("")}</select></label>
      <div class="ub-calc mt-16"></div>`;
    const sel = el.querySelector(".ub-select");
    const box = el.querySelector(".ub-calc");
    const draw = () => {
      const it = items[Number(sel.value)] || items[0];
      box.innerHTML = `<p class="hint mb-12">${esc(it.hint || "")}</p><div class="ub-calc-form"></div>`;
      calcForm(box.querySelector(".ub-calc-form"), it.fields, it.calc);
    };
    sel.addEventListener("change", draw);
    draw();
  }

  /* ------------------------------ 1. Cipher / encode ------------------------------ */
  const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const MORSE = {
    a: ".-", b: "-...", c: "-.-.", d: "-..", e: ".", f: "..-.", g: "--.", h: "....", i: "..", j: ".---",
    k: "-.-", l: ".-..", m: "--", n: "-.", o: "---", p: ".--.", q: "--.-", r: ".-.", s: "...", t: "-",
    u: "..-", v: "...-", w: ".--", x: "-..-", y: "-.--", z: "--..", "0": "-----", "1": ".----", "2": "..---",
    "3": "...--", "4": "....-", "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----."
  };
  const MORSE_REV = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));
  const NATO = { a: "Alpha", b: "Bravo", c: "Charlie", d: "Delta", e: "Echo", f: "Foxtrot", g: "Golf", h: "Hotel", i: "India", j: "Juliett", k: "Kilo", l: "Lima", m: "Mike", n: "November", o: "Oscar", p: "Papa", q: "Quebec", r: "Romeo", s: "Sierra", t: "Tango", u: "Uniform", v: "Victor", w: "Whiskey", x: "X-ray", y: "Yankee", z: "Zulu" };
  const LEET = { a: "4", e: "3", i: "1", o: "0", s: "5", t: "7", b: "8", g: "9", l: "1" };

  function shiftLetters(text, shiftOf) {
    return text.replace(/[a-z]/gi, (c, idx) => {
      const base = c <= "Z" ? 65 : 97;
      const s = shiftOf(idx);
      return String.fromCharCode(((c.charCodeAt(0) - base + s) % 26 + 26) % 26 + base);
    });
  }
  function vigenere(text, key, decode) {
    const k = key.toLowerCase().replace(/[^a-z]/g, "");
    if (!k) throw new Error("Kunci Vigenere harus huruf.");
    let ki = 0;
    return text.replace(/[a-z]/gi, (c) => {
      const base = c <= "Z" ? 65 : 97;
      const sh = k.charCodeAt(ki % k.length) - 97;
      ki++;
      const s = decode ? -sh : sh;
      return String.fromCharCode(((c.charCodeAt(0) - base + s) % 26 + 26) % 26 + base);
    });
  }
  function base32Encode(text) {
    const bytes = new TextEncoder().encode(text);
    let bits = "";
    for (const b of bytes) bits += b.toString(2).padStart(8, "0");
    let out = "";
    for (let i = 0; i < bits.length; i += 5) {
      const chunk = bits.slice(i, i + 5).padEnd(5, "0");
      out += B32[parseInt(chunk, 2)];
    }
    while (out.length % 8) out += "=";
    return out;
  }
  function base32Decode(text) {
    const clean = text.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
    let bits = "";
    for (const c of clean) {
      const v = B32.indexOf(c);
      if (v < 0) throw new Error("Karakter Base32 tidak valid.");
      bits += v.toString(2).padStart(5, "0");
    }
    const bytes = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
    return new TextDecoder().decode(new Uint8Array(bytes));
  }

  const CIPHERS = [
    { id: "rot13", label: "ROT13", encodable: true, run: (t) => shiftLetters(t, () => 13) },
    { id: "atbash", label: "Atbash (a↔z)", encodable: true, run: (t) => t.replace(/[a-z]/gi, (c) => { const b = c <= "Z" ? 65 : 97; return String.fromCharCode(b + 25 - (c.charCodeAt(0) - b)); }) },
    { id: "caesar", label: "Caesar (geser N)", needsKey: "Geseran (angka)", encodable: true, run: (t, key, dec) => {
        const n = parseInt(key, 10);
        if (!Number.isFinite(n)) throw new Error("Isi geseran berupa angka, mis. 3.");
        return shiftLetters(t, () => (dec ? -n : n));
      } },
    { id: "vigenere", label: "Vigenère", needsKey: "Kunci (huruf)", encodable: true, run: (t, key, dec) => vigenere(t, key, dec) },
    { id: "a1z26", label: "A1Z26 (a=1, b=2…)", encodable: true, run: (t, _k, dec) => {
        if (!dec) return [...t.toLowerCase()].map((c) => (/[a-z]/.test(c) ? c.charCodeAt(0) - 96 : c === " " ? "/" : "")).filter((x) => x !== "").join("-");
        return t.split(/[-\s]+/).map((n) => (n === "/" ? " " : /^\d+$/.test(n) && +n >= 1 && +n <= 26 ? String.fromCharCode(+n + 96) : "")).join("");
      } },
    { id: "hex", label: "Hex", encodable: true, run: (t, _k, dec) => dec
        ? new TextDecoder().decode(new Uint8Array(t.replace(/\s/g, "").match(/.{1,2}/g).map((h) => parseInt(h, 16))))
        : [...new TextEncoder().encode(t)].map((b) => b.toString(16).padStart(2, "0")).join(" ") },
    { id: "binary", label: "Biner (8-bit)", encodable: true, run: (t, _k, dec) => dec
        ? new TextDecoder().decode(new Uint8Array(t.trim().split(/\s+/).map((b) => parseInt(b, 2))))
        : [...new TextEncoder().encode(t)].map((b) => b.toString(2).padStart(8, "0")).join(" ") },
    { id: "ascii", label: "Kode ASCII/Unicode", encodable: true, run: (t, _k, dec) => dec
        ? t.trim().split(/\s+/).map((n) => String.fromCodePoint(parseInt(n, 10))).join("")
        : [...t].map((c) => c.codePointAt(0)).join(" ") },
    { id: "morse", label: "Morse", encodable: true, run: (t, _k, dec) => dec
        ? t.trim().split(/\s+/).map((m) => (m === "/" ? " " : MORSE_REV[m] || "")).join("")
        : [...t.toLowerCase()].map((c) => (c === " " ? "/" : MORSE[c] || "")).filter(Boolean).join(" ") },
    { id: "base32", label: "Base32", encodable: true, run: (t, _k, dec) => (dec ? base32Decode(t) : base32Encode(t)) },
    { id: "leet", label: "Leetspeak", encodable: true, run: (t) => [...t].map((c) => LEET[c.toLowerCase()] || c).join("") },
    { id: "nato", label: "NATO phonetic", encodable: true, run: (t) => [...t.toLowerCase()].map((c) => NATO[c] || (c === " " ? "|" : c)).join(" ") },
    { id: "reverse", label: "Balik urutan", encodable: true, run: (t) => [...t].reverse().join("") }
  ];

  impl["cipher-lab"] = (host, tool) => {
    host.innerHTML = head(tool) + `<div class="card card-pad mt-16 ub-cipher">
      <div class="ub-grid2">
        <label class="ub-field"><span>Metode</span><select class="ub-select" name="method">${CIPHERS.map((c) => `<option value="${c.id}">${esc(c.label)}</option>`).join("")}</select></label>
        <label class="ub-field"><span>Mode</span><select class="ub-select" name="mode"><option value="enc">Encode / enkripsi</option><option value="dec">Decode / dekripsi</option></select></label>
      </div>
      <label class="ub-field mt-12 ub-keywrap" hidden><span class="ub-keylabel">Kunci</span><input name="key" autocomplete="off"></label>
      <label class="ub-field mt-12"><span>Teks</span><textarea name="input" rows="4" placeholder="Tulis teks di sini"></textarea></label>
      <div class="row mt-12"><button class="btn btn-primary" type="button" data-run>Jalankan</button><button class="btn" type="button" data-clear>Kosongkan</button></div>
      <div class="ub-out mt-16" aria-live="polite"></div></div>`;
    const $m = host.querySelector('[name="method"]');
    const $mode = host.querySelector('[name="mode"]');
    const $key = host.querySelector(".ub-keywrap");
    const $keyInput = host.querySelector('[name="key"]');
    const $keyLabel = host.querySelector(".ub-keylabel");
    const $in = host.querySelector('[name="input"]');
    const $out = host.querySelector(".ub-out");
    const current = () => CIPHERS.find((c) => c.id === $m.value);
    const syncKey = () => {
      const c = current();
      $key.hidden = !c.needsKey;
      $keyLabel.textContent = c.needsKey || "";
      if (c.id === "nato") $mode.value = "enc";
      $mode.disabled = c.id === "nato";
    };
    const run = () => {
      const c = current();
      const dec = $mode.value === "dec";
      if (!$in.value.trim()) { $out.innerHTML = notice("Tulis teks dulu."); return; }
      try {
        const result = c.run($in.value, $keyInput.value, dec);
        $out.innerHTML = `<div class="ub-result"><pre class="ub-pre">${esc(String(result))}</pre><div class="row mt-8">${copyBtn(String(result))}</div></div>`;
      } catch (err) { $out.innerHTML = notice(err.message || "Gagal memproses."); }
    };
    $m.addEventListener("change", () => { syncKey(); run(); });
    $mode.addEventListener("change", run);
    host.querySelector("[data-run]").addEventListener("click", run);
    host.querySelector("[data-clear]").addEventListener("click", () => { $in.value = ""; $out.innerHTML = ""; });
    bindFav(host, tool.id); bindCopy(host);
    syncKey();
    N.core.trackTool(tool.id, "utility");
  };

  /* ------------------------------ 2. Font Unicode ------------------------------ */
  function mathMap(upper, lower, digits, exceptions) {
    return (ch) => {
      if (exceptions && exceptions[ch] != null) return exceptions[ch];
      if (ch >= "A" && ch <= "Z" && upper != null) return String.fromCodePoint(upper + ch.charCodeAt(0) - 65);
      if (ch >= "a" && ch <= "z" && lower != null) return String.fromCodePoint(lower + ch.charCodeAt(0) - 97);
      if (ch >= "0" && ch <= "9" && digits != null) return String.fromCodePoint(digits + ch.charCodeAt(0) - 48);
      return ch;
    };
  }
  const listMap = (upperStr, lowerStr, digitStr) => (ch) => {
    const i = ch.charCodeAt(0) - 65, j = ch.charCodeAt(0) - 97, k = ch.charCodeAt(0) - 48;
    if (ch >= "A" && ch <= "Z" && upperStr) return [...upperStr][i] || ch;
    if (ch >= "a" && ch <= "z" && lowerStr) return [...lowerStr][j] || ch;
    if (ch >= "0" && ch <= "9" && digitStr) return [...digitStr][k] || ch;
    return ch;
  };
  const combine = (mark) => (ch) => (ch === " " ? " " : [...ch].join(mark) + mark);
  const FONT_STYLES = [
    { key: "bold", label: "Tebal", map: mathMap(0x1D400, 0x1D41A, 0x1D7CE) },
    { key: "italic", label: "Miring", map: mathMap(0x1D434, 0x1D44E, null, { h: "ℎ" }) },
    { key: "bolditalic", label: "Tebal miring", map: mathMap(0x1D468, 0x1D482) },
    { key: "script", label: "Script", map: mathMap(0x1D49C, 0x1D4B6, null, { B: "ℬ", E: "ℰ", F: "ℱ", H: "ℋ", I: "ℐ", L: "ℒ", M: "ℳ", R: "ℛ", e: "ℯ", g: "ℊ", o: "ℴ" }) },
    { key: "boldscript", label: "Tebal script", map: mathMap(0x1D4D0, 0x1D4EA) },
    { key: "fraktur", label: "Fraktur", map: mathMap(0x1D504, 0x1D51E, null, { C: "ℭ", H: "ℌ", I: "ℑ", R: "ℜ", Z: "ℨ" }) },
    { key: "doublestruck", label: "Double-struck", map: mathMap(0x1D538, 0x1D552, 0x1D7D8, { C: "ℂ", H: "ℍ", N: "ℕ", P: "ℙ", Q: "ℚ", R: "ℝ", Z: "ℤ" }) },
    { key: "mono", label: "Monospace", map: mathMap(0x1D670, 0x1D68A, 0x1D7F6) },
    { key: "sans", label: "Sans", map: mathMap(0x1D5A0, 0x1D5BA, 0x1D7E2) },
    { key: "sansbold", label: "Sans tebal", map: mathMap(0x1D5D4, 0x1D5EE, 0x1D7EC) },
    { key: "circled", label: "Lingkaran", map: (ch) => {
        if (ch >= "A" && ch <= "Z") return String.fromCodePoint(0x24B6 + ch.charCodeAt(0) - 65);
        if (ch >= "a" && ch <= "z") return String.fromCodePoint(0x24D0 + ch.charCodeAt(0) - 97);
        if (ch === "0") return "⓪";
        if (ch >= "1" && ch <= "9") return String.fromCodePoint(0x2460 + ch.charCodeAt(0) - 49);
        return ch;
      } },
    { key: "squared", label: "Kotak", map: (ch) => {
        const c = ch.toUpperCase();
        return c >= "A" && c <= "Z" ? String.fromCodePoint(0x1F130 + c.charCodeAt(0) - 65) : ch;
      } },
    { key: "fullwidth", label: "Lebar penuh", map: (ch) => {
        const code = ch.charCodeAt(0);
        if (ch === " ") return "　";
        return code >= 0x21 && code <= 0x7E ? String.fromCharCode(code + 0xFEE0) : ch;
      } },
    { key: "smallcaps", label: "Small caps", map: listMap(null, "ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘqʀꜱᴛᴜᴠᴡxʏᴢ", null) },
    { key: "superscript", label: "Superskrip", map: listMap(null, "ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖqʳˢᵗᵘᵛʷˣʸᶻ", "⁰¹²³⁴⁵⁶⁷⁸⁹") },
    { key: "subscript", label: "Subskrip", map: listMap(null, "ₐbcdₑfgₕᵢⱼₖₗₘₙₒₚqᵣₛₜᵤᵥwₓyz", "₀₁₂₃₄₅₆₇₈₉") },
    { key: "strike", label: "Coret", map: combine("̶") },
    { key: "underline", label: "Garis bawah", map: combine("̲") }
  ];
  function applyFont(text, map) {
    return [...text].map((ch) => {
      const out = map(ch);
      return out == null ? ch : out;
    }).join("");
  }

  impl["font-styler"] = (host, tool) => {
    host.innerHTML = head(tool) + `<div class="card card-pad mt-16">
      <label class="ub-field"><span>Teks</span><input name="t" value="NEXUS TOOLBOX" autocomplete="off" maxlength="300"></label>
      <div class="ub-fonts mt-16" aria-live="polite"></div></div>`;
    const input = host.querySelector('[name="t"]');
    const list = host.querySelector(".ub-fonts");
    const draw = () => {
      const text = input.value;
      if (!text.trim()) { list.innerHTML = '<p class="hint">Tulis teks untuk melihat semua gaya.</p>'; return; }
      list.innerHTML = FONT_STYLES.map((f) => {
        const out = applyFont(text, f.map);
        return `<div class="ub-font-card"><div class="ub-font-meta"><span>${esc(f.label)}</span>${copyBtn(out)}</div><div class="ub-font-text">${esc(out)}</div></div>`;
      }).join("");
    };
    input.addEventListener("input", draw);
    bindFav(host, tool.id); bindCopy(host);
    draw();
    N.core.trackTool(tool.id, "utility");
  };

  /* ------------------------------ 3. Konverter satuan ------------------------------ */
  const UNIT_GROUPS = {
    panjang: { label: "Panjang", base: "m", units: { mm: 0.001, cm: 0.01, m: 1, km: 1000, inch: 0.0254, ft: 0.3048, yard: 0.9144, mi: 1609.34 } },
    berat: { label: "Berat", base: "g", units: { mg: 0.001, g: 1, kg: 1000, ton: 1000000, oz: 28.3495, lb: 453.592 } },
    kecepatan: { label: "Kecepatan", base: "m/s", units: { "m/s": 1, "km/jam": 0.277778, mph: 0.44704, knot: 0.514444 } },
    luas: { label: "Luas", base: "m2", units: { cm2: 0.0001, m2: 1, km2: 1000000, ha: 10000, acre: 4046.86, ft2: 0.092903 } },
    volume: { label: "Volume", base: "l", units: { ml: 0.001, l: 1, m3: 1000, gallon: 3.78541, cup: 0.236588 } },
    data: { label: "Ukuran data", base: "B", units: { B: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1099511627776 } },
    waktu: { label: "Waktu", base: "detik", units: { detik: 1, menit: 60, jam: 3600, hari: 86400, minggu: 604800 } },
    tekanan: { label: "Tekanan", base: "Pa", units: { Pa: 1, kPa: 1000, bar: 100000, atm: 101325, psi: 6894.76 } },
    energi: { label: "Energi", base: "J", units: { J: 1, kJ: 1000, cal: 4.184, kcal: 4184, Wh: 3600 } },
    sudut: { label: "Sudut", base: "derajat", units: { derajat: 1, radian: 57.2958, gradian: 0.9 } }
  };
  impl["unit-converter"] = (host, tool) => {
    const groupKeys = Object.keys(UNIT_GROUPS);
    host.innerHTML = head(tool) + `<div class="card card-pad mt-16">
      <label class="ub-field"><span>Kelompok</span><select class="ub-select" name="g">${groupKeys.map((k) => `<option value="${k}">${esc(UNIT_GROUPS[k].label)}</option>`).join("")}</select></label>
      <div class="ub-grid3 mt-12">
        <label class="ub-field"><span>Nilai</span><input name="v" inputmode="decimal" value="1" autocomplete="off"></label>
        <label class="ub-field"><span>Dari</span><select class="ub-select" name="from"></select></label>
        <label class="ub-field"><span>Ke</span><select class="ub-select" name="to"></select></label>
      </div><div class="ub-out mt-16" aria-live="polite"></div></div>`;
    const g = host.querySelector('[name="g"]'), v = host.querySelector('[name="v"]');
    const from = host.querySelector('[name="from"]'), to = host.querySelector('[name="to"]');
    const out = host.querySelector(".ub-out");
    const fill = () => {
      const units = Object.keys(UNIT_GROUPS[g.value].units);
      const opts = units.map((u) => `<option value="${esc(u)}">${esc(u)}</option>`).join("");
      from.innerHTML = opts; to.innerHTML = opts;
      to.selectedIndex = Math.min(1, units.length - 1);
      calc();
    };
    const calc = () => {
      const n = num(v.value);
      if (n == null) { out.innerHTML = notice("Isi nilai dengan angka."); return; }
      const u = UNIT_GROUPS[g.value].units;
      const result = (n * u[from.value]) / u[to.value];
      out.innerHTML = `<div class="ub-big"><span>${esc(fmt(n, 6))} ${esc(from.value)} =</span><strong>${esc(fmt(result, 6))} ${esc(to.value)}</strong></div>`;
    };
    g.addEventListener("change", fill);
    [v, from, to].forEach((el) => el.addEventListener("input", calc));
    [from, to].forEach((el) => el.addEventListener("change", calc));
    bindFav(host, tool.id);
    fill();
    N.core.trackTool(tool.id, "utility");
  };

  /* ------------------------------ 4. Geometri ------------------------------ */
  const PI = Math.PI;
  impl["geometry-calc"] = (host, tool) => {
    const shapes = [
      { label: "Lingkaran — luas & keliling", fields: [{ name: "r", label: "Jari-jari (r)" }], calc: (v) => { need(v, ["r"]); return rows([["Luas", fmt(PI * v.r * v.r, 4)], ["Keliling", fmt(2 * PI * v.r, 4)]]); } },
      { label: "Persegi — luas & keliling", fields: [{ name: "s", label: "Sisi" }], calc: (v) => { need(v, ["s"]); return rows([["Luas", fmt(v.s * v.s, 4)], ["Keliling", fmt(4 * v.s, 4)]]); } },
      { label: "Segitiga — luas", fields: [{ name: "a", label: "Alas" }, { name: "t", label: "Tinggi" }], calc: (v) => { need(v, ["a", "t"]); return rows([["Luas", fmt(0.5 * v.a * v.t, 4)]]); } },
      { label: "Trapesium — luas", fields: [{ name: "a", label: "Sisi sejajar a" }, { name: "b", label: "Sisi sejajar b" }, { name: "t", label: "Tinggi" }], calc: (v) => { need(v, ["a", "b", "t"]); return rows([["Luas", fmt(0.5 * (v.a + v.b) * v.t, 4)]]); } },
      { label: "Jajar genjang — luas", fields: [{ name: "a", label: "Alas" }, { name: "t", label: "Tinggi" }], calc: (v) => { need(v, ["a", "t"]); return rows([["Luas", fmt(v.a * v.t, 4)]]); } },
      { label: "Pythagoras — sisi miring", fields: [{ name: "a", label: "Sisi a" }, { name: "b", label: "Sisi b" }], calc: (v) => { need(v, ["a", "b"]); return rows([["Sisi miring c", fmt(Math.hypot(v.a, v.b), 4)]]); } },
      { label: "Kubus — volume", fields: [{ name: "s", label: "Sisi" }], calc: (v) => { need(v, ["s"]); return rows([["Volume", fmt(v.s ** 3, 4)]]); } },
      { label: "Balok — volume", fields: [{ name: "p", label: "Panjang" }, { name: "l", label: "Lebar" }, { name: "t", label: "Tinggi" }], calc: (v) => { need(v, ["p", "l", "t"]); return rows([["Volume", fmt(v.p * v.l * v.t, 4)]]); } },
      { label: "Tabung — volume", fields: [{ name: "r", label: "Jari-jari" }, { name: "t", label: "Tinggi" }], calc: (v) => { need(v, ["r", "t"]); return rows([["Volume", fmt(PI * v.r * v.r * v.t, 4)]]); } },
      { label: "Bola — volume", fields: [{ name: "r", label: "Jari-jari" }], calc: (v) => { need(v, ["r"]); return rows([["Volume", fmt((4 / 3) * PI * v.r ** 3, 4)]]); } }
    ];
    host.innerHTML = head(tool) + `<div class="card card-pad mt-16 ub-geo"></div>`;
    selectCalc(host.querySelector(".ub-geo"), shapes.map((s) => ({ label: s.label, fields: s.fields, calc: s.calc })));
    bindFav(host, tool.id);
    N.core.trackTool(tool.id, "utility");
  };

  /* ------------------------------ 5. Tanggal & waktu ------------------------------ */
  const DAYS_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  function parseDate(s) {
    const m = String(s || "").trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?$/);
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const WORLD = { Jakarta: "Asia/Jakarta", Tokyo: "Asia/Tokyo", London: "Europe/London", "New York": "America/New_York", Dubai: "Asia/Dubai", Sydney: "Australia/Sydney", Paris: "Europe/Paris", Singapura: "Asia/Singapore" };
  impl["date-tools"] = tabbed("date-tools", [
    { key: "ts", label: "Timestamp", render: (el) => {
        const now = () => `Detik: ${Math.floor(Date.now() / 1000)} · Milidetik: ${Date.now()}`;
        el.innerHTML = `<p class="hint">Sekarang: <code class="ub-code" data-now>${esc(now())}</code></p>
          <form class="ub-form mt-16" novalidate><label class="ub-field"><span>Tanggal (YYYY-MM-DD atau YYYY-MM-DD HH:MM)</span><input name="d" placeholder="2024-01-01 08:30" autocomplete="off"></label><button class="btn btn-primary" type="submit">Ubah ke timestamp</button></form>
          <form class="ub-form mt-16" novalidate><label class="ub-field"><span>Timestamp (detik atau milidetik)</span><input name="ts" inputmode="numeric" placeholder="1700000000" autocomplete="off"></label><button class="btn btn-primary" type="submit">Ubah ke tanggal</button></form>
          <div class="ub-out mt-16" aria-live="polite"></div>`;
        const out = el.querySelector(".ub-out");
        el.querySelectorAll("form")[0].addEventListener("submit", (e) => { e.preventDefault(); const d = parseDate(e.target.d.value); out.innerHTML = d ? rows([["Detik", String(Math.floor(d / 1000))], ["Milidetik", String(d.getTime())]]) : notice("Format tanggal: YYYY-MM-DD atau YYYY-MM-DD HH:MM"); });
        el.querySelectorAll("form")[1].addEventListener("submit", (e) => { e.preventDefault(); const n = Number(e.target.ts.value); if (!Number.isFinite(n) || n <= 0) { out.innerHTML = notice("Masukkan timestamp angka yang benar."); return; } const d = new Date(n < 1e12 ? n * 1000 : n); out.innerHTML = rows([["Tanggal", d.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) + " WIB"]]); });
      } },
    { key: "diff", label: "Selisih", render: (el) => {
        el.innerHTML = `<form class="ub-form" novalidate><div class="ub-grid2"><label class="ub-field"><span>Tanggal awal</span><input name="a" placeholder="2024-01-01" autocomplete="off"></label><label class="ub-field"><span>Tanggal akhir</span><input name="b" placeholder="2024-12-31" autocomplete="off"></label></div><button class="btn btn-primary mt-12" type="submit">Hitung selisih</button></form><div class="ub-out mt-16" aria-live="polite"></div>`;
        el.querySelector("form").addEventListener("submit", (e) => {
          e.preventDefault();
          const a = parseDate(e.target.a.value), b = parseDate(e.target.b.value);
          if (!a || !b) { el.querySelector(".ub-out").innerHTML = notice("Format tanggal: YYYY-MM-DD."); return; }
          const days = Math.round(Math.abs(b - a) / 86400000);
          el.querySelector(".ub-out").innerHTML = rows([["Selisih", `${days} hari`], ["Perkiraan minggu", fmt(days / 7, 1)], ["Perkiraan bulan", fmt(days / 30.4375, 1)]]);
        });
      } },
    { key: "age", label: "Umur", render: (el) => {
        el.innerHTML = `<form class="ub-form" novalidate><label class="ub-field"><span>Tanggal lahir</span><input name="a" placeholder="2000-05-15" autocomplete="off"></label><button class="btn btn-primary" type="submit">Hitung umur</button></form><div class="ub-out mt-16" aria-live="polite"></div>`;
        el.querySelector("form").addEventListener("submit", (e) => {
          e.preventDefault();
          const b = parseDate(e.target.a.value), now = new Date();
          const out = el.querySelector(".ub-out");
          if (!b || b > now) { out.innerHTML = notice("Masukkan tanggal lahir yang valid (tidak di masa depan)."); return; }
          let y = now.getFullYear() - b.getFullYear(), m = now.getMonth() - b.getMonth(), d = now.getDate() - b.getDate();
          if (d < 0) { m--; d += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
          if (m < 0) { y--; m += 12; }
          out.innerHTML = rows([["Umur", `${y} tahun ${m} bulan ${d} hari`], ["Total hari", String(Math.floor((now - b) / 86400000))]]);
        });
      } },
    { key: "day", label: "Hari", render: (el) => {
        el.innerHTML = `<form class="ub-form" novalidate><label class="ub-field"><span>Tanggal</span><input name="a" placeholder="2024-01-01" autocomplete="off"></label><button class="btn btn-primary" type="submit">Cek hari</button></form><div class="ub-out mt-16" aria-live="polite"></div>`;
        el.querySelector("form").addEventListener("submit", (e) => {
          e.preventDefault();
          const d = parseDate(e.target.a.value);
          el.querySelector(".ub-out").innerHTML = d ? rows([["Hari", DAYS_ID[d.getDay()]]]) : notice("Format tanggal: YYYY-MM-DD.");
        });
      } },
    { key: "countdown", label: "Hitung mundur", render: (el) => {
        el.innerHTML = `<form class="ub-form" novalidate><label class="ub-field"><span>Tanggal tujuan</span><input name="a" placeholder="2026-12-31" autocomplete="off"></label><button class="btn btn-primary" type="submit">Hitung</button></form><div class="ub-out mt-16" aria-live="polite"></div>`;
        el.querySelector("form").addEventListener("submit", (e) => {
          e.preventDefault();
          const d = parseDate(e.target.a.value);
          const out = el.querySelector(".ub-out");
          if (!d) { out.innerHTML = notice("Format tanggal: YYYY-MM-DD."); return; }
          const ms = d - Date.now();
          if (ms < 0) { out.innerHTML = rows([["Status", `Sudah lewat ${Math.floor(-ms / 86400000)} hari`]]); return; }
          out.innerHTML = rows([["Sisa", `${Math.floor(ms / 86400000)} hari ${Math.floor((ms / 3600000) % 24)} jam`]]);
        });
      } },
    { key: "world", label: "Jam dunia", render: (el) => {
        const draw = () => {
          el.innerHTML = `<div class="ub-world">${Object.entries(WORLD).map(([city, tz]) => {
            const t = new Date().toLocaleTimeString("id-ID", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
            return `<div class="result-row"><span>${esc(city)}</span><strong>${esc(t)}</strong></div>`;
          }).join("")}</div><p class="hint mt-12">Waktu dihitung ulang setiap kali tab ini dibuka.</p>`;
        };
        draw();
        const timer = setInterval(draw, 30000);
        N.core.addCleanup(() => clearInterval(timer));
      } }
  ]);

  /* ------------------------------ 6. Finansial (khas Indonesia) ------------------------------ */
  impl["finance-id"] = (host, tool) => {
    const items = [
      { label: "Zakat mal (2,5%)", hint: "Zakat mal 2,5% dari total harta. Pastikan harta sudah mencapai nisab.", fields: [{ name: "h", label: "Jumlah harta", ph: "50.000.000" }],
        calc: (v) => { need(v, ["h"]); return rows([["Harta", rp(v.h)], ["Zakat (2,5%)", rp(v.h * 0.025)]]); } },
      { label: "PPN", hint: "Dihitung dari harga dasar. Tarif default 11%.", fields: [{ name: "h", label: "Harga" }, { name: "p", label: "Persen PPN", value: 11 }],
        calc: (v) => { need(v, ["h", "p"]); const ppn = v.h * v.p / 100; return rows([["PPN", rp(ppn)], ["Total", rp(v.h + ppn)]]); } },
      { label: "THR", hint: "THR penuh bila sudah bekerja 12 bulan; jika kurang, dihitung proporsional.", fields: [{ name: "g", label: "Gaji pokok" }, { name: "b", label: "Bulan bekerja", value: 12 }],
        calc: (v) => { need(v, ["g", "b"]); const thr = v.b >= 12 ? v.g : v.g * v.b / 12; return rows([["THR", rp(thr)]]); } },
      { label: "Gaji bersih", hint: "Gaji dikurangi potongan dalam persen.", fields: [{ name: "g", label: "Gaji kotor" }, { name: "p", label: "Potongan (%)" }],
        calc: (v) => { need(v, ["g", "p"]); const pot = v.g * v.p / 100; return rows([["Potongan", rp(pot)], ["Gaji bersih", rp(v.g - pot)]]); } },
      { label: "Bunga deposito", hint: "Bunga sederhana: pokok × bunga per tahun × (bulan / 12).", fields: [{ name: "P", label: "Pokok" }, { name: "b", label: "Bunga (%/tahun)" }, { name: "n", label: "Jangka (bulan)" }],
        calc: (v) => { need(v, ["P", "b", "n"]); const bunga = v.P * (v.b / 100) * (v.n / 12); return rows([["Bunga", rp(bunga)], ["Saldo akhir", rp(v.P + bunga)]]); } },
      { label: "ROI", hint: "Return on investment = untung ÷ modal × 100%.", fields: [{ name: "u", label: "Untung" }, { name: "m", label: "Modal" }],
        calc: (v) => { need(v, ["u", "m"]); if (v.m === 0) throw new NeedError("Modal tidak boleh nol."); return rows([["ROI", fmt(v.u / v.m * 100, 2) + "%"]]); } },
      { label: "Break even point (unit)", hint: "BEP = biaya tetap ÷ (harga jual − biaya variabel).", fields: [{ name: "ft", label: "Biaya tetap" }, { name: "hj", label: "Harga jual/unit" }, { name: "bv", label: "Biaya variabel/unit" }],
        calc: (v) => { need(v, ["ft", "hj", "bv"]); if (v.hj <= v.bv) throw new NeedError("Harga jual harus lebih besar dari biaya variabel."); return rows([["BEP", fmt(Math.ceil(v.ft / (v.hj - v.bv)), 0) + " unit"]]); } },
      { label: "Kembalian", hint: "Uang dibayar dikurangi total.", fields: [{ name: "bayar", label: "Uang dibayar" }, { name: "total", label: "Total" }],
        calc: (v) => { need(v, ["bayar", "total"]); if (v.bayar < v.total) return notice("Uang dibayar kurang " + rp(v.total - v.bayar) + "."); return rows([["Kembalian", rp(v.bayar - v.total)]]); } },
      { label: "Harga pokok dari harga jual", hint: "Harga pokok = harga jual ÷ (1 + margin).", fields: [{ name: "j", label: "Harga jual" }, { name: "m", label: "Margin (%)" }],
        calc: (v) => { need(v, ["j", "m"]); if (v.m <= -100) throw new NeedError("Margin harus di atas −100%."); return rows([["Harga pokok", rp(v.j / (1 + v.m / 100))]]); } },
      { label: "Pajak hadiah undian (25%)", hint: "Pajak final 25% dari nilai hadiah undian.", fields: [{ name: "v", label: "Nilai hadiah" }],
        calc: (v) => { need(v, ["v"]); return rows([["Pajak 25%", rp(v.v * 0.25)], ["Diterima", rp(v.v * 0.75)]]); } },
      { label: "Simulasi KPR", hint: "Cicilan tetap (anuitas) per bulan.", fields: [{ name: "H", label: "Harga rumah" }, { name: "dp", label: "DP (%)" }, { name: "b", label: "Bunga (%/tahun)" }, { name: "th", label: "Tenor (tahun)" }],
        calc: (v) => {
          need(v, ["H", "dp", "b", "th"]);
          const P = v.H * (1 - v.dp / 100), r = v.b / 100 / 12, n = Math.round(v.th * 12);
          if (n <= 0) throw new NeedError("Tenor harus lebih dari 0.");
          const cicilan = r === 0 ? P / n : (P * r) / (1 - Math.pow(1 + r, -n));
          return rows([["Pokok pinjaman", rp(P)], ["Cicilan per bulan", rp(cicilan)], ["Total bayar", rp(cicilan * n)]]);
        } },
      { label: "Diskon bertingkat", hint: "Diskon diterapkan berurutan, bukan dijumlahkan. Isi diskon kedua dan seterusnya bila ada.", fields: [{ name: "H", label: "Harga awal" }, { name: "d1", label: "Diskon 1 (%)" }, { name: "d2", label: "Diskon 2 (%)" }, { name: "d3", label: "Diskon 3 (%)" }],
        calc: (v) => {
          need(v, ["H", "d1"]);
          let akhir = v.H; const langkah = [];
          [v.d1, v.d2, v.d3].forEach((d) => { if (d != null) { akhir -= akhir * d / 100; langkah.push(`− ${fmt(d, 2)}%`); } });
          return rows([...langkah.map((l, i) => ["Langkah " + (i + 1), l]), ["Harga akhir", rp(akhir)], ["Total hemat", rp(v.H - akhir)]]);
        } },
      { label: "Harga jual dari modal + markup", hint: "Harga jual = modal × (1 + markup).", fields: [{ name: "m", label: "Modal" }, { name: "mk", label: "Markup (%)" }],
        calc: (v) => { need(v, ["m", "mk"]); return rows([["Harga jual", rp(v.m * (1 + v.mk / 100))]]); } }
    ];
    host.innerHTML = head(tool) + `<div class="card card-pad mt-16 ub-fin"></div>`;
    selectCalc(host.querySelector(".ub-fin"), items);
    bindFav(host, tool.id);
    N.core.trackTool(tool.id, "utility");
  };

  /* ------------------------------ 7. Belanja & estimasi ------------------------------ */
  impl["bill-tools"] = (host, tool) => {
    const items = [
      { label: "Split tagihan (patungan)", hint: "Dibulatkan ke atas agar total tertutup.", fields: [{ name: "t", label: "Total tagihan" }, { name: "n", label: "Jumlah orang" }],
        calc: (v) => { need(v, ["t", "n"]); if (v.n < 1) throw new NeedError("Jumlah orang minimal 1."); return rows([["Per orang", rp(Math.ceil(v.t / v.n))]]); } },
      { label: "Tip / servis", hint: "Tip dihitung dari subtotal.", fields: [{ name: "t", label: "Subtotal" }, { name: "p", label: "Tip (%)" }, { name: "n", label: "Jumlah orang", value: 1 }],
        calc: (v) => { need(v, ["t", "p"]); const n = v.n && v.n > 0 ? v.n : 1; const tip = v.t * v.p / 100; const total = v.t + tip; return rows([["Tip", rp(tip)], ["Grand total", rp(total)], ["Per orang", rp(Math.ceil(total / n))]]); } },
      { label: "Harga setelah pajak", hint: "Harga + pajak persen. Default PPN 11%.", fields: [{ name: "h", label: "Harga" }, { name: "p", label: "Pajak (%)", value: 11 }],
        calc: (v) => { need(v, ["h", "p"]); return rows([["Pajak", rp(v.h * v.p / 100)], ["Total", rp(v.h * (1 + v.p / 100))]]); } },
      { label: "Patungan ongkir", hint: "Harga barang + ongkir dibagi rata.", fields: [{ name: "h", label: "Harga barang" }, { name: "o", label: "Ongkir" }, { name: "n", label: "Jumlah orang" }],
        calc: (v) => { need(v, ["h", "o", "n"]); if (v.n < 1) throw new NeedError("Jumlah orang minimal 1."); return rows([["Total", rp(v.h + v.o)], ["Per orang", rp(Math.ceil((v.h + v.o) / v.n))]]); } },
      { label: "Kembalian belanja", hint: "", fields: [{ name: "t", label: "Total belanja" }, { name: "b", label: "Uang dibayar" }],
        calc: (v) => { need(v, ["t", "b"]); if (v.b < v.t) return notice("Uang kurang " + rp(v.t - v.b) + "."); return rows([["Kembali", rp(v.b - v.t)]]); } },
      { label: "Biaya BBM", hint: "Biaya = jarak ÷ (km per liter) × harga per liter.", fields: [{ name: "j", label: "Jarak (km)" }, { name: "k", label: "Konsumsi (km/liter)" }, { name: "h", label: "Harga per liter" }],
        calc: (v) => { need(v, ["j", "k", "h"]); if (v.k <= 0) throw new NeedError("Konsumsi harus lebih dari 0."); const liter = v.j / v.k; return rows([["Liter dibutuhkan", fmt(liter, 2) + " L"], ["Biaya", rp(liter * v.h)]]); } },
      { label: "Biaya listrik", hint: "kWh = watt × jam ÷ 1000. Biaya = kWh × tarif per kWh.", fields: [{ name: "w", label: "Daya (watt)" }, { name: "j", label: "Lama pakai (jam)" }, { name: "h", label: "Tarif per kWh" }],
        calc: (v) => { need(v, ["w", "j", "h"]); const kwh = v.w * v.j / 1000; return rows([["Energi", fmt(kwh, 3) + " kWh"], ["Biaya", rp(kwh * v.h)]]); } },
      { label: "Skala peta", hint: "Jarak asli = jarak di peta × penyebut skala.", fields: [{ name: "cm", label: "Jarak di peta (cm)" }, { name: "s", label: "Penyebut skala (1 : …)" }],
        calc: (v) => { need(v, ["cm", "s"]); return rows([["Jarak asli", fmt(v.cm * v.s / 100000, 3) + " km"]]); } },
      { label: "Harga per satuan", hint: "", fields: [{ name: "h", label: "Harga total" }, { name: "j", label: "Jumlah" }],
        calc: (v) => { need(v, ["h", "j"]); if (v.j === 0) throw new NeedError("Jumlah tidak boleh nol."); return rows([["Harga per satuan", rp(v.h / v.j)]]); } },
      { label: "Estimasi ongkir", hint: "", fields: [{ name: "b", label: "Berat (kg)" }, { name: "t", label: "Tarif per kg" }],
        calc: (v) => { need(v, ["b", "t"]); return rows([["Estimasi ongkir", rp(v.b * v.t)]]); } },
      { label: "Resep: skala porsi", hint: "Bahan baru = bahan asli × porsi baru ÷ porsi asli.", fields: [{ name: "a", label: "Porsi asli" }, { name: "b", label: "Porsi baru" }, { name: "j", label: "Jumlah bahan" }],
        calc: (v) => { need(v, ["a", "b", "j"]); if (v.a === 0) throw new NeedError("Porsi asli tidak boleh nol."); return rows([["Jumlah baru", fmt(v.j * v.b / v.a, 2)]]); } },
      { label: "Kebutuhan cat", hint: "Liter dibulatkan ke atas.", fields: [{ name: "l", label: "Luas dinding (m²)" }, { name: "d", label: "Daya sebar (m²/liter)" }, { name: "h", label: "Harga per liter" }],
        calc: (v) => { need(v, ["l", "d", "h"]); if (v.d <= 0) throw new NeedError("Daya sebar harus lebih dari 0."); const liter = Math.ceil(v.l / v.d); return rows([["Liter dibutuhkan", String(liter) + " L"], ["Biaya", rp(liter * v.h)]]); } },
      { label: "Kebutuhan ubin", hint: "Jumlah ubin dibulatkan ke atas.", fields: [{ name: "l", label: "Luas lantai (m²)" }, { name: "u", label: "Ukuran ubin (cm, sisi)" }, { name: "h", label: "Harga per ubin" }],
        calc: (v) => { need(v, ["l", "u", "h"]); if (v.u <= 0) throw new NeedError("Ukuran ubin harus lebih dari 0."); const sisi = v.u / 100; const n = Math.ceil(v.l / (sisi * sisi)); return rows([["Jumlah ubin", String(n)], ["Biaya", rp(n * v.h)]]); } }
    ];
    host.innerHTML = head(tool) + `<div class="card card-pad mt-16 ub-bill"></div>`;
    selectCalc(host.querySelector(".ub-bill"), items);
    bindFav(host, tool.id);
    N.core.trackTool(tool.id, "utility");
  };

  /* ------------------------------ 8. Generator data palsu ------------------------------ */
  const FIRST = ["Andi", "Budi", "Citra", "Dewi", "Eka", "Fajar", "Gita", "Hadi", "Indah", "Joko", "Kartika", "Lestari", "Made", "Nadia", "Oka", "Putri", "Rizky", "Sari", "Tono", "Wulan"];
  const LAST = ["Pratama", "Saputra", "Wijaya", "Lestari", "Hidayat", "Nugroho", "Kusuma", "Setiawan", "Maharani", "Purnama", "Santoso", "Rahayu"];
  const pick = (arr) => arr[randInt(0, arr.length - 1)];
  function randInt(min, max) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return min + (buf[0] % (max - min + 1));
  }
  function genName() { return `${pick(FIRST)} ${pick(LAST)}`; }
  function genUsername(name) { return name.toLowerCase().replace(/\s+/g, ".") + randInt(10, 999); }
  function genEmail(name) { return name.toLowerCase().replace(/\s+/g, ".") + randInt(1, 99) + "@example.com"; }
  function genPhone() { return "08" + randInt(10, 99) + Array.from({ length: 8 }, () => randInt(0, 9)).join(""); }
  function genOtp(len) { return Array.from({ length: len }, () => randInt(0, 9)).join(""); }
  impl["fake-generator"] = (host, tool) => {
    const kinds = {
      nama: { label: "Nama", make: () => genName() },
      username: { label: "Username", make: () => genUsername(genName()) },
      email: { label: "Email (domain example.com)", make: () => genEmail(genName()) },
      telepon: { label: "Nomor telepon (contoh)", make: () => genPhone() },
      identitas: { label: "Profil lengkap", make: () => { const n = genName(); return `Nama: ${n}\nUsername: ${genUsername(n)}\nEmail: ${genEmail(n)}\nTelepon: ${genPhone()}`; } },
      otp: { label: "Kode OTP 6 digit", make: () => genOtp(6) }
    };
    host.innerHTML = head(tool) + `<div class="card card-pad mt-16">
      <div class="ub-grid2">
        <label class="ub-field"><span>Jenis data</span><select class="ub-select" name="k">${Object.entries(kinds).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join("")}</select></label>
        <label class="ub-field"><span>Jumlah</span><input name="n" inputmode="numeric" value="5" autocomplete="off"></label>
      </div>
      <div class="row mt-12"><button class="btn btn-primary" type="button" data-gen>Buat</button></div>
      <div class="ub-out mt-16" aria-live="polite"></div>
      <p class="hint mt-12">Data ini acak dan hanya untuk pengujian. Email memakai domain example.com yang memang disediakan untuk contoh.</p></div>`;
    const out = host.querySelector(".ub-out");
    host.querySelector("[data-gen]").addEventListener("click", () => {
      const kind = kinds[host.querySelector('[name="k"]').value];
      const n = Math.min(50, Math.max(1, Math.floor(num(host.querySelector('[name="n"]').value) || 1)));
      const items = Array.from({ length: n }, () => kind.make());
      const text = items.join("\n");
      out.innerHTML = `<div class="ub-result"><pre class="ub-pre">${esc(text)}</pre><div class="row mt-8">${copyBtn(text)}</div></div>`;
    });
    bindFav(host, tool.id); bindCopy(host);
    N.core.trackTool(tool.id, "utility");
  };

  /* ------------------------------ 9. Fun ------------------------------ */
  const EIGHT_BALL = ["Ya, pasti.", "Sangat mungkin.", "Tanda-tanda mengarah ke ya.", "Coba tanya lagi nanti.", "Sulit dikatakan sekarang.", "Jangan terlalu berharap.", "Tidak.", "Sepertinya tidak.", "Pasti tidak!", "Tentu saja!"];
  impl["fun-lab"] = tabbed("fun-lab", [
    { key: "dadu", label: "Dadu", render: (el) => {
        el.innerHTML = `<div class="ub-grid2"><label class="ub-field"><span>Jumlah sisi</span><input name="s" inputmode="numeric" value="6"></label><label class="ub-field"><span>Jumlah dadu</span><input name="c" inputmode="numeric" value="1"></label></div><div class="row mt-12"><button class="btn btn-primary" type="button" data-roll>Lempar</button></div><div class="ub-out mt-16" aria-live="polite"></div>`;
        el.querySelector("[data-roll]").addEventListener("click", () => {
          const s = Math.floor(num(el.querySelector('[name="s"]').value) || 0), c = Math.floor(num(el.querySelector('[name="c"]').value) || 0);
          if (s < 2 || s > 1000 || c < 1 || c > 50) { el.querySelector(".ub-out").innerHTML = notice("Sisi 2–1000, jumlah dadu 1–50."); return; }
          const rolls = Array.from({ length: c }, () => randInt(1, s));
          const sum = rolls.reduce((a, b) => a + b, 0);
          el.querySelector(".ub-out").innerHTML = rows([["Hasil", rolls.join(", ")], ["Total", String(sum)]]);
        });
      } },
    { key: "koin", label: "Koin", render: (el) => {
        el.innerHTML = `<div class="row"><button class="btn btn-primary" type="button" data-flip>Lempar koin</button></div><div class="ub-big mt-16"><strong class="ub-coin" data-face>?</strong></div>`;
        el.querySelector("[data-flip]").addEventListener("click", () => { el.querySelector("[data-face]").textContent = randInt(0, 1) ? "Gambar" : "Angka"; });
      } },
    { key: "8ball", label: "Bola ajaib", render: (el) => {
        el.innerHTML = `<form class="ub-form" novalidate><label class="ub-field"><span>Pertanyaanmu</span><input name="q" autocomplete="off" maxlength="200"></label><button class="btn btn-primary" type="submit">Tanya</button></form><div class="ub-out mt-16" aria-live="polite"></div>`;
        el.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); el.querySelector(".ub-out").innerHTML = `<div class="ub-big"><strong>${esc(EIGHT_BALL[randInt(0, EIGHT_BALL.length - 1)])}</strong></div>`; });
      } },
    { key: "rate", label: "Rate", render: (el) => {
        el.innerHTML = `<form class="ub-form" novalidate><label class="ub-field"><span>Apa yang ingin dinilai?</span><input name="q" autocomplete="off" maxlength="120" placeholder="mis. kopi ini"></label><button class="btn btn-primary" type="submit">Nilai</button></form><div class="ub-out mt-16" aria-live="polite"></div>`;
        el.querySelector("form").addEventListener("submit", (e) => {
          e.preventDefault();
          const q = e.target.q.value.trim() || "ini";
          el.querySelector(".ub-out").innerHTML = `<div class="ub-big"><span>${esc(q)}</span><strong>${randInt(0, 100)}/100</strong></div>`;
        });
      } }
  ]);

  /* ------------------------------ 10. Kuis & game ------------------------------ */
  const TRIVIA = {
    geografi: [
      ["Apa ibu kota Australia?", ["Sydney", "Melbourne", "Canberra", "Perth"], 2],
      ["Gunung tertinggi di dunia di atas permukaan laut?", ["K2", "Everest", "Kilimanjaro", "Fuji"], 1],
      ["Benua terluas di dunia?", ["Afrika", "Asia", "Eropa", "Amerika Utara"], 1],
      ["Apa ibu kota Jepang?", ["Osaka", "Kyoto", "Tokyo", "Nagoya"], 2],
      ["Samudra terluas di dunia?", ["Atlantik", "Hindia", "Arktik", "Pasifik"], 3]
    ],
    sejarah: [
      ["Proklamasi kemerdekaan Indonesia dibacakan pada tahun?", ["1942", "1945", "1949", "1950"], 1],
      ["Tembok Berlin runtuh pada tahun?", ["1961", "1979", "1989", "1991"], 2],
      ["Presiden pertama Republik Indonesia?", ["Soeharto", "Soekarno", "Habibie", "Megawati"], 1],
      ["Penemu mesin cetak modern di Eropa?", ["Galileo", "Johannes Gutenberg", "Isaac Newton", "Leonardo da Vinci"], 1],
      ["Kaisar pertama Kekaisaran Romawi?", ["Augustus", "Nero", "Caligula", "Julius Caesar"], 0]
    ],
    sains: [
      ["Rumus kimia air?", ["CO2", "H2O", "NaCl", "O2"], 1],
      ["Planet terdekat dengan Matahari?", ["Venus", "Mars", "Merkurius", "Bumi"], 2],
      ["Satuan untuk gaya?", ["Joule", "Watt", "Newton", "Pascal"], 2],
      ["Organel tempat fotosintesis terjadi?", ["Mitokondria", "Kloroplas", "Nukleus", "Ribosom"], 1],
      ["Gas paling banyak di atmosfer bumi?", ["Oksigen", "Karbon dioksida", "Nitrogen", "Hidrogen"], 2]
    ],
    olahraga: [
      ["Piala Dunia sepak bola diadakan setiap berapa tahun?", ["2", "3", "4", "5"], 2],
      ["Jumlah pemain satu tim sepak bola di lapangan?", ["9", "10", "11", "12"], 2],
      ["Olahraga yang memakai shuttlecock?", ["Tenis", "Bulu tangkis", "Voli", "Squash"], 1],
      ["Tinggi ring basket standar (meter)?", ["2,50", "3,05", "3,50", "4,00"], 1]
    ]
  };
  const CAPITALS = [["Jakarta", "Indonesia"], ["Tokyo", "Jepang"], ["Canberra", "Australia"], ["Ottawa", "Kanada"], ["Nairobi", "Kenya"], ["Brasília", "Brasil"], ["Hanoi", "Vietnam"], ["Bangkok", "Thailand"], ["Kuala Lumpur", "Malaysia"], ["Manila", "Filipina"]];
  const TRUE_FALSE = [
    ["Bumi mengelilingi Matahari.", true], ["Air mendidih pada 50°C di permukaan laut.", false], ["Cahaya bergerak lebih cepat daripada suara.", true],
    ["Paus termasuk ikan.", false], ["Petir biasanya terlihat sebelum terdengar.", true], ["Tubuh manusia dewasa memiliki 206 tulang.", true]
  ];

  impl["quiz-lab"] = tabbed("quiz-lab", [
    { key: "trivia", label: "Trivia", render: (el) => {
        const cats = Object.keys(TRIVIA);
        el.innerHTML = `<label class="ub-field"><span>Kategori</span><select class="ub-select" name="c">${cats.map((c) => `<option value="${c}">${c[0].toUpperCase() + c.slice(1)}</option>`).join("")}</select></label><div class="ub-quiz mt-16"></div><div class="ub-score mt-12" aria-live="polite"></div>`;
        let score = 0, idx = 0, list = [];
        const quiz = el.querySelector(".ub-quiz");
        const start = () => { list = TRIVIA[el.querySelector('[name="c"]').value].slice().sort(() => Math.random() - 0.5); idx = 0; score = 0; ask(); };
        const ask = () => {
          el.querySelector(".ub-score").textContent = `Skor: ${score}`;
          if (idx >= list.length) { quiz.innerHTML = `<div class="ub-big"><strong>Selesai! Skor akhir ${score}/${list.length}</strong></div><button class="btn btn-primary mt-12" type="button" data-again>Main lagi</button>`; return; }
          const [q, opts, ans] = list[idx];
          quiz.innerHTML = `<p class="ub-q">${esc(q)}</p><div class="ub-opts">${opts.map((o, i) => `<button class="ub-opt" type="button" data-i="${i}">${esc(o)}</button>`).join("")}</div>`;
          quiz.onclick = (e) => {
            if (e.target.closest("[data-again]")) { start(); return; }
            const b = e.target.closest("[data-i]");
            if (!b) return;
            const correct = Number(b.dataset.i) === ans;
            if (correct) score++;
            quiz.querySelectorAll("[data-i]").forEach((x) => { x.disabled = true; if (Number(x.dataset.i) === ans) x.classList.add("ok"); });
            if (!correct) b.classList.add("bad");
            setTimeout(() => { idx++; ask(); }, 900);
          };
        };
        el.querySelector('[name="c"]').addEventListener("change", start);
        start();
      } },
    { key: "negara", label: "Tebak negara", render: (el) => {
        let cur = null;
        const next = () => {
          cur = CAPITALS[randInt(0, CAPITALS.length - 1)];
          const others = CAPITALS.filter((c) => c !== cur).map((c) => c[1]).sort(() => Math.random() - 0.5).slice(0, 3);
          const opts = [cur[1], ...others].sort(() => Math.random() - 0.5);
          el.innerHTML = `<p class="ub-q">Ibu kota <strong>${esc(cur[0])}</strong> adalah negara mana?</p><div class="ub-opts">${opts.map((o) => `<button class="ub-opt" type="button" data-o="${esc(o)}">${esc(o)}</button>`).join("")}</div><div class="ub-out mt-12" aria-live="polite"></div>`;
        };
        el.addEventListener("click", (e) => {
          const b = e.target.closest("[data-o]");
          if (!b || !cur) return;
          const ok = b.dataset.o === cur[1];
          el.querySelector(".ub-out").innerHTML = ok ? '<p class="ok-text">Benar!</p>' : `<p class="bad-text">Salah. Jawabannya ${esc(cur[1])}.</p>`;
          setTimeout(next, 1000);
        });
        next();
      } },
    { key: "bs", label: "Benar / salah", render: (el) => {
        let cur = null;
        const next = () => {
          cur = TRUE_FALSE[randInt(0, TRUE_FALSE.length - 1)];
          el.innerHTML = `<p class="ub-q">${esc(cur[0])}</p><div class="ub-opts"><button class="ub-opt" type="button" data-v="1">Benar</button><button class="ub-opt" type="button" data-v="0">Salah</button></div><div class="ub-out mt-12" aria-live="polite"></div>`;
        };
        el.addEventListener("click", (e) => {
          const b = e.target.closest("[data-v]");
          if (!b || !cur) return;
          const ok = (b.dataset.v === "1") === cur[1];
          el.querySelector(".ub-out").innerHTML = ok ? '<p class="ok-text">Tepat!</p>' : '<p class="bad-text">Kurang tepat.</p>';
          setTimeout(next, 900);
        });
        next();
      } },
    { key: "matematika", label: "Kuis hitung", render: (el) => {
        let answer = 0, score = 0, total = 0;
        const next = () => {
          const a = randInt(2, 20), b = randInt(2, 20);
          const ops = ["+", "−", "×"];
          const op = ops[randInt(0, 2)];
          answer = op === "+" ? a + b : op === "−" ? a - b : a * b;
          el.innerHTML = `<p class="ub-q">${a} ${op} ${b} = ?</p><form class="ub-form" novalidate><label class="ub-field"><span>Jawabanmu</span><input name="x" inputmode="numeric" autocomplete="off"></label><button class="btn btn-primary" type="submit">Jawab</button></form><p class="hint mt-12" aria-live="polite">Skor: ${score}/${total}</p><div class="ub-out mt-8"></div>`;
          el.querySelector("form").addEventListener("submit", (e) => {
            e.preventDefault();
            const x = num(e.target.x.value);
            if (x == null) return;
            total++;
            if (x === answer) score++;
            el.querySelector(".ub-out").innerHTML = x === answer ? '<p class="ok-text">Benar!</p>' : `<p class="bad-text">Salah, jawabannya ${answer}.</p>`;
            setTimeout(next, 900);
          });
          el.querySelector('[name="x"]').focus();
        };
        next();
      } },
    { key: "tebakangka", label: "Tebak angka 1–100", render: (el) => {
        let target = 0, tries = 0;
        const reset = () => { target = randInt(1, 100); tries = 0; el.innerHTML = `<form class="ub-form" novalidate><label class="ub-field"><span>Tebakanmu (1–100)</span><input name="g" inputmode="numeric" autocomplete="off"></label><button class="btn btn-primary" type="submit">Tebak</button></form><div class="ub-out mt-16" aria-live="polite"></div>`; };
        reset();
        el.addEventListener("submit", (e) => {
          e.preventDefault();
          const g = Math.floor(num(e.target.g.value));
          const out = el.querySelector(".ub-out");
          if (!(g >= 1 && g <= 100)) { out.innerHTML = notice("Masukkan angka 1 sampai 100."); return; }
          tries++;
          if (g === target) { out.innerHTML = `<div class="ub-big"><strong>Tepat! Dalam ${tries} kali tebakan.</strong></div><button class="btn mt-12" type="button" data-again>Main lagi</button>`; }
          else out.innerHTML = `<p class="hint">${g < target ? "Lebih besar" : "Lebih kecil"} dari ${g}. Percobaan: ${tries}.</p>`;
        });
        el.addEventListener("click", (e) => { if (e.target.closest("[data-again]")) reset(); });
      } }
  ]);

  /* ------------------------------ 11. Penghitung (counter) ------------------------------ */
  impl["counter-lab"] = (host, tool) => {
    let counters = store("counters", []);
    host.innerHTML = head(tool) + `<div class="card card-pad mt-16">
      <form class="ub-form ub-inline" novalidate><label class="ub-field"><span>Nama penghitung</span><input name="n" maxlength="40" autocomplete="off"></label><button class="btn btn-primary" type="submit">Tambah</button></form>
      <div class="ub-counters mt-16"></div></div>`;
    const list = host.querySelector(".ub-counters");
    const save = () => saveStore("counters", counters);
    const draw = () => {
      list.innerHTML = counters.length ? counters.map((c, i) => `<div class="ub-counter">
          <div><strong>${esc(c.name)}</strong><span class="hint"> · ${c.value}</span></div>
          <div class="row"><button class="btn btn-sm" type="button" data-act="minus" data-i="${i}">−</button><button class="btn btn-sm btn-primary" type="button" data-act="plus" data-i="${i}">+</button><button class="btn btn-sm btn-ghost" type="button" data-act="reset" data-i="${i}">Reset</button><button class="btn btn-sm btn-ghost" type="button" data-act="del" data-i="${i}">Hapus</button></div></div>`).join("")
        : '<p class="hint">Belum ada penghitung. Tambahkan satu di atas.</p>';
    };
    host.querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = e.target.n.value.trim();
      if (!name) return;
      counters.push({ name, value: 0 });
      e.target.n.value = "";
      save(); draw();
    });
    list.addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      const i = Number(b.dataset.i), c = counters[i];
      if (!c) return;
      if (b.dataset.act === "plus") c.value++;
      if (b.dataset.act === "minus") c.value--;
      if (b.dataset.act === "reset") c.value = 0;
      if (b.dataset.act === "del") counters.splice(i, 1);
      save(); draw();
    });
    bindFav(host, tool.id);
    draw();
    N.core.trackTool(tool.id, "utility");
  };

  /* ------------------------------ 12. Pelacak kebiasaan ------------------------------ */
  impl["habit-tracker"] = (host, tool) => {
    const today = dayKey(new Date());
    let habits = store("habits", []);
    host.innerHTML = head(tool) + `<div class="card card-pad mt-16">
      <form class="ub-form ub-inline" novalidate><label class="ub-field"><span>Kebiasaan baru</span><input name="h" maxlength="60" autocomplete="off" placeholder="mis. minum air 8 gelas"></label><button class="btn btn-primary" type="submit">Tambah</button></form>
      <p class="hint mt-12">Hari ini: ${esc(today)}</p><div class="ub-habits mt-12"></div></div>`;
    const list = host.querySelector(".ub-habits");
    const save = () => saveStore("habits", habits);
    const streak = (h) => {
      let s = 0; const d = new Date();
      for (;;) {
        const key = dayKey(d);
        if (!h.done.includes(key)) break;
        s++; d.setDate(d.getDate() - 1);
      }
      return s;
    };
    const draw = () => {
      list.innerHTML = habits.length ? habits.map((h, i) => {
        const done = h.done.includes(today);
        return `<div class="ub-counter"><div><strong>${esc(h.name)}</strong><span class="hint"> · streak ${streak(h)} hari</span></div>
          <div class="row"><button class="btn btn-sm ${done ? "btn-primary" : ""}" type="button" data-act="toggle" data-i="${i}">${done ? "Selesai ✓" : "Tandai selesai"}</button><button class="btn btn-sm btn-ghost" type="button" data-act="del" data-i="${i}">Hapus</button></div></div>`;
      }).join("") : '<p class="hint">Belum ada kebiasaan.</p>';
    };
    host.querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = e.target.h.value.trim();
      if (!name) return;
      habits.push({ name, done: [] });
      e.target.h.value = "";
      save(); draw();
    });
    list.addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      const i = Number(b.dataset.i), h = habits[i];
      if (!h) return;
      if (b.dataset.act === "toggle") {
        h.done = h.done.includes(today) ? h.done.filter((d) => d !== today) : [...h.done, today].slice(-400);
      }
      if (b.dataset.act === "del") habits.splice(i, 1);
      save(); draw();
    });
    bindFav(host, tool.id);
    draw();
    N.core.trackTool(tool.id, "utility");
  };

  /* ------------------------------ 13. Bookmark ------------------------------ */
  impl["bookmark-manager"] = (host, tool) => {
    let marks = store("bookmarks", []);
    host.innerHTML = head(tool) + `<div class="card card-pad mt-16">
      <form class="ub-form" novalidate>
        <div class="ub-grid2"><label class="ub-field"><span>Judul</span><input name="t" maxlength="80" autocomplete="off"></label><label class="ub-field"><span>Tautan (https://)</span><input name="u" maxlength="500" autocomplete="off" placeholder="https://"></label></div>
        <button class="btn btn-primary mt-12" type="submit">Simpan bookmark</button></form>
      <div class="ub-list mt-16"></div>
      <div class="row mt-12"><button class="btn btn-sm btn-ghost" type="button" data-clear>Hapus semua</button></div></div>`;
    const list = host.querySelector(".ub-list");
    const safeHttp = (u) => { try { const x = new URL(u); return x.protocol === "https:" || x.protocol === "http:" ? x.href : null; } catch (e) { return null; } };
    const draw = () => {
      list.innerHTML = marks.length ? marks.map((m, i) => `<div class="ub-counter"><div class="ub-trunc"><strong>${esc(m.t || m.u)}</strong><span class="hint ub-trunc">${esc(m.u)}</span></div><div class="row"><a class="btn btn-sm" href="${esc(m.u)}" target="_blank" rel="noopener noreferrer">Buka</a><button class="btn btn-sm btn-ghost" type="button" data-del="${i}">Hapus</button></div></div>`).join("")
        : '<p class="hint">Belum ada bookmark.</p>';
    };
    host.querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      const u = safeHttp(e.target.u.value.trim());
      if (!u) { N.core.toast("Tautan harus diawali https:// atau http://", "bad"); return; }
      marks.unshift({ t: e.target.t.value.trim(), u });
      marks = marks.slice(0, 200);
      e.target.t.value = ""; e.target.u.value = "";
      saveStore("bookmarks", marks); draw();
    });
    list.addEventListener("click", (e) => {
      const b = e.target.closest("[data-del]");
      if (!b) return;
      marks.splice(Number(b.dataset.del), 1);
      saveStore("bookmarks", marks); draw();
    });
    host.querySelector("[data-clear]").addEventListener("click", () => {
      if (!marks.length || !window.confirm("Hapus semua bookmark?")) return;
      marks = []; saveStore("bookmarks", marks); draw();
    });
    bindFav(host, tool.id);
    draw();
    N.core.trackTool(tool.id, "utility");
  };

  /* ------------------------------ 14. Gudang / stok ------------------------------ */
  impl["stock-manager"] = (host, tool) => {
    let items = store("stock", []);
    host.innerHTML = head(tool) + `<div class="card card-pad mt-16">
      <form class="ub-form ub-inline" novalidate><label class="ub-field"><span>Nama barang</span><input name="n" maxlength="60" autocomplete="off"></label><label class="ub-field"><span>Stok awal</span><input name="q" inputmode="numeric" value="0" autocomplete="off"></label><button class="btn btn-primary" type="submit">Tambah</button></form>
      <div class="ub-list mt-16"></div></div>`;
    const list = host.querySelector(".ub-list");
    const draw = () => {
      list.innerHTML = items.length ? items.map((it, i) => `<div class="ub-counter"><div><strong>${esc(it.name)}</strong><span class="hint"> · stok ${it.qty}</span></div>
        <div class="row"><button class="btn btn-sm" type="button" data-act="minus" data-i="${i}">−1</button><button class="btn btn-sm btn-primary" type="button" data-act="plus" data-i="${i}">+1</button><button class="btn btn-sm btn-ghost" type="button" data-act="del" data-i="${i}">Hapus</button></div></div>`).join("")
        : '<p class="hint">Belum ada barang di gudang.</p>';
    };
    host.querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = e.target.n.value.trim();
      const qty = Math.max(0, Math.floor(num(e.target.q.value) || 0));
      if (!name) return;
      items.push({ name, qty });
      e.target.n.value = ""; e.target.q.value = "0";
      saveStore("stock", items); draw();
    });
    list.addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      const i = Number(b.dataset.i), it = items[i];
      if (!it) return;
      if (b.dataset.act === "plus") it.qty++;
      if (b.dataset.act === "minus") it.qty = Math.max(0, it.qty - 1);
      if (b.dataset.act === "del") items.splice(i, 1);
      saveStore("stock", items); draw();
    });
    bindFav(host, tool.id);
    draw();
    N.core.trackTool(tool.id, "utility");
  };

  /* ------------------------------ 15. Agenda / acara ------------------------------ */
  impl["agenda-lab"] = (host, tool) => {
    let events = store("agenda", []);
    host.innerHTML = head(tool) + `<div class="card card-pad mt-16">
      <form class="ub-form" novalidate>
        <div class="ub-grid2"><label class="ub-field"><span>Judul acara</span><input name="t" maxlength="80" autocomplete="off"></label><label class="ub-field"><span>Tanggal</span><input name="d" placeholder="2026-12-31" autocomplete="off"></label></div>
        <button class="btn btn-primary mt-12" type="submit">Tambah acara</button></form>
      <div class="ub-list mt-16"></div></div>`;
    const list = host.querySelector(".ub-list");
    const draw = () => {
      const sorted = events.slice().sort((a, b) => a.d.localeCompare(b.d));
      list.innerHTML = sorted.length ? sorted.map((ev) => {
        const i = events.indexOf(ev);
        const d = parseDate(ev.d);
        const diff = d ? Math.ceil((d - new Date().setHours(0, 0, 0, 0)) / 86400000) : null;
        const status = diff == null ? "" : diff < 0 ? "Sudah lewat" : diff === 0 ? "Hari ini" : `${diff} hari lagi`;
        return `<div class="ub-counter"><div><strong>${esc(ev.t)}</strong><span class="hint"> · ${esc(ev.d)} · ${esc(status)}</span></div><button class="btn btn-sm btn-ghost" type="button" data-del="${i}">Hapus</button></div>`;
      }).join("") : '<p class="hint">Belum ada acara.</p>';
    };
    host.querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      const t = e.target.t.value.trim(), d = e.target.d.value.trim();
      if (!t || !parseDate(d)) { N.core.toast("Isi judul dan tanggal YYYY-MM-DD.", "bad"); return; }
      events.push({ t, d });
      e.target.t.value = ""; e.target.d.value = "";
      saveStore("agenda", events); draw();
    });
    list.addEventListener("click", (e) => {
      const b = e.target.closest("[data-del]");
      if (!b) return;
      events.splice(Number(b.dataset.del), 1);
      saveStore("agenda", events); draw();
    });
    bindFav(host, tool.id);
    draw();
    N.core.trackTool(tool.id, "utility");
  };

  /* ------------------------------ 16. Build APK: Flutter & Web to APK ------------------------------ */
  const BLOB_CLIENT_URL = "https://cdn.jsdelivr.net/npm/@vercel/blob@2.8.0/client/+esm";
  const apkBuilder = (mode, title) => (host, tool) => {
    const KEY = "nexus.apk.secret";
    let secret = "";
    try { secret = window.sessionStorage.getItem(KEY) || ""; } catch (e) { /* opsional */ }
    const isFlutter = mode === "flutter";
    host.innerHTML = head(tool) + `<div class="card card-pad mt-16">
      <p class="hint">${isFlutter
        ? "Upload ZIP project Flutter (wajib ada pubspec.yaml dan folder android/). Package ID dan nama APK dibaca otomatis dari ZIP."
        : "Upload ZIP website (wajib ada index.html di dalamnya). Website dibungkus jadi APK Android WebView. Nama dan package ID dibuat otomatis dari judul halaman."}
        ZIP bisa sampai 2 GB.</p>
      <form class="ub-form mt-12" novalidate>
        <label class="ub-field"><span>File ZIP</span><input name="zip" type="file" accept=".zip,application/zip" required></label>
        <label class="ub-field"><span>Kode akses build</span><input name="secret" type="password" maxlength="200" autocomplete="off" value="${esc(secret)}"></label>
        <div class="row"><button class="btn btn-primary" type="submit">${esc(title)}</button><button class="btn" type="button" data-status>Cek status</button></div>
        <div class="ub-progress hint" hidden></div>
      </form>
      <div class="ub-out mt-16" aria-live="polite"></div></div>`;
    const out = host.querySelector(".ub-out");
    const form = host.querySelector("form");
    const progress = host.querySelector(".ub-progress");
    const req = (path, init) => fetch(path, init).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Permintaan gagal (" + r.status + ").");
      return data;
    });
    const showRuns = (runs) => {
      if (!runs.length) { out.innerHTML = '<p class="hint">Belum ada build.</p>'; return; }
      out.innerHTML = runs.map((r) => {
        const state = r.status !== "completed" ? r.status : (r.conclusion || "selesai");
        return `<div class="ub-counter"><div><strong>${esc(r.title || "Build APK")}</strong><span class="hint"> · ${esc(state)} · ${esc(new Date(r.created_at).toLocaleString("id-ID"))}</span></div><a class="btn btn-sm" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">Buka log &amp; APK</a></div>`;
      }).join("");
    };
    const checkStatus = () => {
      const s = form.elements.secret.value;
      out.innerHTML = '<p class="hint">Mengambil status…</p>';
      req("/api/build-status", { headers: { "x-build-secret": s } })
        .then((d) => showRuns(d.runs || []))
        .catch((err) => { out.innerHTML = notice(err.message); });
    };
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const file = form.elements.zip.files[0];
      const s = form.elements.secret.value.trim();
      if (!file) { out.innerHTML = notice("Pilih file ZIP dulu."); return; }
      if (!/\.zip$/i.test(file.name)) { out.innerHTML = notice("File harus berformat .zip."); return; }
      if (file.size > 2147483648) { out.innerHTML = notice("ZIP melebihi batas 2 GB."); return; }
      if (!s) { out.innerHTML = notice("Masukkan kode akses build."); return; }
      try { window.sessionStorage.setItem(KEY, s); } catch (err) { /* opsional */ }
      const submit = form.querySelector("button[type=submit]");
      submit.disabled = true;
      progress.hidden = false;
      progress.textContent = "Mengunggah ZIP ke penyimpanan…";
      out.innerHTML = "";
      try {
        const { upload } = await import(BLOB_CLIENT_URL);
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/blob-upload",
          clientPayload: s,
          multipart: true,
          onUploadProgress: (p) => { progress.textContent = "Mengunggah ZIP… " + Math.round(p.percentage || 0) + "%"; },
        });
        progress.textContent = "Upload selesai. Mengirim permintaan build…";
        const d = await req("/api/build-apk", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-build-secret": s },
          body: JSON.stringify({ mode, blob_url: blob.url }),
        });
        out.innerHTML = `<div class="ub-big"><strong>${esc(d.message)}</strong></div><p class="hint mt-12"><a href="${esc(d.runsUrl)}" target="_blank" rel="noopener noreferrer">Lihat semua run di GitHub</a></p>`;
        setTimeout(checkStatus, 4000);
      } catch (err) {
        out.innerHTML = notice(err.message || "Upload atau build gagal.");
      } finally {
        submit.disabled = false;
        progress.hidden = true;
      }
    });
    host.querySelector("[data-status]").addEventListener("click", checkStatus);
    bindFav(host, tool.id);
    N.core.trackTool(tool.id, "utility");
  };
  impl["apk-flutter"] = apkBuilder("flutter", "Build APK Flutter");
  impl["web-to-apk"] = apkBuilder("web", "Build APK dari Website");

  /* ------------------------------ dispatcher ------------------------------ */
  N.toolkit = { impl, ids: Object.keys(impl) };
})(window.Nexus = window.Nexus || {});
