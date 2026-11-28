import { storeReady, createAccount, startSession } from "../../lib/auth.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!storeReady()) return res.status(503).json({ error: "Layanan login belum siap. Coba lagi nanti." });
  try {
    const acc = await createAccount();
    await startSession(res, acc.username);
    return res.status(201).json({ username: acc.username, password: acc.password });
  } catch (e) {
    return res.status(502).json({ error: e.message || "Gagal membuat akun." });
  }
}
