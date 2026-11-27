// Vercel Function: list models using the server-side OpenRouter key.
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: { message: "Method not allowed" } });
  }
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return res.status(500).json({ error: { message: "OPENROUTER_API_KEY belum diatur di Vercel." } });
  try {
    const upstream = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { "Authorization": `Bearer ${key}` }
    });
    const body = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    return res.send(body);
  } catch (err) {
    return res.status(502).json({ error: { message: "Gagal mengambil daftar model OpenRouter." } });
  }
}
