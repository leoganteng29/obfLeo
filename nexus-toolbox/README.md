# NEXUS TOOLBOX — edisi aman & diperkuat

Aplikasi **static client-side** (tanpa backend). Semua proses berjalan di browser. Versi ini menambahkan layer keamanan, mode enkripsi AES-GCM, UI modern, dan **AI Studio** (chat coding multi-provider dengan BYOK via OpenRouter).

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
- **Provider: OpenRouter saja** (banyak model dari satu key). Daftar model dimuat dari akun Anda.
- UI menyerupai asisten AI: sidebar percakapan, bubble pesan, markdown + code block (salin/unduh), composer auto-grow, status loading, stop generation, ekspor chat, dan pencarian chat.
- **Lampiran**: gambar (preview + zoom) dan file teks/kode hingga 8 MB; file teks ≤256 KB ikut dikirim sebagai konteks.
- **Persona fokus coding**: Coding Partner (default), Creative Builder, Debugger, System Architect, Code Reviewer, dan custom system prompt. Persona default meminta solusi langsung tanpa penolakan berlebihan untuk tugas coding yang sah; batasan keamanan model eksternal tetap berlaku.
- **Streaming SSE** untuk provider OpenAI-compatible; Gemini/Anthropic merespons sekaligus.
- **API key tidak diisi lewat UI lagi.** Key dibaca dari `js/ai-key.local.js` saat aplikasi dimuat, lalu disimpan di key vault dalam memory dan disensor pada error/audit. File yang dikirim publik sengaja KOSONG.
- Semua request AI wajib melewati `N.security.fetch` dan **Mode Eksternal**; pada Mode Lokal seluruh request diblokir.
- `build-public.js` **menolak membuat zip** bila `js/ai-key.local.js` berisi key, sehingga key tidak ikut terbagi ke publik/preview.

### 1c. Perbaikan AI (revisi terbaru)
- **Model selalu milik provider aktif.** Sebelumnya provider bisa terkirim dengan nama model provider lain (mis. Anthropic dengan `gpt-4o` → 404). Sekarang pergantian provider, baik dari toolbar maupun Pengaturan, langsung menyetel model default provider itu.
- **Model terbaru & aman:** Anthropic memakai `claude-sonnet-5-5`, `claude-opus-5-5`, `claude-haiku-5-5`; Groq dan Gemini tidak lagi memakai model yang sudah dihentikan; `o4-mini` memakai `max_completion_tokens` tanpa `temperature`.
- **Tidak ada blok teks kosong:** pesan berisi gambar saja, atau pesan asisten kosong (akibat Hentikan), tidak lagi dikirim sebagai teks kosong yang ditolak Anthropic/Gemini.
- **Hentikan** menyimpan teks yang sudah masuk dan tidak lagi ditandai sebagai "Gagal".
- **Pesan error jelas:** error JSON dari provider ditampilkan sebagai teks biasa; error di dalam stream SSE ikut tampil; Ollama yang mati memberi petunjuk `OLLAMA_ORIGINS`.
- **Endpoint kustom tanpa key** (mis. LM Studio di `localhost`) kini bisa dipakai. CSP `connect-src` sekarang mengizinkan `localhost`/`127.0.0.1` pada port apa pun (sebelumnya hanya 11434). Guard JS tetap hanya mengizinkan origin yang Anda daftarkan.
- **Banner di AI Studio:** saat Mode Lokal, banner menampilkan tombol *Aktifkan Mode Eksternal*; bila key belum terbaca, banner menyebutkan provider yang kuncinya belum ada.
- **Model otomatis terbaru:** tombol ikon lapisan (layers) di toolbar AI Studio (dan otomatis saat ganti provider) mengambil daftar model langsung dari provider memakai key Anda. Hanya model yang bisa dipakai akun Anda yang muncul, dan model non-chat (embedding, whisper, TTS, guard, dll.) disaring.
- **Lampiran diperbaiki:** tombol klip menerima semua jenis file (sebelumnya dibatasi ekstensi kode, sehingga banyak file tidak bisa dipilih di HP). Gambar diperkecil otomatis ke 1600 px JPEG, sehingga foto HP sampai 25 MB tetap terkirim. File teks dibaca hingga 256 KB; file biner (PDF, DOCX, ZIP) diberi keterangan yang jelas.
- **Caption menentukan jawaban:** teks yang dikirim bersama gambar atau file selalu dijawab. Jika teks kosong, AI menjelaskan isi lampiran.
- Respons dibaca sesuai `Content-Type`, sehingga server yang membalas JSON walau stream diminta tetap berfungsi.
- Markdown: blok kode tidak lagi tersarang di dalam `<p>`.

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

- Uji E2E AI Studio (Chromium headless, semua request API dimock, key palsu): 9 provider (OpenAI, Anthropic, Gemini, Groq, OpenRouter, Mistral, DeepSeek, xAI, Ollama) menerima respons; 17 skenario tepi lulus (gambar tanpa teks, Hentikan, ganti provider di Pengaturan, error 401, error SSE, Ollama mati, endpoint kustom tanpa key, o4-mini, markdown, reload).
- Uji smoke seluruh 55 route di layar 390 px: tanpa error halaman, tanpa overflow horizontal di AI Studio.

Catatan: Pengujian di atas memakai respons tiruan, bukan panggilan ke provider sungguhan. Kredensial, kuota, dan format key tiap provider hanya bisa diverifikasi dengan key Anda sendiri. "100% tanpa error" tidak bisa dijamin untuk semua browser/perangkat dan untuk setiap perubahan layanan pihak ketiga, tetapi seluruh pemeriksaan otomatis di atas lulus tanpa error.


## Deploy ke Vercel (GitHub) dengan API key server-side

1. Upload seluruh isi folder project ini ke repository GitHub. Jangan pernah menaruh API key asli di source code.
2. Di Vercel pilih **Add New → Project**, lalu **Import** repository GitHub tersebut.
3. Framework Preset: **Other**. Root Directory: `./` (default), lalu Deploy.
4. Buka **Project → Settings → Environment Variables**.
5. Tambahkan:
   - Name: `OPENROUTER_API_KEY`
   - Value: API key baru dari OpenRouter
   - Environment: Production (tambahkan Preview/Development bila diperlukan)
6. Klik Save, lalu buka **Deployments** dan lakukan **Redeploy** agar environment variable terbaca.
7. Buka website dan aktifkan **Mode Eksternal** di AI Studio.

AI Studio mengirim request ke `/api/chat` dan `/api/models`. Kedua endpoint Vercel membaca `OPENROUTER_API_KEY` dari environment server, bukan dari JavaScript browser.

**Penting:** endpoint proxy ini dapat dipanggil oleh pengunjung website. Jangan membagikan URL deployment secara publik sebelum menambahkan pembatasan akses/rate limit yang sesuai. Pantau penggunaan dan batas pengeluaran OpenRouter. Jangan commit `.env` atau API key ke GitHub.
