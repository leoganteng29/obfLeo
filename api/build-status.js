// Vercel Function: daftar run terakhir workflow build-apk.yml (tanpa membocorkan token).
const WORKFLOW = "build-apk.yml";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const secret = process.env.BUILD_SECRET;
  if (!token || !repo || !secret) return res.status(500).json({ error: "Server belum dikonfigurasi." });
  if (String(req.headers["x-build-secret"] || "") !== secret) return res.status(401).json({ error: "Kode akses build salah." });

  try {
    const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW}/runs?per_page=5`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "nexus-toolbox" }
    });
    if (!r.ok) return res.status(502).json({ error: `GitHub menolak permintaan (status ${r.status}).` });
    const data = await r.json();
    const runs = (data.workflow_runs || []).map((x) => ({
      id: x.id, status: x.status, conclusion: x.conclusion, created_at: x.created_at, url: x.html_url, title: x.display_title
    }));
    return res.status(200).json({ runs });
  } catch (e) {
    return res.status(502).json({ error: "Gagal menghubungi GitHub." });
  }
}
