/* NEXUS TOOLBOX — local QR Code generator (byte mode, ECC L/M, versions 1-10) */
(function (N) {
  "use strict";

  const ico = (name, cls) => (N.icons ? N.icons.svg(name, cls) : "");
  const { escapeHtml: esc } = N.core;

  const TOTAL_CODEWORDS = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
  const ECC = {
    L: [[0, 7, 1], [0, 10, 1], [0, 15, 1], [0, 20, 1], [0, 26, 1], [0, 18, 2], [0, 20, 2], [0, 24, 2], [0, 30, 2], [0, 18, 4]],
    M: [[0, 10, 1], [0, 16, 1], [0, 26, 1], [0, 18, 2], [0, 24, 2], [0, 16, 4], [0, 18, 4], [0, 22, 4], [0, 22, 5], [0, 26, 5]]
  };
  const ALIGN = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
    7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
  };

  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function initGF() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();
  const gfMul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];

  function rsGenerator(degree) {
    let poly = [1];
    for (let i = 0; i < degree; i++) {
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gfMul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly;
  }
  function rsRemainder(data, degree) {
    const gen = rsGenerator(degree);
    const rem = new Uint8Array(degree);
    data.forEach((b) => {
      const factor = b ^ rem[0];
      rem.copyWithin(0, 1);
      rem[degree - 1] = 0;
      for (let i = 0; i < degree; i++) rem[i] ^= gfMul(gen[i + 1], factor);
    });
    return Array.from(rem);
  }

  class Bits {
    constructor() { this.arr = []; }
    push(value, length) { for (let i = length - 1; i >= 0; i--) this.arr.push((value >>> i) & 1); }
    bytes() {
      const out = [];
      while (this.arr.length % 8) this.arr.push(0);
      for (let i = 0; i < this.arr.length; i += 8) {
        let b = 0;
        for (let j = 0; j < 8; j++) b = (b << 1) | this.arr[i + j];
        out.push(b);
      }
      return out;
    }
  }

  function makeCodewords(text, ecl) {
    const bytes = Array.from(new TextEncoder().encode(text));
    if (!bytes.length) throw new Error("Masukkan teks atau URL untuk dibuatkan QR.");
    for (let version = 1; version <= 10; version++) {
      const [, eccPerBlock, blocks] = ECC[ecl][version - 1];
      const total = TOTAL_CODEWORDS[version];
      const dataCapacity = total - eccPerBlock * blocks;
      const countBits = version <= 9 ? 8 : 16;
      const overheadBits = 4 + countBits;
      if (bytes.length + Math.ceil(overheadBits / 8) > dataCapacity) continue;
      const bits = new Bits();
      bits.push(4, 4);
      bits.push(bytes.length, countBits);
      bytes.forEach((b) => bits.push(b, 8));
      const capacityBits = dataCapacity * 8;
      for (let i = 0; i < 4 && bits.arr.length < capacityBits; i++) bits.push(0, 1);
      while (bits.arr.length % 8) bits.push(0, 1);
      const data = bits.bytes();
      let pad = 0xec;
      while (data.length < dataCapacity) { data.push(pad); pad = pad === 0xec ? 0x11 : 0xec; }

      const shortBlocks = blocks - (data.length % blocks);
      const shortLen = Math.floor(data.length / blocks);
      const longLen = shortLen + 1;
      const dataBlocks = [];
      let pos = 0;
      for (let b = 0; b < blocks; b++) {
        const len = b < shortBlocks ? shortLen : longLen;
        dataBlocks.push(data.slice(pos, pos + len));
        pos += len;
      }
      const eccBlocks = dataBlocks.map((d) => rsRemainder(d, eccPerBlock));
      const interleaved = [];
      for (let i = 0; i < longLen; i++) {
        dataBlocks.forEach((d) => { if (i < d.length) interleaved.push(d[i]); });
      }
      for (let i = 0; i < eccPerBlock; i++) eccBlocks.forEach((e) => interleaved.push(e[i]));
      return { version, ecl, codewords: interleaved, size: 17 + 4 * version };
    }
    throw new Error("Teks terlalu panjang untuk QR versi ≤ 10 (maks ~270 byte). Persingkat teks.");
  }

  function bchFormat(data) {
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    return ((data << 10) | rem) ^ 0x5412;
  }
  function bchVersion(version) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    return (version << 12) | rem;
  }
  const eclBits = { L: 1, M: 0 };

  function maskFn(mask, r, c) {
    switch (mask) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
      case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
      default: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
    }
  }

  function penalty(m, reserved) {
    let score = 0;
    const n = m.length;
    const line = (arr) => {
      let run = 1;
      for (let i = 1; i < arr.length; i++) {
        if (arr[i] === arr[i - 1]) run++;
        else { if (run >= 5) score += 3 + run - 5; run = 1; }
      }
      if (run >= 5) score += 3 + run - 5;
      for (let i = 0; i < arr.length - 10; i++) {
        const a = arr.slice(i, i + 11).join("");
        if (a === "10111010000" || a === "00001011101") score += 40;
      }
    };
    for (let r = 0; r < n; r++) line(m[r]);
    for (let c = 0; c < n; c++) line(m.map((row) => row[c]));
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
      const v = m[r][c];
      if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1] && !reserved[r][c] && !reserved[r][c + 1] && !reserved[r + 1][c] && !reserved[r + 1][c + 1]) score += 3;
    }
    let dark = 0;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) dark += m[r][c];
    score += 10 * Math.max(0, Math.ceil(Math.abs(dark * 20 - n * n * 10) / (n * n)) - 1);
    return score;
  }

  function buildMatrix(text, ecl) {
    const { version, codewords, size } = makeCodewords(text, ecl);
    const m = Array.from({ length: size }, () => new Array(size).fill(0));
    const reserved = Array.from({ length: size }, () => new Array(size).fill(false));
    const put = (r, c, dark) => {
      if (r < 0 || c < 0 || r >= size || c >= size) return;
      m[r][c] = dark ? 1 : 0;
      reserved[r][c] = true;
    };
    [[0, 0], [0, size - 7], [size - 7, 0]].forEach(([rr, cc]) => {
      for (let dr = -1; dr <= 7; dr++) for (let dc = -1; dc <= 7; dc++) {
        const r = rr + dr, c = cc + dc;
        if (r < 0 || c < 0 || r >= size || c >= size) continue;
        const inside = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        put(r, c, inside && (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4)));
      }
    });
    const centers = ALIGN[version] || [];
    centers.forEach((r) => centers.forEach((c) => {
      if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) return;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
        put(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
      }
    }));
    for (let i = 0; i < size; i++) {
      if (!reserved[6][i]) put(6, i, i % 2 === 0);
      if (!reserved[i][6]) put(i, 6, i % 2 === 0);
    }
    for (let i = 0; i <= 5; i++) { reserved[8][i] = true; reserved[i][8] = true; }
    reserved[8][7] = true; reserved[7][8] = true; reserved[8][8] = true;
    for (let i = 9; i <= 14; i++) { reserved[14 - i][8] = true; reserved[8][size - 15 + i] = true; }
    for (let i = 0; i < 8; i++) reserved[size - 1 - i][8] = true;
    if (version >= 7) {
      for (let i = 0; i < 18; i++) {
        const a = size - 11 + (i % 3), b = Math.floor(i / 3);
        reserved[a][b] = true; reserved[b][a] = true;
      }
    }

    let bitIndex = 0;
    const totalBits = codewords.length * 8;
    let dir = -1;
    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col = 5;
      for (let i = 0; i < size; i++) {
        const r = dir === -1 ? size - 1 - i : i;
        for (let k = 0; k < 2; k++) {
          const c = col - k;
          if (reserved[r][c]) continue;
          const bit = bitIndex < totalBits ? ((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) === 1 : false;
          m[r][c] = bit ? 1 : 0;
          bitIndex++;
        }
      }
      dir = -dir;
    }

    let best = null, bestScore = Infinity;
    for (let mask = 0; mask < 8; mask++) {
      const test = m.map((row) => row.slice());
      for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!reserved[r][c] && maskFn(mask, r, c)) test[r][c] ^= 1;
      const s = penalty(test, reserved);
      if (s < bestScore) { bestScore = s; best = { matrix: test, mask }; }
    }
    const out = best.matrix;
    const format = bchFormat((eclBits[ecl] << 3) | best.mask);
    const fb = (i) => ((format >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) out[8][i] = fb(i) ? 1 : 0;
    out[8][7] = fb(6) ? 1 : 0; out[8][8] = fb(7) ? 1 : 0; out[7][8] = fb(8) ? 1 : 0;
    for (let i = 9; i <= 14; i++) out[14 - i][8] = fb(i) ? 1 : 0;
    for (let i = 0; i <= 7; i++) out[size - 1 - i][8] = fb(i) ? 1 : 0;
    for (let i = 8; i <= 14; i++) out[8][size - 15 + i] = fb(i) ? 1 : 0;
    out[size - 8][8] = 1;
    if (version >= 7) {
      const vb = bchVersion(version);
      for (let i = 0; i < 18; i++) {
        const a = size - 11 + (i % 3), b = Math.floor(i / 3);
        const v = ((vb >>> i) & 1);
        out[a][b] = v; out[b][a] = v;
      }
    }
    return { matrix: out, version, ecl, size };
  }

  function draw(canvas, qr, scaleMode) {
    const quiet = 4;
    const modules = qr.size + quiet * 2;
    const requested = Number(scaleMode);
    const scale = Number.isFinite(requested) && requested > 0 ? requested : Math.max(2, Math.floor(280 / modules));
    const px = modules * scale;
    canvas.width = px; canvas.height = px;
    canvas.style.width = Math.min(280, px) + "px";
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = "#000000";
    for (let r = 0; r < qr.size; r++) for (let c = 0; c < qr.size; c++) {
      if (qr.matrix[r][c]) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
    }
  }

  function render(host) {
    host.innerHTML = `<div class="workspace">
      <div class="opts"><label class="field"><span>Teks atau URL</span><textarea id="qrText" rows="3" placeholder="https://example.com">https://nexus-toolbox.local</textarea></label>
      <label class="field"><span>Koreksi error</span><select id="qrEcl"><option value="M">M — sedang (disarankan)</option><option value="L">L — kapasitas lebih besar</option></select></label>
      <label class="field"><span>Ukuran module</span><select id="qrScale"><option value="auto">Otomatis</option><option value="2">Kecil</option><option value="3">Sedang</option><option value="4">Besar</option></select></label></div>
      <div class="row mt-16"><button class="btn btn-primary" data-qr="gen" type="button">${ico("qr")}<span>Buat QR</span></button><button class="btn" data-qr="png" type="button">Unduh PNG</button><button class="btn btn-ghost" data-qr="clear" type="button">Bersihkan</button></div>
      <div class="status-line mt-8" id="qrStatus"></div>
      <div class="qr-result mt-16"><canvas id="qrCanvas"></canvas><div class="hint" id="qrInfo">QR dibuat sepenuhnya di browser Anda.</div></div>
      <div class="notice mt-16">QR code hanya menyimpan teks/URL yang Anda masukkan. Tidak ada permintaan jaringan untuk membuatnya.</div></div>`;
    const canvas = host.querySelector("#qrCanvas");
    let current = null;
    let text = "";

    function generate() {
      text = host.querySelector("#qrText").value.trim();
      try {
        current = buildMatrix(text, host.querySelector("#qrEcl").value || "M");
        draw(canvas, current, host.querySelector("#qrScale").value);
        host.querySelector("#qrInfo").textContent = `Versi ${current.version} · ECC ${current.ecl} · ${current.size}×${current.size} module · ${new Blob([text]).size} byte`;
        host.querySelector("#qrStatus").textContent = "QR berhasil dibuat.";
        host.querySelector("#qrStatus").className = "status-line ok";
      } catch (err) {
        current = null;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        host.querySelector("#qrStatus").textContent = err.message;
        host.querySelector("#qrStatus").className = "status-line bad";
        host.querySelector("#qrInfo").textContent = "Belum ada QR.";
      }
    }
    host.querySelector("#qrScale").addEventListener("change", () => {
      if (current) draw(canvas, current, host.querySelector("#qrScale").value);
    });
    host.addEventListener("click", (e) => {
      const b = e.target.closest("[data-qr]");
      if (!b) return;
      if (b.dataset.qr === "gen") generate();
      if (b.dataset.qr === "clear") {
        host.querySelector("#qrText").value = "";
        current = null;
        canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
        host.querySelector("#qrStatus").textContent = "Dibersihkan.";
        host.querySelector("#qrInfo").textContent = "Belum ada QR.";
      }
      if (b.dataset.qr === "png") {
        if (!current) { N.core.toast("Buat QR terlebih dahulu.", "err"); return; }
        canvas.toBlob((blob) => {
          if (!blob) { N.core.toast("Gagal membuat PNG.", "err"); return; }
          N.core.download("nexus-qr.png", blob, "image/png");
          N.core.toast("QR PNG diunduh.", "ok");
        }, "image/png");
      }
    });
    generate();
  }

  N.qr = { render, buildMatrix };
})(window.Nexus = window.Nexus || {});
