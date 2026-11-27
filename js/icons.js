/* NEXUS TOOLBOX — ikon SVG seragam (menggantikan emoji native di seluruh UI). */
(function (N) {
  "use strict";

  const P = {
    shield: '<path d="M12 3 5 6v5.4c0 4.1 2.7 7 7 8.6 4.3-1.6 7-4.5 7-8.6V6l-7-3Z"/><path d="m9.2 12 1.9 1.9 3.8-4"/>',
    sparkle: '<path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z"/><path d="m18.6 15.4.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7.7-2.1Z"/>',
    code: '<path d="m8.5 7.5-5 4.5 5 4.5M15.5 7.5l5 4.5-5 4.5M13.5 4.5l-3 15"/>',
    braces: '<path d="M9 4H8a2 2 0 0 0-2 2v3a2 2 0 0 1-2 2 2 2 0 0 1 2 2v3a2 2 0 0 0 2 2h1M15 4h1a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2 2 2 0 0 0-2 2v3a2 2 0 0 1-2 2h-1"/>',
    check: '<path d="m5 12.5 4.2 4.2L19 7"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
    link: '<path d="M10.5 13.5a4.5 4.5 0 0 0 6.4 0l2.1-2.1a4.5 4.5 0 0 0-6.4-6.4L11 6.6"/><path d="M13.5 10.5a4.5 4.5 0 0 0-6.4 0L5 12.6a4.5 4.5 0 0 0 6.4 6.4L13 17.4"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 0-4H12a2 2 0 0 1 0-4h4a4 4 0 0 0 4-4A6 6 0 0 0 12 3Z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6M12 2v2M19 6l1.5-1.5"/>',
    diff: '<path d="M7 4v16M4 8h6M4 16h6M14 8h6M17 5v6M14 16h6"/>',
    regex: '<path d="M5 19 19 5"/><circle cx="8.5" cy="8.5" r="3.5"/><path d="M15 15h4M17 13v4"/>',
    hash: '<path d="M9 3 7 21M17 3l-2 18M4 9h16M3 15h16"/>',
    fileText: '<path d="M6 3h8l4 4v14H6V3Z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
    alert: '<path d="M12 4 2.8 20h18.4L12 4Z"/><path d="M12 10v4M12 17h.01"/>',
    music: '<path d="M9 18V6l10-2v12"/><ellipse cx="6.5" cy="18" rx="2.6" ry="2"/><ellipse cx="16.5" cy="16" rx="2.6" ry="2"/>',
    github: '<path d="M8.5 20c-3.8 1.1-3.8-2-5.2-2.4M15.5 21v-3.3a2.9 2.9 0 0 0-.8-2.3c2.8-.3 5.8-1.4 5.8-6.2A4.8 4.8 0 0 0 19 4a4.5 4.5 0 0 0-.1-3.5S17.7.1 15 1.9a11.5 11.5 0 0 0-6 0C6.3.1 5.1.5 5.1.5A4.5 4.5 0 0 0 5 4a4.8 4.8 0 0 0-1.3 5.2c0 4.8 3 5.9 5.8 6.2a2.9 2.9 0 0 0-.8 2.3V21"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    camera: '<path d="M4 7h3l1.5-2h7L17 7h3v12H4V7Z"/><circle cx="12" cy="13" r="3.4"/>',
    download: '<path d="M12 3v12m0 0 4-4m-4 4-4-4M4 18v2h16v-2"/>',
    upload: '<path d="M12 16V4m0 0 4 4m-4-4L8 8M4 18v2h16v-2"/>',
    leaf: '<path d="M20 4C11 4 5 8 5 15a5 5 0 0 0 5 5c7 0 10-6 10-16Z"/><path d="M5 19c3-5 7-8 12-10"/>',
    note: '<path d="M5 3h14v18H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    clipboard: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V2h6v2M9 9h6M9 13h6"/>',
    dice: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.2"/><circle cx="16" cy="8" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="8" cy="16" r="1.2"/><circle cx="16" cy="16" r="1.2"/>',
    key: '<circle cx="8" cy="16" r="4"/><path d="m11 13 8-8 2 2-2 2 2 2-3 3-2-2-2 2"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20h1"/>',
    phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4M11 19h2"/>',
    text: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    word: '<path d="M4 6h16M4 12h12M4 18h9"/><path d="m16 16 4 4m0-4-4 4"/>',
    case: '<path d="M4 18 9 6l5 12M6 14h6M15 18l3-8 3 8M16.2 15.4h3.6"/>',
    align: '<path d="M4 5h16M4 10h12M4 15h16M4 20h9"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.1 1-1.1 1.8M12 17h.01"/>',
    hand: '<path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11m0-1V4.5a1.5 1.5 0 0 1 3 0V11m0-.5V6.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L4 14a1.6 1.6 0 0 1 2.6-1.9L8 13.5"/>',
    scissors: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8 7.5 20 18M8 16.5 20 6"/>',
    route: '<path d="M5 4v6a4 4 0 0 0 4 4h6a4 4 0 0 1 4 4v2"/><circle cx="5" cy="4" r="2"/><circle cx="19" cy="20" r="2"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    hash: '<path d="M9 3 7 21M17 3l-2 18M4 9h16M3 15h16"/>',
    pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
    play: '<path d="m8 5 11 7-11 7V5Z"/>',
    skipBack: '<path d="M19 5v14L9 12l10-7ZM6 5v14"/>',
    skipForward: '<path d="M5 5v14l10-7L5 5ZM18 5v14"/>',
    heart: '<path d="M12 20s-7-4.4-9-8.2C1.5 8.5 3.2 5 6.5 5c2 0 3.4 1.1 4.2 2.3C11.5 6.1 12.9 5 14.8 5c3.3 0 5 3.5 3.5 6.8C19 15.6 12 20 12 20Z"/>',
    heartOff: '<path d="M12 20s-7-4.4-9-8.2C1.5 8.5 3.2 5 6.5 5c2 0 3.4 1.1 4.2 2.3C11.5 6.1 12.9 5 14.8 5c3.3 0 5 3.5 3.5 6.8C19 15.6 12 20 12 20Z"/><path d="M3 3l18 18"/>',
    flag: '<path d="M5 21V4m0 0h11l-2 4 2 4H5"/>',
    eye: '<path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.8"/>',
    eyeOff: '<path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.8"/><path d="M3 3l18 18"/>',
    backspace: '<path d="M9 5h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9L2 12l7-7Z"/><path d="m12 9 5 6m0-6-5 6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    ellipsis: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
    markdown: '<path d="M4 8V5h3l5 6 5-6h3v3M4 19h16M4 15l4 4 4-4 4 4 4-4"/>',
    home: '<path d="m3.5 10.5 8.5-7 8.5 7V20a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1v-9.5Z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.1 2.1-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-3v-.2a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-2.1-2.1.06-.06A1.7 1.7 0 0 0 7 14.9a1.7 1.7 0 0 0-1.56-1.03H5v-3h.44A1.7 1.7 0 0 0 7 9.84a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.1-2.1.06.06A1.7 1.7 0 0 0 10.64 6a1.7 1.7 0 0 0 1.03-1.56V4.4h3V4.5a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.1 2.1-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.03h.1v3h-.1A1.7 1.7 0 0 0 19.4 15Z"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m4 17 5-5 4 4 3-3 4 4"/>',
    paperclip: '<path d="M20 11.5 12.5 19a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7-7"/>',
    send: '<path d="m21 3-8.5 18-2.2-7.3L3 11.5 21 3Z"/><path d="M10.3 13.7 21 3"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    star: '<path d="m12 3 2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.9-5.4 2.9 1-6L3.3 9.4l6-.9L12 3Z"/>',
    starOff: '<path d="m12 3 2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.9-5.4 2.9 1-6L3.3 9.4l6-.9L12 3Z"/><path d="M4 20 20 4"/>',
    arrowLeft: '<path d="M20 12H4m0 0 6-6m-6 6 6 6"/>',
    arrowUp: '<path d="M12 20V4m0 0-6 6m6-6 6 6"/>',
    arrowDown: '<path d="M12 4v16m0 0 6-6m-6 6-6-6"/>',
    arrowRight: '<path d="M4 12h16m0 0-6-6m6 6-6 6"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    chat: '<path d="M4 5h16v11H8l-4 4V5Z"/><path d="M8 9h8M8 12h5"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    diamond: '<path d="m12 3 9 9-9 9-9-9 9-9Z"/><path d="M3 12h18M12 3l3 9-3 9-3-9 3-9Z"/>',
    trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v2a3 3 0 0 0 3 3m10-5h3v2a3 3 0 0 1-3 3M12 14v4m-4 2h8"/>',
    zoom: '<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5M8 11h6M11 8v6"/>',
    wrench: '<path d="M20 6a5 5 0 0 1-6.5 4.8L6 18.3A2.4 2.4 0 0 1 2.7 15l7.5-7.5A5 5 0 0 1 17 3l-3 3 4 4 2-4Z"/>'
  };

  const TOOLS = {
    "js-protector": "shield", "ai-studio": "sparkle", "js-formatter": "code",
    "js-minifier": "layers", "json-formatter": "braces", "json-validator": "check",
    "json-minifier": "braces", "base64": "code", "url-encode": "link",
    "html-entity": "code", "color-converter": "palette", "timestamp": "clock",
    "text-diff": "diff", "regex-tester": "regex", "uuid-generator": "key",
    "hash-generator": "hash", "markdown-preview": "fileText", "css-formatter": "palette",
    "html-formatter": "code", "stopwatch": "timer", "countdown": "timer", "clock": "clock",
    "scamcheck": "alert", "lyrics": "music", "spotify": "music", "github-profile": "github",
    "temp-email": "mail", "ssweb": "camera", "webtozip": "download", "pomodoro": "timer",
    "notes": "note", "clipboard": "clipboard", "random-picker": "dice", "password": "key",
    "qr": "qr", "photolive": "phone", "text-counter": "text", "word-counter": "word",
    "case-converter": "case", "lorem": "align", "daily-challenge": "sparkle",
    "reaction": "bolt", "memory": "grid", "number": "help", "tictactoe": "grid",
    "rps": "hand", "2048": "grid", "snake": "route", "scramble": "word",
    "click": "target", "ambient": "music"
  };
  const CATEGORIES = { protection: "shield", developer: "code", utility: "wrench", game: "bolt", ambience: "music" };

  function svg(name, cls) {
    const body = P[name] || P.code;
    return '<svg class="app-ico' + (cls ? " " + cls : "") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + "</svg>";
  }
  function tool(id, cat) { return svg(TOOLS[id] || CATEGORIES[cat] || "code"); }
  function category(id) { return svg(CATEGORIES[id] || "code"); }
  function game(id) { return svg(TOOLS[id] || "grid"); }

  N.icons = { svg, tool, category, game, names: Object.keys(P) };
})(window.Nexus = window.Nexus || {});
