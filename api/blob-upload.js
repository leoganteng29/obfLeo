// Vercel Function: memberi token upload ke Vercel Blob. Browser mengirim ZIP langsung ke Blob (tidak lewat server).
// Kode akses (BUILD_SECRET) wajib dicek sebelum token diberikan, supaya orang lain tidak bisa upload.
import { handleUpload } from "@vercel/blob/client";

const ZIP_TYPES = ["application/zip", "application/x-zip-compressed", "application/octet-stream"];

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default async function handler(request) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  const secret = process.env.BUILD_SECRET;
  if (!secret || !process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json({ error: "Server belum dikonfigurasi (BUILD_SECRET, BLOB_READ_WRITE_TOKEN)." }, { status: 500 });
  }
  try {
    const body = await request.json();
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!safeEqual(String(clientPayload || ""), secret)) {
          throw new Error("Kode akses build salah.");
        }
        if (!/\.zip$/i.test(pathname)) {
          throw new Error("Hanya file .zip yang diterima.");
        }
        return { allowedContentTypes: ZIP_TYPES, addRandomSuffix: true };
      },
      onUploadCompleted: async () => {},
    });
    return Response.json(json);
  } catch (e) {
    return Response.json({ error: e.message || "Upload ditolak." }, { status: 400 });
  }
}
