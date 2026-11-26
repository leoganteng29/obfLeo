# Vault & JS Packer ✈ (tema Paper Plane)

Website statis, tanpa server/backend, bertema pesawat kertas (paper plane). Semua enkripsi & pembungkusan kode berjalan di browser lewat Web Crypto API — tidak ada file atau password yang pernah dikirim ke mana pun. Hanya tab Musik yang menghubungi internet.

## Fitur
- **Kunci File (Vault)** — terima file apa saja (zip, js, html, dll). Dienkripsi **AES-256-GCM** dengan kunci dari **PBKDF2-SHA256 (310.000 iterasi)** atas password kamu, lalu dibungkus jadi satu file `nama.vault.html`. File itu bisa dibuka langsung (dobel-klik) oleh siapa pun yang punya passwordnya, dari browser mana pun, tanpa internet.
- **Buka Vault** — cara cepat menguji vault yang sudah dibuat, tanpa harus dobel-klik filenya sendiri.
- **JS Packer** — membungkus kode `.js` jadi base64 + loader, dengan beberapa pilihan **gaya obfuskasi**:
  - *Standar* — satu lapis base64 + loader.
  - *Quantum Vortex* — payload di-XOR dengan kunci acak sebelum dibungkus base64.
  - *Nebula Polymorphic Storm* — payload dipecah jadi beberapa bagian, diacak urutannya, lalu disusun ulang saat dijalankan.
  - *Calcrick Chaos Core* — payload dibalik urutan karakternya lalu dipecah jadi potongan kecil.
  - *Time-Locked* — kode menolak berjalan setelah N hari yang kamu tentukan (1–365).
  - *Kustom* — nama variabel di hasilnya memakai kata kunci pilihanmu.

  Ditambah **gaya nama variabel** (acak/ASCII, Arab, Jepang/Hiragana, Mandarin/Han, atau "tak terlihat"/zero-width), opsi **sembunyikan string** (string literal dipecah ke array tersembunyi), dan **proteksi anti-tamper ringan** (pemeriksaan integritas kecil sebelum kode jalan). Semuanya murni kosmetik/lapisan tambahan di atas base64 — **bukan enkripsi sungguhan**, hanya memperlambat orang yang mencoba membaca kodenya sekilas.

- **Cari Musik** — cari lagu/artis/album, lihat cover, putar cuplikan 30 detik, dan buka lagu lengkapnya. Tanpa API key & tanpa backend. Sumber berurutan (otomatis pindah kalau gagal): iTunes Search API (fetch) → iTunes (JSONP) → Deezer (JSONP). Catatan: yang bisa diputar hanya cuplikan 30 detik resmi dari penyedia, bukan lagu penuh.

## Cara pakai
Buka `index.html` langsung di browser, atau host sebagai situs statis (Vercel, Netlify, GitHub Pages, dsb — tidak perlu build command maupun server).

## Batasan keamanan (baca ini)
- **Vault (AES-256-GCM)**: ini perlindungan nyata. Selama password kuat dan tidak bocor, secara matematis tidak bisa dibuka paksa — bahkan dengan superkomputer, bukan cuma "laptop biasa". Kalau password lupa, isi file **tidak bisa dipulihkan oleh siapa pun**, termasuk pembuat tool ini.
- **JS Packer**: kode JavaScript yang dibungkus tetap harus bisa dijalankan oleh browser orang yang membukanya. Artinya siapa pun yang membuka DevTools browser saat kode itu berjalan, pada akhirnya tetap bisa melihat hasil akhirnya. Tidak ada obfuskator JS di dunia — gratis maupun berbayar mahal — yang benar-benar "tidak bisa di-crack", karena sifat kode yang harus dieksekusi di sisi klien. Packer ini hanya memperlambat orang iseng, bukan penyerang serius.
- Opsi "Sembunyikan teks/string juga" di JS Packer memakai pencocokan string sederhana (regex), bukan parser JS penuh — berisiko salah pada kode yang memakai template literal (`` ` ``) atau regex literal yang berisi tanda kutip. Selalu tes hasilnya sebelum dipakai.
- Semua gaya obfuskasi (Quantum Vortex, Nebula, Calcrick, dst.) hanya mengubah *lapisan pembungkus* (XOR, pecah-acak, balik-string, nama variabel) di atas base64 yang sama — tingkat keamanannya setara, bukan bertingkat. Pilih gaya mana pun sesuai selera; kalau butuh proteksi yang benar-benar kuat, pakai tab "Kunci File".
