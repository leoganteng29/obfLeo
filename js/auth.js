/* Gerbang login NEXUS TOOLBOX. Seluruh website terkunci sampai user masuk (cek sesi di server). */
(function (N) {
  "use strict";
  const root = document.documentElement;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const call = (path, body) => fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : {},
    credentials: "same-origin",
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { const err = new Error(data.error || "Permintaan gagal (" + r.status + ")."); err.status = r.status; throw err; }
    return data;
  });

  const EYE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  const LOGO = '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M27.5 4.5 3.8 14.1l9.8 3.6 4.1 10.2 9.8-23.4Z" fill="currentColor"/></svg>';

  const gate = document.createElement("div");
  gate.className = "auth-gate";
  gate.innerHTML = `<div class="auth-card">
    <div class="auth-brand"><span class="auth-mark">${LOGO}</span><strong>NEXUS TOOLBOX</strong></div>
    <form class="auth-form" novalidate>
      <label class="auth-field"><span>Username</span><input name="u" autocomplete="username" maxlength="40" placeholder="username kamu"></label>
      <label class="auth-field"><span>Password</span>
        <span class="auth-pass"><input name="p" type="password" autocomplete="current-password" maxlength="200" placeholder="password kamu">
        <button type="button" class="auth-eye" aria-label="Tampilkan password">${EYE}</button></span>
      </label>
      <p class="auth-err" role="alert"></p>
      <button class="auth-go" type="submit"><span>Masuk</span><span aria-hidden="true">→</span></button>
      <div class="auth-or"><span>atau</span></div>
      <button class="auth-new" type="button">Buat akun baru gratis</button>
    </form>
    <div class="auth-created" hidden>
      <p class="auth-created-title">Akun kamu sudah dibuat. Simpan data ini. Password hanya ditampilkan sekali.</p>
      <div class="auth-row"><span>Username</span><code data-cu></code></div>
      <div class="auth-row"><span>Password</span><code data-cp></code></div>
      <div class="auth-row"><button type="button" class="auth-copy">Salin keduanya</button></div>
      <button type="button" class="auth-go auth-go-created"><span>Saya sudah menyimpan, masuk</span><span aria-hidden="true">→</span></button>
    </div>
  </div>`;
  document.body.appendChild(gate);

  const form = gate.querySelector(".auth-form");
  const err = gate.querySelector(".auth-err");
  const created = gate.querySelector(".auth-created");
  let creds = null;
  const setErr = (m) => { err.textContent = m || ""; };
  const unlock = () => { gate.hidden = true; root.classList.remove("auth-locked"); };
  const lock = () => { gate.hidden = false; root.classList.add("auth-locked"); };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    setErr("");
    const u = form.elements.u.value.trim();
    const p = form.elements.p.value;
    if (!u || !p) { setErr("Isi username dan password."); return; }
    call("/api/auth/login", { username: u, password: p }).then(() => { form.reset(); unlock(); }).catch((x) => setErr(x.message));
  });

  gate.querySelector(".auth-eye").addEventListener("click", (e) => {
    const input = form.elements.p;
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    e.currentTarget.setAttribute("aria-label", show ? "Sembunyikan password" : "Tampilkan password");
  });

  gate.querySelector(".auth-new").addEventListener("click", () => {
    setErr("");
    call("/api/auth/register", {}).then((d) => {
      creds = d;
      gate.querySelector("[data-cu]").textContent = d.username;
      gate.querySelector("[data-cp]").textContent = d.password;
      form.hidden = true;
      created.hidden = false;
    }).catch((x) => setErr(x.message));
  });

  created.querySelector(".auth-copy").addEventListener("click", (e) => {
    if (!creds) return;
    const text = "Username: " + creds.username + "\nPassword: " + creds.password;
    const done = () => { e.currentTarget.textContent = "Tersalin"; };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, done);
    else done();
  });
  created.querySelector(".auth-go-created").addEventListener("click", () => {
    created.hidden = true;
    form.hidden = false;
    unlock();
  });

  // Tombol keluar di sidebar
  const logout = document.createElement("button");
  logout.type = "button";
  logout.className = "btn btn-sm auth-logout";
  logout.textContent = "Keluar";
  logout.addEventListener("click", () => {
    call("/api/auth/logout", {}).catch(() => {}).then(() => location.reload());
  });
  const sidebar = document.getElementById("sidebar");
  if (sidebar) sidebar.appendChild(logout);

  const boot = () => call("/api/auth/me").then(unlock).catch((x) => {
    lock();
    if (x.status !== 401) setErr(x.message);
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  N.auth = { logout: () => logout.click() };
})(window.Nexus = window.Nexus || {});
