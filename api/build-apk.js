// Vercel Function: memicu workflow GitHub "build-apk.yml" untuk membangun APK dari link ZIP.
// Token GitHub hanya ada di environment Vercel (GITHUB_TOKEN). Tidak pernah dikirim ke browser.
const MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB
const WORKFLOW = "build-apk.yml";
const LABEL_RE = /^[A-Za-z0-9 _-]{1,40}$/;
const ID_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const secret = process.env.BUILD_SECRET;
  if (!token || !repo || !secret) {
    return res.status(500).json({ error: "Server belum dikonfigurasi (GITHUB_TOKEN, GITHUB_REPO, BUILD_SECRET)." });
  }
  if (!safeEqual(String(req.headers["x-build-secret"] || ""), secret)) {
    return res.status(401).json({ error: "Kode akses build salah." });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  let zipUrl;
  try { zipUrl = new URL(String(body.zip_url || "")); } catch (e) { zipUrl = null; }
  if (!zipUrl || zipUrl.protocol !== "https:" || zipUrl.href.length > 2048) {
    return res.status(400).json({ error: "Link ZIP harus https:// dan maksimal 2048 karakter." });
  }
  const label = String(body.app_label || "").trim();
  const appId = String(body.app_id || "").trim();
  if (!LABEL_RE.test(label)) return res.status(400).json({ error: "Nama aplikasi: huruf, angka, spasi, _ atau - (maks 40)." });
  if (!ID_RE.test(appId)) return res.status(400).json({ error: "Package ID contoh: com.nama.app (huruf kecil)." });

  // Cek ukuran lebih dulu bila server asal mengirim Content-Length.
  try {
    const head = await fetch(zipUrl.href, { method: "HEAD", redirect: "follow" });
    const len = Number(head.headers.get("content-length"));
    if (Number.isFinite(len) && len > MAX_BYTES) {
      return res.status(400).json({ error: "ZIP lebih besar dari 2 GB." });
    }
  } catch (e) { /* tidak semua host mendukung HEAD; workflow tetap membatasi ukuran */ }

  let r;
  try {
    r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "nexus-toolbox"
    },
    body: JSON.stringify({
      ref: process.env.GITHUB_REF || "main",
      inputs: { zip_url: zipUrl.href, app_label: label, app_id: appId }
    })
    });
  } catch (e) {
    return res.status(502).json({ error: "Gagal menghubungi GitHub." });
  }
  if (!r.ok) {
    return res.status(502).json({ error: `GitHub menolak permintaan build (status ${r.status}). Cek token dan izin Actions.` });
  }
  return res.status(202).json({
    message: "Build dimulai. Tunggu beberapa menit, lalu cek status.",
    runsUrl: `https://github.com/${repo}/actions/workflows/${WORKFLOW}`
  });
}
