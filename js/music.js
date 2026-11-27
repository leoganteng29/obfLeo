/* NEXUS TOOLBOX — Music Lounge: cari lagu, pratinjau 30 detik (iTunes), pemutar Spotify penuh, dan favorit */
(function (N) {
  "use strict";

  const ico = (name, cls) => (N.icons ? N.icons.svg(name, cls) : "");
  const { escapeHtml: esc } = N.core;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const XRINA = "https://apiii-xrina.my.id";
  const FAV_KEY = "nexus.music.favs";

  const fmtSec = (s) => { const n = Math.max(0, Math.round(Number(s) || 0)); return Math.floor(n / 60) + ":" + String(n % 60).padStart(2, "0"); };
  const names = (arr) => (Array.isArray(arr) ? arr.map((a) => (typeof a === "string" ? a : a && a.name)).filter(Boolean).join(", ") : "");
  const spotifyId = (t) => {
    if (t && typeof t.id === "string" && /^[A-Za-z0-9]{10,}$/.test(t.id)) return t.id;
    const m = String((t && t.uri) || "").match(/spotify:track:([A-Za-z0-9]+)/);
    return m ? m[1] : "";
  };

  function loadFavs() {
    try { const v = JSON.parse(localStorage.getItem(FAV_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  function saveFavs(list) {
    try { localStorage.setItem(FAV_KEY, JSON.stringify(list)); } catch (e) { /* penyimpanan diblokir: favorit hanya untuk sesi ini */ }
  }

  // Model lagu seragam: src "itunes" (pratinjau 30 dtk) atau "spotify" (pemutar penuh lewat embed resmi Spotify).
  async function fetchItunes(q, signal) {
    const res = await N.security.fetch("https://itunes.apple.com/search?term=" + encodeURIComponent(q) + "&media=music&entity=song&limit=15&country=ID", { signal });
    if (!res.ok) throw new Error("iTunes HTTP " + res.status);
    const j = await res.json();
    return (j.results || []).filter((x) => x.trackName && x.previewUrl).map((x) => ({
      key: "it:" + x.trackId, src: "itunes", title: x.trackName, artist: x.artistName || "-",
      album: x.collectionName || "", art: x.artworkUrl100 || "", sec: (x.trackTimeMillis || 0) / 1000,
      preview: x.previewUrl, spId: "", link: x.trackViewUrl || ""
    }));
  }
  async function fetchSpotify(q, signal) {
    const res = await N.security.fetch(XRINA + "/search/spotify?query=" + encodeURIComponent(q), { headers: { Accept: "application/json" }, signal });
    if (!res.ok) throw new Error("Spotify HTTP " + res.status);
    const j = await res.json();
    if (!j || j.status !== true) throw new Error((j && (j.message || j.error)) || "Spotify tidak memberi hasil.");
    const tracks = Array.isArray(j.data && j.data.tracks) ? j.data.tracks : [];
    return tracks.map((t) => {
      const id = spotifyId(t);
      return { key: "sp:" + id, src: "spotify", title: t.name || "-", artist: names(t.artists) || "-",
        album: (t.album && t.album.name) || "", art: t.poster || t.image || "", sec: 0, preview: "", spId: id,
        link: id ? "https://open.spotify.com/track/" + id : "" };
    }).filter((t) => t.spId);
  }

  let spApi = null, spState = "idle", spWaiters = [];
  function loadSpotifyApi(cb) {
    if (spState === "ready") return cb(spApi);
    if (spState === "failed") return cb(null);
    spWaiters.push(cb);
    if (spState === "loading") return;
    spState = "loading";
    const timeout = setTimeout(() => finish(null, "failed"), 5000);
    function finish(api, state) {
      clearTimeout(timeout);
      spApi = api; spState = state;
      const ws = spWaiters; spWaiters = [];
      ws.forEach((f) => f(api));
    }
    window.onSpotifyIframeApiReady = (api) => finish(api, "ready");
    N.security.loadScript("https://open.spotify.com/embed/iframe-api/v1", (ok) => { if (!ok) finish(null, "failed"); });
  }

  function render(host) {
    host.innerHTML = `<style>
      .mu-player{position:sticky;bottom:84px;z-index:5;margin-top:16px;display:flex;gap:12px;align-items:center;padding:10px 12px;border-radius:16px;background:rgba(255,255,255,.97);border:1px solid var(--line);box-shadow:0 10px 30px rgba(15,23,42,.16)}
      .mu-player[hidden],.mu-spbox[hidden]{display:none}
      @media (min-width:768px){.mu-player{bottom:12px}}
      .mu-player img,.mu-art-ph{width:44px;height:44px;border-radius:8px;flex:none;object-fit:cover;background:#eff6ff}
      .mu-info{min-width:0;flex:1}
      .mu-info strong{display:block;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .mu-info small{display:block;color:var(--muted);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .mu-ctrl{display:flex;align-items:center;gap:6px;flex:none}
      .mu-ctrl button{width:34px;height:34px;border-radius:50%;border:1px solid var(--line);background:#fff;cursor:pointer;font-size:13px}
      .mu-ctrl button:disabled{opacity:.4;cursor:default}
      .mu-ctrl .big{background:var(--accent);color:#fff;border-color:transparent}
      .mu-ctrl .on{color:#e11d48}
      .mu-seek{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--muted);flex:1;min-width:0}
      .mu-seek input{flex:1;min-width:0}
      .mu-vol{width:80px}
      .mu-row{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:12px;border:1px solid var(--line);background:#fff}
      .mu-row.active{border-color:var(--accent);background:#eff6ff}
      .mu-row img,.mu-row .mu-art-ph{width:44px;height:44px;border-radius:8px;flex:none;object-fit:cover;background:#eff6ff}
      .mu-meta{flex:1;min-width:0}
      .mu-meta strong{display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .mu-meta small{display:block;color:var(--muted);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .mu-tag{font-size:10px;padding:2px 6px;border-radius:6px;background:#eff6ff;color:var(--accent);white-space:nowrap}
      .mu-tag.full{background:#dcfce7;color:#166534}
      .mu-acts{display:flex;gap:6px;flex:none;align-items:center}
      .mu-acts button,.mu-acts a{font-size:12px}
      .mu-tabs{display:flex;gap:8px;margin-top:12px}
      .mu-tabs .btn.active{background:var(--accent);color:#fff;border-color:transparent}
    </style>
    <div class="workspace-head"><div><span class="eyebrow">Ambience</span><h1 class="page-title">Music <span class="gradient-text">Lounge</span></h1>
      <p class="sub">Cari lagu, putar pratinjau 30 detik, atau dengarkan lagu penuh lewat pemutar Spotify. Favorit tersimpan di perangkat ini.</p></div></div>

    <div class="card card-pad">
      <form class="row" id="muSearchForm" autocomplete="off">
        <input type="search" id="muSearchQ" placeholder="Judul lagu atau artis, misalnya Tulus Hati-Hati di Jalan" maxlength="120" required style="flex:1;min-width:0">
        <button class="btn btn-primary" type="submit">Cari</button>
      </form>
      <div class="mu-tabs">
        <button class="btn btn-sm active" data-tab="search" type="button">Hasil pencarian</button>
        <button class="btn btn-sm" data-tab="favs" type="button">Favorit (<span id="muFavCount">0</span>)</button>
      </div>
      <div class="status-line mt-8" id="muSearchStatus"></div>
      <div class="mt-8" id="muList" style="display:grid;gap:8px;max-height:52vh;overflow:auto"></div>
      <p class="hint mt-16">Pratinjau iTunes hanya 30 detik. Lagu dari Spotify diputar penuh oleh pemutar Spotify resmi, dan butuh akun Spotify untuk lagu penuh.</p>
    </div>

    <div class="card card-pad mt-16 mu-spbox" id="muSpBox" hidden>
      <div class="spread"><h3 class="card-title">Pemutar Spotify</h3><span class="hint">Lagu penuh</span></div>
      <div id="muSpEmbed" style="margin-top:10px;min-height:152px"></div>
    </div>

    <div class="mu-player" id="muPlayer" hidden>
      <div id="muArt" style="flex:none;width:44px;height:44px"></div>
      <div class="mu-info"><strong id="muTitle">-</strong><small id="muArtist">-</small></div>
      <div class="mu-ctrl">
        <button id="muPrev" type="button" aria-label="Sebelumnya">${ico("skipBack")}</button>
        <button id="muPlay" class="big" type="button" aria-label="Putar atau jeda">${ico("play")}</button>
        <button id="muNext" type="button" aria-label="Berikutnya">${ico("skipForward")}</button>
        <button id="muFav" type="button" aria-label="Favorit">${ico("heartOff")}</button>
      </div>
      <div class="mu-seek"><span id="muCur">0:00</span><input type="range" id="muSeek" min="0" max="100" value="0" step="0.1" aria-label="Posisi lagu"><span id="muDur">0:30</span></div>
      <input type="range" class="mu-vol" id="muVol" min="0" max="100" value="80" aria-label="Volume">
    </div>`;

    const pv = new Audio();
    pv.preload = "auto";
    pv.volume = 0.8;

    let tab = "search";
    let results = [];        // hasil pencarian terakhir
    let favs = loadFavs();   // daftar favorit (tersimpan di localStorage)
    let shown = [];          // daftar yang sedang tampil di layar
    let cur = null;          // lagu yang sedang aktif
    let curMode = "";        // "preview" | "spotify"
    let searchCtrl = null;

    const q = (s) => $(s, host);

    function artHtml(t) {
      return t.art ? `<img src="${esc(t.art)}" alt="" referrerpolicy="no-referrer">` : `<span class="mu-art-ph"></span>`;
    }
    function isFav(key) { return favs.some((f) => f.key === key); }
    function updateFavCount() { q("#muFavCount").textContent = String(favs.length); }

    function renderList() {
      shown = tab === "favs" ? favs : results;
      const el = q("#muList");
      if (!shown.length) {
        el.innerHTML = `<p class="hint">${tab === "favs" ? "Belum ada favorit. Tekan ikon hati pada lagu untuk menyimpannya." : "Belum ada pencarian."}</p>`;
        return;
      }
      el.innerHTML = shown.map((t, i) => {
        const playable = t.src === "itunes" ? !!t.preview : !!t.spId;
        const tag = t.src === "itunes" ? `<span class="mu-tag">Pratinjau 30 dtk</span>` : `<span class="mu-tag full">Penuh · Spotify</span>`;
        const active = cur && cur.key === t.key ? " active" : "";
        return `<div class="mu-row${active}" data-play="${i}" style="cursor:pointer">
          ${artHtml(t)}
          <div class="mu-meta"><strong>${esc(t.title)}</strong><small>${esc(t.artist)}${t.album ? " · " + esc(t.album) : ""}${t.sec ? " · " + fmtSec(t.sec) : ""}</small>${tag}</div>
          <div class="mu-acts">
            <button class="btn btn-sm" data-play="${i}" type="button" ${playable ? "" : "disabled"}>${ico("play")}</button>
            <button class="btn btn-sm${isFav(t.key) ? " on" : ""}" data-fav="${i}" type="button" aria-label="Favorit">${ico(isFav(t.key) ? "heart" : "heartOff")}</button>
          </div></div>`;
      }).join("");
    }

    function showPlayer(t) {
      q("#muPlayer").hidden = false;
      q("#muArt").innerHTML = artHtml(t);
      q("#muTitle").textContent = t.title;
      q("#muArtist").textContent = t.artist;
      q("#muFav").innerHTML = ico(isFav(t.key) ? "heart" : "heartOff");
      q("#muFav").classList.toggle("on", isFav(t.key));
      const playing = curMode === "preview" && !pv.paused;
      q("#muPlay").innerHTML = ico(playing ? "pause" : "play");
      q("#muPrev").disabled = !hasNeighbor(-1);
      q("#muNext").disabled = !hasNeighbor(1);
      setMediaSession(t);
    }

    function hasNeighbor(step) {
      for (let i = shown.indexOf(cur) + step; i >= 0 && i < shown.length; i += step) {
        const x = shown[i];
        if (x.src === "itunes" ? x.preview : x.spId) return true;
      }
      return false;
    }

    function setMediaSession(t) {
      if (!("mediaSession" in navigator)) return;
      try {
        navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist, album: t.album || "", artwork: t.art ? [{ src: t.art, sizes: "100x100" }] : [] });
        navigator.mediaSession.setActionHandler("play", () => togglePlay());
        navigator.mediaSession.setActionHandler("pause", () => togglePlay());
        navigator.mediaSession.setActionHandler("nexttrack", () => step(1));
        navigator.mediaSession.setActionHandler("previoustrack", () => step(-1));
      } catch (e) { /* browser lama: lewati */ }
    }

    let spCtrl = null;
    function spotifyFallback(id) {
      const el = q("#muSpEmbed");
      if (!el) return;
      el.innerHTML = '<iframe title="Pemutar Spotify" src="https://open.spotify.com/embed/track/' + encodeURIComponent(id) + '?utm_source=generator&autoplay=1" style="width:100%;height:152px;border:0;border-radius:12px" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="eager"></iframe>';
    }
    function setSpotify(id) {
      const box = q("#muSpBox");
      if (!id) {
        if (spCtrl) { try { spCtrl.pause(); } catch (e) {} }
        box.hidden = true;
        return;
      }
      const guard = N.security.check("https://open.spotify.com/embed/track/" + id, "frame");
      if (!guard.ok) { N.core.toast("Spotify diblokir: " + guard.reason, "err"); return; }
      box.hidden = false;
      const uri = "spotify:track:" + id;
      loadSpotifyApi((api) => {
        if (!q("#muSpEmbed")) return;
        if (!api) { spotifyFallback(id); return; }
        if (spCtrl) { spCtrl.loadUri(uri); spCtrl.play(); return; }
        api.createController(q("#muSpEmbed"), { uri: uri, width: "100%", height: 152 }, (c) => {
          spCtrl = c;
          c.addListener("ready", () => c.play());
        });
      });
    }

    function playTrack(t) {
      if (!t) return;
      cur = t;
      N.core.trackTool("ambient", "music");
      if (t.src === "itunes" && t.preview) {
        const guard = N.security.check(t.preview, "media");
        if (!guard.ok) { N.core.toast("Pratinjau diblokir: " + guard.reason, "err"); return; }
        setSpotify("");
        curMode = "preview";
        q("#muSeek").disabled = false;
        if (pv.src !== t.preview) pv.src = t.preview;
        pv.currentTime = 0;
        showPlayer(t);
        pv.play().catch(() => N.core.toast("Pratinjau tidak bisa diputar. Coba ketuk lagi.", "err"));
      } else if (t.src === "spotify" && t.spId) {
        pv.pause();
        curMode = "spotify";
        q("#muSeek").disabled = true;
        q("#muCur").textContent = "Spotify";
        q("#muDur").textContent = "";
        setSpotify(t.spId);
        showPlayer(t);
      }
      renderList();
    }

    function togglePlay() {
      if (!cur) return;
      if (curMode === "spotify") { N.core.toast("Gunakan tombol putar di pemutar Spotify.", "info"); return; }
      if (pv.paused) pv.play().catch(() => {}); else pv.pause();
    }

    function step(dir) {
      if (!cur) return;
      for (let i = shown.indexOf(cur) + dir; i >= 0 && i < shown.length; i += dir) {
        const x = shown[i];
        if (x.src === "itunes" ? x.preview : x.spId) { playTrack(x); return; }
      }
    }

    function toggleFav(t) {
      if (!t) return;
      if (isFav(t.key)) favs = favs.filter((f) => f.key !== t.key);
      else favs = [{ key: t.key, src: t.src, title: t.title, artist: t.artist, album: t.album, art: t.art, sec: t.sec, preview: t.preview, spId: t.spId, link: t.link }, ...favs];
      saveFavs(favs);
      updateFavCount();
      if (cur) q("#muFav").innerHTML = ico(isFav(cur.key) ? "heart" : "heartOff");
      renderList();
    }

    async function search(term) {
      if (searchCtrl) searchCtrl.abort();
      searchCtrl = new AbortController();
      const ctrl = searchCtrl;
      const status = q("#muSearchStatus");
      status.className = "status-line"; status.textContent = "Mencari…";
      const timeout = setTimeout(() => ctrl.abort(), 12000);
      try {
        const [it, sp] = await Promise.allSettled([fetchItunes(term, ctrl.signal), fetchSpotify(term, ctrl.signal)]);
        if (ctrl.signal.aborted) return;
        const itunes = it.status === "fulfilled" ? it.value : [];
        const spotify = sp.status === "fulfilled" ? sp.value : [];
        // Lagu penuh (Spotify) ditampilkan dulu, lalu pratinjau iTunes.
        results = [...spotify, ...itunes];
        tab = "search";
        setTabs();
        renderList();
        if (!results.length) {
          status.className = "status-line bad";
          status.textContent = "Tidak ada hasil. " + (it.status === "rejected" ? "iTunes gagal dihubungi. " : "") + (sp.status === "rejected" ? "Spotify gagal: " + sp.reason.message : "");
        } else {
          status.className = "status-line ok";
          status.textContent = spotify.length + " lagu Spotify (penuh) · " + itunes.length + " pratinjau iTunes";
        }
      } catch (err) {
        if (ctrl.signal.aborted) return;
        results = []; renderList();
        status.className = "status-line bad"; status.textContent = "Gagal mencari: " + err.message;
      } finally {
        clearTimeout(timeout);
      }
    }

    function setTabs() {
      $$("[data-tab]", host).forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    }

    // ---------- event ----------
    q("#muSearchForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const term = q("#muSearchQ").value.trim();
      if (term) search(term);
    });

    host.addEventListener("click", (e) => {
      const tabBtn = e.target.closest("[data-tab]");
      if (tabBtn) { tab = tabBtn.dataset.tab; setTabs(); renderList(); return; }
      const fav = e.target.closest("[data-fav]");
      if (fav) { toggleFav(shown[Number(fav.dataset.fav)]); return; }
      const play = e.target.closest("[data-play]");
      if (play) { playTrack(shown[Number(play.dataset.play)]); return; }
      if (e.target.closest("#muPlay")) { togglePlay(); return; }
      if (e.target.closest("#muPrev")) { step(-1); return; }
      if (e.target.closest("#muNext")) { step(1); return; }
      if (e.target.closest("#muFav")) { toggleFav(cur); return; }
    });

    pv.addEventListener("play", () => { q("#muPlay").innerHTML = ico("pause"); });
    pv.addEventListener("pause", () => { q("#muPlay").innerHTML = ico("play"); });
    pv.addEventListener("timeupdate", () => {
      if (curMode !== "preview") return;
      const d = pv.duration || 0;
      q("#muCur").textContent = fmtSec(pv.currentTime);
      q("#muDur").textContent = d ? fmtSec(d) : "0:30";
      q("#muSeek").value = d ? String((pv.currentTime / d) * 100) : "0";
    });
    pv.addEventListener("ended", () => { q("#muPlay").innerHTML = ico("play"); step(1); });
    q("#muSeek").addEventListener("input", (e) => {
      const d = pv.duration;
      if (curMode === "preview" && d) pv.currentTime = (Number(e.target.value) / 100) * d;
    });
    q("#muVol").addEventListener("input", (e) => { pv.volume = Number(e.target.value) / 100; });

    N.core.addCleanup(() => {
      if (searchCtrl) searchCtrl.abort();
      pv.pause(); pv.removeAttribute("src");
      if (spCtrl) { try { spCtrl.destroy(); } catch (e) {} spCtrl = null; }
      const emb = host.querySelector("#muSpEmbed");
      if (emb) emb.innerHTML = "";
    });

    updateFavCount();
    setTabs();
    renderList();
  }

  N.music = { render };
})(window.Nexus = window.Nexus || {});
