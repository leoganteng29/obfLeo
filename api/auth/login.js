import { storeReady, normalizeUser, validUser, getUser, checkPassword, hashPassword, startSession } from "../../lib/auth.js";

const BAD = "Username atau password salah.";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!storeReady()) return res.status(503).json({ error: "Layanan login belum siap. Coba lagi nanti." });
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const username = normalizeUser(body.username);
  const password = String(body.password || "");
  if (!validUser(username) || !password || password.length > 200) return res.status(401).json({ error: BAD });
  try {
    const user = await getUser(username);
    if (!user) {
      hashPassword(password); // menyamakan waktu respons dengan akun yang ada
      return res.status(401).json({ error: BAD });
    }
    if (!checkPassword(password, user.salt, user.hash)) return res.status(401).json({ error: BAD });
    await startSession(res, username);
    return res.status(200).json({ username });
  } catch (e) {
    return res.status(502).json({ error: "Layanan login tidak bisa dihubungi. Coba lagi." });
  }
}
