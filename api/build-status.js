// Vercel Function: status build dari GitHub Actions.
// GET tanpa parameter  -> daftar riwayat build.
// GET ?run=ID          -> progres satu build (jumlah langkah selesai dan langkah yang sedang jalan).
const WORKFLOW = "build-apk.yml";

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
    return res.status(500).json({ error: "Server belum dikonfigurasi (GITHUB_TOKEN, GITHUB_REPO, BUILD_SECRET)." });
  }
  if (!safeEqual(String(req.headers["x-build-secret"] || ""), secret)) {
    return res.status(401).json({ error: "Kode akses build salah." });
  }
  const gh = (path) => fetch(`https://api.github.com/repos/${repo}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "nexus-toolbox" },
  });

  const url = new URL(req.url || "/", "https://x.invalid");
  const runId = url.searchParams.get("run");
  try {
    if (runId !== null) {
      if (!/^\d{1,15}$/.test(runId)) return res.status(400).json({ error: "ID build tidak valid." });
      const [runRes, jobsRes] = await Promise.all([gh(`/actions/runs/${runId}`), gh(`/actions/runs/${runId}/jobs?per_page=5`)]);
      if (!runRes.ok) return res.status(502).json({ error: `GitHub menolak permintaan (status ${runRes.status}).` });
      const run = await runRes.json();
      const jobs = jobsRes.ok ? (await jobsRes.json()).jobs || [] : [];
      const steps = (jobs[0] && jobs[0].steps) || [];
      const done = steps.filter((s) => s.status === "completed").length;
      const current = steps.find((s) => s.status !== "completed");
      return res.status(200).json({
        id: run.id,
        status: run.status,
        conclusion: run.conclusion,
        url: run.html_url,
        total: steps.length,
        done,
        current: current ? current.name : "",
      });
    }
    const r = await gh(`/actions/workflows/${WORKFLOW}/runs?per_page=20`);
    if (!r.ok) return res.status(502).json({ error: `GitHub menolak permintaan (status ${r.status}).` });
    const data = await r.json();
    return res.status(200).json({
      runs: (data.workflow_runs || []).map((x) => ({
        id: x.id,
        title: x.display_title || x.name || "Build APK",
        status: x.status,
        conclusion: x.conclusion,
        created_at: x.created_at,
        url: x.html_url,
      })),
    });
  } catch (e) {
    return res.status(502).json({ error: "Gagal menghubungi GitHub." });
  }
}
