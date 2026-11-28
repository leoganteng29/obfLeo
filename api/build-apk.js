// Vercel Function: memicu workflow "build-apk.yml" untuk ZIP yang sudah diupload ke Vercel Blob.
// Token GitHub hanya ada di env Vercel (GITHUB_TOKEN). Nama app & package ID dibaca otomatis dari ZIP.
const MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB
const WORKFLOW = "build-apk.yml";
const MODES = ["flutter", "web"];

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
  const mode = String(body.mode || "");
  if (!MODES.includes(mode)) return res.status(400).json({ error: "Mode tidak dikenal." });

  // Hanya terima link dari Vercel Blob, bukan URL sembarang.
  let zipUrl;
  try { zipUrl = new URL(String(body.blob_url || "")); } catch (e) { zipUrl = null; }
  if (!zipUrl || zipUrl.protocol !== "https:" || !zipUrl.hostname.endsWith(".blob.vercel-storage.com") || zipUrl.href.length > 2048) {
    return res.status(400).json({ error: "Link ZIP tidak valid. Upload ulang file ZIP." });
  }

  try {
    const head = await fetch(zipUrl.href, { method: "HEAD" });
    const len = Number(head.headers.get("content-length"));
    if (Number.isFinite(len) && len > MAX_BYTES) return res.status(400).json({ error: "ZIP lebih besar dari 2 GB." });
  } catch (e) { /* workflow tetap membatasi ukuran */ }

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
      body: JSON.stringify({ ref: process.env.GITHUB_REF || "main", inputs: { zip_url: zipUrl.href, mode } })
    });
  } catch (e) {
    return res.status(502).json({ error: "Gagal menghubungi GitHub." });
  }
  if (!r.ok) {
    return res.status(502).json({ error: `GitHub menolak permintaan build (status ${r.status}). Cek token dan izin Actions.` });
  }
  return res.status(202).json({
    message: mode === "flutter" ? "Build APK Flutter dimulai." : "Build Web to APK dimulai.",
    runsUrl: `https://github.com/${repo}/actions/workflows/${WORKFLOW}`
  });
}
