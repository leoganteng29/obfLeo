# Vault & JS Packer

Website statis, tanpa server/backend. Semua enkripsi & pembungkusan kode berjalan di browser lewat Web Crypto API — tidak ada file atau password yang pernah dikirim ke mana pun.

## Fitur
- **Kunci File (Vault)** — terima file apa saja (zip, js, html, dll). Dienkripsi **AES-256-GCM** dengan kunci dari **PBKDF2-SHA256 (310.000 iterasi)** atas password kamu, lalu dibungkus jadi satu file `nama.vault.html`. File itu bisa dibuka langsung (dobel-klik) oleh siapa pun yang punya passwordnya, dari browser mana pun, tanpa internet.
- **Buka Vault** — cara cepat menguji vault yang sudah dibuat, tanpa harus dobel-klik filenya sendiri.
- **JS Packer** — membungkus kode `.js` jadi base64 + loader (opsional: string literal disembunyikan di array terpisah). Ini obfuskasi ringan, BUKAN enkripsi.

## Cara pakai
Buka `index.html` langsung di browser, atau host sebagai situs statis (Vercel, Netlify, GitHub Pages, dsb — tidak perlu build command maupun server).

## Batasan keamanan (baca ini)
- **Vault (AES-256-GCM)**: ini perlindungan nyata. Selama password kuat dan tidak bocor, secara matematis tidak bisa dibuka paksa — bahkan dengan superkomputer, bukan cuma "laptop biasa". Kalau password lupa, isi file **tidak bisa dipulihkan oleh siapa pun**, termasuk pembuat tool ini.
- **JS Packer**: kode JavaScript yang dibungkus tetap harus bisa dijalankan oleh browser orang yang membukanya. Artinya siapa pun yang membuka DevTools browser saat kode itu berjalan, pada akhirnya tetap bisa melihat hasil akhirnya. Tidak ada obfuskator JS di dunia — gratis maupun berbayar mahal — yang benar-benar "tidak bisa di-crack", karena sifat kode yang harus dieksekusi di sisi klien. Packer ini hanya memperlambat orang iseng, bukan penyerang serius.
- Opsi "Sembunyikan teks/string juga" di JS Packer memakai pencocokan string sederhana (regex), bukan parser JS penuh — berisiko salah pada kode yang memakai template literal (`` ` ``) atau regex literal yang berisi tanda kutip. Selalu tes hasilnya sebelum dipakai.
