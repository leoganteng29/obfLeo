/* NEXUS TOOLBOX — Security layer: network allowlist, key vault, audit & self-check.
   Dimuat PERTAMA sebelum modul lain supaya semua jaringan melewati gate ini. */
(function (N) {
  "use strict";

  const SELF = (function () {
    try {
      const u = new URL(location.href);
      return u.origin === "null" ? u.href : u.origin; // file:// saat development lokal
    } catch (e) { return ""; }
  })();
  const SELF_ORIGIN = (function () {
    try { return new URL(location.href).origin; } catch (e) { return ""; }
  })();

  /* Hanya origin + path ini yang boleh dihubungi. Tambah attacker/Tracker tidak akan lolos. */
  const ALLOW = Object.freeze({
    "api.bewary.app": {
      paths: [/^\/v1\//],
      label: "Bewary (pengecekan penipuan)"
    },
    "apiii-xrina.my.id": {
      paths: [/^\/search\//, /^\/stalker\//, /^\/tools\//],
      label: "XRINA (lirik / Spotify / utilitas)"
    },
    "itunes.apple.com": {
      paths: [/^\/search$/],
      label: "iTunes Search API"
    },
    "audio-ssl.itunes.apple.com": {
      paths: [],
      label: "iTunes preview audio"
    },
    "open.spotify.com": {
      paths: [/^\/embed\//, /^\/track\//, /^\/artist\//, /^\/album\//, /^\/playlist\//],
      label: "Spotify Embed"
    },
    "openrouter.ai": { paths: [/^\/api\/v1\//], label: "OpenRouter API" }
  });

  /* Origin AI kustom didaftarkan sesaat sebelum request (memory only). */
  const customOrigins = new Map();
  const listeners = [];
  const audit = [];
  const vault = new Map();
  const KEY_PREFIX = "nexus.secure.";

  function emit() {
    listeners.slice().forEach((fn) => { try { fn(status()); } catch (e) { /* jangan sampai mengganggu app */ } });
  }
  function on(fn) { if (typeof fn === "function") listeners.push(fn); return () => off(fn); }
  function off(fn) { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }

  function currentMode() {
    const s = N.core && N.core.state && N.core.state.settings;
    return s && s.networkMode === "external" ? "external" : "local";
  }
  function setMode(mode) {
    const next = mode === "external" ? "external" : "local";
    if (!N.core || !N.core.state) return next;
    N.core.state.settings.networkMode = next;
    N.core.save();
    record("mode", location.origin || "local", "allowed", "Mode jaringan: " + next);
    emit();
    return next;
  }

  function rememberKeys() {
    const s = N.core && N.core.state && N.core.state.settings;
    return !!(s && s.rememberApiKeys === true);
  }
  function setRememberKeys(value) {
    if (!N.core || !N.core.state) return false;
    N.core.state.settings.rememberApiKeys = !!value;
    if (!N.core.state.settings.rememberApiKeys) clearStoredKeys();
    N.core.save();
    emit();
    return N.core.state.settings.rememberApiKeys;
  }

  function record(action, url, decision, detail) {
    audit.unshift({
      at: Date.now(),
      action: String(action || "request"),
      origin: safeOrigin(url),
      decision: String(decision || "blocked"),
      detail: String(detail || "")
    });
    if (audit.length > 60) audit.length = 60;
  }
  function safeOrigin(raw) {
    try { return new URL(String(raw), SELF || undefined).origin; } catch (e) { return String(raw || "-").slice(0, 80); }
  }
  function parse(raw) {
    try { return new URL(String(raw), SELF || undefined); } catch (e) { return null; }
  }
  function check(raw, kind) {
    const u = parse(raw);
    if (!u) return { ok: false, reason: "URL tidak valid." };
    if (u.origin === SELF_ORIGIN) return { ok: true, reason: "Origin aplikasi sendiri." };
    if (u.protocol !== "https:" && !(u.protocol === "http:" && /^(localhost|127\.0\.0\.1)$/.test(u.hostname))) {
      return { ok: false, reason: "Hanya HTTPS (atau localhost) yang diizinkan." };
    }
    if (currentMode() !== "external") {
      return { ok: false, reason: "Mode Lokal aktif. Aktifkan akses eksternal di Security Center untuk tool berjaringan." };
    }
    const rule = ALLOW[u.hostname] || customOrigins.get(u.hostname);
    if (!rule) return { ok: false, reason: "Origin tidak ada dalam daftar izin (possible data leak dicegah)." };
    if (kind !== "frame" && rule.paths.length && !rule.paths.some((re) => re.test(u.pathname))) {
      return { ok: false, reason: "Path tidak diizinkan untuk origin ini." };
    }
    return { ok: true, reason: rule.label };
  }

  function BlockedError(message) {
    const e = new Error(message);
    e.name = "NetworkBlockedError";
    e.blocked = true;
    return e;
  }

  /* ---------- Key vault: in-memory by default, never written to localStorage ---------- */
  function setKey(id, value) {
    const key = String(id || "");
    if (!key) return;
    const val = String(value == null ? "" : value);
    if (val) vault.set(key, val); else vault.delete(key);
    try {
      if (val && rememberKeys()) sessionStorage.setItem(KEY_PREFIX + key, val);
      else sessionStorage.removeItem(KEY_PREFIX + key);
    } catch (e) { /* storage diblokir: key tetap aman di memory */ }
    emit();
  }
  function getKey(id) {
    const key = String(id || "");
    if (!key) return "";
    if (vault.has(key)) return vault.get(key) || "";
    if (!rememberKeys()) return "";
    try { return sessionStorage.getItem(KEY_PREFIX + key) || ""; } catch (e) { return ""; }
  }
  function clearStoredKeys() {
    try {
      Object.keys(sessionStorage).filter((k) => k.startsWith(KEY_PREFIX)).forEach((k) => sessionStorage.removeItem(k));
    } catch (e) { /* abaikan */ }
  }
  function clearKeys() {
    vault.clear();
    clearStoredKeys();
    emit();
  }
  function storedKeyCount() {
    let n = vault.size;
    try { n += Object.keys(sessionStorage).filter((k) => k.startsWith(KEY_PREFIX) && !vault.has(k.slice(KEY_PREFIX.length))).length; } catch (e) {}
    return n;
  }
  function redact(message) {
    let out = String(message == null ? "" : message);
    vault.forEach((v) => { if (v && v.length > 3) out = out.split(v).join("••••"); });
    return out.replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1••••");
  }

  /* ---------- Global guards ---------- */
  const realFetch = window.fetch ? window.fetch.bind(window) : null;
  if (realFetch) {
    window.fetch = function (input, init) {
      const url = typeof input === "string" ? input : (input && input.url) || String(input);
      const verdict = check(url, "fetch");
      record("fetch", url, verdict.ok ? "allowed" : "blocked", verdict.reason);
      if (!verdict.ok) return Promise.reject(BlockedError("Akses diblokir: " + verdict.reason));
      return realFetch(input, init).catch((err) => {
        if (err && err.message) err.message = redact(err.message);
        throw err;
      });
    };
  }

  if (window.XMLHttpRequest) {
    const realOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
      const verdict = check(url, "xhr");
      record("xhr", url, verdict.ok ? "allowed" : "blocked", verdict.reason);
      if (!verdict.ok) throw BlockedError("Akses diblokir: " + verdict.reason);
      return realOpen.apply(this, arguments);
    };
  }

  if (navigator.sendBeacon) {
    const realBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url) {
      const verdict = check(url, "beacon");
      record("beacon", url, verdict.ok ? "allowed" : "blocked", verdict.reason);
      if (!verdict.ok) return false;
      return realBeacon.apply(navigator, arguments);
    };
  }

  if (window.WebSocket) {
    const RealWS = window.WebSocket;
    function GuardedWS(url, protocols) {
      const verdict = check(url, "websocket");
      record("websocket", url, verdict.ok ? "allowed" : "blocked", verdict.reason);
      if (!verdict.ok) throw BlockedError("Akses diblokir: " + verdict.reason);
      return new RealWS(url, protocols);
    }
    GuardedWS.prototype = RealWS.prototype;
    Object.keys(RealWS).forEach((k) => { try { GuardedWS[k] = RealWS[k]; } catch (e) {} });
    window.WebSocket = GuardedWS;
  }

  /* Script/iframe yang disuntikkan dari luar daftar izin langsung dibongkar. */
  if (window.MutationObserver) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        Array.from(m.addedNodes || []).forEach((node) => {
          if (!node || node.nodeType !== 1 || !node.matches) return;
          const candidates = [];
          if (node.matches("script[src],iframe[src],link[href]")) candidates.push(node);
          if (node.querySelectorAll) Array.from(node.querySelectorAll("script[src],iframe[src],link[href]")).forEach((el) => candidates.push(el));
          candidates.forEach((el) => {
            const attr = el.tagName === "LINK" ? el.getAttribute("href") : el.getAttribute("src");
            if (!attr) return;
            const u = parse(attr);
            if (!u || u.protocol === "data:" || u.protocol === "blob:") return;
            const kind = el.tagName === "IFRAME" ? "frame" : el.tagName.toLowerCase();
            const verdict = check(attr, kind);
            record(kind, attr, verdict.ok ? "allowed" : "blocked", verdict.reason);
            if (!verdict.ok && el.parentNode) el.parentNode.removeChild(el);
          });
        });
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function loadScript(src, cb) {
    const verdict = check(src, "script");
    record("script", src, verdict.ok ? "allowed" : "blocked", verdict.reason);
    if (!verdict.ok) { if (cb) cb(null); return false; }
    const sc = document.createElement("script");
    sc.src = src;
    sc.async = true;
    if (cb) {
      sc.onload = () => cb(true);
      sc.onerror = () => cb(null);
    }
    document.head.appendChild(sc);
    return true;
  }

  /* ---------- Custom AI endpoint (hanya untuk sesi ini) ---------- */
  function registerCustomEndpoint(raw, label) {
    const u = parse(raw);
    if (!u) return { ok: false, reason: "URL tidak valid." };
    if (u.protocol !== "https:" && !/^(localhost|127\.0\.0\.1)$/.test(u.hostname)) {
      return { ok: false, reason: "Endpoint kustom harus HTTPS (atau localhost)." };
    }
    if (u.username || u.password) return { ok: false, reason: "URL tidak boleh mengandung username/password." };
    customOrigins.set(u.hostname, { paths: [], label: String(label || "AI endpoint kustom").slice(0, 60), custom: true });
    record("allow", u.origin, "allowed", "Endpoint kustom didaftarkan: " + u.hostname);
    emit();
    return { ok: true, origin: u.origin };
  }
  function unregisterCustomEndpoint(raw) {
    try {
      const host = new URL(String(raw)).hostname;
      customOrigins.delete(host);
      emit();
      return true;
    } catch (e) { return false; }
  }
  function origins() {
    return Array.from(new Set(Object.keys(ALLOW).concat(Array.from(customOrigins.keys()))));
  }

  /* ---------- Self-check ---------- */
  function selfCheck() {
    const checks = [];
    const add = (name, ok, detail, info) => checks.push({ name, ok: !!ok, detail: String(detail || ""), info: !!info });
    const metaCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    add("Content-Security-Policy", !!metaCSP && /default-src/.test(metaCSP.content), metaCSP ? "Header kebijakan aktif" : "Meta CSP tidak ditemukan");
    add("Referrer-Policy", !!document.querySelector('meta[name="referrer"]'), "Referrer tidak membocorkan URL penuh");
    add("Protokol aman", location.protocol === "https:" || location.protocol === "file:" || /^(localhost|127\.0\.0\.1)$/.test(location.hostname), location.protocol + "//" + location.host);
    add("Web Crypto API", !!(window.crypto && window.crypto.subtle), "Dipakai untuk AES-GCM / PBKDF2");
    add("Network guard", typeof window.fetch === "function" && /Guarded|fetch/.test(window.fetch.name || "fetch"), "fetch, XHR, WebSocket, beacon & script dipantau");
    add("Allowlist ketat", origins().length >= 5, origins().join(", "), true);
    add("Key vault", typeof vault.clear === "function", storedKeyCount() + " API key disimpan sementara");
    const modules = ["security", "core", "registry", "codeTools", "protection", "utilities", "qr", "games", "music", "photolive", "icons", "ai"];
    const missing = modules.filter((k) => !N[k]);
    add("Modul aplikasi", missing.length === 0, missing.length ? "Tidak ter-load: " + missing.join(", ") : "Semua modul ter-load");
    const badScripts = Array.from(document.scripts).filter((s) => {
      if (!s.src) return false;
      const v = check(s.src, "script");
      return !v.ok;
    });
    add("Script eksternal", badScripts.length === 0, badScripts.length ? badScripts.map((s) => s.src).join(", ") : "Tidak ada script mencurigakan");
    add("Mode jaringan", true, currentMode() === "local" ? "Lokal — tidak ada request keluar" : "Eksternal — hanya origin terizinkan", true);
    return checks;
  }

  function status() {
    return {
      mode: currentMode(),
      rememberKeys: rememberKeys(),
      storedKeys: storedKeyCount(),
      blocked: audit.filter((a) => a.decision === "blocked").length,
      allowed: audit.filter((a) => a.decision === "allowed").length,
      allowlist: origins(),
      audit: audit.slice()
    };
  }

  window.addEventListener("pagehide", () => { vault.clear(); clearStoredKeys(); });

  N.security = {
    ALLOW,
    on, off, status,
    check, setMode, get mode() { return currentMode(); },
    rememberKeys, setRememberKeys,
    setKey, getKey, clearKeys, storedKeyCount, redact,
    registerCustomEndpoint, unregisterCustomEndpoint, origins,
    fetch: window.fetch,
    loadScript,
    selfCheck,
    audit: () => audit.slice(),
    clearAudit: () => { audit.length = 0; emit(); }
  };
})(window.Nexus = window.Nexus || {});
