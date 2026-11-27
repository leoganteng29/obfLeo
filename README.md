# NEXUS TOOLBOX

Premium, all-in-one developer toolkit and game center built with **plain HTML, CSS, and vanilla JavaScript**. It runs entirely in the browser: no backend, no build step, no external runtime dependencies, and no source code is uploaded anywhere.

## Features

- **42 local tools** across 5 categories:
  - **Code Protection** — JavaScript Code Protector with 5 modes.
  - **Developer Tools** — formatters, validators, converters, encoders, hash utilities, regex tester, diff, Markdown preview, and more.
  - **Utilities** — timers, notes, clipboard, random picker, password/QR generators, counters, case converter, Lorem Ipsum, and daily challenge.
  - **Game Center** — 9 locally playable games with local best scores/replays and difficulty controls where applicable.
  - **Ambience** — Web Audio soundscapes, animated visualizer, focus mode, volume, and auto-stop timer.
- Light blue-and-white CRM-style workspace with a floating glassy sidebar, soft shadows, blue accent variants, responsive desktop/tablet/mobile layouts, and reduced-motion support.
- Sky-blue splash on the first visit (or at `#/landing`): an animated paper plane flies an arc, then the script logo and "Fly smarter, build faster" tagline fade in; auto-advances to the dashboard, or use "Mulai Terbang →" / Enter. Reopen it from Settings → "Lihat landing lagi".
- Dashboard with a greeting header, date pill/search/bell/quick-add controls, four KPI cards with sparklines and local deltas, an INSIGHTS strip, a 7-day Tools/Game activity chart with a dashed target line, a daily-challenge gauge, featured tools, categories, recently used, favorites, and activity history.
- Global search by tool name, category, description, ID, and keywords.
- Custom toast, modal, settings, loading/skeleton states, empty/error states, and tooltips.
- Favorites, history, preferences, notes, clipboard snippets, and game scores persisted in `localStorage`.

## Run locally

No installation is required.

1. Open `index.html` directly in a modern browser, or serve the folder with any static server.
2. Optional local server:

   ```bash
   cd /root/projects/nexus-toolbox
   python3 -m http.server 8080
   ```

   Then visit <http://localhost:8080>.

Classic deferred scripts are used instead of ES modules so the app also works from `file://` in common browsers. The interface uses the bundled AROMA font (`fonts/AROMA.ttf`) for all text, so no font request is made to external servers; symbols missing from the font fall back to system fonts.

## Routes

Navigation uses hash routes, so every view is linkable and browser back/forward works:

| Route | View |
| --- | --- |
| `#/landing` | First-visit splash / paper-plane landing |
| `#/dashboard` | Dashboard / overview |
| `#/protect` | JavaScript Code Protector |
| `#/tools` | Developer tools index |
| `#/tools/<id>` | Individual developer tool |
| `#/utilities` | Utilities index |
| `#/utilities/<id>` | Individual utility |
| `#/games` | Game Center |
| `#/games/<id>` | Individual game |
| `#/music` | Ambient Sound Lounge |
| `#/favorites` | Saved tools |
| `#/history` | Local activity history |

Tool IDs are defined in `js/registry.js` and are the canonical keys used for routing, favorites, history, and usage statistics. An empty hash opens the landing page only until it has been seen; afterward it opens the dashboard. Direct links such as `#/tools` or `#/games/2048` always render their target immediately and mark the landing as seen.

## Project structure

```text
nexus-toolbox/
├── index.html              App shell and script loading order
├── css/styles.css          Design system, components, responsive styles
└── js/
    ├── core.js             State, localStorage, toasts, modals, cleanup registry
    ├── registry.js         Tool catalog, categories, search
    ├── code-tools.js       Developer tools and JS/CSS/HTML token formatters
    ├── protection.js       JavaScript protector UI and transformations
    ├── utility-tools.js    Utility implementations and dispatcher
    ├── qr.js               Local QR encoder and PNG export
    ├── games.js            Game Center and all mini-games
    ├── music.js            Web Audio soundscapes and visualizer
    └── app.js              Routing, dashboard, indexes, search, settings, shell
```

Scripts load in the order shown above and share a single `window.Nexus` namespace.

## Local data and privacy

- App state is stored under the `nexus-toolbox:v1` key in `localStorage`.
- Saved data includes favorites, recently used tools, usage counts, preferences, notes, clipboard snippets, daily-challenge progress, and game best scores.
- Dashboard numbers come from actual local activity and are labeled as such. No fake user counts or server analytics are used.
- **Reset Local Data** in Settings clears the app storage key and reloads the interface.
- Notes and clipboard snippets stay on the current device/browser. Clearing browser site data removes them.

## Security notes

- User code is treated as text. It is never executed with `eval()`, `new Function()`, script injection, or automatic runtime wrappers.
- JavaScript source is processed only in the browser and is never sent to a server.
- Uploads are validated by file extension, size, and readable text content; errors are shown in the UI.
- Generated output is written with escaped/inserted text nodes, not executed as HTML/JavaScript.
- The QR code generator is implemented locally; no third-party image or tracking API is used.
- Ambient audio is synthesized with the Web Audio API. No copyrighted audio files are embedded and no external audio attribution is required.
- Password and UUID generation use `crypto.getRandomValues()`.

### Enc Center (pilihan seperti plugin enc)

Di halaman `#/protect` ada grid **Enc Center** dengan pilihan yang sama seperti plugin enc:

| Pilihan | Command | Input |
| --- | --- | --- |
| Enkripsi VM Normal | `.encnormal` | — |
| Enkripsi VM Hard | `.enchard` | — |
| Enkripsi VM Extreme | `.encextreme` | — |
| Enkripsi Quantum | `.encquantum` | — |
| Enkripsi Mandarin | `.encmandarin` | — |
| Enkripsi Arab | `.encarab` | — |
| Enkripsi Custom Prefix | `.enccustom [NamaPrefix]` | NamaPrefix (huruf, angka, `_`) |

Nama file output mengikuti plugin: `enc-<metode>-<nama file>.js`, misalnya `enc-vm_hard-app.js` atau `enc-custom-MySecret-app.js`.

Catatan jujur:
- Logika VM (XOR, RC4, pemecahan key, shuffle, wrapper anti-debug) diport persis dari plugin.
- Tahap `javascript-obfuscator` dan `js-confuser` dari plugin tidak bisa dijalankan di browser tanpa dependency, jadi Quantum, Mandarin, Arab, dan Custom memakai rename + pemecahan string lokal. Hasilnya tidak identik byte per byte.
- Plugin asli punya bug: decoder chunk di wrapper VM memakai seed yang berbeda dari encoder, sehingga payload lebih dari 128 karakter base64 rusak saat dijalankan. Port di toolbox sudah memperbaikinya.
- Output VM memakai `Buffer`, jadi hanya berjalan di Node.js.

### About the Code Protector

The JavaScript Code Protector performs **textual, client-side transformations**: whitespace reduction, identifier renaming, comment/readability reduction, and custom toggles. It is useful for making source less convenient to read, but it is **not irreversible encryption** and **not a security boundary**. Any JavaScript that must run in a browser can still be analyzed, instrumented, or reconstructed by a determined user.

Do not place secrets, API keys, bearer tokens, credentials, or other sensitive data in client-side JavaScript. Keep authorization checks and secrets on a server you control. The protector intentionally avoids masking credentials or tokens in a way that could mislead users into treating them as protected. Some transformations can change behavior in code that relies on reflection, dynamic property names, `eval`, string-based APIs, or exact source text; compatibility warnings are shown in the UI.

## Verification

All JavaScript files pass `node --check`. Logic was also exercised with small Node smoke tests covering tokenizer/formatter/minifier behavior, protection modes, QR generation, registry search, and behavior equivalence of original vs transformed sample code. No browser binary was available in the development environment, so interactive UI behavior should be confirmed by opening the app in a browser.

## Motion

- `vendor/gsap.min.js`, `vendor/ScrollTrigger.min.js`, `vendor/SplitText.min.js`: GSAP 3.15.1 (GreenSock, lisensi standar GSAP).
- `vendor/lenis-lite.js`: smooth scroll ringan dengan API ala Lenis. Bisa diganti dengan build resmi `lenis.min.js` tanpa mengubah `js/fx.js`.
- `js/fx.js`: mengatur smooth scroll, animasi saat halaman tampil, judul per huruf/kata, dan reveal kartu saat di-scroll. Semua dimatikan jika reduce-motion aktif.

## Foto Live HP

- Tool ada di Utilities (`#/utilities/photolive`) dan dibuat di `js/photolive.js`.
- Template ada di `assets/phone/` (`v1.jpg` sampai `v7.jpg`) dengan `mask.png` untuk sudut layar. Koordinat layar ada di `js/photolive.js` (diambil dari `quads.json`).
- Foto diproses sepenuhnya di browser. Output: PNG (satu gambar) atau video loop pendek (WebM/MP4) sebagai foto live.
- Harus dijalankan lewat server lokal (mis. `python -m http.server`), karena canvas tidak bisa membaca gambar dari file lokal.
