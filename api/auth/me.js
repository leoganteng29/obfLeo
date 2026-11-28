import { storeReady, currentUser } from "../../lib/auth.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!storeReady()) return res.status(503).json({ error: "Layanan login belum siap. Coba lagi nanti." });
  try {
    const username = await currentUser(req);
    if (!username) return res.status(401).json({ error: "Belum masuk." });
    return res.status(200).json({ username });
  } catch (e) {
    return res.status(502).json({ error: "Layanan login tidak bisa dihubungi. Coba lagi." });
  }
}
