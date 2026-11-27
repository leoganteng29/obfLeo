/* NEXUS TOOLBOX — Foto Live HP: masukkan foto ke layar template HP.
   Foto di-warp ke layar (perspektif) lalu diberi sudut membulat dari mask.png.
   Foto live = loop zoom/geser pelan (preview di layar + unduh sebagai video WebM/MP4).
   Butuh dijalankan lewat server lokal (http://), bukan dibuka langsung dari file. */
(function (N) {
  "use strict";
  const $ = (s, r) => (r || document).querySelector(s);
  const BASE = "assets/phone/";
  const SRC_W = 1125, SRC_H = 2436;   // ukuran layar acuan (sesuai mask.png)
  const FRAMES = 18, FPS = 12;
  const QUADS = {"v1":[[287.6,222.4],[636.1,242.7],[582.5,1035.2],[228.8,1011.0]],"v2":[[83.6,320.9],[383.7,196.3],[759.2,841.8],[439.7,1006.1]],"v3":[[271.8,261.8],[589.7,259.1],[595.4,983.9],[269.9,983.1]],"v4":[[53.2,329.6],[356.8,198.4],[798.8,891.7],[486.8,1065.6]],"v5":[[[66.1,562.2],[356.3,547.5],[495.8,1229.2],[137.7,1278.8]],[[381.0,560.4],[633.5,528.2],[892.5,1137.3],[631.7,1190.6]]],"v6":[[[238.7,761.4],[413.7,758.2],[447.1,1063.7],[189.3,1079.6]],[[469.4,764.6],[626.9,753.4],[782.1,1047.8],[533.0,1076.4]]],"v7":[[[251.4,739.9],[427.2,734.3],[465.4,1067.7],[187.0,1076.4]],[[475.8,731.9],[648.4,724.8],[798.8,1054.1],[526.7,1063.7]]]};
  const TEMPLATES = [
    { id: "v1", label: "Template 1" }, { id: "v2", label: "Template 2" }, { id: "v3", label: "Template 3" },
    { id: "v4", label: "Template 4" }, { id: "v5", label: "Template 5 (2 layar)" },
    { id: "v6", label: "Template 6 (2 layar)" }, { id: "v7", label: "Template 7 (2 layar)" },
  ].map((t) => {
    const q = QUADS[t.id];
    return Object.assign(t, { file: t.id + ".jpg", quads: Array.isArray(q[0][0]) ? q : [q] });
  });

  const st = {
    photo: null, tpl: TEMPLATES[0], tplImgs: {}, zoom: 1,
    maskImg: null, maskCache: {}, frames: [], idx: 0, timer: null, token: 0,
  };
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const cv = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

  function loadImg(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Gagal memuat gambar: " + src));
      img.src = src;
    });
  }

  /* ---------- matematika perspektif (homografi 3x3) ---------- */
  function solve8(A, b) {
    const n = 8, M = A.map((r, i) => [...r, b[i]]);
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      const d = M[c][c];
      if (Math.abs(d) < 1e-12) throw new Error("Koordinat layar template tidak valid.");
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = M[r][c] / d;
        if (!f) continue;
        for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
      }
    }
    return M.map((r, i) => r[n] / r[i]);
  }
  // homografi yang memetakan 4 titik src ke 4 titik dst
  function homography(s, d) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = s[i], [u, v] = d[i];
      A.push([x, y, 1, 0, 0, 0, -x * u, -y * u]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -x * v, -y * v]); b.push(v);
    }
    return [...solve8(A, b), 1];
  }
  function invert3(m) {
    const [a, b, c, d, e, f, g, h, i] = m;
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
    const D = -(b * i - c * h), E = a * i - c * g, F = -(a * h - b * g);
    const G = b * f - c * e, H = -(a * f - c * d), I = a * e - b * d;
    const det = a * A + b * B + c * C;
    return [A, D, G, B, E, H, C, F, I].map((x) => x / det);
  }

  // tempel sumber (sd) ke layar (quad) di template (od), dengan interpolasi bilinear
  function warpInto(od, W, H, sd, sw, sh, quad) {
    const Hi = invert3(homography([[0, 0], [sw, 0], [sw, sh], [0, sh]], quad));
    const xs = quad.map((p) => p[0]), ys = quad.map((p) => p[1]);
    const x0 = Math.max(0, Math.floor(Math.min(...xs))), x1 = Math.min(W - 1, Math.ceil(Math.max(...xs)));
    const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(H - 1, Math.ceil(Math.max(...ys)));
    const S = sd.data, D = od.data;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const w = Hi[6] * x + Hi[7] * y + Hi[8];
        const u = (Hi[0] * x + Hi[1] * y + Hi[2]) / w, v = (Hi[3] * x + Hi[4] * y + Hi[5]) / w;
        if (u < 0 || v < 0 || u > sw - 1 || v > sh - 1) continue;
        const ix = Math.floor(u), iy = Math.floor(v), fx = u - ix, fy = v - iy;
        const ix1 = Math.min(ix + 1, sw - 1), iy1 = Math.min(iy + 1, sh - 1);
        const i00 = (iy * sw + ix) * 4, i10 = (iy * sw + ix1) * 4, i01 = (iy1 * sw + ix) * 4, i11 = (iy1 * sw + ix1) * 4;
        const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
        const a = w00 * S[i00 + 3] + w10 * S[i10 + 3] + w01 * S[i01 + 3] + w11 * S[i11 + 3];
        if (a <= 0) continue;
        const k00 = w00 * S[i00 + 3], k10 = w10 * S[i10 + 3], k01 = w01 * S[i01 + 3], k11 = w11 * S[i11 + 3];
        const r = (k00 * S[i00] + k10 * S[i10] + k01 * S[i01] + k11 * S[i11]) / a;
        const g = (k00 * S[i00 + 1] + k10 * S[i10 + 1] + k01 * S[i01 + 1] + k11 * S[i11 + 1]) / a;
        const bl = (k00 * S[i00 + 2] + k10 * S[i10 + 2] + k01 * S[i01 + 2] + k11 * S[i11 + 2]) / a;
        const al = a / 255, di = (y * W + x) * 4;
        D[di] = D[di] * (1 - al) + r * al;
        D[di + 1] = D[di + 1] * (1 - al) + g * al;
        D[di + 2] = D[di + 2] * (1 - al) + bl * al;
      }
    }
  }

  /* ---------- mask sudut membulat (dipakai sebagai alpha) ---------- */
  function getMask(q) {
    const sw = Math.round(SRC_W * q), sh = Math.round(SRC_H * q), key = sw + "x" + sh;
    if (st.maskCache[key]) return st.maskCache[key];
    const c = cv(sw, sh), ctx = c.getContext("2d");
    ctx.drawImage(st.maskImg, 0, 0, sw, sh);
    const d = ctx.getImageData(0, 0, sw, sh).data, m = new Uint8ClampedArray(sw * sh);
    for (let i = 0; i < m.length; i++) m[i] = d[i * 4]; // kanal merah = kecerahan mask
    st.maskCache[key] = m;
    return m;
  }

  // satu frame: foto diisi ke layar (dengan zoom/geser), lalu ditempel ke template
  // t = posisi 0..1 dalam satu loop, q = skala sumber, s = skala keluaran
  function composeFrame(t, q, s) {
    const ph = st.photo, tpl = st.tpl, tplImg = st.tplImgs[tpl.id];
    const sw = Math.round(SRC_W * q), sh = Math.round(SRC_H * q);
    const wave = (1 - Math.cos(2 * Math.PI * t)) / 2;
    const z = st.zoom * (1 + 0.05 * wave);
    const px = 0.012 * Math.sin(2 * Math.PI * t), py = -0.008 * Math.sin(2 * Math.PI * t);
    const c = Math.max(sw / ph.width, sh / ph.height) * z;
    const dw = ph.width * c, dh = ph.height * c;
    const dx = Math.min(0, Math.max(sw - dw, (sw - dw) / 2 + px * sw));
    const dy = Math.min(0, Math.max(sh - dh, (sh - dh) / 2 + py * sh));
    const sc = cv(sw, sh), sctx = sc.getContext("2d");
    sctx.drawImage(ph, dx, dy, dw, dh);
    const sd = sctx.getImageData(0, 0, sw, sh), m = getMask(q);
    for (let i = 0; i < sw * sh; i++) sd.data[i * 4 + 3] = m[i];

    const W = Math.round(tplImg.naturalWidth * s), H = Math.round(tplImg.naturalHeight * s);
    const out = cv(W, H), octx = out.getContext("2d");
    octx.drawImage(tplImg, 0, 0, W, H);
    const od = octx.getImageData(0, 0, W, H);
    for (const quad of tpl.quads) warpInto(od, W, H, sd, sw, sh, quad.map(([x, y]) => [x * s, y * s]));
    octx.putImageData(od, 0, 0);
    return out;
  }

  /* ---------- status, preview, dan unduhan ---------- */
  function status(host, msg) { const el = $("#plStatus", host); if (el) el.textContent = msg; }
  function errText(e) {
    if (e && e.name === "SecurityError") return "Gambar tidak bisa diproses dari file lokal. Jalankan website lewat server (mis. http://localhost:8080).";
    return "Gagal: " + (e && e.message ? e.message : e);
  }
  function save(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  function showFrame(host, frame) {
    const c = $("#plCanvas", host);
    if (!c) return;
    if (c.width !== frame.width || c.height !== frame.height) { c.width = frame.width; c.height = frame.height; }
    c.getContext("2d").drawImage(frame, 0, 0);
  }
  function stopLive() { if (st.timer) { clearInterval(st.timer); st.timer = null; } }
  function startLive(host) {
    stopLive();
    if (!st.frames.length) return;
    st.timer = setInterval(() => {
      if (!host.isConnected) { stopLive(); return; } // tool sudah ditutup
      st.idx = (st.idx + 1) % st.frames.length;
      showFrame(host, st.frames[st.idx]);
    }, 1000 / FPS);
  }

  async function rebuild(host) {
    const token = ++st.token;
    if (!st.photo) {
      stopLive(); st.frames = [];
      const tplImg = st.tplImgs[st.tpl.id];
      if (tplImg) { const c = cv(tplImg.naturalWidth * 0.5, tplImg.naturalHeight * 0.5); c.getContext("2d").drawImage(tplImg, 0, 0, c.width, c.height); showFrame(host, c); }
      $("#plPng", host).disabled = true; $("#plLive", host).disabled = true;
      status(host, "Pilih foto untuk melihat hasilnya.");
      return;
    }
    status(host, "Menyiapkan preview...");
    try {
      const frames = [];
      for (let i = 0; i < FRAMES; i++) {
        if (token !== st.token) return;
        frames.push(composeFrame(i / FRAMES, 0.5, 0.5));
        await tick();
      }
      if (token !== st.token) return;
      st.frames = frames; st.idx = 0;
      showFrame(host, frames[0]);
      startLive(host);
      $("#plPng", host).disabled = false;
      $("#plLive", host).disabled = !liveMime();
      status(host, "Preview foto live berjalan. Unduh sebagai PNG atau video.");
    } catch (e) {
      status(host, errText(e));
    }
  }

  function liveMime() {
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return null;
    return ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) || null;
  }

  async function downloadPng(host) {
    const btn = $("#plPng", host);
    btn.disabled = true; status(host, "Membuat PNG resolusi penuh...");
    try {
      const c = composeFrame(0, 1, 1);
      const blob = await new Promise((res) => c.toBlob(res, "image/png"));
      save(blob, "foto-live-hp.png");
      status(host, "PNG tersimpan.");
    } catch (e) { status(host, errText(e)); }
    finally { btn.disabled = false; }
  }

  async function downloadLive(host) {
    const btn = $("#plLive", host), type = liveMime();
    if (!type) { status(host, "Browser ini tidak mendukung perekaman video."); return; }
    btn.disabled = true; status(host, "Membuat video foto live...");
    try {
      const frames = [];
      for (let i = 0; i < FRAMES; i++) { frames.push(composeFrame(i / FRAMES, 1, 1)); await tick(); }
      const c = cv(frames[0].width, frames[0].height), ctx = c.getContext("2d");
      const stream = c.captureStream(FPS);
      const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 4000000 });
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      const stopped = new Promise((res) => (rec.onstop = res));
      rec.start();
      const total = FRAMES * 2; // dua putaran loop
      await new Promise((resolve) => {
        let k = 0;
        const iv = setInterval(() => {
          ctx.clearRect(0, 0, c.width, c.height);
          ctx.drawImage(frames[k % FRAMES], 0, 0);
          if (++k >= total) { clearInterval(iv); resolve(); }
        }, 1000 / FPS);
      });
      rec.stop();
      await stopped;
      const blob = new Blob(chunks, { type });
      save(blob, type.indexOf("mp4") >= 0 ? "foto-live-hp.mp4" : "foto-live-hp.webm");
      status(host, "Video foto live tersimpan.");
    } catch (e) { status(host, errText(e)); }
    finally { btn.disabled = false; }
  }

  /* ---------- UI ---------- */
  function setPhoto(host, file) {
    const url = URL.createObjectURL(file);
    loadImg(url).then((img) => {
      const max = 1800, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = cv(Math.round(img.naturalWidth * k), Math.round(img.naturalHeight * k));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      st.photo = c;
      URL.revokeObjectURL(url);
      $("#plFileName", host).textContent = file.name;
      rebuild(host);
    }).catch((e) => status(host, errText(e)));
  }

  function render(host) {
    host.innerHTML = `
      <div class="card card-pad pl-wrap">
        <div class="pl-step"><span class="pl-num">1</span><div><strong>Masukkan foto</strong><small class="muted tiny"> JPG, PNG, atau WebP. Foto diproses di perangkat Anda, tidak dikirim ke server.</small></div></div>
        <label class="pl-drop" id="plDrop"><input type="file" id="plFile" accept="image/*" hidden><span id="plFileName">Ketuk untuk pilih foto, atau seret ke sini</span></label>
        <div class="pl-step"><span class="pl-num">2</span><div><strong>Pilih template HP</strong><small class="muted tiny"> Foto akan dimasukkan ke layar HP pada template.</small></div></div>
        <div class="pl-tpls" id="plTpls">
          ${TEMPLATES.map((t, i) => `<button class="pl-tpl${i === 0 ? " active" : ""}" data-tpl="${i}" type="button"><img src="${BASE + t.file}" alt="${t.label}" loading="lazy"><span>${t.label}</span></button>`).join("")}
        </div>
        <div class="pl-step"><span class="pl-num">3</span><div><strong>Atur dan unduh</strong></div></div>
        <div class="pl-preview"><canvas id="plCanvas" width="2" height="2"></canvas><div id="plStatus" class="tiny muted">Memuat template...</div></div>
        <label class="pl-range">Zoom foto <input type="range" id="plZoom" min="1" max="1.6" step="0.05" value="1"><b id="plZoomVal">1.00×</b></label>
        <div class="pl-actions">
          <button class="btn" id="plPng" type="button" disabled>Unduh foto (PNG)</button>
          <button class="btn btn-ghost" id="plLive" type="button" disabled>Unduh foto live (video)</button>
        </div>
      </div>`;

    const drop = $("#plDrop", host), input = $("#plFile", host);
    input.addEventListener("change", () => input.files[0] && setPhoto(host, input.files[0]));
    drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("is-drag"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("is-drag"));
    drop.addEventListener("drop", (e) => {
      e.preventDefault(); drop.classList.remove("is-drag");
      const f = e.dataTransfer && e.dataTransfer.files[0];
      if (f && /^image\//.test(f.type)) setPhoto(host, f);
    });
    host.querySelector("#plTpls").addEventListener("click", (e) => {
      const b = e.target.closest("[data-tpl]");
      if (!b) return;
      st.tpl = TEMPLATES[Number(b.dataset.tpl)];
      host.querySelectorAll(".pl-tpl").forEach((x) => x.classList.toggle("active", x === b));
      rebuild(host);
    });
    const zoom = $("#plZoom", host);
    zoom.addEventListener("input", () => {
      st.zoom = Number(zoom.value);
      $("#plZoomVal", host).textContent = st.zoom.toFixed(2) + "×";
      rebuild(host);
    });
    $("#plPng", host).addEventListener("click", () => downloadPng(host));
    $("#plLive", host).addEventListener("click", () => downloadLive(host));

    // muat aset: mask dan semua template
    Promise.all([loadImg(BASE + "mask.png"), ...TEMPLATES.map((t) => loadImg(BASE + t.file))])
      .then(([mask, ...imgs]) => {
        st.maskImg = mask;
        TEMPLATES.forEach((t, i) => (st.tplImgs[t.id] = imgs[i]));
        return rebuild(host);
      })
      .catch((e) => status(host, errText(e)));
  }

  N.photolive = { render, TEMPLATES };
})(window.Nexus = window.Nexus || {});
