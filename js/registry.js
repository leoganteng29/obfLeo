/* NEXUS TOOLBOX — tool registry & search */
(function (N) {
  "use strict";

  const categories = [
    { id: "protection", label: "Code Protection", icon: "◈", desc: "Transformasi source code lokal" },
    { id: "developer", label: "Developer Tools", icon: "⌘", desc: "Format, validasi, konversi, dan analisis" },
    { id: "utility", label: "Utilities", icon: "⚙", desc: "Alat harian untuk kerja dan belajar" },
    { id: "game", label: "Game Center", icon: "✦", desc: "Mini-game dengan skor lokal" },
    { id: "ambience", label: "Ambience", icon: "♫", desc: "Suara fokus yang disintesis" }
  ];

  const tools = [
    { id: "js-protector", name: "JavaScript Code Protector", cat: "protection", route: "protect", icon: "◈", desc: "Lima mode transformasi source code .js + Enc Center (VM Normal/Hard/Extreme, Quantum, Mandarin, Arab, Custom Prefix): basic, renaming, compact, readability, dan custom.", kw: "obfuscate protect minify rename javascript file", badge: "PRO", featured: true },

    { id: "js-formatter", name: "JavaScript Formatter", cat: "developer", route: "tools", icon: "JS", desc: "Rapikan indentation dan struktur JavaScript tanpa menjalankan kode.", kw: "beautify pretty code indent", popular: true },
    { id: "js-minifier", name: "JavaScript Minifier", cat: "developer", route: "tools", icon: "JS", desc: "Kurangi whitespace dan komentar sambil menjaga string dan literal.", kw: "compress compact", popular: true },
    { id: "json-formatter", name: "JSON Formatter", cat: "developer", route: "tools", icon: "{}", desc: "Parse dan tampilkan JSON dengan indentasi rapi.", kw: "pretty beautify" },
    { id: "json-validator", name: "JSON Validator", cat: "developer", route: "tools", icon: "✓", desc: "Cek keabsahan JSON dan tunjukkan lokasi error.", kw: "check parse validate" },
    { id: "json-minifier", name: "JSON Minifier", cat: "developer", route: "tools", icon: "{}", desc: "Ubah JSON menjadi satu baris ringkas.", kw: "compact compress" },
    { id: "base64", name: "Base64 Encoder / Decoder", cat: "developer", route: "tools", icon: "64", desc: "Encode/decode teks Unicode ke Base64 dan sebaliknya.", kw: "encode decode text", popular: true },
    { id: "url-encode", name: "URL Encoder / Decoder", cat: "developer", route: "tools", icon: "URL", desc: "Encode dan decode komponen URL dengan aman.", kw: "percent uri" },
    { id: "html-entity", name: "HTML Entity Encoder / Decoder", cat: "developer", route: "tools", icon: "&", desc: "Konversi karakter khusus ke entitas HTML dan kembali.", kw: "escape unescape html" },
    { id: "color-converter", name: "Color Converter", cat: "developer", route: "tools", icon: "◐", desc: "Konversi HEX, RGB, dan HSL secara dua arah dengan preview.", kw: "hex rgb hsl warna" },
    { id: "timestamp", name: "Timestamp Converter", cat: "developer", route: "tools", icon: "◷", desc: "Konversi Unix timestamp ke tanggal dan sebaliknya.", kw: "unix date time epoch" },
    { id: "text-diff", name: "Text Diff", cat: "developer", route: "tools", icon: "≠", desc: "Bandingkan dua teks per baris dengan penanda tambah/hapus.", kw: "compare changes diff" },
    { id: "regex-tester", name: "Regex Tester", cat: "developer", route: "tools", icon: ".*", desc: "Uji pola regex, flags, dan lihat semua match beserta group.", kw: "regular expression match", popular: true },
    { id: "uuid-generator", name: "UUID Generator", cat: "developer", route: "tools", icon: "ID", desc: "Buat UUID v4 dengan pembangkit acak kriptografis.", kw: "guid random id" },
    { id: "hash-generator", name: "Hash Generator", cat: "developer", route: "tools", icon: "#", desc: "Hash teks atau file dengan SHA-1/256/384/512 via Web Crypto.", kw: "sha checksum digest file" },
    { id: "markdown-preview", name: "Markdown Previewer", cat: "developer", route: "tools", icon: "M↓", desc: "Tulis Markdown dan lihat hasilnya langsung.", kw: "md render preview" },
    { id: "css-formatter", name: "CSS Formatter", cat: "developer", route: "tools", icon: "#", desc: "Rapikan aturan CSS menjadi blok yang mudah dibaca.", kw: "beautify style" },
    { id: "html-formatter", name: "HTML Formatter", cat: "developer", route: "tools", icon: "<>", desc: "Indentasi markup HTML dengan penanganan tag void.", kw: "beautify markup" },

    { id: "stopwatch", name: "Stopwatch", cat: "utility", route: "utilities", icon: "⏱", desc: "Timer berjalan dengan lap dan presisi milliseconds.", kw: "timer lap stopwatch" },
    { id: "countdown", name: "Countdown Timer", cat: "utility", route: "utilities", icon: "⧗", desc: "Hitung mundur dengan progress bar dan notifikasi suara.", kw: "timer hitung mundur" },
    { id: "clock", name: "Digital Clock", cat: "utility", route: "utilities", icon: "◷", desc: "Jam digital lokal dengan tanggal dan opsi format 24/12 jam.", kw: "time jam tanggal" },
    { id: "scamcheck", name: "Cek Penipuan (Bewary)", cat: "utility", route: "utilities", icon: "⚠", desc: "Cek link, domain, nomor telepon, email, IP, IBAN, dompet kripto, dan handle pembayaran lewat API Bewary.", kw: "scam penipuan phishing bewary link nomor email iban" },
    { id: "lyrics", name: "Lirik Lagu", cat: "utility", route: "utilities", icon: "♫", desc: "Cari lirik lagu lengkap dengan judul dan artis, lalu salin teksnya.", kw: "lirik lyrics lagu song kahitna" },
    { id: "spotify", name: "Cari di Spotify", cat: "utility", route: "utilities", icon: "♪", desc: "Cari lagu, artis, album, dan playlist Spotify, lalu buka langsung di Spotify.", kw: "spotify lagu musik search playlist album artis" },
    { id: "github-profile", name: "Profil GitHub", cat: "utility", route: "utilities", icon: "⌥", desc: "Lihat profil, repositori, dan aktivitas publik sebuah akun GitHub.", kw: "github profil repo akun stalker" },
    { id: "temp-email", name: "Email Sementara", cat: "utility", route: "utilities", icon: "✉", desc: "Buat alamat email sementara dan cek inbox-nya.", kw: "email sementara temp inbox disposable" },
    { id: "ssweb", name: "Screenshot Website", cat: "utility", route: "utilities", icon: "▣", desc: "Ambil screenshot desktop, tablet, dan mobile dari URL publik.", kw: "screenshot ss web gambar capture" },
    { id: "webtozip", name: "Website ke ZIP", cat: "utility", route: "utilities", icon: "⇩", desc: "Unduh salinan file website publik sebagai ZIP. Untuk website milik sendiri.", kw: "zip download website salin copy source" },
    { id: "pomodoro", name: "Pomodoro Timer", cat: "utility", route: "utilities", icon: "🍅", desc: "Sesi fokus dan istirahat dengan siklus tersimpan lokal.", kw: "focus work break" },
    { id: "notes", name: "Notes", cat: "utility", route: "utilities", icon: "▤", desc: "Catatan cepat yang tersimpan otomatis di perangkat.", kw: "notepad catatan autosave" },
    { id: "clipboard", name: "Clipboard Manager", cat: "utility", route: "utilities", icon: "⎘", desc: "Simpan dan salin kembali potongan teks yang sering dipakai.", kw: "copy paste snippet" },
    { id: "random-picker", name: "Random Picker", cat: "utility", route: "utilities", icon: "⚄", desc: "Pilih item secara acak dari daftar dengan opsi without repeat.", kw: "random choice pilih" },
    { id: "password", name: "Password Generator", cat: "utility", route: "utilities", icon: "⌁", desc: "Buat kata sandi kuat untuk akun sah Anda dengan RNG kriptografis.", kw: "secure random password account" },
    { id: "qr", name: "QR Code Generator", cat: "utility", route: "utilities", icon: "▦", desc: "Buat QR code lokal dari teks/URL dan unduh sebagai PNG.", kw: "qr barcode png", popular: true },
    { id: "photolive", name: "Foto Live HP", cat: "utility", route: "utilities", icon: "▯", desc: "Masukkan foto ke layar template HP, lalu unduh sebagai PNG atau video foto live.", kw: "foto live photo livephoto template hp mockup mockup phone", popular: true },
    { id: "text-counter", name: "Text Counter", cat: "utility", route: "utilities", icon: "≡", desc: "Hitung karakter, kata, baris, paragraf, dan estimasi waktu baca.", kw: "character count statistics" },
    { id: "word-counter", name: "Word Counter", cat: "utility", route: "utilities", icon: "Aa", desc: "Lihat frekuensi kata paling sering dalam sebuah teks.", kw: "frequency words" },
    { id: "case-converter", name: "Case Converter", cat: "utility", route: "utilities", icon: "Aa", desc: "Ubah teks ke camel, pascal, snake, kebab, title, dan lainnya.", kw: "upper lower camel snake kebab" },
    { id: "lorem", name: "Lorem Ipsum Generator", cat: "utility", route: "utilities", icon: "L", desc: "Buat teks placeholder dalam jumlah paragraf atau kata.", kw: "dummy placeholder text" },
    { id: "daily-challenge", name: "Daily Challenge", cat: "utility", route: "utilities", icon: "✧", desc: "Tiga pertanyaan logika/programming baru setiap hari dengan streak.", kw: "quiz harian soal" },

    { id: "reaction", name: "Reaction Test", cat: "game", route: "games", icon: "⚡", desc: "Uji waktu reaksi dari sinyal mulai sampai klik.", kw: "speed reflex" },
    { id: "memory", name: "Memory Tiles", cat: "game", route: "games", icon: "▦", desc: "Hafal posisi ubin yang menyala lalu klik semuanya.", kw: "remember matching" },
    { id: "number", name: "Number Challenge", cat: "game", route: "games", icon: "?", desc: "Tebak angka dengan petunjuk lebih tinggi/lebih rendah.", kw: "guess angka" },
    { id: "tictactoe", name: "Tic Tac Toe", cat: "game", route: "games", icon: "×", desc: "Lawan AI dengan pilihan tingkat mudah atau sulit.", kw: "tic tac toe ai" },
    { id: "rps", name: "Rock Paper Scissors", cat: "game", route: "games", icon: "✊", desc: "Batu gunting kertas dengan rekor menang-kalah lokal.", kw: "batu gunting kertas" },
    { id: "2048", name: "2048", cat: "game", route: "games", icon: "2", desc: "Gabungkan ubin angka lewat keyboard atau swipe.", kw: "puzzle merge numbers", popular: true },
    { id: "snake", name: "Snake", cat: "game", route: "games", icon: "➿", desc: "Game ular klasik dengan kontrol keyboard, swipe, dan D-pad.", kw: "ular arcade", popular: true },
    { id: "scramble", name: "Word Scramble", cat: "game", route: "games", icon: "🔤", desc: "Susun kembali huruf acak menjadi kata yang benar.", kw: "ankagram kata" },
    { id: "click", name: "Click Challenge", cat: "game", route: "games", icon: "◎", desc: "Klik target yang muncul acak secepat mungkin.", kw: "target reflex click" },

    { id: "ambient", name: "Music Lounge", cat: "ambience", route: "music", icon: "♫", desc: "Cari lagu, putar pratinjau 30 detik, pemutar Spotify penuh, dan favorit.", kw: "music lagu spotify itunes search favorit player", badge: "NEW" }
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
