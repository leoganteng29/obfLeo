/* NEXUS TOOLBOX — Game Center */
(function (N) {
  "use strict";
  const { escapeHtml: esc } = N.core;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  function best(id, lower) {
    const v = N.core.state.scores[id];
    if (v == null) return "—";
    if (v && typeof v === "object") {
      const w = Number(v.wins || v.w || 0), l = Number(v.losses || v.l || 0), d = Number(v.draws || v.d || 0);
      return `${w}W/${l}L/${d}D`;
    }
    return lower ? v + " klik" : v;
  }
  function scoreBar(pairs) {
    return `<div class="game-scorebar">${pairs.map(([a, b]) => `<span class="score-pill">${esc(a)} <strong>${esc(b)}</strong></span>`).join("")}</div>`;
  }
  function diffControl(current) {
    return `<div class="segmented" data-diff><button data-d="easy" class="${current === "easy" ? "active" : ""}">Mudah</button>
      <button data-d="normal" class="${current === "normal" ? "active" : ""}">Normal</button>
      <button data-d="hard" class="${current === "hard" ? "active" : ""}">Sulit</button></div>`;
  }
  function head(tool, right) {
    return `<div class="workspace-head"><div><span class="eyebrow">Game Center</span><h1 class="page-title">${esc(tool.name)}</h1>
      <p class="sub">${esc(tool.desc)}</p></div><div class="row">${right || ""}<button class="btn btn-sm btn-ghost" data-game="fav" type="button">☆ Simpan</button></div></div>`;
  }
  function bindFav(host, id) {
    host.addEventListener("click", (e) => {
      const b = e.target.closest('[data-game="fav"]');
      if (!b) return;
      const on = N.core.toggleFavorite(id);
      b.textContent = on ? "★ Tersimpan" : "☆ Simpan";
      N.core.toast(on ? "Disimpan." : "Dihapus.", "ok");
    });
  }
  function track(id) {
    N.core.trackTool(id, "game");
    N.core.state.scores = N.core.state.scores || {};
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ============================== games ============================== */
  const impl = {};

  impl.reaction = (host, tool) => {
    let diff = N.core.state.settings.difficulty || "normal";
    let round = 0, times = [], phase = "idle", timer = null, goAt = 0;
    const totalRounds = 5;
    host.innerHTML = head(tool, diffControl(diff)) + `<div class="card card-pad game-stage">
      <div class="game-head">${scoreBar([["Rekor", best("reaction", true) + " ms"], ["Rata-rata", "—"]])}<span class="badge" id="rxRound">Babak 0/${totalRounds}</span></div>
      <div class="game-body"><div class="reaction-pad" id="rxPad" role="button" tabindex="0"><strong id="rxText">Tekan tombol untuk mulai</strong><small class="muted" id="rxSub">5 babak · pengukuran dalam milidetik</small></div>
      <div class="row mt-16"><button class="btn btn-primary" data-rx="start" type="button">▶ Ulangi tes</button><span class="game-log" id="rxLog"></span></div></div></div>`;
    const pad = $("#rxPad", host), text = $("#rxText", host), sub = $("#rxSub", host);
    function delays() { return diff === "easy" ? [1200, 3000] : diff === "hard" ? [500, 1700] : [800, 2400]; }
    function nextRound() {
      if (round >= totalRounds) return finish();
      phase = "wait";
      pad.className = "reaction-pad wait";
      text.textContent = "Tunggu sinyal hijau...";
      sub.textContent = "Jangan klik sebelum sinyal!";
      $("#rxRound", host).textContent = `Babak ${round + 1}/${totalRounds}`;
      const [lo, hi] = delays();
      timer = setTimeout(() => {
        phase = "go"; goAt = performance.now();
        pad.className = "reaction-pad go";
        text.textContent = "KLICK SEKARANG!";
        sub.textContent = "⚡";
      }, lo + Math.random() * (hi - lo));
    }
    function finish() {
      phase = "done";
      const avg = Math.round(times.reduce((a, b) => a + b, 0) / (times.length || 1));
      pad.className = "reaction-pad";
      text.textContent = avg + " ms rata-rata";
      sub.textContent = "Tes selesai — tekan ulangi untuk mencoba lagi.";
      $("#rxLog", host).textContent = "Hasil: " + times.map((t) => t + "ms").join(" · ");
      N.core.toast("Reaction test selesai: " + avg + " ms", "ok");
    }
    function hit() {
      if (phase === "idle" || phase === "done") { round = 0; times = []; nextRound(); return; }
      if (phase === "wait") {
        clearTimeout(timer);
        phase = "idle"; pad.className = "reaction-pad";
        text.textContent = "Terlalu cepat!"; sub.textContent = "Klik untuk mencoba babak ini lagi.";
        return;
      }
      if (phase === "go") {
        const ms = Math.round(performance.now() - goAt);
        times.push(ms);
        round++;
        N.core.setScore("reaction", ms, false);
        text.textContent = ms + " ms";
        sub.textContent = "Babak selesai.";
        clearTimeout(timer);
        timer = setTimeout(nextRound, 850);
      }
    }
    pad.addEventListener("click", hit);
    pad.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); hit(); } });
    host.addEventListener("click", (e) => {
      if (e.target.closest('[data-rx="start"]')) { clearTimeout(timer); round = 0; times = []; nextRound(); }
      const d = e.target.closest("[data-d]");
      if (d) { diff = d.dataset.d; $$('[data-d]', host).forEach((b) => b.classList.toggle("active", b === d)); }
    });
    bindFav(host, tool.id); track(tool.id);
    N.core.addCleanup(() => clearTimeout(timer));
  };

  impl.memory = (host, tool) => {
    let diff = N.core.state.settings.difficulty || "normal";
    let lit = [], picked = [], mistakes = 0, cols = 4, total = 16, timer = null, started = 0;
    function config() {
      if (diff === "easy") return { cols: 4, total: 12, show: 2600 };
      if (diff === "hard") return { cols: 6, total: 24, show: 1500 };
      return { cols: 4, total: 16, show: 2000 };
    }
    host.innerHTML = head(tool, diffControl(diff)) + `<div class="card card-pad game-stage">
      <div class="game-head">${scoreBar([["Rekor", best("memory")], ["Salah", "0"]])}<span class="badge" id="memState">Menunggu</span></div>
      <div class="game-body"><div class="board" id="memBoard"></div>
      <div class="row mt-16"><button class="btn btn-primary" data-mem="start" type="button">▶ Mulai</button><span class="game-log" id="memLog">Hafal ubin yang menyala, lalu klik semuanya.</span></div></div></div>`;
    const board = $("#memBoard", host);
    function renderBoard(interactive) {
      board.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
      board.innerHTML = Array.from({ length: total }, (_, i) => `<button type="button" class="tile ${lit.includes(i) ? (interactive ? "face" : "lit") : ""} ${picked.includes(i) ? "matched" : ""}" data-i="${i}" ${interactive ? "" : "disabled"}>${picked.includes(i) ? "✓" : ""}</button>`).join("");
    }
    function start() {
      clearTimeout(timer);
      const c = config(); cols = c.cols; total = c.total;
      const count = Math.round(total / 2);
      lit = shuffle(Array.from({ length: total }, (_, i) => i)).slice(0, count);
      picked = []; mistakes = 0; started = performance.now();
      $("#memState", host).textContent = "Hafalan...";
      $("#memLog", host).textContent = "Perhatikan ubin yang menyala.";
      renderBoard(false);
      timer = setTimeout(() => {
        renderBoard(true);
        $("#memState", host).textContent = "Tebak!";
        $("#memLog", host).textContent = "Klik semua ubin yang tadi menyala.";
      }, c.show);
    }
    board.addEventListener("click", (e) => {
      const t = e.target.closest("[data-i]");
      if (!t) return;
      const i = Number(t.dataset.i);
      if ($("#memState", host).textContent !== "Tebak!") return;
      if (lit.includes(i)) {
        if (!picked.includes(i)) picked.push(i);
        t.classList.add("matched"); t.textContent = "✓";
        if (picked.length === lit.length) {
          const sec = (performance.now() - started) / 1000;
          const score = Math.max(10, Math.round(picked.length * 100 - mistakes * 25 - sec * 5));
          $("#memState", host).textContent = "Selesai";
          $("#memLog", host).textContent = `Benar! Skor ${score} · ${sec.toFixed(1)} detik · ${mistakes} salah.`;
          N.core.setScore("memory", score);
          N.core.toast("Skor memory: " + score, "ok");
        }
      } else {
        mistakes++;
        t.classList.add("wrong");
        setTimeout(() => t.classList.remove("wrong"), 320);
        $$(".score-pill strong", host)[1].textContent = mistakes;
      }
    });
    host.addEventListener("click", (e) => {
      if (e.target.closest('[data-mem="start"]')) start();
      const d = e.target.closest("[data-d]");
      if (d) { diff = d.dataset.d; $$('[data-d]', host).forEach((b) => b.classList.toggle("active", b === d)); }
    });
    bindFav(host, tool.id); track(tool.id);
    N.core.addCleanup(() => clearTimeout(timer));
    start();
  };

  impl.number = (host, tool) => {
    let diff = N.core.state.settings.difficulty || "normal";
    let target = 0, attempts = 0, done = false;
    function range() { return diff === "easy" ? 50 : diff === "hard" ? 500 : 100; }
    function reset() { target = 1 + Math.floor(Math.random() * range()); attempts = 0; done = false; }
    reset();
    host.innerHTML = head(tool, diffControl(diff)) + `<div class="card card-pad game-stage" style="max-width:620px;margin:auto">
      <div class="game-head">${scoreBar([["Rekor (paling sedikit)", best("number", true) + " klik"], ["Rentang", "1–" + range()]])}</div>
      <div class="game-body" style="text-align:center"><div class="big-time">?</div><p class="muted" id="nmHint">Tebak angka rahasia. Petunjuk muncul di bawah.</p>
      <div class="row" style="justify-content:center"><input type="number" id="nmGuess" style="max-width:140px" placeholder="Tebakan">
      <button class="btn btn-primary" data-nm="check" type="button">Cek</button><button class="btn" data-nm="reset" type="button">Angka baru</button></div>
      <div class="status-line mt-16" id="nmStatus">Percobaan: 0</div></div></div>`;
    function check() {
      if (done) return;
      const input = $("#nmGuess", host);
      const v = Number(input.value);
      if (!Number.isFinite(v)) { $("#nmStatus", host).textContent = "Masukkan angka."; return; }
      attempts++;
      if (v === target) {
        done = true;
        $("#nmHint", host).textContent = "🎯 Tepat!";
        $("#nmStatus", host).textContent = `Benar dalam ${attempts} percobaan.`;
        N.core.setScore("number", attempts, false);
        N.core.toast("Tebakan benar dalam " + attempts + " percobaan!", "ok");
      } else {
        $("#nmHint", host).textContent = v < target ? "↑ Lebih tinggi!" : "↓ Lebih rendah!";
        $("#nmStatus", host).textContent = `Percobaan: ${attempts}`;
        input.select();
      }
    }
    host.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.id === "nmGuess") check(); });
    host.addEventListener("click", (e) => {
      if (e.target.closest('[data-nm="check"]')) check();
      if (e.target.closest('[data-nm="reset"]')) {
        reset();
        $$(".score-pill strong", host)[1].textContent = "1–" + range();
        $("#nmHint", host).textContent = "Tebak angka rahasia.";
        $("#nmStatus", host).textContent = "Percobaan: 0";
        $("#nmGuess", host).value = "";
      }
      const d = e.target.closest("[data-d]");
      if (d) {
        diff = d.dataset.d;
        $$('[data-d]', host).forEach((b) => b.classList.toggle("active", b === d));
        reset();
        $$(".score-pill strong", host)[1].textContent = "1–" + range();
      }
    });
    bindFav(host, tool.id); track(tool.id);
  };

  impl.tictactoe = (host, tool) => {
    let board = Array(9).fill(""), turn = "X", over = false, diff = N.core.state.settings.difficulty || "normal", aiTimer = null;
    let rec = Object.assign({ wins: 0, losses: 0, draws: 0 }, N.core.state.scores.tictactoe || {});
    host.innerHTML = head(tool, diffControl(diff)) + `<div class="card card-pad game-stage" style="max-width:520px;margin:auto">
      <div class="game-head">${scoreBar([["Menang", "0"], ["Kalah", "0"], ["Seri", "0"]])}</div>
      <div class="game-body"><div class="board" id="ttBoard" style="grid-template-columns:repeat(3,1fr);max-width:330px"></div>
      <div class="row mt-16"><button class="btn btn-primary" data-tt="reset" type="button">↻ Main lagi</button><span class="game-log" id="ttLog">Anda sebagai X. Giliran Anda.</span></div></div></div>`;
    const WIN = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    function winner(b) { for (const w of WIN) if (b[w[0]] && b[w[0]] === b[w[1]] && b[w[1]] === b[w[2]]) return b[w[0]]; return b.every(Boolean) ? "D" : null; }
    function minimax(b, player, depth) {
      const w = winner(b);
      if (w === "O") return 10 - depth;
      if (w === "X") return depth - 10;
      if (w === "D") return 0;
      let bestScore = player === "O" ? -Infinity : Infinity;
      b.forEach((v, i) => {
        if (v) return;
        b[i] = player;
        const s = minimax(b, player === "O" ? "X" : "O", depth + 1);
        b[i] = "";
        bestScore = player === "O" ? Math.max(bestScore, s) : Math.min(bestScore, s);
      });
      return bestScore;
    }
    function aiMove() {
      const empty = board.map((v, i) => v ? -1 : i).filter((i) => i >= 0);
      if (!empty.length) return;
      let pick;
      if (diff === "easy") pick = empty[Math.floor(Math.random() * empty.length)];
      else {
        let bestVal = -Infinity;
        empty.forEach((i) => {
          board[i] = "O";
          const val = minimax(board, "X", 0);
          board[i] = "";
          if (val > bestVal) { bestVal = val; pick = i; }
        });
      }
      board[pick] = "O";
      render();
      finish();
    }
    function finish() {
      const w = winner(board);
      if (!w) return;
      over = true;
      const log = $("#ttLog", host);
      if (w === "X") { rec.wins++; log.textContent = "🎉 Anda menang!"; N.core.toast("Anda menang!", "ok"); }
      else if (w === "O") { rec.losses++; log.textContent = "AI menang. Coba lagi."; }
      else { rec.draws++; log.textContent = "Seri."; }
      N.core.state.scores.tictactoe = rec; N.core.save(); N.core.emit("data-changed");
      updateStats();
    }
    function updateStats() {
      const s = $$(".score-pill strong", host);
      s[0].textContent = rec.wins; s[1].textContent = rec.losses; s[2].textContent = rec.draws;
    }
    function render() {
      $("#ttBoard", host).innerHTML = board.map((v, i) => `<button class="tile face" data-i="${i}" type="button" ${v || over ? "disabled" : ""} style="font-size:2rem;color:${v === "X" ? "var(--accent-2)" : "var(--bad)"}">${v || ""}</button>`).join("");
    }
    $("#ttBoard", host).addEventListener("click", (e) => {
      const t = e.target.closest("[data-i]");
      if (!t || over) return;
      const i = Number(t.dataset.i);
      if (board[i]) return;
      board[i] = "X";
      render();
      if (finish(), over) return;
      $("#ttLog", host).textContent = "AI berpikir...";
      clearTimeout(aiTimer);
      aiTimer = setTimeout(() => { aiTimer = null; aiMove(); }, diff === "easy" ? 200 : 380);
    });
    host.addEventListener("click", (e) => {
      if (e.target.closest('[data-tt="reset"]')) {
        clearTimeout(aiTimer); aiTimer = null;
        board = Array(9).fill(""); over = false; render(); $("#ttLog", host).textContent = "Anda sebagai X. Giliran Anda.";
      }
      const d = e.target.closest("[data-d]");
      if (d) { diff = d.dataset.d; $$('[data-d]', host).forEach((b) => b.classList.toggle("active", b === d)); }
    });
    bindFav(host, tool.id); track(tool.id);
    N.core.addCleanup(() => { clearTimeout(aiTimer); aiTimer = null; });
    updateStats(); render();
  };

  impl.rps = (host, tool) => {
    let rec = Object.assign({ w: 0, l: 0, d: 0 }, N.core.state.scores.rps || {});
    host.innerHTML = head(tool) + `<div class="card card-pad game-stage" style="max-width:620px;margin:auto">
      <div class="game-head">${scoreBar([["Menang", "0"], ["Kalah", "0"], ["Seri", "0"]])}</div>
      <div class="game-body" style="text-align:center"><div style="font-size:4rem" id="rpsIcons">✊ · ✋</div>
      <p class="muted" id="rpsLog">Pilih satu untuk melawan AI.</p>
      <div class="chips" style="justify-content:center"><button class="btn btn-primary" data-rps="0" type="button">✊ Batu</button>
      <button class="btn btn-primary" data-rps="1" type="button">✋ Kertas</button><button class="btn btn-primary" data-rps="2" type="button">✌ Gunting</button></div>
      <div class="mt-16"><button class="btn btn-sm btn-ghost" data-rps="reset" type="button">Reset statistik</button></div></div></div>`;
    const NAMES = ["Batu", "Kertas", "Gunting"], ICONS = ["✊", "✋", "✌"];
    function update() {
      const s = $$(".score-pill strong", host);
      s[0].textContent = rec.w; s[1].textContent = rec.l; s[2].textContent = rec.d;
    }
    host.addEventListener("click", (e) => {
      const b = e.target.closest("[data-rps]");
      if (!b) return;
      if (b.dataset.rps === "reset") {
        N.core.confirm("Reset statistik?", "Rekor RPS di perangkat ini akan dihapus.", () => { rec = { w: 0, l: 0, d: 0 }; N.core.state.scores.rps = rec; N.core.save(); update(); }, "Ya, reset");
        return;
      }
      const p = Number(b.dataset.rps), ai = Math.floor(Math.random() * 3);
      const result = p === ai ? "d" : (p === 0 && ai === 2) || (p === 1 && ai === 0) || (p === 2 && ai === 1) ? "w" : "l";
      rec[result]++;
      N.core.state.scores.rps = rec; N.core.save(); N.core.emit("data-changed");
      $("#rpsIcons", host).textContent = ICONS[p] + " · " + ICONS[ai];
      $("#rpsLog", host).textContent = `${NAMES[p]} vs ${NAMES[ai]} — ${result === "w" ? "Anda menang!" : result === "l" ? "AI menang." : "Seri."}`;
      update();
    });
    bindFav(host, tool.id); track(tool.id);
    update();
  };

  impl["2048"] = (host, tool) => {
    let grid = Array(16).fill(0), score = 0, over = false;
    let startX = 0, startY = 0;
    host.innerHTML = head(tool) + `<div class="card card-pad game-stage" style="max-width:560px;margin:auto">
      <div class="game-head">${scoreBar([["Skor", "0"], ["Rekor", best("2048")]])}</div>
      <div class="game-body"><div class="game2048" id="g2048" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;aspect-ratio:1"></div>
      <div class="row mt-16"><button class="btn btn-primary" data-g="new" type="button">↻ Game baru</button><span class="game-log" id="gLog">Gunakan arrow keys, WASD, atau swipe.</span></div></div></div>`;
    function spawn() {
      const empty = grid.map((v, i) => v ? -1 : i).filter((i) => i >= 0);
      if (!empty.length) return;
      grid[empty[Math.floor(Math.random() * empty.length)]] = Math.random() < 0.9 ? 2 : 4;
    }
    function colors(v) {
      const map = { 2: "#243b5a", 4: "#2d5a7b", 8: "#2f806f", 16: "#4d7d3a", 32: "#8a6d29", 64: "#a0522d", 128: "#8b3f7a", 256: "#5b3fa8", 512: "#2f5fbd", 1024: "#1b8b9c", 2048: "#d97706" };
      return map[v] || "#7c3aed";
    }
    function render() {
      $("#g2048", host).innerHTML = grid.map((v) => `<div class="cell" style="background:${v ? colors(v) : ""};color:${v ? "#fff" : ""}">${v || ""}</div>`).join("");
      $$(".score-pill strong", host)[0].textContent = score;
    }
    function rowLine(line) {
      const vals = line.filter(Boolean);
      const out = [];
      for (let i = 0; i < vals.length; i++) {
        if (vals[i] === vals[i + 1]) { out.push(vals[i] * 2); score += vals[i] * 2; i++; }
        else out.push(vals[i]);
      }
      while (out.length < 4) out.push(0);
      return out;
    }
    function move(dir) {
      if (over) return;
      let moved = false;
      for (let i = 0; i < 4; i++) {
        let line = dir === "left" || dir === "right" ? grid.slice(i * 4, i * 4 + 4) : [grid[i], grid[i + 4], grid[i + 8], grid[i + 12]];
        const next = rowLine(dir === "right" || dir === "down" ? line.slice().reverse() : line);
        const final = dir === "right" || dir === "down" ? next.reverse() : next;
        if (final.some((v, k) => v !== line[k])) moved = true;
        if (dir === "left" || dir === "right") grid.splice(i * 4, 4, ...final);
        else final.forEach((v, k) => { grid[i + k * 4] = v; });
      }
      if (moved) {
        spawn(); render();
        if (score > (N.core.state.scores["2048"] || 0)) N.core.setScore("2048", score);
        if (!canMove()) {
          over = true;
          $("#gLog", host).textContent = "Game over — tidak ada langkah lagi. Skor akhir: " + score;
          N.core.toast("Game over! Skor " + score, "info");
        }
      }
    }
    function canMove() {
      if (grid.some((v) => v === 0)) return true;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        const v = grid[i * 4 + j];
        if (j < 3 && v === grid[i * 4 + j + 1]) return true;
        if (i < 3 && v === grid[(i + 1) * 4 + j]) return true;
      }
      return false;
    }
    function newGame() {
      grid = Array(16).fill(0); score = 0; over = false; spawn(); spawn(); render();
      $("#gLog", host).textContent = "Gunakan arrow keys, WASD, atau swipe.";
    }
    function onKey(e) {
      const map = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", a: "left", d: "right", w: "up", s: "down" };
      const dir = map[e.key];
      if (dir) { e.preventDefault(); move(dir); }
    }
    document.addEventListener("keydown", onKey);
    const arena = $("#g2048", host);
    arena.addEventListener("pointerdown", (e) => { startX = e.clientX; startY = e.clientY; });
    arena.addEventListener("pointerup", (e) => {
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
    });
    host.addEventListener("click", (e) => { if (e.target.closest('[data-g="new"]')) newGame(); });
    bindFav(host, tool.id); track(tool.id);
    N.core.addCleanup(() => document.removeEventListener("keydown", onKey));
    newGame();
  };

  impl.snake = (host, tool) => {
    const CELLS = 21, SIZE = 420, STEP = SIZE / CELLS;
    let snake = [{ x: 10, y: 10 }], dir = { x: 1, y: 0 }, nextDir = dir, food = { x: 15, y: 10 };
    let score = 0, running = false, timer = null, dead = false;
    host.innerHTML = head(tool) + `<div class="card card-pad game-stage">
      <div class="game-head">${scoreBar([["Skor", "0"], ["Rekor", best("snake")]])}
      <div class="segmented" data-diff><button data-d="easy">Lambat</button><button data-d="normal" class="active">Normal</button><button data-d="hard">Cepat</button></div></div>
      <div class="game-body snake-wrap"><canvas id="snakeCanvas" width="${SIZE}" height="${SIZE}"></canvas>
      <div class="dpad"><button class="up" data-dir="up">↑</button><button class="left" data-dir="left">←</button><button class="down" data-dir="down">↓</button><button class="right" data-dir="right">→</button></div>
      <div class="row"><button class="btn btn-primary" data-sn="toggle" type="button">▶ Mulai</button><button class="btn" data-sn="reset" type="button">↻ Reset</button><span class="game-log" id="snLog">Arrow keys / WASD / swipe / D-pad.</span></div></div></div>`;
    const canvas = $("#snakeCanvas", host), ctx = canvas.getContext("2d");
    function speed() { return N.core.state.settings.difficulty === "easy" ? 180 : N.core.state.settings.difficulty === "hard" ? 85 : 125; }
    function placeFood() {
      let p;
      do { p = { x: Math.floor(Math.random() * CELLS), y: Math.floor(Math.random() * CELLS) }; }
      while (snake.some((s) => s.x === p.x && s.y === p.y));
      food = p;
    }
    function draw() {
      ctx.fillStyle = "#060a14"; ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.fillStyle = "rgba(139,92,246,.08)";
      for (let i = 0; i < CELLS; i++) { ctx.fillRect(i * STEP, 0, 1, SIZE); ctx.fillRect(0, i * STEP, SIZE, 1); }
      ctx.fillStyle = "#fb7185";
      ctx.fillRect(food.x * STEP + 2, food.y * STEP + 2, STEP - 4, STEP - 4);
      snake.forEach((s, i) => {
        ctx.fillStyle = i === 0 ? "#67e8f9" : `rgba(139,92,246,${Math.max(.35, 1 - i / (snake.length + 2))})`;
        ctx.fillRect(s.x * STEP + 1, s.y * STEP + 1, STEP - 2, STEP - 2);
      });
    }
    function step() {
      dir = nextDir;
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      if (head.x < 0 || head.y < 0 || head.x >= CELLS || head.y >= CELLS || snake.some((s) => s.x === head.x && s.y === head.y)) {
        running = false; dead = true; clearInterval(timer); timer = null;
        $('[data-sn="toggle"]', host).textContent = "▶ Mulai";
        $("#snLog", host).textContent = "Game over! Skor: " + score;
        N.core.toast("Snake berakhir: " + score, "info");
        return;
      }
      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        score += 10;
        $$(".score-pill strong", host)[0].textContent = score;
        N.core.setScore("snake", score);
        placeFood();
      } else snake.pop();
      draw();
    }
    function setDir(x, y) {
      if (dir.x === -x && dir.y === -y) return;
      nextDir = { x, y };
    }
    const keys = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1] };
    function onKey(e) {
      const v = keys[e.key];
      if (v) { e.preventDefault(); setDir(v[0], v[1]); }
    }
    document.addEventListener("keydown", onKey);
    let sx = 0, sy = 0;
    canvas.addEventListener("pointerdown", (e) => { sx = e.clientX; sy = e.clientY; });
    canvas.addEventListener("pointerup", (e) => {
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
      if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 1 : -1, 0); else setDir(0, dy > 0 ? 1 : -1);
    });
    host.addEventListener("click", (e) => {
      const d = e.target.closest("[data-dir]");
      if (d) {
        const m = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
        setDir(m[d.dataset.dir][0], m[d.dataset.dir][1]);
      }
      const b = e.target.closest('[data-sn="toggle"]');
      if (b) {
        if (running) { clearInterval(timer); timer = null; running = false; b.textContent = "▶ Lanjut"; }
        else {
          if (dead) { snake = [{ x: 10, y: 10 }]; dir = nextDir = { x: 1, y: 0 }; score = 0; dead = false; $$(".score-pill strong", host)[0].textContent = 0; placeFood(); }
          running = true; b.textContent = "❚❚ Jeda";
          timer = setInterval(step, speed());
        }
      }
      if (e.target.closest('[data-sn="reset"]')) {
        clearInterval(timer); timer = null; running = false; dead = false;
        snake = [{ x: 10, y: 10 }]; dir = nextDir = { x: 1, y: 0 }; score = 0; placeFood();
        $$(".score-pill strong", host)[0].textContent = 0;
        $('[data-sn="toggle"]', host).textContent = "▶ Mulai";
        $("#snLog", host).textContent = "Siap.";
        draw();
      }
      const df = e.target.closest("[data-d]");
      if (df) {
        N.core.state.settings.difficulty = df.dataset.d;
        N.core.save();
        $$('[data-d]', host).forEach((x) => x.classList.toggle("active", x === df));
        if (running) { clearInterval(timer); timer = setInterval(step, speed()); }
      }
    });
    bindFav(host, tool.id); track(tool.id);
    N.core.addCleanup(() => { clearInterval(timer); document.removeEventListener("keydown", onKey); });
    draw();
  };

  impl.scramble = (host, tool) => {
    const WORDS = {
      easy: ["kode", "data", "web", "file", "npm", "html", "css", "node", "array", "string"],
      normal: ["javascript", "formatter", "validator", "converter", "browser", "compiler", "function", "variable", "network", "element"],
      hard: ["cryptography", "asynchronous", "responsiveness", "localStorage", "visualization", "infrastructure", "authentication", "documentation"]
    };
    let diff = N.core.state.settings.difficulty || "normal";
    let answer = "", letters = [], slots = [], mistakes = 0, started = 0, timer = null;
    function start() {
      const pool = WORDS[diff] || WORDS.normal;
      answer = pool[Math.floor(Math.random() * pool.length)];
      letters = shuffle(Array.from(answer));
      slots = Array(answer.length).fill("");
      mistakes = 0; started = performance.now();
      render();
      $("#scLog", host).textContent = "Susun huruf menjadi kata yang benar.";
      clearInterval(timer);
      timer = setInterval(() => {
        const s = Math.floor((performance.now() - started) / 1000);
        $("#scTime", host).textContent = s + " dtk";
      }, 500);
    }
    function render() {
      $("#scWord", host).innerHTML = `<div class="word-display">${letters.map((_, i) => `<div class="letter">${slots[i] || ""}</div>`).join("")}</div>`;
      $("#scLetters", host).innerHTML = letters.map((l, i) => `<button data-l="${i}" type="button" ${slots.includes(String(i)) ? "disabled" : ""}>${esc(l)}</button>`).join("");
      $("#scMistakes", host).textContent = mistakes;
    }
    function place(i) {
      const idx = slots.indexOf("");
      if (idx < 0) return;
      slots[idx] = String(i);
      render();
      if (!slots.includes("")) check();
    }
    function check() {
      const word = slots.map((i) => letters[Number(i)]).join("");
      if (word === answer) {
        clearInterval(timer);
        const sec = (performance.now() - started) / 1000;
        const score = Math.max(10, Math.round(answer.length * 50 - sec * 8 - mistakes * 20));
        $("#scLog", host).textContent = `✅ Benar: ${answer} · Skor ${score} · ${sec.toFixed(1)} dtk`;
        N.core.setScore("scramble", score);
        N.core.toast("Kata benar! Skor " + score, "ok");
      } else {
        mistakes++;
        $("#scLog", host).textContent = "Belum tepat. Coba susun ulang.";
        slots = Array(answer.length).fill("");
        render();
      }
    }
    host.innerHTML = head(tool, diffControl(diff)) + `<div class="card card-pad game-stage" style="max-width:620px;margin:auto">
      <div class="game-head">${scoreBar([["Rekor", best("scramble")], ["Salah", "0"], ["Waktu", "0 dtk"]])}</div>
      <div class="game-body" style="text-align:center"><p class="muted" id="scLog"></p>
      <div id="scWord"></div><div class="scramble-letters" id="scLetters"></div>
      <div class="row mt-16" style="justify-content:center"><button class="btn btn-primary" data-sc="new" type="button">↻ Kata baru</button>
      <button class="btn" data-sc="undo" type="button">⌫ Hapus</button><button class="btn" data-sc="check" type="button">✓ Cek</button></div></div></div>`;
    const scoreValues = $$(".score-pill strong", host);
    scoreValues[1].id = "scMistakes";
    scoreValues[2].id = "scTime";
    $("#scLetters", host).addEventListener("click", (e) => {
      const b = e.target.closest("[data-l]");
      if (b) place(Number(b.dataset.l));
    });
    host.addEventListener("click", (e) => {
      if (e.target.closest('[data-sc="new"]')) start();
      if (e.target.closest('[data-sc="undo"]')) { slots[slots.indexOf("") - 1] = ""; render(); }
      if (e.target.closest('[data-sc="check"]')) check();
      const d = e.target.closest("[data-d]");
      if (d) { diff = d.dataset.d; $$('[data-d]', host).forEach((b) => b.classList.toggle("active", b === d)); start(); }
    });
    bindFav(host, tool.id); track(tool.id);
    N.core.addCleanup(() => clearInterval(timer));
    start();
  };

  impl.click = (host, tool) => {
    let diff = N.core.state.settings.difficulty || "normal";
    let hits = 0, misses = 0, timeLeft = 30, timer = null, playing = false, size = 46;
    function config() { return diff === "easy" ? { targets: 15, time: 40, size: 58 } : diff === "hard" ? { targets: 15, time: 22, size: 30 } : { targets: 12, time: 30, size: 44 }; }
    host.innerHTML = head(tool, diffControl(diff)) + `<div class="card card-pad game-stage">
      <div class="game-head">${scoreBar([["Skor", "0"], ["Rekor", best("click")], ["Waktu", "30 dtk"]])}</div>
      <div class="game-body"><div class="click-arena" id="clArena"><div class="hint" id="clMsg" style="position:absolute;inset:0;display:grid;place-items:center">Tekan mulai untuk menargetkan</div></div>
      <div class="row mt-16"><button class="btn btn-primary" data-cl="start" type="button">▶ Mulai</button><span class="game-log" id="clLog">Klik target secepat mungkin. Klik kosong = miss.</span></div></div></div>`;
    const arena = $("#clArena", host);
    function moveTarget() {
      const pad = 12;
      const maxX = arena.clientWidth - size - pad, maxY = arena.clientHeight - size - pad;
      let t = $("#clTarget", host);
      if (!t) {
        t = document.createElement("button");
        t.id = "clTarget"; t.className = "target"; t.type = "button";
        t.setAttribute("aria-label", "Target");
        t.addEventListener("click", (e) => {
          e.stopPropagation();
          if (!playing) return;
          hits++;
          $$(".score-pill strong", host)[0].textContent = hits;
          moveTarget();
          if (hits >= config().targets) finish();
        });
        arena.appendChild(t);
      }
      t.style.width = size + "px"; t.style.height = size + "px";
      t.style.left = (pad + Math.random() * Math.max(1, maxX - pad)) + "px";
      t.style.top = (pad + Math.random() * Math.max(1, maxY - pad)) + "px";
    }
    function finish() {
      playing = false; clearInterval(timer); timer = null;
      const t = $("#clTarget", host); if (t) t.remove();
      $("#clMsg", host).textContent = `Selesai · ${hits} target · ${misses} miss`;
      $("#clMsg", host).style.display = "grid";
      $("#clLog", host).textContent = `Skor akhir ${hits}. Tekan mulai untuk mengulang.`;
      if (hits > (N.core.state.scores.click || 0)) N.core.setScore("click", hits);
      N.core.toast("Click challenge selesai: " + hits, "ok");
    }
    function start() {
      const c = config();
      hits = 0; misses = 0; timeLeft = c.time; size = c.size; playing = true;
      $$(".score-pill strong", host)[0].textContent = 0;
      $$(".score-pill strong", host)[2].textContent = timeLeft + " dtk";
      $("#clMsg", host).style.display = "none";
      moveTarget();
      clearInterval(timer);
      timer = setInterval(() => {
        timeLeft--;
        $$(".score-pill strong", host)[2].textContent = timeLeft + " dtk";
        if (timeLeft <= 0) finish();
      }, 1000);
    }
    arena.addEventListener("click", () => {
      if (!playing) return;
      misses++;
      $("#clLog", host).textContent = `Miss: ${misses}. Fokus ke target!`;
    });
    host.addEventListener("click", (e) => {
      if (e.target.closest('[data-cl="start"]')) start();
      const d = e.target.closest("[data-d]");
      if (d) { diff = d.dataset.d; $$('[data-d]', host).forEach((b) => b.classList.toggle("active", b === d)); if (playing) finish(); }
    });
    bindFav(host, tool.id); track(tool.id);
    N.core.addCleanup(() => clearInterval(timer));
  };

  /* ============================== UI ============================== */
  function index(host) {
    const games = N.registry.tools.filter((t) => t.cat === "game");
    host.innerHTML = `<div class="workspace-head"><div><span class="eyebrow">Play & focus</span><h1 class="page-title">Game <span class="gradient-text">Center</span></h1>
      <p class="sub">Sembilan mini-game tanpa backend. Skor terbaik disimpan lokal di perangkat Anda.</p></div>
      <span class="badge pro">${games.length} games</span></div>
      <div class="tool-grid">${games.map((g) => `<button class="tool-card" data-game-id="${g.id}" type="button">
        <div class="tc-top"><div class="tc-icon">${esc(g.icon)}</div>${g.popular ? '<span class="badge hot">POPULAR</span>' : ""}</div>
        <h3>${esc(g.name)}</h3><p>${esc(g.desc)}</p>
        <div class="tc-foot"><span class="tc-cat">Rekor: ${esc(best(g.id))}</span><span class="badge new">Mainkan →</span></div></button>`).join("")}</div>`;
    host.addEventListener("click", (e) => {
      const c = e.target.closest("[data-game-id]");
      if (c) location.hash = "#/games/" + c.dataset.gameId;
    });
  }

  function render(host, id) {
    const tool = N.registry.get(id);
    const fn = impl[id];
    if (!tool || !fn || tool.cat !== "game") { index(host); return; }
    host.innerHTML = `<div class="row mb-8"><button class="btn btn-sm btn-ghost" data-back type="button">← Semua game</button></div><div id="gameHost"></div>`;
    host.querySelector('[data-back]').addEventListener("click", () => { location.hash = "#/games"; });
    fn(host.querySelector("#gameHost"), tool);
  }

  N.games = { index, render, impl };
})(window.Nexus = window.Nexus || {});
