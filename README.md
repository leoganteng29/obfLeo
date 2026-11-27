# NEXUS TOOLBOX — edisi aman & diperkuat

Aplikasi **static client-side** (tanpa backend). Semua proses berjalan di browser. Versi ini menambahkan layer keamanan, mode enkripsi AES-GCM, UI modern, dan **AI Studio** (chat coding multi-provider dengan BYOK).

## Apa yang berubah

### 1. Sistem keamanan (`js/security.js`)
- **Content-Security-Policy** ketat di `index.html` (`default-src 'self'`, `object-src 'none'`, `base-uri 'none'`, dll).
- **Network allowlist**: origin lama tetap dibatasi, ditambah origin API AI:
  - `api.bewary.app` → `/v1/*`
  - `apiii-xrina.my.id` → `/search/*`, `/stalker/*`, `/tools/*`
  - `itunes.apple.com` → `/search`
  - `audio-ssl.itunes.apple.com` → pratinjau audio
  - `open.spotify.com` → embed
  - AI: `api.openai.com`, `api.anthropic.com`, `generativelanguage.googleapis.com`, `api.groq.com`, `openrouter.ai`, `api.mistral.ai`, `api.deepseek.com`, `api.x.ai`, `localhost:11434`, `127.0.0.1:11434`
  - Endpoint kustom HTTPS/localhost didaftarkan sementara hanya untuk sesi ini (`registerCustomEndpoint`).
- **Mode Lokal (default)** memblokir **semua** request keluar. Mode Eksternal harus diaktifkan manual di *Security Center*.
- Guard membungkus `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, dan penyuntikan `<script>/<iframe>/<link>`.
- **Key vault**: API key Bewary default hanya di memory, tidak di `localStorage`. Opsi "ingat untuk tab ini" memakai `sessionStorage` dan bisa dimatikan. Error/console otomatis disensor (`Bearer ••••`).
- **Audit log** + **self-check** (10 pemeriksaan) di halaman *Security Center*.
- `Referrer-Policy: no-referrer`.

### 1b. AI Studio (`js/ai.js`, `css/ai.css`)
- **10 provider / banyak model**: OpenAI, Anthropic Claude, Google Gemini, Groq, OpenRouter, Mistral, DeepSeek, xAI Grok, Ollama lokal, dan endpoint OpenAI-compatible kustom.
- UI menyerupai asisten AI: sidebar percakapan, bubble pesan, markdown + code block (salin/unduh), composer auto-grow, status loading, stop generation, ekspor chat, dan pencarian chat.
- **Lampiran**: gambar (preview + zoom) dan file teks/kode hingga 8 MB; file teks ≤256 KB ikut dikirim sebagai konteks.
- **Persona fokus coding**: Coding Partner (default), Creative Builder, Debugger, System Architect, Code Reviewer, dan custom system prompt. Persona default meminta solusi langsung tanpa penolakan berlebihan untuk tugas coding yang sah; batasan keamanan model eksternal tetap berlaku.
- **Streaming SSE** untuk provider OpenAI-compatible; Gemini/Anthropic merespons sekaligus.
- **API key tidak diisi lewat UI lagi.** Key dibaca dari `js/ai-key.local.js` saat aplikasi dimuat, lalu disimpan di key vault dalam memory dan disensor pada error/audit. File yang dikirim publik sengaja KOSONG.
- Semua request AI wajib melewati `N.security.fetch` dan **Mode Eksternal**; pada Mode Lokal seluruh request diblokir.
- `build-public.js` **menolak membuat zip** bila `js/ai-key.local.js` berisi key, sehingga key tidak ikut terbagi ke publik/preview.

### 2. Enc / obfuscation yang lebih kuat (`js/protection.js`)
- Mode lama (01–05, Quantum, Mandarin, Arab, Japan, Custom) tetap ada, tetapi generator identifier sekarang memakai `crypto.getRandomValues` (bukan `Math.random`).
- VM Normal/Hard/Extreme:
  - kunci acak 32-byte per proses, urutan potongan diacak dengan Fisher-Yates kriptografi (LCG lama dihapus);
  - **checksum FNV-1a** → payload yang diubah 1 karakter gagal saat runtime;
  - decoder tetap murni JS (browser + Node 18+).
- Mode baru:
  - **AES-256-GCM + Passphrase** (`.encaes`): PBKDF2-SHA256 310.000 putaran, salt 16 byte, IV 12 byte, authenticated encryption. **Kunci tidak ikut di file** — passphrase diminta saat runtime (`NEXUS_PASSPHRASE` di Node).
  - **AES-GCM Auto-Run** (`.encaesauto`): kunci acak terpecah disematkan agar langsung jalan.
- Pesan UI sekarang jujur: proteksi client-side bukan jaminan anti-crack 100%.

> **Penting:** selama kode dijalankan di perangkat pengguna, kunci/perintah harus tersedia di perangkat itu juga. Obfuscation hanya menaikkan biaya reverse engineering. Rahasia produksi (token API, kredensial) **harus** disimpan di server.

### 3. Tampilan lebih modern & tidak kaku (`css/modern.css`, `js/app.js`)
- Layout fluid dengan batas lebar di layar besar, card dengan hover halus, radius dinamis.
- 3 aksen baru: Ungu neon, Hijau emerald, Merah mawar (total 6 aksen).
- Halaman **Security Center** dengan status, toggle, statistik, diagnostics, dan audit log.
- Chip keamanan di topbar (Lokal/Eksternal).
- Animasi gradient judul mengikuti preferensi reduced-motion.
- Seluruh emoji/ikon teks mentah diganti ikon SVG seragam (`js/icons.js`) di seluruh UI: navigasi, kartu tool, kategori, game, tombol, pemutar musik, utilitas, dan AI Studio.

## Cara pakai
1. Extract zip, jalankan lewat server statis: `python3 -m http.server 8080` lalu buka `http://localhost:8080`.
2. Buka **Security Center** → pilih mode jaringan. Default: Lokal (paling aman).
3. Untuk tool berjaringan, aktifkan Eksternal; guard tetap memblokir origin di luar daftar izin.
4. Untuk AI: edit `js/ai-key.local.js` pada **salinan lokal** Anda, isi mis. `openai: "key-anda-di-sini"`. Jangan upload/bagikan salinan ini.
5. Buka **AI Studio** → Security Center → aktifkan **Eksternal** → pilih provider/model → kirim pesan/lampiran. Untuk Ollama, jalankan aplikasi dari `http://localhost` dan gunakan base `http://localhost:11434/v1`.
6. Untuk membuat zip publik: jalankan `node build-public.js`. Script ini akan gagal jika API key masih terisi.
7. Untuk enkripsi rahasia: *JS Protector → AES-GCM + Passphrase*, simpan passphrase terpisah dari file hasil.

## Verifikasi yang sudah dijalankan
- `node --check` untuk seluruh `js/*.js` — lulus.
- Uji eksekusi 5 mode enkripsi di Node — payload terbuka & tereksekusi, source mentah tidak tertanam, anti-tamper bekerja.
- Uji JSDOM: seluruh 11 route (termasuk AI Studio) ter-render tanpa error, seluruh 11 mode transform menghasilkan JavaScript valid, security gate & self-check lulus.
- Uji AI Studio: lampiran gambar/file terkirim sebagai konteks, system prompt coding hadir, Mode Lokal memblokir request, streaming SSE bekerja, request OpenAI/Anthropic/Gemini sesuai format, key dari file lokal terpakai & tidak bocor ke DOM/audit log, markdown aman dari HTML injektif.
- Uji build publik: `build-public.js` menolak key terisi, zip tidak mengandung pola `sk-...`, dan tidak ada emoji/ikon teks mentah pada seluruh route.

Catatan: "100% tanpa error" tidak bisa dijanjikan untuk semua browser/perangkat, tetapi seluruh pemeriksaan otomatis di atas lulus tanpa error.
