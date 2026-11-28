/* NEXUS TOOLBOX — AI Studio: BYOK multi-provider coding chat, attachments & streaming */
(function (N) {
  "use strict";
  const C = N.core;
  const esc = C.escapeHtml;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const ico = (name, cls) => (N.icons ? N.icons.svg(name, cls || "ai-ico") : "");

  /* Hanya OpenRouter. Model dimuat dari akun Anda lewat tombol refresh. */
  const PROVIDERS = [
    { id: "openrouter", name: "OpenRouter", base: "/api", key: false,
      models: ["openai/gpt-4o", "openai/gpt-4o-mini", "anthropic/claude-3.7-sonnet", "google/gemini-2.5-pro", "meta-llama/llama-3.3-70b-instruct", "deepseek/deepseek-r1"] }
  ];

  /* Daftar model hasil ambil dari provider (per key/akun). Diisi saat tombol refresh ditekan. */
  const dynamicModels = {};
  function providerModels(p) { return dynamicModels[p.id] || p.models; }

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
      provider: "openrouter", model: "openai/gpt-4o", modelFor: "openrouter", preset: "coding", temperature: 0.35,
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

  /* Model harus selalu milik provider yang sedang aktif. Tanpa ini, provider Anthropic
     bisa terkirim dengan nama model OpenAI (404 "model not found"). */
  function setProviderModel(model) {
    const value = String(model || "").trim();
    if (settings.provider === "custom") settings.customModel = value;
    else { settings.model = value; settings.modelFor = settings.provider; }
  }
  function reconcileModel() {
    if (settings.provider === "custom") return;
    const p = provider();
    if (settings.modelFor !== p.id || !settings.model) setProviderModel(providerModels(p)[0] || "");
  }
  reconcileModel();

  /* Base URL proxy OpenRouter. Kosong = same-origin (Vercel). Di APK WebView diisi
     window.NEXUS_API_BASE = "https://domain-anda.vercel.app" pada js/ai-key.local.js. */
  function apiBase() {
    const b = String(window.NEXUS_API_BASE || "").trim().replace(/\/+$/, "");
    return /^https:\/\/|^http:\/\/localhost/.test(b) ? b : "";
  }

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
    if (wantedModel) setProviderModel(wantedModel);
    reconcileModel();
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
  /* Aturan lampiran berlaku untuk semua persona: permintaan di teks/caption selalu dijawab. */
  const ATTACH_RULE = " Jika pesan user memuat gambar atau file lampiran, baca lampiran itu dan jawab sesuai permintaan yang tertulis di pesan user. Jika teks pesan kosong, jelaskan isi lampiran secara singkat. Jika lampiran tidak bisa dibaca, katakan dengan jelas bahwa lampiran itu tidak terbaca.";
  function systemPrompt() {
    const base = settings.preset === "easy" ? (settings.customSystem || PRESETS.coding.text) : (PRESETS[settings.preset] || PRESETS.coding).text;
    return base + ATTACH_RULE;
  }

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
    out = out.split(/\n{2,}/).map((chunk) => /^<(h[234]|div|ul|ol|pre)/.test(chunk) || chunk.indexOf("\u0000AICODE") !== -1
      ? chunk : `<p>${chunk.replace(/\n/g, "<br>")}</p>`).join("");
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
  /* Pesan kosong (mis. hasil "Hentikan" sebelum ada teks) dibuang: provider menolak blok teks kosong. */
  function normalize(chat, skip) {
    return chat.messages.filter((m) => m !== skip).map((m) => {
      const text = String(m.content || "") + ((m.files && m.files.length)
        ? "\n\n" + m.files.map((f) => `[File: ${f.name}]\n${f.text || "(isi tidak dikirim: " + (f.note || "format tidak didukung") + ")"}`).join("\n\n") : "");
      return { role: m.role === "assistant" ? "assistant" : "user", text: text.trim(), images: m.images || [] };
    }).filter((m) => m.text || m.images.length);
  }
  function openAIContent(item) {
    if (!item.images.length) return item.text;
    const parts = item.text ? [{ type: "text", text: item.text }] : [];
    return parts.concat(item.images.map((img) => ({
      type: "image_url", image_url: { url: "data:" + img.mime + ";base64," + img.data }
    })));
  }
  /* Model penalaran OpenAI (o-series, gpt-5) menolak temperature & max_tokens. */
  function isOpenAIReasoning(model) { return /^(o\d|gpt-5)/i.test(String(model || "")); }
  function errorText(j) {
    const e = j && j.error;
    if (!e) return "";
    return typeof e === "string" ? e : (e.message || JSON.stringify(e).slice(0, 300));
  }
  async function parseSSE(res, onDelta) {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    const handle = (line) => {
      const t = line.trim();
      if (!t.startsWith("data:")) return false;
      const raw = t.slice(5).trim();
      if (raw === "[DONE]") return true;
      let j = null;
      try { j = JSON.parse(raw); } catch (e) { return false; /* chunk tidak lengkap */ }
      const err = errorText(j);
      if (err) throw new Error(err);
      const d = (j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content) || "";
      if (d) onDelta(d);
      return false;
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) if (handle(line)) return;
    }
    buf += dec.decode();
    if (buf.trim()) handle(buf);
  }
  async function readError(res) {
    let t = "";
    try { t = await res.text(); } catch (e) {}
    let detail = "";
    try { detail = errorText(JSON.parse(t)); } catch (e) { detail = t.slice(0, 400); }
    return N.security.redact("HTTP " + res.status + (detail ? " — " + String(detail).slice(0, 400) : ""));
  }

  async function callAI(chat, assistant, signal, onDelta) {
    const p = provider();
    const sys = systemPrompt();
    const history = normalize(chat, assistant);
    const key = N.security.getKey("ai:" + p.id);
    const base = baseUrl();
    const model = modelId();

    if (!model) throw new Error("Model belum dipilih. Pilih model di bagian atas atau isi di Pengaturan AI.");
    if (p.id === "custom") {
      if (!base) throw new Error("Base URL endpoint kustom belum diisi. Isi di Pengaturan AI (contoh: https://api.contoh.com/v1).");
      const reg = N.security.registerCustomEndpoint(base, "AI kustom");
      if (!reg.ok) throw new Error(reg.reason + " Gunakan HTTPS atau jalankan Ollama di localhost.");
    } else if (p.key && !key) {
      throw new Error("API key untuk " + p.name + " belum dikonfigurasi.");
    }

    if (p.id === "google") {
      const url = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(key);
      const contents = history.map((m) => {
        const parts = (m.text ? [{ text: m.text }] : []).concat(m.images.map((img) => ({ inline_data: { mime_type: img.mime, data: img.data } })));
        return { role: m.role === "assistant" ? "model" : "user", parts };
      });
      const res = await N.security.fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal,
        body: JSON.stringify({ contents, systemInstruction: { parts: [{ text: sys }] }, generationConfig: { temperature: Number(settings.temperature), maxOutputTokens: Number(settings.maxTokens) } })
      });
      if (!res.ok) throw new Error(await readError(res));
      const j = await res.json();
      if (j.promptFeedback && j.promptFeedback.blockReason) throw new Error("Prompt diblokir oleh Gemini (" + j.promptFeedback.blockReason + ").");
      const cand = j.candidates && j.candidates[0];
      const parts = (cand && cand.content && cand.content.parts) || [];
      const text = parts.map((x) => x.text || "").join("");
      if (!text && cand && cand.finishReason && cand.finishReason !== "STOP") throw new Error("Respons Gemini berhenti (" + cand.finishReason + ").");
      return text;
    }

    if (p.id === "anthropic") {
      const messages = history.map((m) => {
        const content = (m.text ? [{ type: "text", text: m.text }] : []).concat(m.images.map((img) => ({
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
    if (key) headers.Authorization = "Bearer " + key;
    if (p.id === "openrouter") { headers["HTTP-Referer"] = location.origin; headers["X-Title"] = "NEXUS TOOLBOX"; }
    const reasoning = p.id === "openai" && isOpenAIReasoning(model);
    const body = {
      model,
      messages: [{ role: "system", content: sys }].concat(history.map((m) => ({ role: m.role, content: openAIContent(m) }))),
      stream: !!settings.stream
    };
    if (reasoning) body.max_completion_tokens = Number(settings.maxTokens);
    else { body.temperature = Number(settings.temperature); body.max_tokens = Number(settings.maxTokens); }
    let res;
    try {
      const endpoint = p.id === "openrouter" ? apiBase() + "/api/chat" : base + "/chat/completions";
      if (p.id === "openrouter") {
        headers["Content-Type"] = "application/json";
      }
      res = await N.security.fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body), signal });
    } catch (err) {
      if (err && (err.name === "AbortError" || err.blocked)) throw err;
      if (p.id === "ollama") throw new Error("Tidak bisa terhubung ke Ollama di localhost:11434. Pastikan Ollama berjalan dan jalankan dengan OLLAMA_ORIGINS=* (atau origin aplikasi ini).");
      throw new Error("Koneksi ke " + p.name + " gagal (" + N.security.redact(err && err.message || "network error") + "). Provider mungkin memblokir akses dari browser (CORS).");
    }
    if (!res.ok) throw new Error(await readError(res));
    // Ikuti Content-Type: sebagian server (mis. endpoint kustom) membalas JSON walau stream diminta.
    const isSSE = /event-stream/i.test(res.headers.get("content-type") || "");
    if (settings.stream && res.body && (isSSE || !/json/i.test(res.headers.get("content-type") || ""))) {
      let full = "";
      await parseSSE(res, (d) => { full += d; onDelta(full); });
      return full;
    }
    const j = await res.json();
    const err = errorText(j);
    if (err) throw new Error(N.security.redact(err));
    return (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "";
  }

  /* --------------------------- Ambil daftar model dari provider --------------------------- */
  const NON_CHAT_MODEL = /embed|whisper|tts|transcri|moderat|guard|rerank|dall-e|image|audio|orpheus|speech/i;
  function cleanModelIds(ids) {
    return Array.from(new Set(ids.map((x) => String(x || "").trim()).filter((x) => x && !NON_CHAT_MODEL.test(x))));
  }
  /* Mengambil model yang benar-benar tersedia untuk key ini. Model baru ikut otomatis. */
  async function listModels(p, key) {
    if (p.id === "google") {
      const url = "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=" + encodeURIComponent(key);
      const res = await N.security.fetch(url);
      if (!res.ok) throw new Error(await readError(res));
      const j = await res.json();
      return cleanModelIds((j.models || [])
        .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
        .map((m) => String(m.name || "").replace(/^models\//, "")));
    }
    const headers = {};
    let url = p.id === "openrouter" ? apiBase() + "/api/models" : baseUrl() + "/models";
    if (p.id === "anthropic") {
      headers["x-api-key"] = key;
      headers["anthropic-version"] = "2023-06-01";
      headers["anthropic-dangerous-direct-browser-access"] = "true";
      url += "?limit=100";
    } else if (key) headers.Authorization = "Bearer " + key;
    const res = await N.security.fetch(url, { headers });
    if (!res.ok) throw new Error(await readError(res));
    const j = await res.json();
    return cleanModelIds((j.data || []).map((m) => m.id));
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
        <p class="sub">Chat lewat OpenRouter dengan banyak model. Kunci API Anda (BYOK) hanya tersimpan di sesi ini, tidak pernah di server kami.</p></div>
        <button class="btn btn-sm btn-ghost" data-act="fav" type="button">${ico(C.isFavorite("ai-studio") ? "star" : "starOff")}<span>${C.isFavorite("ai-studio") ? "Tersimpan" : "Simpan tool"}</span></button>
      </div>

      <div class="notice info">${ico("sparkle")}<span><strong>Fokus coding.</strong> Default persona memberi solusi langsung tanpa penolakan berlebihan untuk tugas coding yang sah. Aktifkan <strong>Mode Eksternal</strong> di Security Center, pilih model, isi API key di <code>js/ai-key.local.js</code>, lalu kirim teks/gambar/file. Semua request melewati network guard.</span></div>
      <div class="notice err" id="aiModeBanner" style="display:none">${ico("shield")}<span id="aiModeText"></span><button class="btn btn-sm" id="aiEnableExt" type="button" style="display:none">Aktifkan Mode Eksternal</button></div>

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
            <button class="ai-icon-btn" data-act="refresh-models" type="button" aria-label="Muat model terbaru dari provider" data-tip="Muat model terbaru">${ico("layers")}</button>
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
      <input type="file" id="aiFileInput" multiple hidden>`;

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
      const models = p.id === "custom"
        ? (dynamicModels.custom || (settings.customModel ? [settings.customModel] : []))
        : providerModels(p);
      const wanted = modelId();
      // Model yang diketik manual tetap ditampilkan agar pilihan di layar sama dengan yang dikirim.
      const shown = wanted && !models.includes(wanted) ? [wanted].concat(models) : models;
      modelSel.innerHTML = shown.length
        ? shown.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join("")
        : `<option value="">Atur model di pengaturan</option>`;
      modelSel.value = wanted || shown[0] || "";
      modelSel.disabled = !shown.length;
    }
    /* Ambil model dari provider. silent=true dipakai otomatis (tanpa notifikasi jika gagal). */
    async function refreshModels(silent) {
      const p = provider();
      const key = p.key ? N.security.getKey("ai:" + p.id) : "";
      if (p.key && p.id !== "custom" && !key) { if (!silent) C.toast("API key " + p.name + " belum dikonfigurasi di server.", "err"); return; }
      if (N.security.mode !== "external") { if (!silent) C.toast("Aktifkan Mode Eksternal dulu di AI Studio.", "err"); return; }
      if (p.id === "custom") {
        if (!settings.customBase) { if (!silent) C.toast("Isi Base URL endpoint kustom di Pengaturan AI dulu.", "err"); return; }
        const reg = N.security.registerCustomEndpoint(baseUrl(), "AI kustom");
        if (!reg.ok) { if (!silent) C.toast(reg.reason, "err"); return; }
      }
      try {
        const ids = await listModels(p, key);
        if (!ids.length) throw new Error("Provider tidak mengembalikan model yang bisa dipakai untuk chat.");
        dynamicModels[p.id] = ids;
        fillModels();
        if (!silent) C.toast(ids.length + " model dimuat dari " + p.name + ".", "ok");
      } catch (err) {
        if (!silent) C.toast("Gagal memuat model: " + N.security.redact(err && err.message ? err.message : "error"), "err");
      }
    }
    function syncBanner() {
      const banner = $h("#aiModeBanner");
      if (!banner) return;
      const p = provider();
      const local = N.security.mode !== "external";
      const noKey = p.key && p.id !== "custom" && !N.security.getKey("ai:" + p.id);
      banner.style.display = local || noKey ? "" : "none";
      $h("#aiModeText").innerHTML = local
        ? "<strong>Mode Lokal aktif</strong> — semua request AI diblokir. Aktifkan Mode Eksternal untuk memakai AI."
        : `<strong>Key ${esc(p.name)} belum dikonfigurasi di server.</strong> Atur OPENROUTER_API_KEY di Vercel Environment Variables.`;
      $h("#aiEnableExt").style.display = local ? "" : "none";
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

    /* Gambar diperkecil di browser (maks 1600 px, JPEG) agar foto HP tidak membuat request terlalu besar. */
    async function shrinkImage(f) {
      const url = URL.createObjectURL(f);
      try {
        const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
        const max = 1600;
        const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        const data = canvas.toDataURL("image/jpeg", 0.88).split(",")[1] || "";
        if (!data) throw new Error("kosong");
        return { mime: "image/jpeg", data, size: Math.round(data.length * 0.75) };
      } finally { URL.revokeObjectURL(url); }
    }
    function readAsBase64(f) {
      return new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result).split(",")[1] || "");
        fr.onerror = rej; fr.readAsDataURL(f);
      });
    }
    async function addFiles(files) {
      for (const f of Array.from(files || [])) {
        const isImage = /^image\//.test(f.type) || /\.(png|jpe?g|gif|webp|bmp|heic|heif)$/i.test(f.name);
        if (isImage) {
          if (f.size > 25 * 1024 * 1024) { C.toast(f.name + " terlalu besar (maks 25 MB).", "err"); continue; }
          try {
            const small = await shrinkImage(f);
            attachments.push({ kind: "image", name: f.name, size: small.size, mime: small.mime, data: small.data });
          } catch (e) {
            // Browser tidak bisa menguraikan gambar ini: kirim apa adanya bila ukurannya wajar.
            if (f.size > 8 * 1024 * 1024) { C.toast(f.name + " tidak bisa diproses. Coba format JPG/PNG.", "err"); continue; }
            attachments.push({ kind: "image", name: f.name, size: f.size, mime: f.type || "image/png", data: await readAsBase64(f) });
          }
          continue;
        }
        if (f.size > 8 * 1024 * 1024) { C.toast(f.name + " terlalu besar (maks 8 MB).", "err"); continue; }
        let text = "", note = "";
        if (f.size > 256 * 1024) note = "terlalu besar untuk dibaca (maks 256 KB)";
        else {
          try {
            const t = await f.text();
            if (/\u0000/.test(t.slice(0, 4000))) note = "file biner seperti PDF/DOCX/ZIP tidak bisa dibaca. Salin teksnya lalu kirim sebagai .txt";
            else text = t.slice(0, 40000);
          } catch (e) { note = "tidak bisa dibaca"; }
        }
        attachments.push({ kind: "file", name: f.name, size: f.size, mime: f.type || "text/plain", text, note });
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
        id: C.uid("m"), role: "user",
        content: value || (attachments.length ? "Tolong baca lampiran ini dan jelaskan isinya." : ""),
        images: attachments.filter((a) => a.kind === "image").map((a) => ({ mime: a.mime, data: a.data })),
        files: attachments.filter((a) => a.kind === "file").map((a) => ({ name: a.name, size: a.size, text: a.text, note: a.note })),
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
        if (err && err.name === "AbortError") {
          // Dihentikan pengguna: simpan teks yang sudah masuk, bukan dianggap gagal.
          assistant.content = assistant.content || "*Dihentikan sebelum ada respons.*";
          updateMessage(assistant);
        } else {
          assistant.error = true;
          assistant.content = "**Gagal memanggil model.**\n\n" + N.security.redact(err && err.message ? err.message : "Error tidak diketahui") +
            "\n\nPeriksa API key OpenRouter, nama model, dan saldo akun OpenRouter Anda.";
          updateMessage(assistant);
        }
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
            <p class="ai-note key-source">${ico("shield")}<span>API key disimpan aman di Vercel Environment Variables, bukan di browser atau GitHub.</span></p>
          </div>
          <label class="field"><span>Persona / fokus AI</span><select id="aiSetPreset">${Object.entries(PRESETS).map(([k, v]) => `<option value="${esc(k)}">${esc(v.label)}</option>`).join("")}<option value="easy">Custom prompt</option></select></label>
          <label class="field"><span>System prompt kustom (dipakai bila Custom prompt dipilih)</span><textarea id="aiSetSystem" rows="4" spellcheck="false" placeholder="Tulis instruksi sistem sendiri...">${esc(settings.customSystem)}</textarea></label>
          <div class="row"><label class="field" style="flex:1"><span>Temperature</span><input type="range" class="range" id="aiSetTemp" min="0" max="1" step="0.05" value="${Number(settings.temperature)}"></label>
          <label class="field" style="flex:1"><span>Max tokens</span><input type="number" id="aiSetMax" min="256" max="16384" step="256" value="${Number(settings.maxTokens)}"></label></div>
          <label class="check"><input type="checkbox" id="aiSetStream" ${settings.stream ? "checked" : ""}> Streaming respons (token per token)</label>
          <label class="check"><input type="checkbox" id="aiSetSave" ${settings.saveChats ? "checked" : ""}> Simpan riwayat chat untuk tab ini (sessionStorage)</label>
          <div class="divider"></div>
          <p class="ai-note">OpenRouter terhubung melalui API proxy di server Vercel. Simpan rahasia sebagai <code>OPENROUTER_API_KEY</code> di Project Settings → Environment Variables. Jangan masukkan key ke source code atau GitHub. Mode Eksternal wajib aktif.</p>
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
            setProviderModel(provider().id === "custom" ? settings.customModel : providerModels(provider())[0] || "");
            saveSettings(); fillProviders(); syncBanner(); refreshModels(true); C.closeModal(); aiSettings();
          });
          sm.addEventListener("change", () => {
            setProviderModel(sm.value.trim());
            saveSettings(); fillModels();
          });
          $("#aiSetBase", root).addEventListener("change", (e) => { settings.customBase = e.target.value.trim(); saveSettings(); });
          $("#aiSetPreset", root).addEventListener("change", (e) => { settings.preset = e.target.value; saveSettings(); });
          $("#aiSetSystem", root).addEventListener("change", (e) => { settings.customSystem = e.target.value; saveSettings(); });
          $("#aiSetTemp", root).addEventListener("change", (e) => { settings.temperature = Number(e.target.value); saveSettings(); });
          $("#aiSetMax", root).addEventListener("change", (e) => { settings.maxTokens = Number(e.target.value); saveSettings(); });
          $("#aiSetStream", root).addEventListener("change", (e) => { settings.stream = e.target.checked; saveSettings(); });
          $("#aiSetSave", root).addEventListener("change", (e) => { settings.saveChats = e.target.checked; saveSettings(); saveChats(); });
          $("#aiClearKey", root).addEventListener("click", () => { N.security.setKey("ai:" + settings.provider, ""); C.toast("Tidak ada API key lokal yang disimpan.", "ok"); C.closeModal(); aiSettings(); });
          $("#aiGoSec", root).addEventListener("click", () => { C.closeModal(); location.hash = "#/security"; });
        }
      });
    }

    /* ---------- events ---------- */
    const onProv = () => {
      settings.provider = providerSel.value;
      setProviderModel(provider().id === "custom" ? settings.customModel : providerModels(provider())[0] || "");
      saveSettings(); fillModels(); syncBanner();
      refreshModels(true);
    };
    providerSel.addEventListener("change", onProv);
    modelSel.addEventListener("change", () => { setProviderModel(modelSel.value); saveSettings(); syncBanner(); });
    $h("#aiEnableExt").addEventListener("click", () => {
      N.security.setMode("external");
      C.toast("Mode Eksternal diaktifkan untuk AI Studio.", "ok");
      syncBanner();
    });
    unsubs.push(N.security.on(() => syncBanner()));

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
      if (act === "refresh-models") refreshModels(false);
      if (act === "attach-image") $h("#aiImageInput").click();
      if (act === "attach-file") $h("#aiFileInput").click();
      if (act === "send") send();
      if (act === "stop" && controller) { controller.abort(); C.toast("Generasi dihentikan.", "info"); }
    });
    $h("#aiThreadSearch").addEventListener("input", renderThreads);
    C.on("data-changed", () => renderThreads());

    fillProviders(); syncBanner(); if (N.security.mode === "external") refreshModels(true); renderThreads(); renderMessages(); renderAttachments(); setBusy(false); autoGrow();
  }

  N.ai = { render, PROVIDERS, PRESETS, markdown, settings };
})(window.Nexus = window.Nexus || {});
