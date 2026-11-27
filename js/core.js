/* NEXUS TOOLBOX — core: state, storage, UI primitives, events */
(function (N) {
  "use strict";

  const KEY = "nexus-toolbox:v1";
  const prefersReducedMotion = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const DEFAULTS = {
    favorites: [],
    recent: [],
    history: [],
    usage: {},
    scores: {},
    settings: {
      accent: "violet",
      reduceMotion: !!prefersReducedMotion,
      toasts: true,
      difficulty: "normal",
      autoPreview: true
    },
    notes: "",
    clipboard: [],
    daily: { date: "", correct: 0, total: 0, streak: 0 },
    pomodoro: { cycles: 0 }
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function deepMerge(base, extra) {
    const out = clone(base);
    Object.keys(extra || {}).forEach((k) => {
      if (extra[k] && typeof extra[k] === "object" && !Array.isArray(extra[k]) && out[k] && typeof out[k] === "object" && !Array.isArray(out[k])) {
        out[k] = deepMerge(out[k], extra[k]);
      } else if (extra[k] !== undefined) {
        out[k] = clone(extra[k]);
      }
    });
    return out;
  }

  function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function sanitizeState(raw) {
    const s = deepMerge(DEFAULTS, isPlainObject(raw) ? raw : {});
    const idList = (v) => Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === "string"))] : [];
    s.favorites = idList(s.favorites);
    s.recent = idList(s.recent).slice(0, 8);
    s.history = Array.isArray(s.history) ? s.history.filter((h) => h && typeof h.id === "string").slice(0, 60).map((h) => ({
      id: h.id,
      kind: typeof h.kind === "string" ? h.kind : "tool",
      at: Number.isFinite(Number(h.at)) ? Number(h.at) : Date.now()
    })) : [];
    s.usage = isPlainObject(s.usage) ? Object.fromEntries(Object.entries(s.usage).filter(([k, v]) => typeof k === "string" && Number.isFinite(Number(v)) && Number(v) >= 0).map(([k, v]) => [k, Math.floor(Number(v))])) : {};
    s.scores = isPlainObject(s.scores) ? Object.fromEntries(Object.entries(s.scores).filter(([k, v]) => typeof k === "string" && (typeof v === "string" || typeof v === "number" || isPlainObject(v)))) : {};
    s.settings = isPlainObject(s.settings) ? s.settings : clone(DEFAULTS.settings);
    if (!["violet", "cyan", "blue"].includes(s.settings.accent)) s.settings.accent = DEFAULTS.settings.accent;
    if (!["easy", "normal", "hard"].includes(s.settings.difficulty)) s.settings.difficulty = DEFAULTS.settings.difficulty;
    ["reduceMotion", "toasts", "autoPreview"].forEach((k) => { s.settings[k] = !!s.settings[k]; });
    s.notes = typeof s.notes === "string" ? s.notes : "";
    s.clipboard = Array.isArray(s.clipboard) ? s.clipboard.filter((x) => x && typeof x.text === "string").slice(0, 30) : [];
    s.daily = isPlainObject(s.daily) ? {
      date: typeof s.daily.date === "string" ? s.daily.date : "",
      correct: Number.isFinite(Number(s.daily.correct)) ? Math.max(0, Math.floor(Number(s.daily.correct))) : 0,
      total: Number.isFinite(Number(s.daily.total)) ? Math.max(0, Math.floor(Number(s.daily.total))) : 0,
      streak: Number.isFinite(Number(s.daily.streak)) ? Math.max(0, Math.floor(Number(s.daily.streak))) : 0
    } : clone(DEFAULTS.daily);
    s.pomodoro = isPlainObject(s.pomodoro) && Number.isFinite(Number(s.pomodoro.cycles)) ? { cycles: Math.max(0, Math.floor(Number(s.pomodoro.cycles))) } : clone(DEFAULTS.pomodoro);
    return s;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return clone(DEFAULTS);
      return sanitizeState(JSON.parse(raw));
    } catch (err) {
      console.warn("[Nexus] localStorage tidak dapat dibaca:", err);
      return clone(DEFAULTS);
    }
  }

  const state = loadState();
  let saveTimer = null;

  function save() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
      } catch (err) {
        console.warn("[Nexus] gagal menyimpan data lokal:", err);
      }
      saveTimer = null;
    }, 120);
  }
  function saveNow() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (err) { console.warn(err); }
  }
  function flushSave() { if (saveTimer) saveNow(); }
  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("pagehide", flushSave);
  }
  if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
    document.addEventListener("visibilitychange", () => { if (document.hidden) flushSave(); });
  }

  /* ---------- tiny event bus ---------- */
  const listeners = {};
  function on(name, fn) {
    (listeners[name] || (listeners[name] = [])).push(fn);
    return () => off(name, fn);
  }
  function off(name, fn) {
    if (!listeners[name]) return;
    listeners[name] = listeners[name].filter((f) => f !== fn);
  }
  function emit(name, payload) {
    (listeners[name] || []).slice().forEach((fn) => {
      try { fn(payload); } catch (err) { console.error("[Nexus] listener error", name, err); }
    });
  }

  /* ---------- DOM helpers ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
  }

  function node(html) {
    const tpl = document.createElement("template");
    tpl.innerHTML = String(html).trim();
    return tpl.content.firstElementChild;
  }

  function uid(prefix) {
    return (prefix || "id") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function formatBytes(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / 1048576).toFixed(2) + " MB";
  }

  function formatDuration(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (x) => String(x).padStart(2, "0");
    return h ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }

  function formatTime(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  }
  function formatDate(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  }
  function relativeTime(ts) {
    const diff = Date.now() - Number(ts || 0);
    if (!Number.isFinite(diff) || diff < 0) return "baru saja";
    if (diff < 60000) return "baru saja";
    if (diff < 3600000) return Math.floor(diff / 60000) + " mnt lalu";
    if (diff < 86400000) return Math.floor(diff / 3600000) + " jam lalu";
    if (diff < 604800000) return Math.floor(diff / 86400000) + " hari lalu";
    return formatDate(ts);
  }

  function download(filename, content, mime) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "download.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function copy(text) {
    const value = String(text == null ? "" : text);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        return true;
      }
      throw new Error("Clipboard API tidak tersedia");
    } catch (err) {
      try {
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.setAttribute("readonly", "");
        ta.style.cssText = "position:fixed;top:-9999px;opacity:0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        if (!ok) throw new Error("execCommand gagal");
        return true;
      } catch (e2) {
        toast("Gagal menyalin. Pilih teks dan salin manual.", "err");
        return false;
      }
    }
  }

  /* ---------- toast ---------- */
  function toast(message, type, ms) {
    if (!state.settings.toasts) return;
    const stack = $("#toastStack");
    if (!stack) return;
    const icons = { ok: "✓", err: "!", info: "◈" };
    const t = node(`<div class="toast ${type || "info"}"><span class="ti">${icons[type] || "◈"}</span><span>${escapeHtml(message)}</span></div>`);
    stack.appendChild(t);
    const life = ms || 3200;
    const timer = setTimeout(() => {
      t.classList.add("out");
      setTimeout(() => t.remove(), 240);
    }, life);
    t.addEventListener("click", () => { clearTimeout(timer); t.classList.add("out"); setTimeout(() => t.remove(), 240); });
    while (stack.children.length > 4) stack.firstElementChild.remove();
  }

  /* ---------- modal ---------- */
  let modalCleanup = null;
  let modalBackdropCleanup = null;
  function closeModal() {
    const root = $("#modalRoot");
    if (!root) return;
    if (modalCleanup) { try { modalCleanup(); } catch (e) {} modalCleanup = null; }
    if (modalBackdropCleanup) { modalBackdropCleanup(); modalBackdropCleanup = null; }
    root.hidden = true;
    root.innerHTML = "";
    document.removeEventListener("keydown", onModalKey);
  }
  function onModalKey(e) {
    if (e.key === "Escape") closeModal();
  }
  function modal(options) {
    closeModal();
    const root = $("#modalRoot");
    const wrap = node(`<div class="modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(options.title || "Dialog")}">
      <div class="modal-head"><h3>${escapeHtml(options.title || "Dialog")}</h3><button class="icon-btn" data-close type="button" aria-label="Tutup">✕</button></div>
      <div class="modal-body"></div>
      <div class="modal-foot"></div>
    </div>`);
    const body = $(".modal-body", wrap);
    if (typeof options.body === "string") body.innerHTML = options.body;
    else if (options.body instanceof HTMLElement) body.appendChild(options.body);

    const foot = $(".modal-foot", wrap);
    (options.actions || [{ label: "Tutup", type: "ghost", value: false }]).forEach((a) => {
      const b = node(`<button class="btn ${a.type ? "btn-" + a.type : ""}" type="button">${escapeHtml(a.label)}</button>`);
      b.addEventListener("click", () => {
        const result = a.onClick ? a.onClick(wrap) : a.value;
        if (result !== "keep") closeModal();
      });
      foot.appendChild(b);
    });
    root.innerHTML = "";
    root.appendChild(wrap);
    root.hidden = false;
    $("[data-close]", wrap).addEventListener("click", closeModal);
    function backdrop(e) {
      if (e.target === root) closeModal();
    }
    root.addEventListener("mousedown", backdrop);
    modalBackdropCleanup = () => root.removeEventListener("mousedown", backdrop);
    document.addEventListener("keydown", onModalKey);
    if (options.onOpen) modalCleanup = options.onOpen(wrap) || null;
    const focusable = $("input, textarea, button:not([data-close])", body);
    if (focusable) setTimeout(() => focusable.focus(), 40);
    return wrap;
  }
  function confirm(title, message, onYes, labelYes) {
    return modal({
      title,
      body: `<p class="sub">${escapeHtml(message)}</p>`,
      actions: [
        { label: "Batal", type: "ghost", value: false },
        { label: labelYes || "Ya, lanjutkan", type: "danger", onClick: () => { if (onYes) onYes(); return true; } }
      ]
    });
  }

  /* ---------- usage tracking ---------- */
  function trackTool(toolId, kind) {
    if (!toolId) return;
    state.usage[toolId] = (state.usage[toolId] || 0) + 1;
    state.recent = [toolId, ...state.recent.filter((x) => x !== toolId)].slice(0, 8);
    state.history.unshift({ id: toolId, kind: kind || "tool", at: Date.now() });
    state.history = state.history.slice(0, 60);
    save();
    emit("data-changed");
  }

  function toggleFavorite(toolId) {
    const i = state.favorites.indexOf(toolId);
    if (i >= 0) state.favorites.splice(i, 1);
    else state.favorites.unshift(toolId);
    save();
    emit("data-changed");
    return i < 0;
  }
  function isFavorite(toolId) { return state.favorites.includes(toolId); }

  function setScore(gameId, value, higherIsBetter) {
    const prev = state.scores[gameId];
    if (prev == null || (higherIsBetter === false ? value < prev : value > prev)) {
      state.scores[gameId] = value;
      save();
      emit("data-changed");
      toast("Rekor baru tersimpan!", "ok");
    }
  }

  /* ---------- lifecycle cleanups for views ---------- */
  let cleanups = [];
  function addCleanup(fn) { if (typeof fn === "function") cleanups.push(fn); }
  function runCleanups() {
    cleanups.slice().reverse().forEach((fn) => { try { fn(); } catch (e) { console.warn(e); } });
    cleanups = [];
  }

  function applySettings() {
    const root = document.documentElement;
    root.dataset.accent = state.settings.accent || "violet";
    root.dataset.reduceMotion = state.settings.reduceMotion ? "true" : "false";
  }

  function resetAll() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    try { localStorage.removeItem(KEY); } catch (err) { console.warn("[Nexus] gagal menghapus data lokal:", err); }
    Object.keys(state).forEach((k) => delete state[k]);
    Object.assign(state, clone(DEFAULTS));
    applySettings();
    emit("data-changed");
  }

  N.core = {
    KEY, state, save, saveNow, flushSave, on, off, emit, $, $$, escapeHtml, node, uid,
    formatBytes, formatDuration, formatTime, formatDate, relativeTime,
    download, copy, toast, modal, confirm, closeModal,
    trackTool, toggleFavorite, isFavorite, setScore,
    addCleanup, runCleanups, applySettings, resetAll, clone
  };
})(window.Nexus = window.Nexus || {});
