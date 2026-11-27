/* NEXUS TOOLBOX — AI Studio: BYOK multi-provider coding chat, attachments & streaming */
(function (N) {
  "use strict";
  const C = N.core;
  const esc = C.escapeHtml;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const ico = (name, cls) => (N.icons ? N.icons.svg(name, cls || "ai-ico") : "");

  const PROVIDERS = [
    { id: "openai", name: "OpenAI", base: "https://api.openai.com/v1", key: true,
      models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "o3-mini"] },
    { id: "anthropic", name: "Anthropic Claude", base: "https://api.anthropic.com/v1", key: true,
      models: ["claude-sonnet-4-20250514", "claude-3-7-sonnet-latest", "claude-3-5-haiku-latest"] },
    { id: "google", name: "Google Gemini", base: "https://generativelanguage.googleapis.com/v1beta", key: true,
      models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"] },
    { id: "groq", name: "Groq", base: "https://api.groq.com/openai/v1", key: true,
      models: ["llama-3.3-70b-versatile", "qwen-qwq-32b", "mixtral-8x7b-32768"] },
    { id: "openrouter", name: "OpenRouter", base: "https://openrouter.ai/api/v1", key: true,
      models: ["openai/gpt-4o", "anthropic/claude-3.7-sonnet", "google/gemini-2.5-pro", "meta-llama/llama-3.3-70b-instruct", "deepseek/deepseek-r1"] },
    { id: "mistral", name: "Mistral", base: "https://api.mistral.ai/v1", key: true,
      models: ["mistral-large-latest", "codestral-latest", "mistral-small-latest"] },
    { id: "deepseek", name: "DeepSeek", base: "https://api.deepseek.com/v1", key: true,
      models: ["deepseek-chat", "deepseek-reasoner"] },
    { id: "xai", name: "xAI Grok", base: "https://api.x.ai/v1", key: true,
      models: ["grok-3", "grok-3-mini"] },
    { id: "ollama", name: "Ollama (lokal)", base: "http://localhost:11434/v1", key: false,
      models: ["llama3.2", "codellama", "qwen2.5-coder", "deepseek-coder-v2"] },
    { id: "custom", name: "Custom OpenAI-compatible", base: "", key: true, models: [] }
  ];

  const PRESETS = {
    coding: {
      label: "Coding Partner",
      text: "Kamu adalah senior software engineer yang bekerja berdampingan dengan user. Jawab dalam Bahasa Indonesia, langsung, padat, dan praktis. Utamakan kode yang bisa langsung dipakai beserta penjelasan singkat. Untuk permintaan coding yang sah, jangan menolak atau memberi kuliah moral berlebihan — berikan solusinya. Bila ada risiko nyata, sebutkan satu kalimat singkat SETELAH solusi. Bila informasi kurang, pilih asumsi masuk akal, sebutkan asumsinya, dan tetap berikan implementasi lengkap."
    },
    creative: {
      label: "Creative Builder",
      text: "Kamu adalah arsitek produk dan prototyping yang sangat kreatif. Eksplorasi ide berani, UI/UX segar, dan arsitektur modern. Berikan variasi pendekatan, lalu rekomendasikan satu. Tetap fokus pada kode yang bisa dijalankan dan hindari basa-basi."
    },
    debug: {
      label: "Debugger",
      text: "Kamu adalah debugger ahli. Minta atau asumsikan konteks minimal, lalu telemukan akar masalah, tunjukkan baris yang bermasalah, berikan patch minimal, dan cara memverifikasinya. Jangan minta user mengulang informasi yang sudah ada di percakapan."
    },
    architect: {
      label: "System Architect",
      text: "Kamu adalah system architect. Rancang sistem dengan diagram teks (mermaid bila cocok), kontrak API, skema data, dan trade-off. Berikan keputusan konkret, bukan daftar pertanyaan. Sertakan contoh implementasi kunci."
    },
    reviewer: {
      label: "Code Reviewer",
      text: "Kamu melakukan code review ketat: bug, keamanan, performa, dan maintainability. Berikan temuan Prioritas 1/2/3 disertai diff perbaikan. Jangan hanya mengkritik — selalu sertakan kode perbaikan."
    }
  };

  const SET_KEY = "nexus.ai.settings.v1";
  const CHAT_KEY = "nexus.ai.chats.v1";

  function defaults() {
    return {
      provider: "openai", model: "gpt-4o-mini", preset: "coding", temperature: 0.35,
      maxTokens: 2048, stream: true, saveChats: false, customBase: "", customModel: "", customSystem: ""
    };
  }
  function loadSettings() {
    const d = defaults();
    try {
      const raw = JSON.parse(sessionStorage.getItem(SET_KEY) || "null");
      if (!raw || typeof raw !== "object") return d;
      const out = Object.assign(d, raw);
      if (!PROVIDERS.some((p) => p.id === out.provider)) out.provider = d.provider;
      if (!["easy", "coding", "creative", "debug", "architect", "reviewer"].includes(out.preset)) out.preset = "coding";
      out.temperature = Math.min(1, Math.max(0, Number(out.temperature) || 0));
      out.maxTokens = Math.min(16384, Math.max(256, Number(out.maxTokens) || 2048));
      out.stream = !!out.stream; out.saveChats = !!out.saveChats;
      return out;
    } catch (e) { return d; }
  }
  const settings = loadSettings();
  function saveSettings() { try { sessionStorage.setItem(SET_KEY, JSON.stringify(settings)); } catch (e) {} }

  /* API key dibaca dari js/ai-key.local.js (file lokal, bukan dari UI/zip publik). */
  function applyLocalConfig() {
    const keys = window.NEXUS_AI_KEYS;
    if (keys && typeof keys === "object") {
      Object.keys(keys).forEach((id) => {
        const value = String(keys[id] == null ? "" : keys[id]).trim();
        if (value && N.security && N.security.setKey) N.security.setKey("ai:" + id, value);
      });
    }
    const wantedProvider = String(window.NEXUS_AI_PROVIDER || "");
    if (wantedProvider && PROVIDERS.some((p) => p.id === wantedProvider)) settings.provider = wantedProvider;
    const wantedModel = String(window.NEXUS_AI_MODEL || "");
    if (wantedModel) {
      if (settings.provider === "custom") settings.customModel = wantedModel;
      else settings.model = wantedModel;
    }
  }
  applyLocalConfig();

  function loadChats() {
    if (!settings.saveChats) return [];
    try {
      const v = JSON.parse(sessionStorage.getItem(CHAT_KEY) || "[]");
      return Array.isArray(v) ? v.filter((c) => c && typeof c.id === "string" && Array.isArray(c.messages)).slice(0, 30) : [];
    } catch (e) { return []; }
  }
  let chats = loadChats();
  let activeId = chats.length ? chats[0].id : null;
  function saveChats() {
    if (!settings.saveChats) return;
    try { sessionStorage.setItem(CHAT_KEY, JSON.stringify(chats.slice(0, 30))); } catch (e) {}
  }
  function current() {
    let c = chats.find((x) => x.id === activeId);
    if (!c) {
      c = { id: "ai-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7), title: "Chat baru", messages: [], at: Date.now() };
      chats.unshift(c); activeId = c.id; saveChats();
    }
    return c;
  }
  function provider(id) { return PROVIDERS.find((p) => p.id === (id || settings.provider)) || PROVIDERS[0]; }
  function modelId() { return settings.provider === "custom" ? (settings.customModel || "gpt-4o-mini") : settings.model; }
  function baseUrl() { return settings.provider === "custom" ? settings.customBase.replace(/\/$/, "") : provider().base.replace(/\/$/, ""); }
  function systemPrompt() { return settings.preset === "easy" ? (settings.customSystem || PRESETS.coding.text) : (PRESETS[settings.preset] || PRESETS.coding).text; }

  /* --------------------------- Markdown aman --------------------------- */
  function markdown(src, blocks) {
    const parts = [];
    let out = String(src == null ? "" : src).replace(/```([\w+#-]*)\n?([\s\S]*?)```/g, (m, lang, code) => {
      const i = parts.push({ lang: lang || "text", code: String(code).replace(/\n$/, "") }) - 1;
      return "\u0000AICODE" + i + "\u0000";
    });
    out = esc(out);
    out = out.replace(/`([^`\n]+)`/g, (m, c) => `<code class="ai-inline">${c}</code>`);
    out = out.replace(/^####?\s+(.*)$/gm, "<h4>$1</h4>")
      .replace(/^###\s+(.*)$/gm, "<h4>$1</h4>")
      .replace(/^##\s+(.*)$/gm, "<h3>$1</h3>")
      .replace(/^#\s+(.*)$/gm, "<h2>$1</h2>");
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, label, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`);
    out = out.replace(/^\s*[-*]\s+(.*)$/gm, "<div class=\"ai-li\">• $1</div>");
    out = out.split(/\n{2,}/).map((chunk) => /^<(h[234]|div|ul|ol|pre)/.test(chunk) ? chunk : `<p>${chunk.replace(/\n/g, "<br>")}</p>`).join("");
    out = out.replace(/\u0000AICODE(\d+)\u0000/g, (m, i) => {
      const b = parts[Number(i)];
      return `<div class="ai-code"><div class="ai-code-head"><span class="ai-code-lang">${esc(b.lang)}</span>` +
        `<span class="ai-code-actions"><button type="button" data-ai-copy="${i}">Salin</button>` +
        `<button type="button" data-ai-download="${i}">${ico("download")}</button></span></div><pre><code>${esc(b.code)}</code></pre></div>`;
    });
    blocks.length = 0; parts.forEach((p) => blocks.push(p));
    return out;
  }

  /* --------------------------- Request builders --------------------------- */
  function normalize(chat, skip) {
    return chat.messages.filter((m) => m !== skip).map((m) => {
      const text = String(m.content || "") + ((m.files && m.files.length)
        ? "\n\n" + m.files.map((f) => `[File: ${f.name}]\n${f.text || "(file biner, tidak dibaca sebagai teks)"}`).join("\n\n") : "");
      return { role: m.role === "assistant" ? "assistant" : "user", text, images: m.images || [] };
    });
  }
  function openAIContent(item) {
    if (!item.images.length) return item.text;
    return [{ type: "text", text: item.text }].concat(item.images.map((img) => ({
      type: "image_url", image_url: { url: "data:" + img.mime + ";base64," + img.data }
    })));
  }
  async function parseSSE(res, onDelta) {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const raw = t.slice(5).trim();
        if (raw === "[DONE]") return;
        try {
          const j = JSON.parse(raw);
          const d = (j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content) || "";
          if (d) onDelta(d);
        } catch (e) { /* chunk meridah */ }
      }
    }
  }
  async function readError(res) {
    let t = "";
    try { t = (await res.text()).slice(0, 400); } catch (e) {}
    return N.security.redact("HTTP " + res.status + (t ? " — " + t : ""));
  }

  async function callAI(chat, assistant, signal, onDelta) {
    const p = provider();
    const sys = systemPrompt();
    const history = normalize(chat, assistant);
    const key = N.security.getKey("ai:" + p.id);
    const base = baseUrl();
    const model = modelId();

    if (p.id === "custom") {
      const reg = N.security.registerCustomEndpoint(base, "AI kustom");
      if (!reg.ok) throw new Error(reg.reason + " Gunakan HTTPS atau jalankan Ollama di localhost.");
    }
    if (p.key && !key) throw new Error("API key untuk " + p.name + " belum diisi. Isi js/ai-key.local.js pada salinan lokal Anda.");

    if (p.id === "google") {
      const url = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(key);
      const contents = history.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.text }].concat(m.images.map((img) => ({ inline_data: { mime_type: img.mime, data: img.data } })))
      }));
      const res = await N.security.fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal,
        body: JSON.stringify({ contents, systemInstruction: { parts: [{ text: sys }] }, generationConfig: { temperature: Number(settings.temperature), maxOutputTokens: Number(settings.maxTokens) } })
      });
      if (!res.ok) throw new Error(await readError(res));
      const j = await res.json();
      const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
      return parts.map((x) => x.text || "").join("");
    }

    if (p.id === "anthropic") {
      const messages = history.map((m) => {
        const content = [{ type: "text", text: m.text }].concat(m.images.map((img) => ({
          type: "image", source: { type: "base64", media_type: img.mime, data: img.data }
        })));
        return { role: m.role, content };
      });
      const res = await N.security.fetch(base + "/messages", {
        method: "POST", signal,
        headers: {
          "Content-Type": "application/json", "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({ model, max_tokens: Number(settings.maxTokens), system: sys, messages })
      });
      if (!res.ok) throw new Error(await readError(res));
      const j = await res.json();
      return (j.content || []).map((b) => b.type === "text" ? b.text : "").join("");
    }

    // OpenAI-compatible: OpenAI, Groq, OpenRouter, Mistral, DeepSeek, xAI, Ollama, custom.
    const headers = { "Content-Type": "application/json" };
    if (p.key && key) headers.Authorization = "Bearer " + key;
    if (p.id === "openrouter") { headers["HTTP-Referer"] = location.origin; headers["X-Title"] = "NEXUS TOOLBOX"; }
    const body = {
      model, temperature: Number(settings.temperature), max_tokens: Number(settings.maxTokens),
      messages: [{ role: "system", content: sys }].concat(history.map((m) => ({ role: m.role, content: openAIContent(m) }))),
      stream: !!settings.stream
    };
    const res = await N.security.fetch(base + "/chat/completions", { method: "POST", headers, body: JSON.stringify(body), signal });
    if (!res.ok) throw new Error(await readError(res));
    if (settings.stream && res.body) {
      let full = "";
      await parseSSE(res, (d) => { full += d; onDelta(full); });
      return full;
    }
    const j = await res.json();
    return (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "";
  }

  /* --------------------------- UI --------------------------- */
  function render(host) {
    let attachments = [];
    let busy = false;
    let controller = null;
    let rafPending = false;
    const unsubs = [];
    C.addCleanup(() => {
      unsubs.forEach((f) => f());
      if (controller) controller.abort();
      saveChats();
    });

    host.innerHTML = `
      <div class="workspace-head">
        <div><span class="eyebrow">AI Studio</span><h1 class="page-title">AI <span class="gradient-text">Coding Partner</span></h1>
        <p class="sub">Chat dengan 10 provider & banyak model. Kunci API Anda (BYOK) hanya tersimpan di sesi ini, tidak pernah di server kami.</p></div>
        <button class="btn btn-sm btn-ghost" data-act="fav" type="button">${ico(C.isFavorite("ai-studio") ? "star" : "starOff")}<span>${C.isFavorite("ai-studio") ? "Tersimpan" : "Simpan tool"}</span></button>
      </div>

      <div class="notice info">${ico("sparkle")}<span><strong>Fokus coding.</strong> Default persona memberi solusi langsung tanpa penolakan berlebihan untuk tugas coding yang sah. Aktifkan <strong>Mode Eksternal</strong> di Security Center, pilih model, isi API key di <code>js/ai-key.local.js</code>, lalu kirim teks/gambar/file. Semua request melewati network guard.</span></div>

      <div class="ai-layout" id="aiLayout">
        <aside class="ai-threads" id="aiThreads">
          <div class="ai-threads-head">
            <div class="row"><button class="ai-new" data-act="new" type="button">${ico("plus")}<span>Chat baru</span></button></div>
            <input class="ai-search" id="aiThreadSearch" type="search" placeholder="Cari percakapan..." autocomplete="off">
          </div>
          <div class="ai-thread-list" id="aiThreadList"></div>
        </aside>
        <section class="ai-main">
          <header class="ai-head">
            <button class="ai-icon-btn" data-act="threads" type="button" aria-label="Daftar chat" data-tip="Daftar chat">${ico("menu")}</button>
            <div class="ai-brand"><span class="ai-orb">${ico("sparkle")}</span><span>NEXUS AI</span></div>
            <select id="aiProvider" aria-label="Provider AI"></select>
            <select id="aiModel" aria-label="Model AI"></select>
            <button class="ai-icon-btn" data-act="settings" type="button" aria-label="Pengaturan AI" data-tip="Pengaturan AI">${ico("settings")}</button>
            <button class="ai-icon-btn" data-act="export" type="button" aria-label="Ekspor chat" data-tip="Ekspor chat">${ico("download")}</button>
          </header>
          <div class="ai-messages" id="aiMessages"></div>
          <div class="ai-composer">
            <div class="ai-compose-box" id="aiComposeBox">
              <textarea id="aiInput" rows="1" placeholder="Tanya apa saja tentang kode... (Enter kirim, Shift+Enter baris baru)" spellcheck="false"></textarea>
              <div class="ai-attachments" id="aiAttachments"></div>
              <div class="ai-compose-bar">
                <button type="button" data-act="attach-image" aria-label="Lampirkan gambar" data-tip="Gambar">${ico("image")}</button>
                <button type="button" data-act="attach-file" aria-label="Lampirkan file" data-tip="File">${ico("paperclip")}</button>
                <span class="ai-spacer"></span>
                <button class="ai-send" data-act="send" id="aiSend" type="button">${ico("send")}<span>Kirim</span></button>
                <button data-act="stop" id="aiStop" type="button" title="Hentikan" hidden>${ico("stop")}</button>
              </div>
            </div>
            <div class="ai-hint">Model bisa salah. Periksa kembali kode sebelum dipakai di produksi.</div>
          </div>
        </section>
      </div>
      <input type="file" id="aiImageInput" accept="image/*" multiple hidden>
      <input type="file" id="aiFileInput" accept=".js,.ts,.tsx,.jsx,.json,.css,.html,.md,.txt,.py,.go,.rs,.java,.c,.cpp,.sql,.yml,.yaml,.xml,.sh" multiple hidden>`;

    const $h = (s) => $(s, host);
    const providerSel = $h("#aiProvider");
    const modelSel = $h("#aiModel");
    const input = $h("#aiInput");
    const messagesBox = $h("#aiMessages");
    const attachBox = $h("#aiAttachments");

    function fillProviders() {
      providerSel.innerHTML = PROVIDERS.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("");
      providerSel.value = settings.provider;
      fillModels();
    }
    function fillModels() {
      const p = provider();
      const models = p.id === "custom" ? (settings.customModel ? [settings.customModel] : []) : p.models;
      modelSel.innerHTML = models.length
        ? models.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join("")
        : `<option value="">Atur model di pengaturan</option>`;
      const wanted = modelId();
      modelSel.value = models.includes(wanted) ? wanted : models[0] || "";
      modelSel.disabled = !models.length;
    }
    function renderThreads() {
      const q = ($h("#aiThreadSearch").value || "").toLowerCase();
      const list = chats.filter((c) => !q || String(c.title).toLowerCase().includes(q));
      $h("#aiThreadList").innerHTML = list.length ? list.map((c) => `
        <div class="ai-thread ${c.id === activeId ? "active" : ""}" data-thread="${esc(c.id)}" role="button" tabindex="0">
          <span class="ai-thread-copy"><strong>${esc(c.title || "Chat baru")}</strong><small>${esc(C.relativeTime(c.at))} · ${c.messages.length} pesan</small></span>
          <button class="ai-del" data-del="${esc(c.id)}" type="button" aria-label="Hapus chat">${ico("close")}</button>
        </div>`).join("") : `<div class="ai-thread-empty">Tidak ada chat cocok.</div>`;
    }
    function messageHtml(m) {
      const blocks = [];
      const md = markdown(m.content || "", blocks);
      m._blocks = blocks;
      const imgs = (m.images || []).map((src) => `<img src="${esc("data:" + src.mime + ";base64," + src.data)}" alt="Lampiran gambar" data-zoom="${esc(src.mime)}">`).join("");
      const files = (m.files || []).map((f) => `<span class="ai-att">${ico("paperclip")}<span>${esc(f.name)}</span></span>`).join("");
      return `<div class="ai-msg ${esc(m.role)}" data-msg="${esc(m.id)}">
        <span class="ai-avatar">${m.role === "assistant" ? ico("sparkle") : "A"}</span>
        <div class="ai-bubble">
          ${imgs ? `<div class="ai-msg-images">${imgs}</div>` : ""}
          <div class="ai-md">${md}</div>
          ${files ? `<div class="ai-attachments">${files}</div>` : ""}
          ${m.error ? `<div class="ai-status err">Permintaan gagal.</div>` : ""}
        </div></div>`;
    }
    function renderMessages() {
      const chat = current();
      if (!chat.messages.length) {
        messagesBox.innerHTML = `<div class="ai-empty">
          <div class="ai-empty-orb">${ico("sparkle")}</div>
          <h2>Apa yang ingin kamu bangun hari ini?</h2>
          <p>Minta kode, debug, arsitektur, atau review. Lampirkan file/gambar kalau perlu konteks.</p>
          <div class="ai-suggest">
            <button type="button" data-suggest="Buatkan fungsi debounce di JavaScript beserta testnya">${ico("bolt")}Debounce + test</button>
            <button type="button" data-suggest="Review kode ini dan berikan patch perbaikan">${ico("search")}Review kode</button>
            <button type="button" data-suggest="Rancang REST API untuk sistem kasir lengkap dengan skema database">${ico("layers")}REST API</button>
            <button type="button" data-suggest="Jelaskan perbedaan WebSocket dan SSE dengan contoh kode">${ico("route")}WebSocket vs SSE</button>
          </div></div>`;
        return;
      }
      messagesBox.innerHTML = chat.messages.map(messageHtml).join("");
      messagesBox.scrollTop = messagesBox.scrollHeight;
    }
    function updateMessage(m) {
      const el = messagesBox.querySelector(`[data-msg="${m.id}"] .ai-md`);
      if (!el) return;
      const blocks = [];
      el.innerHTML = markdown(m.content || "", blocks);
      m._blocks = blocks;
      messagesBox.scrollTop = messagesBox.scrollHeight;
    }
    function scheduleUpdate(m) {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => { rafPending = false; updateMessage(m); });
    }
    function renderAttachments() {
      attachBox.innerHTML = attachments.map((a, i) => `<span class="ai-att">
        ${a.kind === "image" ? `<img src="${esc("data:" + a.mime + ";base64," + a.data)}" alt="">` : ico("paperclip")}
        <span>${esc(a.name)} · ${esc(C.formatBytes(a.size))}</span>
        <button type="button" data-rm="${i}" aria-label="Hapus lampiran">${ico("close")}</button></span>`).join("");
    }
    function setBusy(v) {
      busy = v;
      $h("#aiSend").disabled = v || (!input.value.trim() && !attachments.length);
      $h("#aiStop").hidden = !v;
    }
    function autoGrow() { input.style.height = "auto"; input.style.height = Math.min(180, input.scrollHeight) + "px"; }

    async function addFiles(files) {
      for (const f of Array.from(files || [])) {
        if (f.size > 8 * 1024 * 1024) { C.toast(f.name + " terlalu besar (maks 8 MB).", "err"); continue; }
        if (f.type.startsWith("image/")) {
          const data = await new Promise((res, rej) => {
            const fr = new FileReader();
            fr.onload = () => res(String(fr.result).split(",")[1] || "");
            fr.onerror = rej; fr.readAsDataURL(f);
          });
          attachments.push({ kind: "image", name: f.name, size: f.size, mime: f.type || "image/png", data });
        } else {
          let text = "";
          if (f.size <= 256 * 1024) { try { text = (await f.text()).slice(0, 40000); } catch (e) {} }
          attachments.push({ kind: "file", name: f.name, size: f.size, mime: f.type || "text/plain", text });
        }
      }
      renderAttachments(); setBusy(busy);
    }

    async function send(text) {
      if (busy) return;
      const value = String(text == null ? input.value : text).trim();
      if (!value && !attachments.length) return;
      const chat = current();
      if (!chat.messages.length) chat.title = (value || "Chat lampiran").slice(0, 46);
      chat.messages.push({
        id: C.uid("m"), role: "user", content: value,
        images: attachments.filter((a) => a.kind === "image").map((a) => ({ mime: a.mime, data: a.data })),
        files: attachments.filter((a) => a.kind === "file").map((a) => ({ name: a.name, size: a.size, text: a.text })),
        at: Date.now()
      });
      const assistant = { id: C.uid("m"), role: "assistant", content: "", at: Date.now(), error: false };
      chat.messages.push(assistant);
      attachments = []; input.value = ""; autoGrow(); renderAttachments(); renderThreads(); renderMessages(); saveChats();
      setBusy(true);
      controller = new AbortController();
      let full = "";
      try {
        full = await callAI(chat, assistant, controller.signal, (accum) => {
          assistant.content = accum; scheduleUpdate(assistant);
        });
        assistant.content = full || "Model tidak mengembalikan teks.";
        updateMessage(assistant);
        C.trackTool("ai-studio", "ai");
      } catch (err) {
        assistant.error = true;
        assistant.content = "**Gagal memanggil model.**\n\n" + N.security.redact(err && err.message ? err.message : "Error tidak diketahui") +
          "\n\nPeriksa API key, model, dan izin CORS provider. Untuk provider yang memblokir browser, coba OpenRouter/Groq atau endpoint kustom.";
        updateMessage(assistant);
      } finally {
        controller = null; setBusy(false); saveChats(); renderThreads();
      }
    }

    function aiSettings() {
      const p = provider();
      C.modal({
        title: "Pengaturan AI Studio",
        body: `<div class="ai-modal-grid">
          <label class="field"><span>Provider</span><select id="aiSetProvider">${PROVIDERS.map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("")}</select></label>
          <label class="field"><span>Model (bisa diketik manual untuk provider non-custom)</span><input type="text" id="aiSetModel" value="${esc(modelId())}" autocomplete="off" spellcheck="false"></label>
          <div id="aiCustomWrap" class="grid" style="gap:10px;${settings.provider === "custom" ? "" : "display:none"}">
            <label class="field"><span>Base URL OpenAI-compatible</span><input type="url" id="aiSetBase" value="${esc(settings.customBase)}" placeholder="https://api.contoh.com/v1" autocomplete="off"></label>
            <p class="ai-note">Origin akan didaftarkan ke network guard otomatis. Hanya HTTPS/localhost yang diterima.</p>
          </div>
          <div id="aiKeyWrap" class="field" ${p.key ? "" : "style=\"display:none\""}>
            <span>API key ${esc(p.name)}</span>
            <p class="ai-note key-source">${ico(N.security.getKey("ai:" + p.id) ? "check" : "key")}<span>${N.security.getKey("ai:" + p.id) ? "Key terbaca dari <code>js/ai-key.local.js</code> (disimpan di sesi ini)." : "Belum ada key. Isi <code>js/ai-key.local.js</code> pada salinan lokal Anda."}</span></p>
          </div>
          <label class="field"><span>Persona / fokus AI</span><select id="aiSetPreset">${Object.entries(PRESETS).map(([k, v]) => `<option value="${esc(k)}">${esc(v.label)}</option>`).join("")}<option value="easy">Custom prompt</option></select></label>
          <label class="field"><span>System prompt kustom (dipakai bila Custom prompt dipilih)</span><textarea id="aiSetSystem" rows="4" spellcheck="false" placeholder="Tulis instruksi sistem sendiri...">${esc(settings.customSystem)}</textarea></label>
          <div class="row"><label class="field" style="flex:1"><span>Temperature</span><input type="range" class="range" id="aiSetTemp" min="0" max="1" step="0.05" value="${Number(settings.temperature)}"></label>
          <label class="field" style="flex:1"><span>Max tokens</span><input type="number" id="aiSetMax" min="256" max="16384" step="256" value="${Number(settings.maxTokens)}"></label></div>
          <label class="check"><input type="checkbox" id="aiSetStream" ${settings.stream ? "checked" : ""}> Streaming respons (token per token)</label>
          <label class="check"><input type="checkbox" id="aiSetSave" ${settings.saveChats ? "checked" : ""}> Simpan riwayat chat untuk tab ini (sessionStorage)</label>
          <div class="divider"></div>
          <p class="ai-note">Key dibaca dari <code>js/ai-key.local.js</code>, tidak pernah dikirim ke server NEXUS, tidak ditulis ke localStorage, dan tidak disertakan dalam zip publik. Mode Eksternal wajib aktif. Provider tertentu memblokir request langsung dari browser (CORS) — gunakan OpenRouter/Groq atau endpoint kustom. Untuk Ollama, buka lewat <code>http://localhost</code> dan pakai base <code>http://localhost:11434/v1</code>.</p>
          <div class="row"><button class="btn btn-sm" id="aiClearKey" type="button">${ico("close")}Hapus key sesi ini</button><button class="btn btn-sm btn-ghost" id="aiGoSec" type="button">${ico("shield")}Security Center</button></div>
        </div>`,
        actions: [{ label: "Simpan", type: "primary", value: true }],
        onOpen(root) {
          const sp = $("#aiSetProvider", root), sm = $("#aiSetModel", root);
          sp.value = settings.provider; $("#aiSetPreset", root).value = settings.preset;
          $("#aiSetTemp", root).value = settings.temperature; $("#aiSetMax", root).value = settings.maxTokens;
          $("#aiSetStream", root).checked = settings.stream; $("#aiSetSave", root).checked = settings.saveChats;
          sp.addEventListener("change", () => {
            settings.provider = sp.value;
            sm.value = provider().id === "custom" ? settings.customModel : provider().models[0] || "";
            $("#aiCustomWrap", root).style.display = provider().id === "custom" ? "" : "none";
            $("#aiKeyWrap", root).style.display = provider().key ? "" : "none";
            saveSettings(); C.closeModal(); aiSettings();
          });
          sm.addEventListener("change", () => {
            if (settings.provider === "custom") settings.customModel = sm.value.trim();
            else settings.model = sm.value.trim();
            saveSettings(); fillModels();
          });
          $("#aiSetBase", root).addEventListener("change", (e) => { settings.customBase = e.target.value.trim(); saveSettings(); });
          $("#aiSetPreset", root).addEventListener("change", (e) => { settings.preset = e.target.value; saveSettings(); });
          $("#aiSetSystem", root).addEventListener("change", (e) => { settings.customSystem = e.target.value; saveSettings(); });
          $("#aiSetTemp", root).addEventListener("change", (e) => { settings.temperature = Number(e.target.value); saveSettings(); });
          $("#aiSetMax", root).addEventListener("change", (e) => { settings.maxTokens = Number(e.target.value); saveSettings(); });
          $("#aiSetStream", root).addEventListener("change", (e) => { settings.stream = e.target.checked; saveSettings(); });
          $("#aiSetSave", root).addEventListener("change", (e) => { settings.saveChats = e.target.checked; saveSettings(); saveChats(); });
          $("#aiClearKey", root).addEventListener("click", () => { N.security.setKey("ai:" + settings.provider, ""); C.toast("Key sesi dihapus. Isi ulang dari file lokal bila perlu.", "ok"); C.closeModal(); aiSettings(); });
          $("#aiGoSec", root).addEventListener("click", () => { C.closeModal(); location.hash = "#/security"; });
        }
      });
    }

    /* ---------- events ---------- */
    const onProv = () => { settings.provider = providerSel.value; settings.model = provider(providerSel.value).models[0] || settings.model; saveSettings(); fillModels(); };
    providerSel.addEventListener("change", onProv);
    modelSel.addEventListener("change", () => { if (settings.provider === "custom") settings.customModel = modelSel.value; else settings.model = modelSel.value; saveSettings(); });

    input.addEventListener("input", () => { autoGrow(); setBusy(busy); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    });
    $h("#aiImageInput").addEventListener("change", (e) => { addFiles(e.target.files); e.target.value = ""; });
    $h("#aiFileInput").addEventListener("change", (e) => { addFiles(e.target.files); e.target.value = ""; });
    ["dragenter", "dragover"].forEach((ev) => $h("#aiComposeBox").addEventListener(ev, (e) => { e.preventDefault(); $h("#aiComposeBox").classList.add("ai-drop-active"); }));
    ["dragleave", "drop"].forEach((ev) => $h("#aiComposeBox").addEventListener(ev, (e) => { e.preventDefault(); $h("#aiComposeBox").classList.remove("ai-drop-active"); }));
    $h("#aiComposeBox").addEventListener("drop", (e) => { if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files); });

    host.addEventListener("click", async (e) => {
      const suggest = e.target.closest("[data-suggest]");
      if (suggest) { send(suggest.dataset.suggest); return; }
      const rm = e.target.closest("[data-rm]");
      if (rm) { attachments.splice(Number(rm.dataset.rm), 1); renderAttachments(); setBusy(busy); return; }
      const del = e.target.closest("[data-del]");
      if (del) {
        C.confirm("Hapus percakapan?", "Chat ini akan dihapus dari sesi ini.", () => {
          chats = chats.filter((c) => c.id !== del.dataset.del);
          if (activeId === del.dataset.del) activeId = chats.length ? chats[0].id : null;
          saveChats(); renderThreads(); renderMessages();
        }, "Ya, hapus");
        return;
      }
      const thread = e.target.closest("[data-thread]");
      if (thread) { activeId = thread.dataset.thread; renderThreads(); renderMessages(); $h("#aiLayout").classList.remove("show-threads"); return; }
      const zoom = e.target.closest("[data-zoom]");
      if (zoom) { C.modal({ title: "Gambar lampiran", body: `<img src="${esc(zoom.src)}" style="max-width:100%;border-radius:12px">`, actions: [{ label: "Tutup", value: true }] }); return; }
      const cp = e.target.closest("[data-ai-copy]");
      if (cp) {
        const chat = current(); const m = [...chat.messages].reverse().find((x) => x._blocks && x._blocks[Number(cp.dataset.aiCopy)]);
        if (m && await C.copy(m._blocks[Number(cp.dataset.aiCopy)].code)) C.toast("Kode disalin.", "ok");
        return;
      }
      const dl = e.target.closest("[data-ai-download]");
      if (dl) {
        const chat = current(); const m = [...chat.messages].reverse().find((x) => x._blocks && x._blocks[Number(dl.dataset.aiDownload)]);
        if (m) { const b = m._blocks[Number(dl.dataset.aiDownload)]; C.download("nexus-" + Date.now() + "." + (b.lang || "txt"), b.code, "text/plain;charset=utf-8"); }
        return;
      }
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === "new") { activeId = null; current(); renderThreads(); renderMessages(); input.focus(); }
      if (act === "settings") aiSettings();
      if (act === "threads") $h("#aiLayout").classList.toggle("show-threads");
      if (act === "fav") { const on = C.toggleFavorite("ai-studio"); btn.innerHTML = ico(on ? "star" : "starOff") + "<span>" + (on ? "Tersimpan" : "Simpan tool") + "</span>"; }
      if (act === "export") { C.download("nexus-ai-chats.json", JSON.stringify(chats, null, 2), "application/json"); C.toast("Chat diekspor.", "ok"); }
      if (act === "attach-image") $h("#aiImageInput").click();
      if (act === "attach-file") $h("#aiFileInput").click();
      if (act === "send") send();
      if (act === "stop" && controller) { controller.abort(); C.toast("Generasi dihentikan.", "info"); }
    });
    $h("#aiThreadSearch").addEventListener("input", renderThreads);
    C.on("data-changed", () => renderThreads());

    fillProviders(); renderThreads(); renderMessages(); renderAttachments(); setBusy(false); autoGrow();
  }

  N.ai = { render, PROVIDERS, PRESETS, markdown, settings };
})(window.Nexus = window.Nexus || {});
