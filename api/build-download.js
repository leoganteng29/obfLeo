// Vercel Function: memberi link unduh sementara untuk artifact APK dari sebuah build.
// Token GitHub tetap di server. Browser hanya menerima link pre-signed yang berlaku singkat.
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const secret = process.env.BUILD_SECRET;
  if (!token || !repo || !secret) {
    return res.status(500).json({ error: "Server belum dikonfigurasi." });
  }
  if (!safeEqual(String(req.headers["x-build-secret"] || ""), secret)) {
    return res.status(401).json({ error: "Kode akses build salah." });
  }
  const url = new URL(req.url || "/", "https://x.invalid");
  const runId = url.searchParams.get("run") || "";
  if (!/^\d{1,15}$/.test(runId)) return res.status(400).json({ error: "ID build tidak valid." });

  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "nexus-toolbox" };
  try {
    const list = await fetch(`https://api.github.com/repos/${repo}/actions/runs/${runId}/artifacts`, { headers });
    if (!list.ok) return res.status(502).json({ error: `GitHub menolak permintaan (status ${list.status}).` });
    const artifact = ((await list.json()).artifacts || []).find((a) => !a.expired);
    if (!artifact) return res.status(404).json({ error: "APK untuk build ini tidak ditemukan atau sudah kedaluwarsa (7 hari)." });
    const r = await fetch(artifact.archive_download_url, { headers, redirect: "manual" });
    const location = r.headers.get("location");
    if (!location) return res.status(502).json({ error: "GitHub tidak memberi link unduh." });
    return res.status(200).json({ url: location, name: `${artifact.name}.zip` });
  } catch (e) {
    return res.status(502).json({ error: "Gagal menghubungi GitHub." });
  }
}
