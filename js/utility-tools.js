/* NEXUS TOOLBOX — extra utilities */
(function (N) {
  "use strict";

  const ico = (name, cls) => (N.icons ? N.icons.svg(name, cls) : "");
  const { escapeHtml: esc } = N.core;
  const $ = (s, r) => (r || document).querySelector(s);

  let beepContext = null;
  function beep(freq) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      beepContext = beepContext || new AC();
      const osc = beepContext.createOscillator();
      const gain = beepContext.createGain();
      osc.type = "sine";
      osc.frequency.value = freq || 880;
      gain.gain.setValueAtTime(0.0001, beepContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.16, beepContext.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, beepContext.currentTime + 0.35);
      osc.connect(gain).connect(beepContext.destination);
      osc.start();
      osc.stop(beepContext.currentTime + 0.36);
    } catch (e) { /* audio optional */ }
  }

  function head(tool, extra) {
    return `<div class="workspace-head"><div><span class="eyebrow">${esc(N.registry.category(tool.cat).label)}</span>
      <h1 class="page-title">${esc(tool.name)}</h1><p class="sub">${esc(tool.desc)}</p></div>
      <div class="row">${extra || ""}<button class="btn btn-sm btn-ghost" data-util="fav" type="button">${ico(N.core.isFavorite(tool.id) ? "star" : "starOff")}<span>${N.core.isFavorite(tool.id) ? "Tersimpan" : "Simpan"}</span></button></div></div>`;
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
  function localDate(date) {
    const d = date || new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function clockMs(ms) {
    const t = Math.max(0, Math.floor(ms));
    const m = Math.floor(t / 60000);
    const s = Math.floor((t % 60000) / 1000);
    const cs = Math.floor((t % 1000) / 10);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
  }

  /* ============================== implementations ============================== */
  const impl = {};

  impl.stopwatch = (host, tool) => {
    let running = false, started = 0, accumulated = 0, laps = [];
    let timer = null;
    host.innerHTML = head(tool) + `<div class="card card-pad" style="max-width:720px;margin:auto">
      <div class="big-time" id="swTime">00:00.00</div>
      <div class="row" style="justify-content:center"><button class="btn btn-primary" data-sw="toggle" type="button">${ico("play")}<span>Mulai</span></button>
      <button class="btn" data-sw="lap" type="button">${ico("flag")}<span>Lap</span></button><button class="btn btn-ghost" data-sw="reset" type="button">Reset</button></div>
      <div class="divider"></div><div class="spread"><strong class="tiny">LAP TIME</strong><span class="hint" id="swLapCount">0 lap</span></div>
      <div class="lap-list mt-8" id="swLaps"><div class="faint tiny">Belum ada lap.</div></div></div>`;
    function render() {
      const ms = accumulated + (running ? performance.now() - started : 0);
      $("#swTime", host).textContent = clockMs(ms);
      if (timer) clearTimeout(timer);
      timer = setTimeout(render, 47);
    }
    function refreshLaps() {
      $("#swLapCount", host).textContent = laps.length + " lap";
      $("#swLaps", host).innerHTML = laps.length ? laps.map((l, i) => `<div><span>Lap ${i + 1}</span><span>${clockMs(l)}</span></div>`).join("") : '<div class="faint tiny">Belum ada lap.</div>';
    }
    host.addEventListener("click", (e) => {
      const b = e.target.closest("[data-sw]");
      if (!b) return;
      if (b.dataset.sw === "toggle") {
        if (running) { accumulated += performance.now() - started; running = false; b.innerHTML = ico("play") + "<span>Lanjut</span>"; }
        else { started = performance.now(); running = true; b.innerHTML = ico("pause") + "<span>Jeda</span>"; }
      }
      if (b.dataset.sw === "lap" && running) { laps.push(performance.now() - started); refreshLaps(); }
      if (b.dataset.sw === "reset") {
        running = false; accumulated = 0; laps = []; refreshLaps();
        $('[data-sw="toggle"]', host).innerHTML = ico("play") + "<span>Mulai</span>";
        $("#swTime", host).textContent = "00:00.00";
      }
    });
    bindFav(host, tool.id);
    N.core.trackTool(tool.id, "utility");
    N.core.addCleanup(() => clearTimeout(timer));
    render();
  };

  impl.countdown = (host, tool) => {
    let remaining = 0, endAt = 0, running = false, timer = null;
    host.innerHTML = head(tool) + `<div class="card card-pad" style="max-width:720px;margin:auto">
      <div class="opts"><label class="field"><span>Jam</span><input type="number" id="cdH" min="0" max="23" value="0"></label>
      <label class="field"><span>Menit</span><input type="number" id="cdM" min="0" max="59" value="1"></label>
      <label class="field"><span>Detik</span><input type="number" id="cdS" min="0" max="59" value="0"></label></div>
      <div class="big-time" id="cdTime">00:01</div>
      <div class="progress"><span id="cdBar" style="width:100%"></span></div>
      <div class="row mt-16" style="justify-content:center"><button class="btn btn-primary" data-cd="toggle" type="button">${ico("play")}<span>Mulai</span></button>
      <button class="btn" data-cd="set" type="button">Set ulang</button><button class="btn btn-ghost" data-cd="stop" type="button">Hentikan</button></div>
      <div class="status-line mt-8" id="cdStatus"></div></div>`;
    function totalMs() {
      const h = Math.max(0, Number($("#cdH", host).value) || 0);
      const m = Math.max(0, Number($("#cdM", host).value) || 0);
      const s = Math.max(0, Number($("#cdS", host).value) || 0);
      return Math.min(24 * 3600, h * 3600 + m * 60 + s) * 1000;
    }
    function tick() {
      remaining = endAt - performance.now();
      if (remaining <= 0) {
        remaining = 0; running = false;
        $("#cdTime", host).textContent = "00:00";
        $("#cdBar", host).style.width = "0%";
        $("#cdStatus", host).textContent = "Waktu habis.";
        beep(1046);
        N.core.toast("Countdown selesai!", "ok");
        clearInterval(timer); timer = null;
        return;
      }
      $("#cdTime", host).textContent = N.core.formatDuration(remaining);
      $("#cdBar", host).style.width = Math.max(0, Math.min(100, (remaining / (totalMs() || 1)) * 100)) + "%";
    }
    host.addEventListener("click", (e) => {
      const b = e.target.closest("[data-cd]");
      if (!b) return;
      if (b.dataset.cd === "set") {
        clearInterval(timer); timer = null; running = false;
        remaining = totalMs(); $("#cdTime", host).textContent = N.core.formatDuration(remaining);
        $("#cdBar", host).style.width = "100%"; $("#cdStatus", host).textContent = "Timer diset ulang.";
      }
      if (b.dataset.cd === "toggle") {
        if (running) { clearInterval(timer); timer = null; running = false; remaining = endAt - performance.now(); b.innerHTML = ico("play") + "<span>Lanjut</span>"; }
        else {
          if (remaining <= 0) remaining = totalMs();
          if (remaining <= 0) { N.core.toast("Masukkan durasi dulu.", "err"); return; }
          endAt = performance.now() + remaining; running = true; b.innerHTML = ico("pause") + "<span>Jeda</span>";
          timer = setInterval(tick, 200);
        }
      }
      if (b.dataset.cd === "stop") {
        clearInterval(timer); timer = null; running = false; remaining = totalMs();
        $("#cdTime", host).textContent = N.core.formatDuration(remaining);
        $("#cdBar", host).style.width = "100%";
        $('[data-cd="toggle"]', host).innerHTML = ico("play") + "<span>Mulai</span>";
      }
    });
    bindFav(host, tool.id);
    N.core.trackTool(tool.id, "utility");
    N.core.addCleanup(() => clearInterval(timer));
    remaining = totalMs();
    $("#cdTime", host).textContent = N.core.formatDuration(remaining);
  };

  impl.clock = (host, tool) => {
    let timer = null, format24 = true;
    host.innerHTML = head(tool, '<button class="btn btn-sm" data-clk="format" type="button">Format 24 jam</button>') +
      `<div class="card card-pad" style="max-width:720px;margin:auto;text-align:center">
      <div class="big-time" id="clkTime" style="font-size:clamp(2.6rem,8vw,5rem)">--:--:--</div>
      <div class="muted" id="clkDate"></div><div class="hint mt-8">Waktu lokal perangkat Anda.</div></div>`;
    function tick() {
      const d = new Date();
      const opt = { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: !format24 };
      $("#clkTime", host).textContent = d.toLocaleTimeString("id-ID", opt);
      $("#clkDate", host).textContent = d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    }
    host.addEventListener("click", (e) => {
      const b = e.target.closest('[data-clk="format"]');
      if (!b) return;
      format24 = !format24;
      b.textContent = "Format " + (format24 ? "24" : "12") + " jam";
      tick();
    });
    bindFav(host, tool.id);
    N.core.trackTool(tool.id, "utility");
    N.core.addCleanup(() => clearInterval(timer));
    tick(); timer = setInterval(tick, 1000);
  };

  impl.pomodoro = (host, tool) => {
    let mode = "work", remaining = 25 * 60 * 1000, endAt = 0, running = false, timer = null;
    const durations = () => ({ work: (Number($("#pdWork", host).value) || 25) * 60000, short: (Number($("#pdShort", host).value) || 5) * 60000, long: (Number($("#pdLong", host).value) || 15) * 60000 });
    host.innerHTML = head(tool) + `<div class="card card-pad" style="max-width:760px;margin:auto">
      <div class="segmented" id="pdModes"><button data-mode="work" class="active">Fokus</button><button data-mode="short">Istirahat pendek</button><button data-mode="long">Istirahat panjang</button></div>
      <div class="opts mt-16"><label class="field"><span>Fokus (menit)</span><input type="number" id="pdWork" min="1" max="180" value="25"></label>
      <label class="field"><span>Istirahat pendek</span><input type="number" id="pdShort" min="1" max="60" value="5"></label>
      <label class="field"><span>Istirahat panjang</span><input type="number" id="pdLong" min="1" max="90" value="15"></label></div>
      <div class="big-time" id="pdTime">25:00</div>
      <div class="progress"><span id="pdBar" style="width:100%"></span></div>
      <div class="row mt-16" style="justify-content:center"><button class="btn btn-primary" data-pd="toggle" type="button">${ico("play")}<span>Mulai</span></button>
      <button class="btn" data-pd="reset" type="button">Reset sesi</button></div>
      <div class="spread mt-16"><span class="hint">Siklus selesai: <strong id="pdCycles">${N.core.state.pomodoro.cycles || 0}</strong></span><span class="hint" id="pdStatus">Siap memulai.</span></div></div>`;
    function setMode(m, reset) {
      mode = m;
      host.querySelectorAll("#pdModes button").forEach((b) => b.classList.toggle("active", b.dataset.mode === m));
      remaining = durations()[m];
      $("#pdTime", host).textContent = N.core.formatDuration(remaining);
      $("#pdBar", host).style.width = "100%";
      if (reset) { running = false; clearInterval(timer); timer = null; $('[data-pd="toggle"]', host).innerHTML = ico("play") + "<span>Mulai</span>"; }
    }
    function tick() {
      remaining = endAt - performance.now();
      if (remaining <= 0) {
        remaining = 0; running = false; clearInterval(timer); timer = null;
        $('[data-pd="toggle"]', host).innerHTML = ico("play") + "<span>Mulai</span>";
        if (mode === "work") {
          N.core.state.pomodoro.cycles = (N.core.state.pomodoro.cycles || 0) + 1;
          N.core.save(); N.core.emit("data-changed");
          $("#pdCycles", host).textContent = N.core.state.pomodoro.cycles;
          const next = N.core.state.pomodoro.cycles % 4 === 0 ? "long" : "short";
          setMode(next, true);
          N.core.toast("Sesi fokus selesai. Waktunya istirahat!", "ok");
        } else {
          setMode("work", true);
          N.core.toast("Istirahat selesai. Siap fokus lagi.", "info");
        }
        beep(880);
        return;
      }
      $("#pdTime", host).textContent = N.core.formatDuration(remaining);
      $("#pdBar", host).style.width = (remaining / (durations()[mode] || 1) * 100) + "%";
    }
    host.addEventListener("click", (e) => {
      const m = e.target.closest("#pdModes button");
      if (m) { setMode(m.dataset.mode, true); return; }
      const b = e.target.closest("[data-pd]");
      if (!b) return;
      if (b.dataset.pd === "toggle") {
        if (running) { clearInterval(timer); timer = null; running = false; remaining = endAt - performance.now(); b.innerHTML = ico("play") + "<span>Lanjut</span>"; }
        else {
          if (remaining <= 0) remaining = durations()[mode];
          endAt = performance.now() + remaining; running = true; b.innerHTML = ico("pause") + "<span>Jeda</span>";
          $("#pdStatus", host).textContent = mode === "work" ? "Fokus berjalan." : "Istirahat berjalan.";
          timer = setInterval(tick, 250);
        }
      }
      if (b.dataset.pd === "reset") setMode(mode, true);
    });
    bindFav(host, tool.id);
    N.core.trackTool(tool.id, "utility");
    N.core.addCleanup(() => clearInterval(timer));
  };

  impl.notes = (host, tool) => {
    host.innerHTML = head(tool) + `<div class="card card-pad">
      <div class="spread"><span class="hint">Tersimpan otomatis di perangkat ini.</span><div class="row">
      <button class="btn btn-sm" data-nt="copy" type="button">Salin</button><button class="btn btn-sm" data-nt="download" type="button">Unduh .txt</button>
      <button class="btn btn-sm btn-danger" data-nt="clear" type="button">Hapus</button></div></div>
      <textarea id="ntText" rows="18" class="mt-16" placeholder="Tulis catatan di sini..." spellcheck="false">${esc(N.core.state.notes || "")}</textarea>
      <div class="spread mt-8"><span class="hint" id="ntStats"></span><span class="hint" id="ntSaved">Tersimpan lokal</span></div></div>`;
    const ta = $("#ntText", host);
    let saveTimer = null;
    function stats() {
      const v = ta.value;
      const words = v.trim() ? v.trim().split(/\s+/).length : 0;
      $("#ntStats", host).textContent = `${v.length} karakter · ${words} kata · ${v.split(/\r?\n/).length} baris`;
    }
    ta.addEventListener("input", () => {
      stats();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { N.core.state.notes = ta.value; N.core.save(); $("#ntSaved", host).textContent = "Tersimpan " + N.core.formatTime(new Date()); }, 250);
    });
    host.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-nt]");
      if (!b) return;
      if (b.dataset.nt === "copy" && await N.core.copy(ta.value)) N.core.toast("Catatan disalin.", "ok");
      if (b.dataset.nt === "download") { N.core.download("nexus-notes.txt", ta.value); N.core.toast("Catatan diunduh.", "ok"); }
      if (b.dataset.nt === "clear") N.core.confirm("Hapus catatan?", "Catatan akan dikosongkan dari perangkat ini.", () => { ta.value = ""; N.core.state.notes = ""; N.core.save(); stats(); N.core.toast("Catatan dihapus.", "ok"); }, "Ya, hapus");
    });
    bindFav(host, tool.id);
    N.core.trackTool(tool.id, "utility");
    N.core.addCleanup(() => {
      clearTimeout(saveTimer);
      if (N.core.state.notes !== ta.value) {
        N.core.state.notes = ta.value;
        N.core.saveNow();
      }
    });
    stats();
  };

  impl.clipboard = (host, tool) => {
    const items = N.core.state.clipboard || [];
    host.innerHTML = head(tool) + `<div class="card card-pad">
      <div class="opts"><label class="field" style="grid-column:1/-1"><span>Teks baru</span><textarea id="cbInput" rows="3" placeholder="Tempel atau tulis teks..."></textarea></label></div>
      <div class="row mt-16"><button class="btn btn-primary" data-cb="add" type="button">${ico("plus")}<span>Simpan</span></button>
      <button class="btn" data-cb="read" type="button">${ico("clipboard")}<span>Ambil dari clipboard</span></button>
      <button class="btn btn-sm btn-ghost" data-cb="clear" type="button">Hapus semua</button></div>
      <div class="divider"></div><div class="spread"><strong class="tiny">SIMPANAN</strong><span class="hint" id="cbCount"></span></div>
      <div class="grid mt-8" id="cbList" style="gap:8px"></div></div>`;
    function renderList() {
      const list = N.core.state.clipboard || [];
      $("#cbCount", host).textContent = list.length + " item";
      $("#cbList", host).innerHTML = list.length ? list.map((x, i) => `<div class="clip-item"><span title="${esc(x)}">${esc(x)}</span>
        <button class="btn btn-sm" data-copy="${i}" type="button">Salin</button><button class="btn btn-sm btn-ghost" data-del="${i}" type="button">${ico("close")}</button></div>`).join("") : '<div class="empty"><div class="empty-icon">${ico("clipboard")}</div><strong>Belum ada simpanan</strong><p>Tambahkan teks untuk dipakai kembali.</p></div>';
    }
    host.addEventListener("click", async (e) => {
      const add = e.target.closest('[data-cb="add"]');
      const read = e.target.closest('[data-cb="read"]');
      const clear = e.target.closest('[data-cb="clear"]');
      const cp = e.target.closest("[data-copy]");
      const del = e.target.closest("[data-del]");
      if (add) {
        const v = $("#cbInput", host).value.trim();
        if (!v) { N.core.toast("Masukkan teks dulu.", "err"); return; }
        N.core.state.clipboard.unshift(v);
        N.core.state.clipboard = N.core.state.clipboard.slice(0, 30);
        $("#cbInput", host).value = "";
        N.core.save(); renderList(); N.core.toast("Tersimpan.", "ok");
      }
      if (read) {
        try {
          if (!navigator.clipboard || !navigator.clipboard.readText) throw new Error("Izin clipboard tidak tersedia. Tempel manual.");
          const text = await navigator.clipboard.readText();
          $("#cbInput", host).value = text;
          N.core.toast("Teks diambil dari clipboard.", "ok");
        } catch (err) { N.core.toast(err.message || "Gagal membaca clipboard.", "err"); }
      }
      if (clear) N.core.confirm("Hapus semua simpanan?", "Semua item clipboard lokal akan dihapus.", () => { N.core.state.clipboard = []; N.core.save(); renderList(); }, "Ya, hapus");
      if (cp) { if (await N.core.copy(N.core.state.clipboard[Number(cp.dataset.copy)])) N.core.toast("Disalin.", "ok"); }
      if (del) { N.core.state.clipboard.splice(Number(del.dataset.del), 1); N.core.save(); renderList(); }
    });
    bindFav(host, tool.id);
    N.core.trackTool(tool.id, "utility");
    renderList();
  };

  impl["random-picker"] = (host, tool) => {
    host.innerHTML = head(tool) + `<div class="card card-pad">
      <label class="field"><span>Daftar item (satu per baris)</span><textarea id="rpItems" rows="8" placeholder="Apa saja\nNexus\nToolbox">React\nVue\nSvelte\nVanilla JS</textarea></label>
      <div class="row mt-16"><button class="btn btn-primary" data-rp="pick" type="button">${ico("dice")}<span>Pilih acak</span></button>
      <label class="check"><input type="checkbox" id="rpNoRepeat"> Hindari pengulangan</label></div>
      <div class="big-time" id="rpResult" style="font-size:2rem;min-height:80px">—</div>
      <div class="divider"></div><span class="hint">Riwayat pemilihan</span><div class="results mt-8" id="rpHistory"></div></div>`;
    let history = [], last = null, anim = null;
    const items = () => $("#rpItems", host).value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    function renderHistory() {
      $("#rpHistory", host).innerHTML = history.length ? history.slice(0, 8).map((h) => `<div class="result-row"><span class="faint tiny">${esc(N.core.formatTime(h.at))}</span><strong>${esc(h.value)}</strong></div>`).join("") : '<div class="hint">Belum ada pilihan.</div>';
    }
    host.addEventListener("click", (e) => {
      if (!e.target.closest('[data-rp="pick"]')) return;
      const list = items();
      if (!list.length) { N.core.toast("Masukkan minimal satu item.", "err"); return; }
      if (anim) clearInterval(anim);
      let ticks = 0;
      anim = setInterval(() => {
        $("#rpResult", host).textContent = list[Math.floor(Math.random() * list.length)];
        if (++ticks > 12) {
          clearInterval(anim); anim = null;
          let pool = list;
          if ($("#rpNoRepeat", host).checked && list.length > 1) pool = list.filter((x) => x !== last);
          const pick = pool[Math.floor(Math.random() * pool.length)];
          last = pick;
          $("#rpResult", host).textContent = pick;
          history.unshift({ value: pick, at: Date.now() });
          renderHistory();
          beep(660);
        }
      }, 55);
    });
    bindFav(host, tool.id);
    N.core.trackTool(tool.id, "utility");
    N.core.addCleanup(() => { if (anim) clearInterval(anim); });
    renderHistory();
  };

  impl.password = (host, tool) => {
    host.innerHTML = head(tool) + `<div class="card card-pad" style="max-width:760px;margin:auto">
      <div class="notice info">Gunakan hanya untuk akun Anda sendiri. Kata sandi dibuat di browser dengan <span class="mono">crypto.getRandomValues</span>.</div>
      <div class="opts mt-16">
        <label class="field"><span>Panjang: <b id="pwLen">16</b></span><input type="range" class="range" id="pwRange" min="8" max="64" value="16"></label>
        <div class="grid" style="gap:7px"><label class="check"><input type="checkbox" data-pw="upper" checked> Huruf besar</label>
        <label class="check"><input type="checkbox" data-pw="lower" checked> Huruf kecil</label>
        <label class="check"><input type="checkbox" data-pw="digit" checked> Angka</label>
        <label class="check"><input type="checkbox" data-pw="symbol" checked> Simbol</label>
        <label class="check"><input type="checkbox" data-pw="ambiguous"> Karakter mirip (O,0,l,1)</label></div>
      </div>
      <div class="pw-output mt-16" id="pwOut">—</div>
      <div class="spread mt-8"><div class="progress" style="flex:1"><span id="pwBar" style="width:0%"></span></div><span class="hint" id="pwScore">—</span></div>
      <div class="row mt-16"><button class="btn btn-primary" data-pw="gen" type="button">${ico("refresh")}<span>Buat kata sandi</span></button><button class="btn" data-pw="copy" type="button">Salin</button></div></div>`;
    const SETS = { upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ", lower: "abcdefghijklmnopqrstuvwxyz", digit: "0123456789", symbol: "!@#$%^&*()-_=+[]{};:,.?/" };
    function chars() {
      const picked = {};
      host.querySelectorAll("[data-pw]").forEach((el) => { if (el.type === "checkbox") picked[el.dataset.pw] = el.checked; });
      let pool = "";
      Object.keys(SETS).forEach((k) => { if (picked[k]) pool += SETS[k]; });
      if (picked.ambiguous) pool += "O0l1I|";
      return pool;
    }
    function generate() {
      const pool = chars();
      if (pool.length < 4) { N.core.toast("Pilih minimal dua set karakter.", "err"); return; }
      const len = Number($("#pwRange", host).value) || 16;
      const out = [];
      const limit = 256 - (256 % pool.length);
      while (out.length < len) {
        const byte = crypto.getRandomValues(new Uint8Array(1))[0];
        if (byte < limit) out.push(pool[byte % pool.length]);
      }
      const pw = out.join("");
      $("#pwOut", host).textContent = pw;
      const entropy = Math.round(len * Math.log2(pool.length));
      const pct = Math.min(100, entropy / 1.2);
      $("#pwBar", host).style.width = pct + "%";
      $("#pwScore", host).textContent = entropy + " bit entropy";
    }
    host.addEventListener("input", (e) => { if (e.target.id === "pwRange") $("#pwLen", host).textContent = e.target.value; });
    host.addEventListener("change", (e) => { if (e.target.matches("[data-pw]")) generate(); });
    host.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-pw]");
      if (!b) return;
      if (b.dataset.pw === "gen") generate();
      if (b.dataset.pw === "copy") {
        const v = $("#pwOut", host).textContent;
        if (v === "—") { N.core.toast("Buat kata sandi dulu.", "err"); return; }
        if (await N.core.copy(v)) N.core.toast("Kata sandi disalin.", "ok");
      }
    });
    bindFav(host, tool.id);
    N.core.trackTool(tool.id, "utility");
    generate();
  };

  impl["text-counter"] = (host, tool) => {
    host.innerHTML = head(tool) + `<div class="card card-pad"><textarea id="tcText" rows="12" placeholder="Tempel teks di sini..."></textarea>
      <div class="metric-grid mt-16" id="tcMetrics"></div></div>`;
    const ta = $("#tcText", host);
    function update() {
      const v = ta.value;
      const words = v.trim() ? v.trim().split(/\s+/).length : 0;
      const lines = v ? v.split(/\r?\n/).length : 0;
      const paras = v.split(/\n\s*\n/).filter((x) => x.trim()).length;
      const mins = words / 200;
      $("#tcMetrics", host).innerHTML = [
        ["Karakter", v.length], ["Tanpa spasi", v.replace(/\s/g, "").length], ["Kata", words],
        ["Baris", lines], ["Paragraf", paras], ["Baca", mins < 1 ? "<1 mnt" : Math.ceil(mins) + " mnt"]
      ].map(([k, val]) => `<div class="metric"><strong>${esc(val)}</strong><small>${esc(k)}</small></div>`).join("");
    }
    ta.addEventListener("input", update);
    bindFav(host, tool.id);
    N.core.trackTool(tool.id, "utility");
    update();
  };

  impl["word-counter"] = (host, tool) => {
    host.innerHTML = head(tool) + `<div class="card card-pad"><textarea id="wcText" rows="10" placeholder="Teks untuk dianalisis..."></textarea>
      <div class="spread mt-16"><strong class="tiny">KATA PALING SERING</strong><span class="hint" id="wcUnique"></span></div>
      <div class="results mt-8" id="wcList"></div></div>`;
    const ta = $("#wcText", host);
    function update() {
      const freq = {};
      const words = (ta.value.toLowerCase().match(/[a-z0-9_]+/g) || []);
      words.forEach((w) => { freq[w] = (freq[w] || 0) + 1; });
      const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 20);
      $("#wcUnique", host).textContent = Object.keys(freq).length + " kata unik";
      $("#wcList", host).innerHTML = sorted.length ? sorted.map(([w, n]) => `<div class="result-row"><strong>${esc(w)}</strong><span class="badge">${n}x</span></div>`).join("") : '<div class="empty"><strong>Belum ada kata</strong><p>Tulis teks untuk melihat frekuensi.</p></div>';
    }
    ta.addEventListener("input", update);
    bindFav(host, tool.id);
    N.core.trackTool(tool.id, "utility");
    update();
  };

  impl["case-converter"] = (host, tool) => {
    host.innerHTML = head(tool) + `<div class="card card-pad"><label class="field"><span>Teks asli</span><textarea id="ccIn" rows="6" placeholder="hello world nexus"></textarea></label>
      <div class="chips mt-16">
        ${[["lower", "huruf kecil"], ["upper", "HURUF BESAR"], ["title", "Title Case"], ["sentence", "Kalimat Pertama"], ["camel", "camelCase"], ["pascal", "PascalCase"], ["snake", "snake_case"], ["kebab", "kebab-case"], ["constant", "CONSTANT_CASE"], ["alt", "aLtErNaTiNg"]].map(([k, l]) => `<button class="chip" data-cc="${k}" type="button">${l}</button>`).join("")}
      </div><div class="divider"></div><div class="io-label"><span>Hasil</span><button class="btn btn-sm" data-cc="copy" type="button">Salin</button></div>
      <div class="output-preview mt-8" id="ccOut">Hasil muncul di sini.</div></div>`;
    const ta = $("#ccIn", host);
    const words = () => ta.value.trim().split(/\s+/).filter(Boolean);
    const caps = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    host.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-cc]");
      if (!b) return;
      if (b.dataset.cc === "copy") {
        const v = $("#ccOut", host).textContent;
        if (v === "Hasil muncul di sini.") { N.core.toast("Belum ada hasil.", "err"); return; }
        if (await N.core.copy(v)) N.core.toast("Disalin.", "ok");
        return;
      }
      const k = b.dataset.cc;
      let out = "";
      if (k === "lower") out = ta.value.toLowerCase();
      if (k === "upper") out = ta.value.toUpperCase();
      if (k === "title") out = words().map(caps).join(" ");
      if (k === "sentence") out = ta.value.toLowerCase().replace(/(^\s*\w)/, (m) => m.toUpperCase());
      if (k === "camel") out = words().map((w, i) => i ? caps(w.replace(/[^\w]/g, "")) : w.toLowerCase().replace(/[^\w]/g, "")).join("");
      if (k === "pascal") out = words().map((w) => caps(w.replace(/[^\w]/g, ""))).join("");
      if (k === "snake") out = words().map((w) => w.toLowerCase().replace(/[^\w]+/g, "_")).join("_");
      if (k === "kebab") out = words().map((w) => w.toLowerCase().replace(/[^\w]+/g, "-")).join("-");
      if (k === "constant") out = words().map((w) => w.toUpperCase().replace(/[^\w]+/g, "_")).join("_");
      if (k === "alt") out = Array.from(ta.value).map((c, i) => i % 2 ? c.toUpperCase() : c.toLowerCase()).join("");
      $("#ccOut", host).textContent = out;
    });
    bindFav(host, tool.id);
    N.core.trackTool(tool.id, "utility");
  };

  impl.lorem = (host, tool) => {
    const WORDS = ("lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum").split(" ");
    host.innerHTML = head(tool) + `<div class="card card-pad"><div class="opts">
      <label class="field"><span>Jumlah paragraf</span><input type="number" id="loP" min="1" max="20" value="3"></label>
      <label class="field"><span>Kata per paragraf</span><input type="number" id="loW" min="5" max="150" value="60"></label>
      <label class="check"><input type="checkbox" id="loStart"> Mulai dengan "Lorem ipsum"</label>
      <label class="check"><input type="checkbox" id="loHtml"> Bungkus dengan &lt;p&gt;</label></div>
      <div class="row mt-16"><button class="btn btn-primary" data-lo="gen" type="button">Buat teks</button><button class="btn" data-lo="copy" type="button">Salin</button></div>
      <div class="output-preview mt-16" id="loOut"></div></div>`;
    function generate() {
      const paras = Math.min(20, Math.max(1, Number($("#loP", host).value) || 3));
      const per = Math.min(150, Math.max(5, Number($("#loW", host).value) || 60));
      const start = $("#loStart", host).checked;
      const html = $("#loHtml", host).checked;
      const out = [];
      for (let p = 0; p < paras; p++) {
        const arr = [];
        for (let i = 0; i < per; i++) arr.push(WORDS[Math.floor(Math.random() * WORDS.length)]);
        if (p === 0 && start) arr.splice(0, 2, "lorem", "ipsum");
        let text = arr.join(" ") + ".";
        text = text.charAt(0).toUpperCase() + text.slice(1);
        out.push(html ? `<p>${esc(text)}</p>` : text);
      }
      $("#loOut", host).innerHTML = out.map((x) => html ? x : esc(x)).join(html ? "\n" : "\n\n");
    }
    host.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-lo]");
      if (!b) return;
      if (b.dataset.lo === "gen") generate();
      if (b.dataset.lo === "copy") {
        const v = $("#loOut", host).innerText;
        if (await N.core.copy(v)) N.core.toast("Disalin.", "ok");
      }
    });
    bindFav(host, tool.id);
    N.core.trackTool(tool.id, "utility");
    generate();
  };

  const QUESTIONS = [
    { q: "Apa hasil dari `typeof null` di JavaScript?", a: ["object", "null", "undefined", "number"], correct: 0 },
    { q: "Method array mana yang membuat salinan baru dengan elemen terbalik?", a: ["sort()", "reverse()", "toReversed()", "flip()"], correct: 2 },
    { q: "JSON.parse('{\"a\":1}').a bernilai?", a: ["\"1\"", "1", "undefined", "NaN"], correct: 1 },
    { q: "Kapan `===` lebih tepat daripada `==`?", a: ["Selalu, untuk perbandingan ketat", "Hanya untuk angka", "Hanya untuk string", "Tidak pernah"], correct: 0 },
    { q: "Apa fungsi `crypto.randomUUID()`?", a: ["Hash SHA-1", "Membuat UUID v4 acak", "Mengacak array", "Membuat token JWT"], correct: 1 },
    { q: "Elemen HTML mana yang bersifat void (tanpa tag penutup)?", a: ["<div>", "<span>", "<img>", "<p>"], correct: 2 },
    { q: "Dalam CSS, properti untuk mengatur transisi adalah?", a: ["animation", "transition", "transform", "filter"], correct: 1 },
    { q: "Apa output dari `Math.max(3, 9, 2)`?", a: ["2", "3", "9", "14"], correct: 2 },
    { q: "Manakah yang termasuk tipe data primitif di JS?", a: ["Object", "Array", "Symbol", "Function"], correct: 2 },
    { q: "Apa kegunaan `localStorage`?", a: ["Menyimpan data di server", "Menyimpan data di browser secara persisten", "Mengirim email", "Mengompres gambar"], correct: 1 },
    { q: "Regex `/\\d+/` mencocokkan?", a: ["Huruf", "Spasi", "Satu atau lebih digit", "Tanda baca"], correct: 2 },
    { q: "Apa bedanya `let` dan `const`?", a: ["Tidak ada", "const tidak bisa di-reassign", "let hanya untuk angka", "const hanya untuk fungsi"], correct: 1 }
  ];

  impl["daily-challenge"] = (host, tool) => {
    const today = localDate();
    const seed = Array.from(today).reduce((a, c) => a + c.charCodeAt(0), 0);
    const picks = [0, 1, 2].map((i) => QUESTIONS[(seed + i * 5) % QUESTIONS.length]);
    const saved = N.core.state.daily && N.core.state.daily.date === today ? N.core.state.daily : { date: today, correct: 0, total: 0, streak: (N.core.state.daily && N.core.state.daily.streak) || 0 };
    host.innerHTML = head(tool) + `<div class="card card-pad challenge-card">
      <div class="challenge-top"><span class="badge pro">${esc(today)}</span><span class="badge">Streak: <b id="dcStreak">${saved.streak || 0}</b> hari</span></div>
      <h2 class="section-title mt-16">Tantangan harian · 3 pertanyaan</h2>
      <p class="hint">Pertanyaan berubah tiap hari berdasarkan tanggal perangkat Anda.</p>
      <div id="dcQuestions" class="mt-16"></div>
      <div class="divider"></div><div class="spread"><span class="hint" id="dcResult">Belum dijawab.</span><button class="btn btn-sm" data-dc="again" type="button">Ulangi latihan</button></div></div>`;
    const answered = new Set();
    const correctSet = new Set();
    function render() {
      $("#dcQuestions", host).innerHTML = picks.map((q, qi) => `<div class="mt-16"><strong class="tiny">${qi + 1}. ${esc(q.q)}</strong>
        <div class="choice-grid mt-8">${q.a.map((a, ai) => `<button class="choice" data-q="${qi}" data-a="${ai}" type="button">${esc(a)}</button>`).join("")}</div></div>`).join("");
    }
    host.addEventListener("click", (e) => {
      const again = e.target.closest('[data-dc="again"]');
      if (again) {
        answered.clear(); correctSet.clear(); render();
        $("#dcResult", host).textContent = "Latihan diulang — skor harian tidak diubah.";
        return;
      }
      const b = e.target.closest("[data-q]");
      if (!b) return;
      const qi = Number(b.dataset.q), ai = Number(b.dataset.a);
      const q = picks[qi];
      host.querySelectorAll(`[data-q="${qi}"]`).forEach((x) => x.classList.remove("correct", "wrong"));
      const isCorrect = ai === q.correct;
      b.classList.add(isCorrect ? "correct" : "wrong");
      answered.add(qi);
      if (isCorrect) correctSet.add(qi); else correctSet.delete(qi);
      if (answered.size >= picks.length) {
        const score = correctSet.size;
        const first = !(N.core.state.daily && N.core.state.daily.date === today && N.core.state.daily.total > 0);
        if (first) {
          const prevDate = N.core.state.daily ? N.core.state.daily.date : "";
          const yesterdayDate = localDate(new Date(Date.now() - 86400000));
          const streak = prevDate === yesterdayDate ? (N.core.state.daily.streak || 0) + 1 : 1;
          N.core.state.daily = { date: today, correct: score, total: picks.length, streak };
          N.core.save();
          $("#dcStreak", host).textContent = streak;
          if (score === picks.length) N.core.setScore("daily-challenge", streak);
        }
        $("#dcResult", host).textContent = `Skor latihan: ${score}/${picks.length}` + (first ? " · Disimpan sebagai hasil harian." : " · Sudah pernah disimpan hari ini.");
        N.core.toast("Tantangan selesai: " + score + "/" + picks.length, score === picks.length ? "ok" : "info");
      }
    });
    bindFav(host, tool.id);
    N.core.trackTool(tool.id, "utility");
    render();
  };

  /* ============================== Cek Penipuan (Bewary API) ============================== */
  const BEWARY_BASE = "https://api.bewary.app";
  const BEWARY_KEY_STORE = "bewary";
  const BEWARY_TYPES = {
    url: { label: "Link / URL", hint: "https://contoh.com/halaman", path: (v) => "/v1/url?u=" + encodeURIComponent(v) },
    domain: { label: "Domain", hint: "contoh.com", path: (v) => "/v1/domain/" + encodeURIComponent(v) },
    phone: { label: "Nomor telepon", hint: "+6281234567890", path: (v) => "/v1/phone/" + encodeURIComponent(v.replace(/\s+/g, "")) },
    email: { label: "Email", hint: "nama@contoh.com", path: (v) => "/v1/email/" + encodeURIComponent(v) },
    ip: { label: "Alamat IP", hint: "203.0.113.10", path: (v) => "/v1/ip/" + encodeURIComponent(v) },
    iban: { label: "IBAN", hint: "DE89370400440532013000", path: (v) => "/v1/iban/" + encodeURIComponent(v.replace(/\s+/g, "")) },
    wallet: { label: "Dompet kripto", hint: "alamat wallet", needs: "chain", path: (v, x) => "/v1/wallet/" + encodeURIComponent(x.chain) + "/" + encodeURIComponent(v) },
    handle: { label: "Handle pembayaran", hint: "$cashtag atau @username", needs: "provider", path: (v, x) => "/v1/payment-handle/" + encodeURIComponent(x.provider) + "/" + encodeURIComponent(v.replace(/^[@$]/, "")) }
  };
  const BEWARY_PROVIDERS = [["cashapp", "Cash App"], ["paypal", "PayPal"], ["venmo", "Venmo"]];
  const BEWARY_ERRORS = {
    400: "Permintaan tidak valid. Periksa format nilai.",
    401: "API key tidak valid atau tidak ada.",
    403: "API key ditolak. Cek status akun Anda di bewary.app.",
    402: "Kredit habis. Tambah kredit atau tunggu bulan berikutnya.",
    404: "Data tidak ditemukan untuk nilai ini.",
    429: "Terlalu banyak request. Tunggu sebentar lalu coba lagi."
  };

  impl.scamcheck = (host, tool) => {
    const readKey = () => N.security.getKey(BEWARY_KEY_STORE);
    const writeKey = (v) => N.security.setKey(BEWARY_KEY_STORE, v);
    const typeOptions = Object.entries(BEWARY_TYPES).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join("");

    host.innerHTML = head(tool) + `
      <div class="grid grid-2">
        <div class="card card-pad">
          <h3 class="card-title">Cek sesuatu</h3>
          <label class="field mt-16"><span>API key Bewary</span>
            <input type="password" id="bwKey" autocomplete="off" spellcheck="false" placeholder="Tempel API key dari bewary.app/account"></label>
          <p class="hint mt-8">Key default hanya disimpan di memory (hilang saat tab ditutup). Aktifkan "ingat untuk tab ini" di Security Center bila perlu. Request melewati guard dan hanya dikirim ke ${esc(BEWARY_BASE.replace("https://", ""))}.</p>
          <label class="field mt-16"><span>Jenis pengecekan</span><select id="bwType">${typeOptions}</select></label>
          <div id="bwExtra"></div>
          <label class="field mt-16"><span id="bwValueLabel">Nilai</span><input type="text" id="bwValue" autocomplete="off" spellcheck="false"></label>
          <div class="row mt-16">
            <button class="btn btn-primary" id="bwRun" type="button">${ico("sparkle")}<span>Cek</span></button>
            <button class="btn btn-sm btn-ghost" id="bwClear" type="button">Bersihkan hasil</button>
          </div>
          <div class="status-line mt-8" id="bwStatus"></div>
        </div>
        <div class="card card-pad">
          <h3 class="card-title">Hasil</h3>
          <div id="bwResult" class="mt-16"><p class="hint">Belum ada pengecekan.</p></div>
        </div>
      </div>`;

    const $b = (s) => $(s, host);
    const keyInput = $b("#bwKey");
    keyInput.value = readKey();
    keyInput.addEventListener("change", () => writeKey(keyInput.value.trim()));

    function renderExtra() {
      const type = BEWARY_TYPES[$b("#bwType").value];
      $b("#bwValue").placeholder = type.hint;
      $b("#bwValueLabel").textContent = "Nilai — " + type.label;
      if (type.needs === "chain") {
        $b("#bwExtra").innerHTML = `<label class="field mt-16"><span>Chain</span><input type="text" id="bwChain" autocomplete="off" placeholder="contoh: bitcoin atau ethereum"></label>`;
      } else if (type.needs === "provider") {
        $b("#bwExtra").innerHTML = `<label class="field mt-16"><span>Penyedia</span><select id="bwProvider">${BEWARY_PROVIDERS.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("")}</select></label>`;
      } else {
        $b("#bwExtra").innerHTML = "";
      }
    }

    function actionFor(verdict) {
      if (verdict === "scam") return { label: "Blokir", tone: "#b91c1c" };
      if (verdict === "safe") return { label: "Boleh", tone: "#15803d" };
      return { label: "Peringatan — jangan anggap aman", tone: "#b45309" };
    }

    function renderResult(data) {
      const verdict = String(data.verdict || "unknown");
      const act = actionFor(verdict);
      const pct = typeof data.p_scam === "number" ? Math.round(data.p_scam * 100) + "%" : "—";
      const codes = Array.isArray(data.reason_codes) ? data.reason_codes : [];
      $b("#bwResult").innerHTML = `
        <div class="row"><span class="badge" style="background:${act.tone};color:#fff">${esc(verdict.toUpperCase())}</span>
          <span class="hint">Probabilitas penipuan: <strong>${esc(pct)}</strong></span></div>
        <p class="mt-8"><strong>Saran tindakan:</strong> ${esc(act.label)}</p>
        <p class="hint mt-8">Alasan (reason codes):</p>
        ${codes.length ? `<ul>${codes.map((c) => `<li class="mono">${esc(c)}</li>`).join("")}</ul>` : `<p class="hint">Tidak ada reason code.</p>`}
        <details class="mt-8"><summary>Lihat JSON lengkap</summary><pre class="output-preview" style="min-height:0">${esc(JSON.stringify(data, null, 2))}</pre></details>`;
    }

    function showError(msg) {
      $b("#bwResult").innerHTML = `<div class="notice err"><span>!</span><span>${esc(msg)}</span></div>`;
    }

    async function runCheck() {
      const key = keyInput.value.trim();
      const typeKey = $b("#bwType").value;
      const type = BEWARY_TYPES[typeKey];
      const value = $b("#bwValue").value.trim();
      const status = $b("#bwStatus");
      if (!key) { status.className = "status-line bad"; status.textContent = "Masukkan API key Bewary dulu."; return; }
      if (!value) { status.className = "status-line bad"; status.textContent = "Isi nilai yang ingin dicek."; return; }
      const extra = {};
      if (type.needs === "chain") { extra.chain = ($b("#bwChain") || {}).value?.trim() || ""; if (!extra.chain) { status.className = "status-line bad"; status.textContent = "Isi chain dompet dulu."; return; } }
      if (type.needs === "provider") extra.provider = ($b("#bwProvider") || {}).value || "";

      const btn = $b("#bwRun");
      btn.disabled = true;
      status.className = "status-line";
      status.textContent = "Memeriksa…";
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      try {
        const res = await N.security.fetch(BEWARY_BASE + type.path(value, extra), {
          headers: { Authorization: "Bearer " + key, Accept: "application/json" },
          signal: ctrl.signal
        });
        const text = await res.text();
        let data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
        if (!res.ok) {
          const msg = (data && (data.error || data.message)) || BEWARY_ERRORS[res.status] || ("Gagal (HTTP " + res.status + ").");
          showError(BEWARY_ERRORS[res.status] ? BEWARY_ERRORS[res.status] : msg);
          status.className = "status-line bad";
          status.textContent = "Gagal · HTTP " + res.status;
        } else if (!data) {
          showError("Respons Bewary tidak bisa dibaca sebagai JSON.");
          status.className = "status-line bad";
          status.textContent = "Respons tidak valid.";
        } else {
          renderResult(data);
          status.className = "status-line ok";
          status.textContent = "Selesai.";
          N.core.trackTool(tool.id, "utility");
        }
      } catch (err) {
        const msg = err && err.blocked
          ? N.security.redact(err.message)
          : err && err.name === "AbortError"
            ? "Waktu habis (12 detik). Coba lagi."
            : N.security.redact("Gagal terhubung ke Bewary. Cek koneksi atau izinkan mode eksternal di Security Center.");
        showError(msg);
        status.className = "status-line bad";
        status.textContent = "Gagal terhubung.";
      } finally {
        clearTimeout(timer);
        btn.disabled = false;
      }
    }

    $b("#bwType").addEventListener("change", renderExtra);
    $b("#bwRun").addEventListener("click", runCheck);
    $b("#bwValue").addEventListener("keydown", (e) => { if (e.key === "Enter") runCheck(); });
    $b("#bwClear").addEventListener("click", () => {
      $b("#bwValue").value = "";
      $b("#bwResult").innerHTML = '<p class="hint">Belum ada pengecekan.</p>';
      $b("#bwStatus").textContent = "";
    });
    bindFav(host, tool.id);
    renderExtra();
  };

  /* ============================== Lirik & Spotify (apiii-xrina) ============================== */
  const XRINA_BASE = "https://apiii-xrina.my.id";
  async function xrinaGet(path, timeoutMs) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs || 15000);
    try {
      const res = await N.security.fetch(XRINA_BASE + path, { headers: { Accept: "application/json" }, signal: ctrl.signal });
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
      if (!res.ok) throw new Error("Server merespons HTTP " + res.status + ".");
      if (!data || data.status !== true) throw new Error((data && (data.message || data.error)) || "Tidak ada hasil untuk pencarian ini.");
      return data;
    } catch (err) {
      if (err && err.blocked) throw err;
      if (err && err.name === "AbortError") throw new Error("Waktu habis. Coba lagi.");
      if (err instanceof TypeError) throw new Error("Gagal terhubung ke server. Cek koneksi, atau aktifkan mode eksternal di Security Center.");
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  function fmtDuration(sec) {
    const n = Math.max(0, Math.round(Number(sec) || 0));
    return Math.floor(n / 60) + ":" + String(n % 60).padStart(2, "0");
  }
  function searchForm(id, placeholder, buttonLabel) {
    return `<form class="row mt-16" id="${id}Form" autocomplete="off">
      <input type="search" id="${id}Q" placeholder="${esc(placeholder)}" maxlength="120" style="flex:1;min-width:0" required>
      <button class="btn btn-primary" type="submit">${esc(buttonLabel)}</button></form>
      <div class="status-line mt-8" id="${id}Status"></div>`;
  }

  impl.lyrics = (host, tool) => {
    host.innerHTML = head(tool) + `<div class="card card-pad">
      <h3 class="card-title">Cari lirik</h3>
      <p class="hint mt-8">Tulis judul dan artis, misalnya <span class="mono">soulmate kahitna</span>.</p>
      ${searchForm("lyr", "Judul lagu dan artis", "Cari lirik")}
      <div id="lyrResult" class="mt-16"><p class="hint">Belum ada pencarian.</p></div>
      <p class="hint mt-16">Sumber: ${esc(XRINA_BASE.replace("https://", ""))} · creator: Rin imup</p>
    </div>`;
    const $l = (s) => $(s, host);
    $l("#lyrForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const q = $l("#lyrQ").value.trim();
      const status = $l("#lyrStatus");
      if (!q) return;
      status.className = "status-line"; status.textContent = "Mencari lirik…";
      try {
        const data = await xrinaGet("/search/lyrics?q=" + encodeURIComponent(q));
        const d = data.data || {};
        const lyrics = String(d.lyrics || "").trim();
        $l("#lyrResult").innerHTML = `
          <h3 class="card-title">${esc(d.title || "Tanpa judul")}</h3>
          <p class="hint">${esc(d.artist || "-")}${d.album ? " · " + esc(d.album) : ""}${d.duration ? " · " + fmtDuration(d.duration) : ""}</p>
          <div class="row mt-8"><button class="btn btn-sm" id="lyrCopy" type="button">Salin lirik</button></div>
          <pre class="output-preview mt-8" style="white-space:pre-wrap;min-height:0">${esc(lyrics || "Lirik tidak tersedia untuk lagu ini.")}</pre>`;
        const copyBtn = $l("#lyrCopy");
        if (copyBtn) copyBtn.addEventListener("click", async () => { if (await N.core.copy(lyrics)) N.core.toast("Lirik disalin.", "ok"); });
        status.className = "status-line ok"; status.textContent = "Ditemukan.";
        N.core.trackTool(tool.id, "utility");
      } catch (err) {
        $l("#lyrResult").innerHTML = `<div class="notice err"><span>!</span><span>${esc(err.message)}</span></div>`;
        status.className = "status-line bad"; status.textContent = "Gagal.";
      }
    });
    bindFav(host, tool.id);
  };

  impl.spotify = (host, tool) => {
    host.innerHTML = head(tool) + `<div class="card card-pad">
      <h3 class="card-title">Cari di Spotify</h3>
      <p class="hint mt-8">Hasil berupa lagu, artis, album, dan playlist. Klik judul untuk membuka di Spotify.</p>
      ${searchForm("spot", "Nama lagu, artis, album, atau playlist", "Cari")}
      <div id="spotResult" class="mt-16"><p class="hint">Belum ada pencarian.</p></div>
      <p class="hint mt-16">Sumber: ${esc(XRINA_BASE.replace("https://", ""))} · creator: Rin imup</p>
    </div>`;
    const $s = (s) => $(s, host);
    const spotifyUrl = (uri) => {
      const m = /^spotify:(track|artist|album|playlist):([A-Za-z0-9]+)$/.exec(String(uri || ""));
      return m ? `https://open.spotify.com/${m[1]}/${m[2]}` : "";
    };
    const row = (item, sub, type) => {
      const url = spotifyUrl(item.uri) || (item.id ? `https://open.spotify.com/${type}/${item.id}` : "");
      const img = item.poster ? `<img src="${esc(item.poster)}" alt="" loading="lazy" referrerpolicy="no-referrer" style="width:48px;height:48px;border-radius:8px;object-fit:cover;flex:none">` : `<span class="mi" style="width:48px;height:48px;display:grid;place-items:center;flex:none">${ico("music")}</span>`;
      const title = url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer"><strong>${esc(item.name || "-")}</strong></a>` : `<strong>${esc(item.name || "-")}</strong>`;
      return `<div class="row mt-8" style="align-items:center">${img}<div style="min-width:0"><div>${title}</div><div class="hint">${esc(sub)}</div></div></div>`;
    };
    const section = (title, items, render) => {
      if (!items.length) return "";
      return `<h4 class="mt-16">${esc(title)}</h4>${items.map(render).join("")}`;
    };
    $s("#spotForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const q = $s("#spotQ").value.trim();
      const status = $s("#spotStatus");
      if (!q) return;
      status.className = "status-line"; status.textContent = "Mencari…";
      try {
        const data = await xrinaGet("/search/spotify?query=" + encodeURIComponent(q));
        const d = data.data || {};
        const names = (arr) => (Array.isArray(arr) ? arr.map((a) => a && a.name).filter(Boolean).join(", ") : "");
        const tracks = Array.isArray(d.tracks) ? d.tracks : [];
        const artists = Array.isArray(d.artists) ? d.artists : [];
        const albums = Array.isArray(d.albums) ? d.albums : [];
        const playlists = Array.isArray(d.playlists) ? d.playlists : [];
        const html = [
          section("Lagu", tracks, (t) => row(t, names(t.artists), "track")),
          section("Artis", artists, (a) => row(a, a.verified ? "Artis terverifikasi" : "Artis", "artist")),
          section("Album", albums, (a) => row(a, names(a.artists), "album")),
          section("Playlist", playlists, (p) => row(p, p.owner && p.owner.name ? "oleh " + p.owner.name : "Playlist", "playlist"))
        ].join("");
        $s("#spotResult").innerHTML = html || '<p class="hint">Tidak ada hasil.</p>';
        status.className = "status-line ok"; status.textContent = "Ditemukan " + (tracks.length + artists.length + albums.length + playlists.length) + " hasil.";
        N.core.trackTool(tool.id, "utility");
      } catch (err) {
        $s("#spotResult").innerHTML = `<div class="notice err"><span>!</span><span>${esc(err.message)}</span></div>`;
        status.className = "status-line bad"; status.textContent = "Gagal.";
      }
    });
    bindFav(host, tool.id);
  };

  /* ============================== GitHub profil & email sementara (apiii-xrina) ============================== */
  const fmtDate = (iso) => { const d = new Date(iso); return isNaN(d) ? "-" : d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }); };

  impl["github-profile"] = (host, tool) => {
    host.innerHTML = head(tool) + `<div class="card card-pad">
      <h3 class="card-title">Cari profil GitHub</h3>
      <p class="hint mt-8">Hanya menampilkan data profil dan repositori publik.</p>
      ${searchForm("gh", "Username GitHub, misalnya octocat", "Cari profil")}
      <div id="ghResult" class="mt-16"><p class="hint">Belum ada pencarian.</p></div>
      <p class="hint mt-16">Sumber: ${esc(XRINA_BASE.replace("https://", ""))} · creator: Rin imup</p>
    </div>`;
    const $g = (s) => $(s, host);
    $g("#ghForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const u = $g("#ghQ").value.trim().replace(/^@/, "");
      const status = $g("#ghStatus");
      if (!u) return;
      status.className = "status-line"; status.textContent = "Mengambil profil…";
      try {
        const data = await xrinaGet("/stalker/stalk-gh?username=" + encodeURIComponent(u));
        const d = data.data || {};
        const user = d.user || {};
        const stats = d.stats || {};
        const repos = Array.isArray(d.repositories) ? d.repositories : [];
        const events = Array.isArray(d.recent_events) ? d.recent_events : [];
        const row = (k, v) => v ? `<div class="hint">${esc(k)}</div><div>${esc(String(v))}</div>` : "";
        $g("#ghResult").innerHTML = `
          <div class="row" style="align-items:center">
            ${user.avatar_url ? `<img src="${esc(user.avatar_url)}" alt="" referrerpolicy="no-referrer" style="width:64px;height:64px;border-radius:50%;flex:none">` : ""}
            <div style="min-width:0"><h3 class="card-title">${esc(user.name || user.login || u)}</h3>
            <a href="${esc(user.html_url || "https://github.com/" + u)}" target="_blank" rel="noopener noreferrer" class="hint">@${esc(user.login || u)}</a></div>
          </div>
          ${user.bio ? `<p class="mt-8">${esc(user.bio)}</p>` : ""}
          <div class="grid grid-2 mt-16" style="gap:8px 16px">
            ${row("Followers", user.followers)}${row("Following", user.following)}
            ${row("Repo publik", user.public_repos)}${row("Lokasi", user.location)}
            ${row("Perusahaan", user.company)}${row("Website", user.blog)}
            ${row("Bergabung", user.created_at ? fmtDate(user.created_at) : "")}
            ${row("Terakhir update", user.updated_at ? fmtDate(user.updated_at) : "")}
          </div>
          ${Object.keys(stats).length ? `<p class="hint mt-16">Total repo ${esc(stats.total_repos ?? "-")} · bintang ${esc(stats.total_stars ?? "-")} · fork ${esc(stats.total_forks ?? "-")}${Array.isArray(stats.languages) && stats.languages.length ? " · bahasa: " + esc(stats.languages.join(", ")) : ""}</p>` : ""}
          ${repos.length ? `<h4 class="mt-16">Repositori</h4>${repos.slice(0, 12).map((r) => `<div class="mt-8"><a href="${esc(r.html_url || "#")}" target="_blank" rel="noopener noreferrer"><strong>${esc(r.name || r.full_name || "-")}</strong></a>
            <div class="hint">${esc(r.description || "")}${r.language ? " · " + esc(r.language) : ""}${r.stargazers_count != null ? " · bintang " + esc(r.stargazers_count) : ""}</div></div>`).join("")}` : ""}
          ${events.length ? `<h4 class="mt-16">Aktivitas terbaru</h4>${events.slice(0, 10).map((ev) => `<div class="hint mt-8">${esc(ev.type || "Event")}${ev.repo && ev.repo.name ? " · " + esc(ev.repo.name) : ev.repo ? " · " + esc(ev.repo) : ""}${ev.created_at ? " · " + esc(fmtDate(ev.created_at)) : ""}</div>`).join("")}` : ""}`;
        status.className = "status-line ok"; status.textContent = "Profil ditemukan.";
        N.core.trackTool(tool.id, "utility");
      } catch (err) {
        $g("#ghResult").innerHTML = `<div class="notice err"><span>!</span><span>${esc(err.message)}</span></div>`;
        status.className = "status-line bad"; status.textContent = "Gagal.";
      }
    });
    bindFav(host, tool.id);
  };

  impl["temp-email"] = (host, tool) => {
    let current = "";
    host.innerHTML = head(tool) + `<div class="card card-pad">
      <h3 class="card-title">Buat email sementara</h3>
      <p class="hint mt-8">Buat alamat baru, lalu cek inbox-nya. Pakai hanya untuk keperluan Anda sendiri, misalnya testing, dan sesuai aturan layanan yang Anda daftari.</p>
      <div class="row mt-16"><button class="btn btn-primary" id="teCreate" type="button">+ Buat alamat baru</button></div>
      <div id="teAddr" class="mt-16"></div>
      <form class="row mt-16" id="teForm" autocomplete="off">
        <label class="field" style="flex:1;min-width:0"><span>Jumlah pesan (1–50)</span><input type="number" id="teLimit" min="1" max="50" value="20"></label>
        <button class="btn" type="submit" style="align-self:flex-end">Cek inbox</button>
      </form>
      <div class="status-line mt-8" id="teStatus"></div>
      <div id="teInbox" class="mt-16"><p class="hint">Belum ada pengecekan inbox.</p></div>
      <p class="hint mt-16">Sumber: ${esc(XRINA_BASE.replace("https://", ""))} · creator: Rin imup</p>
    </div>`;
    const $t = (s) => $(s, host);
    const setStatus = (msg, cls) => { $t("#teStatus").className = "status-line" + (cls ? " " + cls : ""); $t("#teStatus").textContent = msg; };

    function renderAddress() {
      $t("#teAddr").innerHTML = current
        ? `<div class="row" style="align-items:center"><span class="mono" style="word-break:break-all">${esc(current)}</span>
             <button class="btn btn-sm" id="teCopy" type="button">Salin</button></div>`
        : "";
      const copy = $t("#teCopy");
      if (copy) copy.addEventListener("click", async () => { if (await N.core.copy(current)) N.core.toast("Alamat disalin.", "ok"); });
    }

    // Ambil array pesan dari respons apa pun: cari array pertama di dalam data.
    function findMessages(d) {
      if (Array.isArray(d)) return d;
      if (d && typeof d === "object") {
        for (const v of Object.values(d)) if (Array.isArray(v)) return v;
      }
      return null;
    }

    $t("#teCreate").addEventListener("click", async () => {
      setStatus("Membuat alamat…");
      try {
        const data = await xrinaGet("/tools/create-email?action=create");
        current = (data.data && data.data.email) || "";
        if (!current) throw new Error("Alamat tidak ada di respons.");
        renderAddress();
        $t("#teInbox").innerHTML = '<p class="hint">Belum ada pengecekan inbox.</p>';
        setStatus("Alamat baru siap.", "ok");
        N.core.trackTool(tool.id, "utility");
      } catch (err) {
        setStatus(err.message, "bad");
      }
    });

    $t("#teForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!current) { setStatus("Buat alamat dulu.", "bad"); return; }
      const limit = Math.min(50, Math.max(1, parseInt($t("#teLimit").value, 10) || 20));
      setStatus("Mengecek inbox…");
      try {
        const data = await xrinaGet("/tools/create-email?action=inbox&email=" + encodeURIComponent(current) + "&limit=" + limit);
        const msgs = findMessages(data.data);
        if (msgs && msgs.length) {
          $t("#teInbox").innerHTML = msgs.map((m) => {
            const from = m.from || m.sender || (m.from_name ? m.from_name : "");
            const subject = m.subject || m.title || "(tanpa subjek)";
            const body = m.text || m.body || m.snippet || m.html || "";
            return `<div class="card card-pad mt-8"><strong>${esc(subject)}</strong>
              <div class="hint">${esc(from)}${m.date || m.created_at ? " · " + esc(m.date || m.created_at) : ""}</div>
              <pre class="output-preview mt-8" style="white-space:pre-wrap;min-height:0">${esc(String(body).slice(0, 3000) || "(isi kosong)")}</pre></div>`;
          }).join("");
          setStatus(msgs.length + " pesan ditemukan.", "ok");
        } else {
          $t("#teInbox").innerHTML = `<p class="hint">Inbox kosong atau format pesan belum dikenali. Respons mentah:</p>
            <pre class="output-preview" style="min-height:0">${esc(JSON.stringify(data, null, 2))}</pre>`;
          setStatus("Tidak ada pesan.", "");
        }
        N.core.trackTool(tool.id, "utility");
      } catch (err) {
        $t("#teInbox").innerHTML = `<div class="notice err"><span>!</span><span>${esc(err.message)}</span></div>`;
        setStatus("Gagal.", "bad");
      }
    });
    bindFav(host, tool.id);
  };

  /* ============================== Screenshot & website ke ZIP (apiii-xrina) ============================== */
  function cleanPublicUrl(raw) {
    let u;
    try { u = new URL(String(raw || "").trim()); } catch (e) { throw new Error("Format URL tidak valid. Contoh: https://contoh.com"); }
    if (!/^https?:$/.test(u.protocol)) throw new Error("Hanya URL http atau https yang didukung.");
    if (/^(localhost|127\.|0\.0\.0\.0|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname) || u.hostname.endsWith(".local")) {
      throw new Error("Alamat lokal (localhost / IP privat) tidak bisa diakses dari layanan ini. Pakai URL publik.");
    }
    return u.href;
  }
  // Cari URL gambar di dalam objek respons: nilai berekstensi gambar, atau nilai di bawah key url/image/screenshot/src.
  const IMG_KEYS = /^(url|image|img|src|screenshot|shot|link|href)$/i;
  function findImageUrl(node, depth, keyName) {
    if (depth > 5 || node == null) return "";
    if (typeof node === "string") {
      if (!/^https?:\/\/\S+$/i.test(node)) return "";
      if (/\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(node)) return node;
      if (keyName && IMG_KEYS.test(keyName)) return node;
      return "";
    }
    if (typeof node === "object") {
      if (Array.isArray(node)) {
        for (const v of node) { const hit = findImageUrl(v, depth + 1, keyName); if (hit) return hit; }
        return "";
      }
      for (const [k, v] of Object.entries(node)) {
        if (k === "error" || k === "report") continue;
        const hit = findImageUrl(v, depth + 1, k); if (hit) return hit;
      }
    }
    return "";
  }

  impl.ssweb = (host, tool) => {
    host.innerHTML = head(tool) + `<div class="card card-pad">
      <h3 class="card-title">Screenshot website</h3>
      <p class="hint mt-8">Ambil gambar tampilan desktop, tablet, dan mobile dari URL publik.</p>
      ${searchForm("ss", "https://contoh.com", "Ambil screenshot")}
      <div id="ssResult" class="mt-16"><p class="hint">Belum ada screenshot.</p></div>
      <p class="hint mt-16">Sumber: ${esc(XRINA_BASE.replace("https://", ""))} · creator: Rin imup</p>
    </div>`;
    const $x = (s) => $(s, host);
    $x("#ssForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const status = $x("#ssStatus");
      let target;
      try { target = cleanPublicUrl($x("#ssQ").value); } catch (err) { status.className = "status-line bad"; status.textContent = err.message; return; }
      status.className = "status-line"; status.textContent = "Mengambil screenshot… bisa memakan waktu";
      try {
        const data = await xrinaGet("/tools/ssweb?url=" + encodeURIComponent(target), 60000);
        const d = data.data || {};
        const shotInfo = data.target ? `<p class="hint">Target: <span class="mono">${esc(data.target)}</span></p>` : "";
        const SS_MSG = {
          ERATE: "Batas harian layanan screenshot sudah habis. Coba lagi besok, atau gunakan paket berbayar di layanan asalnya.",
          EFORBIDDENURL: "Layanan menolak URL ini. Pastikan URL-nya publik dan bisa dibuka dari internet."
        };
        const ssErrText = (er) => SS_MSG[er.code] || er.message || er.code || "Gagal mengambil screenshot.";
        const vpErrors = ["desktop", "tablet", "mobile"].map((vp) => (d[vp] && d[vp].error) || null);
        if (vpErrors.every((er) => er) && vpErrors.every((er) => er.code === vpErrors[0].code)) {
          $x("#ssResult").innerHTML = shotInfo + `<div class="notice err"><span>!</span><span>${esc(ssErrText(vpErrors[0]))}</span></div>`;
          status.className = "status-line bad"; status.textContent = "Gagal · " + vpErrors[0].code;
          return;
        }
        const cards = shotInfo + ["desktop", "tablet", "mobile"].map((vp) => {
          const v = d[vp] || {};
          if (v.error) {
            return `<div class="mt-8"><strong>${esc(vp)}</strong><div class="notice err"><span>!</span><span>${esc(ssErrText(v.error))}</span></div></div>`;
          }
          const img = findImageUrl(v, 0, "");
          return `<div class="mt-8"><strong>${esc(vp)}</strong>${img
            ? `<a href="${esc(img)}" target="_blank" rel="noopener noreferrer"><img src="${esc(img)}" alt="Screenshot ${esc(vp)}" loading="lazy" referrerpolicy="no-referrer" style="width:100%;border-radius:10px;margin-top:6px"></a>`
            : `<pre class="output-preview" style="min-height:0">${esc(JSON.stringify(v, null, 2))}</pre>`}</div>`;
        }).join("");
        $x("#ssResult").innerHTML = cards;
        status.className = "status-line ok"; status.textContent = "Selesai.";
        N.core.trackTool(tool.id, "utility");
      } catch (err) {
        $x("#ssResult").innerHTML = `<div class="notice err"><span>!</span><span>${esc(err.message)}</span></div>`;
        status.className = "status-line bad"; status.textContent = "Gagal.";
      }
    });
    bindFav(host, tool.id);
  };

  impl.webtozip = (host, tool) => {
    host.innerHTML = head(tool) + `<div class="card card-pad">
      <h3 class="card-title">Website ke ZIP</h3>
      <p class="hint mt-8">Unduh salinan file website publik dalam bentuk ZIP. Gunakan hanya untuk website milik Anda atau yang sudah mendapat izin pemiliknya.</p>
      ${searchForm("wz", "https://contoh.vercel.app", "Buat ZIP")}
      <div id="wzResult" class="mt-16"><p class="hint">Belum ada arsip.</p></div>
      <p class="hint mt-16">Sumber: ${esc(XRINA_BASE.replace("https://", ""))} · creator: Rin imup</p>
    </div>`;
    const $w = (s) => $(s, host);
    $w("#wzForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const status = $w("#wzStatus");
      let target;
      try { target = cleanPublicUrl($w("#wzQ").value); } catch (err) { status.className = "status-line bad"; status.textContent = err.message; return; }
      status.className = "status-line"; status.textContent = "Menyiapkan arsip…";
      try {
        const data = await xrinaGet("/tools/webtozip?url=" + encodeURIComponent(target), 60000);
        const d = data.data || {};
        if (!d.download_url) throw new Error("Link unduhan tidak ada di respons.");
        $w("#wzResult").innerHTML = `
          <p><strong>${esc(d.file_name || "website.zip")}</strong></p>
          <p class="hint">${esc(d.domain || "")}${d.total_files != null ? " · " + esc(d.total_files) + " file" : ""}</p>
          <div class="row mt-8"><a class="btn btn-primary" href="${esc(d.download_url)}" target="_blank" rel="noopener noreferrer" download>Unduh ZIP</a></div>
          <p class="hint mt-8">File diunduh dari server pihak ketiga, bukan dari toolbox ini.</p>`;
        status.className = "status-line ok"; status.textContent = "Arsip siap.";
        N.core.trackTool(tool.id, "utility");
      } catch (err) {
        $w("#wzResult").innerHTML = `<div class="notice err"><span>!</span><span>${esc(err.message)}</span></div>`;
        status.className = "status-line bad"; status.textContent = "Gagal.";
      }
    });
    bindFav(host, tool.id);
  };

  /* ============================== dispatcher ============================== */
  function render(host, id) {
    N.core.addCleanup(() => {
      if (beepContext && beepContext.state !== "closed") {
        try { beepContext.close().catch(() => {}); } catch (e) {}
      }
      beepContext = null;
    });
    if (id === "qr") {
      host.innerHTML = head(N.registry.get("qr"));
      const child = document.createElement("div");
      host.appendChild(child);
      N.qr.render(child);
      bindFav(host, "qr");
      N.core.trackTool("qr", "utility");
      return;
    }
    if (id === "photolive") {
      host.innerHTML = head(N.registry.get("photolive"));
      const child = document.createElement("div");
      host.appendChild(child);
      N.photolive.render(child);
      bindFav(host, "photolive");
      N.core.trackTool("photolive", "utility");
      return;
    }
    const fn = impl[id] || (N.toolkit && N.toolkit.impl[id]);
    const tool = N.registry.get(id);
    if (!fn || !tool) { host.innerHTML = '<div class="empty"><strong>Utility tidak ditemukan.</strong></div>'; return; }
    fn(host, tool);
  }

  N.utilities = { render, impl };
})(window.Nexus = window.Nexus || {});
