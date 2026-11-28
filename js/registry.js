/* NEXUS TOOLBOX — tool registry & search */
(function (N) {
  "use strict";

  const categories = [
    { id: "protection", label: "Code Protection", icon: "shield", desc: "Transformasi source code lokal" },
    { id: "developer", label: "Developer Tools", icon: "code", desc: "Format, validasi, konversi, dan analisis" },
    { id: "utility", label: "Utilities", icon: "wrench", desc: "Alat harian untuk kerja dan belajar" },
    { id: "game", label: "Game Center", icon: "sparkle", desc: "Mini-game dengan skor lokal" },
    { id: "ambience", label: "Ambience", icon: "music", desc: "Suara fokus yang disintesis" }
  ];

  const tools = [
    { id: "js-protector", name: "JavaScript Code Protector", cat: "protection", route: "protect", icon: "shield", desc: "Lima mode transformasi source code .js + Enc Center (VM Normal/Hard/Extreme, Quantum, Mandarin, Arab, Custom Prefix): basic, renaming, compact, readability, dan custom.", kw: "obfuscate protect minify rename javascript file", badge: "PRO", featured: true },
    { id: "ai-studio", name: "AI Coding Studio", cat: "protection", route: "ai", icon: "sparkle", desc: "Chat AI fokus coding lewat OpenRouter dengan banyak model, persona coding/creative/debug/architect/reviewer, streaming, lampiran gambar/file, dan API key BYOK yang hanya disimpan di sesi.", kw: "ai chat gpt claude gemini groq openrouter codestral deepseek grok ollama coding assistant debug review artifact", badge: "PRO", featured: true, popular: true },

    { id: "js-formatter", name: "JavaScript Formatter", cat: "developer", route: "tools", icon: "JS", desc: "Rapikan indentation dan struktur JavaScript tanpa menjalankan kode.", kw: "beautify pretty code indent", popular: true },
    { id: "js-minifier", name: "JavaScript Minifier", cat: "developer", route: "tools", icon: "JS", desc: "Kurangi whitespace dan komentar sambil menjaga string dan literal.", kw: "compress compact", popular: true },
    { id: "json-formatter", name: "JSON Formatter", cat: "developer", route: "tools", icon: "{}", desc: "Parse dan tampilkan JSON dengan indentasi rapi.", kw: "pretty beautify" },
    { id: "json-validator", name: "JSON Validator", cat: "developer", route: "tools", icon: "check", desc: "Cek keabsahan JSON dan tunjukkan lokasi error.", kw: "check parse validate" },
    { id: "json-minifier", name: "JSON Minifier", cat: "developer", route: "tools", icon: "{}", desc: "Ubah JSON menjadi satu baris ringkas.", kw: "compact compress" },
    { id: "base64", name: "Base64 Encoder / Decoder", cat: "developer", route: "tools", icon: "64", desc: "Encode/decode teks Unicode ke Base64 dan sebaliknya.", kw: "encode decode text", popular: true },
    { id: "url-encode", name: "URL Encoder / Decoder", cat: "developer", route: "tools", icon: "URL", desc: "Encode dan decode komponen URL dengan aman.", kw: "percent uri" },
    { id: "html-entity", name: "HTML Entity Encoder / Decoder", cat: "developer", route: "tools", icon: "&", desc: "Konversi karakter khusus ke entitas HTML dan kembali.", kw: "escape unescape html" },
    { id: "color-converter", name: "Color Converter", cat: "developer", route: "tools", icon: "palette", desc: "Konversi HEX, RGB, dan HSL secara dua arah dengan preview.", kw: "hex rgb hsl warna" },
    { id: "timestamp", name: "Timestamp Converter", cat: "developer", route: "tools", icon: "clock", desc: "Konversi Unix timestamp ke tanggal dan sebaliknya.", kw: "unix date time epoch" },
    { id: "text-diff", name: "Text Diff", cat: "developer", route: "tools", icon: "diff", desc: "Bandingkan dua teks per baris dengan penanda tambah/hapus.", kw: "compare changes diff" },
    { id: "regex-tester", name: "Regex Tester", cat: "developer", route: "tools", icon: "regex", desc: "Uji pola regex, flags, dan lihat semua match beserta group.", kw: "regular expression match", popular: true },
    { id: "uuid-generator", name: "UUID Generator", cat: "developer", route: "tools", icon: "ID", desc: "Buat UUID v4 dengan pembangkit acak kriptografis.", kw: "guid random id" },
    { id: "hash-generator", name: "Hash Generator", cat: "developer", route: "tools", icon: "#", desc: "Hash teks atau file dengan SHA-1/256/384/512 via Web Crypto.", kw: "sha checksum digest file" },
    { id: "markdown-preview", name: "Markdown Previewer", cat: "developer", route: "tools", icon: "markdown", desc: "Tulis Markdown dan lihat hasilnya langsung.", kw: "md render preview" },
    { id: "css-formatter", name: "CSS Formatter", cat: "developer", route: "tools", icon: "#", desc: "Rapikan aturan CSS menjadi blok yang mudah dibaca.", kw: "beautify style" },
    { id: "html-formatter", name: "HTML Formatter", cat: "developer", route: "tools", icon: "<>", desc: "Indentasi markup HTML dengan penanganan tag void.", kw: "beautify markup" },

    { id: "cipher-lab", name: "Cipher & Encode Lab", cat: "utility", route: "utilities", icon: "lock", desc: "Enkode dan dekode ROT13, Atbash, Caesar, Vigenère, A1Z26, Hex, Biner, ASCII, Morse, Base32, Leetspeak, NATO, dan balik teks.", kw: "sandi cipher encode decode rot13 atbash caesar vigenere morse hex biner base32 leet nato" },
    { id: "font-styler", name: "Font Unicode Generator", cat: "utility", route: "utilities", icon: "sparkle", desc: "Ubah teks jadi tebal, miring, script, fraktur, monospace, lingkaran, kotak, superskrip, coret, dan 20+ gaya lain.", kw: "font style unicode tebal miring script fraktur lingkaran keren" },
    { id: "unit-converter", name: "Konverter Satuan", cat: "utility", route: "utilities", icon: "wrench", desc: "Panjang, berat, kecepatan, luas, volume, ukuran data, waktu, tekanan, energi, dan sudut.", kw: "convert satuan panjang berat kecepatan luas volume data waktu" },
    { id: "geometry-calc", name: "Kalkulator Geometri", cat: "utility", route: "utilities", icon: "code", desc: "Luas dan keliling lingkaran, persegi, segitiga, trapesium; volume kubus, balok, tabung, dan bola; Pythagoras.", kw: "geometri luas keliling volume lingkaran segitiga matematika" },
    { id: "date-tools", name: "Tanggal & Waktu Lanjutan", cat: "utility", route: "utilities", icon: "clock", desc: "Timestamp dua arah, selisih tanggal, umur, hari dalam minggu, hitung mundur, dan jam dunia.", kw: "tanggal waktu timestamp umur selisih countdown jam dunia" },
    { id: "finance-id", name: "Finansial Indonesia", cat: "utility", route: "utilities", icon: "wrench", desc: "Zakat 2,5%, PPN, THR, gaji bersih, deposito, ROI, BEP, KPR, diskon bertingkat, markup, dan pajak undian.", kw: "zakat ppn thr gaji deposito roi bep kpr diskon markup pajak keuangan" },
    { id: "bill-tools", name: "Belanja & Estimasi", cat: "utility", route: "utilities", icon: "wrench", desc: "Patungan tagihan, tip, pajak, ongkir, kembalian, biaya BBM dan listrik, skala peta, cat, ubin, dan resep.", kw: "belanja patungan tip pajak ongkir kembalian bbm listrik cat ubin resep" },
    { id: "fake-generator", name: "Generator Data Palsu", cat: "utility", route: "utilities", icon: "sparkle", desc: "Nama, username, email contoh, nomor telepon contoh, profil lengkap, dan OTP 6 digit untuk pengujian.", kw: "generator nama username email telepon otp dummy fake" },
    { id: "fun-lab", name: "Fun Lab", cat: "utility", route: "utilities", icon: "sparkle", desc: "Lempar dadu, lempar koin, bola ajaib, dan rating acak.", kw: "dadu koin 8ball rate fun acak" },
    { id: "quiz-lab", name: "Kuis & Trivia", cat: "utility", route: "utilities", icon: "sparkle", desc: "Trivia geografi, sejarah, sains, olahraga, tebak negara dari ibu kota, benar-salah, kuis hitung, dan tebak angka.", kw: "kuis trivia tebak negara benar salah matematika tebak angka game" },
    { id: "counter-lab", name: "Penghitung Multi", cat: "utility", route: "utilities", icon: "timer", desc: "Beberapa penghitung bernama dengan tombol +, −, reset, dan hapus. Tersimpan di browser ini.", kw: "counter hitung penghitung tally" },
    { id: "habit-tracker", name: "Pelacak Kebiasaan", cat: "utility", route: "utilities", icon: "sparkle", desc: "Catat kebiasaan harian, tandai selesai, dan lihat streak. Tersimpan di browser ini.", kw: "habit kebiasaan streak tracker harian" },
    { id: "bookmark-manager", name: "Bookmark Manager", cat: "utility", route: "utilities", icon: "star", desc: "Simpan tautan https dengan judul, buka, dan hapus. Tersimpan di browser ini.", kw: "bookmark tautan link simpan" },
    { id: "stock-manager", name: "Pencatat Stok", cat: "utility", route: "utilities", icon: "wrench", desc: "Catat barang dan jumlah stok, tambah atau kurangi, tersimpan di browser ini.", kw: "stok gudang inventory barang catat" },
    { id: "agenda-lab", name: "Agenda & Pengingat", cat: "utility", route: "utilities", icon: "clock", desc: "Catat acara dengan tanggal dan lihat hitung mundur ke setiap acara. Tersimpan di browser ini.", kw: "agenda acara pengingat reminder jadwal" },
    { id: "apk-builder", name: "Build APK dari ZIP", cat: "utility", route: "utilities", icon: "wrench", desc: "Kirim link ZIP web (maks 2 GB), lalu GitHub Actions membangun APK Android WebView dan menampilkan statusnya.", kw: "apk build android zip webview github actions" },
    { id: "stopwatch", name: "Stopwatch", cat: "utility", route: "utilities", icon: "timer", desc: "Timer berjalan dengan lap dan presisi milliseconds.", kw: "timer lap stopwatch" },
    { id: "countdown", name: "Countdown Timer", cat: "utility", route: "utilities", icon: "timer", desc: "Hitung mundur dengan progress bar dan notifikasi suara.", kw: "timer hitung mundur" },
    { id: "clock", name: "Digital Clock", cat: "utility", route: "utilities", icon: "clock", desc: "Jam digital lokal dengan tanggal dan opsi format 24/12 jam.", kw: "time jam tanggal" },
    { id: "scamcheck", name: "Cek Penipuan (Bewary)", cat: "utility", route: "utilities", icon: "alert", desc: "Cek link, domain, nomor telepon, email, IP, IBAN, dompet kripto, dan handle pembayaran lewat API Bewary.", kw: "scam penipuan phishing bewary link nomor email iban" },
    { id: "lyrics", name: "Lirik Lagu", cat: "utility", route: "utilities", icon: "music", desc: "Cari lirik lagu lengkap dengan judul dan artis, lalu salin teksnya.", kw: "lirik lyrics lagu song kahitna" },
    { id: "spotify", name: "Cari di Spotify", cat: "utility", route: "utilities", icon: "music", desc: "Cari lagu, artis, album, dan playlist Spotify, lalu buka langsung di Spotify.", kw: "spotify lagu musik search playlist album artis" },
    { id: "github-profile", name: "Profil GitHub", cat: "utility", route: "utilities", icon: "github", desc: "Lihat profil, repositori, dan aktivitas publik sebuah akun GitHub.", kw: "github profil repo akun stalker" },
    { id: "temp-email", name: "Email Sementara", cat: "utility", route: "utilities", icon: "mail", desc: "Buat alamat email sementara dan cek inbox-nya.", kw: "email sementara temp inbox disposable" },
    { id: "ssweb", name: "Screenshot Website", cat: "utility", route: "utilities", icon: "camera", desc: "Ambil screenshot desktop, tablet, dan mobile dari URL publik.", kw: "screenshot ss web gambar capture" },
    { id: "webtozip", name: "Website ke ZIP", cat: "utility", route: "utilities", icon: "download", desc: "Unduh salinan file website publik sebagai ZIP. Untuk website milik sendiri.", kw: "zip download website salin copy source" },
    { id: "pomodoro", name: "Pomodoro Timer", cat: "utility", route: "utilities", icon: "timer", desc: "Sesi fokus dan istirahat dengan siklus tersimpan lokal.", kw: "focus work break" },
    { id: "notes", name: "Notes", cat: "utility", route: "utilities", icon: "note", desc: "Catatan cepat yang tersimpan otomatis di perangkat.", kw: "notepad catatan autosave" },
    { id: "clipboard", name: "Clipboard Manager", cat: "utility", route: "utilities", icon: "clipboard", desc: "Simpan dan salin kembali potongan teks yang sering dipakai.", kw: "copy paste snippet" },
    { id: "random-picker", name: "Random Picker", cat: "utility", route: "utilities", icon: "dice", desc: "Pilih item secara acak dari daftar dengan opsi without repeat.", kw: "random choice pilih" },
    { id: "password", name: "Password Generator", cat: "utility", route: "utilities", icon: "key", desc: "Buat kata sandi kuat untuk akun sah Anda dengan RNG kriptografis.", kw: "secure random password account" },
    { id: "qr", name: "QR Code Generator", cat: "utility", route: "utilities", icon: "grid", desc: "Buat QR code lokal dari teks/URL dan unduh sebagai PNG.", kw: "qr barcode png", popular: true },
    { id: "photolive", name: "Foto Live HP", cat: "utility", route: "utilities", icon: "phone", desc: "Masukkan foto ke layar template HP, lalu unduh sebagai PNG atau video foto live.", kw: "foto live photo livephoto template hp mockup mockup phone", popular: true },
    { id: "text-counter", name: "Text Counter", cat: "utility", route: "utilities", icon: "text", desc: "Hitung karakter, kata, baris, paragraf, dan estimasi waktu baca.", kw: "character count statistics" },
    { id: "word-counter", name: "Word Counter", cat: "utility", route: "utilities", icon: "Aa", desc: "Lihat frekuensi kata paling sering dalam sebuah teks.", kw: "frequency words" },
    { id: "case-converter", name: "Case Converter", cat: "utility", route: "utilities", icon: "Aa", desc: "Ubah teks ke camel, pascal, snake, kebab, title, dan lainnya.", kw: "upper lower camel snake kebab" },
    { id: "lorem", name: "Lorem Ipsum Generator", cat: "utility", route: "utilities", icon: "L", desc: "Buat teks placeholder dalam jumlah paragraf atau kata.", kw: "dummy placeholder text" },
    { id: "daily-challenge", name: "Daily Challenge", cat: "utility", route: "utilities", icon: "sparkle", desc: "Tiga pertanyaan logika/programming baru setiap hari dengan streak.", kw: "quiz harian soal" },

    { id: "reaction", name: "Reaction Test", cat: "game", route: "games", icon: "bolt", desc: "Uji waktu reaksi dari sinyal mulai sampai klik.", kw: "speed reflex" },
    { id: "memory", name: "Memory Tiles", cat: "game", route: "games", icon: "grid", desc: "Hafal posisi ubin yang menyala lalu klik semuanya.", kw: "remember matching" },
    { id: "number", name: "Number Challenge", cat: "game", route: "games", icon: "?", desc: "Tebak angka dengan petunjuk lebih tinggi/lebih rendah.", kw: "guess angka" },
    { id: "tictactoe", name: "Tic Tac Toe", cat: "game", route: "games", icon: "close", desc: "Lawan AI dengan pilihan tingkat mudah atau sulit.", kw: "tic tac toe ai" },
    { id: "rps", name: "Rock Paper Scissors", cat: "game", route: "games", icon: "hand", desc: "Batu gunting kertas dengan rekor menang-kalah lokal.", kw: "batu gunting kertas" },
    { id: "2048", name: "2048", cat: "game", route: "games", icon: "2", desc: "Gabungkan ubin angka lewat keyboard atau swipe.", kw: "puzzle merge numbers", popular: true },
    { id: "snake", name: "Snake", cat: "game", route: "games", icon: "route", desc: "Game ular klasik dengan kontrol keyboard, swipe, dan D-pad.", kw: "ular arcade", popular: true },
    { id: "scramble", name: "Word Scramble", cat: "game", route: "games", icon: "word", desc: "Susun kembali huruf acak menjadi kata yang benar.", kw: "ankagram kata" },
    { id: "click", name: "Click Challenge", cat: "game", route: "games", icon: "target", desc: "Klik target yang muncul acak secepat mungkin.", kw: "target reflex click" },

    { id: "ambient", name: "Music Lounge", cat: "ambience", route: "music", icon: "music", desc: "Cari lagu, putar pratinjau 30 detik, pemutar Spotify penuh, dan favorit.", kw: "music lagu spotify itunes search favorit player", badge: "NEW" }
  ];

  const byId = {};
  tools.forEach((t) => { byId[t.id] = t; });

  function get(id) { return byId[id] || null; }
  function category(id) { return categories.find((c) => c.id === id) || null; }

  function search(query, limit) {
    const q = String(query || "").toLowerCase().trim();
    if (!q) return [];
    const tokens = q.split(/\s+/);
    const scored = tools.map((t) => {
      const hay = [t.name, t.desc, category(t.cat)?.label || "", t.kw || "", t.id].join(" ").toLowerCase();
      let score = 0;
      tokens.forEach((tok) => {
        if (t.name.toLowerCase().includes(tok)) score += 6;
        if ((t.kw || "").includes(tok)) score += 3;
        if (t.desc.toLowerCase().includes(tok)) score += 2;
        if ((category(t.cat)?.label || "").toLowerCase().includes(tok)) score += 2;
      });
      return { tool: t, score: tokens.every((tok) => hay.includes(tok)) ? score : 0 };
    }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
    return scored.slice(0, limit || 20).map((x) => x.tool);
  }

  N.registry = { tools, categories, get, category, search };
})(window.Nexus = window.Nexus || {});
