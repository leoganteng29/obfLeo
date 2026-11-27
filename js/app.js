/* NEXUS TOOLBOX — app shell, landing, routing, dashboard, search, settings */
(function (N) {
  "use strict";
  const C = N.core;
  const { escapeHtml: esc } = C;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const ico = (name) => (N.icons ? N.icons.svg(name) : "");
  const toolIco = (tool) => (N.icons ? N.icons.tool(tool.id, tool.cat) : esc(tool.icon));

  const ROUTES = {
    landing: { title: "NEXUS TOOLBOX", kicker: "WELCOME" },
    dashboard: { title: "Dashboard", kicker: "WORKSPACE" },
    protect: { title: "JS Protector", kicker: "CODE PROTECTION" },
    ai: { title: "AI Studio", kicker: "CODING PARTNER" },
    tools: { title: "Developer Tools", kicker: "TOOLKIT" },
    utilities: { title: "Utilities", kicker: "EVERYDAY TOOLS" },
    games: { title: "Game Center", kicker: "PLAYGROUND" },
    music: { title: "Music Lounge", kicker: "AMBIENCE" },
    favorites: { title: "Favorites", kicker: "COLLECTION" },
    history: { title: "Activity History", kicker: "LOCAL LOG" },
    security: { title: "Security Center", kicker: "PRIVACY & DEFENSE" }
  };

  /* The three saved accent keys keep their original values for compatibility;
     all labels and colors are now blue variations. */
  const ACCENTS = [
    { value: "violet", label: "Biru langit", color: "#2563eb" },
    { value: "cyan", label: "Biru es", color: "#0369a1" },
    { value: "blue", label: "Biru royal", color: "#1d4ed8" },
    { value: "neon", label: "Ungu neon", color: "#7c3aed" },
    { value: "emerald", label: "Hijau emerald", color: "#059669" },
    { value: "rose", label: "Merah mawar", color: "#e11d48" }
  ];
  const PLANE = `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path d="M27.5 4.5 3.8 14.1l9.8 3.6 4.1 10.2 9.8-23.4Z" fill="currentColor" />
    <path d="M13.6 17.7 27.5 4.5 17.7 27.9" stroke="#fff" stroke-width="1.3" stroke-linejoin="round" opacity=".7" />
    <path d="M3.8 14.1 13.6 17.7 17.7 27.9" stroke="#fff" stroke-width="1.1" stroke-linejoin="round" opacity=".42" />
  </svg>`;

  function parseHash() {
    const raw = (location.hash || "").replace(/^#\/?/, "");
    const parts = raw.split("/").filter(Boolean);
    if (!parts.length || parts[0] === "landing") return { page: "landing", param: "" };
    return { page: ROUTES[parts[0]] ? parts[0] : "dashboard", param: parts[1] || "" };
  }
  function go(page, param) {
    location.hash = "#/" + page + (param ? "/" + param : "");
  }
  function landingSeen() { return C.state.settings.landingSeen === true; }
  function setLandingSeen(seen) {
    try {
      C.state.settings.landingSeen = !!seen;
      C.save();
    } catch (err) {
      console.warn("[Nexus] gagal menyimpan flag landing:", err);
    }
  }
  function applyAccent() {
    C.applySettings();
    const meta = $('meta[name="theme-color"]');
    const accent = ACCENTS.find((a) => a.value === (C.state.settings.accent || "violet"));
    if (meta && accent) meta.setAttribute("content", accent.color);
  }
  function applyShellPrefs() {
    const shell = $(".app-shell");
    const btn = $("#sidebarCollapse");
    if (!shell || !btn) return;
    const tablet = window.matchMedia && window.matchMedia("(min-width:768px) and (max-width:1023px)").matches;
    const collapsed = tablet || !!C.state.settings.sidebarCollapsed;
    shell.classList.toggle("collapsed", collapsed);
    btn.setAttribute("aria-pressed", String(collapsed));
    btn.setAttribute("aria-label", collapsed ? "Luaskan sidebar" : "Ciutkan sidebar");
  }
  function goCategory(catId) {
    const target = { protection: "protect", developer: "tools", utility: "utilities", game: "games", ambience: "music" }[catId] || "tools";
    pendingCategoryFilter = target === "tools" ? "developer" : "";
    go(target);
  }

  function toolCard(tool, featured) {
    const fav = C.isFavorite(tool.id);
    return `<div class="tool-card ${featured ? "featured" : ""}" data-tool-id="${esc(tool.id)}" role="button" tabindex="0">
      <div class="tc-top"><div class="tc-icon">${toolIco(tool)}</div>
        ${tool.badge ? `<span class="badge ${tool.badge === "PRO" ? "pro" : "new"}">${esc(tool.badge)}</span>` : ""}
        ${tool.popular ? '<span class="badge hot">POPULAR</span>' : ""}
        <button class="star-btn ${fav ? "on" : ""}" data-star="${esc(tool.id)}" type="button" aria-label="Favorite" data-tip="Favorite">${ico(fav ? "star" : "starOff")}</button>
      </div>
      <h3>${esc(tool.name)}</h3><p>${esc(tool.desc)}</p>
      <div class="tc-foot"><span class="tc-cat">${esc(N.registry.category(tool.cat).label)}</span><span class="badge new">Buka ${ico("arrowRight")}</span></div>
    </div>`;
  }
  let pendingCategoryFilter = "";
  function openToolCard(card) {
    const tool = N.registry.get(card.dataset.toolId);
    if (tool) go(tool.route, tool.id);
  }
  function bindToolCards(host) {
    host.addEventListener("click", (e) => {
      const star = e.target.closest("[data-star]");
      if (star) {
        e.stopPropagation();
        const on = C.toggleFavorite(star.dataset.star);
        star.classList.toggle("on", on);
        star.innerHTML = ico(on ? "star" : "starOff");
        C.toast(on ? "Ditambahkan ke favorites." : "Dihapus dari favorites.", "ok");
        if ((location.hash || "").startsWith("#/favorites")) renderRoute();
        return;
      }
      const card = e.target.closest("[data-tool-id]");
      if (card) openToolCard(card);
    });
    host.addEventListener("keydown", (e) => {
      const card = e.target.closest("[data-tool-id]");
      if (card && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openToolCard(card); }
    });
  }

  /* ============================== Landing ============================== */
  function landing(host) {
    let launched = false;
    function launch() {
      if (launched) return;
      launched = true;
      setLandingSeen(true);
      C.closeModal();
      document.body.classList.add("dash-fade");
      go("dashboard");
    }
    host.innerHTML = `<section class="landing" aria-labelledby="landingTitle">
      <div class="landing-sparks" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div class="landing-aurora" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="landing-flight" aria-hidden="true">
        <svg viewBox="0 0 560 190" preserveAspectRatio="xMidYMid meet">
          <path class="flight-arc" d="M 8 148 C 120 18, 420 18, 552 132" />
          <path class="flight-dots" d="M 8 148 C 120 18, 420 18, 552 132" />
          <circle class="flight-tip" cx="552" cy="132" r="3.5" />
          <g class="flight-plane">${PLANE}</g>
        </svg>
      </div>
      <div class="landing-inner">
        <h1 class="landing-logo" id="landingTitle">NEXUS TOOLBOX</h1>
        <p class="landing-sub">Fly smarter, build faster</p>
        <button class="btn landing-cta" data-launch type="button">
          <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M27.5 4.5 3.8 14.1l9.8 3.6 4.1 10.2 9.8-23.4Z" fill="currentColor" /><path d="M13.6 17.7 27.5 4.5 17.7 27.9" stroke="#bfdbfe" stroke-width="1.3" stroke-linejoin="round" opacity=".8" /></svg>
          Mulai Terbang ${ico("arrowRight")}
        </button>
      </div>
    </section>`;
    host.addEventListener("click", (e) => { if (e.target.closest("[data-launch]")) launch(); });
    host.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !["INPUT", "TEXTAREA", "BUTTON"].includes(document.activeElement.tagName)) launch();
    });
    let autoTimer = null;
    C.addCleanup(() => {
      if (autoTimer) clearTimeout(autoTimer);
      setTimeout(() => document.body.classList.remove("dash-fade"), 420);
    });
    if (!C.state.settings.reduceMotion) autoTimer = setTimeout(launch, 4300);
  }

  /* ============================== Dashboard data ============================== */
  const pad2 = (n) => String(n).padStart(2, "0");
  function dayKey(ts) {
    const d = new Date(Number(ts) || Date.now());
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  function dayKeys(days) {
    const out = [];
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      out.push(dayKey(d.getTime()));
    }
    return out;
  }
  function historyCounts(predicate, days) {
    const keys = dayKeys(Number(days) > 0 ? Number(days) : 7);
    const index = new Map(keys.map((k, i) => [k, i]));
    const out = Array(keys.length).fill(0);
    (C.state.history || []).forEach((h) => {
      const i = index.get(dayKey(h.at));
      if (i != null && (!predicate || predicate(h))) out[i]++;
    });
    return out;
  }
  function sum(values) { return values.reduce((a, b) => a + b, 0); }
  function trend(values) {
    const half = Math.floor(values.length / 2);
    const recent = sum(values.slice(half));
    const previous = sum(values.slice(0, half));
    if (!recent && !previous) return { dir: "flat", pct: 0 };
    if (!previous) return { dir: "up", pct: 100 };
    const diff = Math.round(((recent - previous) / previous) * 100);
    return diff >= 0 ? { dir: "up", pct: diff } : { dir: "down", pct: Math.abs(diff) };
  }
  function sparkline(values) {
    const max = Math.max(1, ...values);
    const points = values.map((v, i) => {
      const x = values.length > 1 ? (i / (values.length - 1)) * 100 : 50;
      const y = 28 - (v / max) * 23;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const area = `M0,30 L${points.join(" L")} L100,30 Z`;
    return `<svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
      <path class="spark-area" d="${area}"></path><polyline class="spark-line" points="${points.join(" ")}"></polyline>
    </svg>`;
  }
  function statCard(label, value, foot, values, tr, opts) {
    opts = opts || {};
    const badgeClass = tr.dir === "up" ? "" : tr.dir === "down" ? "down" : "flat";
    const arrow = ico(tr.dir === "up" ? "arrowUp" : tr.dir === "down" ? "arrowDown" : "arrowRight");
    const pct = tr.dir === "flat" && !tr.pct ? "0%" : `${tr.dir === "up" ? "+" : tr.dir === "down" ? "−" : ""}${tr.pct}%`;
    return `<div class="card stat" ${opts.tip ? `title="${esc(opts.tip)}"` : ""}>
      <div class="stat-top"><span class="stat-label">${esc(label)}</span><span class="stat-icon">${ico(opts.icon || "arrowUp")}</span></div>
      <div class="spread"><div class="stat-value ${opts.text ? "is-text" : ""}">${esc(value)}</div><span class="stat-badge ${badgeClass}">${arrow} ${pct}</span></div>
      <div class="stat-foot">${esc(foot)}</div><div class="stat-bottom">${sparkline(values)}</div>
    </div>`;
  }
  function dayLabels(days) {
    const fmt = new Intl.DateTimeFormat("id-ID", { weekday: "short" });
    return dayKeys(days).map((k) => fmt.format(new Date(k + "T12:00:00")).replace(".", ""));
  }
  function activityChart(kind, values) {
    const target = Math.ceil(sum(values) / values.length);
    const chart = smoothSeries(values, target);
    const max = Math.max(1, target, ...values);
    const labels = dayLabels(values.length);
    const end = chart.coords[chart.coords.length - 1];
    return `<svg class="chart-svg" viewBox="0 0 600 205" role="img" aria-label="Aktivitas ${kind} tujuh hari terakhir">
      <defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
        <stop class="chart-stop-a" offset="0%"></stop><stop class="chart-stop-b" offset="100%"></stop>
      </linearGradient></defs>
      <g class="chart-grid"><line x1="34" y1="45" x2="588" y2="45"></line><line x1="34" y1="97" x2="588" y2="97"></line><line x1="34" y1="166" x2="588" y2="166"></line></g>
      <line class="chart-target" x1="34" y1="${chart.targetY.toFixed(1)}" x2="588" y2="${chart.targetY.toFixed(1)}"></line>
      <path class="chart-area" d="${chart.area}"></path><path class="chart-line" d="${chart.d}"></path>
      <circle class="chart-end" cx="${end.x.toFixed(1)}" cy="${end.y.toFixed(1)}" r="5"></circle>
      <g class="chart-axis"><text x="4" y="18">${max}</text><text x="4" y="100">${Math.round(max / 2)}</text><text x="10" y="169">0</text>
        ${labels.map((label, i) => `<text x="${chart.coords[i].x.toFixed(1)}" y="196" text-anchor="middle">${esc(label)}</text>`).join("")}</g>
    </svg>`;
  }
  function bestScore() {
    let best = { value: 0, id: "" };
    Object.entries(C.state.scores || {}).forEach(([id, raw]) => {
      let n = NaN;
      if (typeof raw === "number") n = raw;
      else if (typeof raw === "string") n = Number(raw);
      else if (raw && typeof raw === "object") {
        const nums = Object.values(raw).map(Number).filter(Number.isFinite);
        if (nums.length) n = Math.max(...nums);
      }
      if (Number.isFinite(n) && (!best.id || n > best.value)) best = { value: n, id };
    });
    return best;
  }
  function smoothSeries(values, target) {
    const w = 600, h = 180, pad = 14;
    const max = Math.max(1, target, ...values);
    const coords = values.map((v, i) => ({
      x: pad + (i / (values.length - 1)) * (w - pad * 2),
      y: h - pad - (v / max) * (h - pad * 2)
    }));
    let d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i - 1] || coords[i], p1 = coords[i], p2 = coords[i + 1], p3 = coords[i + 2] || p2;
      const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    const area = `${d} L ${coords[coords.length - 1].x.toFixed(1)} ${h - pad} L ${coords[0].x.toFixed(1)} ${h - pad} Z`;
    const targetY = h - pad - (target / max) * (h - pad * 2);
    return { d, area, coords, targetY };
  }

  /* ============================== Dashboard ============================== */
  function dashboard(host) {
    const s = C.state;
    const totalTools = N.registry.tools.length;
    const totalGames = N.registry.tools.filter((t) => t.route === "games").length;
    const history = s.history || [];
    const hour = new Date().getHours();
    const greet = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 18 ? "Selamat sore" : "Selamat malam";
    const uniqueTools = Object.keys(s.usage || {}).filter((k) => s.usage[k] > 0).length;
    const favIds = s.favorites || [];
    const lastId = (s.recent || [])[0] || "";
    const lastTool = N.registry.get(lastId);
    const lastAt = history.find((h) => h.id === lastId);
    const gameEvents = history.filter((h) => h.kind === "game");
    const lastGame = N.registry.get((gameEvents[0] || {}).id) || null;
    const mostUsedId = Object.keys(s.usage || {}).sort((a, b) => (s.usage[b] || 0) - (s.usage[a] || 0))[0] || "";
    const favoriteTool = N.registry.get(favIds[0] || mostUsedId) || null;

    const toolCounts = historyCounts((h) => h.kind !== "game" && h.kind !== "music");
    const favCounts = historyCounts((h) => favIds.includes(h.id));
    const gameCounts = historyCounts((h) => h.kind === "game");
    const activity = historyCounts();
    const activityTotal = sum(activity);
    const focusPct = activityTotal ? Math.round((sum(toolCounts) / activityTotal) * 100) : 0;
    const dailyTotal = Number(s.daily && s.daily.total) || 0;
    const dailyCorrect = Math.min(Number(s.daily && s.daily.correct) || 0, dailyTotal);
    const dailyPct = dailyTotal ? Math.round((dailyCorrect / dailyTotal) * 100) : 0;
    const dailyDone = !!(s.daily && s.daily.date === dayKey(Date.now()) && dailyTotal > 0);
    const gaugeLength = Math.PI * 64;
    const gaugeOffset = gaugeLength * (1 - dailyPct / 100);
    const dateLabel = new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "numeric", month: "short" }).format(new Date()).replace(".", "");

    const insights = [
      { icon: "diamond", tone: "blue", title: favoriteTool ? `Tool favoritmu: ${favoriteTool.name}` : "Belum ada tool favorit", go: favoriteTool ? `${favoriteTool.route}/${favoriteTool.id}` : "tools", action: "Lihat" },
      { icon: "sparkle", tone: "cyan", title: dailyDone ? "Daily challenge selesai hari ini" : "Daily challenge hari ini belum selesai", go: "utilities/daily-challenge", action: dailyDone ? "Lihat" : "Coba" },
      { icon: "arrowUp", tone: "indigo", title: lastTool ? `Terakhir dibuka: ${lastTool.name}` : "Belum ada tool yang dibuka", go: lastTool ? `${lastTool.route}/${lastTool.id}` : "tools", action: "Lanjutkan" },
      { icon: "shield", tone: "amber", title: lastGame ? `Game terakhir: ${lastGame.name}` : "Belum ada game dimainkan", go: "games", action: "Buka" }
    ];

    host.innerHTML = `
      <div class="hero dash-header">
        <div class="dash-heading"><span class="eyebrow">Overview</span>
          <h1>${esc(greet)}, Developer</h1>
          <p>Data lokal di perangkat ini · ${totalTools} tools siap dipakai · ${totalGames} game tersedia</p>
        </div>
        <div class="dash-actions">
          <div class="dash-tools">
            <span class="dash-date"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="15" rx="3" stroke="currentColor" stroke-width="1.7"/><path d="M8 3v5m8-5v5M3.5 10h17" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>${esc(dateLabel)}</span>
            <label class="dash-search" data-dash-search><svg viewBox="0 0 24 24" fill="none"><circle cx="10.8" cy="10.8" r="6.3" stroke="currentColor" stroke-width="1.8"/><path d="m16 16 4.4 4.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><input type="search" placeholder="Cari tools..." aria-label="Cari tools" readonly><kbd>Ctrl K</kbd></label>
            <button class="icon-btn" data-notify type="button" aria-label="Notifikasi" data-tip="Notifikasi"><svg viewBox="0 0 24 24" fill="none"><path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></button>
            <button class="btn btn-outline-plus" data-go="tools" type="button" aria-label="Buka semua tools">+</button>
          </div>
          <div class="dash-tools">
            <button class="btn" data-customize type="button"><svg viewBox="0 0 24 24" fill="none"><path d="M4 7h10m4 0h2M4 17h4m4 0h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="16" cy="7" r="2" stroke="currentColor" stroke-width="1.7"/><circle cx="10" cy="17" r="2" stroke="currentColor" stroke-width="1.7"/></svg>Sesuaikan</button>
            <button class="btn btn-primary" data-go="${esc(lastTool ? lastTool.route + "/" + lastTool.id : "tools")}" type="button">+ Buka Tool Terakhir</button>
          </div>
        </div>
      </div>

      <div class="section" style="margin-top:18px">
        <div class="stat-strip">
          ${statCard("Tool dibuka", uniqueTools, `dari ${totalTools} tool tersedia`, toolCounts, trend(toolCounts), { icon: "arrowUp", tip: "Jumlah tool berbeda yang pernah dibuka di perangkat ini." })}
          ${statCard("Favorit", favIds.length, "tool yang disimpan", favCounts, trend(favCounts), { icon: "star", tip: "Jumlah tool yang ditandai sebagai favorit." })}
          ${statCard("Tingkat fokus (%)", focusPct + "%", `${sum(toolCounts)} dari ${activityTotal} aktivitas`, toolCounts, trend(toolCounts), { icon: "target", tip: "Persentase aktivitas berupa pemakaian tool dibanding seluruh aktivitas lokal." })}
          ${statCard("Game terbaru", gameEvents.length, lastGame ? `${lastGame.name} · ${C.relativeTime((gameEvents[0] || {}).at)}` : "Belum ada game dimainkan", gameCounts, trend(gameCounts), { icon: "sparkle", tip: "Jumlah sesi game yang tercatat; keterangan menunjukkan game terakhir dari riwayat lokal." })}
        </div>
      </div>

      <div class="section">
        <div class="insights-shell">
          <div class="insights-label">${ico("sparkle")}<strong>INSIGHTS</strong></div>
          <div class="insights">${insights.map((i) => `<div class="insight">
            <span class="insight-icon ${esc(i.tone)}">${ico(i.icon)}</span><strong>${esc(i.title)}</strong>
            <button class="link" data-go="${esc(i.go)}" type="button">${esc(i.action)} ${ico("arrowRight")}</button>
          </div>`).join("")}</div>
        </div>
      </div>

      <div class="section panels">
        <div class="card panel">
          <div class="panel-head"><div><span class="eyebrow">Aktivitas</span><h3 class="card-title mt-8">Aktivitas 7 hari</h3><p class="panel-sub">Aktivitas tool dan game dari riwayat lokal</p></div>
            <div class="segmented" role="group" aria-label="Jenis aktivitas"><button class="active" data-series="tools" type="button">Tools</button><button data-series="game" type="button">Game</button></div></div>
          <div id="activityChart">${activityChart("tools", toolCounts)}</div>
          <div class="chart-legend"><span><i></i>Aktivitas lokal</span><span><i class="target"></i>Target rata-rata</span></div>
        </div>
        <div class="card panel gauge-card">
          <div class="panel-head"><div><span class="eyebrow">Harian</span><h3 class="card-title mt-8">Progres daily challenge</h3></div>
            <button class="link" data-go="utilities/daily-challenge" type="button">Laporan ${ico("arrowRight")}</button></div>
          <div class="gauge-wrap">
            <svg class="gauge-svg" viewBox="0 0 160 100" role="img" aria-label="Progres daily challenge ${dailyPct}%">
              <path class="gauge-track" d="M16 86 A64 64 0 0 1 144 86"></path>
              <path class="gauge-value-arc" d="M16 86 A64 64 0 0 1 144 86" stroke-dasharray="${gaugeLength.toFixed(1)}" stroke-dashoffset="${gaugeOffset.toFixed(1)}"></path>
            </svg>
            <div class="gauge-center"><strong>${dailyPct}%</strong><small>selesai hari ini</small></div>
          </div>
          <div class="gauge-legend">
            <span><i style="background:#2563eb"></i>Selesai <b>${dailyCorrect}</b></span>
            <span><i style="background:#38bdf8"></i>Dikerjakan <b>${Math.max(0, dailyTotal - dailyCorrect)}</b></span>
            <span><i style="background:#fbbf24"></i>Belum <b>${Math.max(0, 3 - dailyTotal)}</b></span>
          </div>
        </div>
      </div>

      <div class="section"><div class="section-head"><div><span class="eyebrow">Unggulan</span><h2 class="section-title">Featured tools</h2></div><button class="btn btn-sm btn-ghost" data-go="tools" type="button">Semua tools ${ico("arrowRight")}</button></div>
        <div class="tool-grid">${["js-protector", "base64", "regex-tester", "qr"].map((id, i) => toolCard(N.registry.get(id), i === 0)).join("")}</div></div>

      <div class="section"><div class="section-head"><div><span class="eyebrow">Kategori</span><h2 class="section-title">Pilih dunia kerja Anda</h2></div></div>
        <div class="grid grid-4">${N.registry.categories.map((c) => `<button class="card card-pad game-tile" data-cat="${esc(c.id)}" type="button" style="width:100%">
          <span class="gt-icon">${ico(c.icon)}</span><span><strong>${esc(c.label)}</strong><small>${N.registry.tools.filter((t) => t.cat === c.id).length} tools · ${esc(c.desc)}</small></span></button>`).join("")}</div></div>

      <div class="section bento">
        <div class="card card-pad span-5">
          <div class="spread"><div><span class="eyebrow">Terakhir dipakai</span><h3 class="card-title mt-8">Recently used</h3></div><button class="btn btn-sm btn-ghost" data-go="history" type="button">Lihat semua</button></div>
          <div class="mini-list mt-16">${s.recent.length ? s.recent.slice(0, 6).map((id) => {
            const t = N.registry.get(id); if (!t) return "";
            return `<div class="mini-row" data-open="${esc(t.route)}/${esc(t.id)}"><span class="mi">${toolIco(t)}</span><span><strong>${esc(t.name)}</strong><small>${esc(N.registry.category(t.cat).label)}</small></span><time>${esc(C.relativeTime((history.find((h) => h.id === id) || {}).at))}</time></div>`;
          }).join("") : emptyMini("Belum ada tool yang dipakai.")}</div>
        </div>
        <div class="card card-pad span-4">
          <div class="spread"><div><span class="eyebrow">Disimpan</span><h3 class="card-title mt-8">Favorite tools</h3></div><button class="btn btn-sm btn-ghost" data-go="favorites" type="button">Kelola</button></div>
          <div class="mini-list mt-16">${s.favorites.length ? s.favorites.slice(0, 6).map((id) => {
            const t = N.registry.get(id); if (!t) return "";
            return `<div class="mini-row" data-open="${esc(t.route)}/${esc(t.id)}"><span class="mi">${ico("star")}</span><span><strong>${esc(t.name)}</strong><small>${esc(N.registry.category(t.cat).label)}</small></span><time>${ico("arrowRight")}</time></div>`;
          }).join("") : emptyMini("Belum ada favorite. Klik bintang pada tool.")}</div>
        </div>
        <div class="card card-pad challenge-card span-3">
          <div class="challenge-top"><span class="eyebrow">Latihan singkat</span></div>
          <h3 class="card-title mt-8">Uji naloga JavaScript Anda</h3>
          <p class="challenge-q">${gameEvents.length ? `${gameEvents.length} sesi game tercatat di perangkat ini.` : "Tiga pertanyaan logika menanti Anda hari ini."}</p>
          <div class="row"><span class="badge ${dailyDone ? "new" : "hot"}">${dailyDone ? "SELESAI" : "BELUM"}</span><span class="badge">${dailyCorrect}/${dailyTotal} benar</span></div>
          <button class="btn btn-primary btn-block mt-16" data-go="utilities/daily-challenge" type="button">${dailyDone ? "Lihat hasil" : "Kerjakan sekarang"}</button>
        </div>
      </div>

      <div class="section"><div class="section-head"><div><span class="eyebrow">Mini games</span><h2 class="section-title">Istirahat sejenak</h2></div><button class="btn btn-sm btn-ghost" data-go="games" type="button">Game center ${ico("arrowRight")}</button></div>
        <div class="grid grid-4">${["reaction", "2048", "snake", "scramble"].map((id) => {
          const g = N.registry.get(id);
          return `<button class="game-tile" data-go="games/${id}" type="button"><span class="gt-icon">${ico(g.icon)}</span><span><strong>${esc(g.name)}</strong><small>${esc(g.desc)}</small></span></button>`;
        }).join("")}</div></div>

      <div class="section"><div class="section-head"><div><span class="eyebrow">Riwayat</span><h2 class="section-title">Aktivitas terakhir</h2></div><button class="btn btn-sm btn-ghost" data-go="history" type="button">Detail ${ico("arrowRight")}</button></div>
        <div class="card card-pad"><div class="mini-list">${history.length ? history.slice(0, 6).map((h) => {
          const t = N.registry.get(h.id);
          return `<div class="mini-row" data-open="${esc(t ? t.route + "/" + t.id : "dashboard")}"><span class="mi">${t ? toolIco(t) : ico("clock")}</span><span><strong>${esc(t ? t.name : h.id)}</strong><small>${esc(h.kind)}</small></span><time>${esc(C.relativeTime(h.at))}</time></div>`;
        }).join("") : emptyMini("Belum ada aktivitas. Mulai pakai sebuah tool.")}</div></div></div>`;

    bindToolCards(host);
    host.addEventListener("click", (e) => {
      const series = e.target.closest("[data-series]");
      if (series) {
        $$("[data-series]", host).forEach((b) => b.classList.toggle("active", b === series));
        const chartHost = $("#activityChart", host);
        if (chartHost) chartHost.innerHTML = activityChart(series.dataset.series, series.dataset.series === "game" ? gameCounts : toolCounts);
        return;
      }
      if (e.target.closest("[data-dash-search]")) { quickSearchModal(); return; }
      if (e.target.closest("[data-customize]")) { settingsModal(); return; }
      if (e.target.closest("[data-notify]")) { C.toast("Tidak ada notifikasi baru.", "info"); return; }
      const g = e.target.closest("[data-go]");
      if (g) {
        const [p, param] = g.dataset.go.split("/");
        go(p, param);
        return;
      }
      const cat = e.target.closest("[data-cat]");
      if (cat) { goCategory(cat.dataset.cat); return; }
      const open = e.target.closest("[data-open]");
      if (open) { const [p, param] = open.dataset.open.split("/"); go(p, param); }
    });
  }
  function emptyMini(msg) {
    return `<div class="empty"><div class="empty-icon">${PLANE}</div><strong>${esc(msg)}</strong></div>`;
  }

  /* ============================== tool index ============================== */
  function toolIndex(host, page) {
    let activeCat = pendingCategoryFilter || "all";
    pendingCategoryFilter = "";
    const list = N.registry.tools.filter((t) => t.route === page);
    const cats = [{ id: "all", label: "Semua" }].concat(N.registry.categories.filter((c) => list.some((t) => t.cat === c.id)));
    host.innerHTML = `<div class="workspace-head"><div><span class="eyebrow">${page === "tools" ? "Developer suite" : "Extra toolkit"}</span>
      <h1 class="page-title">${page === "tools" ? "Developer " : ""}<span class="gradient-text">${page === "tools" ? "Tools" : "Utilities"}</span></h1>
      <p class="sub">${list.length} tool siap pakai. Semua berjalan lokal di browser, tanpa mengirim data ke server.</p></div>
      <label class="search-field" style="width:min(300px,100%)"><svg viewBox="0 0 24 24" fill="none"><circle cx="10.8" cy="10.8" r="6.3" stroke="currentColor" stroke-width="1.8"/><path d="m16 16 4.4 4.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      <input type="search" id="indexSearch" placeholder="Cari di halaman ini..." aria-label="Cari tool"></label></div>
      <div class="chips" id="indexFilters">${cats.map((c) => `<button class="chip ${c.id === activeCat ? "active" : ""}" data-filter="${esc(c.id)}" type="button">${esc(c.label)} <span class="faint">${c.id === "all" ? list.length : list.filter((t) => t.cat === c.id).length}</span></button>`).join("")}</div>
      <div class="tool-grid mt-16" id="indexGrid"></div>`;
    const grid = $("#indexGrid", host);
    function render() {
      const q = ($("#indexSearch", host).value || "").toLowerCase().trim();
      const shown = list.filter((t) => (activeCat === "all" || t.cat === activeCat) && (!q || [t.name, t.desc, t.kw].join(" ").toLowerCase().includes(q)));
      grid.innerHTML = shown.length ? shown.map((t) => toolCard(t)).join("") : `<div class="empty" style="grid-column:1/-1"><div class="empty-icon">${PLANE}</div><strong>Tidak ada tool yang cocok</strong><p>Coba kata kunci atau kategori lain.</p></div>`;
    }
    $("#indexFilters", host).addEventListener("click", (e) => {
      const b = e.target.closest("[data-filter]");
      if (!b) return;
      activeCat = b.dataset.filter;
      $$("[data-filter]", host).forEach((x) => x.classList.toggle("active", x === b));
      render();
    });
    $("#indexSearch", host).addEventListener("input", render);
    bindToolCards(host);
    render();
  }

  /* ============================== favorites / history ============================== */
  function favorites(host) {
    const favs = C.state.favorites.map((id) => N.registry.get(id)).filter(Boolean);
    host.innerHTML = `<div class="workspace-head"><div><span class="eyebrow">Collection</span><h1 class="page-title"><span class="gradient-text">Favorites</span></h1>
      <p class="sub">Tool yang Anda simpan. Data tersimpan lokal di perangkat ini.</p></div><span class="badge pro">${favs.length} tersimpan</span></div>
      ${favs.length ? `<div class="tool-grid">${favs.map((t) => toolCard(t)).join("")}</div>` : `<div class="card card-pad"><div class="empty"><div class="empty-icon">${PLANE}</div><strong>Belum ada favorite</strong><p>Klik ikon bintang pada kartu tool untuk menyimpannya di sini.</p><button class="btn btn-primary mt-16" data-go="tools" type="button">Jelajahi tools</button></div></div>`}`;
    bindToolCards(host);
    host.addEventListener("click", (e) => { const g = e.target.closest("[data-go]"); if (g) go(g.dataset.go); });
  }
  function history(host) {
    const items = C.state.history || [];
    host.innerHTML = `<div class="workspace-head"><div><span class="eyebrow">Local log</span><h1 class="page-title">Activity <span class="gradient-text">History</span></h1>
      <p class="sub">${items.length} aktivitas tercatat di perangkat ini. Data ini tidak dikirim ke mana pun.</p></div>
      ${items.length ? '<button class="btn btn-sm btn-danger" data-clear type="button">Hapus riwayat</button>' : ""}</div>
      <div class="card card-pad">${items.length ? `<div class="results">${items.map((h) => {
        const t = N.registry.get(h.id);
        return `<div class="result-row"><span class="badge">${esc(h.kind)}</span><strong style="flex:1">${esc(t ? t.name : h.id)}</strong><small class="faint">${esc(C.formatDate(h.at))} · ${esc(C.formatTime(h.at))}</small></div>`;
      }).join("")}</div>` : `<div class="empty"><div class="empty-icon">${PLANE}</div><strong>Riwayat kosong</strong><p>Aktivitas Anda akan muncul di sini.</p></div>`}</div>`;
    host.addEventListener("click", (e) => {
      if (e.target.closest("[data-clear]")) {
        C.confirm("Hapus riwayat?", "Seluruh aktivitas lokal akan dihapus. Favorites dan skor tidak berubah.", () => {
          C.state.history = []; C.save(); C.emit("data-changed"); renderRoute(); C.toast("Riwayat dihapus.", "ok");
        }, "Ya, hapus");
      }
    });
  }

  /* ============================== security center ============================== */
  function securityCenter(host) {
    let checks = N.security.selfCheck();
    function badge(check) {
      if (check.info) return `<span class="sec-state info">INFO</span>`;
      return check.ok ? `<span class="sec-state ok">AMAN</span>` : `<span class="sec-state bad">PERHATIAN</span>`;
    }
    function draw() {
      const st = N.security.status();
      const passed = checks.filter((c) => c.ok && !c.info).length;
      const total = checks.filter((c) => !c.info).length;
      host.innerHTML = `
        <div class="workspace-head">
          <div><span class="eyebrow">Privacy & defense</span><h1 class="page-title">Security <span class="gradient-text">Center</span></h1>
          <p class="sub">Pertahanan browser: CSP, allowlist jaringan, key vault, dan pemeriksaan mandiri. Tidak ada telemetry, tidak ada backend.</p></div>
          <button class="btn btn-sm btn-ghost" data-act="fav" type="button">${ico(C.isFavorite("security-center") ? "star" : "starOff")}<span>${C.isFavorite("security-center") ? "Tersimpan" : "Simpan tool"}</span></button>
        </div>

        <div class="notice ${st.mode === "local" ? "info" : ""}"><span>${ico(st.mode === "local" ? "shield" : "alert")}</span><span><strong>Mode ${st.mode === "local" ? "Lokal" : "Eksternal"}.</strong>
          ${st.mode === "local"
            ? "Semua permintaan ke luar aplikasi diblokir. Tool berjaringan (Bewary, XRINA, iTunes, Spotify) tidak mengirim data apa pun sampai Anda mengaktifkannya secara sadar."
            : "Hanya 5 origin terizinkan di atas yang boleh dihubungi. Key API tidak pernah dikirim ke origin lain dan tidak disimpan permanen."}</span></div>

        <div class="grid grid-2">
          <div class="card card-pad sec-card">
            <span class="eyebrow">Kontrol</span><h3 class="card-title mt-8">Pengaturan pertahanan</h3>
            <label class="field mt-16"><span>Mode jaringan</span>
              <select id="secMode"><option value="local" ${st.mode === "local" ? "selected" : ""}>Lokal — blokir semua request keluar (disarankan)</option><option value="external" ${st.mode === "external" ? "selected" : ""}>Eksternal — hanya originAllowlisted</option></select></label>
            <p class="hint mt-8">Perubahan langsung berlaku untuk seluruh tab. Guard menutup <span class="mono">fetch</span>, XHR, WebSocket, beacon, dan penyuntikan script/iframe.</p>
            <label class="check mt-16"><input type="checkbox" id="secRemember" ${st.rememberKeys ? "checked" : ""}> Ingat API key untuk tab ini (sessionStorage)</label>
            <p class="hint mt-8">Default mati: key hanya disimpan di memory dan hilang saat tab ditutup. Jangan pernah menyimpan key produksi di localStorage.</p>
            <div class="row mt-16"><button class="btn btn-sm" id="secClearKeys" type="button">Hapus API key</button>
              <button class="btn btn-sm btn-ghost" id="secClearLog" type="button">Bersihkan log</button>
              <button class="btn btn-sm btn-ghost" id="secRecheck" type="button">${ico("refresh")}<span>Periksa ulang</span></button></div>
            <div class="divider"></div>
            <div class="sec-stats">
              <div><strong>${st.blocked}</strong><small>Diblokir</small></div>
              <div><strong>${st.allowed}</strong><small>Diizinkan</small></div>
              <div><strong>${st.storedKeys}</strong><small>API key aktif</small></div>
              <div><strong>${passed}/${total}</strong><small>Check lulus</small></div>
            </div>
            <p class="hint mt-16">Origin diizinkan: ${st.allowlist.map((a) => `<span class="mono">${esc(a)}</span>`).join(" · ")}</p>
          </div>

          <div class="card card-pad sec-card">
            <div class="spread"><div><span class="eyebrow">Diagnostics</span><h3 class="card-title mt-8">Pemeriksaan mandiri</h3></div><span class="badge ${passed === total ? "new" : "pro"}">${passed}/${total}</span></div>
            <div class="sec-checks mt-16">${checks.map((c) => `<div class="sec-check"><span class="sec-icon ${c.ok ? "ok" : "bad"}">${ico(c.ok ? "check" : "alert")}</span><span class="sec-check-copy"><strong>${esc(c.name)}</strong><small>${esc(c.detail)}</small></span>${badge(c)}</div>`).join("")}</div>
            <div class="divider"></div>
            <span class="eyebrow">Audit jaringan (60 terakhir)</span>
            <div class="sec-log mt-8">${st.audit.length ? st.audit.slice(0, 8).map((a) => `<div class="sec-log-row"><span class="mono tiny">${esc(C.formatTime(a.at))}</span><span class="sec-log-act">${esc(a.action)}</span><span class="mono tiny">${esc(a.origin)}</span><span class="sec-tag ${a.decision}">${esc(a.decision)}</span></div>`).join("") : `<p class="hint">Belum ada aktivitas jaringan yang tercatat.</p>`}</div>
          </div>
        </div>`;

      $("#secMode", host).addEventListener("change", (e) => { N.security.setMode(e.target.value); C.toast("Mode jaringan: " + (e.target.value === "local" ? "Lokal" : "Eksternal"), "ok"); });
      $("#secRemember", host).addEventListener("change", (e) => { N.security.setRememberKeys(e.target.checked); C.toast(e.target.checked ? "API key diingat untuk tab ini." : "API key hanya di memory.", "ok"); });
      $("#secClearKeys", host).addEventListener("click", () => { N.security.clearKeys(); C.toast("Semua API key dihapus.", "ok"); });
      $("#secClearLog", host).addEventListener("click", () => { N.security.clearAudit(); C.toast("Log dibersihkan.", "info"); });
      $("#secRecheck", host).addEventListener("click", () => { checks = N.security.selfCheck(); draw(); C.toast("Pemeriksaan ulang selesai.", "ok"); });
      const fav = host.querySelector('[data-act="fav"]');
      if (fav) fav.addEventListener("click", () => { const on = C.toggleFavorite("security-center"); fav.innerHTML = ico(on ? "star" : "starOff") + "<span>" + (on ? "Tersimpan" : "Simpan tool") + "</span>"; });
    }
    draw();
    const unsub = N.security.on(draw);
    C.addCleanup(unsub);
  }

  function updateSecurityBadge() {
    const label = $("#securityModeLabel");
    const btn = $("#securityBtn");
    if (!label || !btn || !N.security) return;
    const st = N.security.status();
    label.textContent = st.mode === "local" ? "Lokal" : "Eksternal";
    btn.classList.toggle("external", st.mode === "external");
    btn.setAttribute("aria-label", "Security Center — mode " + label.textContent);
  }

  /* ============================== settings ============================== */
  function settingsModal() {
    const s = C.state.settings;
    C.modal({
      title: "Pengaturan NEXUS",
      body: `<div class="grid" style="gap:14px">
        <label class="field"><span>Warna aksen</span><select id="setAccent">${ACCENTS.map((a) => `<option value="${esc(a.value)}">${esc(a.label)}</option>`).join("")}</select></label>
        <label class="field"><span>Tingkat kesulitan game default</span><select id="setDiff"><option value="easy">Mudah</option><option value="normal">Normal</option><option value="hard">Sulit</option></select></label>
        <label class="check"><input type="checkbox" id="setMotion"> Kurangi animasi & transisi</label>
        <label class="check"><input type="checkbox" id="setToast"> Tampilkan notifikasi toast</label>
        <label class="check"><input type="checkbox" id="setPreview"> Jalankan preview otomatis pada tool teks</label>
        <div class="divider"></div>
        <label class="field"><span>Mode jaringan</span><select id="setNetwork"><option value="local">Lokal — blokir request keluar</option><option value="external">Eksternal — origin terizinkan saja</option></select></label>
        <label class="check"><input type="checkbox" id="setRememberKeys"> Ingat API key untuk tab ini (sessionStorage)</label>
        <div class="row"><button class="btn btn-sm" id="setSecurity" type="button">${ico("shield")}<span>Buka Security Center</span></button></div>
        <div class="divider"></div>
        <div class="row"><button class="btn btn-sm" id="setExport" type="button">${ico("download")}<span>Ekspor data lokal</span></button>
          <button class="btn btn-sm" id="setLanding" type="button">Lihat landing lagi</button>
          <button class="btn btn-sm btn-danger" id="setReset" type="button">Hapus semua data lokal</button></div>
        <p class="hint">Pengaturan, favorites, catatan, dan skor disimpan di browser ini (localStorage).</p>
      </div>`,
      actions: [{ label: "Selesai", type: "primary", value: true }],
      onOpen(root) {
        $("#setAccent", root).value = s.accent;
        $("#setDiff", root).value = s.difficulty;
        $("#setMotion", root).checked = !!s.reduceMotion;
        $("#setToast", root).checked = !!s.toasts;
        $("#setPreview", root).checked = !!s.autoPreview;
        $("#setNetwork", root).value = N.security.mode;
        $("#setRememberKeys", root).checked = N.security.rememberKeys();
        $("#setSecurity", root).addEventListener("click", () => { C.closeModal(); go("security"); });
        $("#setNetwork", root).addEventListener("change", (e) => { N.security.setMode(e.target.value); updateSecurityBadge(); C.toast("Mode jaringan diperbarui.", "ok"); });
        $("#setRememberKeys", root).addEventListener("change", (e) => { N.security.setRememberKeys(e.target.checked); C.toast("Pengaturan API key diperbarui.", "ok"); });
        $("#setAccent", root).addEventListener("change", (e) => { s.accent = e.target.value; applyAccent(); C.save(); });
        $("#setDiff", root).addEventListener("change", (e) => { s.difficulty = e.target.value; C.save(); });
        $("#setMotion", root).addEventListener("change", (e) => { s.reduceMotion = e.target.checked; C.applySettings(); C.save(); });
        $("#setToast", root).addEventListener("change", (e) => { s.toasts = e.target.checked; C.save(); });
        $("#setPreview", root).addEventListener("change", (e) => { s.autoPreview = e.target.checked; C.save(); });
        $("#setExport", root).addEventListener("click", () => {
          C.download("nexus-toolbox-data.json", JSON.stringify(C.state, null, 2), "application/json");
          C.toast("Data lokal diekspor.", "ok");
        });
        $("#setLanding", root).addEventListener("click", () => {
          C.closeModal();
          setLandingSeen(false);
          go("landing");
          C.toast("Menampilkan landing lagi.", "info");
        });
        $("#setReset", root).addEventListener("click", () => {
          C.closeModal();
          C.confirm("Hapus semua data?", "Favorites, catatan, riwayat, skor, dan pengaturan akan dikembalikan ke awal.", () => {
            C.resetAll(); applyAccent(); applyShellPrefs(); C.toast("Semua data lokal dihapus.", "ok"); renderRoute();
          }, "Ya, hapus semua");
        });
      }
    });
  }

  /* ============================== search ============================== */
  function quickSearchModal() {
    C.modal({
      title: "Cari tools",
      body: `<label class="search-field" style="width:100%"><svg viewBox="0 0 24 24" fill="none"><circle cx="10.8" cy="10.8" r="6.3" stroke="currentColor" stroke-width="1.8"/><path d="m16 16 4.4 4.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><input id="quickSearchInput" type="search" placeholder="Cari tools, kategori..." autocomplete="off"></label>
        <div class="search-results" id="quickResults" style="position:static;margin-top:10px;box-shadow:none;border:0;padding:0"></div>`,
      actions: [{ label: "Tutup", type: "ghost", value: false }],
      onOpen(root) {
        const input = $("#quickSearchInput", root);
        const results = $("#quickResults", root);
        function choose(id) {
          const t = N.registry.get(id);
          if (t) { C.closeModal(); go(t.route, t.id); }
        }
        function render() {
          const q = input.value.trim();
          if (!q) { results.innerHTML = ""; return; }
          const found = N.registry.search(q, 12);
          results.innerHTML = found.length ? found.map((t) => `<button class="search-result" data-result="${esc(t.id)}" type="button"><span class="sr-icon">${toolIco(t)}</span><span><strong>${esc(t.name)}</strong><small>${esc(N.registry.category(t.cat).label)} · ${esc(t.desc.slice(0, 48))}…</small></span></button>`).join("") : `<div class="search-empty">Tidak ada tool untuk "${esc(q)}".</div>`;
        }
        input.addEventListener("input", render);
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            const first = results.querySelector("[data-result]");
            if (first) choose(first.dataset.result);
          }
        });
        results.addEventListener("click", (e) => {
          const b = e.target.closest("[data-result]");
          if (b) choose(b.dataset.result);
        });
      }
    });
  }
  function setupSearch() {
    const input = $("#globalSearch");
    const panel = $("#searchResults");
    function hide() { panel.hidden = true; panel.innerHTML = ""; }
    function show() {
      const q = input.value.trim();
      if (!q) { hide(); return; }
      const results = N.registry.search(q, 12);
      panel.innerHTML = results.length ? results.map((t) => `<button class="search-result" data-result="${esc(t.id)}" type="button">
        <span class="sr-icon">${toolIco(t)}</span><span><strong>${esc(t.name)}</strong><small>${esc(N.registry.category(t.cat).label)} · ${esc(t.desc.slice(0, 48))}…</small></span></button>`).join("") : `<div class="search-empty">Tidak ada tool untuk "${esc(q)}".</div>`;
      panel.hidden = false;
    }
    input.addEventListener("input", show);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const first = panel.querySelector("[data-result]");
        if (first) { openResult(first.dataset.result); input.value = ""; hide(); input.blur(); }
      }
      if (e.key === "Escape") { input.value = ""; hide(); input.blur(); }
    });
    panel.addEventListener("click", (e) => {
      const b = e.target.closest("[data-result]");
      if (b) { openResult(b.dataset.result); input.value = ""; hide(); input.blur(); }
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".sidebar-search")) hide();
    });
    function openResult(id) {
      const t = N.registry.get(id);
      if (t) go(t.route, t.id);
    }
    $("#quickSearchBtn").addEventListener("click", quickSearchModal);
    document.addEventListener("keydown", (e) => {
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName);
      if (e.key === "/" && !typing) { e.preventDefault(); quickSearchModal(); }
    });
  }

  /* ============================== sidebar ============================== */
  function openSidebar(open) {
    const mobile = window.matchMedia && window.matchMedia("(max-width:767px)").matches;
    $("#sidebar").classList.toggle("open", !!open);
    $("#sidebarScrim").hidden = !(open && mobile);
    $("#menuBtn").setAttribute("aria-expanded", String(!!open));
  }
  function renderSidebar() {
    const cats = $("#sideCategories");
    if (cats) {
      cats.innerHTML = N.registry.categories.map((c) => {
        const count = N.registry.tools.filter((t) => t.cat === c.id).length;
        return `<button class="cat-link" data-cat="${esc(c.id)}" type="button"><span class="cat-dot ${esc(c.id)}"></span><span>${esc(c.label)}</span><span class="cat-count">${count}</span></button>`;
      }).join("");
    }
    const progress = $("#sideProgress");
    if (progress) {
      const used = Object.keys(C.state.usage || {}).filter((k) => C.state.usage[k] > 0).length;
      const total = N.registry.tools.length;
      const pct = total ? Math.round((used / total) * 100) : 0;
      progress.innerHTML = `<div class="progress-ring" style="--ring:${pct}%"><span>${pct}%</span></div>
        <div class="side-progress-copy"><strong>Tool terpakai ${used} / ${total}</strong><small>${pct}% dari katalog lokal</small></div>
        <button class="progress-view" data-progress-view type="button" data-tip="Lihat riwayat">Lihat</button>`;
    }
  }
  function setupShell() {
    $("#menuBtn").addEventListener("click", () => openSidebar(true));
    $("#sidebarClose").addEventListener("click", () => openSidebar(false));
    $("#sidebarScrim").addEventListener("click", () => openSidebar(false));
    $("#sidebarCollapse").addEventListener("click", () => {
      const next = !C.state.settings.sidebarCollapsed;
      C.state.settings.sidebarCollapsed = next;
      applyShellPrefs();
      C.save();
    });
    [$("#openSettings"), $("#topSettingsBtn"), $("#footerSettings"), $("#profileBtn")].forEach((b) => b && b.addEventListener("click", settingsModal));
    const secBtn = $("#securityBtn");
    if (secBtn) secBtn.addEventListener("click", () => go("security"));
    if (N.security) { N.security.on(updateSecurityBadge); updateSecurityBadge(); }
    const profile = $("#profileBtn");
    if (profile) profile.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); settingsModal(); } });
    const help = $("#helpCenter");
    if (help) help.addEventListener("click", () => C.modal({
      title: "Pusat bantuan",
      body: `<div class="grid" style="gap:10px"><p class="sub">Semua tool berjalan langsung di browser Anda. Cari tool lewat sidebar atau tekan <span class="mono">/</span>, lalu simpan favorit dengan ikon bintang.</p><p class="sub">Landing dapat dibuka lagi lewat Pengaturan → Lihat landing lagi. Data lokal bisa diekspor dari Pengaturan.</p></div>`,
      actions: [{ label: "Mengerti", type: "primary", value: true }]
    }));
    const catAdd = $("#catAdd");
    if (catAdd) catAdd.addEventListener("click", () => go("tools"));
    window.addEventListener("resize", applyShellPrefs);
    $("#themeBtn").addEventListener("click", () => {
      const order = ACCENTS.map((a) => a.value);
      const i = order.indexOf(C.state.settings.accent);
      C.state.settings.accent = order[(i + 1) % order.length];
      applyAccent(); C.save();
      const accent = ACCENTS.find((a) => a.value === C.state.settings.accent);
      C.toast("Aksen: " + (accent ? accent.label : C.state.settings.accent), "info");
    });
    const cats = $("#sideCategories");
    if (cats) cats.addEventListener("click", (e) => {
      const b = e.target.closest("[data-cat]");
      if (b) { goCategory(b.dataset.cat); openSidebar(false); }
    });
    const progressView = $("#sideProgress");
    if (progressView) progressView.addEventListener("click", (e) => {
      if (e.target.closest("[data-progress-view]")) { go("history"); openSidebar(false); }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") openSidebar(false);
    });
    C.on("data-changed", () => {
      $$("[data-star]").forEach((b) => {
        const on = C.isFavorite(b.dataset.star);
        b.classList.toggle("on", on);
        b.innerHTML = ico(on ? "star" : "starOff");
      });
      renderSidebar();
    });
  }

  /* ============================== routing ============================== */
  let renderToken = 0;
  function skeleton() {
    return `<div class="loader-plane">${PLANE}<span>Menyiapkan workspace…</span></div>
      <div class="grid grid-3">${Array.from({ length: 6 }, () => `<div class="card skeleton-card"><div class="skeleton" style="height:42px;width:45%"></div><div class="skeleton" style="height:14px;width:90%"></div><div class="skeleton" style="height:14px;width:65%"></div></div>`).join("")}</div>`;
  }
  function renderRoute() {
    const token = ++renderToken;
    C.runCleanups();
    const { page, param } = parseHash();
    const info = ROUTES[page];
    if (page !== "landing" && !landingSeen()) setLandingSeen(true);
    document.body.classList.toggle("landing-active", page === "landing");
    $("#topbarTitle").textContent = info.title;
    $("#topbarKicker").textContent = info.kicker;
    $$('[data-route]').forEach((a) => {
      const target = (a.getAttribute("href") || "").replace("#/", "");
      a.classList.toggle("active", target === page || (page === "dashboard" && target === "dashboard"));
    });
    renderSidebar();
    openSidebar(false);
    window.scrollTo({ top: 0, behavior: "auto" });

    const oldView = $("#view");
    const view = document.createElement("main");
    view.className = "view";
    view.id = "view";
    view.tabIndex = -1;
    oldView.replaceWith(view);
    const heavy = ["tools", "utilities", "games"].includes(page) && !!param;
    view.innerHTML = heavy ? skeleton() : "";
    const draw = () => {
      if (token !== renderToken) return;
      view.innerHTML = "";
      if (page === "landing") landing(view);
      else if (page === "dashboard") dashboard(view);
      else if (page === "protect") N.protection.render(view);
      else if (page === "ai") N.ai.render(view);
      else if (page === "tools") param ? N.codeTools.render(view, param) : toolIndex(view, "tools");
      else if (page === "utilities") param ? N.utilities.render(view, param) : toolIndex(view, "utilities");
      else if (page === "games") param ? N.games.render(view, param) : N.games.index(view);
      else if (page === "music") N.music.render(view);
      else if (page === "favorites") favorites(view);
      else if (page === "history") history(view);
      else if (page === "security") securityCenter(view);
      view.focus({ preventScroll: true });
      document.title = `${info.title} — NEXUS TOOLBOX`;
    };
    if (heavy) setTimeout(draw, 160);
    else requestAnimationFrame(draw);
  }

  function init() {
    $$("[data-icon]").forEach((el) => { el.innerHTML = ico(el.dataset.icon); });
    applyAccent();
    applyShellPrefs();
    setupShell();
    setupSearch();
    window.addEventListener("hashchange", renderRoute);
    if (!location.hash) location.hash = "#/landing";  // pesawat kertas tampil setiap kali app dibuka dari alamat utama
    renderRoute();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(window.Nexus = window.Nexus || {});
