// Vercel Function: OpenRouter proxy. Secret stays on the server.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: { message: "Method not allowed" } });
  }
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return res.status(500).json({ error: { message: "OPENROUTER_API_KEY belum diatur di Vercel." } });
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    if (!body.model || !Array.isArray(body.messages)) {
      return res.status(400).json({ error: { message: "Payload model/messages tidak valid." } });
    }
    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": `https://${req.headers.host || ""}`,
        "X-Title": "NEXUS TOOLBOX"
      },
      body: JSON.stringify(body)
    });
    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
    res.setHeader("Cache-Control", "no-store");
    if (upstream.body) {
      // Stream response without exposing the upstream credential.
      for await (const chunk of upstream.body) res.write(Buffer.from(chunk));
      return res.end();
    }
    return res.end(await upstream.text());
  } catch (err) {
    return res.status(502).json({ error: { message: "Gagal menghubungi OpenRouter." } });
  }
}
