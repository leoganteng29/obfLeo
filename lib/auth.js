// Login akun untuk NEXUS TOOLBOX. Akun dan sesi disimpan di Redis (Vercel Store / Upstash).
// Password tidak pernah disimpan mentah: di-hash dengan scrypt. Sesi berupa cookie HttpOnly.
import crypto from "node:crypto";

const COOKIE = "nx_session";
const SESSION_SECONDS = 30 * 24 * 60 * 60;
const ALPHA_USER = "abcdefghijkmnpqrstuvwxyz23456789";
const ALPHA_PASS = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const redisUrl = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const redisToken = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

export function storeReady() {
  return Boolean(redisUrl() && redisToken());
}

async function cmd(...args) {
  const r = await fetch(redisUrl(), {
    method: "POST",
    headers: { Authorization: `Bearer ${redisToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error("Layanan login tidak bisa dihubungi.");
  const data = await r.json();
  if (data.error) throw new Error("Layanan login menolak permintaan.");
  return data.result;
}

const sha = (text) => crypto.createHash("sha256").update(text).digest("hex");
const randomFrom = (alphabet, n) => {
  let out = "";
  for (let i = 0; i < n; i++) out += alphabet[crypto.randomInt(alphabet.length)];
  return out;
};

export const normalizeUser = (u) => String(u || "").trim().toLowerCase();
export const validUser = (u) => /^[a-z0-9_]{3,24}$/.test(u);

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return { salt: salt.toString("hex"), hash: hash.toString("hex") };
}

export function checkPassword(password, saltHex, hashHex) {
  const key = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), 64);
  const want = Buffer.from(hashHex, "hex");
  return want.length === key.length && crypto.timingSafeEqual(key, want);
}

// Akun baru dibuat otomatis: username dan password acak. Password hanya ditampilkan sekali.
export async function createAccount() {
  for (let i = 0; i < 5; i++) {
    const username = "nx" + randomFrom(ALPHA_USER, 6);
    const password = randomFrom(ALPHA_PASS, 12);
    const { salt, hash } = hashPassword(password);
    const ok = await cmd("SET", "user:" + username, JSON.stringify({ username, salt, hash, created: Date.now() }), "NX");
    if (ok === "OK") return { username, password };
  }
  throw new Error("Gagal membuat akun. Coba lagi.");
}

export async function getUser(username) {
  const raw = await cmd("GET", "user:" + username);
  return raw ? JSON.parse(raw) : null;
}

function sessionToken(req) {
  const m = /(?:^|;\s*)nx_session=([a-f0-9]{64})/.exec(req.headers.cookie || "");
  return m ? m[1] : "";
}

export async function startSession(res, username) {
  const token = crypto.randomBytes(32).toString("hex");
  await cmd("SET", "sess:" + sha(token), JSON.stringify({ u: username }), "EX", String(SESSION_SECONDS));
  res.setHeader("Set-Cookie", `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}`);
}

export async function currentUser(req) {
  const token = sessionToken(req);
  if (!token) return null;
  const raw = await cmd("GET", "sess:" + sha(token));
  return raw ? JSON.parse(raw).u : null;
}

export async function endSession(req, res) {
  const token = sessionToken(req);
  if (token) await cmd("DEL", "sess:" + sha(token));
  res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
}
