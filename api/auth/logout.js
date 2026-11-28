import { storeReady, endSession } from "../../lib/auth.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    if (storeReady()) await endSession(req, res);
    else res.setHeader("Set-Cookie", "nx_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(502).json({ error: "Gagal keluar. Coba lagi." });
  }
}
